import { z } from "zod";
import { apiError, requireApiKey } from "@/lib/api-auth";
import { createViewerToken } from "@/lib/api-viewer";
import { describeZodError, isSafeUrl, resolveViewerSettings, viewerSettingsSchema } from "@/lib/viewer-settings";
import { isAllowedOrigin } from "@/lib/origins";

const DEFAULT_EXPIRES_IN = 60 * 60 * 24; // 1 day
const MAX_EXPIRES_IN = 60 * 60 * 24 * 30; // 30 days

const idMessage = "Give the document's ID in your own system.";
const titleMessage = "Give the document a title.";
const urlMessage = "Use a full https:// address for the PDF.";

const bodySchema = z
  .object({
    document: z
      .object({
        id: z.string({ error: idMessage }).trim().min(1, idMessage).max(200),
        title: z.string({ error: titleMessage }).trim().min(1, titleMessage).max(300),
        url: z.string({ error: urlMessage }).max(2000).refine(isSafeUrl, urlMessage),
      }, { error: "Describe the PDF to show: { id, title, url }." })
      .strict(),
    settings: viewerSettingsSchema.default({}),
    // The page the viewer will be embedded on. Someone who opens the viewer link on its own is
    // sent back here (when the project only allows embedding).
    pageUrl: z.string().max(2000).refine(isSafeUrl, "Use the full https:// address of the page.").optional(),
    expiresIn: z.number().int().min(60).max(MAX_EXPIRES_IN).default(DEFAULT_EXPIRES_IN),
  })
  .strict();

/**
 * Creates a viewer token: permission to open one PDF (from the project's own storage) in the
 * hosted viewer, with its display settings. Returns the viewer URL to put in an iframe.
 */
export async function POST(req: Request) {
  const { project, error } = await requireApiKey(req);
  if (error) return error;

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return apiError(400, "invalid_request", "Send a JSON body.");
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError(400, "invalid_request", describeZodError(parsed.error));

  const { document, settings, pageUrl, expiresIn } = parsed.data;
  if (pageUrl && !isAllowedOrigin(pageUrl, project.allowedOrigins)) {
    return apiError(400, "invalid_request", "pageUrl: That page isn't on one of this project's websites.");
  }
  const { token, expiresAt } = await createViewerToken(project.id, { document, settings, pageUrl: pageUrl ?? null, expiresInSeconds: expiresIn });

  return Response.json(
    {
      token,
      url: `${new URL(req.url).origin}/v1/view/${token}`,
      expiresAt: expiresAt.toISOString(),
      document: { id: document.id, title: document.title, url: document.url },
      pageUrl: pageUrl ?? null,
      settings: resolveViewerSettings(project.defaultSettings ?? {}, settings),
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
