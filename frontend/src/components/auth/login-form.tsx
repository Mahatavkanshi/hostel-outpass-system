"use client";

import { UserCheck } from "lucide-react";
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field name="email" label="Email" type="email" />
      <Field name="password" label="Password" type="password" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="primary-btn w-full" type="submit">
        <UserCheck size={16} /> Login
      </button>
      <p className="text-xs text-zinc-500">
        Default admin: admin@hostel.local / admin123
      </p>
    </form>
  );
}
