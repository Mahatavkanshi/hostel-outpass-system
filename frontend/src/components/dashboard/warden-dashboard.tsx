"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ChatWidget } from "@/components/shared/chat-widget";
import { OutpassList } from "@/components/shared/outpass-list";
import { ProtectedImage } from "@/components/shared/protected-image";
import { useToast } from "@/components/shared/toast";
import { DashboardGrid, Field, Panel, Table } from "@/components/shared/ui";
import { api } from "@/lib/api";
import type { Outpass, Registration, User, WardenStudent } from "@/lib/types";

type WardenDashboardData = {
  today?: Outpass[];
  late?: Outpass[];
};

export function WardenDashboard({ token }: { token: string }) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pending, setPending] = useState<Outpass[]>([]);
  const [dashboard, setDashboard] = useState<WardenDashboardData>({});
  const [students, setStudents] = useState<WardenStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const { showError, showToast } = useToast();

  async function load() {
    const [r, p, d, s] = await Promise.all([
      api<{ registrations: Registration[] }>(
        "/api/warden/registrations",
        {},
        token,
      ),
      api<{ outpasses: Outpass[] }>("/api/warden/outpasses/pending", {}, token),
      api<WardenDashboardData>("/api/warden/dashboard", {}, token),
      api<{ students: WardenStudent[] }>("/api/warden/students", {}, token),
    ]);
    setRegistrations(r.registrations || []);
    setPending(p.outpasses || []);
    setDashboard(d);
    setStudents(s.students || []);
  }

  useEffect(() => {
    load().catch((err) => showError(err, "Could not load warden dashboard"));
    const timer = window.setInterval(() => {
      api<{ students: WardenStudent[] }>("/api/warden/students", {}, token)
        .then((data) => setStudents(data.students || []))
        .catch(() => {});
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
      load();
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
      load();
    } catch (err) {
      showError(err, "Could not review outpass");
    }
  }

  const wardenUser: User = {
    id: "warden",
    role: "warden",
    name: "Warden",
    email: "",
    isVerified: true,
  };
  const selectedStudent = students.find((student) => student.id === studentId);

  return (
    <DashboardGrid>
      <Panel title="Student registrations">
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
                  className="icon-btn"
                  onClick={() => reviewRegistration(item.id, "approved")}
                  type="button"
                >
                  <Check size={15} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => reviewRegistration(item.id, "rejected")}
                  type="button"
                >
                  <X size={15} />
                </button>
              </td>
            </tr>
          )}
        />
      </Panel>
      <Panel title="Outpass approvals">
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
                  className="secondary-btn"
                  onClick={() => setStudentId(item.studentId)}
                  type="button"
                >
                  Chat
                </button>
                <button
                  className="icon-btn"
                  onClick={() => reviewOutpass(item.id, "approved")}
                  type="button"
                >
                  <Check size={15} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => reviewOutpass(item.id, "rejected")}
                  type="button"
                >
                  <X size={15} />
                </button>
              </td>
            </tr>
          )}
        />
      </Panel>
      <OutpassList title="Today" outpasses={dashboard.today || []} />
      <OutpassList title="Late students" outpasses={dashboard.late || []} />
      <Panel title="Students">
        <div className="grid gap-3">
          {students.length === 0 && (
            <p className="text-sm text-zinc-500">No students found.</p>
          )}
          {students.map((student) => (
            <div
              key={student.id}
              className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded border border-zinc-200 p-3"
            >
              {student.faceUrl ? (
                <ProtectedImage
                  src={student.faceUrl}
                  token={token}
                  alt={`${student.name} profile`}
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded bg-zinc-100 text-sm font-semibold">
                  {student.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {student.name}
                  </p>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${student.studentOnline ? "bg-emerald-500" : "bg-zinc-300"}`}
                    title={student.studentOnline ? "Online" : "Offline"}
                  />
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {student.collegeId} · {student.email}
                </p>
                <p className="truncate text-xs text-zinc-600">
                  {student.lastMessage || "No messages yet"}
                </p>
                {student.lastMessageAt && (
                  <p className="truncate text-[0.7rem] text-zinc-400">
                    Last message{" "}
                    {new Date(student.lastMessageAt).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                className="secondary-btn"
                onClick={() => setStudentId(student.id)}
                type="button"
              >
                Chat
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Open chat">
        <Field
          name="studentId"
          label="Student ID"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
        />
        <p className="mt-2 text-sm text-zinc-500">
          Select Chat from an outpass row or paste a student ID.
        </p>
      </Panel>
      {studentId && (
        <ChatWidget
          token={token}
          user={wardenUser}
          studentId={studentId}
          label={`Chat with ${selectedStudent?.name || "student"}`}
        />
      )}
    </DashboardGrid>
  );
}
