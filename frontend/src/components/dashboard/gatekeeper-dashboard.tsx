"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionRows } from "@/components/shared/outpass-list";
import { useToast } from "@/components/shared/toast";
import { DashboardGrid, Panel, Table } from "@/components/shared/ui";
import { api } from "@/lib/api";
import type { ExtensionRequest, Outpass } from "@/lib/types";

export function GatekeeperDashboard({ token }: { token: string }) {
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
  }, [showError]);

  async function checkout(id: string) {
    try {
      await api(
        `/api/gatekeeper/outpasses/${id}/checkout`,
        { method: "PUT" },
        token,
      );
      showToast({ kind: "success", title: "Student checked out" });
      load();
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
      load();
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
      load();
    } catch (err) {
      showError(err, "Could not review extension");
    }
  }

  return (
    <DashboardGrid>
      <Panel title="Approved exits">
        <ActionRows rows={exits} action="Checkout" onAction={checkout} />
      </Panel>
      <Panel title="Pending returns">
        <ActionRows rows={returns} action="Returned" onAction={markReturn} />
      </Panel>
      <Panel title="Late extensions">
        <Table
          rows={extensions}
          empty="No pending extensions."
          render={(item) => (
            <tr key={item.id}>
              <td>{item.student.name}</td>
              <td>{item.requestedReturnAt}</td>
              <td className="flex gap-2">
                <button
                  className="icon-btn"
                  onClick={() => reviewExtension(item.id, "approved")}
                  type="button"
                >
                  <Check size={15} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => reviewExtension(item.id, "rejected")}
                  type="button"
                >
                  <X size={15} />
                </button>
              </td>
            </tr>
          )}
        />
      </Panel>
    </DashboardGrid>
  );
}
