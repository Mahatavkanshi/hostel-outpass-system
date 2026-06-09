"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ClipboardCheck,
  DoorOpen,
  Home,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { api, clearSession, loadSession, WS_BASE } from "@/lib/api";
import type {
  ChatConversation,
  ChatMessage,
  Notification,
  Role,
  User,
} from "@/lib/types";
import { AdminDashboard } from "./admin-dashboard";
import { GatekeeperDashboard } from "./gatekeeper-dashboard";
import { StudentDashboard } from "./student-dashboard";
import { WardenDashboard } from "./warden-dashboard";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { id: "overview", label: "Overview", icon: Home },
    { id: "staff", label: "Staff", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ],
  warden: [
    { id: "overview", label: "Overview", icon: Home },
    { id: "registrations", label: "Registrations", icon: UserCircle },
    { id: "outpasses", label: "Outpasses", icon: ClipboardCheck },
    { id: "students", label: "Students", icon: Users },
    { id: "chats", label: "Chats", icon: MessageCircle },
  ],
  student: [
    { id: "overview", label: "Overview", icon: Home },
    { id: "profile", label: "Profile", icon: UserCircle },
    { id: "outpasses", label: "Outpasses", icon: ClipboardCheck },
    { id: "return", label: "Return", icon: DoorOpen },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ],
  gatekeeper: [
    { id: "overview", label: "Overview", icon: Home },
    { id: "exits", label: "Exits", icon: DoorOpen },
    { id: "returns", label: "Returns", icon: ClipboardCheck },
    { id: "extensions", label: "Extensions", icon: Bell },
  ],
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.senderRole === "string" &&
    typeof candidate.message === "string"
  );
}

export function DashboardShell({ userRole }: { userRole?: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const session = loadSession<User>();
    if (!session.token || !session.user) {
      router.replace("/login");
      return;
    }
    if (!userRole) {
      router.replace(`/dashboard/${session.user.role}`);
      return;
    }
    if (session.user.role !== userRole) {
      router.replace(`/dashboard/${session.user.role}`);
      return;
    }
    setToken(session.token);
    setUser(session.user);
  }, [userRole, router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const section = pathname.split("/")[3] || "overview";
  const chatSection = user?.role === "warden" ? "chats" : "chat";

  useEffect(() => {
    if (
      !token ||
      !user ||
      (user.role !== "warden" && user.role !== "student")
    ) {
      setChatUnread(0);
      return;
    }

    let alive = true;
    let unreadTimer: number | undefined;

    async function loadWardenUnread() {
      if (user?.role !== "warden") return;
      const data = await api<{ conversations: ChatConversation[] }>(
        "/api/chat/inbox",
        {},
        token,
      );
      if (!alive) return;
      setChatUnread(
        (data.conversations || []).reduce(
          (sum, item) => sum + (item.unreadCount || 0),
          0,
        ),
      );
    }

    if (user.role === "warden") {
      loadWardenUnread().catch(() => {});
      unreadTimer = window.setInterval(() => {
        loadWardenUnread().catch(() => {});
      }, 10000);
    }

    const studentParam =
      user.role === "student"
        ? `&studentId=${encodeURIComponent(user.id)}`
        : "";
    const socket = new WebSocket(
      `${WS_BASE}?token=${encodeURIComponent(token)}${studentParam}`,
    );

    socket.onmessage = (event) => {
      let message: ChatMessage | undefined;
      try {
        const payload = JSON.parse(event.data) as unknown;
        if (isChatMessage(payload)) {
          message = payload;
        } else if (
          payload &&
          typeof payload === "object" &&
          "message" in payload &&
          isChatMessage((payload as { message?: unknown }).message)
        ) {
          message = (payload as { message: ChatMessage }).message;
        }
      } catch {
        return;
      }
      if (!message || message.senderRole === user.role) return;

      if (user.role === "warden") {
        loadWardenUnread().catch(() => {});
      } else {
        setChatUnread((current) => current + 1);
      }

      if (section !== chatSection) {
        showToast({
          kind: "info",
          title:
            user.role === "warden"
              ? "New student message"
              : "New warden message",
          body: message.message,
        });
      }
    };

    return () => {
      alive = false;
      if (unreadTimer) window.clearInterval(unreadTimer);
      socket.close();
    };
  }, [token, user, section, chatSection, showToast]);

  useEffect(() => {
    if (section === chatSection && user?.role === "student") {
      setChatUnread(0);
    }
  }, [section, chatSection, user?.role]);

  useEffect(() => {
    if (!token || !user) {
      seenNotificationIds.current = null;
      setNotificationUnread(0);
      return;
    }

    let alive = true;

    async function loadNotifications(showNew: boolean) {
      const data = await api<{ notifications: Notification[] }>(
        "/api/notifications",
        {},
        token,
      );
      if (!alive) return;
      const notes = data.notifications || [];
      setNotifications(notes);
      setNotificationUnread(notes.filter((note) => !note.readAt).length);

      if (!seenNotificationIds.current) {
        seenNotificationIds.current = new Set(notes.map((note) => note.id));
        return;
      }

      const fresh = notes
        .filter((note) => !seenNotificationIds.current?.has(note.id))
        .reverse();
      for (const note of fresh) {
        seenNotificationIds.current.add(note.id);
        if (showNew) {
          showToast({
            kind: "info",
            title: note.title,
            body: note.body,
          });
        }
      }
    }

    loadNotifications(false).catch(() => {});
    const timer = window.setInterval(() => {
      loadNotifications(true).catch(() => {});
    }, 8000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [token, user, showToast]);

  async function markNotificationRead(id: string) {
    if (!token) return;
    const wasUnread = notifications.some(
      (note) => note.id === id && !note.readAt,
    );
    setNotifications((current) =>
      current.map((note) =>
        note.id === id ? { ...note, readAt: new Date().toISOString() } : note,
      ),
    );
    if (wasUnread) {
      setNotificationUnread((current) => Math.max(0, current - 1));
    }
    try {
      await api(`/api/notifications/${id}/read`, { method: "PATCH" }, token);
    } catch {
      setNotificationsOpen(true);
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-6 text-slate-950">
        Loading dashboard...
      </main>
    );
  }

  const items = NAV[user.role];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 md:block">
        <Link
          href={`/dashboard/${user.role}/overview`}
          className="mb-6 flex items-center gap-3 rounded-lg bg-slate-950 px-3 py-3 text-white"
        >
          <ShieldCheck size={20} />
          <span className="font-semibold">Hostel Outpass</span>
        </Link>
        <nav className="grid gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.id === section;
            const showChatBadge = item.id === chatSection && chatUnread > 0;
            return (
              <Link
                key={item.id}
                href={`/dashboard/${user.role}/${item.id}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active
                    ? "bg-cyan-50 text-cyan-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
                {showChatBadge && (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {chatUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm capitalize text-slate-500">
                {user.role} dashboard
              </p>
              <h1 className="text-xl font-semibold">{user.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  className="relative inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600"
                  onClick={() => setNotificationsOpen((value) => !value)}
                  title="Notifications"
                  type="button"
                >
                  <Bell size={16} />
                  <span>{notificationUnread}</span>
                  {notificationUnread > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-600" />
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 z-[90] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold">Notifications</p>
                      <span className="text-xs text-slate-500">
                        {notificationUnread} unread
                      </span>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      {notifications.length === 0 && (
                        <p className="px-4 py-6 text-sm text-slate-500">
                          No notifications yet.
                        </p>
                      )}
                      {notifications.slice(0, 8).map((note) => (
                        <button
                          key={note.id}
                          className={`grid w-full gap-1 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                            note.readAt ? "bg-white" : "bg-cyan-50/70"
                          }`}
                          onClick={() => markNotificationRead(note.id)}
                          type="button"
                        >
                          <span className="font-semibold text-slate-900">
                            {note.title}
                          </span>
                          <span className="text-slate-600">{note.body}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium"
                onClick={logout}
                type="button"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-5 pb-24 md:px-6 md:pb-8">
          {userRole === "student" && (
            <StudentDashboard token={token} user={user} section={section} />
          )}
          {userRole === "warden" && (
            <WardenDashboard token={token} user={user} section={section} />
          )}
          {userRole === "gatekeeper" && (
            <GatekeeperDashboard token={token} section={section} />
          )}
          {userRole === "admin" && (
            <AdminDashboard token={token} section={section} />
          )}
        </div>
      </div>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur md:hidden"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === section;
          const showChatBadge = item.id === chatSection && chatUnread > 0;
          return (
            <Link
              key={item.id}
              href={`/dashboard/${user.role}/${item.id}`}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-[0.68rem] font-semibold ${
                active
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="relative">
                <Icon size={17} />
                {showChatBadge && (
                  <span className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[0.65rem] font-semibold text-white">
                    {chatUnread}
                  </span>
                )}
              </span>
              <span className="mt-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
