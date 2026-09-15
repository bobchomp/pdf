type Bucket = { label: string; count: number };

type Stats = {
  totalViews: number;
  last30Days: { date: string; count: number }[];
  deviceBreakdown: Bucket[];
  browserBreakdown: Bucket[];
  countryBreakdown: Bucket[];
  regionBreakdown: Bucket[];
  hourOfDay: { hour: number; count: number }[];
  dayOfWeek: { weekday: number; label: string; count: number }[];
  pageCount: number;
  pageEngagement: { pageNumber: number; sessions: number }[];
  sessionsWithEvents: number;
  completionRate: number | null;
  linkClicks: Bucket[];
  avgSessionDurationSeconds: number | null;
};

const cardClass = "rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_1px_3px_rgba(16,24,40,0.05)]";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function BarList({ items, emptyLabel }: { items: Bucket[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="mt-3 text-xs text-gray-300">{emptyLabel}</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="mt-4 space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs font-medium text-gray-600" title={item.label}>
            {item.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-gray-400">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function MiniBars({
  items,
  labelFor,
  emptyLabel,
}: {
  items: { count: number }[];
  labelFor: (i: number) => string;
  emptyLabel: string;
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return <p className="mt-3 text-xs text-gray-300">{emptyLabel}</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="mt-5 flex h-24 items-end gap-1">
      {items.map((item, i) => (
        <div
          key={i}
          title={`${labelFor(i)}: ${item.count}`}
          className="flex-1 rounded-t-[3px] bg-blue-100"
          style={{ height: `${(item.count / max) * 100}%`, minHeight: 2 }}
        />
      ))}
    </div>
  );
}

export function StatsView({ stats }: { stats: Stats }) {
  const maxDayCount = Math.max(1, ...(stats.last30Days.map((d) => d.count) ?? [1]));

  return (
    <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Views</h2>
        <p className="mt-3 text-[30px] font-bold text-navy-900">{stats.totalViews}</p>
        <p className="text-xs text-gray-400">total views</p>
        <div className="mt-5 flex h-24 items-end gap-1">
          {stats.last30Days.length === 0 ? (
            <p className="text-xs text-gray-300">No views in the last 30 days.</p>
          ) : (
            stats.last30Days.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                className="flex-1 rounded-t-[3px] bg-blue-100"
                style={{ height: `${(d.count / maxDayCount) * 100}%`, minHeight: 2 }}
              />
            ))
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">Last 30 days</p>
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Completion</h2>
        <p className="mt-3 text-[30px] font-bold text-navy-900">
          {stats.completionRate === null ? "—" : `${Math.round(stats.completionRate * 100)}%`}
        </p>
        <p className="text-xs text-gray-400">
          {stats.sessionsWithEvents === 0
            ? "No page-flip data yet"
            : `reached the last page, of ${stats.sessionsWithEvents} tracked session${stats.sessionsWithEvents === 1 ? "" : "s"}`}
        </p>
        <div className="mt-5 h-px bg-gray-100" />
        <p className="mt-5 text-[30px] font-bold text-navy-900">
          {stats.avgSessionDurationSeconds === null ? "—" : formatDuration(stats.avgSessionDurationSeconds)}
        </p>
        <p className="text-xs text-gray-400">average session duration</p>
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Device</h2>
        <BarList items={stats.deviceBreakdown} emptyLabel="No device data yet." />
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Browser</h2>
        <BarList items={stats.browserBreakdown} emptyLabel="No browser data yet." />
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Country</h2>
        <BarList items={stats.countryBreakdown} emptyLabel="No location data yet (only available when deployed on Vercel)." />
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Region</h2>
        <BarList items={stats.regionBreakdown} emptyLabel="No region data yet." />
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Time of day</h2>
        <p className="mt-1 text-xs text-gray-400">Europe/London</p>
        <MiniBars items={stats.hourOfDay} labelFor={(i) => `${i}:00`} emptyLabel="No view data yet." />
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Day of week</h2>
        <p className="mt-1 text-xs text-gray-400">Europe/London</p>
        <MiniBars items={stats.dayOfWeek} labelFor={(i) => stats.dayOfWeek[i].label} emptyLabel="No view data yet." />
      </section>

      <section className={`${cardClass} lg:col-span-2`}>
        <h2 className="text-[15px] font-semibold text-navy-900">Page engagement</h2>
        <p className="mt-1 text-xs text-gray-400">How many tracked sessions reached each page — a drop in the bars is where people bail.</p>
        {stats.pageEngagement.length === 0 ? (
          <p className="mt-3 text-xs text-gray-300">No page-flip data yet.</p>
        ) : (
          <div className="mt-5 flex h-32 items-end gap-0.5">
            {stats.pageEngagement.map((p) => (
              <div
                key={p.pageNumber}
                title={`Page ${p.pageNumber}: ${p.sessions} session${p.sessions === 1 ? "" : "s"}`}
                className="flex-1 rounded-t-[2px] bg-blue-100"
                style={{
                  height: `${(p.sessions / Math.max(1, stats.pageEngagement[0]?.sessions ?? 1)) * 100}%`,
                  minHeight: 2,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className={`${cardClass} lg:col-span-2`}>
        <h2 className="text-[15px] font-semibold text-navy-900">Link clicks</h2>
        <p className="mt-1 text-xs text-gray-400">Clicks on hyperlinks embedded in the PDF.</p>
        {stats.linkClicks.length === 0 ? (
          <p className="mt-3 text-xs text-gray-300">No link clicks yet.</p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {stats.linkClicks.map((link) => (
              <div key={link.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-gray-600" title={link.label}>
                  {link.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">{link.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
