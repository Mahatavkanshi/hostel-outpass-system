"use client";

import { Bell, Check, ClipboardCheck, DoorOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionRows } from "@/components/shared/outpass-list";
import { useToast } from "@/components/shared/toast";
import { DashboardGrid, Panel, StatCard, Table } from "@/components/shared/ui";
import { api } from "@/lib/api";
import type { ExtensionRequest, Outpass } from "@/lib/types";

export function GatekeeperDashboard({
  token,
  section,
}: {
  token: string;
  section: string;
}) {
  const [exits, setExits] = useState<Outpass[]>([]);
  const [returns, setReturns] = useState<Outpass[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRequest[]>([]);
  const { showError, showToast } = useToast();

  async function load() {
    const [e, r, x] = await Promise.all([
      api<{ outpasses: Outpass[] }>("/api/gatekeeper/exits", {}, token),
      api<{ outpasses: Outpass[] }>("/api/gatekeeper/returns", {}, token),
      api<{ extensions: ExtensionRequest[] }>(
        "/api/gatekeeper/extensions",
        {},
        token,
      ),
    ]);
    setExits(e.outpasses || []);
    setReturns(r.outpasses || []);
    setExtensions(x.extensions || []);
  }

  useEffect(() => {
    load().catch((err) => showError(err, "Could not load gate dashboard"));
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [token, showError]);

  async function checkout(id: string) {
    try {
      await api(
        `/api/gatekeeper/outpasses/${id}/checkout`,
        { method: "PUT" },
        token,
      );
      showToast({ kind: "success", title: "Student checked out" });
      await load();
    } catch (err) {
      showError(err, "Could not check out student");
    }
  }

  async function markReturn(id: string) {
    try {
      await api(
        `/api/gatekeeper/outpasses/${id}/return`,
        { method: "PUT" },
        token,
      );
      showToast({ kind: "success", title: "Student marked returned" });
      await load();
    } catch (err) {
      showError(err, "Could not mark return");
    }
  }

  async function reviewExtension(id: string, status: string) {
    try {
      await api(
        `/api/gatekeeper/extensions/${id}`,
        { method: "PUT", body: JSON.stringify({ status }) },
        token,
      );
      showToast({ kind: "success", title: `Extension ${status}` });
      await load();
    } catch (err) {
      showError(err, "Could not review extension");
    }
  }

  if (section === "exits") {
    return (
      <Panel title="Approved exits" icon={DoorOpen}>
        <ActionRows rows={exits} action="Checkout" onAction={checkout} />
      </Panel>
    );
  }

  if (section === "returns") {
    return (
      <Panel title="Pending returns" icon={ClipboardCheck}>
        <ActionRows rows={returns} action="Returned" onAction={markReturn} />
      </Panel>
    );
  }

  if (section === "extensions") {
    return (
      <ExtensionsPanel extensions={extensions} onReview={reviewExtension} />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={DoorOpen} label="Ready exits" value={exits.length} />
        <StatCard
          icon={ClipboardCheck}
          label="Pending returns"
          value={returns.length}
          tone="emerald"
        />
        <StatCard
          icon={Bell}
          label="Extensions"
          value={extensions.length}
          tone="amber"
        />
      </div>
      <DashboardGrid>
        <Panel title="Approved exits" icon={DoorOpen}>
          <ActionRows
            rows={exits.slice(0, 5)}
            action="Checkout"
            onAction={checkout}
          />
        </Panel>
        <Panel title="Pending returns" icon={ClipboardCheck}>
          <ActionRows
            rows={returns.slice(0, 5)}
            action="Returned"
            onAction={markReturn}
          />
        </Panel>
        <ExtensionsPanel
          extensions={extensions.slice(0, 5)}
          onReview={reviewExtension}
        />
      </DashboardGrid>
    </div>
  );
}

function ExtensionsPanel({
  extensions,
  onReview,
}: {
  extensions: ExtensionRequest[];
  onReview: (id: string, status: string) => void;
}) {
  return (
    <Panel title="Late extensions" icon={Bell}>
      <Table
        rows={extensions}
        empty="No pending extensions."
        render={(item) => (
          <tr key={item.id}>
            <td>{item.student.name}</td>
            <td>{new Date(item.requestedReturnAt).toLocaleString()}</td>
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
