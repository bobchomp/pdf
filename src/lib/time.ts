import "server-only";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "numeric",
  hour12: false,
  weekday: "short",
});

const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
