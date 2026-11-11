import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { BUILT_IN_SETTINGS, SETTING_DESCRIPTIONS } from "@/lib/viewer-settings";
import { integrationPrompt } from "@/lib/ai-prompt";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = {
  title: "API docs",
  description: "Show PDFs from your own projects in the flipbook viewer, and get their stats back.",
};

const sections = [
  ["how-it-works", "How it works"],
  ["ai-assistant", "With an AI assistant"],
  ["quick-start", "Quick start"],
  ["keys", "Keys and limits"],
  ["viewer-tokens", "Viewer links"],
  ["settings", "Display settings"],
  ["embedding", "Showing the viewer"],
  ["viewer-events", "Viewer events"],
  ["webhooks", "Stats: webhooks"],
  ["events-api", "Stats: events API"],
  ["stats-api", "Stats: summaries"],
  ["errors", "Errors"],
  ["kit", "Downloads"],
] as const;

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="mt-3">
      {label && <p className="mb-1 text-xs font-semibold text-gray-400">{label}</p>}
      <pre className="overflow-x-auto rounded-xl bg-navy-900 px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-gray-100">{children.trim()}</pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-bold tracking-tight text-navy-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

const c = (text: string) => <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-navy-900">{text}</code>;

function formatDefault(value: unknown) {
  return value === null ? "null" : typeof value === "string" ? `"${value}"` : String(value);
}

export default async function DocsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "newsletter.smithtonchurch.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const prompt = integrationPrompt(origin);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
          <Link href="/">
            <Logo size={22} textClassName="text-base" />
          </Link>
          <span className="text-sm font-semibold text-gray-500">API docs</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-12 px-6 py-10">
        <nav className="sticky top-8 hidden h-fit w-48 shrink-0 lg:block" aria-label="Sections">
          <ul className="space-y-1.5 text-sm">
            {sections.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-gray-500 hover:text-navy-900">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 space-y-10 pb-24">
          <div>
            <h1 className="text-[32px] font-bold tracking-tight text-navy-900">Flipbook API</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
              Show PDFs from your other websites and apps in this site&apos;s flipbook viewer, and get their stats back into your
              own database. The PDFs stay in your project&apos;s own storage.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Machine-readable: <a className="font-semibold text-blue-600 hover:text-navy-700" href="/openapi.json">/openapi.json</a>{" "}
              (OpenAPI 3.1) and <a className="font-semibold text-blue-600 hover:text-navy-700" href="/llms.txt">/llms.txt</a> (this
              guide as plain text, for AI tools).
            </p>
          </div>

          <Section id="how-it-works" title="How it works">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Someone with developer access creates a <strong>project</strong> for your site under Developers in the dashboard,
                lists the websites the
                viewer may appear on, and creates a <strong>secret key</strong>.
              </li>
              <li>
                When your site wants to show a PDF, <strong>its server</strong> asks for a <strong>viewer link</strong> with that key,
                saying which PDF (by address), its title, your own ID for it, and optionally how it should look.
              </li>
              <li>
                Your page shows the link in an iframe — directly, with <strong>flipbook.js</strong>, or with the{" "}
                <strong>React component</strong>. It only displays on your project&apos;s listed websites.
              </li>
              <li>
                Every view, page turned and link clicked is recorded against your ID for the document, kept here for 30 days, and{" "}
                <strong>sent to your server</strong> by webhook — or fetched by it from the events API.
              </li>
            </ol>
          </Section>

          <Section id="ai-assistant" title="With an AI assistant">
            <p>
              Using an AI coding assistant (Claude Code, Cursor, Copilot and so on) in your other project? Paste it this prompt. It
              points the assistant at the plain-text guide <a className="font-semibold text-blue-600 hover:text-navy-700" href="/llms.txt">/llms.txt</a>,
              the API description and the ready-made code, then has it look through your project, plan, and build the whole
              integration: showing documents in the viewer and storing their stats in your own database.
            </p>
            <div className="rounded-xl border border-gray-200">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                <span className="text-xs font-semibold text-gray-500">Prompt</span>
                <CopyButton text={prompt} label="Copy prompt" />
              </div>
              <pre id="ai-prompt" className="max-h-96 overflow-y-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-gray-800">
                {prompt}
              </pre>
            </div>
            <p className="text-sm text-gray-500">
              Before you start, have the project created on this site&apos;s Developers page so you have its secret key to hand. The
              assistant will tell you what else to set up at the end.
            </p>
          </Section>

          <Section id="quick-start" title="Quick start">
            <p>1. On your server, get a viewer link (keep the key in an environment variable):</p>
            <Code>{`
curl -X POST ${origin}/api/v1/viewer-tokens \\
  -H "Authorization: Bearer $FLIPBOOK_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"document": {"id": "spring-2026", "title": "Spring newsletter", "url": "https://files.example.com/spring.pdf"}}'
`}</Code>
            <p>2. Put the {c("url")} from the response on your page:</p>
            <Code>{`<iframe src="VIEWER_URL" allow="fullscreen" style="width:100%;height:720px;border:0"></iframe>`}</Code>
            <p>
              3. Allow this site to fetch your PDFs. The viewer runs at {c(origin)} and loads the PDF from there, so your storage needs a
              CORS rule allowing {c("GET")} from {c(origin)}. For Cloudflare R2 or S3:
            </p>
            <Code>{`[{ "AllowedOrigins": ["${origin}"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] }]`}</Code>
            <p>Without it the viewer shows “Failed to load this PDF”.</p>
          </Section>

          <Section id="keys" title="Keys and limits">
            <p>
              Send your secret key as {c("Authorization: Bearer fbsk_…")} on every {c("/api/v1")} request. Keys are for{" "}
              <strong>servers only</strong>: these endpoints don&apos;t allow browser requests from other sites (no CORS), and anyone
              with a key can create links and read your stats. Create one key per environment so you can revoke one without the
              other.
            </p>
            <p>
              Each key may make <strong>300 requests a minute</strong>; past that you get {c("429")} with {c("Retry-After")}. Turning
              a project off in the dashboard stops all its keys and viewer links until it&apos;s turned back on.
            </p>
          </Section>

          <Section id="viewer-tokens" title="Viewer links">
            <p>
              {c("POST /api/v1/viewer-tokens")} — body: {c("document")} ({c("id")}, {c("title")}, {c("url")} — required), {c("settings")}{" "}
              (optional, below) and {c("expiresIn")} (optional, seconds, 60 to 2592000; default one day).
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                {c("document.id")} is <em>your</em> ID for the document — stats come back labelled with it. Re-using it updates the
                title and address on file.
              </li>
              <li>{c("document.url")} must be a full https address. The viewer fetches it from the visitor&apos;s browser.</li>
              <li>
                Create a link when you render the page, or cache one and renew it before {c("expiresAt")}. An expired link shows
                “This document link has expired”.
              </li>
            </ul>
            <Code label="Response (201)">{`
{
  "token": "vt_…",
  "url": "${origin}/v1/view/vt_…",
  "expiresAt": "2026-11-12T14:00:00.000Z",
  "document": { "id": "spring-2026", "title": "Spring newsletter", "url": "https://files.example.com/spring.pdf" },
  "settings": { "backgroundColor": "#0f2044", "showDownload": true, … }
}
`}</Code>
          </Section>

          <Section id="settings" title="Display settings">
            <p>
              Each setting comes from the viewer link if given, otherwise the <strong>project default</strong>, otherwise the built-in
              default below. Set project defaults on the project&apos;s page in the dashboard, or with{" "}
              {c('PATCH /api/v1/project {"defaultSettings": {…}}')} (replaces them all). Use {c("null")} on a link to clear a
              default, e.g. {c('"logoUrl": null')}. Unknown settings are rejected, so typos don&apos;t pass silently.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-[13.5px]">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5">Setting</th>
                    <th className="px-4 py-2.5">Default</th>
                    <th className="px-4 py-2.5">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Object.keys(SETTING_DESCRIPTIONS) as Array<keyof typeof SETTING_DESCRIPTIONS>).map((key) => (
                    <tr key={key}>
                      <td className="px-4 py-2.5 font-mono text-[12.5px] text-navy-900">{key}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px] text-gray-500">{formatDefault(BUILT_IN_SETTINGS[key])}</td>
                      <td className="px-4 py-2.5 text-gray-600">{SETTING_DESCRIPTIONS[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="embedding" title="Showing the viewer">
            <p>
              The viewer only appears on the websites listed on your project (the browser enforces this). Add{" "}
              {c("http://localhost:3000")} (or your port) while developing. Give it {c('allow="fullscreen"')} so the full screen button
              works.
            </p>
            <p>
              By default a viewer link also only works <strong>embedded</strong>: opened on its own in a browser tab (say, copied and
              shared), it shows “This document can only be viewed on the website it&apos;s published on” instead. Turn off “Only show
              documents on these websites” on the project&apos;s page if you want links to open directly too. This stops casual sharing
              of links; it doesn&apos;t make the PDF secret, since visitors&apos; browsers load it from your storage either way.
            </p>
            <p className="font-semibold text-navy-900">Any website — flipbook.js</p>
            <Code>{`
<div data-flipbook-url="VIEWER_URL" data-flipbook-height="720"></div>
<script src="${origin}/sdk/v1/flipbook.js" async></script>

<!-- or from your own script, to listen for events -->
<script>
  const viewer = Flipbook.mount("#newsletter", { url: VIEWER_URL, height: "80vh" });
  viewer.on("pagechange", (e) => console.log("page", e.pageNumber, "of", e.pageCount));
</script>
`}</Code>
            <p className="font-semibold text-navy-900">React / Next.js</p>
            <p>
              Copy <a className="font-semibold text-blue-600 hover:text-navy-700" href="/sdk/v1/flipbook-react.tsx">flipbook-react.tsx</a> and{" "}
              <a className="font-semibold text-blue-600 hover:text-navy-700" href="/sdk/v1/flipbook-server.ts">flipbook-server.ts</a> into your
              project. Create the link on the server, show it with the component:
            </p>
            <Code label="app/newsletters/[id]/page.tsx">{`
import { createFlipbookClient } from "@/lib/flipbook-server";
import { Flipbook } from "@/components/flipbook-react";

const flipbook = createFlipbookClient({ apiKey: process.env.FLIPBOOK_API_KEY!, baseUrl: "${origin}" });

export default async function NewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const newsletter = await getNewsletter((await params).id); // from your own database
  const { url } = await flipbook.createViewerToken({
    document: { id: newsletter.id, title: newsletter.title, url: newsletter.pdfUrl },
    settings: { showDownload: false },
  });
  return <Flipbook url={url} height="80vh" />;
}
`}</Code>
            <p>
              {c("<Flipbook>")} takes {c("url")}, {c("height")}, {c("title")}, {c("className")}, {c("style")} and the event callbacks{" "}
              {c("onReady")}, {c("onPageChange")}, {c("onLinkClick")}. It&apos;s a client component; render it from a server component
              as above, or pass it a URL fetched from your own API route.
            </p>
          </Section>

          <Section id="viewer-events" title="Viewer events">
            <p>
              The viewer tells the page it&apos;s on what the visitor does, through {c("postMessage")} to that page&apos;s origin only. All
              three carry {c("pageNumber")} and {c("pageCount")}; {c("linkclick")} adds {c("url")}.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{c("ready")} — the PDF has loaded and the first page is showing.</li>
              <li>{c("pagechange")} — a page is shown (including the first).</li>
              <li>{c("linkclick")} — a link inside the PDF was clicked.</li>
            </ul>
            <p>
              flipbook.js and the React component handle the messages for you. With flipbook.js the container element also gets{" "}
              {c("flipbook:ready")}, {c("flipbook:pagechange")} and {c("flipbook:linkclick")} DOM events. With a plain iframe, check{" "}
              {c("event.origin")} is {c(origin)} and {c('event.data.source === "flipbook"')}.
            </p>
          </Section>

          <Section id="webhooks" title="Stats: webhooks">
            <p>
              Set a webhook address on the project&apos;s page in the dashboard to have every event POSTed to your server as it happens,
              so it can store them in your own database. The dashboard shows your <strong>signing secret</strong>, can send a test
              event, and lists recent deliveries. The address must be public https: one that is, or points through DNS to, a
              private network address is refused, both when it&apos;s saved and on every delivery.
            </p>
            <Code label="Request body">{`
{
  "project": { "id": "proj_…" },
  "events": [
    { "id": "aview_…_start", "sequence": 41, "type": "view.started", "occurredAt": "2026-11-11T14:02:11.384Z",
      "viewId": "aview_…", "document": { "id": "spring-2026", "title": "Spring newsletter" },
      "visitor": { "deviceType": "mobile", "browser": "Safari", "country": "GB", "region": "SCT", "referrer": "https://youth.example.com/" } },
    { "id": "aevt_…", "sequence": 42, "type": "page.viewed", "occurredAt": "…", "viewId": "aview_…",
      "document": { "id": "spring-2026", "title": "Spring newsletter" }, "pageNumber": 1 },
    { "id": "aevt_…", "sequence": 43, "type": "link.clicked", "occurredAt": "…", "viewId": "aview_…",
      "document": { "id": "spring-2026", "title": "Spring newsletter" }, "pageNumber": 2, "url": "https://example.com/" }
  ]
}
`}</Code>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Check the signature.</strong> {c("Flipbook-Signature: t=<unix seconds>,v1=<hex>")} where hex is the HMAC-SHA256
                of {c("<t>.<raw body>")} with your signing secret. Reject a mismatch or a timestamp more than 5 minutes off.{" "}
                {c("verifyWebhook()")} in flipbook-server.ts does this.
              </li>
              <li>
                <strong>Reply 2xx</strong> within 10 seconds. Anything else counts as a failure, including redirects, which
                aren&apos;t followed.
              </li>
              <li>
                Events arrive <strong>in order</strong>, up to 100 per request. A failed batch is retried (after 1, 5, 30 minutes, then
                up to every 12 hours) and later events wait behind it, so nothing is skipped. Store events by {c("id")} and ignore
                repeats — a batch can occasionally arrive twice.
              </li>
              <li>Deliveries start from when the webhook is turned on. Use the events API for anything earlier.</li>
            </ul>
            <Code label="Next.js route handler">{`
import { verifyWebhook, type WebhookPayload } from "@/lib/flipbook-server";

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = await verifyWebhook(raw, req.headers.get("flipbook-signature"), process.env.FLIPBOOK_WEBHOOK_SECRET!);
  if (!ok) return new Response("Bad signature", { status: 400 });

  const { events } = JSON.parse(raw) as WebhookPayload;
  for (const event of events) await saveEvent(event); // your database; skip ids you already have
  return new Response("ok");
}
`}</Code>
          </Section>

          <Section id="events-api" title="Stats: events API">
            <p>
              {c("GET /api/v1/events?after=<cursor>&limit=<1–500>&documentId=<your id>")} returns events oldest first, the same shape as
              webhooks. Save {c("nextCursor")} and pass it as {c("after")} next time; keep going while {c("hasMore")} is true. Good
              for a scheduled sync, catching up after downtime, or skipping webhooks altogether. Events are kept for 30 days.
            </p>
            <Code>{`
const flipbook = createFlipbookClient({ apiKey: process.env.FLIPBOOK_API_KEY! });
let cursor = await loadCursor(); // e.g. from your database, "0" the first time
for await (const { event, cursor: next } of flipbook.allEvents(cursor)) {
  await saveEvent(event);
  cursor = next;
}
await saveCursor(cursor);
`}</Code>
          </Section>

          <Section id="stats-api" title="Stats: summaries">
            <p>
              {c("GET /api/v1/stats?days=<1–30>")} — views, page views and link clicks per document. Add {c("documentId")} for one
              document in detail: views by day, each page&apos;s views and visitors, links clicked, and devices, browsers and countries.
            </p>
          </Section>

          <Section id="errors" title="Errors">
            <p>Errors have one shape, with a stable {c("code")} to check and a {c("message")} for people:</p>
            <Code>{`{ "error": { "code": "invalid_request", "message": "settings.backgroundColor: Use a hex colour like #0f2044." } }`}</Code>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-[13.5px]">
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["400", "invalid_request", "The body or a parameter is wrong; the message names the field."],
                    ["401", "missing_api_key", "No Authorization: Bearer header."],
                    ["401", "invalid_api_key", "The key is wrong or revoked."],
                    ["403", "project_disabled", "The project is turned off."],
                    ["404", "document_not_found", "Stats asked for a document ID that's never been shown."],
                    ["429", "rate_limited", "Over 300 requests a minute for this key."],
                  ].map(([status, code, what]) => (
                    <tr key={code}>
                      <td className="px-4 py-2.5 font-mono text-[12.5px] text-gray-500">{status}</td>
                      <td className="px-4 py-2.5 font-mono text-[12.5px] text-navy-900">{code}</td>
                      <td className="px-4 py-2.5 text-gray-600">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="kit" title="Downloads">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <a className="font-semibold text-blue-600 hover:text-navy-700" href="/sdk/v1/flipbook.js">flipbook.js</a> — embed script for
                any website (load it from here).
              </li>
              <li>
                <a className="font-semibold text-blue-600 hover:text-navy-700" href="/sdk/v1/flipbook-react.tsx">flipbook-react.tsx</a> — React
                component (copy into your project).
              </li>
              <li>
                <a className="font-semibold text-blue-600 hover:text-navy-700" href="/sdk/v1/flipbook-server.ts">flipbook-server.ts</a> —
                typed API client and {c("verifyWebhook()")} for your server, no dependencies (copy into your project).
              </li>
              <li>
                <a className="font-semibold text-blue-600 hover:text-navy-700" href="/llms.txt">llms.txt</a> — this guide as plain text, for
                AI coding assistants.
              </li>
              <li>
                <a className="font-semibold text-blue-600 hover:text-navy-700" href="/openapi.json">openapi.json</a> — for API tools and code
                generators.
              </li>
            </ul>
            <p className="text-sm text-gray-500">
              Files under {c("/sdk/v1/")} only change in backwards-compatible ways; anything breaking would go to {c("/sdk/v2/")}.
            </p>
          </Section>
        </main>
      </div>
    </div>
  );
}
