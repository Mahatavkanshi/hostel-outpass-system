import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-12">
        <div className="mb-6 inline-flex w-fit items-center gap-2 rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-medium">
          <ShieldCheck size={16} /> Hostel Outpass
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-normal md:text-6xl">
          Manage hostel outpasses, returns, late approvals, and role dashboards.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600">
          Students register with face samples, wardens review requests, gate
          staff manage movement, and admins control hostel timing policies.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="primary-btn" href="/login">
            Login <ArrowRight size={16} />
          </Link>
          <Link className="secondary-btn" href="/signup">
            Student signup
          </Link>
          <Link className="secondary-btn" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
