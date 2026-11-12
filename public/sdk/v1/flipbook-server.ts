/**
 * Flipbook server helpers, v1 — for your project's server (Node 18+, Next.js, edge runtimes).
 * No dependencies. Copy this file into your project; docs at /docs on the flipbook site.
 *
 *   const flipbook = createFlipbookClient({ apiKey: process.env.FLIPBOOK_API_KEY! });
 *   const { url } = await flipbook.createViewerToken({
 *     document: { id: "spring-2026", title: "Spring newsletter", url: "https://files.example.com/spring.pdf" },
 *   });
 *
 * Keep the API key on the server: never import this file into browser code.
 */

export const FLIPBOOK_DEFAULT_BASE_URL = "https://newsletter.smithtonchurch.com";

export type ViewerSettings = {
  backgroundColor?: string;
  backgroundImageUrl?: string | null;
  backgroundFit?: "contain" | "cover";
  backgroundPosition?: "left top" | "top" | "right top" | "left" | "center" | "right" | "left bottom" | "bottom" | "right bottom";
  /** null = same as the background colour. */
  headerColor?: string | null;
  headerTextColor?: string;
  showHeader?: boolean;
  showTitle?: boolean;
  showPrint?: boolean;
  showDownload?: boolean;
  showFullscreen?: boolean;
  showPageArrows?: boolean;
  enableZoom?: boolean;
  logoUrl?: string | null;
  logoLinkUrl?: string | null;
  /** 1-based. Viewer tokens only, not project defaults. */
  startPage?: number;
};

export type ProjectDefaultSettings = Omit<ViewerSettings, "startPage">;

export type ViewerToken = {
  token: string;
  /** Put this in an iframe, <Flipbook url>, or Flipbook.mount(). */
  url: string;
  expiresAt: string;
  document: { id: string; title: string; url: string };
  pageUrl: string | null;
  /** The settings the viewer will use, after project defaults and built-in ones are applied. */
  settings: Required<ViewerSettings>;
};

export type FlipbookEvent = {
  id: string;
  sequence: number;
  type: "view.started" | "page.viewed" | "link.clicked";
  occurredAt: string;
  viewId: string;
  document: { id: string; title: string };
  pageNumber?: number;
  url?: string;
  visitor?: {
    deviceType: "mobile" | "tablet" | "desktop" | null;
    browser: string | null;
    country: string | null;
    region: string | null;
    referrer: string;
  };
};

export type WebhookPayload = { project: { id: string }; test?: true; events: FlipbookEvent[] };

export type DocumentSummary = {
  document: { id: string; title: string };
  views: number;
  pageViews: number;
  linkClicks: number;
  lastViewedAt: string | null;
};

export type ProjectStats = {
  days: number;
  totals: { views: number; pageViews: number; linkClicks: number };
  documents: DocumentSummary[];
};

export type DocumentStats = {
  days: number;
  document: { id: string; title: string };
  totals: { views: number; pageViews: number; linkClicks: number };
  viewsByDay: { date: string; views: number }[];
  pages: { pageNumber: number; views: number; viewers: number }[];
  links: { url: string; clicks: number }[];
  devices: { label: string; views: number }[];
  browsers: { label: string; views: number }[];
  countries: { label: string; views: number }[];
};

export type Project = {
  id: string;
  name: string;
  allowedOrigins: string[];
  /** Viewer links only show the document when embedded on allowedOrigins (set in the dashboard). */
  embedOnly: boolean;
  defaultSettings: ProjectDefaultSettings;
};

export class FlipbookApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "FlipbookApiError";
  }
}

export function createFlipbookClient({ apiKey, baseUrl = FLIPBOOK_DEFAULT_BASE_URL }: { apiKey: string; baseUrl?: string }) {
  if (!apiKey?.startsWith("fbsk_")) throw new Error("createFlipbookClient: apiKey should be your secret key (fbsk_…)");
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new FlipbookApiError(res.status, data?.error?.code ?? "http_error", data?.error?.message ?? `HTTP ${res.status}`);
    }
    return data as T;
  }

  const query = (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
    const s = q.toString();
    return s ? `?${s}` : "";
  };

  return {
    /**
     * A viewer link for one PDF. pageUrl is the page it'll be shown on (someone who opens the link
     * on its own is sent there). expiresIn is in seconds (60 to 2592000; default one day).
     */
    createViewerToken(input: {
      document: { id: string; title: string; url: string };
      settings?: ViewerSettings;
      pageUrl?: string;
      expiresIn?: number;
    }) {
      return request<ViewerToken>("POST", "/api/v1/viewer-tokens", input);
    },

    getProject() {
      return request<{ project: Project; key: { id: string; name: string; prefix: string } }>("GET", "/api/v1/project");
    },

    /** Replaces the project's default display settings. */
    setDefaultSettings(defaultSettings: ProjectDefaultSettings) {
      return request<{ project: Project }>("PATCH", "/api/v1/project", { defaultSettings });
    },

    /** Events after a cursor, oldest first. Store nextCursor and pass it as `after` next time. */
    listEvents(options: { after?: string; limit?: number; documentId?: string } = {}) {
      return request<{ events: FlipbookEvent[]; nextCursor: string; hasMore: boolean }>(
        "GET",
        `/api/v1/events${query({ after: options.after, limit: options.limit, documentId: options.documentId })}`
      );
    },

    /** Every event after `after`, following pages until caught up. */
    async *allEvents(after = "0", pageSize = 500) {
      let cursor = after;
      for (;;) {
        const page = await this.listEvents({ after: cursor, limit: pageSize });
        for (const event of page.events) yield { event, cursor: String(event.sequence) };
        cursor = page.nextCursor;
        if (!page.hasMore) return;
      }
    },

    getStats(options: { days?: number } = {}) {
      return request<ProjectStats>("GET", `/api/v1/stats${query({ days: options.days })}`);
    },

    getDocumentStats(documentId: string, options: { days?: number } = {}) {
      return request<DocumentStats>("GET", `/api/v1/stats${query({ documentId, days: options.days })}`);
    },
  };
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Checks a webhook delivery really came from the flipbook site: pass the request's raw body
 * (exactly as received, before JSON parsing), its Flipbook-Signature header, and your project's
 * signing secret. Rejects signatures older than `toleranceSeconds` to stop replays.
 *
 *   const raw = await req.text();
 *   if (!(await verifyWebhook(raw, req.headers.get("flipbook-signature"), process.env.FLIPBOOK_WEBHOOK_SECRET!))) {
 *     return new Response("Bad signature", { status: 400 });
 *   }
 *   const payload = JSON.parse(raw) as WebhookPayload;
 */
export async function verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string, toleranceSeconds = 300) {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(signatureHeader ?? "");
  if (!match) return false;
  const [, timestamp, signature] = match;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  // crypto.subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", key, hexToBytes(signature), encoder.encode(`${timestamp}.${rawBody}`));
}
