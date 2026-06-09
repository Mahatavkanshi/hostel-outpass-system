import { Bell } from "lucide-react";
import type { Notification } from "@/lib/types";
import { Panel } from "./ui";

export function Notifications({ notes }: { notes: Notification[] }) {
  return (
    <Panel title="Notifications">
      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="text-sm text-zinc-500">No notifications.</p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded border border-zinc-200 p-3 text-sm"
          >
            <div className="flex items-center gap-2 font-medium">
              <Bell size={14} /> {note.title}
            </div>
            <p className="mt-1 text-zinc-600">{note.body}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
