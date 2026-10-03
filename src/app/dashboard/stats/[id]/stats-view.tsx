import { ColumnChart, type Column } from "./column-chart";

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

const dayTitle = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayAxis = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAY_PLURALS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

function viewsColumns(days: Stats["last30Days"]): Column[] {
  return days.map((d, i) => {
    const date = new Date(`${d.date}T00:00:00Z`);
    const isToday = i === days.length - 1;
    return {
      key: d.date,
      title: isToday ? `Today, ${dayTitle.format(date)}` : dayTitle.format(date),
      value: d.count,
      // A label every 7 days, counting back from today.
      axisLabel: (days.length - 1 - i) % 7 === 0 ? (isToday ? "Today" : dayAxis.format(date)) : undefined,
    };
  });
}

function hourColumns(hours: Stats["hourOfDay"]): Column[] {
  return hours.map(({ hour, count }) => ({
    key: String(hour),
    title: `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`,
    value: count,
    axisLabel: hour % 6 === 0 ? `${pad(hour)}:00` : undefined,
  }));
}

function weekdayColumns(days: Stats["dayOfWeek"]): Column[] {
  // Monday first, as a UK week reads.
  const mondayFirst = [...days.filter((d) => d.weekday !== 0), ...days.filter((d) => d.weekday === 0)];
  return mondayFirst.map((d) => ({ key: String(d.weekday), title: WEEKDAY_PLURALS[d.weekday], value: d.count, axisLabel: d.label }));
}

function pageColumns(pages: Stats["pageEngagement"], totalReaders: number): Column[] {
  const last = pages.length;
  return pages.map(({ pageNumber, sessions }) => ({
    key: String(pageNumber),
    title: `Page ${pageNumber}`,
    value: sessions,
    detail: totalReaders > 0 ? `${Math.round((sessions / totalReaders) * 100)}% of readers` : undefined,
    // Sparse page labels so they never collide, even on a phone.
    axisLabel: pageNumber === 1 || pageNumber % 5 === 0 || (pageNumber === last && last % 5 >= 3) ? String(pageNumber) : undefined,
  }));
}

export function StatsView({ stats }: { stats: Stats }) {
  return (
    <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Views</h2>
        <p className="mt-3 text-[30px] font-bold text-navy-900">{stats.totalViews}</p>
        <p className="text-xs text-gray-400">total views</p>
        <p className="mt-5 text-xs font-medium text-gray-500">Views per day, last 30 days</p>
        {stats.last30Days.every((d) => d.count === 0) ? (
          <p className="mt-3 text-xs text-gray-300">No views in the last 30 days.</p>
        ) : (
          <ColumnChart columns={viewsColumns(stats.last30Days)} unit={["view", "views"]} label="Views per day, last 30 days" />
        )}
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
        {stats.totalViews === 0 ? (
          <p className="mt-3 text-xs text-gray-300">No view data yet.</p>
        ) : (
          <ColumnChart columns={hourColumns(stats.hourOfDay)} unit={["view", "views"]} label="Views by time of day" />
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-navy-900">Day of week</h2>
        <p className="mt-1 text-xs text-gray-400">Europe/London</p>
        {stats.totalViews === 0 ? (
          <p className="mt-3 text-xs text-gray-300">No view data yet.</p>
        ) : (
          <ColumnChart columns={weekdayColumns(stats.dayOfWeek)} unit={["view", "views"]} label="Views by day of week" />
        )}
      </section>

      <section className={`${cardClass} lg:col-span-2`}>
        <h2 className="text-[15px] font-semibold text-navy-900">Page engagement</h2>
        <p className="mt-1 text-xs text-gray-400">How many readers reached each page — where the bars drop is where people stopped reading.</p>
        {stats.pageEngagement.length === 0 ? (
          <p className="mt-3 text-xs text-gray-300">No page-flip data yet.</p>
        ) : (
          <ColumnChart
            columns={pageColumns(stats.pageEngagement, stats.sessionsWithEvents)}
            unit={["reader", "readers"]}
            label="Readers reaching each page"
            heightClass="h-40"
          />
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
