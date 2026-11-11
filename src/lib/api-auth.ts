import "server-only";
import { findActiveKey, touchKey } from "@/lib/api-projects";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ApiKey, ApiProject } from "@/db/schema";

const RATE_LIMIT_PER_MINUTE = 300;

/** The public API's error shape: a stable machine-readable code plus a human-readable message. */
export function apiError(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Authenticates a /api/v1 request by its secret key (`Authorization: Bearer fbsk_…`) and applies
 * the key's rate limit. Secret keys are for servers only: these responses carry no CORS headers,
 * so a browser page can't read them even if a key were (wrongly) put in front-end code.
 */
export async function requireApiKey(
  req: Request
): Promise<{ project: ApiProject; key: ApiKey; error: null } | { project: null; key: null; error: Response }> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) {
    return {
      project: null,
      key: null,
      error: apiError(401, "missing_api_key", "Send your secret key in the Authorization header: `Authorization: Bearer fbsk_…`."),
    };
  }

  const found = await findActiveKey(match[1]);
  if (!found) {
    return { project: null, key: null, error: apiError(401, "invalid_api_key", "This API key is not valid or has been revoked.") };
  }
  if (found.project.status !== "active") {
    return { project: null, key: null, error: apiError(403, "project_disabled", "This project has been disabled.") };
  }

  if (!(await checkRateLimit(`api-key:${found.key.id}`, RATE_LIMIT_PER_MINUTE, 60))) {
    return {
      project: null,
      key: null,
      error: apiError(429, "rate_limited", `Too many requests: the limit is ${RATE_LIMIT_PER_MINUTE} per minute per key.`, {
        "Retry-After": "60",
      }),
    };
  }

  await touchKey(found.key);
  return { project: found.project, key: found.key, error: null };
}
