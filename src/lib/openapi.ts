import "server-only";
import { z } from "zod";
import { BUILT_IN_SETTINGS, SETTING_DESCRIPTIONS, viewerSettingsSchema } from "@/lib/viewer-settings";

const HEX = "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$";

/** The display settings schema, generated from the same zod schema the API validates with. */
function settingsSchema(omitStartPage: boolean) {
  const schema = z.toJSONSchema(viewerSettingsSchema, { io: "input", unrepresentable: "any" }) as {
    properties: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
  };
  delete schema.$schema;
  for (const [name, prop] of Object.entries(schema.properties)) {
    const key = name as keyof typeof SETTING_DESCRIPTIONS;
    prop.description = SETTING_DESCRIPTIONS[key];
    prop.default = BUILT_IN_SETTINGS[key];
    // zod's case-insensitive flag doesn't survive into JSON Schema; spell it out.
    const set = (p: Record<string, unknown>) => p.pattern && (p.pattern = HEX);
    set(prop);
    (prop.anyOf as Record<string, unknown>[] | undefined)?.forEach(set);
  }
  if (omitStartPage) delete schema.properties.startPage;
  return schema;
}

const error = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const authErrors = {
  "401": error("Missing or invalid API key (missing_api_key, invalid_api_key)."),
  "403": error("The project is disabled (project_disabled)."),
  "429": error("Over the rate limit of 300 requests a minute per key (rate_limited). Retry-After says when to try again."),
};
const json = (schema: unknown, description: string) => ({ description, content: { "application/json": { schema } } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const counts = {
  type: "object",
  required: ["views", "pageViews", "linkClicks"],
  properties: { views: { type: "integer" }, pageViews: { type: "integer" }, linkClicks: { type: "integer" } },
};
const labelled = {
  type: "array",
  items: { type: "object", required: ["label", "views"], properties: { label: { type: "string" }, views: { type: "integer" } } },
};
const docRef = {
  type: "object",
  required: ["id", "title"],
  properties: { id: { type: "string", description: "Your own ID for the document." }, title: { type: "string" } },
};

export function openApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Flipbook API",
      version: "1",
      description:
        "Show PDFs from your own storage in the flipbook viewer, and get their stats back. Authenticate with your project's secret key — from your server only. Guide: " +
        `${origin}/docs`,
    },
    servers: [{ url: origin }],
    security: [{ secretKey: [] }],
    paths: {
      "/api/v1/viewer-tokens": {
        post: {
          operationId: "createViewerToken",
          summary: "Create a viewer link for a PDF",
          description:
            "Returns a viewer URL to show in an iframe (or with flipbook.js / the React component) on one of the project's allowed websites. The PDF must allow this site to fetch it (CORS).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["document"],
                  additionalProperties: false,
                  properties: {
                    document: {
                      type: "object",
                      required: ["id", "title", "url"],
                      additionalProperties: false,
                      properties: {
                        id: { type: "string", maxLength: 200, description: "Your own ID for the document; stats are reported against it." },
                        title: { type: "string", maxLength: 300 },
                        url: { type: "string", format: "uri", maxLength: 2000, description: "https address of the PDF." },
                      },
                    },
                    settings: { ...ref("ViewerSettings"), description: "Overrides the project's defaults for this link." },
                    expiresIn: { type: "integer", minimum: 60, maximum: 2592000, default: 86400, description: "Seconds until the link stops working." },
                  },
                },
                example: {
                  document: { id: "spring-2026", title: "Spring newsletter", url: "https://files.example.com/spring.pdf" },
                  settings: { headerColor: "#ffffff", headerTextColor: "#0f2044", showDownload: false },
                },
              },
            },
          },
          responses: {
            "201": json(
              {
                type: "object",
                required: ["token", "url", "expiresAt", "document", "settings"],
                properties: {
                  token: { type: "string" },
                  url: { type: "string", format: "uri", description: "The viewer URL to embed." },
                  expiresAt: { type: "string", format: "date-time" },
                  document: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, url: { type: "string" } } },
                  settings: { ...ref("ViewerSettings"), description: "Every setting, as the viewer will use it." },
                },
              },
              "The viewer link."
            ),
            "400": error("Invalid request (invalid_request); the message names the field."),
            ...authErrors,
          },
        },
      },
      "/api/v1/project": {
        get: {
          operationId: "getProject",
          summary: "Get the key's project",
          description: "Also a quick way to check a key works.",
          responses: {
            "200": json(
              {
                type: "object",
                properties: {
                  project: ref("Project"),
                  key: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, prefix: { type: "string" } } },
                },
              },
              "The project."
            ),
            ...authErrors,
          },
        },
        patch: {
          operationId: "setDefaultSettings",
          summary: "Replace the project's default display settings",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["defaultSettings"],
                  additionalProperties: false,
                  properties: { defaultSettings: ref("ProjectDefaultSettings") },
                },
              },
            },
          },
          responses: {
            "200": json({ type: "object", properties: { project: ref("Project") } }, "The updated project."),
            "400": error("Invalid request (invalid_request)."),
            ...authErrors,
          },
        },
      },
      "/api/v1/events": {
        get: {
          operationId: "listEvents",
          summary: "List events, oldest first",
          description: "Page with `after` = the previous response's nextCursor. Events are kept for 30 days.",
          parameters: [
            { name: "after", in: "query", schema: { type: "string", default: "0" }, description: "Cursor: return events after this one." },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
            { name: "documentId", in: "query", schema: { type: "string" }, description: "Only this document's events (your ID)." },
          ],
          responses: {
            "200": json(
              {
                type: "object",
                required: ["events", "nextCursor", "hasMore"],
                properties: {
                  events: { type: "array", items: ref("Event") },
                  nextCursor: { type: "string", description: "Pass as `after` next time (unchanged if there were no new events)." },
                  hasMore: { type: "boolean" },
                },
              },
              "A page of events."
            ),
            "400": error("Invalid after or limit (invalid_request)."),
            ...authErrors,
          },
        },
      },
      "/api/v1/stats": {
        get: {
          operationId: "getStats",
          summary: "Stats for the project, or one document",
          parameters: [
            { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 30, default: 30 } },
            { name: "documentId", in: "query", schema: { type: "string" }, description: "Your ID for a document, for its detailed stats." },
          ],
          responses: {
            "200": json(
              { anyOf: [ref("ProjectStats"), ref("DocumentStats")] },
              "ProjectStats without documentId; DocumentStats with it."
            ),
            "400": error("Invalid days (invalid_request)."),
            "404": error("No document with that ID has been shown (document_not_found)."),
            ...authErrors,
          },
        },
      },
    },
    webhooks: {
      events: {
        post: {
          operationId: "receiveEvents",
          summary: "Events delivered to your project's webhook",
          description:
            "Sent in order, in batches of up to 100, as events happen. Check the Flipbook-Signature header (t=<unix seconds>,v1=<hex HMAC-SHA256 of \"<t>.<raw body>\" with your signing secret>) and reply 2xx. Failed deliveries are retried with back-off; deliveries can repeat, so de-duplicate by event id.",
          parameters: [{ name: "Flipbook-Signature", in: "header", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: ref("WebhookPayload") } } },
          responses: { "200": { description: "Accepted. Any 2xx marks the batch delivered." } },
        },
      },
    },
    components: {
      securitySchemes: {
        secretKey: { type: "http", scheme: "bearer", description: "Your project's secret key (fbsk_…). Server-side only." },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
          },
        },
        ViewerSettings: settingsSchema(false),
        ProjectDefaultSettings: settingsSchema(true),
        Project: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            allowedOrigins: { type: "array", items: { type: "string" } },
            embedOnly: {
              type: "boolean",
              description: "Viewer links only show the document when embedded on allowedOrigins, not opened directly. Set in the dashboard.",
            },
            defaultSettings: ref("ProjectDefaultSettings"),
          },
        },
        Event: {
          type: "object",
          required: ["id", "sequence", "type", "occurredAt", "viewId", "document"],
          properties: {
            id: { type: "string", description: "Unique; use it to ignore repeats." },
            sequence: { type: "integer", description: "Increases with every event in the project." },
            type: { type: "string", enum: ["view.started", "page.viewed", "link.clicked"] },
            occurredAt: { type: "string", format: "date-time" },
            viewId: { type: "string", description: "Groups the events of one visit." },
            document: docRef,
            pageNumber: { type: "integer", description: "page.viewed and link.clicked." },
            url: { type: "string", description: "link.clicked: the link's address." },
            visitor: {
              type: "object",
              description: "view.started only.",
              properties: {
                deviceType: { type: ["string", "null"], enum: ["mobile", "tablet", "desktop", null] },
                browser: { type: ["string", "null"] },
                country: { type: ["string", "null"], description: "ISO country code." },
                region: { type: ["string", "null"] },
                referrer: { type: "string", description: "The embedding page (usually just its origin)." },
              },
            },
          },
        },
        WebhookPayload: {
          type: "object",
          required: ["project", "events"],
          properties: {
            project: { type: "object", properties: { id: { type: "string" } } },
            test: { type: "boolean", description: "true for \"Send test event\" from the dashboard." },
            events: { type: "array", items: ref("Event") },
          },
        },
        ProjectStats: {
          type: "object",
          properties: {
            days: { type: "integer" },
            totals: counts,
            documents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  document: docRef,
                  views: { type: "integer" },
                  pageViews: { type: "integer" },
                  linkClicks: { type: "integer" },
                  lastViewedAt: { type: ["string", "null"], format: "date-time" },
                },
              },
            },
          },
        },
        DocumentStats: {
          type: "object",
          properties: {
            days: { type: "integer" },
            document: docRef,
            totals: counts,
            viewsByDay: { type: "array", items: { type: "object", properties: { date: { type: "string", format: "date" }, views: { type: "integer" } } } },
            pages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pageNumber: { type: "integer" },
                  views: { type: "integer" },
                  viewers: { type: "integer", description: "Distinct visits that reached the page." },
                },
              },
            },
            links: { type: "array", items: { type: "object", properties: { url: { type: "string" }, clicks: { type: "integer" } } } },
            devices: labelled,
            browsers: labelled,
            countries: labelled,
          },
        },
      },
    },
  };
}
