import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
          >
            <ShieldCheck size={16} /> Hostel Outpass
          </Link>
          <div>
            <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">
              Controlled outpass approvals for students, wardens, and gate
              staff.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Register with face samples, request outpasses, verify hostel
              returns with GPS, and handle late extensions from one system.
            </p>
          </div>
          <svg
            className="h-44 w-full max-w-md"
            viewBox="0 0 520 220"
            role="img"
            aria-label="Hostel dashboard illustration"
          >
            <rect width="520" height="220" rx="18" fill="#0f172a" />
            <rect
              x="26"
              y="28"
              width="132"
              height="164"
              rx="12"
              fill="#0891b2"
            />
            <rect
              x="180"
              y="28"
              width="314"
              height="46"
              rx="12"
              fill="#f8fafc"
            />
            <rect
              x="180"
              y="94"
              width="142"
              height="98"
              rx="12"
              fill="#ecfdf5"
            />
            <rect
              x="342"
              y="94"
              width="152"
              height="98"
              rx="12"
              fill="#fef3c7"
            />
            <circle cx="92" cy="82" r="28" fill="#ffffff" opacity="0.95" />
            <path
              d="M62 142c18-24 42-24 60 0"
              stroke="#fff"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M214 137h70M214 160h48"
              stroke="#059669"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M374 132h82M374 158h48"
              stroke="#d97706"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70">
          {children}
        </div>
      </section>
    </main>
  );
}
