import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";
import { DashboardNav } from "./nav";
import { logoutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
          <Link href="/dashboard">
            <Logo size={22} textClassName="text-base" />
          </Link>

          <div className="flex items-center gap-7">
            <DashboardNav isAdmin={session?.user.role === "admin"} />
            <span className="h-5 w-px bg-gray-200" />
            <span className="text-[13.5px] text-gray-400">{session?.user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-[9px] border border-gray-300 px-4 py-2 text-[13.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
