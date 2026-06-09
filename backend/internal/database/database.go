package database

import (
	"database/sql"
	"errors"
	"fmt"
	"hostel-outpass-system/backend/internal/auth"
	"hostel-outpass-system/backend/internal/config"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const schemaSQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	college_id TEXT,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK(role IN ('admin','student','warden','gatekeeper')),
	is_verified INTEGER NOT NULL DEFAULT 0,
	is_active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_college_id
ON users(college_id)
WHERE college_id IS NOT NULL AND college_id != '';

CREATE TABLE IF NOT EXISTS profiles (
	user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	contact_number TEXT,
	parent_contact TEXT,
	address TEXT,
	gender TEXT,
	room_number TEXT,
	emergency_contact TEXT,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS face_samples (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	sample_index INTEGER NOT NULL CHECK(sample_index BETWEEN 1 AND 3),
	image_path TEXT NOT NULL,
	descriptor_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	UNIQUE(user_id, sample_index)
);

CREATE TABLE IF NOT EXISTS registration_reviews (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
	reviewed_by TEXT REFERENCES users(id),
	reviewed_at TEXT,
	remarks TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outpasses (
	id TEXT PRIMARY KEY,
	student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	reason TEXT NOT NULL,
	place_of_visit TEXT NOT NULL,
	date_of_leaving TEXT NOT NULL,
	time_out TEXT NOT NULL,
	time_in TEXT NOT NULL,
	emergency_contact TEXT NOT NULL,
	status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','checked_out','returned','cancelled')),
	reviewed_by TEXT REFERENCES users(id),
	reviewed_at TEXT,
	remarks TEXT,
	expected_return_at TEXT,
	checked_out_at TEXT,
	returned_at TEXT,
	late_status TEXT NOT NULL DEFAULT 'on-time' CHECK(late_status IN ('on-time','late')),
	late_notified_at TEXT,
	face_score REAL,
	distance_meters REAL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS location_logs (
	id TEXT PRIMARY KEY,
	outpass_id TEXT NOT NULL REFERENCES outpasses(id) ON DELETE CASCADE,
	student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	accuracy REAL,
	type TEXT NOT NULL CHECK(type IN ('late','return','extension')),
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extension_requests (
	id TEXT PRIMARY KEY,
	outpass_id TEXT NOT NULL REFERENCES outpasses(id) ON DELETE CASCADE,
	student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	requested_return_at TEXT NOT NULL,
	reason TEXT NOT NULL,
	latitude REAL,
	longitude REAL,
	accuracy REAL,
	status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
	reviewed_by TEXT REFERENCES users(id),
	reviewed_at TEXT,
	remarks TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
	role TEXT CHECK(role IN ('admin','student','warden','gatekeeper')),
	type TEXT NOT NULL,
	title TEXT NOT NULL,
	body TEXT NOT NULL,
	read_at TEXT,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
	id TEXT PRIMARY KEY,
	student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	sender_role TEXT NOT NULL,
	message TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_reads (
	student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	last_read_at TEXT NOT NULL,
	PRIMARY KEY(student_id, user_id)
);

CREATE TABLE IF NOT EXISTS settings (
	id INTEGER PRIMARY KEY CHECK(id = 1),
	out_start_time TEXT NOT NULL,
	out_end_time TEXT NOT NULL,
	return_deadline_time TEXT NOT NULL,
	hostel_lat REAL NOT NULL,
	hostel_lng REAL NOT NULL,
	geo_radius_meters REAL NOT NULL,
	gps_required_accuracy REAL NOT NULL,
	updated_at TEXT NOT NULL
);
`

func Init(cfg config.Config) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0755); err != nil && filepath.Dir(cfg.DBPath) != "." {
		return nil, err
	}
	db, err := sql.Open("sqlite", cfg.DBPath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	if _, err := db.Exec(schemaSQL); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := seedSettings(db, cfg); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func seedSettings(db *sql.DB, cfg config.Config) error {
	now := NowString()
	_, err := db.Exec(`
		INSERT INTO settings (
			id, out_start_time, out_end_time, return_deadline_time,
			hostel_lat, hostel_lng, geo_radius_meters, gps_required_accuracy, updated_at
		)
		VALUES (1, '06:00', '21:00', '22:00', ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO NOTHING
	`, cfg.DefaultHostelLat, cfg.DefaultHostelLng, cfg.DefaultGeoRadius, cfg.DefaultGPSAccuracy, now)
	return err
}

func NowString() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func IsNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

func NullString(value string) sql.NullString {
	return sql.NullString{String: value, Valid: strings.TrimSpace(value) != ""}
}

func MustExec(tx *sql.Tx, query string, args ...any) error {
	if _, err := tx.Exec(query, args...); err != nil {
		return fmt.Errorf("%s: %w", firstLine(query), err)
	}
	return nil
}

func firstLine(query string) string {
	line := strings.TrimSpace(query)
	if idx := strings.IndexByte(line, '\n'); idx >= 0 {
		return line[:idx]
	}
	return line
}

func CreateDefaultAdmin(db *sql.DB, cfg config.Config) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := auth.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}
	now := NowString()
	_, err = db.Exec(`
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, ?)
	`, auth.NewID(), cfg.AdminName, strings.ToLower(cfg.AdminEmail), hash, now, now)
	return err
}
