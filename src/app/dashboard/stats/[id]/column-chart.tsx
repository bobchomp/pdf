"use client";

import { useState } from "react";

export type Column = {
  key: string;
  /** Names the column in its tooltip and data table, e.g. "Sat 3 Oct". */
  title: string;
  value: number;
  /** Shown under this column on the x-axis; leave unset to keep the axis sparse. */
  axisLabel?: string;
  /** Optional extra line in the tooltip, e.g. a percentage. */
  detail?: string;
};

/** Gridline values: clean steps (1/2/5 × 10ⁿ) from 0 up to just above the max, at most 4 intervals. */
function niceTicks(max: number) {
  if (max <= 0) return [0, 1];
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const base of [1, 2, 5]) {
      const step = base * magnitude;
      const intervals = Math.ceil(max / step);
      if (intervals <= 4) return Array.from({ length: intervals + 1 }, (_, i) => i * step);
    }
  }
}

export function ColumnChart({
  columns,
  unit,
  label,
  heightClass = "h-32",
}: {
  columns: Column[];
  unit: [singular: string, plural: string];
  /** Accessible name for the chart as a whole. */
  label: string;
  heightClass?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...columns.map((c) => c.value)));
  const top = ticks[ticks.length - 1];
  const n = columns.length;
  const unitFor = (value: number) => (value === 1 ? unit[0] : unit[1]);
  const centerPct = (i: number) => ((i + 0.5) / n) * 100;

  const activeColumn = active === null ? null : columns[active];
  // Keep the tooltip inside the chart near the ends instead of centring it off the edge.
  const tooltipAlign =
    active === null ? "" : centerPct(active) < 15 ? "translate-x-0" : centerPct(active) > 85 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <div className="mt-5">
      <div className="flex">
        {/* Y-axis tick labels */}
        <div className={`relative w-8 shrink-0 ${heightClass}`} aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 text-[10px] tabular-nums leading-none text-gray-400"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div
          className={`relative flex-1 ${heightClass}`}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        >
          {/* Gridlines: hairline, recessive; the baseline one step darker. */}
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={`absolute inset-x-0 h-px ${t === 0 ? "bg-gray-200" : "bg-gray-100"}`}
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}

          <div role="group" aria-label={label} className="absolute inset-0 flex">
            {columns.map((c, i) => (
              <div
                key={c.key}
                tabIndex={0}
                aria-label={`${c.title}: ${c.value} ${unitFor(c.value)}${c.detail ? `, ${c.detail}` : ""}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                // The whole column slot is the hit target, not just the bar — zero-value columns included.
                className={`relative flex h-full flex-1 cursor-default items-end justify-center rounded-t-[4px] px-px outline-none transition-colors ${
                  active === i ? "bg-gray-100/70" : ""
                }`}
              >
                {c.value > 0 && (
                  <div
                    className={`w-full max-w-6 rounded-t-[4px] transition-colors ${active === i ? "bg-blue-700" : "bg-blue-500"}`}
                    style={{ height: `${(c.value / top) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>

          {activeColumn && (
            <div
              role="status"
              className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-white px-3 py-2 shadow-lg ring-1 ring-black/5 ${tooltipAlign}`}
              style={{ left: `${centerPct(active!)}%`, bottom: `calc(${(activeColumn.value / top) * 100}% + 10px)` }}
            >
              <p className="leading-tight">
                <span className="text-sm font-semibold text-navy-900">{activeColumn.value}</span>{" "}
                <span className="text-xs text-gray-500">{unitFor(activeColumn.value)}</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{activeColumn.title}</p>
              {activeColumn.detail && <p className="text-xs text-gray-400">{activeColumn.detail}</p>}
            </div>
          )}
        </div>
      </div>

      {/* X-axis labels, centred under their columns */}
      <div className="relative ml-8 mt-1.5 h-4" aria-hidden>
        {columns.map((c, i) =>
          c.axisLabel ? (
            <span
              key={c.key}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-gray-400"
              style={{ left: `${centerPct(i)}%` }}
            >
              {c.axisLabel}
            </span>
          ) : null
        )}
      </div>

      {/* Every value is also reachable without hovering — on a phone, or for a screen reader. */}
      <details className="mt-2">
        <summary className="cursor-pointer select-none text-xs text-gray-400 hover:text-gray-600">Show data</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {columns.map((c) => (
                <tr key={c.key} className="border-t border-gray-100">
                  <td className="py-1 pr-3 text-gray-600">{c.title}</td>
                  <td className="py-1 text-right tabular-nums text-gray-900">{c.value}</td>
                  {columns.some((x) => x.detail) && <td className="py-1 pl-3 text-right text-gray-400">{c.detail}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
