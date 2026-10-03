"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageToCanvas, type PdfPageLink } from "@/lib/pdf-client";

// How much bigger than its size in the book the zoomed page is shown. Relative to the page
// rather than the screen, so a wide desktop viewer doesn't blow a page up several times over.
const ZOOM_FACTOR = 2.5;
// Caps the sharp re-render's pixel count; phones in particular limit total canvas memory.
const MAX_RENDER_SCALE = 3;
export const ZOOM_DURATION_MS = 380;
const ZOOM_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type Rect = { left: number; top: number; width: number; height: number };

/** The transform that makes an element laid out at `from` appear at `to` (origin top-left). */
function flipTransform(to: Rect, from: Rect) {
  return `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
}

function bookPage(pageNumber: number) {
  return document.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`);
}

function bookCanvas(pageNumber: number) {
  const canvas = bookPage(pageNumber)?.querySelector("canvas");
  return canvas && canvas.width > 0 ? canvas : null;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PdfZoomOverlay({
  doc,
  pageNumber,
  sourceRect,
  focus,
  onCloseStart,
  onClosed,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** Where the page sits on screen in the book; the zoom grows out of, and shrinks back into, this. */
  sourceRect: Rect;
  focus: { xPct: number; yPct: number };
  onCloseStart: () => void;
  onClosed: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsShown, setControlsShown] = useState(false);
  const zoomedWidth = Math.round(sourceRect.width * ZOOM_FACTOR);

  // The book's copy of the page has already parsed its clickable links; reuse them.
  const [links] = useState<PdfPageLink[]>(() =>
    Array.from(bookPage(pageNumber)?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []).map((a) => ({
      url: a.href,
      leftPct: parseFloat(a.style.left) || 0,
      topPct: parseFloat(a.style.top) || 0,
      widthPct: parseFloat(a.style.width) || 0,
      heightPct: parseFloat(a.style.height) || 0,
    }))
  );

  // Opening, before first paint: show the book's copy of the page, scroll so the point that was
  // clicked/tapped ends up centered, then grow the page out of its spot in the book.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollRef.current;
    const pageEl = pageRef.current;
    if (!canvas || !scroller || !pageEl) return;

    const source = bookCanvas(pageNumber);
    if (source) {
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext("2d")?.drawImage(source, 0, 0);
    } else {
      // Not rendered in the book yet: reserve the right shape until the sharp render lands.
      canvas.width = Math.round(sourceRect.width);
      canvas.height = Math.round(sourceRect.height);
    }

    scroller.scrollLeft = Math.max(0, (focus.xPct / 100) * scroller.scrollWidth - scroller.clientWidth / 2);
    scroller.scrollTop = Math.max(0, (focus.yPct / 100) * scroller.scrollHeight - scroller.clientHeight / 2);

    if (!prefersReducedMotion()) {
      const zoomed = pageEl.getBoundingClientRect();
      pageEl.style.transition = "none";
      pageEl.style.transform = flipTransform(sourceRect, zoomed);
      pageEl.getBoundingClientRect(); // commit the starting position before animating from it
      pageEl.style.transition = `transform ${ZOOM_DURATION_MS}ms ${ZOOM_EASING}`;
      pageEl.style.transform = "";
    }

    const frame = requestAnimationFrame(() => setControlsShown(true));
    return () => cancelAnimationFrame(frame);
  }, [pageNumber, sourceRect, focus]);

  // The book's copy is rendered for its own, much smaller on-screen size and looks soft blown
  // up, so swap in a render sized for the zoomed view once it's ready.
  useEffect(() => {
    let cancelled = false;
    doc
      .getPage(pageNumber)
      .then(async (page) => {
        const baseWidth = page.getViewport({ scale: 1 }).width;
        const scale = Math.min(MAX_RENDER_SCALE, (zoomedWidth * window.devicePixelRatio) / baseWidth);
        const sharp = document.createElement("canvas");
        await renderPageToCanvas(doc, pageNumber, sharp, scale);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = sharp.width;
        canvas.height = sharp.height;
        canvas.getContext("2d")?.drawImage(sharp, 0, 0);
      })
      .catch(() => {
        // keep showing the book's copy
      });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, zoomedWidth]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    []
  );

  // Closing: shrink the page back into its spot in the book (re-measured, in case the window
  // was resized while zoomed), from wherever it currently is — even mid-way through opening.
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setControlsShown(false);
    onCloseStart();

    const pageEl = pageRef.current;
    if (!pageEl || prefersReducedMotion()) {
      onClosed();
      return;
    }

    const target = bookCanvas(pageNumber)?.getBoundingClientRect() ?? sourceRect;
    const current = pageEl.getBoundingClientRect();
    pageEl.style.transition = "none";
    pageEl.style.transform = "none";
    const layout = pageEl.getBoundingClientRect();
    pageEl.style.transform = flipTransform(current, layout);
    pageEl.getBoundingClientRect();
    pageEl.style.transition = `transform ${ZOOM_DURATION_MS}ms ${ZOOM_EASING}`;
    pageEl.style.transform = flipTransform(target, layout);
    closeTimerRef.current = setTimeout(onClosed, ZOOM_DURATION_MS);
  }, [pageNumber, sourceRect, onCloseStart, onClosed]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  // Mouse drag to pan around the zoomed page (touch already pans natively via overflow scrolling).
  const dragRef = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const scroller = e.currentTarget;
    dragRef.current = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return; // still just a click
      drag.moved = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.currentTarget.scrollLeft = drag.left - dx;
    e.currentTarget.scrollTop = drag.top - dy;
  }

  function endDrag() {
    if (dragRef.current?.moved) {
      setDragging(false);
      // The click (if any) is dispatched right after pointerup; drop the flag once it's had its chance.
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
  }

  return (
    <div className="absolute inset-0 z-20">
      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // A click that ends a drag shouldn't also close the view or follow a link under it.
        onClickCapture={(e) => {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        // detail > 1: the rest of a double-click whose first click opened this view.
        onClick={(e) => e.detail <= 1 && close()}
        className={`h-full w-full select-none overflow-auto ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className="flex min-h-full w-max min-w-full items-center justify-center p-8">
          <div
            ref={pageRef}
            className="relative shrink-0 bg-white shadow-2xl"
            style={{ width: zoomedWidth, transformOrigin: "0 0" }}
          >
            <canvas ref={canvasRef} className="block w-full" />
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.url}
                draggable={false}
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

      <button
        onClick={close}
        aria-label="Close zoom"
        className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900/50 text-lg text-white shadow-sm backdrop-blur-sm transition-opacity duration-300 hover:bg-gray-900/70 ${
          controlsShown ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        ✕
      </button>
    </div>
  );
}
