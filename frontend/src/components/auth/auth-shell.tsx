import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
          >
            <ShieldCheck size={16} /> Hostel Outpass
          </Link>
          <div>
            <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">
              Controlled outpass approvals for students, wardens, and gate
              staff.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
              Register with face samples, request outpasses, verify hostel
              returns with GPS, and handle late extensions from one system.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          {children}
        </div>
      </section>
    </main>
  );
}
