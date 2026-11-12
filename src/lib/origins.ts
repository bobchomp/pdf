const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Normalizes a website address typed by an admin into an exact origin the browser understands
 * (e.g. "example.com/page" → "https://example.com"), or returns null if it isn't one.
 *
 * - https only, except http for local development hosts.
 * - A leading "*." allows every subdomain ("https://*.example.com"), matching how browsers read
 *   the Content-Security-Policy frame-ancestors list these values feed.
 * - Paths, queries and credentials are dropped / rejected: an origin is scheme + host + port.
 */
export function normalizeOrigin(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;

  const wildcard = /^(https?:\/\/)\*\./i.exec(value);
  if (wildcard) value = wildcard[1] + value.slice(wildcard[0].length);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.username || url.password) return null;
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
  // A real hostname: at least one dot (or a local host), no wildcard anywhere else.
  if (!isLocal && !url.hostname.includes(".")) return null;
  if (url.hostname.includes("*")) return null;
  if (wildcard && isLocal) return null;

  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${wildcard ? "*." : ""}${url.hostname}${port}`;
}

/** Normalizes a list of origins, de-duplicated; reports the inputs that weren't valid. */
export function normalizeOrigins(inputs: string[]): { origins: string[]; invalid: string[] } {
  const origins: string[] = [];
  const invalid: string[] = [];
  for (const input of inputs) {
    if (!input.trim()) continue;
    const origin = normalizeOrigin(input);
    if (origin === null) invalid.push(input.trim());
    else if (!origins.includes(origin)) origins.push(origin);
  }
  return { origins, invalid };
}

/**
 * Whether a URL's origin is one of a project's allowed origins, with the same meaning as the
 * frame-ancestors list they feed: "https://*.example.com" covers any subdomain, not the bare domain.
 */
export function isAllowedOrigin(url: string, allowedOrigins: string[]) {
  let origin: URL;
  try {
    origin = new URL(url);
  } catch {
    return false;
  }
  const port = origin.port ? `:${origin.port}` : "";
  return allowedOrigins.some((allowed) => {
    const wildcard = /^(https?:\/\/)\*\.(.+)$/.exec(allowed);
    if (!wildcard) return allowed === origin.origin;
    const [, scheme, rest] = wildcard;
    return `${origin.protocol}//` === scheme && origin.host.endsWith(`.${rest}`) && origin.host.length > rest.length + 1 && (rest.includes(":") || !port);
  });
}
