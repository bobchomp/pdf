import type { Metadata } from "next";
import { getFlipbookBySlug } from "@/lib/flipbooks";
import { PublicFlipbook } from "@/components/PublicFlipbook";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const flipbook = await getFlipbookBySlug(slug);
  if (!flipbook || flipbook.status !== "ready") {
    return { title: "Flipbook not found" };
  }
  return { title: flipbook.title };
}

export default async function EmbedFlipbookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFlipbook slug={slug} embed />;
}
