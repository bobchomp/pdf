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
    const p = await (await fetch("/api/developer/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Youth site", allowedOrigins: ["http://localhost:4100"] }) })).json();
    const k = await (await fetch(`/api/developer/projects/${p.project.id}/keys`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "dev" }) })).json();
    return { projectId: p.project.id, key: k.key.key };
  });
  const token = async () => {
    const r = await fetch(`${BASE}/api/v1/viewer-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ document: { id: "spring", title: "Spring newsletter", url: PDF_URL } }),
    });
    return (await r.json()).url;
  };
  const project = await (await fetch(`${BASE}/api/v1/project`, { headers: { Authorization: `Bearer ${key}` } })).json();
  check("new projects are embedded-only by default (and the API says so)", project.project.embedOnly === true);

  // ---- Embedded-only links
  const url = await token();
  const res = await fetch(url);
  // The page differs for a direct visit vs an embed, so no cache may keep a copy of it.
  check("viewer page is never cached", /no-store/.test(res.headers.get("cache-control") ?? ""), res.headers.get("cache-control"));

  const direct = await ctx.newPage();
  direct.on("pageerror", (e) => errors.push(e.message));
  await direct.goto(url);
  check("opened directly in a tab: message instead of the document", (await direct.textContent("body")).includes(BLOCKED) && !(await direct.$("[data-page-number]")));
  await sleep(500);
  check("opened directly: tab doesn't show the document's title", (await direct.title()) === "Document unavailable", await direct.title());
  check("opened directly: no view recorded", db.prepare("SELECT count(*) n FROM api_views WHERE project_id=?").get(projectId).n === 0);
  await direct.screenshot({ path: `${dir}/p5-direct-blocked.png` });

  await page.goto(`http://localhost:4100/?src=${encodeURIComponent(url)}`);
  const frame = await (await page.waitForSelector("#v")).contentFrame();
  await rendered(frame);
  check("embedded on the project's website: document shows", true);
  await sleep(500);
  check("embedded: view recorded", db.prepare("SELECT count(*) n FROM api_views WHERE project_id=?").get(projectId).n === 1);

  // The dashboard switch turns it off and on again.
  await page.goto(`${BASE}/dashboard/developers/${projectId}`);
  const toggle = 'button[role="switch"][aria-label="Only show documents on these websites"]';
  check("dashboard switch shows on", (await page.getAttribute(toggle, "aria-checked")) === "true");
  await page.click(toggle);
  await page.waitForSelector("text=Viewer links can now be opened directly too.");
  await direct.goto(await token());
  await rendered(direct.mainFrame());
  check("switched off: direct link shows the document", !(await direct.textContent("body")).includes(BLOCKED));
  await page.click(toggle);
  await page.waitForSelector("text=Viewer links now only work on this project's websites.");
  await direct.goto(await token());
  check("switched back on: direct link blocked again", (await direct.textContent("body")).includes(BLOCKED));
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
