import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <AuthShell>
      <div className="mb-5 flex gap-2 rounded border border-zinc-200 p-1">
        <Link
          href="/login"
          className="flex-1 rounded py-2 text-center text-sm font-medium"
        >
          Login
        </Link>
        <span className="flex-1 rounded bg-zinc-950 py-2 text-center text-sm font-medium text-white">
          Student signup
        </span>
      </div>
      <SignupForm />
    </AuthShell>
  );
}
