"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Check,
  Clock,
  DoorOpen,
  MessageCircle,
  Send,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OutpassList } from "@/components/shared/outpass-list";
import { ProtectedImage } from "@/components/shared/protected-image";
import { useToast } from "@/components/shared/toast";
import {
  Badge,
  DashboardGrid,
  EmptyState,
  Panel,
  StatCard,
  Table,
} from "@/components/shared/ui";
import { api, WS_BASE } from "@/lib/api";
import type {
  ChatConversation,
  ChatMessage,
  Outpass,
  Registration,
  User,
  WardenDashboardStats,
  WardenStudent,
} from "@/lib/types";

const emptyDashboard: WardenDashboardStats = {
  date: "",
  totalStudents: 0,
  pendingReviews: 0,
  pendingOutpass: 0,
  currentlyOut: 0,
  lateStudents: 0,
  todayRequests: 0,
};

export function WardenDashboard({
  token,
  user,
  section,
}: {
  token: string;
  user: User;
  section: string;
}) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pending, setPending] = useState<Outpass[]>([]);
  const [dashboard, setDashboard] =
    useState<WardenDashboardStats>(emptyDashboard);
  const [students, setStudents] = useState<WardenStudent[]>([]);
  const { showError, showToast } = useToast();

  async function load() {
    const [r, p, d, s] = await Promise.all([
      api<{ registrations: Registration[] }>(
        "/api/warden/registrations",
        {},
        token,
      ),
      api<{ outpasses: Outpass[] }>("/api/warden/outpasses/pending", {}, token),
      api<WardenDashboardStats>("/api/warden/dashboard", {}, token),
      api<{ students: WardenStudent[] }>("/api/warden/students", {}, token),
    ]);
    setRegistrations(r.registrations || []);
    setPending(p.outpasses || []);
    setDashboard({ ...emptyDashboard, ...d });
    setStudents(s.students || []);
  }

  useEffect(() => {
    load().catch((err) => showError(err, "Could not load warden dashboard"));
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [token, showError]);

  async function reviewRegistration(id: string, status: string) {
    try {
      await api(
        `/api/warden/registrations/${id}`,
        { method: "PUT", body: JSON.stringify({ status }) },
        token,
      );
      showToast({ kind: "success", title: `Registration ${status}` });
      await load();
    } catch (err) {
      showError(err, "Could not review registration");
    }
  }

  async function reviewOutpass(id: string, status: string) {
    try {
      await api(
        `/api/warden/outpasses/${id}/review`,
        { method: "PUT", body: JSON.stringify({ status }) },
        token,
      );
      showToast({ kind: "success", title: `Outpass ${status}` });
      await load();
    } catch (err) {
      showError(err, "Could not review outpass");
    }
  }

  if (section === "registrations") {
    return (
      <RegistrationsPanel
        registrations={registrations}
        token={token}
        onReview={reviewRegistration}
      />
    );
  }

  if (section === "outpasses") {
    return (
      <DashboardGrid>
        <OutpassApprovals pending={pending} onReview={reviewOutpass} />
        <OutpassList title="Today" outpasses={dashboard.today || []} />
        <OutpassList title="Late students" outpasses={dashboard.late || []} />
      </DashboardGrid>
    );
  }

  if (section === "students") {
    return <StudentsPanel students={students} token={token} />;
  }

  if (section === "chats") {
    return <WardenChats token={token} user={user} />;
  }

  return <WardenOverview dashboard={dashboard} />;
}

function WardenOverview({ dashboard }: { dashboard: WardenDashboardStats }) {
  const statusCounts = dashboard.statusCounts || {};
  const statusTotal = Object.values(statusCounts).reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <div className="grid gap-4">
      <section className="rounded-lg bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-100">
              <CalendarDays size={16} /> {dashboard.date || "Today"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">
              Warden control room
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            Monitor requests, active exits, late returns, and student movement
            from one calmer view.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          icon={Users}
          label="Students"
          value={dashboard.totalStudents}
        />
        <StatCard
          icon={UserCheck}
          label="Registrations"
          value={dashboard.pendingReviews}
          tone="violet"
        />
        <StatCard
          icon={Clock}
          label="Outpass review"
          value={dashboard.pendingOutpass}
          tone="amber"
        />
        <StatCard
          icon={DoorOpen}
          label="Currently out"
          value={dashboard.currentlyOut}
          tone="emerald"
        />
        <StatCard
          icon={AlertTriangle}
          label="Late"
          value={dashboard.lateStudents}
          tone="rose"
        />
        <StatCard
          icon={CalendarDays}
          label="Today"
          value={dashboard.todayRequests}
          tone="slate"
        />
      </div>

      <DashboardGrid>
        <Panel title="Outpass status mix" icon={BarChart3}>
          <div className="grid gap-3">
            {Object.keys(statusCounts).length === 0 && (
              <EmptyState
                title="No outpass data yet"
                body="Status charts appear after students submit requests."
              />
            )}
            {Object.entries(statusCounts).map(([status, value]) => (
              <div key={status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-slate-600">{status}</span>
                  <span className="font-semibold">{value}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{
                      width: `${statusTotal ? (value / statusTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Active return countdowns" icon={Clock}>
          <div className="grid gap-3">
            {(dashboard.active || []).length === 0 && (
              <EmptyState
                title="No students outside"
                body="Checked-out students with active return times appear here."
              />
            )}
            {(dashboard.active || []).slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.studentName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item.placeOfVisit}
                    </p>
                  </div>
                  <Countdown expectedReturnAt={item.expectedReturnAt} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </DashboardGrid>
    </div>
  );
}

function Countdown({ expectedReturnAt }: { expectedReturnAt?: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!expectedReturnAt) return <Badge>No deadline</Badge>;
  const diff = new Date(expectedReturnAt).getTime() - now;
  const overdue = diff < 0;
  const total = Math.abs(diff);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        overdue
          ? "bg-rose-100 text-rose-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {overdue ? "Late " : ""}
      {hours}h {minutes}m {seconds}s
    </span>
  );
}

function RegistrationsPanel({
  registrations,
  token,
  onReview,
}: {
  registrations: Registration[];
  token: string;
  onReview: (id: string, status: string) => void;
}) {
  return (
    <Panel title="Student registrations" icon={UserCheck}>
      <Table
        rows={registrations}
        empty="No pending registrations."
        render={(item) => (
          <tr key={item.id}>
            <td>{item.student.name}</td>
            <td>{item.student.collegeId}</td>
            <td>
              <div className="grid min-w-48 grid-cols-3 gap-2 py-2">
                {(item.faceSamples || []).map((sample) => (
                  <ProtectedImage
                    key={sample.id}
                    src={sample.url}
                    token={token}
                    alt={`Face sample ${sample.index}`}
                  />
                ))}
              </div>
            </td>
            <td className="flex gap-2">
              <button
                className="icon-btn text-emerald-700"
                onClick={() => onReview(item.id, "approved")}
                type="button"
              >
                <Check size={15} />
              </button>
              <button
                className="icon-btn text-rose-700"
                onClick={() => onReview(item.id, "rejected")}
                type="button"
              >
                <X size={15} />
              </button>
            </td>
          </tr>
        )}
      />
    </Panel>
  );
}

function OutpassApprovals({
  pending,
  onReview,
}: {
  pending: Outpass[];
  onReview: (id: string, status: string) => void;
}) {
  return (
    <Panel title="Outpass approvals" icon={Clock}>
      <Table
        rows={pending}
        empty="No pending outpasses."
        render={(item) => (
          <tr key={item.id}>
            <td>{item.studentName}</td>
            <td>{item.placeOfVisit}</td>
            <td>
              {item.timeOut}-{item.timeIn}
            </td>
            <td className="flex gap-2">
              <button
                className="icon-btn text-emerald-700"
                onClick={() => onReview(item.id, "approved")}
                type="button"
              >
                <Check size={15} />
              </button>
              <button
                className="icon-btn text-rose-700"
                onClick={() => onReview(item.id, "rejected")}
                type="button"
              >
                <X size={15} />
              </button>
            </td>
          </tr>
        )}
      />
    </Panel>
  );
}

function StudentsPanel({
  students,
  token,
}: {
  students: WardenStudent[];
  token: string;
}) {
  return (
    <Panel title="Students" icon={Users}>
      <div className="grid gap-3 md:grid-cols-2">
        {students.length === 0 && (
          <EmptyState
            title="No students found"
            body="Approved students appear here."
          />
        )}
        {students.map((student) => (
          <div
            key={student.id}
            className="grid grid-cols-[3.5rem_1fr] items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
          >
            {student.faceUrl ? (
              <ProtectedImage
                src={student.faceUrl}
                token={token}
                alt={`${student.name} profile`}
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg bg-cyan-50 text-sm font-semibold text-cyan-700">
                {student.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{student.name}</p>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    student.studentOnline ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  title={student.studentOnline ? "Online" : "Offline"}
                />
              </div>
              <p className="truncate text-xs text-slate-500">
                {student.collegeId} · {student.email}
              </p>
              <p className="truncate text-xs text-slate-600">
                {student.lastMessage || "No messages yet"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WardenChats({ token, user }: { token: string; user: User }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const threadSocketRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { showError, showToast } = useToast();

  async function loadInbox() {
    const data = await api<{ conversations: ChatConversation[] }>(
      "/api/chat/inbox",
      {},
      token,
    );
    setConversations(data.conversations || []);
    if (!selectedId && data.conversations?.[0]) {
      setSelectedId(data.conversations[0].studentId);
    }
  }

  useEffect(() => {
    loadInbox().catch((err) => showError(err, "Could not load chat inbox"));
    const socket = new WebSocket(
      `${WS_BASE}?token=${encodeURIComponent(token)}`,
    );
    socketRef.current = socket;
    socket.onmessage = () => {
      loadInbox().catch(() => {});
    };
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [token, showError, showToast]);

  useEffect(() => {
    if (!selectedId) return;
    api<{ messages: ChatMessage[] }>(
      `/api/chat/${selectedId}/messages`,
      {},
      token,
    )
      .then((data) => {
        setMessages(data.messages || []);
        return api(`/api/chat/${selectedId}/read`, { method: "PATCH" }, token);
      })
      .then(() => loadInbox())
      .catch((err) => showError(err, "Could not load chat"));

    const socket = new WebSocket(
      `${WS_BASE}?token=${encodeURIComponent(token)}&studentId=${selectedId}`,
    );
    threadSocketRef.current = socket;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ChatMessage;
      setMessages((current) => [...current, message]);
      api(`/api/chat/${selectedId}/read`, { method: "PATCH" }, token).catch(
        () => {},
      );
    };
    return () => {
      socket.close();
      threadSocketRef.current = null;
    };
  }, [selectedId, token, showError]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send() {
    const socket = threadSocketRef.current;
    if (!text.trim()) return;
    if (socket?.readyState !== WebSocket.OPEN) {
      showToast({ kind: "error", title: "Chat is offline" });
      return;
    }
    socket.send(JSON.stringify({ message: text.trim() }));
    setText("");
  }

  const selected = conversations.find((item) => item.studentId === selectedId);

  return (
    <section className="grid min-h-[70vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[22rem_1fr]">
      <aside className="border-b border-slate-200 lg:border-r lg:border-b-0">
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageCircle size={18} /> Student chats
          </h2>
        </div>
        <div className="max-h-[68vh] overflow-auto">
          {conversations.map((item) => (
            <button
              key={item.studentId}
              className={`grid w-full gap-1 border-b border-slate-100 p-4 text-left ${
                selectedId === item.studentId
                  ? "bg-cyan-50"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setSelectedId(item.studentId)}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  {item.studentName}
                </span>
                {item.unreadCount > 0 && (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {item.unreadCount}
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-slate-500">
                {item.collegeId} · {item.lastMessage || "No messages yet"}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="grid min-h-[32rem] grid-rows-[auto_1fr_auto]">
        <header className="border-b border-slate-200 p-4">
          <p className="font-semibold">
            {selected?.studentName || "Select a chat"}
          </p>
          <p className="text-xs text-slate-500">{selected?.email}</p>
        </header>
        <div className="overflow-auto bg-slate-50 p-4">
          {!selectedId && (
            <EmptyState
              title="Pick a conversation"
              body="Messages for the selected student will appear here."
            />
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-2 flex ${
                msg.senderRole === user.role ? "justify-end" : "justify-start"
              }`}
            >
              <span
                className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  msg.senderRole === user.role
                    ? "bg-slate-950 text-white"
                    : "bg-white text-slate-900"
                }`}
              >
                {msg.message}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 border-t border-slate-200 p-3">
          <input
            className="field"
            value={text}
            disabled={!selectedId}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            placeholder="Type a message"
          />
          <button
            className="icon-btn"
            disabled={!selectedId}
            onClick={send}
            title="Send message"
            type="button"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
