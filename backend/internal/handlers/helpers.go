package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"hostel-outpass-system/backend/internal/auth"
	"hostel-outpass-system/backend/internal/database"
	"hostel-outpass-system/backend/internal/middleware"
	"hostel-outpass-system/backend/internal/models"
)

type UserDTO = models.UserDTO
type Settings = models.Settings
type OutpassDTO = models.OutpassDTO

var (
	newID         = auth.NewID
	hashPassword  = auth.HashPassword
	checkPassword = auth.CheckPassword
	nowString     = database.NowString
	isNoRows      = database.IsNoRows
	nullString    = database.NullString
	mustExec      = database.MustExec
	userID        = middleware.UserID
	role          = middleware.Role
)

var timeRE = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func intBool(v int) bool {
	return v != 0
}

func respondErr(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"message": message})
}

func bindJSON(c *gin.Context, dest any) bool {
	if err := c.ShouldBindJSON(dest); err != nil {
		respondErr(c, http.StatusBadRequest, "invalid request body")
		return false
	}
	return true
}

func required(values map[string]string) error {
	for key, value := range values {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s is required", key)
		}
	}
	return nil
}

func validateTime(value string) bool {
	return timeRE.MatchString(value)
}

func parseLocalDateTime(date, hhmm string, loc *time.Location) (time.Time, error) {
	if !validateTime(hhmm) {
		return time.Time{}, errors.New("invalid time")
	}
	parts := strings.Split(hhmm, ":")
	hour, _ := strconv.Atoi(parts[0])
	minute, _ := strconv.Atoi(parts[1])
	day, err := time.ParseInLocation("2006-01-02", date, loc)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(day.Year(), day.Month(), day.Day(), hour, minute, 0, 0, loc), nil
}

func parseDescriptorSet(raw string) ([][]float64, error) {
	var descriptors [][]float64
	if err := json.Unmarshal([]byte(raw), &descriptors); err != nil {
		return nil, err
	}
	if len(descriptors) != 3 {
		return nil, errors.New("exactly 3 face descriptors are required")
	}
	for _, descriptor := range descriptors {
		if len(descriptor) != 128 {
			return nil, errors.New("each descriptor must have 128 values")
		}
	}
	return descriptors, nil
}

func descriptorJSON(descriptor []float64) string {
	bytes, _ := json.Marshal(descriptor)
	return string(bytes)
}

func readDescriptor(raw string) ([]float64, error) {
	var descriptor []float64
	if err := json.Unmarshal([]byte(raw), &descriptor); err != nil {
		return nil, err
	}
	if len(descriptor) != 128 {
		return nil, errors.New("descriptor must have 128 values")
	}
	return descriptor, nil
}

func bestFaceDistance(stored [][]float64, live [][]float64) float64 {
	best := math.Inf(1)
	for _, s := range stored {
		for _, l := range live {
			if len(s) != len(l) {
				continue
			}
			sum := 0.0
			for i := range s {
				d := s[i] - l[i]
				sum += d * d
			}
			if d := math.Sqrt(sum); d < best {
				best = d
			}
		}
	}
	return best
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000.0
	toRad := func(v float64) float64 { return v * math.Pi / 180 }
	phi1, phi2 := toRad(lat1), toRad(lat2)
	dphi := toRad(lat2 - lat1)
	dlambda := toRad(lon2 - lon1)
	a := math.Sin(dphi/2)*math.Sin(dphi/2) + math.Cos(phi1)*math.Cos(phi2)*math.Sin(dlambda/2)*math.Sin(dlambda/2)
	return earthRadius * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func scanNullString(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}

func scanNullFloat(nf sql.NullFloat64) *float64 {
	if !nf.Valid {
		return nil
	}
	value := nf.Float64
	return &value
}

func (a *Handler) currentSettings() (Settings, error) {
	var s Settings
	err := a.DB.QueryRow(`
		SELECT out_start_time, out_end_time, return_deadline_time,
			hostel_lat, hostel_lng, geo_radius_meters, gps_required_accuracy
		FROM settings WHERE id = 1
	`).Scan(&s.OutStartTime, &s.OutEndTime, &s.ReturnDeadlineTime, &s.HostelLat, &s.HostelLng, &s.GeoRadiusMeters, &s.GPSRequiredAccuracy)
	return s, err
}

func (a *Handler) signToken(userID, role string) (string, error) {
	return auth.SignToken(a.Config.JWTSecret, userID, role)
}

func (a *Handler) parseToken(token string) (*auth.Claims, error) {
	return auth.ParseToken(a.Config.JWTSecret, token)
}

func (a *Handler) validateOutpassTimes(date, outTime, inTime string) (time.Time, error) {
	if !validateTime(outTime) || !validateTime(inTime) {
		return time.Time{}, errors.New("time must use HH:MM format")
	}
	settings, err := a.currentSettings()
	if err != nil {
		return time.Time{}, err
	}
	outAt, err := parseLocalDateTime(date, outTime, a.Config.Location)
	if err != nil {
		return time.Time{}, errors.New("dateOfLeaving must use YYYY-MM-DD")
	}
	inAt, err := parseLocalDateTime(date, inTime, a.Config.Location)
	if err != nil {
		return time.Time{}, err
	}
	startAt, _ := parseLocalDateTime(date, settings.OutStartTime, a.Config.Location)
	endAt, _ := parseLocalDateTime(date, settings.OutEndTime, a.Config.Location)
	deadlineAt, _ := parseLocalDateTime(date, settings.ReturnDeadlineTime, a.Config.Location)
	if outAt.Before(startAt) || outAt.After(endAt) {
		return time.Time{}, fmt.Errorf("leaving time must be between %s and %s", settings.OutStartTime, settings.OutEndTime)
	}
	if inAt.Before(outAt) {
		return time.Time{}, errors.New("return time must be after leaving time")
	}
	if inAt.After(deadlineAt) {
		return time.Time{}, fmt.Errorf("return time must be at or before %s", settings.ReturnDeadlineTime)
	}
	return inAt, nil
}

func (a *Handler) createNotification(tx *sql.Tx, userID, roleValue, typ, title, body string) error {
	_, err := tx.Exec(`
		INSERT INTO notifications (id, user_id, role, type, title, body, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, newID(), nullString(userID), nullString(roleValue), typ, title, body, nowString())
	return err
}
