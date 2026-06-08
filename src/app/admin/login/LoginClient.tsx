"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button, Card, PageShell } from "@/components/ui";

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    setLoading(false);
    if (!response.ok) {
      setError(payload.error || "Login gagal.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <PageShell className="flex items-center">
      <Card className="mx-auto w-full max-w-md">
        <div className="mb-6">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-primary-700">
            <LogIn className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Login Admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            Gunakan email dan password yang disimpan di environment aplikasi.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-primary-700 focus:ring-2 focus:ring-blue-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-primary-700 focus:ring-2 focus:ring-blue-100"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            <LogIn className="h-5 w-5" aria-hidden="true" />
            {loading ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
