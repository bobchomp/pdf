"use client";

import { useCallback, useEffect, useState } from "react";
import { FlipbookViewer } from "@/components/FlipbookViewer";
import { Logo } from "@/components/Logo";
import { IconLock } from "@/components/icons";

type PublicFlipbook = {
  id: string;
  slug: string;
  title: string;
  description: string;
  pageCount: number;
  isPrivate: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  themeColor: string;
  showToolbar: boolean;
  coverUrl: string | null;
  backgroundImageUrl: string | null;
  backgroundFit: "contain" | "cover";
  backgroundPosition: string;
  logoUrl: string | null;
  logoLinkUrl: string | null;
  unlocked: boolean;
};

export function PublicFlipbook({ slug, embed = false }: { slug: string; embed?: boolean }) {
  const [flipbook, setFlipbook] = useState<PublicFlipbook | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const reloadMetadata = useCallback(async () => {
    const res = await fetch(`/api/public/flipbooks/${slug}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setFlipbook(data.flipbook);
  }, [slug]);

  useEffect(() => {
    fetch(`/api/public/flipbooks/${slug}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setFlipbook(data.flipbook);
      });
  }, [slug]);

  useEffect(() => {
    if (!flipbook?.unlocked) return;
    let cancelled = false;
    fetch(`/api/public/flipbooks/${slug}/pdf-url${embed ? "?source=embed" : ""}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.url) setPdfUrl(data.url);
      });
    return () => {
      cancelled = true;
    };
  }, [flipbook?.unlocked, slug, embed]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch(`/api/public/flipbooks/${slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUnlockError(data.error ?? "Incorrect password");
        return;
      }
      await reloadMetadata();
    } finally {
      setUnlocking(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-white px-4 text-gray-500">
        This flipbook doesn&apos;t exist or isn&apos;t published.
      </div>
    );
  }

  if (!flipbook) {
    return <div className="flex h-full min-h-screen items-center justify-center bg-white text-gray-400">Loading…</div>;
  }

  if (!flipbook.unlocked) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-navy-900 px-4">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-[20px] bg-white p-7 shadow-[0_20px_40px_-12px_rgba(15,32,68,0.14),0_4px_12px_rgba(15,32,68,0.06)]"
        >
          <div className="mb-5 flex justify-center">
            <Logo size={22} textClassName="text-base" />
          </div>
          <div className="flex items-center gap-2">
            <IconLock size={14} className="text-navy-700" />
            <h1 className="text-[15px] font-semibold text-navy-900">{flipbook.title}</h1>
          </div>
          {flipbook.description && <p className="mt-1.5 text-sm text-gray-600">{flipbook.description}</p>}
          <p className="mt-1.5 text-sm text-gray-500">This flipbook is password protected.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-4 w-full rounded-[10px] border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            autoFocus
          />
          {unlockError && <p className="mt-2 text-sm text-red-600">{unlockError}</p>}
          <button
            type="submit"
            disabled={unlocking}
            className="mt-4 w-full rounded-[10px] bg-navy-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-60"
          >
            {unlocking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  if (!pdfUrl) {
    return <div className="flex h-full min-h-screen items-center justify-center bg-white text-gray-400">Loading flipbook…</div>;
  }

  return (
    <div className="h-dvh w-full overflow-hidden">
      <FlipbookViewer
        pdfUrl={pdfUrl}
        pageCount={flipbook.pageCount}
        title={flipbook.title}
        themeColor={flipbook.themeColor}
        backgroundImageUrl={flipbook.backgroundImageUrl}
        backgroundFit={flipbook.backgroundFit}
        backgroundPosition={flipbook.backgroundPosition}
        logoUrl={flipbook.logoUrl}
        logoLinkUrl={flipbook.logoLinkUrl}
        showToolbar={flipbook.showToolbar}
        allowDownload={flipbook.allowDownload}
        allowPrint={flipbook.allowPrint}
      />
    </div>
  );
}
