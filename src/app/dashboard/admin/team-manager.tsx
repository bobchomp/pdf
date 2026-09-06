"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; name: string; role: string };

export function TeamManager({ users }: { users: User[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, role }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Failed to add teammate.");
      return;
    }
    setEmail("");
    setName("");
    setPassword("");
    router.refresh();
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this teammate's access?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const inputClass =
    "rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
  const cardClass = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight text-navy-900">Team</h1>

      <section className={`${cardClass} p-7`}>
        <h2 className="text-[13px] font-semibold text-gray-700">Add a teammate</h2>
        <form onSubmit={handleAdd} className="mt-3 grid grid-cols-2 gap-3">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Temporary password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className={inputClass}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 rounded-[9px] bg-navy-900 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add teammate"}
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="border-b border-gray-100 px-7 py-4 text-[13px] font-semibold text-gray-700">Everyone with access</h2>
        <ul className="divide-y divide-gray-100">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-7 py-3.5 text-sm">
              <div>
                <p className="font-semibold text-gray-900">{u.name}</p>
                <p className="text-gray-500">
                  {u.email} · {u.role}
                </p>
              </div>
              <button onClick={() => handleRemove(u.id)} className="text-sm font-medium text-gray-400 hover:text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
