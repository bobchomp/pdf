// Security hardening: viewer links that only work when embedded, and webhook addresses that
// can't reach private networks (checked when saved and when each delivery connects).
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { BASE, OUT: dir, ROOT, check, launch, login, openDb, run, sleep } = require("../harness/helpers.cjs");
const db = openDb();
const PDF_URL = "http://localhost:4000/sample.pdf";
const BLOCKED = "This document can only be viewed on the website it's published on.";
const rendered = (frame) => frame.waitForFunction(() => [...document.querySelectorAll("[data-page-number] canvas")].some((c) => c.width > 0), null, { timeout: 20000 });

run(async () => {
  // ---- Unit checks for the address guard
  const unit = execFileSync("npx", ["tsx", path.join(__dirname, "security-unit.ts")], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "--conditions=react-server" },
  });
  const lines = unit.split("\n").filter((l) => /^(PASS|FAIL)/.test(l));
  for (const l of lines) check(`address guard: ${l.replace(/^(PASS|FAIL)\s+/, "")}`, l.startsWith("PASS"));
  check("address guard: all unit checks ran", lines.length === 9, String(lines.length));

  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const { projectId, key } = await page.evaluate(async () => {
    const p = await (await fetch("/api/developer/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Youth site", allowedOrigins: ["http://localhost:4200", "http://localhost:4100"] }) })).json();
    const k = await (await fetch(`/api/developer/projects/${p.project.id}/keys`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "dev" }) })).json();
    return { projectId: p.project.id, key: k.key.key };
  });
  const createToken = (extra = {}, apiKey = key) =>
    fetch(`${BASE}/api/v1/viewer-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ document: { id: "spring", title: "Spring newsletter", url: PDF_URL }, ...extra }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const token = async (extra) => (await createToken(extra)).body.url;
  const project = await (await fetch(`${BASE}/api/v1/project`, { headers: { Authorization: `Bearer ${key}` } })).json();
  check("new projects are embedded-only by default (and the API says so)", project.project.embedOnly === true);

  // ---- Embedded-only links
  const url = await token();
  const res = await fetch(url);
  // The page differs for a direct visit vs an embed, so no cache may keep a copy of it.
  check("viewer page is never cached", /no-store/.test(res.headers.get("cache-control") ?? ""), res.headers.get("cache-control"));

  // Where a direct visit (a copied link opened in a tab) is sent, in order of preference.
  const direct = await ctx.newPage();
  direct.on("pageerror", (e) => errors.push(e.message));
  await direct.goto(url);
  check("opened directly, nothing else known: sent to the project's first website", direct.url() === "http://localhost:4200/", direct.url());
  check("opened directly: the document never shows", !(await direct.$("[data-page-number]")));
  await sleep(500);
  check("opened directly: no view recorded", db.prepare("SELECT count(*) n FROM api_views WHERE project_id=?").get(projectId).n === 0);

  await page.goto(`http://localhost:4100/?src=${encodeURIComponent(url)}`);
  const frame = await (await page.waitForSelector("#v")).contentFrame();
  await rendered(frame);
  check("embedded on the project's website: document shows", true);
  await sleep(500);
  check("embedded: view recorded", db.prepare("SELECT count(*) n FROM api_views WHERE project_id=?").get(projectId).n === 1);

  await direct.goto(await token());
  check("opened directly after it's been viewed: sent to the page it was last viewed on", direct.url() === "http://localhost:4100/", direct.url());

  let r0 = await createToken({ pageUrl: "http://localhost:4200/newsletters/spring?x=1" });
  check("pageUrl accepted and returned", r0.status === 201 && r0.body.pageUrl === "http://localhost:4200/newsletters/spring?x=1");
  await direct.goto(r0.body.url);
  check("opened directly with pageUrl: sent to that exact page", direct.url() === "http://localhost:4200/newsletters/spring?x=1", direct.url());
  r0 = await createToken({ pageUrl: "https://evil.example/phish" });
  check("pageUrl on another website refused (no open redirect)", r0.status === 400 && r0.body.error.message.startsWith("pageUrl:"), r0.body.error?.message);
  r0 = await createToken({ pageUrl: "javascript:alert(1)" });
  check("pageUrl must be a web address", r0.status === 400);

  // A project with only wildcard websites has no single page to send people to: the message shows.
  await page.goto(`${BASE}/dashboard`); // the dashboard's own API, signed in
  const wildKey = await page.evaluate(async () => {
    const p = await (await fetch("/api/developer/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Wild", allowedOrigins: ["https://*.example.com"] }) })).json();
    return (await (await fetch(`/api/developer/projects/${p.project.id}/keys`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "k" }) })).json()).key.key;
  });
  await direct.goto((await createToken({}, wildKey)).body.url);
  check("nowhere to send them: message instead", (await direct.textContent("body")).includes(BLOCKED) && (await direct.title()) === "Document unavailable");
  await direct.screenshot({ path: `${dir}/p5-direct-blocked.png` });

  // The dashboard switch turns it off and on again.
  await page.goto(`${BASE}/dashboard/developers/${projectId}`);
  const toggle = 'button[role="switch"][aria-label="Only show documents on these websites"]';
  check("dashboard switch shows on", (await page.getAttribute(toggle, "aria-checked")) === "true");
  await page.click(toggle);
  await page.waitForSelector("text=Viewer links can now be opened directly too.");
  check("switch stays off after saving", (await page.getAttribute(toggle, "aria-checked")) === "false");
  await direct.goto(await token());
  await rendered(direct.mainFrame());
  check("switched off: direct link shows the document", direct.url().startsWith(`${BASE}/v1/view/`));
  await page.click(toggle);
  await page.waitForSelector("text=Viewer links now only work on this project's websites.");
  check("switch stays on after saving", (await page.getAttribute(toggle, "aria-checked")) === "true");
  await page.reload();
  check("switch state survives a reload (read back from the database)", (await page.getAttribute(toggle, "aria-checked")) === "true");
  await direct.goto(await token());
  check("switched back on: direct link redirected again", direct.url() === "http://localhost:4100/", direct.url());
  await direct.close();

  // ---- Webhook addresses (this suite runs the production build, where private targets are refused)
  const setHook = (address) =>
    page.evaluate(async ([id, a]) => {
      const r = await fetch(`/api/developer/projects/${id}/webhook`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: a }) });
      return { status: r.status, body: await r.json() };
    }, [projectId, address]);
  let r = await setHook("https://169.254.169.254/latest/meta-data");
  check("webhook: cloud metadata address refused", r.status === 400 && /private/i.test(r.body.error), r.body.error);
  r = await setHook("http://localhost:4300/hook");
  check("webhook: localhost refused in production", r.status === 400, r.body.error);
  r = await setHook("https://flipbook-hook.invalid/hook");
  check("webhook: a name that doesn't resolve is reported", r.status === 400 && r.body.error.startsWith("Couldn't find that address"), r.body.error);
  check("webhook: nothing saved after refusals", db.prepare("SELECT webhook_url FROM api_projects WHERE id=?").get(projectId).webhook_url === null);

  check("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
});
