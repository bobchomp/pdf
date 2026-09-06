"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadPdf, renderPageToDataUrl } from "@/lib/pdf-client";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function NewFlipbookPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !title) {
      setTitle(selected.name.replace(/\.pdf$/i, ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setError(null);

    try {
      setStatus("Reading PDF…");
      const buffer = await file.arrayBuffer();
      const doc = await loadPdf(buffer.slice(0));
      const pageCount = doc.numPages;
      const coverDataUrl = await renderPageToDataUrl(doc, 1, 1.0);

      setStatus("Requesting upload URL…");
      const createRes = await fetch("/api/flipbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || file.name, filename: file.name, contentType: "application/pdf" }),
      });
      if (!createRes.ok) throw new Error("Failed to create flipbook record.");
      const { flipbook, uploadUrl } = await createRes.json();

      setStatus("Uploading PDF to storage…");
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!putRes.ok) throw new Error("Failed to upload PDF to R2.");

      setStatus("Uploading cover thumbnail…");
      const coverRes = await fetch(`/api/flipbooks/${flipbook.id}/cover-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "cover.jpg", contentType: "image/jpeg" }),
      });
      const { uploadUrl: coverUploadUrl, key: coverKey } = await coverRes.json();
      await fetch(coverUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: dataUrlToBlob(coverDataUrl),
      });

      setStatus("Finishing up…");
      await fetch(`/api/flipbooks/${flipbook.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageCount, fileSizeBytes: file.size, coverImageR2Key: coverKey }),
      });

      router.push(`/dashboard/${flipbook.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
      setStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900">Upload a PDF</h1>
      <p className="mt-1 text-sm text-slate-500">It&apos;ll be stored in your Cloudflare R2 bucket and turned into a flipbook.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">PDF file</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            required
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status && !error && <p className="text-sm text-slate-500">{status}</p>}

        <button
          type="submit"
          disabled={!file || submitting}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Upload & create flipbook"}
        </button>
      </form>
    </div>
  );
}
