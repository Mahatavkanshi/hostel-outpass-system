import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="mb-5 flex gap-2 rounded border border-zinc-200 p-1">
        <span className="flex-1 rounded bg-zinc-950 py-2 text-center text-sm font-medium text-white">
          Login
        </span>
        <Link
          href="/signup"
          className="flex-1 rounded py-2 text-center text-sm font-medium"
        >
          Student signup
        </Link>
      </div>
      <LoginForm />
    </AuthShell>
  );
}
