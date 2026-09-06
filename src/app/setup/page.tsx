"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((res) => res.json())
      .then((data) => {
        setNeedsSetup(!!data.needsSetup);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Something went wrong.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        {checking ? (
          <p className="text-sm text-slate-400">Checking…</p>
        ) : done ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">You&apos;re all set</h1>
            <p className="mt-2 text-sm text-slate-500">Redirecting you to sign in…</p>
          </>
        ) : !needsSetup ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Setup already complete</h1>
            <p className="mt-2 text-sm text-slate-500">
              An admin account already exists.{" "}
              <a href="/login" className="underline">
                Go to sign in
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Create your admin account</h1>
            <p className="mt-1 text-sm text-slate-500">
              This page only works once, before any account exists. Once you create your login here, it&apos;ll
              redirect to sign-in and won&apos;t let anyone create another account this way.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create admin account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
