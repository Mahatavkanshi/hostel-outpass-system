"use client";

import { Eye, EyeOff, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useToast } from "@/components/shared/toast";
import { Field } from "@/components/shared/ui";
import { api, saveSession } from "@/lib/api";
import type { User } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();
  const { showError, showToast } = useToast();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      saveSession(data.token, data.user);
      showToast({
        kind: "success",
        title: "Logged in",
        body: `Welcome ${data.user.name}`,
      });
      router.push(`/dashboard/${data.user.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      showError(err, "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field name="email" label="Email" type="email" />
      <label className="grid gap-1 text-sm font-medium">
        Password
        <span className="relative">
          <input
            className="field pr-12"
            name="password"
            type={showPassword ? "text" : "password"}
          />
          <button
            className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => setShowPassword((value) => !value)}
            title={showPassword ? "Hide password" : "Show password"}
            type="button"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>
      {error && (
        <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button className="primary-btn w-full" disabled={busy} type="submit">
        <UserCheck size={16} /> {busy ? "Logging in..." : "Login"}
      </button>
      <p className="text-xs text-slate-500">
        Default admin: admin@hostel.local / admin123
      </p>
    </form>
  );
}
