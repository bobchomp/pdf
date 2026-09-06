import { PublicFlipbook } from "@/components/PublicFlipbook";

export default async function PublicFlipbookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFlipbook slug={slug} />;
}
