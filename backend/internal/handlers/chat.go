package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type ChatHub struct {
	mu    sync.Mutex
	rooms map[string]map[string]*websocket.Conn
}

func NewChatHub() *ChatHub {
	return &ChatHub{rooms: make(map[string]map[string]*websocket.Conn)}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (a *Handler) handleChatWebSocket(c *gin.Context) {
	token := c.Query("token")
	studentID := c.Query("studentId")
	if token == "" || studentID == "" {
		respondErr(c, http.StatusBadRequest, "token and studentId are required")
		return
	}
	claims, err := a.parseToken(token)
	if err != nil || (claims.Role != "student" && claims.Role != "warden") {
		respondErr(c, http.StatusUnauthorized, "invalid chat token")
		return
	}
	if claims.Role == "student" && claims.UserID != studentID {
		respondErr(c, http.StatusForbidden, "students can only join their own chat")
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	a.hub.add(studentID, claims.Role, conn)
	defer func() {
		a.hub.remove(studentID, claims.Role, conn)
		_ = conn.Close()
	}()
	for {
		var req struct {
			Message string `json:"message"`
		}
		if err := conn.ReadJSON(&req); err != nil {
			return
		}
		if req.Message == "" {
			continue
		}
		msg := gin.H{"id": newID(), "studentId": studentID, "senderId": claims.UserID, "senderRole": claims.Role, "message": req.Message, "createdAt": nowString()}
		_, _ = a.DB.Exec(`
			INSERT INTO chat_messages (id, student_id, sender_id, sender_role, message, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, msg["id"], studentID, claims.UserID, claims.Role, req.Message, msg["createdAt"])
		a.hub.broadcast(studentID, msg)
	}
}

func (h *ChatHub) add(studentID, role string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[studentID] == nil {
		h.rooms[studentID] = make(map[string]*websocket.Conn)
	}
	h.rooms[studentID][role] = conn
}

func (h *ChatHub) remove(studentID, role string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[studentID] != nil && h.rooms[studentID][role] == conn {
		delete(h.rooms[studentID], role)
		if len(h.rooms[studentID]) == 0 {
			delete(h.rooms, studentID)
		}
	}
}

func (h *ChatHub) presence(studentID string) (bool, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.rooms[studentID]
	if room == nil {
		return false, false
	}
	return room["student"] != nil, room["warden"] != nil
}

func (h *ChatHub) broadcast(studentID string, payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	bytes, _ := json.Marshal(payload)
	for _, conn := range h.rooms[studentID] {
		_ = conn.WriteMessage(websocket.TextMessage, bytes)
	}
}

func (a *Handler) chatMessages(c *gin.Context) {
	studentID := c.Param("studentId")
	if role(c) == "student" && userID(c) != studentID {
		respondErr(c, http.StatusForbidden, "students can only read their own chat")
		return
	}
	rows, err := a.DB.Query(`
		SELECT id, sender_id, sender_role, message, created_at
		FROM chat_messages
		WHERE student_id = ?
		ORDER BY created_at ASC
		LIMIT 100
	`, studentID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{"messages": []gin.H{}})
			return
		}
		respondErr(c, http.StatusInternalServerError, "could not load messages")
		return
	}
	defer rows.Close()
	var messages []gin.H
	for rows.Next() {
		var id, senderID, senderRole, message, createdAt string
		if rows.Scan(&id, &senderID, &senderRole, &message, &createdAt) == nil {
			messages = append(messages, gin.H{"id": id, "senderId": senderID, "senderRole": senderRole, "message": message, "createdAt": createdAt})
		}
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (a *Handler) wardenStudents(c *gin.Context) {
	rows, err := a.DB.Query(`
		SELECT
			u.id,
			u.name,
			COALESCE(u.college_id, ''),
			u.email,
			u.is_verified,
			COALESCE(r.status, ''),
			COALESCE((
				SELECT fs.id FROM face_samples fs
				WHERE fs.user_id = u.id
				ORDER BY fs.sample_index
				LIMIT 1
			), ''),
			COALESCE((
				SELECT cm.message FROM chat_messages cm
				WHERE cm.student_id = u.id
				ORDER BY cm.created_at DESC
				LIMIT 1
			), ''),
			COALESCE((
				SELECT cm.created_at FROM chat_messages cm
				WHERE cm.student_id = u.id
				ORDER BY cm.created_at DESC
				LIMIT 1
			), '')
		FROM users u
		LEFT JOIN registration_reviews r ON r.user_id = u.id
		WHERE u.role = 'student'
		ORDER BY u.name
	`)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load students")
		return
	}
	defer rows.Close()

	var students []gin.H
	for rows.Next() {
		var id, name, collegeID, email, reviewStatus, faceID, lastMessage, lastMessageAt string
		var verified int
		if rows.Scan(&id, &name, &collegeID, &email, &verified, &reviewStatus, &faceID, &lastMessage, &lastMessageAt) != nil {
			continue
		}
		studentOnline, wardenOnline := a.hub.presence(id)
		faceURL := ""
		if faceID != "" {
			faceURL = "/api/files/face/" + faceID
		}
		students = append(students, gin.H{
			"id":            id,
			"name":          name,
			"collegeId":     collegeID,
			"email":         email,
			"isVerified":    intBool(verified),
			"reviewStatus":  reviewStatus,
			"faceUrl":       faceURL,
			"studentOnline": studentOnline,
			"wardenOnline":  wardenOnline,
			"lastMessage":   lastMessage,
			"lastMessageAt": lastMessageAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"students": students})
}
