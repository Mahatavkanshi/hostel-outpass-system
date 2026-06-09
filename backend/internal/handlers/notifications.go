package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (a *Handler) notifications(c *gin.Context) {
	rows, err := a.DB.Query(`
		SELECT id, type, title, body, COALESCE(read_at, ''), created_at
		FROM notifications
		WHERE user_id = ? OR role = ?
		ORDER BY created_at DESC
		LIMIT 50
	`, userID(c), role(c))
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load notifications")
		return
	}
	defer rows.Close()
	var notes []gin.H
	for rows.Next() {
		var id, typ, title, body, readAt, createdAt string
		if rows.Scan(&id, &typ, &title, &body, &readAt, &createdAt) == nil {
			notes = append(notes, gin.H{"id": id, "type": typ, "title": title, "body": body, "readAt": readAt, "createdAt": createdAt})
		}
	}
	c.JSON(http.StatusOK, gin.H{"notifications": notes})
}

func (a *Handler) markNotificationRead(c *gin.Context) {
	_, err := a.DB.Exec(`
		UPDATE notifications SET read_at = ?
		WHERE id = ? AND (user_id = ? OR role = ?)
	`, nowString(), c.Param("id"), userID(c), role(c))
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not update notification")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "notification read"})
}
