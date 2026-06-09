package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"hostel-outpass-system/backend/internal/config"
	"hostel-outpass-system/backend/internal/database"
	"hostel-outpass-system/backend/internal/middleware"
)

func testApp(t *testing.T) *Handler {
	t.Helper()
	dir := t.TempDir()
	cfg := config.Config{
		Port:               "0",
		DBPath:             filepath.Join(dir, "test.db"),
		StorageDir:         filepath.Join(dir, "storage"),
		JWTSecret:          "test-secret",
		AdminName:          "Admin",
		AdminEmail:         "admin@test.local",
		AdminPassword:      "admin123",
		FaceThreshold:      0.58,
		DefaultHostelLat:   10,
		DefaultHostelLng:   20,
		DefaultGeoRadius:   100,
		DefaultGPSAccuracy: 300,
		Location:           time.UTC,
	}
	db, err := database.Init(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.CreateDefaultAdmin(db, cfg); err != nil {
		t.Fatal(err)
	}
	app := NewHandler(cfg, db)
	auth := func(roles ...string) gin.HandlerFunc { return middleware.Auth(cfg.JWTSecret, roles...) }
	r := gin.New()
	r.POST("/api/auth/signup", app.signup)
	r.POST("/api/auth/login", app.login)
	r.GET("/api/admin/staff", auth("admin"), app.listStaff)
	r.POST("/api/admin/staff", auth("admin"), app.createStaff)
	r.DELETE("/api/admin/staff/:id", auth("admin"), app.deleteStaff)
	r.GET("/api/warden/registrations", auth("warden"), app.pendingRegistrations)
	r.PUT("/api/warden/registrations/:id", auth("warden"), app.reviewRegistration)
	r.GET("/api/warden/dashboard", auth("warden"), app.wardenDashboard)
	r.POST("/api/student/outpasses", auth("student"), app.createOutpass)
	r.GET("/api/warden/outpasses/pending", auth("warden"), app.pendingOutpasses)
	r.PUT("/api/warden/outpasses/:id/review", auth("warden"), app.reviewOutpass)
	r.PUT("/api/gatekeeper/outpasses/:id/checkout", auth("gatekeeper"), app.checkOutStudent)
	r.POST("/api/student/outpasses/:id/return", auth("student"), app.studentMarkReturn)
	r.GET("/api/chat/inbox", auth("warden"), app.wardenChatInbox)
	r.GET("/api/chat/:studentId/messages", auth("student", "warden"), app.chatMessages)
	r.PATCH("/api/chat/:studentId/read", auth("student", "warden"), app.markChatRead)
	app.Router = r
	t.Cleanup(func() { _ = db.Close() })
	return app
}

func perform(app *Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res := httptest.NewRecorder()
	app.Router.ServeHTTP(res, req)
	return res
}

func loginAs(t *testing.T, app *Handler, email, password string) (string, UserDTO) {
	t.Helper()
	res := perform(app, http.MethodPost, "/api/auth/login", "", map[string]string{"email": email, "password": password})
	if res.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", res.Code, res.Body.String())
	}
	var payload struct {
		Token string  `json:"token"`
		User  UserDTO `json:"user"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &payload)
	return payload.Token, payload.User
}

func descriptor(offset float64) []float64 {
	values := make([]float64, 128)
	for i := range values {
		values[i] = offset
	}
	return values
}

func signupStudent(t *testing.T, app *Handler) (string, string) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("name", "Student One")
	_ = writer.WriteField("collegeId", "C001")
	_ = writer.WriteField("email", "student@test.local")
	_ = writer.WriteField("password", "student123")
	raw, _ := json.Marshal([][]float64{descriptor(0.1), descriptor(0.2), descriptor(0.3)})
	_ = writer.WriteField("descriptors", string(raw))
	for i := 0; i < 3; i++ {
		part, _ := writer.CreateFormFile("facePhotos", fmt.Sprintf("face%d.jpg", i))
		_, _ = part.Write([]byte("fake image"))
	}
	_ = writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res := httptest.NewRecorder()
	app.Router.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("signup failed: %d %s", res.Code, res.Body.String())
	}
	var payload struct {
		Token string  `json:"token"`
		User  UserDTO `json:"user"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &payload)
	return payload.Token, payload.User.ID
}

func approveStudent(t *testing.T, app *Handler, adminToken string) string {
	t.Helper()
	_, _ = app.DB.Exec(`
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, created_at, updated_at)
		VALUES (?, 'Warden', 'warden@test.local', ?, 'warden', 1, 1, ?, ?)
	`, "warden1", mustHash("warden123"), nowString(), nowString())
	wardenToken, _ := loginAs(t, app, "warden@test.local", "warden123")
	res := perform(app, http.MethodGet, "/api/warden/registrations", wardenToken, nil)
	var payload struct {
		Registrations []struct {
			ID string `json:"id"`
		} `json:"registrations"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &payload)
	if len(payload.Registrations) != 1 {
		t.Fatalf("expected one registration: %s", res.Body.String())
	}
	res = perform(app, http.MethodPut, "/api/warden/registrations/"+payload.Registrations[0].ID, wardenToken, map[string]string{"status": "approved"})
	if res.Code != http.StatusOK {
		t.Fatalf("approval failed: %d %s", res.Code, res.Body.String())
	}
	_ = adminToken
	return wardenToken
}

func mustHash(password string) string {
	hash, err := hashPassword(password)
	if err != nil {
		panic(err)
	}
	return hash
}

func TestDescriptorValidation(t *testing.T) {
	raw, _ := json.Marshal([][]float64{descriptor(0), descriptor(0)})
	if _, err := parseDescriptorSet(string(raw)); err == nil {
		t.Fatal("expected descriptor count validation error")
	}
	raw, _ = json.Marshal([][]float64{descriptor(0), descriptor(1), []float64{1, 2}})
	if _, err := parseDescriptorSet(string(raw)); err == nil {
		t.Fatal("expected descriptor length validation error")
	}
}

func TestUnverifiedStudentCannotCreateOutpass(t *testing.T) {
	app := testApp(t)
	token, _ := signupStudent(t, app)
	res := perform(app, http.MethodPost, "/api/student/outpasses", token, map[string]string{
		"reason": "Visit", "placeOfVisit": "City", "dateOfLeaving": "2099-01-01", "timeOut": "10:00", "timeIn": "12:00", "emergencyContact": "123",
	})
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden, got %d: %s", res.Code, res.Body.String())
	}
}

func TestAdminCanCreateListAndHardDeleteStaff(t *testing.T) {
	app := testApp(t)
	adminToken, admin := loginAs(t, app, "admin@test.local", "admin123")
	_, studentID := signupStudent(t, app)

	res := perform(app, http.MethodPost, "/api/admin/staff", adminToken, map[string]string{
		"name": "Warden Two", "email": "warden2@test.local", "password": "warden123", "role": "warden",
	})
	if res.Code != http.StatusCreated {
		t.Fatalf("create staff failed: %d %s", res.Code, res.Body.String())
	}
	var created struct {
		Staff UserDTO `json:"staff"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &created)
	if created.Staff.ID == "" || created.Staff.Role != "warden" {
		t.Fatalf("unexpected staff payload: %s", res.Body.String())
	}

	list := perform(app, http.MethodGet, "/api/admin/staff", adminToken, nil)
	if list.Code != http.StatusOK {
		t.Fatalf("list staff failed: %d %s", list.Code, list.Body.String())
	}

	if bad := perform(app, http.MethodDelete, "/api/admin/staff/"+admin.ID, adminToken, nil); bad.Code != http.StatusBadRequest {
		t.Fatalf("expected admin delete to be blocked, got %d: %s", bad.Code, bad.Body.String())
	}
	if bad := perform(app, http.MethodDelete, "/api/admin/staff/"+studentID, adminToken, nil); bad.Code != http.StatusBadRequest {
		t.Fatalf("expected student delete to be blocked, got %d: %s", bad.Code, bad.Body.String())
	}

	res = perform(app, http.MethodDelete, "/api/admin/staff/"+created.Staff.ID, adminToken, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("delete staff failed: %d %s", res.Code, res.Body.String())
	}
	res = perform(app, http.MethodPost, "/api/auth/login", "", map[string]string{"email": "warden2@test.local", "password": "warden123"})
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("deleted staff should not login, got %d: %s", res.Code, res.Body.String())
	}
}

func TestWardenDashboardReturnsAggregateStats(t *testing.T) {
	app := testApp(t)
	adminToken, _ := loginAs(t, app, "admin@test.local", "admin123")
	studentToken, _ := signupStudent(t, app)
	wardenToken := approveStudent(t, app, adminToken)

	tomorrow := time.Now().UTC().Add(24 * time.Hour).Format("2006-01-02")
	res := perform(app, http.MethodPost, "/api/student/outpasses", studentToken, map[string]string{
		"reason": "Library", "placeOfVisit": "Central Library", "dateOfLeaving": tomorrow, "timeOut": "10:00", "timeIn": "12:00", "emergencyContact": "999",
	})
	if res.Code != http.StatusCreated {
		t.Fatalf("outpass create failed: %d %s", res.Code, res.Body.String())
	}
	res = perform(app, http.MethodGet, "/api/warden/dashboard", wardenToken, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("dashboard failed: %d %s", res.Code, res.Body.String())
	}
	var payload struct {
		TotalStudents  int            `json:"totalStudents"`
		PendingOutpass int            `json:"pendingOutpass"`
		StatusCounts   map[string]int `json:"statusCounts"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &payload)
	if payload.TotalStudents != 1 || payload.PendingOutpass != 1 || payload.StatusCounts["pending"] != 1 {
		t.Fatalf("unexpected aggregate payload: %s", res.Body.String())
	}
}

func TestChatMessagesPersistAndWardenInboxTracksUnread(t *testing.T) {
	app := testApp(t)
	adminToken, _ := loginAs(t, app, "admin@test.local", "admin123")
	_, studentID := signupStudent(t, app)
	wardenToken := approveStudent(t, app, adminToken)
	_, _ = app.DB.Exec(`
		INSERT INTO chat_messages (id, student_id, sender_id, sender_role, message, created_at)
		VALUES (?, ?, ?, 'student', 'Hello warden', ?)
	`, "chat1", studentID, studentID, nowString())

	res := perform(app, http.MethodGet, "/api/chat/inbox", wardenToken, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("inbox failed: %d %s", res.Code, res.Body.String())
	}
	var inbox struct {
		Conversations []struct {
			StudentID   string `json:"studentId"`
			LastMessage string `json:"lastMessage"`
			UnreadCount int    `json:"unreadCount"`
		} `json:"conversations"`
	}
	_ = json.Unmarshal(res.Body.Bytes(), &inbox)
	if len(inbox.Conversations) != 1 || inbox.Conversations[0].StudentID != studentID || inbox.Conversations[0].UnreadCount != 1 {
		t.Fatalf("unexpected inbox payload: %s", res.Body.String())
	}

	res = perform(app, http.MethodGet, "/api/chat/"+studentID+"/messages", wardenToken, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("messages failed: %d %s", res.Code, res.Body.String())
	}
	res = perform(app, http.MethodPatch, "/api/chat/"+studentID+"/read", wardenToken, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("mark read failed: %d %s", res.Code, res.Body.String())
	}
	res = perform(app, http.MethodGet, "/api/chat/inbox", wardenToken, nil)
	_ = json.Unmarshal(res.Body.Bytes(), &inbox)
	if inbox.Conversations[0].UnreadCount != 0 {
		t.Fatalf("expected unread to be cleared: %s", res.Body.String())
	}
}

func TestOutpassLifecycleLateSweepAndReturn(t *testing.T) {
	app := testApp(t)
	adminToken, _ := loginAs(t, app, "admin@test.local", "admin123")
	studentToken, studentID := signupStudent(t, app)
	wardenToken := approveStudent(t, app, adminToken)
	_, _ = app.DB.Exec(`
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, created_at, updated_at)
		VALUES (?, 'Gatekeeper', 'gate@test.local', ?, 'gatekeeper', 1, 1, ?, ?)
	`, "gate1", mustHash("gate123"), nowString(), nowString())
	gateToken, _ := loginAs(t, app, "gate@test.local", "gate123")

	tomorrow := time.Now().UTC().Add(24 * time.Hour).Format("2006-01-02")
	res := perform(app, http.MethodPost, "/api/student/outpasses", studentToken, map[string]string{
		"reason": "Library", "placeOfVisit": "Central Library", "dateOfLeaving": tomorrow, "timeOut": "10:00", "timeIn": "12:00", "emergencyContact": "999",
	})
	if res.Code != http.StatusCreated {
		t.Fatalf("outpass create failed: %d %s", res.Code, res.Body.String())
	}
	pending := perform(app, http.MethodGet, "/api/warden/outpasses/pending", wardenToken, nil)
	var list struct {
		Outpasses []OutpassDTO `json:"outpasses"`
	}
	_ = json.Unmarshal(pending.Body.Bytes(), &list)
	if len(list.Outpasses) != 1 {
		t.Fatalf("expected pending outpass: %s", pending.Body.String())
	}
	outpassID := list.Outpasses[0].ID
	res = perform(app, http.MethodPut, "/api/warden/outpasses/"+outpassID+"/review", wardenToken, map[string]string{"status": "approved"})
	if res.Code != http.StatusOK {
		t.Fatalf("outpass approve failed: %d %s", res.Code, res.Body.String())
	}
	_, _ = app.DB.Exec(`UPDATE outpasses SET date_of_leaving = ?, time_out = '00:01' WHERE id = ?`, time.Now().UTC().Format("2006-01-02"), outpassID)
	res = perform(app, http.MethodPut, "/api/gatekeeper/outpasses/"+outpassID+"/checkout", gateToken, nil)
	if res.Code != http.StatusOK {
		t.Fatalf("checkout failed: %d %s", res.Code, res.Body.String())
	}
	_, _ = app.DB.Exec(`UPDATE outpasses SET expected_return_at = ? WHERE id = ?`, time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano), outpassID)
	if err := app.RunLateSweep(time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	var lateStatus string
	_ = app.DB.QueryRow(`SELECT late_status FROM outpasses WHERE id = ?`, outpassID).Scan(&lateStatus)
	if lateStatus != "late" {
		t.Fatalf("expected late, got %s", lateStatus)
	}
	res = perform(app, http.MethodPost, "/api/student/outpasses/"+outpassID+"/return", studentToken, map[string]any{
		"descriptors": [][]float64{descriptor(0.1)}, "lat": 10, "lng": 20, "accuracy": 10,
	})
	if res.Code != http.StatusOK {
		t.Fatalf("student return failed: %d %s", res.Code, res.Body.String())
	}
	var count int
	_ = app.DB.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'late'`, studentID).Scan(&count)
	if count != 1 {
		t.Fatalf("expected one late notification, got %d", count)
	}
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
