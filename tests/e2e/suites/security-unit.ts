// Unit checks for lib/safe-http, run by 06-security.cjs with `--conditions=react-server` so the
// "server-only" import resolves outside Next.js. Prints PASS/FAIL lines.
import http from "node:http";
import { checkPublicHost, isPublicAddress, postJson, PrivateAddressError } from "../../../src/lib/safe-http";

const check = (name: string, ok: boolean, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);

(async () => {
  const publicIps = ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"];
  const privateIps = [
    "127.0.0.1", "10.1.2.3", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "::1", "[::1]", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1",
    "::ffff:7f00:1", "64:ff9b::10.0.0.1", "not-an-ip",
  ];
  const wrongPublic = publicIps.filter((ip) => !isPublicAddress(ip));
  const wrongPrivate = privateIps.filter((ip) => isPublicAddress(ip));
  check("public addresses recognised (IPv4, IPv6, mapped)", wrongPublic.length === 0, wrongPublic.join(", "));
  check("loopback, private, link-local/metadata, CGNAT, multicast, mapped refused", wrongPrivate.length === 0, wrongPrivate.join(", "));

  check("DNS check: localhost (resolves to loopback) refused", (await checkPublicHost("localhost")) === "private");
  check("DNS check: unresolvable name reported", (await checkPublicHost("nothing-here.invalid")) === "unresolvable");
  check("DNS check: private IP literal refused", (await checkPublicHost("10.0.0.1")) === "private");

  // A real listener on this machine: the guarded request must refuse it, the unguarded one reach it.
  let hits = 0;
  const server = http.createServer((req, res) => { hits++; req.resume(); res.end("ok"); }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as { port: number }).port;
  const opts = { body: "{}", headers: { "Content-Type": "application/json" }, timeoutMs: 3000 };

  const viaName = await postJson(`http://localhost:${port}/hook`, opts).then(() => "sent", (e) => e);
  check("connection-time guard: hostname resolving to loopback never connects", viaName instanceof PrivateAddressError && hits === 0, String(viaName));
  const viaLiteral = await postJson(`http://127.0.0.1:${port}/hook`, opts).then(() => "sent", (e) => e);
  check("connection-time guard: loopback IP literal never connects", viaLiteral instanceof PrivateAddressError && hits === 0, String(viaLiteral));
  const viaMapped = await postJson(`http://[::ffff:127.0.0.1]:${port}/hook`, opts).then(() => "sent", (e) => e);
  check("connection-time guard: IPv4-mapped IPv6 literal never connects", viaMapped instanceof PrivateAddressError && hits === 0, String(viaMapped));
  const allowed = await postJson(`http://localhost:${port}/hook`, { ...opts, allowPrivate: true });
  check("allowPrivate (development/tests) still delivers", allowed.status === 200 && hits === 1);
  server.close();
})().catch((e) => { console.log(`FAIL  security unit checks crashed  ${e}`); });
