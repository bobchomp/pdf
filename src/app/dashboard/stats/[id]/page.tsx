import { notFound } from "next/navigation";
import Link from "next/link";
import { getFlipbookById, getFlipbookStats } from "@/lib/flipbooks";
import { StatsView } from "./stats-view";

export default async function FlipbookStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flipbook = await getFlipbookById(id);
  if (!flipbook) notFound();

  const stats = await getFlipbookStats(id);

  return (
    <div>
      <Link href="/dashboard/stats" className="text-[13px] font-semibold text-blue-600 hover:text-navy-700">
        ← All stats
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-navy-900">{flipbook.title}</h1>
          <p className="mt-1 text-[13.5px] text-gray-400">
            {flipbook.status} · {flipbook.pageCount} pages
          </p>
        </div>
        <Link
          href={`/dashboard/${flipbook.id}`}
          className="rounded-[9px] border border-gray-300 px-4 py-2.5 text-[13.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Edit publication
        </Link>
      </div>

      <StatsView stats={stats} />
    </div>
  );
}
