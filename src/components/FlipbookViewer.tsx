"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/lib/pdf-client";
import { PdfPage } from "@/components/PdfPage";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as unknown as React.ComponentType<
  Record<string, unknown>
>;

const RENDER_WINDOW = 3;

export function FlipbookViewer({
  pdfUrl,
  pageCount,
  title,
  themeColor,
  showToolbar,
  allowDownload,
  allowPrint,
}: {
  pdfUrl: string;
  pageCount: number;
  title: string;
  themeColor: string;
  showToolbar: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const flipBookRef = useRef<{ pageFlip: () => { flipNext: () => void; flipPrev: () => void } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPdf(pdfUrl)
      .then((loaded) => {
        if (!cancelled) setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load this PDF. The link may have expired — try reloading the page.");
      });
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const pages = useMemo(() => {
    if (!doc) return [];
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }, [doc, pageCount]);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${title || "document"}.pdf`;
    a.click();
  }

  function handlePrint() {
    const win = window.open(pdfUrl, "_blank");
    win?.addEventListener("load", () => win.print());
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center text-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-slate-400">
        Loading flipbook…
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-3" style={{ background: themeColor }}>
      {showToolbar && (
        <div className="flex w-full max-w-4xl items-center justify-between px-4 pt-3 text-sm text-white/90">
          <span className="truncate font-medium">{title}</span>
          <div className="flex items-center gap-3">
            <span className="tabular-nums text-white/60">
              {currentPage + 1} / {pageCount}
            </span>
            {allowPrint && (
              <button onClick={handlePrint} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                Print
              </button>
            )}
            {allowDownload && (
              <button onClick={handleDownload} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                Download
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 w-full items-center justify-center overflow-hidden px-2 pb-4">
        <HTMLFlipBook
          key={pageCount}
          ref={flipBookRef}
          width={500}
          height={700}
          size="stretch"
          minWidth={280}
          maxWidth={900}
          minHeight={400}
          maxHeight={1200}
          maxShadowOpacity={0.4}
          showCover={true}
          mobileScrollSupport={true}
          className="shadow-2xl"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={500}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
          onFlip={(e: { data: number }) => setCurrentPage(e.data)}
        >
          {pages.map((pageNumber) => (
            <div key={pageNumber} className="bg-white">
              <PdfPage doc={doc} pageNumber={pageNumber} shouldRender={Math.abs(pageNumber - 1 - currentPage) <= RENDER_WINDOW} />
            </div>
          ))}
        </HTMLFlipBook>
      </div>
    </div>
  );
}
