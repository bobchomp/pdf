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
      <h1 className="text-[26px] font-bold tracking-tight text-navy-900">Upload a PDF</h1>
      <p className="mt-1.5 text-sm text-gray-600">It&apos;ll be stored in your Cloudflare R2 bucket and turned into a flipbook.</p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]"
      >
        <div>
          <label className="block text-[13px] font-semibold text-gray-700">PDF file</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            required
            className="mt-1.5 block w-full text-sm text-gray-600 file:mr-3 file:rounded-[8px] file:border-0 file:bg-gray-100 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-[10px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status && !error && <p className="text-sm text-gray-500">{status}</p>}

        <button
          type="submit"
          disabled={!file || submitting}
          className="w-full rounded-[10px] bg-navy-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Upload & create flipbook"}
        </button>
      </form>
    </div>
  );
}
