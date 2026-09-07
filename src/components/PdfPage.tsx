"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToCanvas, getPageLinks, type PdfPageLink } from "@/lib/pdf-client";

export function PdfPage({
  doc,
  pageNumber,
  shouldRender,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  shouldRender: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [links, setLinks] = useState<PdfPageLink[]>([]);
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!shouldRender || rendered || !canvasRef.current) return;
    let cancelled = false;

    renderPageToCanvas(doc, pageNumber, canvasRef.current, 1.5)
      .then(({ width, height }) => {
        if (!cancelled) {
          setRendered(true);
          setAspect(width / height);
        }
      })
      .catch(() => {
        // page failed to render; leave blank
      });

    getPageLinks(doc, pageNumber)
      .then((found) => {
        if (!cancelled) setLinks(found);
      })
      .catch(() => {
        // no clickable links for this page; not fatal
      });

    return () => {
      cancelled = true;
    };
  }, [shouldRender, rendered, doc, pageNumber]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-white">
      {/*
        The canvas is rendered at this page's own real aspect ratio, which can differ slightly
        from the book's overall box (derived from page 1). Locking this wrapper to that same
        aspect ratio — rather than letterboxing the canvas alone via object-contain — keeps the
        canvas and the percentage-positioned link overlays in the exact same coordinate space,
        however this page happens to be letterboxed.
      */}
      <div
        className="relative h-full w-full"
        style={aspect ? { aspectRatio: aspect, maxWidth: "100%", maxHeight: "100%" } : undefined}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs text-slate-400">
            {pageNumber}
          </div>
        )}
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.url}
            className="absolute hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-blue-400/70"
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
  );
}
