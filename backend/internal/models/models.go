package models

type UserDTO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	CollegeID    string `json:"collegeId,omitempty"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	IsVerified   bool   `json:"isVerified"`
	IsActive     bool   `json:"isActive"`
	ReviewStatus string `json:"reviewStatus,omitempty"`
}

type Settings struct {
	OutStartTime        string  `json:"outStartTime"`
	OutEndTime          string  `json:"outEndTime"`
	ReturnDeadlineTime  string  `json:"returnDeadlineTime"`
	HostelLat           float64 `json:"hostelLat"`
	HostelLng           float64 `json:"hostelLng"`
	GeoRadiusMeters     float64 `json:"geoRadiusMeters"`
	GPSRequiredAccuracy float64 `json:"gpsRequiredAccuracy"`
}

type OutpassDTO struct {
	ID               string   `json:"id"`
	StudentID        string   `json:"studentId"`
	StudentName      string   `json:"studentName,omitempty"`
	CollegeID        string   `json:"collegeId,omitempty"`
	Email            string   `json:"email,omitempty"`
	Reason           string   `json:"reason"`
	PlaceOfVisit     string   `json:"placeOfVisit"`
	DateOfLeaving    string   `json:"dateOfLeaving"`
	TimeOut          string   `json:"timeOut"`
	TimeIn           string   `json:"timeIn"`
	EmergencyContact string   `json:"emergencyContact"`
	Status           string   `json:"status"`
	LateStatus       string   `json:"lateStatus"`
	ExpectedReturnAt string   `json:"expectedReturnAt,omitempty"`
	CheckedOutAt     string   `json:"checkedOutAt,omitempty"`
	ReturnedAt       string   `json:"returnedAt,omitempty"`
	Remarks          string   `json:"remarks,omitempty"`
	FaceScore        *float64 `json:"faceScore,omitempty"`
	DistanceMeters   *float64 `json:"distanceMeters,omitempty"`
	CreatedAt        string   `json:"createdAt"`
}
