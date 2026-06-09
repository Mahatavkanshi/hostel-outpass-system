package handlers

import (
	"database/sql"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"hostel-outpass-system/backend/internal/config"
)

type Handler struct {
	Config config.Config
	DB     *sql.DB
	Router *gin.Engine
	hub    *ChatHub
}

func NewHandler(cfg config.Config, db *sql.DB) *Handler {
	_ = os.MkdirAll(filepath.Join(cfg.StorageDir, "faces"), 0755)
	return &Handler{Config: cfg, DB: db, hub: NewChatHub()}
}

func (h *Handler) Signup(c *gin.Context)               { h.signup(c) }
func (h *Handler) Login(c *gin.Context)                { h.login(c) }
func (h *Handler) Me(c *gin.Context)                   { h.me(c) }
func (h *Handler) FaceFile(c *gin.Context)             { h.faceFile(c) }
func (h *Handler) GetProfile(c *gin.Context)           { h.getProfile(c) }
func (h *Handler) UpdateProfile(c *gin.Context)        { h.updateProfile(c) }
func (h *Handler) ListStaff(c *gin.Context)            { h.listStaff(c) }
func (h *Handler) CreateStaff(c *gin.Context)          { h.createStaff(c) }
func (h *Handler) DeactivateStaff(c *gin.Context)      { h.deactivateStaff(c) }
func (h *Handler) DeleteStaff(c *gin.Context)          { h.deleteStaff(c) }
func (h *Handler) GetSettings(c *gin.Context)          { h.getSettings(c) }
func (h *Handler) UpdateSettings(c *gin.Context)       { h.updateSettings(c) }
func (h *Handler) PendingRegistrations(c *gin.Context) { h.pendingRegistrations(c) }
func (h *Handler) ReviewRegistration(c *gin.Context)   { h.reviewRegistration(c) }
func (h *Handler) PendingOutpasses(c *gin.Context)     { h.pendingOutpasses(c) }
func (h *Handler) ReviewOutpass(c *gin.Context)        { h.reviewOutpass(c) }
func (h *Handler) WardenDashboard(c *gin.Context)      { h.wardenDashboard(c) }
func (h *Handler) CreateOutpass(c *gin.Context)        { h.createOutpass(c) }
func (h *Handler) StudentOutpasses(c *gin.Context)     { h.studentOutpasses(c) }
func (h *Handler) StudentMarkReturn(c *gin.Context)    { h.studentMarkReturn(c) }
func (h *Handler) RequestExtension(c *gin.Context)     { h.requestExtension(c) }
func (h *Handler) GatekeeperExits(c *gin.Context)      { h.gatekeeperExits(c) }
func (h *Handler) CheckOutStudent(c *gin.Context)      { h.checkOutStudent(c) }
func (h *Handler) PendingReturns(c *gin.Context)       { h.pendingReturns(c) }
func (h *Handler) GatekeeperMarkReturn(c *gin.Context) { h.gatekeeperMarkReturn(c) }
func (h *Handler) PendingExtensions(c *gin.Context)    { h.pendingExtensions(c) }
func (h *Handler) ReviewExtension(c *gin.Context)      { h.reviewExtension(c) }
func (h *Handler) Notifications(c *gin.Context)        { h.notifications(c) }
func (h *Handler) MarkNotificationRead(c *gin.Context) { h.markNotificationRead(c) }
func (h *Handler) ChatMessages(c *gin.Context)         { h.chatMessages(c) }
func (h *Handler) WardenChatInbox(c *gin.Context)      { h.wardenChatInbox(c) }
func (h *Handler) MarkChatRead(c *gin.Context)         { h.markChatRead(c) }
func (h *Handler) HandleChatWebSocket(c *gin.Context)  { h.handleChatWebSocket(c) }
func (h *Handler) WardenStudents(c *gin.Context)       { h.wardenStudents(c) }
