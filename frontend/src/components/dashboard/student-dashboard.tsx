"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ChatWidget } from "@/components/shared/chat-widget";
import { Notifications } from "@/components/shared/notifications";
import { OutpassList } from "@/components/shared/outpass-list";
import { useToast } from "@/components/shared/toast";
import { DashboardGrid, Field, Panel } from "@/components/shared/ui";
import { api, currentPosition, descriptor } from "@/lib/api";
import type { Notification, Outpass, User } from "@/lib/types";

export function StudentDashboard({
  token,
  user,
}: {
  token: string;
  user: User;
}) {
  const [outpasses, setOutpasses] = useState<Outpass[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);
  const { showError, showToast } = useToast();

  async function load() {
    const [outpassData, noteData] = await Promise.all([
      api<{ outpasses: Outpass[] }>("/api/student/outpasses", {}, token).catch(
        () => ({ outpasses: [] }),
      ),
      api<{ notifications: Notification[] }>("/api/notifications", {}, token),
    ]);
    setOutpasses(outpassData.outpasses || []);
    setNotes(noteData.notifications || []);
  }

  useEffect(() => {
    load().catch((err) => showError(err, "Could not load student dashboard"));
  }, [showError]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(
        "/api/profile",
        { method: "PUT", body: JSON.stringify(form) },
        token,
      );
      showToast({ kind: "success", title: "Profile saved" });
    } catch (err) {
      showError(err, "Could not save profile");
    }
  }

  async function submitOutpass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(
        "/api/student/outpasses",
        { method: "POST", body: JSON.stringify(form) },
        token,
      );
      showToast({ kind: "success", title: "Outpass request submitted" });
      event.currentTarget.reset();
      load();
    } catch (err) {
      showError(err, "Could not submit outpass");
    }
  }

  async function markReturn(id: string) {
    try {
      const pos = await currentPosition();
      const data = await api<{ message: string }>(
        `/api/student/outpasses/${id}/return`,
        {
          method: "POST",
          body: JSON.stringify({
            descriptors: [descriptor(0.1)],
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        },
        token,
      );
      showToast({ kind: "success", title: data.message || "Return verified" });
      load();
    } catch (err) {
      showError(err, "Could not verify return");
    }
  }

  async function extension(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("outpassId"));
    try {
      const pos = await currentPosition();
      await api(
        `/api/student/outpasses/${id}/extension`,
        {
          method: "POST",
          body: JSON.stringify({
            requestedReturnAt: new Date(
              String(form.get("requestedReturnAt")),
            ).toISOString(),
            reason: form.get("reason"),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        },
        token,
      );
      showToast({ kind: "success", title: "Extension requested" });
      event.currentTarget.reset();
    } catch (err) {
      showError(err, "Could not request extension");
    }
  }

  if (!user.isVerified) {
    return (
      <Panel title="Registration pending">
        Your account is waiting for warden approval.
      </Panel>
    );
  }

  const active = outpasses.find((item) => item.status === "checked_out");

  return (
    <DashboardGrid>
      <Panel title="Profile">
        <form className="grid gap-3" onSubmit={submitProfile}>
          <Field name="contactNumber" label="Contact number" />
          <Field name="parentContact" label="Parent contact" />
          <Field name="roomNumber" label="Room number" />
          <Field name="emergencyContact" label="Emergency contact" />
          <textarea name="address" className="field" placeholder="Address" />
          <button className="primary-btn" type="submit">
            Save profile
          </button>
        </form>
      </Panel>
      <Panel title="Request outpass">
        <form className="grid gap-3" onSubmit={submitOutpass}>
          <Field name="dateOfLeaving" label="Date" type="date" />
          <div className="grid grid-cols-2 gap-3">
            <Field name="timeOut" label="Out time" type="time" />
            <Field name="timeIn" label="Return time" type="time" />
          </div>
          <Field name="placeOfVisit" label="Place of visit" />
          <Field name="reason" label="Reason" />
          <Field name="emergencyContact" label="Emergency contact" />
          <button className="primary-btn" type="submit">
            Submit request
          </button>
        </form>
      </Panel>
      <Panel title="Active return">
        {active ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              {active.placeOfVisit} until {active.timeIn}
            </p>
            <button
              className="primary-btn"
              onClick={() => markReturn(active.id)}
              type="button"
            >
              Verify return with GPS
            </button>
            <form className="grid gap-3" onSubmit={extension}>
              <input type="hidden" name="outpassId" value={active.id} />
              <Field
                name="requestedReturnAt"
                label="New return time"
                type="datetime-local"
              />
              <Field name="reason" label="Extension reason" />
              <button className="secondary-btn" type="submit">
                Request extension
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No checked-out outpass.</p>
        )}
      </Panel>
      <OutpassList title="My outpasses" outpasses={outpasses} />
      <Notifications notes={notes} />
      <ChatWidget
        token={token}
        user={user}
        studentId={user.id}
        label="Warden chat"
      />
    </DashboardGrid>
  );
}
