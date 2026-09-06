import { PublicFlipbook } from "@/components/PublicFlipbook";

export default async function EmbedFlipbookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFlipbook slug={slug} embed />;
}
