// Runs the published flipbook-server.ts helpers against the local app. Usage: tsx test-sdk-server.ts <apiKey>
import { createHmac } from "node:crypto";
import { createFlipbookClient, FlipbookApiError, verifyWebhook } from "../../../public/sdk/v1/flipbook-server";

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
const sign = (secret: string, body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

(async () => {
  const apiKey = process.argv[2];
  let threw = "";
  try { createFlipbookClient({ apiKey: "sk_wrong" }); } catch (e) { threw = (e as Error).message; }
  check("client rejects a non-secret key up front", threw.includes("fbsk_"));

  const fb = createFlipbookClient({ apiKey, baseUrl: "http://localhost:3000/" });
  const p = await fb.getProject();
  check("getProject", p.project.name === "Youth site" && p.key.prefix.startsWith("fbsk_"));

  const t = await fb.createViewerToken({ document: { id: "sdk-doc", title: "SDK doc", url: "http://localhost:4000/sample.pdf" }, settings: { showPrint: false }, expiresIn: 3600 });
  check("createViewerToken", t.url.startsWith("http://localhost:3000/v1/view/vt_") && t.settings.showPrint === false);
  console.log("TOKEN_URL " + t.url);

  try { await fb.createViewerToken({ document: { id: "x", title: "x", url: "ftp://nope" } }); check("API error raised", false); }
  catch (e) { check("API errors become FlipbookApiError with code", e instanceof FlipbookApiError && e.status === 400 && e.code === "invalid_request" && e.message.startsWith("document.url"), (e as Error).message); }

  const updated = await fb.setDefaultSettings({ backgroundColor: "#223344" });
  check("setDefaultSettings", updated.project.defaultSettings.backgroundColor === "#223344");
  await fb.setDefaultSettings({});

  const bad = createFlipbookClient({ apiKey: "fbsk_" + "x".repeat(43), baseUrl: "http://localhost:3000" });
  try { await bad.getProject(); check("invalid key error", false); } catch (e) { check("invalid key -> 401 invalid_api_key", e instanceof FlipbookApiError && e.status === 401 && e.code === "invalid_api_key"); }

  const stats = await fb.getStats({ days: 30 });
  check("getStats", typeof stats.totals.views === "number" && Array.isArray(stats.documents));
  console.log("STATS " + JSON.stringify(stats.totals));

  // verifyWebhook
  const secret = "whsec_testsecret";
  const body = JSON.stringify({ project: { id: "p" }, events: [] });
  check("verifyWebhook: valid", await verifyWebhook(body, sign(secret, body), secret));
  check("verifyWebhook: tampered body", !(await verifyWebhook(body + " ", sign(secret, body), secret)));
  check("verifyWebhook: wrong secret", !(await verifyWebhook(body, sign("whsec_other", body), secret)));
  check("verifyWebhook: too old", !(await verifyWebhook(body, sign(secret, body, Math.floor(Date.now() / 1000) - 600), secret)));
  check("verifyWebhook: missing/malformed header", !(await verifyWebhook(body, null, secret)) && !(await verifyWebhook(body, "v1=abc", secret)));

  console.log(failures ? `SERVER ${failures} FAILED` : "SERVER ALL PASSED");
})().catch((e) => { console.error(e); process.exit(1); });
