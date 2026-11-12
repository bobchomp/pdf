// Phase 4: flipbook.js, the React component, the server helpers, /docs and /openapi.json.
const { BASE, OUT: dir, ROOT, check, launch, run, sleep } = require("../harness/helpers.cjs");
const path = require("node:path");
const { execFileSync } = require('node:child_process');
const tsx = (file, ...args) => execFileSync('npx', ['tsx', path.join(__dirname, file), ...args], { cwd: ROOT, encoding: 'utf8' });
const rendered = (frame) => frame.waitForFunction(() => [...document.querySelectorAll('[data-page-number] canvas')].some((c) => c.width > 0), null, { timeout: 20000 });

run(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + '/login');
  await page.fill('#email', 'admin@test.local');
  await page.fill('input[name="password"]', 'testpass123');
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
  const { key } = await page.evaluate(async () => {
    const p = await (await fetch('/api/developer/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Youth site', allowedOrigins: ['http://localhost:4100'] }) })).json();
    const k = await (await fetch(`/api/developer/projects/${p.project.id}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'dev' }) })).json();
    return { key: k.key.key };
  });

  // ---- Server helpers
  const out = tsx('sdk-server.ts', key);
  out.split('\n').filter((l) => /^(PASS|FAIL)/.test(l)).forEach((l) => check(`server helpers: ${l.replace(/^(PASS|FAIL)\s+/, '')}`, l.startsWith('PASS')));
  const url = /TOKEN_URL (\S+)/.exec(out)[1];

  // ---- flipbook.js, auto-mount
  await page.goto(`http://localhost:4100/sdk-auto?src=${encodeURIComponent(url)}`);
  const auto = await page.waitForSelector('#box iframe');
  check('auto-mount creates the iframe', (await auto.getAttribute('allow')) === 'fullscreen' && (await auto.getAttribute('title')) === 'Auto doc' && (await auto.evaluate((f) => f.style.height)) === '600px');
  let frame = await auto.contentFrame();
  await rendered(frame);
  await page.waitForFunction(() => window.domEvents.length >= 2, null, { timeout: 5000 }).catch(() => {});
  let dom = await page.evaluate(() => window.domEvents);
  check('DOM events: ready + pagechange with page count', dom.some((e) => e.type === 'ready' && e.pageCount === 6) && dom.some((e) => e.type === 'pagechange' && e.pageNumber === 1), JSON.stringify(dom));

  // ---- flipbook.js, Flipbook.mount with callbacks
  await page.goto(`http://localhost:4100/sdk-mount?src=${encodeURIComponent(url)}`);
  check('mount rejects a non-viewer URL', (await page.evaluate(() => window.badUrl)).includes('viewer URL'));
  const mounted = await page.waitForSelector('#newsletter iframe');
  check('height accepts CSS units', (await mounted.evaluate((f) => f.style.height)) === '80vh');
  frame = await mounted.contentFrame();
  await rendered(frame);
  await sleep(500);
  await frame.click('button[aria-label="Next page"] >> nth=1');
  await sleep(900);
  await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).then((p) => p.close()).catch(() => null), frame.click('[data-page-number="2"] a')]);
  await sleep(500);
  let log = await page.evaluate(() => window.log);
  check('callbacks: ready, pagechange 2, linkclick', log[0]?.type === 'ready' && log.some((e) => e.type === 'pagechange' && e.pageNumber === 2) && log.some((e) => e.type === 'linkclick' && e.url === 'https://example.com/clicked' && e.pageNumber === 2), JSON.stringify(log));
  // A message the host page posts itself, pretending to be the viewer, is ignored.
  const before = log.length;
  await page.evaluate(() => window.postMessage({ source: 'flipbook', type: 'pagechange', pageNumber: 99 }, '*'));
  await sleep(300);
  check('spoofed messages ignored', (await page.evaluate(() => window.log.length)) === before);
  await page.evaluate(() => window.viewer.destroy());
  check('destroy removes the iframe', !(await page.$('#newsletter iframe')));

  // ---- React component
  await page.goto(`http://localhost:4100/react?src=${encodeURIComponent(url)}`);
  const rframe = await page.waitForSelector('iframe');
  check('React: iframe props', (await rframe.getAttribute('title')) === 'Spring newsletter' && (await rframe.getAttribute('allow')) === 'fullscreen' && (await rframe.evaluate((f) => f.style.height)) === '600px');
  frame = await rframe.contentFrame();
  await rendered(frame);
  await page.waitForSelector('#page:has-text("page 1")', { timeout: 5000 }).catch(() => {});
  await frame.click('button[aria-label="Next page"] >> nth=1');
  await page.waitForSelector('#page:has-text("page 2")', { timeout: 5000 }).catch(() => {});
  log = await page.evaluate(() => window.flipbookLog);
  check('React: onReady and onPageChange fire, state updates', log[0]?.type === 'ready' && (await page.textContent('#page')) === 'page 2', JSON.stringify(log));
  await page.click('#toggle');
  check('React: unmounts cleanly', !(await page.$('iframe')));
  await page.screenshot({ path: `${dir}/p4-react.png` });

  // ---- Opened directly (not framed): projects are embedded-only by default, so it redirects, no errors
  const direct = await ctx.newPage();
  direct.on('pageerror', (e) => errors.push(e.message));
  await direct.goto(url);
  check('direct open is sent to the website it was viewed on', direct.url() === 'http://localhost:4100/', direct.url());
  await direct.close();

  // ---- Events/stats through the helpers, after the views above
  await sleep(500);
  const ev = JSON.parse(tsx('sdk-events.ts', key).trim().split('\n').pop());
  check('listEvents paging + allEvents iterates everything in order', ev.page1 === 2 && ev.hasMore && ev.all.length > 5 && ev.all.every((s, i) => i === 0 || s > ev.all[i - 1]), JSON.stringify(ev));
  // Three embedded views above (auto-mount, Flipbook.mount, React); the direct open is blocked and not counted.
  check('documentId filter + getDocumentStats', ev.docOnly && ev.docViews === 3 && ev.pages >= 2, JSON.stringify(ev));

  // ---- Docs and OpenAPI
  const docs = await ctx.newPage();
  const res = await docs.goto(`${BASE}/docs`);
  check('docs page public (no sign-in) with framing protection', res.status() === 200 && res.headers()['x-frame-options'] === 'DENY');
  check('docs title', (await docs.title()) === 'API docs | Smithton Church Newsletter', await docs.title());
  const rows = await docs.$$eval('#settings tbody tr', (trs) => trs.map((tr) => tr.children[0].textContent));
  check('settings table lists all 16 settings', rows.length === 16 && rows.includes('startPage') && rows.includes('headerTextColor'));
  check('examples use this site\'s address', (await docs.textContent('#quick-start')).includes('http://localhost:3000/api/v1/viewer-tokens'));
  const anchors = await docs.$$eval('nav a', (as) => as.map((a) => a.getAttribute('href').slice(1)));
  const missing = [];
  for (const id of anchors) if (!(await docs.$(`#${id}`))) missing.push(id);
  check('every nav link has its section', anchors.length === 13 && missing.length === 0, missing.join(','));

  // AI assistant prompt: points at this site's plain-text guide, and the copy button copies it.
  const prompt = await docs.textContent('#ai-prompt');
  check('AI prompt points at /llms.txt, the API description and the kit', [`${BASE}/llms.txt`, `${BASE}/openapi.json`, `${BASE}/sdk/v1/flipbook-server.ts`, 'FLIPBOOK_API_KEY', 'verifyWebhook'].every((s) => prompt.includes(s)));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await docs.click('button:has-text("Copy prompt")');
  await docs.waitForSelector('button:has-text("Copied")');
  check('Copy prompt copies the whole prompt', (await docs.evaluate(() => navigator.clipboard.readText())) === prompt.trim());

  const llms = await fetch(`${BASE}/llms.txt`);
  const llmsText = await llms.text();
  check('llms.txt is plain text, readable cross-origin', /^text\/plain/.test(llms.headers.get('content-type')) && llms.headers.get('access-control-allow-origin') === '*');
  const settingNames = ['backgroundColor', 'headerTextColor', 'showPageArrows', 'enableZoom', 'startPage'];
  check('llms.txt covers endpoints, webhooks, settings and kit with this site\'s address', ['POST /api/v1/viewer-tokens', 'GET /api/v1/events', 'GET /api/v1/stats', 'Flipbook-Signature', `${BASE}/sdk/v1/flipbook.js`, 'embedded-only', ...settingNames].every((s) => llmsText.includes(s)));
  await docs.screenshot({ path: `${dir}/p4-docs.png`, fullPage: true });
  await docs.setViewportSize({ width: 390, height: 844 });
  check('docs fit a phone (no sideways scroll)', await docs.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await docs.screenshot({ path: `${dir}/p4-docs-phone.png` });
  for (const [path, needle] of [['/sdk/v1/flipbook.js', 'window.Flipbook'], ['/sdk/v1/flipbook-react.tsx', 'export function Flipbook'], ['/sdk/v1/flipbook-server.ts', 'export async function verifyWebhook']]) {
    const r = await fetch(BASE + path);
    check(`download ${path}`, r.status === 200 && (await r.text()).includes(needle));
  }
  const spec = await fetch(`${BASE}/openapi.json`);
  const specJson = await spec.json();
  check('openapi.json served cross-origin', spec.headers.get('access-control-allow-origin') === '*' && specJson.servers[0].url === BASE);
  check('openapi settings generated from validation schema', Object.keys(specJson.components.schemas.ViewerSettings.properties).length === 16 && !('startPage' in specJson.components.schemas.ProjectDefaultSettings.properties));
  require('node:fs').writeFileSync(`${dir}/openapi.json`, JSON.stringify(specJson));

  // Developers page links to the docs.
  await page.goto(`${BASE}/dashboard/developers`);
  check('dashboard links to API docs', (await page.getAttribute('a:has-text("API docs")', 'href')) === '/docs');

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
});
