/**
 * A ready-made prompt for an AI coding assistant working in one of your other projects: where
 * to read about this API, and what to build. Shown on /docs with a copy button.
 */
export function integrationPrompt(origin: string) {
  return `I want to add document viewing to this project using the flipbook service at ${origin}. It shows PDFs that this project already stores (by their URL) in a hosted flipbook viewer embedded in our pages, and reports views, page views and link clicks back to us.

Before writing any code, read the documentation:
- ${origin}/llms.txt — the complete guide in plain text. Start here.
- ${origin}/openapi.json — exact request and response schemas.
- ${origin}/sdk/v1/flipbook-server.ts — typed API client and verifyWebhook(), to copy into this project.
- ${origin}/sdk/v1/flipbook-react.tsx (React/Next.js) or ${origin}/sdk/v1/flipbook.js (any other site) — to show the viewer.

Then:
1. Look through this codebase to understand its framework, how documents/PDFs are stored and modelled, its database and ORM, how it handles environment variables, and whether it has scheduled jobs. Ask me about anything you can't work out rather than guessing.
2. Give me a short plan before changing anything.
3. Build the full integration:
   a. Server side: create a viewer link with POST /api/v1/viewer-tokens whenever a document is shown, using the secret key from the FLIPBOOK_API_KEY environment variable. The key must never reach the browser. Use this project's own ID for each document as document.id, and pass the full URL of the page the viewer appears on as pageUrl (someone who opens the viewer link on its own is sent back there).
   b. Show the viewer link where documents are displayed, with the React component or flipbook.js.
   c. Stats: add a table for flipbook events; a webhook endpoint that checks the Flipbook-Signature header with verifyWebhook() and the FLIPBOOK_WEBHOOK_SECRET environment variable, then stores events keyed by event id, ignoring ones it already has; and a catch-up sync using GET /api/v1/events with a saved cursor, for anything the webhook missed.
4. Finish by telling me what to do outside the code: environment variables to set (the API key and webhook signing secret come from this project's page under Developers on the flipbook site), the website addresses to add to this project on the flipbook site's Developers page, the webhook URL to enter there, and the CORS rule our PDF storage needs so ${origin} can fetch the PDFs.

Follow this project's existing conventions, and don't change how documents are stored or uploaded.`;
}
