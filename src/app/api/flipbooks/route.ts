import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { createDraftFlipbook, listFlipbooks } from "@/lib/flipbooks";
import { createPresignedUploadUrl, flipbookPdfKey } from "@/lib/r2";
import { newId } from "@/lib/ids";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const flipbooks = await listFlipbooks();
  return Response.json({ flipbooks });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, filename, contentType } = parsed.data;
  if (contentType !== "application/pdf") {
    return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  const flipbookId = newId("fb");
  const r2Key = flipbookPdfKey(flipbookId, filename);

  const flipbook = await createDraftFlipbook({
    id: flipbookId,
    ownerId: session!.user.id,
    title,
    originalFilename: filename,
    r2Key,
  });

  const uploadUrl = await createPresignedUploadUrl(r2Key, contentType);

  return Response.json({ flipbook, uploadUrl });
}
