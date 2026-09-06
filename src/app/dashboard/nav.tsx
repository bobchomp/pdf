"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const onTeam = pathname.startsWith("/dashboard/admin");

  return (
    <nav className="flex items-center gap-7">
      <Link
        href="/dashboard"
        className={`border-b-2 pb-1 text-sm font-semibold transition-colors ${
          onTeam ? "border-transparent text-gray-600 hover:text-navy-900" : "border-blue-600 text-navy-900"
        }`}
      >
        My flipbooks
      </Link>
      {isAdmin && (
        <Link
          href="/dashboard/admin"
          className={`border-b-2 pb-1 text-sm font-semibold transition-colors ${
            onTeam ? "border-blue-600 text-navy-900" : "border-transparent text-gray-600 hover:text-navy-900"
          }`}
        >
          Team
        </Link>
      )}
    </nav>
  );
}
