"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../../lib/auth/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@signal.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await login(email, password);
          router.push("/discover");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Login failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Use your workspace credentials.</p>
      <label className="mt-4 block text-xs font-medium text-slate-600">
        Email
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-600">
        Password
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded bg-teal-800 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
