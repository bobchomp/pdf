"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const onPresets = pathname.startsWith("/dashboard/presets");
  const onTeam = pathname.startsWith("/dashboard/admin");
  const onStats = pathname.startsWith("/dashboard/stats");
  const onFlipbooks = !onPresets && !onTeam && !onStats;

  const tabClass = (active: boolean) =>
    `border-b-2 pb-1 text-sm font-semibold transition-colors ${
      active ? "border-blue-600 text-navy-900" : "border-transparent text-gray-600 hover:text-navy-900"
    }`;

  return (
    <nav className="flex items-center gap-7">
      <Link href="/dashboard" className={tabClass(onFlipbooks)}>
        My flipbooks
      </Link>
      <Link href="/dashboard/presets" className={tabClass(onPresets)}>
        Presets
      </Link>
      <Link href="/dashboard/stats" className={tabClass(onStats)}>
        Stats
      </Link>
      {isAdmin && (
        <Link href="/dashboard/admin" className={tabClass(onTeam)}>
          Team
        </Link>
      )}
    </nav>
  );
}
