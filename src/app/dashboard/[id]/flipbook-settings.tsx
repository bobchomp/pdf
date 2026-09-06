"use client";

import { useEffect, useState } from "react";
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

type Flipbook = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  pageCount: number;
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

type Stats = { totalViews: number; last30Days: { date: string; count: number }[] };
type ImageField = "backgroundImageR2Key" | "logoR2Key";

export function FlipbookSettings({
  flipbook: initial,
  initialBackgroundImageUrl,
  initialLogoUrl,
}: {
  flipbook: Flipbook;
  initialBackgroundImageUrl: string | null;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [flipbook, setFlipbook] = useState(initial);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [descriptionDraft, setDescriptionDraft] = useState(initial.description);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(initialBackgroundImageUrl);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoLinkDraft, setLogoLinkDraft] = useState(initial.logoLinkUrl ?? "");
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  useEffect(() => {
    fetch(`/api/flipbooks/${flipbook.id}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats));
  }, [flipbook.id]);

  const publicUrl = `${origin}/f/${flipbook.slug}`;
  const embedCode = `<iframe src="${origin}/embed/${flipbook.slug}" width="100%" height="700" style="border:0;" allowfullscreen></iframe>`;

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/flipbooks/${flipbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setFlipbook((prev) => ({ ...prev, ...data.flipbook }));
        setMessage("Saved.");
      } else {
        setMessage(data.error?.formErrors?.[0] ?? data.error ?? "Failed to save.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${flipbook.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/flipbooks/${flipbook.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setMessage("Copied to clipboard.");
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

      const res = await fetch(`/api/flipbooks/${flipbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to save ${label}.`);

      setFlipbook((prev) => ({ ...prev, ...data.flipbook }));
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
      const res = await fetch(`/api/flipbooks/${flipbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: null }),
      });
      const data = await res.json();
      if (res.ok) {
        setFlipbook((prev) => ({ ...prev, ...data.flipbook }));
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

  const maxCount = Math.max(1, ...(stats?.last30Days.map((d) => d.count) ?? [1]));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-navy-900">{flipbook.title}</h1>
          <p className="mt-1 text-[13.5px] text-gray-400">
            {flipbook.status} · {flipbook.pageCount} pages
          </p>
        </div>
        <div className="flex gap-2.5">
          <a href={`/f/${flipbook.slug}`} target="_blank" className={outlineButtonClass}>
            View
          </a>
          <button
            onClick={handleDelete}
            className="rounded-[9px] border border-red-200 px-4 py-2.5 text-[13.5px] font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {message && <p className="text-sm font-medium text-green-600">{message}</p>}

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Details</h2>
        <div className="mt-4 space-y-3.5">
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Title</label>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className={`mt-1.5 w-full ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Description</label>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={3}
              placeholder="Optional — shown to visitors before they open the flipbook"
              className={`mt-1.5 w-full ${inputClass}`}
            />
          </div>
          <button
            onClick={() => patch({ title: titleDraft, description: descriptionDraft })}
            disabled={saving || (titleDraft === flipbook.title && descriptionDraft === flipbook.description) || !titleDraft.trim()}
            className={primaryButtonClass}
          >
            Save details
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Share</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Public link</label>
            <div className="mt-1.5 flex gap-2">
              <input readOnly value={publicUrl} className={`w-full bg-gray-50 ${inputClass}`} />
              <button onClick={() => copy(publicUrl)} className={outlineButtonClass}>
                Copy
              </button>
            </div>
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-gray-400">Embed on your website</label>
            <div className="mt-1.5 flex gap-2">
              <textarea readOnly value={embedCode} rows={2} className={`w-full bg-gray-50 font-mono text-xs ${inputClass}`} />
              <button onClick={() => copy(embedCode)} className={`h-fit ${outlineButtonClass}`}>
                Copy
              </button>
            </div>
            {flipbook.isPrivate && (
              <p className="mt-2 text-xs leading-relaxed text-amber-600">
                Note: password-protected flipbooks may prompt for the password again inside the embed on some browsers due to
                third-party cookie restrictions.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Privacy</h2>
        <div className="mt-4 space-y-3">
          {flipbook.isPrivate ? (
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
            <Switch checked={flipbook.allowDownload} onChange={(v) => patch({ allowDownload: v })} label="Allow download" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-900">Allow visitors to print</span>
            <Switch checked={flipbook.allowPrint} onChange={(v) => patch({ allowPrint: v })} label="Allow print" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-900">Show toolbar (title, page count, buttons)</span>
            <Switch checked={flipbook.showToolbar} onChange={(v) => patch({ showToolbar: v })} label="Show toolbar" />
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center justify-between">
            <span className="text-gray-900">Background color</span>
            <input
              type="color"
              value={flipbook.themeColor}
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
                        `/api/flipbooks/${flipbook.id}/background-upload-url`,
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
                    className={`px-3.5 py-1.5 font-semibold ${flipbook.backgroundFit === "contain" ? "bg-navy-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    Fit whole image
                  </button>
                  <button
                    onClick={() => patch({ backgroundFit: "cover" })}
                    disabled={saving}
                    className={`border-l border-gray-300 px-3.5 py-1.5 font-semibold ${flipbook.backgroundFit === "cover" ? "bg-navy-900 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    Fill &amp; crop
                  </button>
                </div>
              </div>

              {flipbook.backgroundFit === "cover" && (
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
                          flipbook.backgroundPosition === pos ? "bg-navy-900 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
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
                      uploadImage(file, "logoR2Key", `/api/flipbooks/${flipbook.id}/logo-upload-url`, setLogoUrl, setUploadingLogo, "Logo");
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
                disabled={saving || logoLinkDraft.trim() === (flipbook.logoLinkUrl ?? "")}
                className={outlineButtonClass}
              >
                Save
              </button>
            </div>
            {!logoUrl && logoLinkDraft && <p className="mt-1.5 text-xs text-amber-600">Upload a logo above for this link to have anywhere to go.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]">
        <h2 className="text-[15px] font-semibold text-navy-900">Analytics</h2>
        {stats ? (
          <div className="mt-4">
            <p className="text-[30px] font-bold text-navy-900">{stats.totalViews}</p>
            <p className="text-xs text-gray-400">total views</p>
            <div className="mt-5 flex h-24 items-end gap-1">
              {stats.last30Days.length === 0 ? (
                <p className="text-xs text-gray-300">No views in the last 30 days.</p>
              ) : (
                stats.last30Days.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count}`}
                    className="flex-1 rounded-t-[3px] bg-blue-100"
                    style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: 2 }}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">Loading…</p>
        )}
      </section>
    </div>
  );
}
