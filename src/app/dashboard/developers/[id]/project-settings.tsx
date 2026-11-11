"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/Switch";
import type { ProjectDefaultSettings } from "@/lib/viewer-settings";
import { DefaultSettings } from "./default-settings";

const noopSubscribe = () => () => {};

type Project = {
  id: string;
  name: string;
  allowedOrigins: string[];
  status: "active" | "disabled";
  defaultSettings: ProjectDefaultSettings;
};
type Key = { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null; revoked: boolean };

const inputClass =
  "w-full rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
const cardClass = "rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]";
const primaryButtonClass =
  "rounded-[9px] bg-navy-900 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50";
const preClass = "mt-3 overflow-x-auto rounded-[9px] bg-gray-50 px-4 py-3 font-mono text-[12.5px] text-gray-800";
const outlineButtonClass =
  "rounded-[9px] border border-gray-300 px-4 py-2.5 text-[13.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50";

export function ProjectSettings({ project, keys }: { project: Project; keys: Key[] }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [origins, setOrigins] = useState(project.allowedOrigins.join("\n"));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // The server has no window; it renders a placeholder and the browser fills in its own address after hydrating.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "https://your-site");

  const originsChanged = origins.trim() !== project.allowedOrigins.join("\n");
  const detailsChanged = name.trim() !== project.name || originsChanged;

  async function patch(body: Record<string, unknown>, success: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/developer/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Failed to save.", error: true });
        return;
      }
      // Show the addresses as the server normalized them (e.g. "example.com" → "https://example.com").
      setOrigins(data.project.allowedOrigins.join("\n"));
      setMessage({ text: success, error: false });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreatingKey(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/developer/projects/${project.id}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Failed to create key.", error: true });
        return;
      }
      setNewKey({ name: data.key.name, key: data.key.key });
      setCopied(false);
      setKeyName("");
      router.refresh();
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevoke(key: Key) {
    if (!confirm(`Revoke "${key.name || key.keyPrefix}"? Anything using it will stop working immediately. This can't be undone.`)) return;
    const res = await fetch(`/api/developer/projects/${project.id}/keys/${key.id}`, { method: "DELETE" });
    if (res.ok) {
      setMessage({ text: "Key revoked.", error: false });
      router.refresh();
    } else {
      setMessage({ text: "Failed to revoke key.", error: true });
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the project "${project.name}" with its keys, documents and stats? Anything using them will stop working. This can't be undone.`)) return;
    const res = await fetch(`/api/developer/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/developers");
    else setMessage({ text: "Failed to delete project.", error: true });
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.key);
    setCopied(true);
  }

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/dashboard/developers" className="text-[13px] font-semibold text-blue-600 hover:text-navy-700">
          ← Developers
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-[26px] font-bold tracking-tight text-navy-900">
          {project.name}
          {project.status === "disabled" && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">Disabled</span>
          )}
        </h1>
      </div>

      {message && <p className={`text-sm font-medium ${message.error ? "text-red-600" : "text-green-600"}`}>{message.text}</p>}

      {newKey && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-[15px] font-semibold text-navy-900">Your new key{newKey.name ? `: ${newKey.name}` : ""}</h2>
          <p className="mt-1 text-sm text-amber-800">
            Copy it now and store it somewhere safe, e.g. your project&apos;s server environment variables. It won&apos;t be
            shown again. Never put it in browser-side code.
          </p>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[9px] border border-amber-200 bg-white px-3.5 py-2.5 font-mono text-[13px] text-gray-900">
              {newKey.key}
            </code>
            <button onClick={copyKey} className={`${outlineButtonClass} h-fit bg-white`}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 text-[13px] font-semibold text-amber-800 hover:text-amber-900">
            I&apos;ve saved it
          </button>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Details</h2>
        <div className="mt-4 space-y-3.5">
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Project name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={`mt-1.5 ${inputClass}`} />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Websites it may appear on</label>
            <textarea
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              rows={4}
              placeholder={"https://example.com\nhttps://*.example.com\nhttp://localhost:3000"}
              className={`mt-1.5 font-mono text-[13px] ${inputClass}`}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
              One per line. The flipbook viewer will only display on these websites. Use <code>https://*.example.com</code> to
              include every subdomain, and <code>http://localhost:3000</code> while developing.
            </p>
          </div>
          <button
            onClick={() => patch({ name, allowedOrigins: origins.split(/[\n,]+/) }, "Saved.")}
            disabled={saving || !detailsChanged || !name.trim()}
            className={primaryButtonClass}
          >
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-navy-900">Project enabled</h2>
            <p className="mt-1 text-xs text-gray-400">Turning this off stops every one of this project&apos;s keys working until you turn it back on.</p>
          </div>
          <Switch
            checked={project.status === "active"}
            disabled={saving}
            onChange={(on) => patch({ status: on ? "active" : "disabled" }, on ? "Project enabled." : "Project disabled.")}
            label="Project enabled"
          />
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">API keys</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Secret keys your project&apos;s server uses to talk to this app. Create one per environment (e.g. production and
          development) so you can revoke one without affecting the other.
        </p>

        <form onSubmit={handleCreateKey} className="mt-4 flex gap-2">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name, e.g. Production server"
            maxLength={100}
            className={inputClass}
          />
          <button type="submit" disabled={creatingKey} className={`${primaryButtonClass} shrink-0`}>
            {creatingKey ? "Creating…" : "Create key"}
          </button>
        </form>

        {activeKeys.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No active keys.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
            {activeKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{k.name || "Unnamed key"}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    <code className="font-mono">{k.keyPrefix}…</code> · Created {k.createdAt} · {k.lastUsedAt ? `Last used ${k.lastUsedAt}` : "Never used"}
                  </p>
                </div>
                <button onClick={() => handleRevoke(k)} className="shrink-0 text-[13px] font-semibold text-gray-400 hover:text-red-600">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}

        {revokedKeys.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              {revokedKeys.length} revoked key{revokedKeys.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {revokedKeys.map((k) => (
                <li key={k.id} className="text-xs text-gray-400">
                  {k.name || "Unnamed key"} · <code className="font-mono">{k.keyPrefix}…</code> · Created {k.createdAt}
                  {k.lastUsedAt ? ` · Last used ${k.lastUsedAt}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Display settings</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          How this project&apos;s documents look by default. Your project can override any of these for a single document
          when it asks for a viewer link.
        </p>
        <DefaultSettings projectId={project.id} defaults={project.defaultSettings} />
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Try it</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Run these from a terminal or your project&apos;s server. The first checks your key; the second gets a viewer link for a
          PDF.
        </p>
        <pre className={preClass}>{`curl ${origin}/api/v1/project \\\n  -H "Authorization: Bearer YOUR_KEY"`}</pre>
        <pre className={preClass}>
          {`curl -X POST ${origin}/api/v1/viewer-tokens \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"document": {"id": "spring-2026", "title": "Spring newsletter", "url": "https://files.example.com/spring.pdf"}}'`}
        </pre>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          Put the <code className="font-mono">url</code> it returns in an iframe on one of this project&apos;s websites:
        </p>
        <pre className={preClass}>{`<iframe src="VIEWER_URL" allow="fullscreen"\n  style="width: 100%; height: 720px; border: 0"></iframe>`}</pre>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          The PDF stays in your project&apos;s own storage, but the viewer loads it from this site, so that storage must allow{" "}
          <code className="font-mono">{origin}</code> to fetch it (a CORS rule allowing GET from this origin). Links last a day
          by default; set <code className="font-mono">expiresIn</code> (in seconds, up to 30 days) to change that.
        </p>
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Delete project</h2>
        <p className="mt-1 text-xs text-gray-400">Permanently removes this project, its keys, and the documents and stats recorded for it.</p>
        <button
          onClick={handleDelete}
          className="mt-4 rounded-[9px] border border-red-200 px-4 py-2.5 text-[13.5px] font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          Delete project
        </button>
      </section>
    </div>
  );
}
