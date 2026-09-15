import "server-only";

/**
 * Vercel adds these headers to requests that pass through its edge network. They're absent
 * when running locally or on a non-Vercel host — country/region just come back null there.
 */
export function getGeoFromHeaders(headers: Headers): { country: string | null; region: string | null } {
  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
  };
}
