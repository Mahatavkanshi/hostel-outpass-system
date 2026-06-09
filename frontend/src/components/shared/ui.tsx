import { Clock } from "lucide-react";

export function DashboardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 lg:grid-cols-2">{children}</div>;
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Clock size={16} /> {title}
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
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <tbody className="[&_td]:border-t [&_td]:border-zinc-100 [&_td]:py-2 [&_td]:pr-3">
          {rows.length === 0 ? (
            <tr>
              <td>{empty}</td>
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
    <span className="rounded border border-zinc-200 px-2 py-1 text-xs">
      {children}
    </span>
  );
}
