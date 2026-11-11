import { openApiDocument } from "@/lib/openapi";

/** The API description (OpenAPI 3.1). Public, and readable cross-origin so API tools can load it. */
export async function GET(req: Request) {
  return Response.json(openApiDocument(new URL(req.url).origin), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" },
  });
}
