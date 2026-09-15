"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToCanvas, type PdfPageLink } from "@/lib/pdf-client";

const ZOOM_WIDTH_PCT = 220;

export function PdfZoomOverlay({
  doc,
  pageNumber,
  focus,
  onClose,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  focus: { xPct: number; yPct: number };
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [links, setLinks] = useState<PdfPageLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The page's own view already has this page rendered (that's how a double-tap could land
    // on it) and its clickable links parsed — reuse both directly rather than asking pdf.js to
    // render and parse the same page a second time, which races the page's own in-flight work
    // and can throw deep inside pdf.js's page cache.
    const sourceRoot = document.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
    const sourceCanvas = sourceRoot?.querySelector("canvas");

    if (sourceCanvas && sourceCanvas.width > 0) {
      canvas.width = sourceCanvas.width;
      canvas.height = sourceCanvas.height;
      canvas.getContext("2d")?.drawImage(sourceCanvas, 0, 0);
      queueMicrotask(() => {
        if (!cancelled) setReady(true);
      });
    } else {
      renderPageToCanvas(doc, pageNumber, canvas, 2)
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          // leave the loading state; nothing more to show
        });
    }

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
  }, [doc, pageNumber]);

  // Scroll so the point the visitor double-tapped ends up centered, rather than always
  // opening on the middle of the page.
  useEffect(() => {
    if (!ready || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = Math.max(0, (focus.xPct / 100) * el.scrollWidth - el.clientWidth / 2);
    el.scrollTop = Math.max(0, (focus.yPct / 100) * el.scrollHeight - el.clientHeight / 2);
  }, [ready, focus]);

  return (
    <div className="absolute inset-0 z-40 bg-black/95">
      <button
        onClick={onClose}
        aria-label="Close zoom"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20"
      >
        ✕
      </button>

      <div ref={scrollRef} onClick={onClose} className="h-full w-full overflow-auto">
        <div
          className="flex min-h-full items-center justify-center py-8"
          style={{ width: `${ZOOM_WIDTH_PCT}%`, minWidth: "100%" }}
        >
          <div className="relative w-full">
            <canvas ref={canvasRef} className="w-full" />
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.url}
                className="absolute"
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
