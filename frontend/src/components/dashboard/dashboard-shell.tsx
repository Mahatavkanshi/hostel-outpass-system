"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, loadSession } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { AdminDashboard } from "./admin-dashboard";
import { GatekeeperDashboard } from "./gatekeeper-dashboard";
import { StudentDashboard } from "./student-dashboard";
import { WardenDashboard } from "./warden-dashboard";

export function DashboardShell({ userRole }: { userRole?: Role }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);

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

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-5 py-6 text-zinc-950">
        Loading dashboard...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm text-zinc-500">Signed in as {user.role}</p>
            <h1 className="text-xl font-semibold">{user.name}</h1>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded border border-zinc-300 px-3 text-sm font-medium"
            onClick={logout}
            type="button"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">
        {userRole === "student" && (
          <StudentDashboard token={token} user={user} />
        )}
        {userRole === "warden" && <WardenDashboard token={token} />}
        {userRole === "gatekeeper" && <GatekeeperDashboard token={token} />}
        {userRole === "admin" && <AdminDashboard token={token} />}
      </div>
    </main>
  );
}
