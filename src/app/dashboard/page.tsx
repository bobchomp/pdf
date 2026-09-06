import Link from "next/link";
import Image from "next/image";
import { listFlipbooks } from "@/lib/flipbooks";
import { createPresignedGetUrl } from "@/lib/r2";
import { IconImage, IconLock, IconPlus } from "@/components/icons";

function statusBadge(status: string) {
  if (status === "ready") return "bg-green-100 text-green-700";
  if (status === "processing") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default async function DashboardPage() {
  const flipbooks = await listFlipbooks();
  const covers = await Promise.all(
    flipbooks.map((fb) => (fb.coverImageR2Key ? createPresignedGetUrl(fb.coverImageR2Key, 3600).catch(() => null) : null))
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-tight text-navy-900">My flipbooks</h1>
        <Link
          href="/dashboard/new"
          className="flex items-center gap-2 rounded-[9px] bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700"
        >
          <IconPlus />
          Upload PDF
        </Link>
      </div>

      {flipbooks.length === 0 ? (
        <div className="mt-16 text-center text-gray-400">No flipbooks yet. Upload your first PDF to get started.</div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {flipbooks.map((fb, i) => (
            <Link
              key={fb.id}
              href={`/dashboard/${fb.id}`}
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
                <div className="mt-2 flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(fb.status)}`}>
                    {fb.status}
                  </span>
                  <span className="text-xs text-gray-400">{fb.pageCount || "?"} pages</span>
                </div>
                {fb.isPrivate && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-navy-700">
                    <IconLock size={11} />
                    Private
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
