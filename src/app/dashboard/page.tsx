import Link from "next/link";
import Image from "next/image";
import { listFlipbooks } from "@/lib/flipbooks";
import { createPresignedGetUrl } from "@/lib/r2";

function statusBadge(status: string) {
  if (status === "ready") return "bg-emerald-100 text-emerald-700";
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
        <h1 className="text-2xl font-semibold text-slate-900">My flipbooks</h1>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Upload PDF
        </Link>
      </div>

      {flipbooks.length === 0 ? (
        <div className="mt-16 text-center text-slate-400">
          No flipbooks yet. Upload your first PDF to get started.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {flipbooks.map((fb, i) => (
            <Link
              key={fb.id}
              href={`/dashboard/${fb.id}`}
              className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative flex aspect-[3/4] items-center justify-center bg-slate-100 text-4xl text-slate-300">
                {covers[i] ? (
                  <Image src={covers[i]!} alt="" fill className="object-cover" unoptimized />
                ) : (
                  "📄"
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-slate-800">{fb.title}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span className={`rounded-full px-2 py-0.5 ${statusBadge(fb.status)}`}>{fb.status}</span>
                  <span>{fb.pageCount || "?"} pages</span>
                </div>
                {fb.isPrivate && <p className="mt-1 text-xs text-slate-400">🔒 Private</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
