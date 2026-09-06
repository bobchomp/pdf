import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-slate-900">
            📖 Flipbooks
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              My flipbooks
            </Link>
            {session?.user.role === "admin" && (
              <Link href="/dashboard/admin" className="hover:text-slate-900">
                Team
              </Link>
            )}
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">{session?.user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
