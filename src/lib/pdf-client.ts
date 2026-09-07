"use client";

import * as pdfjsLib from "pdfjs-dist";

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
}

export async function loadPdf(source: string | ArrayBuffer) {
  ensureWorker();
  const loadingTask = pdfjsLib.getDocument(typeof source === "string" ? { url: source } : { data: source });
  return loadingTask.promise;
}

export async function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.2
) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function renderPageToDataUrl(doc: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale = 1.2) {
  const canvas = document.createElement("canvas");
  await renderPageToCanvas(doc, pageNumber, canvas, scale);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export type PdfPageLink = {
  url: string;
  /** Position and size as a percentage of the page, so it stays correct at any render scale. */
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

type PixelRect = { left: number; top: number; width: number; height: number };

/**
 * PDF Link annotations carry only a single bounding Rect (unlike markup annotations, which can
 * also carry tighter QuadPoints) — so when an export tool hands out a generous or duplicated Rect
 * for links sitting close together (e.g. several URLs packed onto one or two lines), their boxes
 * can end up overlapping in the source PDF itself, and the topmost one silently swallows clicks
 * meant for its neighbors. There's no more precise geometry to fall back on, so this clips every
 * overlapping pair at the boundary between them — along whichever axis they overlap *less* on,
 * since that's the axis they're actually laid out along (side by side, or stacked) — giving each
 * link exclusive ownership of its own share of the disputed area instead of losing it entirely.
 */
function resolveOverlappingRects(rects: PixelRect[]): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlapLeft = Math.max(a.left, b.left);
      const overlapRight = Math.min(a.left + a.width, b.left + b.width);
      const overlapTop = Math.max(a.top, b.top);
      const overlapBottom = Math.min(a.top + a.height, b.top + b.height);
      const overlapWidth = overlapRight - overlapLeft;
      const overlapHeight = overlapBottom - overlapTop;
      if (overlapWidth <= 0 || overlapHeight <= 0) continue;

      const overlapFractionX = overlapWidth / Math.min(a.width, b.width);
      const overlapFractionY = overlapHeight / Math.min(a.height, b.height);

      if (overlapFractionX <= overlapFractionY) {
        const mid = (overlapLeft + overlapRight) / 2;
        const [left, right] = a.left <= b.left ? [a, b] : [b, a];
        left.width = Math.min(left.width, mid - left.left);
        const rightNewLeft = Math.max(right.left, mid);
        right.width = right.left + right.width - rightNewLeft;
        right.left = rightNewLeft;
      } else {
        const mid = (overlapTop + overlapBottom) / 2;
        const [top, bottom] = a.top <= b.top ? [a, b] : [b, a];
        top.height = Math.min(top.height, mid - top.top);
        const bottomNewTop = Math.max(bottom.top, mid);
        bottom.height = bottom.top + bottom.height - bottomNewTop;
        bottom.top = bottomNewTop;
      }
    }
  }
}

/**
 * Hyperlinks embedded in the PDF itself (e.g. from Word/Canva/InDesign export) as annotation
 * data, converted to percentage-based boxes. Pages are rendered as flat canvas images, which
 * strips away clickability entirely, so the viewer overlays these as real <a> elements instead.
 * Internal-only links (jump to another page in the same PDF, no external URL) are skipped.
 */
export async function getPageLinks(doc: pdfjsLib.PDFDocumentProxy, pageNumber: number): Promise<PdfPageLink[]> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const annotations = await page.getAnnotations({ intent: "display" });

  const entries: { url: string; rect: PixelRect }[] = [];
  for (const annotation of annotations) {
    if (annotation.subtype !== "Link") continue;
    const url: string | undefined = annotation.url || annotation.unsafeUrl;
    if (!url || !Array.isArray(annotation.rect)) continue;

    const [rx1, ry1, rx2, ry2] = annotation.rect as [number, number, number, number];
    const [vx1, vy1] = viewport.convertToViewportPoint(rx1, ry1);
    const [vx2, vy2] = viewport.convertToViewportPoint(rx2, ry2);

    entries.push({
      url,
      rect: {
        left: Math.min(vx1, vx2),
        top: Math.min(vy1, vy2),
        width: Math.abs(vx2 - vx1),
        height: Math.abs(vy2 - vy1),
      },
    });
  }

  resolveOverlappingRects(entries.map((entry) => entry.rect));

  return entries.map(({ url, rect }) => ({
    url,
    leftPct: (rect.left / viewport.width) * 100,
    topPct: (rect.top / viewport.height) * 100,
    widthPct: (rect.width / viewport.width) * 100,
    heightPct: (rect.height / viewport.height) * 100,
  }));
}
