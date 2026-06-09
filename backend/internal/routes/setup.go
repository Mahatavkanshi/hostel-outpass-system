package routes

import (
	"database/sql"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"hostel-outpass-system/backend/internal/config"
	"hostel-outpass-system/backend/internal/handlers"
	"hostel-outpass-system/backend/internal/middleware"
)

func SetupRouter(cfg config.Config, db *sql.DB, h *handlers.Handler) *gin.Engine {
	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		AllowOriginWithContextFunc: func(c *gin.Context, origin string) bool {
			return allowOrigin(c, origin, cfg.CORSAllowedOrigins)
		},
	}))

	auth := func(roles ...string) gin.HandlerFunc {
		return middleware.Auth(cfg.JWTSecret, roles...)
	}

	r.GET("/", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"message": "Hostel outpass API is running"}) })
	r.GET("/ws", h.HandleChatWebSocket)

	api := r.Group("/api")
	api.POST("/auth/signup", h.Signup)
	api.POST("/auth/login", h.Login)
	api.GET("/auth/me", auth(), h.Me)
	api.GET("/files/face/:id", auth("admin", "warden"), h.FaceFile)

	api.GET("/profile", auth(), h.GetProfile)
	api.PUT("/profile", auth("student"), h.UpdateProfile)
	api.GET("/notifications", auth(), h.Notifications)
	api.PATCH("/notifications/:id/read", auth(), h.MarkNotificationRead)

	admin := api.Group("/admin", auth("admin"))
	admin.GET("/staff", h.ListStaff)
	admin.POST("/staff", h.CreateStaff)
	admin.PATCH("/staff/:id/deactivate", h.DeactivateStaff)
	admin.DELETE("/staff/:id", h.DeleteStaff)
	admin.GET("/settings", h.GetSettings)
	admin.PUT("/settings", h.UpdateSettings)

	warden := api.Group("/warden", auth("warden"))
	warden.GET("/registrations", h.PendingRegistrations)
	warden.PUT("/registrations/:id", h.ReviewRegistration)
	warden.GET("/outpasses/pending", h.PendingOutpasses)
	warden.PUT("/outpasses/:id/review", h.ReviewOutpass)
	warden.GET("/dashboard", h.WardenDashboard)
	warden.GET("/students", h.WardenStudents)

	student := api.Group("/student", auth("student"))
	student.POST("/outpasses", h.CreateOutpass)
	student.GET("/outpasses", h.StudentOutpasses)
	student.POST("/outpasses/:id/return", h.StudentMarkReturn)
	student.POST("/outpasses/:id/extension", h.RequestExtension)
	student.GET("/chat/:studentId/messages", h.ChatMessages)

	gatekeeper := api.Group("/gatekeeper", auth("gatekeeper"))
	gatekeeper.GET("/exits", h.GatekeeperExits)
	gatekeeper.PUT("/outpasses/:id/checkout", h.CheckOutStudent)
	gatekeeper.GET("/returns", h.PendingReturns)
	gatekeeper.PUT("/outpasses/:id/return", h.GatekeeperMarkReturn)
	gatekeeper.GET("/extensions", h.PendingExtensions)
	gatekeeper.PUT("/extensions/:id", h.ReviewExtension)

	chat := api.Group("/chat", auth("student", "warden"))
	chat.GET("/inbox", auth("warden"), h.WardenChatInbox)
	chat.GET("/:studentId/messages", h.ChatMessages)
	chat.PATCH("/:studentId/read", h.MarkChatRead)

	return r
}

func allowOrigin(c *gin.Context, origin string, allowedOrigins []string) bool {
	for _, allowed := range allowedOrigins {
		if strings.EqualFold(origin, allowed) {
			return true
		}
	}

	originURL, err := url.Parse(origin)
	if err != nil || originURL.Host == "" {
		return false
	}

	for _, host := range []string{
		c.Request.Host,
		c.GetHeader("X-Forwarded-Host"),
		c.GetHeader("X-Original-Host"),
	} {
		if strings.EqualFold(originURL.Host, host) {
			return true
		}
	}

	return false
}
