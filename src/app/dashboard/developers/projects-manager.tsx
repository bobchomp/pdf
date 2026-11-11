"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Project = { id: string; name: string; allowedOrigins: string[]; status: "active" | "disabled"; activeKeyCount: number };

const inputClass =
  "w-full rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
const cardClass = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]";

export function ProjectsManager({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [origins, setOrigins] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/developer/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, allowedOrigins: origins.split(/[\n,]+/) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create project.");
        return;
      }
      router.push(`/dashboard/developers/${data.project.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-navy-900">Developers</h1>
        <p className="mt-1 text-sm text-gray-600">
          Projects are your other websites and apps that use this flipbook viewer. Each gets its own API keys and a list of
          websites it&apos;s allowed to appear on.{" "}
          <a href="/docs" className="font-semibold text-blue-600 hover:text-navy-700">
            API docs →
          </a>
        </p>
      </div>

      <section className={`${cardClass} p-7`}>
        <h2 className="text-[13px] font-semibold text-gray-700">Add a project</h2>
        <form onSubmit={handleCreate} className="mt-3 space-y-3">
          <input placeholder="Project name, e.g. Highland Youth site" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} />
          <div>
            <textarea
              placeholder={"Websites it may appear on, one per line\ne.g. https://example.com"}
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              rows={3}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">You can add or change these later.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full rounded-[9px] bg-navy-900 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create project"}
          </button>
        </form>
      </section>

      {projects.length === 0 ? (
        <div className={`${cardClass} p-10 text-center text-sm text-gray-400`}>No projects yet.</div>
      ) : (
        <section className={`${cardClass} overflow-hidden`}>
          <ul className="divide-y divide-gray-100">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/developers/${p.id}`} className="flex items-center justify-between gap-4 px-7 py-4 transition-colors hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      {p.name}
                      {p.status === "disabled" && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">Disabled</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {p.allowedOrigins.length === 0 ? "No websites added yet" : p.allowedOrigins.join(", ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {p.activeKeyCount} active key{p.activeKeyCount === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
