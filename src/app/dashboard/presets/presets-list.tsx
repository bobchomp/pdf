"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Preset = { id: string; name: string; isDefault: boolean };

export function PresetsList({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(preset: Preset) {
    if (!confirm(`Delete the "${preset.name}" preset? This cannot be undone.`)) return;
    setDeletingId(preset.id);
    const res = await fetch(`/api/presets/${preset.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
  }

  if (presets.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-400 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        No presets yet. Create one to reuse a set of settings across newsletters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
      <ul className="divide-y divide-gray-100">
        {presets.map((preset) => (
          <li key={preset.id} className="flex items-center justify-between px-7 py-4">
            <Link href={`/dashboard/presets/${preset.id}`} className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 hover:text-navy-900">
              {preset.name}
              {preset.isDefault && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">Default</span>
              )}
            </Link>
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/presets/${preset.id}`} className="text-[13px] font-semibold text-blue-600 hover:text-navy-700">
                Edit
              </Link>
              <button
                onClick={() => handleDelete(preset)}
                disabled={deletingId === preset.id}
                className="text-[13px] font-semibold text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
