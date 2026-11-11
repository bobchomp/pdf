"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type WebhookInfo = {
  url: string | null;
  secret: string | null;
  failures: number;
  nextAttemptAt: string | null;
  undelivered: number;
  deliveries: Array<{
    id: string;
    attemptedAt: string;
    eventCount: number;
    isTest: boolean;
    success: boolean;
    statusCode: number | null;
    error: string | null;
    durationMs: number;
  }>;
};

const inputClass =
  "w-full rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
const primaryButtonClass =
  "shrink-0 rounded-[9px] bg-navy-900 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50";
const outlineButtonClass =
  "rounded-[9px] border border-gray-300 px-4 py-2 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50";

export function WebhookSettings({ projectId, webhook }: { projectId: string; webhook: WebhookInfo }) {
  const router = useRouter();
  const [url, setUrl] = useState(webhook.url ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const base = `/api/developer/projects/${projectId}/webhook`;

  async function call(action: string, path: string, method: string, body?: unknown) {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      router.refresh();
      return { ok: res.ok, data };
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { ok, data } = await call("save", base, "PUT", { url });
    setMessage(ok ? { text: webhook.url ? "Saved." : "Webhook turned on.", error: false } : { text: data.error ?? "Failed to save.", error: true });
  }

  async function remove() {
    if (!confirm("Stop sending stats to this address? Its signing secret will be deleted.")) return;
    const { ok } = await call("remove", base, "DELETE");
    if (ok) setUrl("");
    setMessage(ok ? { text: "Webhook turned off.", error: false } : { text: "Failed to turn off.", error: true });
  }

  async function test() {
    const { data } = await call("test", `${base}/test`, "POST");
    setMessage(
      data.success
        ? { text: `Test delivered — your endpoint replied HTTP ${data.statusCode}.`, error: false }
        : { text: `Test failed: ${data.error ?? "unknown error"}.`, error: true }
    );
  }

  async function retry() {
    const { ok, data } = await call("retry", `${base}/retry`, "POST");
    if (!ok) setMessage({ text: data.error ?? "Retry failed.", error: true });
    else setMessage({ text: data.delivered > 0 ? `Delivered ${data.delivered} event${data.delivered === 1 ? "" : "s"}.` : "Couldn't deliver — see the latest attempt below.", error: data.delivered === 0 });
  }

  async function rotate() {
    if (!confirm("Create a new signing secret? Deliveries are signed with the new one straight away, so update your project's server first or checks will fail.")) return;
    const { ok } = await call("rotate", `${base}/secret`, "POST");
    setShowSecret(true);
    setMessage(ok ? { text: "New secret created.", error: false } : { text: "Failed to create a new secret.", error: true });
  }

  async function copySecret() {
    if (!webhook.secret) return;
    await navigator.clipboard.writeText(webhook.secret);
    setCopied(true);
  }

  const status =
    !webhook.url ? null : webhook.failures > 0 ? (
      <span className="text-red-600">
        Failing ({webhook.failures} attempt{webhook.failures === 1 ? "" : "s"} in a row) · {webhook.undelivered > 1000 ? "1000+" : webhook.undelivered} event
        {webhook.undelivered === 1 ? "" : "s"} waiting{webhook.nextAttemptAt ? ` · next retry from ${webhook.nextAttemptAt}` : ""}
      </span>
    ) : webhook.undelivered > 0 ? (
      <span className="text-amber-700">
        {webhook.undelivered} event{webhook.undelivered === 1 ? "" : "s"} waiting to send
      </span>
    ) : (
      <span className="text-green-600">Up to date — every event delivered</span>
    );

  return (
    <div className="mt-4 space-y-4 text-sm">
      <form onSubmit={save} className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-site.com/api/flipbook-webhook" className={inputClass} />
        <button type="submit" disabled={busy !== null || !url.trim() || url.trim() === webhook.url} className={primaryButtonClass}>
          {busy === "save" ? "Saving…" : webhook.url ? "Save" : "Turn on"}
        </button>
      </form>

      {message && <p className={`font-medium ${message.error ? "text-red-600" : "text-green-600"}`}>{message.text}</p>}

      {webhook.url && webhook.secret && (
        <>
          <p className="text-xs font-medium">{status}</p>

          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Signing secret</label>
            <div className="mt-1.5 flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[9px] border border-gray-200 bg-gray-50 px-3.5 py-2.5 font-mono text-[13px] text-gray-800">
                {showSecret ? webhook.secret : `${webhook.secret.slice(0, 9)}${"•".repeat(24)}`}
              </code>
              <button type="button" onClick={() => setShowSecret((s) => !s)} className={outlineButtonClass}>
                {showSecret ? "Hide" : "Show"}
              </button>
              <button type="button" onClick={copySecret} className={outlineButtonClass}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
              Each delivery has a <code className="font-mono">Flipbook-Signature: t=…,v1=…</code> header: an HMAC-SHA256 of{" "}
              <code className="font-mono">{"<t>.<raw body>"}</code> using this secret. Check it before trusting a delivery.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={test} disabled={busy !== null} className={outlineButtonClass}>
              {busy === "test" ? "Sending…" : "Send test event"}
            </button>
            {webhook.undelivered > 0 && (
              <button type="button" onClick={retry} disabled={busy !== null} className={outlineButtonClass}>
                {busy === "retry" ? "Sending…" : "Retry now"}
              </button>
            )}
            <button type="button" onClick={rotate} disabled={busy !== null} className={outlineButtonClass}>
              New secret
            </button>
            <button type="button" onClick={remove} disabled={busy !== null} className="px-2 text-[13px] font-semibold text-gray-400 hover:text-red-600">
              Turn off
            </button>
          </div>

          <div>
            <h3 className="text-[12.5px] font-semibold text-gray-400">Recent deliveries</h3>
            {webhook.deliveries.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">None yet — events are sent as soon as people view this project&apos;s documents.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 border-y border-gray-100">
                {webhook.deliveries.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${d.success ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="text-gray-700">{d.attemptedAt}</span>
                      <span className="text-gray-400">{d.isTest ? "Test event" : `${d.eventCount} event${d.eventCount === 1 ? "" : "s"}`}</span>
                    </span>
                    <span className={d.success ? "text-gray-500" : "text-red-600"}>
                      {d.success ? `HTTP ${d.statusCode}` : d.error} · {d.durationMs} ms
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
