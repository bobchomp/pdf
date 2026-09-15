import Link from "next/link";
import Image from "next/image";
import { listFlipbooks } from "@/lib/flipbooks";
import { createPresignedGetUrl } from "@/lib/r2";
import { IconImage } from "@/components/icons";

export default async function StatsIndexPage() {
  const flipbooks = await listFlipbooks();
  const covers = await Promise.all(
    flipbooks.map((fb) => (fb.coverImageR2Key ? createPresignedGetUrl(fb.coverImageR2Key, 3600).catch(() => null) : null))
  );

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight text-navy-900">Stats</h1>
      <p className="mt-1.5 text-[13.5px] text-gray-400">Pick a publication to see how people are reading it.</p>

      {flipbooks.length === 0 ? (
        <div className="mt-16 text-center text-gray-400">No flipbooks yet.</div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {flipbooks.map((fb, i) => (
            <Link
              key={fb.id}
              href={`/dashboard/stats/${fb.id}`}
              className="group overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_8px_20px_-6px_rgba(15,32,68,0.16),0_2px_6px_rgba(15,32,68,0.06)]"
            >
              <div className="relative flex aspect-[3/4] items-center justify-center bg-gray-100">
                {covers[i] ? (
                  <Image src={covers[i]!} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <IconImage size={32} className="text-gray-300" />
                )}
              </div>
              <div className="p-3.5">
                <p className="truncate text-sm font-semibold text-gray-900">{fb.title}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {fb.status} · {fb.pageCount || "?"} pages
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
