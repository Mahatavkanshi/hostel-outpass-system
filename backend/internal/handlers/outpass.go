package handlers

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func (a *Handler) requireVerifiedStudent(c *gin.Context) bool {
	u, err := a.userByID(userID(c))
	if err != nil || u.Role != "student" || !u.IsVerified || u.ReviewStatus != "approved" {
		respondErr(c, http.StatusForbidden, "student registration is not approved")
		return false
	}
	return true
}

func (a *Handler) pendingRegistrations(c *gin.Context) {
	rows, err := a.DB.Query(`
		SELECT r.id, r.status, r.remarks, r.created_at, u.id, u.name, u.college_id, u.email
		FROM registration_reviews r
		JOIN users u ON u.id = r.user_id
		WHERE r.status = 'pending'
		ORDER BY r.created_at ASC
	`)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load registrations")
		return
	}
	defer rows.Close()
	var result []gin.H
	for rows.Next() {
		var reviewID, status, createdAt, sid, name, collegeID, email string
		var remarks sql.NullString
		if err := rows.Scan(&reviewID, &status, &remarks, &createdAt, &sid, &name, &collegeID, &email); err != nil {
			continue
		}
		result = append(result, gin.H{
			"id": reviewID, "status": status, "remarks": scanNullString(remarks), "createdAt": createdAt,
			"student":     gin.H{"id": sid, "name": name, "collegeId": collegeID, "email": email},
			"faceSamples": a.faceSampleRefs(sid),
		})
	}
	c.JSON(http.StatusOK, gin.H{"registrations": result})
}

func (a *Handler) faceSampleRefs(studentID string) []gin.H {
	rows, err := a.DB.Query(`SELECT id, sample_index FROM face_samples WHERE user_id = ? ORDER BY sample_index`, studentID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var refs []gin.H
	for rows.Next() {
		var id string
		var index int
		if rows.Scan(&id, &index) == nil {
			refs = append(refs, gin.H{"id": id, "index": index, "url": "/api/files/face/" + id})
		}
	}
	return refs
}

func (a *Handler) reviewRegistration(c *gin.Context) {
	var req struct {
		Status  string `json:"status"`
		Remarks string `json:"remarks"`
	}
	if !bindJSON(c, &req) {
		return
	}
	if req.Status != "approved" && req.Status != "rejected" {
		respondErr(c, http.StatusBadRequest, "status must be approved or rejected")
		return
	}
	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()
	var studentID, studentName string
	err = tx.QueryRow(`SELECT u.id, u.name FROM registration_reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?`, c.Param("id")).Scan(&studentID, &studentName)
	if err != nil {
		respondErr(c, http.StatusNotFound, "registration not found")
		return
	}
	now := nowString()
	if err := mustExec(tx, `
		UPDATE registration_reviews SET status = ?, reviewed_by = ?, reviewed_at = ?, remarks = ?, updated_at = ?
		WHERE id = ?
	`, req.Status, userID(c), now, req.Remarks, now, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not review registration")
		return
	}
	if err := mustExec(tx, `UPDATE users SET is_verified = ?, updated_at = ? WHERE id = ?`, boolInt(req.Status == "approved"), now, studentID); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not update student")
		return
	}
	title := "Registration " + req.Status
	if err := a.createNotification(tx, studentID, "", "registration", title, fmt.Sprintf("Your registration was %s.", req.Status)); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not notify student")
		return
	}
	_ = studentName
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "review failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "registration " + req.Status})
}

func (a *Handler) createOutpass(c *gin.Context) {
	if !a.requireVerifiedStudent(c) {
		return
	}
	var req struct {
		Reason           string `json:"reason"`
		PlaceOfVisit     string `json:"placeOfVisit"`
		DateOfLeaving    string `json:"dateOfLeaving"`
		TimeOut          string `json:"timeOut"`
		TimeIn           string `json:"timeIn"`
		EmergencyContact string `json:"emergencyContact"`
	}
	if !bindJSON(c, &req) {
		return
	}
	if err := required(map[string]string{"reason": req.Reason, "placeOfVisit": req.PlaceOfVisit, "dateOfLeaving": req.DateOfLeaving, "timeOut": req.TimeOut, "timeIn": req.TimeIn, "emergencyContact": req.EmergencyContact}); err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	expected, err := a.validateOutpassTimes(req.DateOfLeaving, req.TimeOut, req.TimeIn)
	if err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
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
		INSERT INTO outpasses (
			id, student_id, reason, place_of_visit, date_of_leaving, time_out, time_in,
			emergency_contact, status, expected_return_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
	`, id, userID(c), req.Reason, req.PlaceOfVisit, req.DateOfLeaving, req.TimeOut, req.TimeIn, req.EmergencyContact, expected.UTC().Format(time.RFC3339Nano), now, now); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not create outpass")
		return
	}
	if err := a.createNotification(tx, "", "warden", "outpass", "New outpass request", "A student submitted an outpass request."); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not notify warden")
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not create outpass")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "outpass request submitted", "id": id})
}

func (a *Handler) pendingOutpasses(c *gin.Context) {
	outpasses, err := a.listOutpasses(`o.status = 'pending'`, nil)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load outpasses")
		return
	}
	c.JSON(http.StatusOK, gin.H{"outpasses": outpasses})
}

func (a *Handler) reviewOutpass(c *gin.Context) {
	var req struct {
		Status  string `json:"status"`
		Remarks string `json:"remarks"`
	}
	if !bindJSON(c, &req) {
		return
	}
	if req.Status != "approved" && req.Status != "rejected" {
		respondErr(c, http.StatusBadRequest, "status must be approved or rejected")
		return
	}
	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()
	var studentID string
	if err := tx.QueryRow(`SELECT student_id FROM outpasses WHERE id = ? AND status = 'pending'`, c.Param("id")).Scan(&studentID); err != nil {
		respondErr(c, http.StatusNotFound, "pending outpass not found")
		return
	}
	now := nowString()
	if err := mustExec(tx, `
		UPDATE outpasses SET status = ?, reviewed_by = ?, reviewed_at = ?, remarks = ?, updated_at = ?
		WHERE id = ?
	`, req.Status, userID(c), now, req.Remarks, now, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not review outpass")
		return
	}
	if err := a.createNotification(tx, studentID, "", "outpass", "Outpass "+req.Status, "Your outpass request was "+req.Status+"."); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not notify student")
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "review failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "outpass " + req.Status})
}

func (a *Handler) studentOutpasses(c *gin.Context) {
	outpasses, err := a.listOutpasses(`o.student_id = ?`, []any{userID(c)})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load outpasses")
		return
	}
	c.JSON(http.StatusOK, gin.H{"outpasses": outpasses})
}

func (a *Handler) gatekeeperExits(c *gin.Context) {
	outpasses, err := a.listOutpasses(`o.status = 'approved'`, nil)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load exits")
		return
	}
	c.JSON(http.StatusOK, gin.H{"outpasses": outpasses})
}

func (a *Handler) checkOutStudent(c *gin.Context) {
	var date, outTime string
	err := a.DB.QueryRow(`SELECT date_of_leaving, time_out FROM outpasses WHERE id = ? AND status = 'approved'`, c.Param("id")).Scan(&date, &outTime)
	if err != nil {
		respondErr(c, http.StatusNotFound, "approved outpass not found")
		return
	}
	outAt, err := parseLocalDateTime(date, outTime, a.Config.Location)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "invalid outpass time")
		return
	}
	if time.Now().In(a.Config.Location).Before(outAt.Add(-15 * time.Minute)) {
		respondErr(c, http.StatusBadRequest, "student cannot check out before approved time")
		return
	}
	_, err = a.DB.Exec(`UPDATE outpasses SET status = 'checked_out', checked_out_at = ?, updated_at = ? WHERE id = ?`, nowString(), nowString(), c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not check out student")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "student checked out"})
}

func (a *Handler) pendingReturns(c *gin.Context) {
	outpasses, err := a.listOutpasses(`o.status IN ('checked_out')`, nil)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load returns")
		return
	}
	c.JSON(http.StatusOK, gin.H{"outpasses": outpasses})
}

func (a *Handler) gatekeeperMarkReturn(c *gin.Context) {
	status, err := a.markReturned(c.Param("id"), "gatekeeper", math.NaN(), math.NaN())
	if err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "student marked returned", "lateStatus": status})
}

func (a *Handler) studentMarkReturn(c *gin.Context) {
	if !a.requireVerifiedStudent(c) {
		return
	}
	var req struct {
		Descriptors [][]float64 `json:"descriptors"`
		Lat         float64     `json:"lat"`
		Lng         float64     `json:"lng"`
		Accuracy    float64     `json:"accuracy"`
	}
	if !bindJSON(c, &req) {
		return
	}
	if len(req.Descriptors) == 0 {
		respondErr(c, http.StatusBadRequest, "at least one live descriptor is required")
		return
	}
	for _, d := range req.Descriptors {
		if len(d) != 128 {
			respondErr(c, http.StatusBadRequest, "each descriptor must have 128 values")
			return
		}
	}
	var studentID string
	err := a.DB.QueryRow(`SELECT student_id FROM outpasses WHERE id = ? AND student_id = ? AND status = 'checked_out'`, c.Param("id"), userID(c)).Scan(&studentID)
	if err != nil {
		respondErr(c, http.StatusNotFound, "active checked-out outpass not found")
		return
	}
	stored, err := a.studentDescriptors(userID(c))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "no enrolled face templates found")
		return
	}
	score := bestFaceDistance(stored, req.Descriptors)
	if math.IsInf(score, 1) || score > a.Config.FaceThreshold {
		respondErr(c, http.StatusUnauthorized, "face not recognized")
		return
	}
	settings, err := a.currentSettings()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "settings unavailable")
		return
	}
	if req.Accuracy > 0 && req.Accuracy > settings.GPSRequiredAccuracy {
		respondErr(c, http.StatusBadRequest, "gps accuracy is too low")
		return
	}
	distance := haversineMeters(req.Lat, req.Lng, settings.HostelLat, settings.HostelLng)
	if distance > settings.GeoRadiusMeters {
		respondErr(c, http.StatusForbidden, "you are outside the hostel boundary")
		return
	}
	status, err := a.markReturned(c.Param("id"), "student", score, distance)
	if err != nil {
		respondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	_, _ = a.DB.Exec(`
		INSERT INTO location_logs (id, outpass_id, student_id, latitude, longitude, accuracy, type, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 'return', ?)
	`, newID(), c.Param("id"), userID(c), req.Lat, req.Lng, req.Accuracy, nowString())
	c.JSON(http.StatusOK, gin.H{"message": "return verified", "lateStatus": status, "faceScore": score, "distanceMeters": distance})
}

func (a *Handler) studentDescriptors(studentID string) ([][]float64, error) {
	rows, err := a.DB.Query(`SELECT descriptor_json FROM face_samples WHERE user_id = ? ORDER BY sample_index`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var descriptors [][]float64
	for rows.Next() {
		var raw string
		if rows.Scan(&raw) == nil {
			d, err := readDescriptor(raw)
			if err == nil {
				descriptors = append(descriptors, d)
			}
		}
	}
	if len(descriptors) == 0 {
		return nil, sql.ErrNoRows
	}
	return descriptors, nil
}

func (a *Handler) markReturned(outpassID, actor string, faceScore, distance float64) (string, error) {
	var expectedRaw string
	var studentID string
	err := a.DB.QueryRow(`SELECT expected_return_at, student_id FROM outpasses WHERE id = ? AND status = 'checked_out'`, outpassID).Scan(&expectedRaw, &studentID)
	if err != nil {
		return "", errorsText("checked-out outpass not found")
	}
	expected, _ := time.Parse(time.RFC3339Nano, expectedRaw)
	lateStatus := "on-time"
	if time.Now().UTC().After(expected) {
		lateStatus = "late"
	}
	tx, err := a.DB.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	if math.IsNaN(faceScore) {
		if err := mustExec(tx, `UPDATE outpasses SET status = 'returned', returned_at = ?, late_status = ?, updated_at = ? WHERE id = ?`, nowString(), lateStatus, nowString(), outpassID); err != nil {
			return "", err
		}
	} else {
		if err := mustExec(tx, `UPDATE outpasses SET status = 'returned', returned_at = ?, late_status = ?, face_score = ?, distance_meters = ?, updated_at = ? WHERE id = ?`, nowString(), lateStatus, faceScore, distance, nowString(), outpassID); err != nil {
			return "", err
		}
	}
	_ = actor
	if err := a.createNotification(tx, studentID, "", "return", "Return recorded", "Your hostel return was recorded as "+lateStatus+"."); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return lateStatus, nil
}

type errorsText string

func (e errorsText) Error() string { return string(e) }

func (a *Handler) requestExtension(c *gin.Context) {
	var req struct {
		RequestedReturnAt string  `json:"requestedReturnAt"`
		Reason            string  `json:"reason"`
		Lat               float64 `json:"lat"`
		Lng               float64 `json:"lng"`
		Accuracy          float64 `json:"accuracy"`
	}
	if !bindJSON(c, &req) {
		return
	}
	if strings.TrimSpace(req.Reason) == "" || strings.TrimSpace(req.RequestedReturnAt) == "" {
		respondErr(c, http.StatusBadRequest, "requestedReturnAt and reason are required")
		return
	}
	if _, err := time.Parse(time.RFC3339, req.RequestedReturnAt); err != nil {
		if _, errNano := time.Parse(time.RFC3339Nano, req.RequestedReturnAt); errNano != nil {
			respondErr(c, http.StatusBadRequest, "requestedReturnAt must be RFC3339")
			return
		}
	}
	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()
	var studentID string
	if err := tx.QueryRow(`SELECT student_id FROM outpasses WHERE id = ? AND student_id = ? AND status = 'checked_out'`, c.Param("id"), userID(c)).Scan(&studentID); err != nil {
		respondErr(c, http.StatusNotFound, "active outpass not found")
		return
	}
	id := newID()
	now := nowString()
	if err := mustExec(tx, `
		INSERT INTO extension_requests (
			id, outpass_id, student_id, requested_return_at, reason, latitude, longitude, accuracy, status, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
	`, id, c.Param("id"), studentID, req.RequestedReturnAt, req.Reason, req.Lat, req.Lng, req.Accuracy, now, now); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not request extension")
		return
	}
	if err := mustExec(tx, `
		INSERT INTO location_logs (id, outpass_id, student_id, latitude, longitude, accuracy, type, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 'extension', ?)
	`, newID(), c.Param("id"), studentID, req.Lat, req.Lng, req.Accuracy, now); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not log location")
		return
	}
	if err := a.createNotification(tx, "", "gatekeeper", "extension", "Late extension requested", "A student requested extra return time."); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not notify gatekeeper")
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not request extension")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "extension requested", "id": id})
}

func (a *Handler) pendingExtensions(c *gin.Context) {
	rows, err := a.DB.Query(`
		SELECT e.id, e.outpass_id, e.requested_return_at, e.reason, e.latitude, e.longitude, e.accuracy, e.created_at,
			u.name, u.college_id, u.email
		FROM extension_requests e
		JOIN users u ON u.id = e.student_id
		WHERE e.status = 'pending'
		ORDER BY e.created_at ASC
	`)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not load extensions")
		return
	}
	defer rows.Close()
	var extensions []gin.H
	for rows.Next() {
		var id, outpassID, requested, reason, createdAt, name, collegeID, email string
		var lat, lng, accuracy sql.NullFloat64
		if rows.Scan(&id, &outpassID, &requested, &reason, &lat, &lng, &accuracy, &createdAt, &name, &collegeID, &email) == nil {
			extensions = append(extensions, gin.H{
				"id": id, "outpassId": outpassID, "requestedReturnAt": requested, "reason": reason, "createdAt": createdAt,
				"lat": scanNullFloat(lat), "lng": scanNullFloat(lng), "accuracy": scanNullFloat(accuracy),
				"student": gin.H{"name": name, "collegeId": collegeID, "email": email},
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"extensions": extensions})
}

func (a *Handler) reviewExtension(c *gin.Context) {
	var req struct {
		Status  string `json:"status"`
		Remarks string `json:"remarks"`
	}
	if !bindJSON(c, &req) {
		return
	}
	if req.Status != "approved" && req.Status != "rejected" {
		respondErr(c, http.StatusBadRequest, "status must be approved or rejected")
		return
	}
	tx, err := a.DB.Begin()
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()
	var outpassID, studentID, requested string
	if err := tx.QueryRow(`SELECT outpass_id, student_id, requested_return_at FROM extension_requests WHERE id = ? AND status = 'pending'`, c.Param("id")).Scan(&outpassID, &studentID, &requested); err != nil {
		respondErr(c, http.StatusNotFound, "pending extension not found")
		return
	}
	now := nowString()
	if err := mustExec(tx, `UPDATE extension_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, remarks = ?, updated_at = ? WHERE id = ?`, req.Status, userID(c), now, req.Remarks, now, c.Param("id")); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not review extension")
		return
	}
	if req.Status == "approved" {
		if err := mustExec(tx, `UPDATE outpasses SET expected_return_at = ?, late_status = 'on-time', late_notified_at = NULL, updated_at = ? WHERE id = ?`, requested, now, outpassID); err != nil {
			respondErr(c, http.StatusInternalServerError, "could not update outpass")
			return
		}
	}
	if err := a.createNotification(tx, studentID, "", "extension", "Extension "+req.Status, "Your late extension request was "+req.Status+"."); err != nil {
		respondErr(c, http.StatusInternalServerError, "could not notify student")
		return
	}
	if err := tx.Commit(); err != nil {
		respondErr(c, http.StatusInternalServerError, "extension review failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "extension " + req.Status})
}

func (a *Handler) listOutpasses(where string, args []any) ([]OutpassDTO, error) {
	query := `
		SELECT o.id, o.student_id, u.name, COALESCE(u.college_id, ''), u.email, o.reason, o.place_of_visit,
			o.date_of_leaving, o.time_out, o.time_in, o.emergency_contact, o.status, o.late_status,
			COALESCE(o.expected_return_at, ''), COALESCE(o.checked_out_at, ''), COALESCE(o.returned_at, ''),
			COALESCE(o.remarks, ''), o.face_score, o.distance_meters, o.created_at
		FROM outpasses o
		JOIN users u ON u.id = o.student_id
	`
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY o.created_at DESC"
	rows, err := a.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var outpasses []OutpassDTO
	for rows.Next() {
		var o OutpassDTO
		var face, dist sql.NullFloat64
		if err := rows.Scan(&o.ID, &o.StudentID, &o.StudentName, &o.CollegeID, &o.Email, &o.Reason, &o.PlaceOfVisit, &o.DateOfLeaving, &o.TimeOut, &o.TimeIn, &o.EmergencyContact, &o.Status, &o.LateStatus, &o.ExpectedReturnAt, &o.CheckedOutAt, &o.ReturnedAt, &o.Remarks, &face, &dist, &o.CreatedAt); err == nil {
			o.FaceScore = scanNullFloat(face)
			o.DistanceMeters = scanNullFloat(dist)
			outpasses = append(outpasses, o)
		}
	}
	return outpasses, rows.Err()
}

func (a *Handler) wardenDashboard(c *gin.Context) {
	today := time.Now().In(a.Config.Location).Format("2006-01-02")
	todayOutpasses, _ := a.listOutpasses(`o.date_of_leaving = ?`, []any{today})
	active, _ := a.listOutpasses(`o.status = 'checked_out'`, nil)
	late, _ := a.listOutpasses(`o.late_status = 'late' AND o.status = 'checked_out'`, nil)
	count := func(query string, args ...any) int {
		var value int
		_ = a.DB.QueryRow(query, args...).Scan(&value)
		return value
	}
	statusCounts := gin.H{}
	rowsStatus, _ := a.DB.Query(`SELECT status, COUNT(*) FROM outpasses GROUP BY status`)
	if rowsStatus != nil {
		defer rowsStatus.Close()
		for rowsStatus.Next() {
			var status string
			var total int
			if rowsStatus.Scan(&status, &total) == nil {
				statusCounts[status] = total
			}
		}
	}
	rows, _ := a.DB.Query(`
		SELECT e.id, e.status, e.requested_return_at, e.reason, e.created_at, u.name, u.college_id
		FROM extension_requests e JOIN users u ON u.id = e.student_id
		ORDER BY e.created_at DESC LIMIT 20
	`)
	var exts []gin.H
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, status, requested, reason, createdAt, name, collegeID string
			if rows.Scan(&id, &status, &requested, &reason, &createdAt, &name, &collegeID) == nil {
				exts = append(exts, gin.H{"id": id, "status": status, "requestedReturnAt": requested, "reason": reason, "createdAt": createdAt, "studentName": name, "collegeId": collegeID})
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"date":           today,
		"today":          todayOutpasses,
		"active":         active,
		"late":           late,
		"extensions":     exts,
		"statusCounts":   statusCounts,
		"totalStudents":  count(`SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = 1`),
		"pendingReviews": count(`SELECT COUNT(*) FROM registration_reviews WHERE status = 'pending'`),
		"pendingOutpass": count(`SELECT COUNT(*) FROM outpasses WHERE status = 'pending'`),
		"currentlyOut":   len(active),
		"lateStudents":   len(late),
		"todayRequests":  len(todayOutpasses),
	})
}
