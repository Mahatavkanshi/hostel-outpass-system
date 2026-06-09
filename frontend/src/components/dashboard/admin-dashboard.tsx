"use client";

import { Plus, Settings as SettingsIcon, Trash2, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast";
import {
  DashboardGrid,
  Field,
  Panel,
  StatCard,
  Table,
} from "@/components/shared/ui";
import { api } from "@/lib/api";
import type { Settings, User } from "@/lib/types";

export function AdminDashboard({
  token,
  section,
}: {
  token: string;
  section: string;
}) {
  const [staff, setStaff] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [busy, setBusy] = useState("");
  const { showError, showToast } = useToast();

  async function load() {
    const [s, cfg] = await Promise.all([
      api<{ staff: User[] }>("/api/admin/staff", {}, token),
      api<{ settings: Settings }>("/api/admin/settings", {}, token),
    ]);
    setStaff(Array.isArray(s.staff) ? s.staff : []);
    setSettings(cfg.settings || {});
  }

  useEffect(() => {
    load().catch((err) => showError(err, "Could not load admin dashboard"));
  }, [showError]);

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = Object.fromEntries(new FormData(formElement));
    setBusy("staff");
    try {
      await api(
        "/api/admin/staff",
        {
          method: "POST",
          body: JSON.stringify(values),
        },
        token,
      );
      formElement.reset();
      showToast({ kind: "success", title: "Staff user created" });
      await load();
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
      await load();
    } catch (err) {
      showError(err, "Could not save settings");
    } finally {
      setBusy("");
    }
  }

  async function deleteStaff(item: User) {
    if (!confirm(`Delete ${item.name}? This staff login will be removed.`)) {
      return;
    }
    setBusy(item.id);
    try {
      await api(`/api/admin/staff/${item.id}`, { method: "DELETE" }, token);
      showToast({ kind: "success", title: "Staff user deleted" });
      await load();
    } catch (err) {
      showError(err, "Could not delete staff user");
    } finally {
      setBusy("");
    }
  }

  const wardens = staff.filter((item) => item.role === "warden").length;
  const gatekeepers = staff.filter((item) => item.role === "gatekeeper").length;

  if (section === "settings") {
    return (
      <SettingsForm settings={settings} busy={busy} onSave={saveSettings} />
    );
  }

  if (section === "staff") {
    return (
      <DashboardGrid>
        <StaffForm busy={busy} onCreate={createStaff} />
        <StaffTable busy={busy} staff={staff} onDelete={deleteStaff} />
      </DashboardGrid>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total staff" value={staff.length} />
        <StatCard icon={Users} label="Wardens" value={wardens} tone="emerald" />
        <StatCard
          icon={SettingsIcon}
          label="Gatekeepers"
          value={gatekeepers}
          tone="amber"
        />
      </div>
      <DashboardGrid>
        <StaffTable
          busy={busy}
          staff={staff.slice(0, 5)}
          onDelete={deleteStaff}
        />
        <SettingsForm settings={settings} busy={busy} onSave={saveSettings} />
      </DashboardGrid>
    </div>
  );
}

function StaffForm({
  busy,
  onCreate,
}: {
  busy: string;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel title="Create staff" icon={Plus}>
      <form className="grid gap-3" onSubmit={onCreate}>
        <Field name="name" label="Name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="password" label="Password" type="password" required />
        <select name="role" className="field" required>
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
  );
}

function StaffTable({
  busy,
  staff,
  onDelete,
}: {
  busy: string;
  staff: User[];
  onDelete: (item: User) => void;
}) {
  return (
    <Panel title="Staff directory" icon={Users}>
      <Table
        rows={staff}
        empty="No staff yet."
        render={(item) => (
          <tr key={item.id}>
            <td>
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">{item.email}</p>
            </td>
            <td className="capitalize">{item.role}</td>
            <td>{item.isActive === false ? "Inactive" : "Active"}</td>
            <td>
              <button
                className="icon-btn text-rose-600"
                disabled={busy === item.id}
                onClick={() => onDelete(item)}
                title="Delete staff"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </td>
          </tr>
        )}
      />
    </Panel>
  );
}

function SettingsForm({
  settings,
  busy,
  onSave,
}: {
  settings: Settings;
  busy: string;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel title="Hostel timings" icon={SettingsIcon}>
      <form className="grid gap-3" onSubmit={onSave}>
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        <button
          className="primary-btn"
          disabled={busy === "settings"}
          type="submit"
        >
          {busy === "settings" ? "Saving..." : "Save settings"}
        </button>
      </form>
    </Panel>
  );
}
