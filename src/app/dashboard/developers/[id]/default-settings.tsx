"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/Switch";
import { BACKGROUND_POSITIONS } from "@/lib/background-position";
import { BUILT_IN_SETTINGS, type ProjectDefaultSettings } from "@/lib/viewer-settings";

type Form = Required<ProjectDefaultSettings>;

const inputClass =
  "w-full rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
const colorClass = "h-8 w-11 cursor-pointer rounded-[8px] border border-gray-200";

const toggles: Array<{ key: keyof Form; label: string }> = [
  { key: "showHeader", label: "Show the header bar" },
  { key: "showTitle", label: "Show the document title in the header" },
  { key: "showPrint", label: "Print button" },
  { key: "showDownload", label: "Download button" },
  { key: "showFullscreen", label: "Full screen button" },
  { key: "showPageArrows", label: "Page arrows beside the document" },
  { key: "enableZoom", label: "Click a page to zoom in" },
];

/** The project's default display settings — what every viewer token starts from unless it says otherwise. */
export function DefaultSettings({ projectId, defaults }: { projectId: string; defaults: ProjectDefaultSettings }) {
  const router = useRouter();
  const initial = (): Form => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { startPage, ...builtIn } = BUILT_IN_SETTINGS;
    return { ...builtIn, ...defaults };
  };
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const defaultSettings = {
        ...form,
        backgroundImageUrl: form.backgroundImageUrl?.trim() || null,
        logoUrl: form.logoUrl?.trim() || null,
        logoLinkUrl: form.logoLinkUrl?.trim() || null,
      };
      const res = await fetch(`/api/developer/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultSettings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Failed to save.", error: true });
        return;
      }
      setMessage({ text: "Saved.", error: false });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-900">Background colour</span>
        <input type="color" value={form.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className={colorClass} aria-label="Background colour" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-gray-900">Header colour</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={form.headerColor === null} onChange={(e) => set("headerColor", e.target.checked ? null : form.backgroundColor)} />
            Same as background
          </label>
          {form.headerColor !== null && (
            <input type="color" value={form.headerColor} onChange={(e) => set("headerColor", e.target.value)} className={colorClass} aria-label="Header colour" />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-900">Header text colour</span>
        <input type="color" value={form.headerTextColor} onChange={(e) => set("headerTextColor", e.target.value)} className={colorClass} aria-label="Header text colour" />
      </div>

      <div className="h-px bg-gray-100" />

      {toggles.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-gray-900">{label}</span>
          <Switch checked={form[key] as boolean} onChange={(v) => set(key, v)} label={label} />
        </div>
      ))}

      <div className="h-px bg-gray-100" />

      <div>
        <label className="text-[12.5px] font-semibold text-gray-400">Background image address</label>
        <input value={form.backgroundImageUrl ?? ""} onChange={(e) => set("backgroundImageUrl", e.target.value)} placeholder="https://… (optional)" className={`mt-1.5 ${inputClass}`} />
      </div>
      {form.backgroundImageUrl?.trim() && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[12.5px] font-semibold text-gray-400">Image size</label>
            <select value={form.backgroundFit} onChange={(e) => set("backgroundFit", e.target.value as Form["backgroundFit"])} className={`mt-1.5 ${inputClass}`}>
              <option value="contain">Fit (whole image)</option>
              <option value="cover">Fill (crop to fit)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[12.5px] font-semibold text-gray-400">Image position</label>
            <select value={form.backgroundPosition} onChange={(e) => set("backgroundPosition", e.target.value as Form["backgroundPosition"])} className={`mt-1.5 ${inputClass}`}>
              {BACKGROUND_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div>
        <label className="text-[12.5px] font-semibold text-gray-400">Logo image address</label>
        <input value={form.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://… (optional)" className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label className="text-[12.5px] font-semibold text-gray-400">Logo links to</label>
        <input value={form.logoLinkUrl ?? ""} onChange={(e) => set("logoLinkUrl", e.target.value)} placeholder="https://… (optional)" className={`mt-1.5 ${inputClass}`} />
      </div>

      {message && <p className={`font-medium ${message.error ? "text-red-600" : "text-green-600"}`}>{message.text}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-[9px] bg-navy-900 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save display settings"}
      </button>
    </div>
  );
}
