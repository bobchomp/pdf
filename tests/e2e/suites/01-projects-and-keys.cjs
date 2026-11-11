// Phase 1: developer projects, API keys, rate limits and access control.
const { BASE, OUT: dir, check, launch, run, visibleSoon, titleSoon } = require("../harness/helpers.cjs");
const api = (key, path = '/api/v1/project') => fetch(BASE + path, { headers: key === null ? {} : { Authorization: `Bearer ${key}` } }).then(async (r) => ({ status: r.status, body: await r.json() }));

async function login(page, email) {
  await page.goto(BASE + '/login');
  await page.fill('#email', email);
  await page.fill('input[name="password"]', 'testpass123');
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
}

run(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  await login(page, 'admin@test.local');
  check('admin sees Developers tab', await page.isVisible('nav >> text=Developers'));
  await page.click('nav >> text=Developers');
  await page.waitForURL(/\/dashboard\/developers$/);
  check('developers page title', await titleSoon(page, 'Developers | Smithton Church Newsletter'), await page.title());

  // Invalid address is rejected with a clear message.
  await page.fill('input[placeholder^="Project name"]', 'Highland Youth site');
  await page.fill('textarea', 'example.com\nnot a domain');
  await page.click('button:has-text("Create project")');
  await page.waitForSelector('text=Not a valid website address');
  check('invalid website address rejected', await page.isVisible('text=Not a valid website address: not a domain'));

  await page.fill('textarea', 'example.com/some/page\n*.example.org\nhttp://localhost:3000\nhttp://example.net');
  await page.click('button:has-text("Create project")');
  await page.waitForSelector('text=Not a valid website address: http://example.net');
  check('plain http rejected for non-local site', true);

  await page.fill('textarea', 'example.com/some/page\n*.example.org\nhttp://localhost:3000\nEXAMPLE.com');
  await Promise.all([page.waitForURL(/\/dashboard\/developers\/proj_/), page.click('button:has-text("Create project")')]);
  const projectUrl = page.url();
  const origins = await page.inputValue('textarea');
  check('addresses normalized & de-duplicated', origins === 'https://example.com\nhttps://*.example.org\nhttp://localhost:3000', JSON.stringify(origins));
  await page.waitForFunction(() => document.title.startsWith("Highland"), null, { timeout: 5000 }).catch(() => {});
  check("project page title", (await page.title()) === "Highland Youth site | Smithton Church Newsletter", await page.title());

  // Create a key and read it from the one-time panel.
  await page.fill('input[placeholder^="Key name"]', 'Production server');
  await page.click('button:has-text("Create key")');
  await page.waitForSelector('text=Your new key: Production server');
  const key = (await page.textContent('section.border-amber-200 code')).trim();
  check('key format', /^fbsk_[A-Za-z0-9_-]{43}$/.test(key), key.slice(0, 11) + '…');
  await page.click('button:has-text("Copy")');
  check('copy button copies the key', (await page.evaluate(() => navigator.clipboard.readText())) === key);
  await page.screenshot({ path: `${dir}/p1-new-key.png`, fullPage: true });
  await page.click("text=I've saved it");
  check('key panel dismissed (key no longer shown)', !(await page.content()).includes(key));
  check('key listed with prefix only, "Never used"', await visibleSoon(page, `text=${key.slice(0, 11)}…`) && await visibleSoon(page, 'text=Never used'));

  // API behaviour.
  let r = await api(key);
  check('valid key → 200 with project', r.status === 200 && r.body.project.name === 'Highland Youth site' && r.body.key.name === 'Production server', JSON.stringify(r.body));
  check('response has no CORS header (server-only)', !(await fetch(BASE + '/api/v1/project', { headers: { Authorization: `Bearer ${key}`, Origin: 'https://evil.example' } })).headers.get('access-control-allow-origin'));
  r = await api(null); check('no key → 401 missing_api_key', r.status === 401 && r.body.error.code === 'missing_api_key');
  r = await api(key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A')); check('wrong key → 401 invalid_api_key', r.status === 401 && r.body.error.code === 'invalid_api_key');
  r = await api('sk_live_whatever'); check('foreign-format key → 401', r.status === 401);

  await page.reload();
  check('"Last used" shown after use', await page.isVisible('text=/Last used \\d/'));

  // Disable project → 403; re-enable → 200.
  await page.click('button[role="switch"]'); await page.waitForSelector('text=Project disabled.');
  r = await api(key); check('disabled project → 403 project_disabled', r.status === 403 && r.body.error.code === 'project_disabled');
  await page.click('button[role="switch"]'); await page.waitForSelector('text=Project enabled.');
  r = await api(key); check('re-enabled → 200', r.status === 200);

  // Second key, then revoke the first.
  await page.fill('input[placeholder^="Key name"]', 'Development');
  await page.click('button:has-text("Create key")');
  await page.waitForSelector('text=Your new key: Development');
  const key2 = (await page.textContent('section.border-amber-200 code')).trim();
  await page.click("text=I've saved it");
  page.once('dialog', (d) => d.accept());
  await page.click('li:has-text("Production server") >> button:has-text("Revoke")');
  await page.waitForSelector('text=Key revoked.');
  r = await api(key); check('revoked key → 401 immediately', r.status === 401 && r.body.error.code === 'invalid_api_key');
  r = await api(key2); check('other key unaffected → 200', r.status === 200);
  check('revoked key listed under "1 revoked key"', await visibleSoon(page, 'text=1 revoked key'));
  await page.screenshot({ path: `${dir}/p1-project.png`, fullPage: true });

  // Rate limit: 300/min per key (1 already used by key2 above).
  const statuses = await Promise.all(Array.from({ length: 305 }, () => api(key2).then((x) => x.status)));
  const ok = statuses.filter((s) => s === 200).length, limited = statuses.filter((s) => s === 429).length;
  check('rate limit kicks in around 300/min', ok >= 290 && ok <= 305 && limited >= 1, `200s=${ok} 429s=${limited}`);
  r = await api(key2); check('429 response has documented shape', r.status === 429 && r.body.error.code === 'rate_limited');

  // Projects list.
  await page.goto(BASE + '/dashboard/developers');
  check('list shows project with 1 active key', await page.isVisible('text=Highland Youth site') && await page.isVisible('text=1 active key'));
  await page.screenshot({ path: `${dir}/p1-list.png`, fullPage: true });

  // Non-admin is kept out.
  const mctx = await browser.newContext();
  const mpage = await mctx.newPage();
  await login(mpage, 'member@test.local');
  check('member has no Developers tab', !(await mpage.isVisible('nav >> text=Developers')));
  await mpage.goto(BASE + '/dashboard/developers');
  check('member redirected away from Developers page', !mpage.url().includes('/developers'), mpage.url());
  await mpage.goto(projectUrl);
  check('member redirected away from a project page', !mpage.url().includes('/developers'));
  const mres = await mpage.evaluate(async () => (await fetch('/api/developer/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x', allowedOrigins: [] }) })).status);
  check('member API call → 403', mres === 403, String(mres));
  const anon = await fetch(BASE + '/api/developer/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"x","allowedOrigins":[]}' });
  check('signed-out API call → 401', anon.status === 401, String(anon.status));

  // Delete project → its keys stop working.
  await page.goto(projectUrl);
  page.once('dialog', (d) => d.accept());
  await Promise.all([page.waitForURL(/\/dashboard\/developers$/), page.click('button:has-text("Delete project")')]);
  r = await api(key2); check('deleted project → its keys 401', r.status === 401);
  check('list empty after delete', await visibleSoon(page, 'text=No projects yet.'));

  await browser.close();
});
