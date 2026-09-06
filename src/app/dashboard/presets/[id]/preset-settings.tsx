"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BACKGROUND_POSITIONS } from "@/lib/background-position";
import { Switch } from "@/components/Switch";
import { IconImage, IconLock } from "@/components/icons";

const inputClass =
  "rounded-[9px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
const outlineButtonClass =
  "rounded-[9px] border border-gray-300 px-4 py-2.5 text-[13.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50";
const primaryButtonClass =
  "rounded-[9px] bg-navy-900 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50";

type Preset = {
  id: string;
  name: string;
  isDefault: boolean;
  isPrivate: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  themeColor: string;
  showToolbar: boolean;
  backgroundImageR2Key: string | null;
  backgroundFit: "contain" | "cover";
  backgroundPosition: string;
  logoR2Key: string | null;
  logoLinkUrl: string | null;
};

type ImageField = "backgroundImageR2Key" | "logoR2Key";

export function PresetSettings({
  preset: initial,
  initialBackgroundImageUrl,
  initialLogoUrl,
}: {
  preset: Preset;
  initialBackgroundImageUrl: string | null;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState(initial);
  const [nameDraft, setNameDraft] = useState(initial.name);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(initialBackgroundImageUrl);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoLinkDraft, setLogoLinkDraft] = useState(initial.logoLinkUrl ?? "");

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/presets/${preset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setPreset((prev) => ({ ...prev, ...data.preset }));
        setMessage("Saved.");
      } else {
        setMessage(data.error?.formErrors?.[0] ?? data.error ?? "Failed to save.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${preset.name}" preset? This cannot be undone.`)) return;
    const res = await fetch(`/api/presets/${preset.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/presets");
  }

  async function uploadImage(
    file: File,
    field: ImageField,
    uploadUrlEndpoint: string,
    setPreviewUrl: (url: string | null) => void,
    setUploading: (v: boolean) => void,
    label: string
  ) {
    setUploading(true);
    setMessage(null);
    try {
      const presignRes = await fetch(uploadUrlEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "image/jpeg" }),
      });
      const { uploadUrl, key } = await presignRes.json();

      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/jpeg" }, body: file });
      if (!putRes.ok) throw new Error(`Failed to upload ${label}.`);

      const res = await fetch(`/api/presets/${preset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to save ${label}.`);

      setPreset((prev) => ({ ...prev, ...data.preset }));
      setPreviewUrl(URL.createObjectURL(file));
      setMessage(`${label} updated.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Failed to upload ${label}.`);
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(field: ImageField, setPreviewUrl: (url: string | null) => void, label: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/presets/${preset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: null }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreset((prev) => ({ ...prev, ...data.preset }));
        setPreviewUrl(null);
        setMessage(`${label} removed.`);
      } else {
        setMessage(data.error ?? `Failed to remove ${label}.`);
      }
    } finally {
      setSaving(false);
    }
  }

  function saveLogoLink() {
    const trimmed = logoLinkDraft.trim();
    const normalized = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
    setLogoLinkDraft(normalized);
    patch({ logoLinkUrl: normalized || null });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-navy-900">{preset.name}</h1>
          {preset.isDefault && <p className="mt-1 text-[13.5px] text-gray-400">Default preset for new newsletters</p>}
        </div>
        <button
          onClick={handleDelete}
          className="rounded-[9px] border border-red-200 px-4 py-2.5 text-[13.5px] font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      {message && <p className="text-sm font-medium text-green-600">{message}</p>}

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">General</h2>
        <div className="mt-4 space-y-3.5">
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Name</label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className={`mt-1.5 w-full ${inputClass}`}
            />
          </div>
          <button
            onClick={() => patch({ name: nameDraft })}
            disabled={saving || nameDraft === preset.name || !nameDraft.trim()}
            className={primaryButtonClass}
          >
            Save name
          </button>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-900">Set as default</span>
              <p className="text-xs text-gray-400">New newsletters automatically start with this preset.</p>
            </div>
            <Switch checked={preset.isDefault} onChange={(v) => patch({ isDefault: v })} label="Set as default" disabled={preset.isDefault} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Privacy</h2>
        <p className="mt-1 text-xs text-gray-400">
          Newsletters that use this preset will require this password. You can still remove or change it per newsletter afterward.
        </p>
        <div className="mt-4 space-y-3">
          {preset.isPrivate ? (
            <div className="flex items-center justify-between rounded-[9px] bg-gray-50 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-gray-900">
                <IconLock size={13} className="text-gray-600" />
                Password protected
              </span>
              <button
                onClick={() => patch({ password: null })}
                disabled={saving}
                className="text-[13px] font-semibold text-blue-600 hover:text-navy-700"
              >
                Remove password
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a password to make this private"
                className={`w-full ${inputClass}`}
              />
              <button onClick={() => password && patch({ password })} disabled={saving || !password} className={outlineButtonClass}>
                Set password
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Viewer controls</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-900">Allow visitors to download the PDF</span>
            <Switch checked={preset.allowDownload} onChange={(v) => patch({ allowDownload: v })} label="Allow download" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-900">Allow visitors to print</span>
            <Switch checked={preset.allowPrint} onChange={(v) => patch({ allowPrint: v })} label="Allow print" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-900">Show toolbar (title, page count, buttons)</span>
            <Switch checked={preset.showToolbar} onChange={(v) => patch({ showToolbar: v })} label="Show toolbar" />
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center justify-between">
            <span className="text-gray-900">Background color</span>
            <input
              type="color"
              value={preset.themeColor}
              onChange={(e) => patch({ themeColor: e.target.value })}
              className="h-8 w-11 cursor-pointer rounded-[8px] border border-gray-200"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-900">Background image</span>
            <div className="flex items-center gap-2.5">
              {backgroundImageUrl ? (
                <Image src={backgroundImageUrl} alt="" width={56} height={32} unoptimized className="h-8 w-14 rounded-[7px] border border-gray-200 object-cover" />
              ) : (
                <div className="flex h-8 w-14 items-center justify-center rounded-[7px] border border-gray-200 bg-gray-100">
                  <IconImage size={16} className="text-gray-300" />
                </div>
              )}
              <label className="cursor-pointer rounded-[8px] border border-gray-300 px-3.5 py-2 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                {uploadingBackground ? "Uploading…" : backgroundImageUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingBackground}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadImage(
                        file,
                        "backgroundImageR2Key",
                        `/api/presets/${preset.id}/background-upload-url`,
                        setBackgroundImageUrl,
                        setUploadingBackground,
                        "Background image"
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {backgroundImageUrl && (
                <button
                  onClick={() => removeImage("backgroundImageR2Key", setBackgroundImageUrl, "Background image")}
                  disabled={saving}
                  className="text-[13px] font-semibold text-blue-600 hover:text-navy-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {backgroundImageUrl && (
            <>
              <p className="text-xs leading-relaxed text-gray-400">
                The background image sits behind the pages; the background color above still shows through while it loads,
                if it fails to load, or around it depending on the fit below.
              </p>

              <div className="flex items-center justify-between">
                <span className="text-gray-900">Fit</span>
                <div className="flex overflow-hidden rounded-[8px] border border-gray-300 text-xs">
                  <button
                    onClick={() => patch({ backgroundFit: "contain" })}
                    disabled={saving}
                    className={`px-3.5 py-1.5 font-semibold ${preset.backgroundFit === "contain" ? "bg-navy-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    Fit whole image
                  </button>
                  <button
                    onClick={() => patch({ backgroundFit: "cover" })}
                    disabled={saving}
                    className={`border-l border-gray-300 px-3.5 py-1.5 font-semibold ${preset.backgroundFit === "cover" ? "bg-navy-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    Fill &amp; crop
                  </button>
                </div>
              </div>

              {preset.backgroundFit === "cover" && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-900">Crop from</span>
                  <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-gray-300 p-1">
                    {BACKGROUND_POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        onClick={() => patch({ backgroundPosition: pos })}
                        disabled={saving}
                        aria-label={pos}
                        className={`flex h-7 w-7 items-center justify-center rounded-[5px] transition-colors ${
                          preset.backgroundPosition === pos ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Branding</h2>
        <div className="mt-4 space-y-3.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-900">Logo</span>
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <Image src={logoUrl} alt="" width={56} height={32} unoptimized className="h-8 w-14 rounded-[7px] border border-gray-200 object-contain" />
              ) : (
                <div className="flex h-8 w-14 items-center justify-center rounded-[7px] border border-gray-200 bg-gray-100">
                  <IconImage size={16} className="text-gray-300" />
                </div>
              )}
              <label className="cursor-pointer rounded-[8px] border border-gray-300 px-3.5 py-2 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                {uploadingLogo ? "Uploading…" : logoUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadImage(file, "logoR2Key", `/api/presets/${preset.id}/logo-upload-url`, setLogoUrl, setUploadingLogo, "Logo");
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {logoUrl && (
                <button
                  onClick={() => removeImage("logoR2Key", setLogoUrl, "Logo")}
                  disabled={saving}
                  className="text-[13px] font-semibold text-blue-600 hover:text-navy-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400">Shown in the bottom-left corner of the viewer, over the background.</p>

          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Link when the logo is clicked (optional)</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={logoLinkDraft}
                onChange={(e) => setLogoLinkDraft(e.target.value)}
                placeholder="https://yourwebsite.com"
                className={`w-full ${inputClass}`}
              />
              <button
                onClick={saveLogoLink}
                disabled={saving || logoLinkDraft.trim() === (preset.logoLinkUrl ?? "")}
                className={outlineButtonClass}
              >
                Save
              </button>
            </div>
            {!logoUrl && logoLinkDraft && <p className="mt-1.5 text-xs text-amber-600">Upload a logo above for this link to have anywhere to go.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
