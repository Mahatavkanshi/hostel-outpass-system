import type { LucideIcon } from "lucide-react";
import { Clock, Inbox } from "lucide-react";

export function DashboardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
}

export function Panel({
  title,
  children,
  icon: Icon = Clock,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 ${className}`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-950">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
          <Icon size={16} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input className="field" {...rest} />
    </label>
  );
}

export function Table<T>({
  rows,
  render,
  empty,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
  empty: string;
}) {
  return (
    <div className="overflow-auto rounded-md border border-slate-100">
      <table className="w-full text-left text-sm">
        <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-2.5">
          {rows.length === 0 ? (
            <tr>
              <td className="text-slate-500">{empty}</td>
            </tr>
          ) : (
            rows.map(render)
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone = "cyan",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";
  icon: LucideIcon;
}) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium opacity-85">{label}</p>
        <Icon size={18} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
        <Inbox size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
    </div>
  );
}
