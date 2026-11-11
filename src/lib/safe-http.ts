import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Outgoing requests to addresses other people choose (project webhooks) must never reach this
 * server's own network: loopback, private ranges, link-local (including cloud metadata at
 * 169.254.169.254), and other non-public ranges.
 */
// Two lists: Node's BlockList treats an IPv4 address as inside the IPv6 range ::ffff:0:0/96,
// so a single list holding that range would mark every IPv4 address non-public.
const nonPublicV4 = new net.BlockList();
const nonPublicV6 = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  nonPublicV4.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["::ffff:0:0", 96], // IPv4-mapped (the dotted form is checked as IPv4 below)
  ["64:ff9b::", 96], // NAT64 (likewise)
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  nonPublicV6.addSubnet(address, prefix, "ipv6");
}

/** True for an IP address on the public internet. */
export function isPublicAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const family = net.isIP(address);
  if (family === 4) return !nonPublicV4.check(address, "ipv4");
  if (family === 6) {
    // IPv4 written inside IPv6 (::ffff:10.0.0.1, 64:ff9b::10.0.0.1): judge the IPv4 address.
    const embedded = /^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
    if (embedded) return isPublicAddress(embedded[1]);
    return !nonPublicV6.check(address, "ipv6");
  }
  return false;
}

export class PrivateAddressError extends Error {
  code = "EPRIVATE";
  constructor(hostname: string) {
    super(`${hostname} points to a private network address`);
  }
}

/**
 * A DNS lookup for the connection itself that refuses non-public answers. Checking here, rather
 * than resolving once beforehand, means a hostname can't pass the check and then resolve
 * somewhere else for the real connection (DNS rebinding).
 */
const publicOnlyLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as unknown as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new PrivateAddressError(hostname), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

/**
 * Checks a hostname resolves, and only to public addresses — for telling someone at once that an
 * address won't work. Returns null when it's fine, otherwise the reason.
 */
export async function checkPublicHost(hostname: string): Promise<string | null> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return isPublicAddress(host) ? null : "private";
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    if (addresses.length === 0) return "unresolvable";
    return addresses.every((a) => isPublicAddress(a.address)) ? null : "private";
  } catch {
    return "unresolvable";
  }
}

/**
 * POSTs a body and resolves with the response status. Doesn't follow redirects. Unless
 * `allowPrivate`, refuses to connect anywhere but a public address (see publicOnlyLookup).
 */
export function postJson(
  target: string,
  { body, headers, timeoutMs, allowPrivate = false }: { body: string; headers: Record<string, string>; timeoutMs: number; allowPrivate?: boolean }
): Promise<{ status: number }> {
  const url = new URL(target);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal IP address never goes through DNS, so it's checked directly.
  if (!allowPrivate && net.isIP(host) && !isPublicAddress(host)) return Promise.reject(new PrivateAddressError(host));

  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        lookup: allowPrivate ? undefined : publicOnlyLookup,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume(); // the body isn't needed
        resolve({ status: res.statusCode ?? 0 });
      }
    );
    const overall = setTimeout(() => req.destroy(Object.assign(new Error("timeout"), { name: "TimeoutError" })), timeoutMs);
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    req.on("error", reject);
    req.on("close", () => clearTimeout(overall));
    req.end(body);
  });
}
