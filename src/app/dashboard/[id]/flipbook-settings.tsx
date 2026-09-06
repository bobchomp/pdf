"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{flipbook.title}</h1>
          <p className="text-sm text-slate-400">
            {flipbook.status} · {flipbook.pageCount} pages
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/f/${flipbook.slug}`}
            target="_blank"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            View
          </a>
          <button onClick={handleDelete} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Details</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Title</label>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Description</label>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={3}
              placeholder="Optional — shown to visitors before they open the flipbook"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => patch({ title: titleDraft, description: descriptionDraft })}
            disabled={saving || (titleDraft === flipbook.title && descriptionDraft === flipbook.description) || !titleDraft.trim()}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save details
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Share</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Public link</label>
            <div className="mt-1 flex gap-2">
              <input readOnly value={publicUrl} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              <button onClick={() => copy(publicUrl)} className="rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50">
                Copy
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Embed on your website</label>
            <div className="mt-1 flex gap-2">
              <textarea
                readOnly
                value={embedCode}
                rows={2}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
              />
              <button onClick={() => copy(embedCode)} className="h-fit rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                Copy
              </button>
            </div>
            {flipbook.isPrivate && (
              <p className="mt-1 text-xs text-amber-600">
                Note: password-protected flipbooks may prompt for the password again inside the embed on some browsers due to
                third-party cookie restrictions.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Privacy</h2>
        <div className="mt-3 space-y-3">
          {flipbook.isPrivate ? (
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span>🔒 Password protected</span>
              <button
                onClick={() => patch({ password: null })}
                disabled={saving}
                className="text-sm text-slate-500 underline hover:text-slate-800"
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
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => password && patch({ password })}
                disabled={saving || !password}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Set password
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Viewer controls</h2>
        <div className="mt-3 space-y-3 text-sm">
          <label className="flex items-center justify-between">
            <span>Allow visitors to download the PDF</span>
            <input
              type="checkbox"
              checked={flipbook.allowDownload}
              onChange={(e) => patch({ allowDownload: e.target.checked })}
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Allow visitors to print</span>
            <input
              type="checkbox"
              checked={flipbook.allowPrint}
              onChange={(e) => patch({ allowPrint: e.target.checked })}
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show toolbar (title, page count, buttons)</span>
            <input
              type="checkbox"
              checked={flipbook.showToolbar}
              onChange={(e) => patch({ showToolbar: e.target.checked })}
              className="h-4 w-4"
            />
          </label>
          <div className="flex items-center justify-between">
            <span>Background color</span>
            <input
              type="color"
              value={flipbook.themeColor}
              onChange={(e) => patch({ themeColor: e.target.value })}
              className="h-8 w-14 cursor-pointer rounded border border-slate-300"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Background image</span>
            <div className="flex items-center gap-2">
              {backgroundImageUrl && (
                <Image
                  src={backgroundImageUrl}
                  alt=""
                  width={56}
                  height={32}
                  unoptimized
                  className="h-8 w-14 rounded border border-slate-300 object-cover"
                />
              )}
              <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
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
                  className="text-sm text-slate-500 underline hover:text-slate-800"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {backgroundImageUrl && (
            <p className="text-xs text-slate-400">
              The background image covers the whole viewer behind the pages; the background color above still shows through
              while it loads or if it fails to load.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Branding</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>Logo</span>
            <div className="flex items-center gap-2">
              {logoUrl && (
                <Image src={logoUrl} alt="" width={56} height={32} unoptimized className="h-8 w-14 rounded border border-slate-300 object-contain" />
              )}
              <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
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
                  className="text-sm text-slate-500 underline hover:text-slate-800"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">Shown in the bottom-left corner of the viewer, over the background.</p>

          <div>
            <label className="text-xs font-medium text-slate-500">Link when the logo is clicked (optional)</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={logoLinkDraft}
                onChange={(e) => setLogoLinkDraft(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={saveLogoLink}
                disabled={saving || logoLinkDraft.trim() === (flipbook.logoLinkUrl ?? "")}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            {!logoUrl && logoLinkDraft && <p className="mt-1 text-xs text-amber-600">Upload a logo above for this link to have anywhere to go.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Analytics</h2>
        {stats ? (
          <div className="mt-3">
            <p className="text-2xl font-semibold text-slate-900">{stats.totalViews}</p>
            <p className="text-xs text-slate-400">total views</p>
            <div className="mt-4 flex h-24 items-end gap-0.5">
              {stats.last30Days.length === 0 ? (
                <p className="text-xs text-slate-300">No views in the last 30 days.</p>
              ) : (
                stats.last30Days.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count}`}
                    className="flex-1 rounded-t bg-slate-700"
                    style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: 2 }}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Loading…</p>
        )}
      </section>
    </div>
  );
}
