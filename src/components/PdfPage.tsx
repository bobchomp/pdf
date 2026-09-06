"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToCanvas } from "@/lib/pdf-client";

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

  useEffect(() => {
    if (!shouldRender || rendered || !canvasRef.current) return;
    let cancelled = false;

    renderPageToCanvas(doc, pageNumber, canvasRef.current, 1.5)
      .then(() => {
        if (!cancelled) setRendered(true);
      })
      .catch(() => {
        // page failed to render; leave blank
      });

    return () => {
      cancelled = true;
    };
  }, [shouldRender, rendered, doc, pageNumber]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-white">
      <canvas ref={canvasRef} className="h-full w-full object-contain" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs text-slate-400">
          {pageNumber}
        </div>
      )}
    </div>
  );
}
