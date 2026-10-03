"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToCanvas, type PdfPageLink } from "@/lib/pdf-client";

// How much bigger than its size in the book the zoomed page is shown. Relative to the page
// rather than the screen, so a wide desktop viewer doesn't blow a page up several times over.
const ZOOM_FACTOR = 2.5;
// Caps the sharp re-render's pixel count; phones in particular limit total canvas memory.
const MAX_RENDER_SCALE = 3;

export function PdfZoomOverlay({
  doc,
  pageNumber,
  pageWidth,
  focus,
  onClose,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** The page's on-screen width in the book, in CSS pixels. */
  pageWidth: number;
  focus: { xPct: number; yPct: number };
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [links, setLinks] = useState<PdfPageLink[]>([]);
  const zoomedWidth = Math.round(pageWidth * ZOOM_FACTOR);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Show the book's already-rendered copy of this page instantly, then swap in a sharper
    // render sized for the zoomed view — the book's copy is rendered for its own, much smaller
    // on-screen size and would look soft blown up.
    const sourceRoot = document.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
    const sourceCanvas = sourceRoot?.querySelector("canvas");
    if (sourceCanvas && sourceCanvas.width > 0) {
      canvas.width = sourceCanvas.width;
      canvas.height = sourceCanvas.height;
      canvas.getContext("2d")?.drawImage(sourceCanvas, 0, 0);
      queueMicrotask(() => {
        if (!cancelled) setReady(true);
      });
    }

    doc
      .getPage(pageNumber)
      .then(async (page) => {
        const baseWidth = page.getViewport({ scale: 1 }).width;
        const scale = Math.min(MAX_RENDER_SCALE, (zoomedWidth * window.devicePixelRatio) / baseWidth);
        const sharp = document.createElement("canvas");
        await renderPageToCanvas(doc, pageNumber, sharp, scale);
        if (cancelled) return;
        canvas.width = sharp.width;
        canvas.height = sharp.height;
        canvas.getContext("2d")?.drawImage(sharp, 0, 0);
        setReady(true);
      })
      .catch(() => {
        // keep whatever is already showing (the book's copy, or the loading state)
      });

    // The book's copy of the page has already parsed its clickable links; reuse them.
    const sourceLinks = sourceRoot ? Array.from(sourceRoot.querySelectorAll<HTMLAnchorElement>("a[href]")) : [];
    setLinks(
      sourceLinks.map((a) => ({
        url: a.href,
        leftPct: parseFloat(a.style.left) || 0,
        topPct: parseFloat(a.style.top) || 0,
        widthPct: parseFloat(a.style.width) || 0,
        heightPct: parseFloat(a.style.height) || 0,
      }))
    );

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, zoomedWidth]);

  // Scroll so the point that was tapped/clicked ends up centered, rather than always
  // opening on the middle of the page.
  useEffect(() => {
    if (!ready || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = Math.max(0, (focus.xPct / 100) * el.scrollWidth - el.clientWidth / 2);
    el.scrollTop = Math.max(0, (focus.yPct / 100) * el.scrollHeight - el.clientHeight / 2);
  }, [ready, focus]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 bg-black/95">
      <button
        onClick={onClose}
        aria-label="Close zoom"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20"
      >
        ✕
      </button>

      <div
        ref={scrollRef}
        // detail > 1: the rest of a double-click whose first click opened this view.
        onClick={(e) => e.detail <= 1 && onClose()}
        className="h-full w-full cursor-zoom-out overflow-auto"
      >
        <div className="flex min-h-full w-max min-w-full items-center justify-center p-8">
          <div className="relative shrink-0" style={{ width: zoomedWidth }}>
            <canvas ref={canvasRef} className="block w-full" />
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.url}
                className="absolute cursor-pointer"
                style={{
                  left: `${link.leftPct}%`,
                  top: `${link.topPct}%`,
                  width: `${link.widthPct}%`,
                  height: `${link.heightPct}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {!ready && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">Loading…</p>
      )}
    </div>
  );
}
