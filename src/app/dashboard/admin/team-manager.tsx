"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; name: string; role: string; mustResetPassword: boolean };

export function TeamManager({ users }: { users: User[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "member">("member");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Failed to add teammate.");
      return;
    }
    setEmail("");
    setName("");
    router.refresh();
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this teammate's access?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleResetPassword(u: User) {
    if (!confirm(`Reset ${u.name}'s password to "password"? They'll be asked to choose a new one the next time they sign in.`)) return;
    setResettingId(u.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${u.id}/reset-password`, { method: "POST" });
      if (res.ok) {
        setMessage(`${u.name}'s password was reset to "password".`);
        router.refresh();
      } else {
        setMessage("Failed to reset password.");
      }
    } finally {
      setResettingId(null);
    }
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role as "admin" | "member");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error?.formErrors?.[0] ?? data.error ?? "Failed to save changes.");
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  const inputClass =
    "rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
  const cardClass = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-[28px] font-bold tracking-tight text-navy-900">Team</h1>

      {message && <p className="text-sm font-medium text-green-600">{message}</p>}

      <section className={`${cardClass} p-7`}>
        <h2 className="text-[13px] font-semibold text-gray-700">Add a teammate</h2>
        <p className="mt-1 text-xs text-gray-400">
          Their password will be set to &quot;password&quot; — they&apos;ll be asked to choose their own the first time they sign in.
        </p>
        <form onSubmit={handleAdd} className="mt-3 grid grid-cols-3 gap-3">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className={inputClass}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="col-span-3 rounded-[9px] bg-navy-900 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add teammate"}
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="border-b border-gray-100 px-7 py-4 text-[13px] font-semibold text-gray-700">Everyone with access</h2>
        <ul className="divide-y divide-gray-100">
          {users.map((u) =>
            editingId === u.id ? (
              <li key={u.id} className="px-7 py-3.5 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className={inputClass} />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                    className={inputClass}
                  />
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as "admin" | "member")} className={inputClass}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editError && <p className="mt-2 text-sm text-red-600">{editError}</p>}
                <div className="mt-2.5 flex items-center gap-4">
                  <button
                    onClick={() => handleSaveEdit(u.id)}
                    disabled={savingEdit || !editName.trim() || !editEmail.trim()}
                    className="text-[13px] font-semibold text-blue-600 hover:text-navy-700 disabled:opacity-50"
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                  <button onClick={cancelEdit} className="text-[13px] font-semibold text-gray-400 hover:text-gray-600">
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li key={u.id} className="flex items-center justify-between px-7 py-3.5 text-sm">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    {u.name}
                    {u.mustResetPassword && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        Reset pending
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500">
                    {u.email} · {u.role}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => startEdit(u)} className="text-[13px] font-semibold text-blue-600 hover:text-navy-700">
                    Edit
                  </button>
                  <button
                    onClick={() => handleResetPassword(u)}
                    disabled={resettingId === u.id}
                    className="text-[13px] font-semibold text-blue-600 hover:text-navy-700 disabled:opacity-50"
                  >
                    Reset password
                  </button>
                  <button onClick={() => handleRemove(u.id)} className="text-sm font-medium text-gray-400 hover:text-red-600">
                    Remove
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      </section>
    </div>
  );
}
