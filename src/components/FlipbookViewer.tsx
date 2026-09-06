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

/**
 * react-pageflip (showCover=true) always reserves a two-page-wide box, centered in its
 * container, and puts a lone cover page in just the right or left half of it — never both.
 * That leaves the visible page off-center. This mirrors PageCollection's own spread-building
 * logic (page-flip/src/Collection/PageCollection.ts) to know, for a given page and total count,
 * whether it's alone and on which side, so we can shift the whole book to compensate.
 */
function coverShiftDirection(currentPage: number, pageCount: number): "left" | "right" | null {
  if (pageCount <= 0) return null;
  if (currentPage === 0) {
    // The single-page book edge case: page 0 is simultaneously "the cover" and "the last
    // page", and the library's own tie-break assigns it to the left slot, not the right.
    return pageCount === 1 ? "right" : "left";
  }
  const isTrailingLoneBackCover = pageCount > 1 && pageCount % 2 === 0 && currentPage === pageCount - 1;
  return isTrailingLoneBackCover ? "right" : null;
}

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
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
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

  const shift = orientation === "landscape" ? coverShiftDirection(currentPage, pageCount) : null;
  const flipBookStyle: React.CSSProperties = {
    transition: "transform 300ms ease",
    transform: shift === "left" ? "translateX(-25%) translateZ(0)" : shift === "right" ? "translateX(25%) translateZ(0)" : "translateZ(0)",
  };

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
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-3" style={{ background: themeColor }}>
      {showToolbar && (
        <div className="flex w-full max-w-4xl shrink-0 items-center justify-between px-4 pt-3 text-sm text-white/90">
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

      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-2 pb-4">
        <HTMLFlipBook
          key={pageCount}
          ref={flipBookRef}
          width={500}
          height={700}
          size="stretch"
          minWidth={280}
          maxWidth={1400}
          minHeight={400}
          maxHeight={1800}
          maxShadowOpacity={0.4}
          showCover={true}
          mobileScrollSupport={true}
          className="shadow-2xl"
          style={flipBookStyle}
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
          onInit={(e: { data: { mode: "portrait" | "landscape" } }) => setOrientation(e.data.mode)}
          onChangeOrientation={(e: { data: "portrait" | "landscape" }) => setOrientation(e.data)}
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
