import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getFlipbookBySlug, recordView } from "@/lib/flipbooks";
import { flipbookAccessCookieName, verifyFlipbookAccessToken } from "@/lib/access-token";
import { createPresignedGetUrl } from "@/lib/r2";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const flipbook = await getFlipbookBySlug(slug);

  if (!flipbook || flipbook.status !== "ready") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (flipbook.isPrivate) {
    const cookieStore = await cookies();
    const token = cookieStore.get(flipbookAccessCookieName(flipbook.id))?.value;
    if (!verifyFlipbookAccessToken(flipbook.id, token)) {
      return Response.json({ error: "Locked" }, { status: 401 });
    }
  }

  const source = req.nextUrl.searchParams.get("source") === "embed" ? "embed" : "direct";
  const referrer = req.headers.get("referer") ?? "";
  await recordView(flipbook.id, referrer, source);

  const url = await createPresignedGetUrl(flipbook.r2Key, 900);
  return Response.json({ url, allowDownload: flipbook.allowDownload, allowPrint: flipbook.allowPrint });
}
