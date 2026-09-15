import Link from "next/link";
import { listFlipbooks } from "@/lib/flipbooks";
import { IconChevronRight } from "@/components/icons";

export default async function StatsIndexPage() {
  const flipbooks = await listFlipbooks();

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight text-navy-900">Stats</h1>
      <p className="mt-1.5 text-[13.5px] text-gray-400">Pick a publication to see how people are reading it.</p>

      {flipbooks.length === 0 ? (
        <div className="mt-16 text-center text-gray-400">No flipbooks yet.</div>
      ) : (
        <div className="mt-7 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.06)]">
          {flipbooks.map((fb, i) => (
            <Link
              key={fb.id}
              href={`/dashboard/stats/${fb.id}`}
              className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{fb.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {fb.status} · {fb.pageCount || "?"} pages
                </p>
              </div>
              <IconChevronRight size={16} className="text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
