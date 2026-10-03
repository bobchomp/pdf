import "server-only";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "numeric",
  hour12: false,
  weekday: "short",
});

const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// en-CA formats as YYYY-MM-DD.
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Europe/London calendar date a timestamp falls on, as YYYY-MM-DD. */
export function toLondonDateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

/**
 * The last `days` Europe/London calendar dates up to and including today, oldest first, as
 * YYYY-MM-DD. Done as calendar arithmetic from today's date rather than by stepping back 24h at
 * a time, which can skip or repeat a date across a GMT/BST change.
 */
export function lastLondonDateKeys(days: number, now = new Date()): string[] {
  const [y, m, d] = toLondonDateKey(now).split("-").map(Number);
  return Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10));
}

/**
 * The hour (0-23) and day of week (0=Sunday..6=Saturday) a UTC-stored timestamp falls on in
 * Europe/London — accounting for GMT/BST automatically, since that's what makes "when do
 * people actually read this" a useful answer rather than raw server time.
 */
export function toLondonHourAndWeekday(date: Date): { hour: number; weekday: number } {
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Sun";

  // Intl formats midnight as "24" with hour12: false in some environments; normalize to 0.
  const hour = Number(hourPart) % 24;
  const weekday = WEEKDAY_ORDER.indexOf(weekdayPart);

  return { hour, weekday: weekday === -1 ? 0 : weekday };
}
