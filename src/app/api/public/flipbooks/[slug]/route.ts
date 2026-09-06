import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getFlipbookBySlug } from "@/lib/flipbooks";
import { flipbookAccessCookieName, verifyFlipbookAccessToken } from "@/lib/access-token";
import { createPresignedGetUrl } from "@/lib/r2";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const flipbook = await getFlipbookBySlug(slug);

  if (!flipbook || flipbook.status !== "ready") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let unlocked = !flipbook.isPrivate;
  if (flipbook.isPrivate) {
    const cookieStore = await cookies();
    const token = cookieStore.get(flipbookAccessCookieName(flipbook.id))?.value;
    unlocked = verifyFlipbookAccessToken(flipbook.id, token);
  }

  const [coverUrl, backgroundImageUrl] = await Promise.all([
    flipbook.coverImageR2Key ? createPresignedGetUrl(flipbook.coverImageR2Key).catch(() => null) : null,
    flipbook.backgroundImageR2Key ? createPresignedGetUrl(flipbook.backgroundImageR2Key).catch(() => null) : null,
  ]);

  return Response.json({
    flipbook: {
      id: flipbook.id,
      slug: flipbook.slug,
      title: flipbook.title,
      description: flipbook.description,
      pageCount: flipbook.pageCount,
      isPrivate: flipbook.isPrivate,
      allowDownload: flipbook.allowDownload,
      allowPrint: flipbook.allowPrint,
      themeColor: flipbook.themeColor,
      showToolbar: flipbook.showToolbar,
      coverUrl,
      backgroundImageUrl,
      unlocked,
    },
  });
}
