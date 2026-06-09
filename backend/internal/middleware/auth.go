package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"hostel-outpass-system/backend/internal/auth"
)

func Auth(secret string, requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "missing bearer token"})
			return
		}
		claims, err := auth.ParseToken(secret, strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "invalid token"})
			return
		}
		if len(requiredRoles) > 0 {
			allowed := false
			for _, role := range requiredRoles {
				if claims.Role == role {
					allowed = true
					break
				}
			}
			if !allowed {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "insufficient role"})
				return
			}
		}
		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func UserID(c *gin.Context) string {
	value, _ := c.Get("userID")
	id, _ := value.(string)
	return id
}

func Role(c *gin.Context) string {
	value, _ := c.Get("role")
	role, _ := value.(string)
	return role
}
