import { notFound } from "next/navigation";
import { getFlipbookById } from "@/lib/flipbooks";
import { createPresignedGetUrl } from "@/lib/r2";
import { FlipbookSettings } from "./flipbook-settings";

export default async function FlipbookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flipbook = await getFlipbookById(id);
  if (!flipbook) notFound();

  const backgroundImageUrl = flipbook.backgroundImageR2Key
    ? await createPresignedGetUrl(flipbook.backgroundImageR2Key).catch(() => null)
    : null;

  return (
    <FlipbookSettings
      flipbook={{
        id: flipbook.id,
        slug: flipbook.slug,
        title: flipbook.title,
        description: flipbook.description,
        status: flipbook.status,
        pageCount: flipbook.pageCount,
        isPrivate: flipbook.isPrivate,
        allowDownload: flipbook.allowDownload,
        allowPrint: flipbook.allowPrint,
        themeColor: flipbook.themeColor,
        showToolbar: flipbook.showToolbar,
        backgroundImageR2Key: flipbook.backgroundImageR2Key,
      }}
      initialBackgroundImageUrl={backgroundImageUrl}
    />
  );
}
