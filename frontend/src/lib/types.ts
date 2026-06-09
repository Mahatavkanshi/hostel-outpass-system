export type Role = "admin" | "student" | "warden" | "gatekeeper";

export type User = {
  id: string;
  name: string;
  email: string;
  collegeId?: string;
  role: Role;
  isVerified: boolean;
  isActive?: boolean;
  reviewStatus?: string;
};

export type Outpass = {
  id: string;
  studentId: string;
  studentName?: string;
  collegeId?: string;
  email?: string;
  reason: string;
  placeOfVisit: string;
  dateOfLeaving: string;
  timeOut: string;
  timeIn: string;
  emergencyContact: string;
  status: string;
  lateStatus: string;
  expectedReturnAt?: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt?: string;
  createdAt: string;
};

export type Registration = {
  id: string;
  status: string;
  student: {
    id: string;
    name: string;
    collegeId: string;
    email: string;
  };
  faceSamples?: Array<{
    id: string;
    index: number;
    url: string;
  }>;
};

export type ExtensionRequest = {
  id: string;
  outpassId: string;
  requestedReturnAt: string;
  reason: string;
  student: {
    name: string;
    collegeId: string;
    email: string;
  };
};

export type Settings = {
  outStartTime?: string;
  outEndTime?: string;
  returnDeadlineTime?: string;
  hostelLat?: number;
  hostelLng?: number;
  geoRadiusMeters?: number;
  gpsRequiredAccuracy?: number;
};

export type ChatMessage = {
  id: string;
  studentId?: string;
  senderId: string;
  senderRole: Role;
  message: string;
  createdAt: string;
};

export type WardenStudent = {
  id: string;
  name: string;
  collegeId: string;
  email: string;
  isVerified: boolean;
  reviewStatus: string;
  faceUrl?: string;
  studentOnline: boolean;
  wardenOnline: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
};

export type ChatConversation = {
  studentId: string;
  studentName: string;
  collegeId: string;
  email: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  studentOnline: boolean;
  wardenOnline: boolean;
};

export type WardenDashboardStats = {
  date: string;
  today?: Outpass[];
  active?: Outpass[];
  late?: Outpass[];
  extensions?: Array<Record<string, unknown>>;
  statusCounts?: Record<string, number>;
  totalStudents: number;
  pendingReviews: number;
  pendingOutpass: number;
  currentlyOut: number;
  lateStudents: number;
  todayRequests: number;
};
