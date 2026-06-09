package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type ChatHub struct {
	mu      sync.Mutex
	rooms   map[string]map[string]map[*websocket.Conn]bool
	wardens map[*websocket.Conn]bool
}

func NewChatHub() *ChatHub {
	return &ChatHub{
		rooms:   make(map[string]map[string]map[*websocket.Conn]bool),
		wardens: make(map[*websocket.Conn]bool),
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (a *Handler) handleChatWebSocket(c *gin.Context) {
	token := c.Query("token")
	studentID := c.Query("studentId")
	if token == "" {
		respondErr(c, http.StatusBadRequest, "token is required")
		return
	}
	claims, err := a.parseToken(token)
	if err != nil || (claims.Role != "student" && claims.Role != "warden") {
		respondErr(c, http.StatusUnauthorized, "invalid chat token")
		return
	}
	if claims.Role == "student" && studentID == "" {
		respondErr(c, http.StatusBadRequest, "studentId is required")
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
	if claims.Role == "warden" && studentID == "" {
		a.hub.addWardenInbox(conn)
		defer func() {
			a.hub.removeWardenInbox(conn)
			_ = conn.Close()
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
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
		req.Message = strings.TrimSpace(req.Message)
		if req.Message == "" {
			continue
		}
		msg := gin.H{"id": newID(), "studentId": studentID, "senderId": claims.UserID, "senderRole": claims.Role, "message": req.Message, "createdAt": nowString()}
		_, _ = a.DB.Exec(`
			INSERT INTO chat_messages (id, student_id, sender_id, sender_role, message, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, msg["id"], studentID, claims.UserID, claims.Role, req.Message, msg["createdAt"])
		a.hub.broadcast(studentID, msg)
		a.hub.broadcastWardenInbox(gin.H{"type": "message", "message": msg})
	}
}

func (h *ChatHub) add(studentID, role string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[studentID] == nil {
		h.rooms[studentID] = make(map[string]map[*websocket.Conn]bool)
	}
	if h.rooms[studentID][role] == nil {
		h.rooms[studentID][role] = make(map[*websocket.Conn]bool)
	}
	h.rooms[studentID][role][conn] = true
}

func (h *ChatHub) remove(studentID, role string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[studentID] != nil && h.rooms[studentID][role] != nil {
		delete(h.rooms[studentID][role], conn)
		if len(h.rooms[studentID][role]) == 0 {
			delete(h.rooms[studentID], role)
		}
		if len(h.rooms[studentID]) == 0 {
			delete(h.rooms, studentID)
		}
	}
}

func (h *ChatHub) addWardenInbox(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.wardens[conn] = true
}

func (h *ChatHub) removeWardenInbox(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.wardens, conn)
}

func (h *ChatHub) presence(studentID string) (bool, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.rooms[studentID]
	if room == nil {
		return false, false
	}
	return len(room["student"]) > 0, len(room["warden"]) > 0
}

func (h *ChatHub) broadcast(studentID string, payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	bytes, _ := json.Marshal(payload)
	for _, roleConns := range h.rooms[studentID] {
		for conn := range roleConns {
			_ = conn.WriteMessage(websocket.TextMessage, bytes)
		}
	}
}

func (h *ChatHub) broadcastWardenInbox(payload any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	bytes, _ := json.Marshal(payload)
	for conn := range h.wardens {
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
			messages = append(messages, gin.H{"id": id, "studentId": studentID, "senderId": senderID, "senderRole": senderRole, "message": message, "createdAt": createdAt})
		}
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (a *Handler) wardenChatInbox(c *gin.Context) {
	rows, err := a.DB.Query(`
		SELECT
			u.id,
			u.name,
			COALESCE(u.college_id, ''),
			u.email,
			COALESCE((
				SELECT cm.message FROM chat_messages cm
				WHERE cm.student_id = u.id
				ORDER BY cm.created_at DESC
				LIMIT 1
			), '') AS last_message,
			COALESCE((
				SELECT cm.created_at FROM chat_messages cm
				WHERE cm.student_id = u.id
				ORDER BY cm.created_at DESC
				LIMIT 1
			), '') AS last_message_at,
			(
				SELECT COUNT(*) FROM chat_messages unread
				LEFT JOIN chat_reads cr ON cr.student_id = u.id AND cr.user_id = ?
				WHERE unread.student_id = u.id
					AND unread.sender_role = 'student'
					AND (cr.last_read_at IS NULL OR unread.created_at > cr.last_read_at)
			)
		FROM users u
		WHERE u.role = 'student' AND u.is_active = 1
		ORDER BY
			CASE WHEN last_message_at = '' THEN 1 ELSE 0 END,
			last_message_at DESC,
			u.name ASC
	`, userID(c))
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load chat inbox")
		return
	}
	defer rows.Close()

	var conversations []gin.H
	for rows.Next() {
		var id, name, collegeID, email, lastMessage, lastMessageAt string
		var unread int
		if rows.Scan(&id, &name, &collegeID, &email, &lastMessage, &lastMessageAt, &unread) != nil {
			continue
		}
		studentOnline, wardenOnline := a.hub.presence(id)
		conversations = append(conversations, gin.H{
			"studentId":     id,
			"studentName":   name,
			"collegeId":     collegeID,
			"email":         email,
			"lastMessage":   lastMessage,
			"lastMessageAt": lastMessageAt,
			"unreadCount":   unread,
			"studentOnline": studentOnline,
			"wardenOnline":  wardenOnline,
		})
	}
	c.JSON(http.StatusOK, gin.H{"conversations": conversations})
}

func (a *Handler) markChatRead(c *gin.Context) {
	studentID := c.Param("studentId")
	if role(c) == "student" && userID(c) != studentID {
		respondErr(c, http.StatusForbidden, "students can only mark their own chat")
		return
	}
	_, err := a.DB.Exec(`
		INSERT INTO chat_reads (student_id, user_id, last_read_at)
		VALUES (?, ?, ?)
		ON CONFLICT(student_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at
	`, studentID, userID(c), nowString())
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not mark chat read")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "chat marked read"})
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
