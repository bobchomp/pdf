import { llmsTxt } from "@/lib/llms-txt";

/** The API guide as plain Markdown for AI coding assistants (the llms.txt convention). */
export async function GET(req: Request) {
  return new Response(llmsTxt(new URL(req.url).origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
