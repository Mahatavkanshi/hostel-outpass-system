package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DBPath             string
	StorageDir         string
	JWTSecret          string
	AdminName          string
	AdminEmail         string
	AdminPassword      string
	CORSAllowedOrigins []string
	FaceThreshold      float64
	DefaultHostelLat   float64
	DefaultHostelLng   float64
	DefaultGeoRadius   float64
	DefaultGPSAccuracy float64
	Location           *time.Location
}

func Load() Config {
	_ = godotenv.Load()
	loc, err := time.LoadLocation(env("APP_TIMEZONE", "Asia/Kolkata"))
	if err != nil {
		loc = time.Local
	}
	return Config{
		Port:               env("PORT", "5002"),
		DBPath:             env("DB_PATH", "hostel.db"),
		StorageDir:         env("STORAGE_DIR", "storage"),
		JWTSecret:          env("JWT_SECRET", "dev-secret-change-me"),
		AdminName:          env("ADMIN_NAME", "Hostel Admin"),
		AdminEmail:         env("ADMIN_EMAIL", "admin@hostel.local"),
		AdminPassword:      env("ADMIN_PASSWORD", "admin123"),
		CORSAllowedOrigins: envList("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
		FaceThreshold:      envFloat("FACE_THRESHOLD", 0.58),
		DefaultHostelLat:   envFloat("HOSTEL_LAT", 28.6139),
		DefaultHostelLng:   envFloat("HOSTEL_LNG", 77.2090),
		DefaultGeoRadius:   envFloat("GEO_RADIUS_METERS", 80),
		DefaultGPSAccuracy: envFloat("GPS_REQUIRED_ACCURACY", 300),
		Location:           loc,
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envList(key string, fallback string) []string {
	raw := env(key, fallback)
	items := strings.Split(raw, ",")
	values := make([]string, 0, len(items))
	for _, item := range items {
		if value := strings.TrimSpace(item); value != "" {
			values = append(values, value)
		}
	}
	return values
}

func envFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(os.Getenv(key), 64)
	if err != nil {
		return fallback
	}
	return value
}
