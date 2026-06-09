package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func (a *Handler) seedAdmin() error {
	var count int
	if err := a.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := hashPassword(a.Config.AdminPassword)
	if err != nil {
		return err
	}
	now := nowString()
	_, err = a.DB.Exec(`
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, ?)
	`, newID(), a.Config.AdminName, strings.ToLower(a.Config.AdminEmail), hash, now, now)
	return err
}

func (a *Handler) signup(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(20 << 20); err != nil {
		respondErr(c, http.StatusBadRequest, "multipart form is required")
		return
	}
	name := strings.TrimSpace(c.PostForm("name"))
	collegeID := strings.TrimSpace(c.PostForm("collegeId"))
	email := strings.ToLower(strings.TrimSpace(c.PostForm("email")))
	password := c.PostForm("password")
	descriptorRaw := c.PostForm("descriptors")
	if err := required(map[string]string{"name": name, "collegeId": collegeID, "email": email, "password": password, "descriptors": descriptorRaw}); err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	descriptors, err := parseDescriptorSet(descriptorRaw)
	if err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	form := c.Request.MultipartForm
	files := form.File["facePhotos"]
	if len(files) == 0 {
		files = form.File["photos"]
	}
	if len(files) != 3 {
		respondErr(c, http.StatusBadRequest, "exactly 3 face photos are required")
		return
	}
	hash, err := hashPassword(password)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not hash password")
		return
	}

	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()

	id := newID()
	now := nowString()
	if err := mustExec(tx, `
		INSERT INTO users (id, name, college_id, email, password_hash, role, is_verified, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'student', 0, 1, ?, ?)
	`, id, name, collegeID, email, hash, now, now); err != nil {
		respondErr(c, http.StatusConflict, "email or college id is already registered")
		return
	}
	if err := mustExec(tx, `
		INSERT INTO registration_reviews (id, user_id, status, created_at, updated_at)
		VALUES (?, ?, 'pending', ?, ?)
	`, newID(), id, now, now); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not create registration request")
		return
	}
	for i, fileHeader := range files {
		path, err := a.saveFaceUpload(id, i+1, fileHeader)
		if err != nil {
			respondErr(c, http.StatusBadRequest, err.Error())
			return
		}
		if err := mustExec(tx, `
			INSERT INTO face_samples (id, user_id, sample_index, image_path, descriptor_json, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, newID(), id, i+1, path, descriptorJSON(descriptors[i]), now); err != nil {
			respondErr(c, http.StatusInternalServerError, "could not store face sample")
			return
		}
	}
	if err := a.createNotification(tx, "", "warden", "registration", "New student registration", fmt.Sprintf("%s is waiting for approval.", name)); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not notify warden")
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "signup failed")
		return
	}
	token, _ := a.signToken(id, "student")
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": UserDTO{ID: id, Name: name, CollegeID: collegeID, Email: email, Role: "student", IsActive: true, ReviewStatus: "pending"}})
}

func (a *Handler) saveFaceUpload(userID string, index int, fileHeader *multipart.FileHeader) (string, error) {
	src, err := fileHeader.Open()
	if err != nil {
		return "", errors.New("could not read face photo")
	}
	defer src.Close()
	name := fmt.Sprintf("%s_%d.jpg", userID, index)
	path := filepath.Join(a.Config.StorageDir, "faces", name)
	dst, err := os.Create(path)
	if err != nil {
		return "", errors.New("could not save face photo")
	}
	defer dst.Close()
	if _, err := io.Copy(dst, io.LimitReader(src, 5<<20)); err != nil {
		return "", errors.New("could not save face photo")
	}
	return path, nil
}

func (a *Handler) login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !bindJSON(c, &req) {
		return
	}
	var u UserDTO
	var hash string
	var verified, active int
	var review sql.NullString
	err := a.DB.QueryRow(`
		SELECT u.id, u.name, COALESCE(u.college_id, ''), u.email, u.password_hash, u.role,
			u.is_verified, u.is_active, COALESCE(r.status, '')
		FROM users u
		LEFT JOIN registration_reviews r ON r.user_id = u.id
		WHERE u.email = ?
	`, strings.ToLower(strings.TrimSpace(req.Email))).Scan(&u.ID, &u.Name, &u.CollegeID, &u.Email, &hash, &u.Role, &verified, &active, &review.String)
	if err != nil || !checkPassword(hash, req.Password) || active == 0 {
		respondErr(c, http.StatusUnauthorized, "invalid credentials")
		return
	}
	u.IsVerified = intBool(verified)
	u.IsActive = intBool(active)
	u.ReviewStatus = review.String
	token, err := a.signToken(u.ID, u.Role)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not sign token")
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": u})
}

func (a *Handler) me(c *gin.Context) {
	user, err := a.userByID(userID(c))
	if err != nil {
		respondErr(c, http.StatusUnauthorized, "user not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (a *Handler) userByID(id string) (UserDTO, error) {
	var u UserDTO
	var verified, active int
	var review sql.NullString
	err := a.DB.QueryRow(`
		SELECT u.id, u.name, COALESCE(u.college_id, ''), u.email, u.role,
			u.is_verified, u.is_active, COALESCE(r.status, '')
		FROM users u
		LEFT JOIN registration_reviews r ON r.user_id = u.id
		WHERE u.id = ?
	`, id).Scan(&u.ID, &u.Name, &u.CollegeID, &u.Email, &u.Role, &verified, &active, &review.String)
	u.IsVerified = intBool(verified)
	u.IsActive = intBool(active)
	u.ReviewStatus = review.String
	return u, err
}

func (a *Handler) faceFile(c *gin.Context) {
	var path string
	err := a.DB.QueryRow(`SELECT image_path FROM face_samples WHERE id = ?`, c.Param("id")).Scan(&path)
	if err != nil {
		respondErr(c, http.StatusNotFound, "face sample not found")
		return
	}
	c.File(path)
}

func (a *Handler) getProfile(c *gin.Context) {
	row := a.DB.QueryRow(`
		SELECT contact_number, parent_contact, address, gender, room_number, emergency_contact
		FROM profiles WHERE user_id = ?
	`, userID(c))
	var contact, parent, address, gender, room, emergency sql.NullString
	if err := row.Scan(&contact, &parent, &address, &gender, &room, &emergency); err != nil {
		if isNoRows(err) {
			c.JSON(http.StatusOK, gin.H{"profile": gin.H{}})
			return
		}
		respondErr(c, http.StatusInternalServerError, "could not load profile")
		return
	}
	c.JSON(http.StatusOK, gin.H{"profile": gin.H{
		"contactNumber":    scanNullString(contact),
		"parentContact":    scanNullString(parent),
		"address":          scanNullString(address),
		"gender":           scanNullString(gender),
		"roomNumber":       scanNullString(room),
		"emergencyContact": scanNullString(emergency),
	}})
}

func (a *Handler) updateProfile(c *gin.Context) {
	var req struct {
		ContactNumber    string `json:"contactNumber"`
		ParentContact    string `json:"parentContact"`
		Address          string `json:"address"`
		Gender           string `json:"gender"`
		RoomNumber       string `json:"roomNumber"`
		EmergencyContact string `json:"emergencyContact"`
	}
	if !bindJSON(c, &req) {
		return
	}
	_, err := a.DB.Exec(`
		INSERT INTO profiles (user_id, contact_number, parent_contact, address, gender, room_number, emergency_contact, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			contact_number = excluded.contact_number,
			parent_contact = excluded.parent_contact,
			address = excluded.address,
			gender = excluded.gender,
			room_number = excluded.room_number,
			emergency_contact = excluded.emergency_contact,
			updated_at = excluded.updated_at
	`, userID(c), req.ContactNumber, req.ParentContact, req.Address, req.Gender, req.RoomNumber, req.EmergencyContact, nowString())
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not update profile")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

func (a *Handler) listStaff(c *gin.Context) {
	rows, err := a.DB.Query(`
		SELECT id, name, email, role, is_active FROM users
		WHERE role IN ('warden', 'gatekeeper')
		ORDER BY created_at DESC
	`)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not list staff")
		return
	}
	defer rows.Close()
	var users []UserDTO
	for rows.Next() {
		var u UserDTO
		var active int
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &active); err == nil {
			u.IsActive = intBool(active)
			users = append(users, u)
		}
	}
	c.JSON(http.StatusOK, gin.H{"staff": users})
}

func (a *Handler) createStaff(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if !bindJSON(c, &req) {
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Role = strings.TrimSpace(req.Role)
	if req.Role != "warden" && req.Role != "gatekeeper" {
		respondErr(c, http.StatusBadRequest, "role must be warden or gatekeeper")
		return
	}
	if err := required(map[string]string{"name": req.Name, "email": req.Email, "password": req.Password}); err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not hash password")
		return
	}
	id := newID()
	now := nowString()
	_, err = a.DB.Exec(`
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
	`, id, req.Name, req.Email, hash, req.Role, now, now)
	if err != nil {
		respondErr(c, http.StatusConflict, "staff email already exists")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"staff": UserDTO{ID: id, Name: req.Name, Email: req.Email, Role: req.Role, IsVerified: true, IsActive: true}})
}

func (a *Handler) deactivateStaff(c *gin.Context) {
	_, err := a.DB.Exec(`UPDATE users SET is_active = 0, updated_at = ? WHERE id = ? AND role IN ('warden', 'gatekeeper')`, nowString(), c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not deactivate staff")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "staff deactivated"})
}

func (a *Handler) deleteStaff(c *gin.Context) {
	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()

	var roleValue string
	if err := tx.QueryRow(`SELECT role FROM users WHERE id = ?`, c.Param("id")).Scan(&roleValue); err != nil {
		respondErr(c, http.StatusNotFound, "staff user not found")
		return
	}
	if roleValue != "warden" && roleValue != "gatekeeper" {
		respondErr(c, http.StatusBadRequest, "only wardens and gatekeepers can be deleted")
		return
	}
	now := nowString()
	if err := mustExec(tx, `UPDATE registration_reviews SET reviewed_by = NULL, updated_at = ? WHERE reviewed_by = ?`, now, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not clear registration reviews")
		return
	}
	if err := mustExec(tx, `UPDATE outpasses SET reviewed_by = NULL, updated_at = ? WHERE reviewed_by = ?`, now, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not clear outpass reviews")
		return
	}
	if err := mustExec(tx, `UPDATE extension_requests SET reviewed_by = NULL, updated_at = ? WHERE reviewed_by = ?`, now, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not clear extension reviews")
		return
	}
	if err := mustExec(tx, `DELETE FROM users WHERE id = ? AND role IN ('warden', 'gatekeeper')`, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not delete staff")
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "staff delete failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "staff deleted"})
}

func (a *Handler) getSettings(c *gin.Context) {
	settings, err := a.currentSettings()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load settings")
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (a *Handler) updateSettings(c *gin.Context) {
	var req Settings
	if !bindJSON(c, &req) {
		return
	}
	if !validateTime(req.OutStartTime) || !validateTime(req.OutEndTime) || !validateTime(req.ReturnDeadlineTime) {
		respondErr(c, http.StatusBadRequest, "times must use HH:MM format")
		return
	}
	_, err := a.DB.Exec(`
		UPDATE settings SET out_start_time = ?, out_end_time = ?, return_deadline_time = ?,
			hostel_lat = ?, hostel_lng = ?, geo_radius_meters = ?, gps_required_accuracy = ?, updated_at = ?
		WHERE id = 1
	`, req.OutStartTime, req.OutEndTime, req.ReturnDeadlineTime, req.HostelLat, req.HostelLng, req.GeoRadiusMeters, req.GPSRequiredAccuracy, nowString())
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not update settings")
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": req})
}

func descriptorsToJSON(descriptors [][]float64) string {
	bytes, _ := json.Marshal(descriptors)
	return string(bytes)
}
