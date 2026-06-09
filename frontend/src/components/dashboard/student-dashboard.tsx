"use client";

import {
  ClipboardCheck,
  DoorOpen,
  MessageCircle,
  UserCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ChatWidget } from "@/components/shared/chat-widget";
import { Notifications } from "@/components/shared/notifications";
import { OutpassList } from "@/components/shared/outpass-list";
import { useToast } from "@/components/shared/toast";
import { DashboardGrid, Field, Panel, StatCard } from "@/components/shared/ui";
import { api, currentPosition, descriptor } from "@/lib/api";
import type { Notification, Outpass, User } from "@/lib/types";

export function StudentDashboard({
  token,
  user,
  section,
}: {
  token: string;
  user: User;
  section: string;
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
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [token, showError]);

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
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    try {
      await api(
        "/api/student/outpasses",
        { method: "POST", body: JSON.stringify(form) },
        token,
      );
      showToast({ kind: "success", title: "Outpass request submitted" });
      formElement.reset();
      await load();
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
      await load();
    } catch (err) {
      showError(err, "Could not verify return");
    }
  }

  async function extension(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      formElement.reset();
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

  if (section === "profile") {
    return <ProfileForm onSubmit={submitProfile} />;
  }

  if (section === "outpasses") {
    return (
      <DashboardGrid>
        <RequestOutpassForm onSubmit={submitOutpass} />
        <OutpassList title="My outpasses" outpasses={outpasses} />
      </DashboardGrid>
    );
  }

  if (section === "return") {
    return (
      <ActiveReturn
        active={active}
        onExtension={extension}
        onReturn={markReturn}
      />
    );
  }

  if (section === "chat") {
    return (
      <Panel title="Warden chat" icon={MessageCircle}>
        <ChatWidget
          token={token}
          user={user}
          studentId={user.id}
          label="Warden chat"
          variant="inline"
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={ClipboardCheck}
          label="Total requests"
          value={outpasses.length}
        />
        <StatCard
          icon={DoorOpen}
          label="Active return"
          value={active ? "1" : "0"}
          tone={active ? "emerald" : "slate"}
        />
        <StatCard
          icon={MessageCircle}
          label="Notifications"
          value={notes.length}
          tone="amber"
        />
      </div>
      <DashboardGrid>
        <RequestOutpassForm onSubmit={submitOutpass} />
        <Notifications notes={notes} />
        <OutpassList
          title="Recent outpasses"
          outpasses={outpasses.slice(0, 5)}
        />
      </DashboardGrid>
    </div>
  );
}

function ProfileForm({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel title="Profile" icon={UserCircle}>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="contactNumber" label="Contact number" />
          <Field name="parentContact" label="Parent contact" />
          <Field name="roomNumber" label="Room number" />
          <Field name="emergencyContact" label="Emergency contact" />
        </div>
        <textarea
          name="address"
          className="field min-h-28"
          placeholder="Address"
        />
        <button className="primary-btn" type="submit">
          Save profile
        </button>
      </form>
    </Panel>
  );
}

function RequestOutpassForm({
  onSubmit,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel title="Request outpass" icon={ClipboardCheck}>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <Field name="dateOfLeaving" label="Date" type="date" required />
        <div className="grid grid-cols-2 gap-3">
          <Field name="timeOut" label="Out time" type="time" required />
          <Field name="timeIn" label="Return time" type="time" required />
        </div>
        <Field name="placeOfVisit" label="Place of visit" required />
        <Field name="reason" label="Reason" required />
        <Field name="emergencyContact" label="Emergency contact" required />
        <button className="primary-btn" type="submit">
          Submit request
        </button>
      </form>
    </Panel>
  );
}

function ActiveReturn({
  active,
  onReturn,
  onExtension,
}: {
  active?: Outpass;
  onReturn: (id: string) => void;
  onExtension: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel title="Active return" icon={DoorOpen}>
      {active ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {active.placeOfVisit} until {active.timeIn}
          </p>
          <button
            className="primary-btn"
            onClick={() => onReturn(active.id)}
            type="button"
          >
            Verify return with GPS
          </button>
          <form className="grid gap-3" onSubmit={onExtension}>
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
        <p className="text-sm text-slate-500">No checked-out outpass.</p>
      )}
    </Panel>
  );
}
