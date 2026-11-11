import { BUILT_IN_SETTINGS, SETTING_DESCRIPTIONS } from "@/lib/viewer-settings";

const fmt = (v: unknown) => (v === null ? "null" : typeof v === "string" ? `"${v}"` : String(v));

/**
 * /llms.txt: the whole API guide as plain Markdown, for AI coding assistants (which read plain
 * text far more reliably than a styled page). Generated, so settings and addresses stay current.
 */
export function llmsTxt(origin: string) {
  const settings = (Object.keys(SETTING_DESCRIPTIONS) as Array<keyof typeof SETTING_DESCRIPTIONS>)
    .map((k) => `- \`${k}\` (default ${fmt(BUILT_IN_SETTINGS[k])}): ${SETTING_DESCRIPTIONS[k]}`)
    .join("\n");

  return `# Flipbook API

> Show PDFs that your project stores (by URL) in a hosted flipbook viewer embedded in your pages, and get views, page views and link clicks back into your own database. Base URL: ${origin}

Machine-readable schemas: ${origin}/openapi.json (OpenAPI 3.1). Human-readable guide: ${origin}/docs.

## Ready-made code (copy into the project)

- ${origin}/sdk/v1/flipbook-server.ts — server-side: typed API client \`createFlipbookClient({ apiKey, baseUrl })\` and \`verifyWebhook(rawBody, signatureHeader, secret)\`. No dependencies; Node 18+, Next.js, edge runtimes.
- ${origin}/sdk/v1/flipbook-react.tsx — client component \`<Flipbook url height title className style onReady onPageChange onLinkClick />\`.
- ${origin}/sdk/v1/flipbook.js — for any website: \`<div data-flipbook-url="VIEWER_URL" data-flipbook-height="720"></div>\` plus \`<script src="${origin}/sdk/v1/flipbook.js" async></script>\`, or \`Flipbook.mount(elementOrSelector, { url, height, title, onReady, onPageChange, onLinkClick })\` returning \`{ iframe, on, off, destroy }\`.

When using flipbook-server.ts pass \`baseUrl: "${origin}"\`.

## How it works

1. Someone with access creates a project for your site on ${origin} (Developers page), lists the website origins the viewer may appear on (e.g. https://example.com, https://*.example.com, http://localhost:3000 for development) and creates a secret API key (\`fbsk_…\`). That page also shows the webhook signing secret (\`whsec_…\`) once a webhook URL is set.
2. When a page shows a document, your SERVER calls POST /api/v1/viewer-tokens with the key, the PDF's URL, its title and your own ID for it, and gets a viewer URL back.
3. Your page shows the viewer URL in an iframe (directly, with flipbook.js, or with the React component).
4. Every view, page view and link click is recorded against your document ID, kept on ${origin} for 30 days, POSTed to your webhook, and available from GET /api/v1/events.

## Requirements and gotchas

- The secret key is server-only. Never put it in browser code. /api/v1 responses have no CORS headers.
- The viewer only displays inside iframes on the project's listed website origins (Content-Security-Policy frame-ancestors). Add http://localhost:PORT while developing.
- By default a project is "embedded-only": a viewer URL opened directly in a browser tab shows "This document can only be viewed on the website it's published on" instead of the document. This can be turned off on the project's page.
- The viewer runs at ${origin} and fetches the PDF in the visitor's browser, so the PDF's storage must allow CORS GET from ${origin}, e.g. for S3/R2: \`[{ "AllowedOrigins": ["${origin}"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] }]\`. Without it the viewer shows "Failed to load this PDF".
- PDF URLs must be https (http only for localhost). Give the iframe \`allow="fullscreen"\`.
- Viewer URLs expire (default 1 day). Create one when rendering the page, or cache and renew before \`expiresAt\`.
- Rate limit: 300 requests per minute per key (429 with Retry-After).

## Authentication

Every /api/v1 request: \`Authorization: Bearer fbsk_…\`.

## POST /api/v1/viewer-tokens

Request JSON:
- \`document\` (required): \`{ "id": string (your ID, max 200), "title": string (max 300), "url": string (https URL of the PDF) }\`. Reusing an id updates its title and URL.
- \`settings\` (optional): display settings below; override the project's defaults for this link.
- \`expiresIn\` (optional): seconds, 60–2592000, default 86400.

Response 201: \`{ "token": "vt_…", "url": "${origin}/v1/view/vt_…", "expiresAt": ISO date, "document": {…}, "settings": {every setting as the viewer will use it} }\`. Embed \`url\`.

Example:
\`\`\`
curl -X POST ${origin}/api/v1/viewer-tokens \\
  -H "Authorization: Bearer $FLIPBOOK_API_KEY" -H "Content-Type: application/json" \\
  -d '{"document": {"id": "spring-2026", "title": "Spring newsletter", "url": "https://files.example.com/spring.pdf"}, "settings": {"showDownload": false}}'
\`\`\`

## Display settings

Precedence: the viewer link's \`settings\`, then the project's defaults, then these built-in defaults. \`null\` on a link clears a project default (e.g. \`"logoUrl": null\`). Unknown keys are rejected with 400. Colours are hex (#0f2044). URLs are https.

${settings}

## Project: GET and PATCH /api/v1/project

GET returns \`{ "project": { "id", "name", "allowedOrigins", "embedOnly", "defaultSettings" }, "key": { "id", "name", "prefix" } }\` — also a quick way to test a key.
PATCH \`{ "defaultSettings": {…} }\` replaces the project's default display settings (all settings except startPage).

## Showing the viewer

Next.js server component example:
\`\`\`tsx
import { createFlipbookClient } from "@/lib/flipbook-server";
import { Flipbook } from "@/components/flipbook-react";

const flipbook = createFlipbookClient({ apiKey: process.env.FLIPBOOK_API_KEY!, baseUrl: "${origin}" });

export default async function NewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const newsletter = await getNewsletter((await params).id); // from your own database
  const { url } = await flipbook.createViewerToken({
    document: { id: newsletter.id, title: newsletter.title, url: newsletter.pdfUrl },
  });
  return <Flipbook url={url} height="80vh" />;
}
\`\`\`

Plain iframe: \`<iframe src="VIEWER_URL" allow="fullscreen" style="width:100%;height:720px;border:0"></iframe>\`.

## Viewer events (in the browser)

The viewer posts messages to the embedding page's origin only: \`{ source: "flipbook", type: "ready" | "pagechange" | "linkclick", pageNumber, pageCount, url? }\`. flipbook.js and the React component handle these (callbacks; flipbook.js also dispatches \`flipbook:ready\`, \`flipbook:pagechange\`, \`flipbook:linkclick\` DOM events on the container). With a plain iframe, check \`event.origin === "${origin}"\` and \`event.data.source === "flipbook"\`.

## Event shape (webhooks and events API)

\`\`\`
{
  "id": "aevt_…",            // unique — store by this and ignore repeats
  "sequence": 42,            // increases with every event in the project
  "type": "view.started" | "page.viewed" | "link.clicked",
  "occurredAt": "2026-11-11T14:02:11.384Z",
  "viewId": "aview_…",       // groups the events of one visit
  "document": { "id": "your-id", "title": "…" },
  "pageNumber": 2,           // page.viewed and link.clicked
  "url": "https://…",        // link.clicked
  "visitor": { "deviceType": "mobile" | "tablet" | "desktop" | null, "browser": string | null, "country": string | null, "region": string | null, "referrer": string }  // view.started only
}
\`\`\`

## Webhooks

Set the webhook URL on the project's page on ${origin} (Developers). It must be public https; addresses that are, or resolve to, private networks are refused.

- POST body: \`{ "project": { "id": "proj_…" }, "test"?: true, "events": [Event, …] }\` — in order, up to 100 events per request, sent as they happen.
- Header \`Flipbook-Signature: t=<unix seconds>,v1=<hex>\` where hex = HMAC-SHA256 of \`"<t>.<raw request body>"\` with the signing secret. Verify against the RAW body before parsing, and reject timestamps more than 5 minutes off. \`verifyWebhook()\` in flipbook-server.ts does this.
- Reply with any 2xx within 10 seconds. Anything else (including redirects, which aren't followed) is a failure: the batch is retried with back-off (about 1, 5, 30 minutes, then up to every 12 hours) and later events wait behind it, so nothing is skipped. A batch can occasionally arrive twice — de-duplicate by event id.
- Deliveries start from when the webhook was turned on; use the events API for anything earlier.

Next.js route handler example:
\`\`\`ts
import { verifyWebhook, type WebhookPayload } from "@/lib/flipbook-server";

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = await verifyWebhook(raw, req.headers.get("flipbook-signature"), process.env.FLIPBOOK_WEBHOOK_SECRET!);
  if (!ok) return new Response("Bad signature", { status: 400 });
  const { events } = JSON.parse(raw) as WebhookPayload;
  for (const event of events) await saveEvent(event); // insert, skipping ids already stored
  return new Response("ok");
}
\`\`\`

## GET /api/v1/events

Query: \`after\` (cursor, default "0"), \`limit\` (1–500, default 100), \`documentId\` (your ID, optional). Returns \`{ "events": [Event…], "nextCursor": string, "hasMore": boolean }\`, oldest first. Save \`nextCursor\` and pass it as \`after\` next time; repeat while \`hasMore\`. Events are kept 30 days. flipbook-server.ts: \`listEvents()\` and the async iterator \`allEvents(cursor)\`.

## GET /api/v1/stats

Query: \`days\` (1–30, default 30), optional \`documentId\`.
- Without documentId: \`{ "days", "totals": { "views", "pageViews", "linkClicks" }, "documents": [{ "document": { "id", "title" }, "views", "pageViews", "linkClicks", "lastViewedAt" }] }\`.
- With documentId: \`{ "days", "document", "totals", "viewsByDay": [{ "date", "views" }], "pages": [{ "pageNumber", "views", "viewers" }], "links": [{ "url", "clicks" }], "devices", "browsers", "countries": [{ "label", "views" }] }\`. 404 \`document_not_found\` if that ID has never been shown.

## Errors

All errors: \`{ "error": { "code": string, "message": string } }\`.
- 400 \`invalid_request\` — the message names the field.
- 401 \`missing_api_key\`, \`invalid_api_key\`.
- 403 \`project_disabled\`.
- 404 \`document_not_found\` (stats).
- 429 \`rate_limited\`.
flipbook-server.ts throws \`FlipbookApiError\` with \`status\`, \`code\` and \`message\`.
`;
}
