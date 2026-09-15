import "server-only";

export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * A deliberately rough User-Agent parser — just enough to bucket views into a device/browser
 * breakdown, not a fingerprinting-grade library. Stores the parsed category rather than the
 * raw UA string, which is enough for the stats page and less to hold onto.
 */
export function parseUserAgent(userAgent: string | null): { deviceType: DeviceType | null; browser: string | null } {
  if (!userAgent) return { deviceType: null, browser: null };
  const ua = userAgent.toLowerCase();

  let deviceType: DeviceType = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|ipod|android/.test(ua)) {
    deviceType = "mobile";
  }

  let browser: string | null = null;
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("opr/") || ua.includes("opera")) browser = "Opera";
  else if (ua.includes("samsungbrowser")) browser = "Samsung Internet";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("chrome") || ua.includes("crios")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";

  return { deviceType, browser };
}
