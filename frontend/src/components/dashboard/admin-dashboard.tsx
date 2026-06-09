"use client";

import { Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { DashboardGrid, Field, Panel, Table } from "@/components/shared/ui";
import { api } from "@/lib/api";
import type { Settings, User } from "@/lib/types";

export function AdminDashboard({ token }: { token: string }) {
  const [staff, setStaff] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [busy, setBusy] = useState("");
  const { showError, showToast } = useToast();

  async function load() {
    const [s, cfg] = await Promise.all([
      api<{ staff: User[] }>("/api/admin/staff", {}, token),
      api<{ settings: Settings }>("/api/admin/settings", {}, token),
    ]);
    setStaff(s.staff || []);
    setSettings(cfg.settings || {});
  }

  useEffect(() => {
    load().catch((err) => showError(err, "Could not load admin dashboard"));
  }, [showError]);

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("staff");
    try {
      await api(
        "/api/admin/staff",
        {
          method: "POST",
          body: JSON.stringify(
            Object.fromEntries(new FormData(event.currentTarget)),
          ),
        },
        token,
      );
      event.currentTarget.reset();
      showToast({ kind: "success", title: "Staff user created" });
      load();
    } catch (err) {
      showError(err, "Could not create staff user");
    } finally {
      setBusy("");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setBusy("settings");
    try {
      await api(
        "/api/admin/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            ...form,
            hostelLat: Number(form.hostelLat),
            hostelLng: Number(form.hostelLng),
            geoRadiusMeters: Number(form.geoRadiusMeters),
            gpsRequiredAccuracy: Number(form.gpsRequiredAccuracy),
          }),
        },
        token,
      );
      showToast({ kind: "success", title: "Settings saved" });
      load();
    } catch (err) {
      showError(err, "Could not save settings");
    } finally {
      setBusy("");
    }
  }

  return (
    <DashboardGrid>
      <Panel title="Create staff">
        <form className="grid gap-3" onSubmit={createStaff}>
          <Field name="name" label="Name" />
          <Field name="email" label="Email" type="email" />
          <Field name="password" label="Password" type="password" />
          <select name="role" className="field">
            <option value="warden">Warden</option>
            <option value="gatekeeper">Gatekeeper</option>
          </select>
          <button
            className="primary-btn"
            disabled={busy === "staff"}
            type="submit"
          >
            <Plus size={16} /> {busy === "staff" ? "Creating..." : "Create"}
          </button>
        </form>
      </Panel>
      <Panel title="Hostel timings">
        <form className="grid gap-3" onSubmit={saveSettings}>
          <Field
            name="outStartTime"
            label="Out start"
            type="time"
            defaultValue={settings.outStartTime}
          />
          <Field
            name="outEndTime"
            label="Out end"
            type="time"
            defaultValue={settings.outEndTime}
          />
          <Field
            name="returnDeadlineTime"
            label="Return deadline"
            type="time"
            defaultValue={settings.returnDeadlineTime}
          />
          <Field
            name="hostelLat"
            label="Hostel latitude"
            defaultValue={settings.hostelLat}
          />
          <Field
            name="hostelLng"
            label="Hostel longitude"
            defaultValue={settings.hostelLng}
          />
          <Field
            name="geoRadiusMeters"
            label="Geofence radius"
            defaultValue={settings.geoRadiusMeters}
          />
          <Field
            name="gpsRequiredAccuracy"
            label="GPS max accuracy"
            defaultValue={settings.gpsRequiredAccuracy}
          />
          <button
            className="primary-btn"
            disabled={busy === "settings"}
            type="submit"
          >
            {busy === "settings" ? "Saving..." : "Save settings"}
          </button>
        </form>
      </Panel>
      <Panel title="Staff">
        <Table
          rows={staff}
          empty="No staff yet."
          render={(item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.email}</td>
              <td>{item.role}</td>
            </tr>
          )}
        />
      </Panel>
    </DashboardGrid>
  );
}
