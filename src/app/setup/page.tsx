"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

type Status = "checking" | "needs-setup" | "already-done" | "check-failed";

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || typeof data.needsSetup !== "boolean") {
          setCheckError(
            (data && data.error) || `Server returned ${res.status}. Check your Cloudflare env vars and that you've run "npm run db:push".`
          );
          setStatus("check-failed");
          return;
        }
        setStatus(data.needsSetup ? "needs-setup" : "already-done");
      })
      .catch((err) => {
        setCheckError(err instanceof Error ? err.message : "Network error reaching /api/setup.");
        setStatus("check-failed");
      });
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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white p-11 shadow-[0_20px_40px_-12px_rgba(15,32,68,0.14),0_4px_12px_rgba(15,32,68,0.06)]">
        <Logo />

        <div className="mt-7">
          {status === "checking" ? (
            <p className="text-sm text-gray-400">Checking…</p>
          ) : done ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">You&apos;re all set</h1>
              <p className="mt-2 text-sm text-gray-600">Redirecting you to sign in…</p>
            </>
          ) : status === "check-failed" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">Couldn&apos;t check setup status</h1>
              <p className="mt-2 text-sm text-red-600">{checkError}</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                This usually means the app can&apos;t reach Cloudflare D1 yet — double check
                <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">CLOUDFLARE_ACCOUNT_ID</code>,
                <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">CLOUDFLARE_D1_DATABASE_ID</code> and
                <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">CLOUDFLARE_D1_API_TOKEN</code>
                are set correctly in Vercel, and that <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">npm run db:push</code>{" "}
                has been run against that database.
              </p>
            </>
          ) : status === "already-done" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">Setup already complete</h1>
              <p className="mt-2 text-sm text-gray-600">
                An admin account already exists.{" "}
                <a href="/login" className="font-medium text-blue-600 hover:text-navy-700">
                  Go to sign in
                </a>
                .
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">Create your admin account</h1>
              <p className="mt-1.5 text-sm text-gray-600">
                This page only works once, before any account exists. Once you create your login here, it&apos;ll
                redirect to sign-in and won&apos;t let anyone create another account this way.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={inputClass}
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-[10px] bg-navy-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
                >
                  {submitting ? "Creating…" : "Create admin account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
