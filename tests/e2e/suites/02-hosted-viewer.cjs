// Phase 2: viewer tokens, the hosted viewer, display settings, domain lock and event recording.
const { BASE, OUT: dir, check, launch, openDb, run, sleep } = require("../harness/helpers.cjs");
const fs = require('node:fs');
const db = openDb();
const PDF = fs.readFileSync(`${dir}/sample.pdf`);
const PDF_URL = 'http://localhost:4000/sample.pdf';

async function call(key, method, path, body) {
  const headers = {};
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) };
}
const token = (key, body) => call(key, 'POST', '/api/v1/viewer-tokens', body);
const doc = (extra = {}) => ({ id: 'spring-2026', title: 'Spring newsletter', url: PDF_URL, ...extra });

async function login(page) {
  await page.goto(BASE + '/login');
  await page.fill('#email', 'admin@test.local');
  await page.fill('input[name="password"]', 'testpass123');
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
}

// Opens a viewer URL inside the allowed host page and returns the viewer's frame once a page has rendered.
async function openInHost(page, url, port = 4100) {
  await page.goto(`http://localhost:${port}/?src=${encodeURIComponent(url)}`);
  const frame = await (await page.waitForSelector('#v')).contentFrame();
  return frame;
}
async function clickBook(page) {
  const box = await (await page.$('#v')).boundingBox();
  await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.55);
}
async function waitRendered(frame) {
  await frame.waitForFunction(() => [...document.querySelectorAll('[data-page-number] canvas')].some((c) => c.width > 0), null, { timeout: 15000 });
}

run(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // ---- Setup: a project allowed on localhost:4100, and a key.
  await login(page);
  const created = await page.evaluate(async () => {
    const p = await (await fetch('/api/developer/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Youth site', allowedOrigins: ['http://localhost:4100'] }) })).json();
    const k = await (await fetch(`/api/developer/projects/${p.project.id}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'dev' }) })).json();
    return { projectId: p.project.id, key: k.key.key };
  });
  const { projectId, key } = created;

  // ---- API validation
  check('token: no key -> 401', (await token(null, { document: doc() })).status === 401);
  let r = await token(key, { document: doc(), settings: { backgroundColor: 'red' } });
  check('token: bad colour -> 400 with field', r.status === 400 && r.body.error.code === 'invalid_request' && r.body.error.message.startsWith('settings.backgroundColor'), r.body?.error?.message);
  r = await token(key, { document: doc(), settings: { showToolbar: false } });
  check('token: unknown setting -> 400 naming it', r.status === 400 && r.body.error.message.includes('"showToolbar"'), r.body?.error?.message);
  r = await token(key, { document: doc({ url: 'http://files.example.com/a.pdf' }) });
  check('token: plain-http PDF url rejected', r.status === 400 && r.body.error.message.startsWith('document.url'), r.body?.error?.message);
  r = await token(key, { document: doc(), settings: { logoLinkUrl: 'javascript:alert(1)' } });
  check('token: javascript: link rejected', r.status === 400, r.body?.error?.message);
  r = await token(key, { document: { title: 'x', url: PDF_URL } });
  check('token: missing document id -> 400', r.status === 400 && r.body.error.message.startsWith('document.id'), r.body?.error?.message);
  r = await call(key, 'POST', '/api/v1/viewer-tokens', undefined);
  check('token: no body -> 400', r.status === 400 && r.body.error.code === 'invalid_request');
  r = await token(key, { document: doc(), expiresIn: 10 });
  check('token: expiresIn below 60 rejected', r.status === 400);

  // ---- A valid token
  r = await token(key, { document: doc() });
  check('token: created 201', r.status === 201, JSON.stringify(r.body).slice(0, 120));
  const t1 = r.body;
  check('token: format + viewer url', /^vt_[A-Za-z0-9_-]{32}$/.test(t1.token) && t1.url === `${BASE}/v1/view/${t1.token}`);
  const ttl = new Date(t1.expiresAt).getTime() - Date.now();
  check('token: expires in ~1 day by default', ttl > 86000e3 && ttl <= 86400e3);
  check('token: resolved settings returned', t1.settings.backgroundColor === '#0f2044' && t1.settings.headerColor === '#0f2044' && t1.settings.showPrint === true);
  check('token: no CORS on API', !r.headers.get('access-control-allow-origin'));

  // CSP header from the proxy
  let res = await fetch(t1.url);
  check('viewer: frame-ancestors lists the project origin', res.headers.get('content-security-policy') === "frame-ancestors 'self' http://localhost:4100", res.headers.get('content-security-policy'));
  check('viewer: not X-Frame-Options DENY', !res.headers.get('x-frame-options'));
  check('viewer: noindex', res.headers.get('x-robots-tag') === 'noindex');
  res = await fetch(`${BASE}/v1/view/vt_doesnotexist`);
  check('viewer: unknown token -> frame-ancestors self only', res.headers.get('content-security-policy') === "frame-ancestors 'self'");

  // ---- Shown in the allowed host page
  let frame = await openInHost(page, t1.url);
  await waitRendered(frame);
  check('viewer renders inside allowed site', true);
  check('viewer title is the document title', (await frame.title()) === 'Spring newsletter', await frame.title());
  check('header shows title', await frame.isVisible('text=Spring newsletter'));
  check('page counter "1 / 6" (page count read from PDF)', (await frame.textContent('body')).includes('1 / 6'));
  await page.screenshot({ path: `${dir}/p2-host-default.png` });
  await sleep(800);
  let views = db.prepare('SELECT * FROM api_views WHERE project_id=?').all(projectId);
  check('one view recorded', views.length === 1, String(views.length));
  check('view referrer is the host page', views[0]?.referrer?.startsWith('http://localhost:4100'), views[0]?.referrer);
  let events = db.prepare(`SELECT type,page_number FROM api_events WHERE type != 'view_start' AND project_id=? ORDER BY seq`).all(projectId);
  check('page 1 view event recorded', events.length === 1 && events[0].type === 'page_view' && events[0].page_number === 1, JSON.stringify(events));
  const docs = db.prepare('SELECT * FROM api_documents WHERE project_id=?').all(projectId);
  check('document stored with external id + title', docs.length === 1 && docs[0].external_id === 'spring-2026' && docs[0].title === 'Spring newsletter');

  // Flip to page 2 and click its link.
  await frame.click('button[aria-label="Next page"] >> nth=1');
  await sleep(900);
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), frame.click('[data-page-number="2"] a[href="https://example.com/clicked"]')]);
  if (popup) await popup.close();
  await sleep(800);
  events = db.prepare(`SELECT type,page_number,url FROM api_events WHERE type != 'view_start' AND project_id=? ORDER BY seq`).all(projectId);
  check('page turn recorded (pages 2 & 3 of spread)', events.some((e) => e.type === 'page_view' && e.page_number >= 2), JSON.stringify(events));
  check('link click recorded', events.some((e) => e.type === 'link_click' && e.page_number === 2 && e.url === 'https://example.com/clicked'));

  // Download uses the loaded bytes and names the file after the title.
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), frame.click('button[aria-label="Download"]')]);
  check('download named after document', download.suggestedFilename() === 'Spring newsletter.pdf', download.suggestedFilename());
  const dlPath = await download.path();
  check('download is the PDF', fs.readFileSync(dlPath).equals(PDF));

  // Zoom works by default.
  await clickBook(page);
  await sleep(700);
  check('click to zoom works by default', await frame.isVisible('button[aria-label="Close zoom"], [aria-label*="lose"]'));

  // ---- Not allowed on another site
  await page.goto(`http://localhost:4200/?src=${encodeURIComponent(t1.url)}`);
  await sleep(2500);
  const blockedFrame = await (await page.$('#v')).contentFrame();
  const blockedHasViewer = blockedFrame ? await blockedFrame.$('[data-page-number]').catch(() => null) : null;
  check('viewer blocked on a site not in the list', !blockedHasViewer);

  // ---- Settings per token
  r = await token(key, {
    document: doc({ id: 'custom', title: 'Custom look' }),
    settings: { showHeader: true, showTitle: false, showPrint: false, showDownload: false, showFullscreen: false, showPageArrows: false, enableZoom: false, startPage: 3, headerColor: '#ff0000', headerTextColor: '#00ff00', backgroundColor: '#123456' },
  });
  frame = await openInHost(page, r.body.url);
  await waitRendered(frame);
  const body = await frame.textContent('body');
  check('startPage 3 -> counter "3 / 6"', body.includes('3 / 6'), body.match(/\d \/ 6/)?.[0]);
  check('title hidden', !(await frame.isVisible('text=Custom look')));
  check('print/download/fullscreen hidden', !(await frame.$('button[aria-label="Print"]')) && !(await frame.$('button[aria-label="Download"]')) && !(await frame.$('button[aria-label="Enter fullscreen"]')));
  check('side page arrows hidden (header arrows remain)', (await frame.$$('button[aria-label="Next page"]')).length === 1);
  const colors = await frame.evaluate(() => {
    const header = document.querySelector('button[aria-label="Next page"]').closest('div.shrink-0');
    return { header: getComputedStyle(header).backgroundColor, text: getComputedStyle(header).color, bg: getComputedStyle(header.parentElement).backgroundColor };
  });
  check('header colour, text colour, background applied', colors.header === 'rgb(255, 0, 0)' && colors.text === 'rgb(0, 255, 0)' && colors.bg === 'rgb(18, 52, 86)', JSON.stringify(colors));
  await page.screenshot({ path: `${dir}/p2-host-custom.png` });
  await clickBook(page);
  await sleep(700);
  check('zoom disabled', !(await frame.isVisible('[aria-label*="lose"]')));
  await sleep(500);
  events = db.prepare("SELECT page_number FROM api_events e JOIN api_documents d ON d.id=e.document_id WHERE d.external_id='custom' AND e.type != 'view_start' ORDER BY e.seq").all();
  check('first page event uses start page', events[0]?.page_number === 3, JSON.stringify(events));

  r = await token(key, { document: doc({ id: 'nohdr' }), settings: { showHeader: false } });
  frame = await openInHost(page, r.body.url);
  await waitRendered(frame);
  check('showHeader false hides header', !(await frame.isVisible('text=1 / 6')));

  // ---- Background image URL can't break out of CSS
  r = await token(key, { document: doc({ id: 'css' }), settings: { backgroundImageUrl: 'https://img.example.com/a");background-color:red;x:url("b' } });
  check('odd-but-valid image URL accepted', r.status === 201, r.body?.error?.message);
  frame = await openInHost(page, r.body.url);
  await waitRendered(frame);
  const bgStyle = await frame.evaluate(() => {
    const el = document.querySelector('button[aria-label="Next page"]').closest('div.shrink-0').parentElement;
    return { image: el.style.backgroundImage, color: getComputedStyle(el).backgroundColor };
  });
  check('quote in image URL stays inside url()', bgStyle.image.includes('%22') && bgStyle.color === 'rgb(15, 32, 68)', JSON.stringify(bgStyle));

  // ---- Project defaults via the API
  r = await call(key, 'PATCH', '/api/v1/project', { defaultSettings: { backgroundColor: '#112233', showPrint: false, logoUrl: 'http://localhost:4000/logo.png' } });
  check('PATCH project defaults', r.status === 200 && r.body.project.defaultSettings.backgroundColor === '#112233', JSON.stringify(r.body).slice(0, 150));
  r = await call(key, 'PATCH', '/api/v1/project', { defaultSettings: { startPage: 2 } });
  check('startPage not allowed as a project default', r.status === 400, r.body?.error?.message);
  r = await call(key, 'GET', '/api/v1/project');
  check('GET project returns defaults', r.body.project.defaultSettings.showPrint === false);
  r = await token(key, { document: doc({ id: 'd1' }) });
  check('token inherits project defaults', r.body.settings.backgroundColor === '#112233' && r.body.settings.showPrint === false && r.body.settings.logoUrl === 'http://localhost:4000/logo.png');
  r = await token(key, { document: doc({ id: 'd2' }), settings: { showPrint: true, logoUrl: null } });
  check('token overrides defaults (incl. null clears logo)', r.body.settings.showPrint === true && r.body.settings.logoUrl === null && r.body.settings.backgroundColor === '#112233');
  frame = await openInHost(page, r.body.url);
  await waitRendered(frame);
  check('override shown: print visible, no logo', !!(await frame.$('button[aria-label="Print"]')) && !(await frame.$('img[src*="logo.png"]')));

  // ---- Dashboard display settings
  await page.goto(`${BASE}/dashboard/developers/${projectId}`);
  await page.waitForSelector('text=Display settings');
  check('dashboard shows saved defaults (print off)', (await page.getAttribute('button[role="switch"][aria-label="Print button"]', 'aria-checked')) === 'false');
  await page.click('button[role="switch"][aria-label="Print button"]');
  await page.fill('input[placeholder="https://… (optional)"] >> nth=1', '');
  await page.fill('input[placeholder="https://… (optional)"] >> nth=0', 'not a url');
  await page.click('button:has-text("Save display settings")');
  await page.waitForSelector('text=backgroundImageUrl');
  check('dashboard rejects bad image address', true);
  await page.fill('input[placeholder="https://… (optional)"] >> nth=0', '');
  await page.click('button:has-text("Save display settings")');
  await page.waitForSelector('text=Saved.');
  r = await call(key, 'GET', '/api/v1/project');
  check('dashboard save reaches API', r.body.project.defaultSettings.showPrint === true && r.body.project.defaultSettings.logoUrl === null && r.body.project.defaultSettings.backgroundColor === '#112233', JSON.stringify(r.body.project.defaultSettings));
  await page.screenshot({ path: `${dir}/p2-dashboard.png`, fullPage: true });

  // ---- Expired / disabled / missing PDF
  r = await token(key, { document: doc({ id: 'exp' }) });
  db.prepare('UPDATE api_viewer_tokens SET expires_at=? WHERE id=?').run(Math.floor(Date.now() / 1000) - 5, r.body.token);
  frame = await openInHost(page, r.body.url);
  await frame.waitForSelector('text=has expired');
  check('expired token shows message inside the frame', true);
  check('expired: view not recordable', (await call(null, 'POST', '/api/viewer/views', { token: r.body.token })).status === 404);

  r = await token(key, { document: doc({ id: 'missing', url: 'http://localhost:4000/nope.pdf' }) });
  frame = await openInHost(page, r.body.url);
  await frame.waitForSelector('text=Failed to load this PDF', { timeout: 10000 });
  check('unreachable PDF shows an error', true);

  const live = await token(key, { document: doc({ id: 'live' }) });
  await page.evaluate(async (id) => fetch(`/api/developer/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'disabled' }) }), projectId).catch(() => {});
  await page.goto(`${BASE}/dashboard`);
  await page.evaluate(async (id) => fetch(`/api/developer/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'disabled' }) }), projectId);
  frame = await openInHost(page, live.body.url);
  await frame.waitForSelector("text=isn't available");
  check('disabled project: viewer unavailable', true);

  // ---- Event endpoint validation
  check('events: unknown view -> 404', (await call(null, 'POST', '/api/viewer/events', { viewId: 'aview_nope', type: 'page_view', pageNumber: 1 })).status === 404);
  check('events: bad type -> 400', (await call(null, 'POST', '/api/viewer/events', { viewId: views[0].id, type: 'hack', pageNumber: 1 })).status === 400);

  // ---- Delete removes everything
  await page.goto(`${BASE}/dashboard`);
  await page.evaluate(async (id) => fetch(`/api/developer/projects/${id}`, { method: 'DELETE' }), projectId);
  const left = ['api_documents', 'api_viewer_tokens', 'api_views', 'api_events', 'api_webhook_deliveries', 'api_keys', 'api_projects'].map((t) => db.prepare(`SELECT count(*) n FROM ${t}`).get().n);
  check('deleting the project removes its documents, tokens, views, events', left.every((n) => n === 0), left.join(','));

  // ---- Regression: the church's own flipbook viewer
  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT INTO flipbooks (id,slug,owner_id,title,original_filename,r2_key,page_count,status,created_at,updated_at) VALUES ('fb_1','abc123','user_admin','Church news','news.pdf','flipbooks/fb_1/news.pdf',6,'ready',?,?)").run(now, now);
  await ctx.route(/r2\.cloudflarestorage\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'Access-Control-Allow-Origin': '*' }, body: PDF }));
  await page.goto(`${BASE}/f/abc123`);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-page-number] canvas')].some((c) => c.width > 0), null, { timeout: 15000 });
  check('own flipbook still renders', (await page.textContent('body')).includes('1 / 6'));
  await page.screenshot({ path: `${dir}/p2-own-flipbook.png` });
  await page.click('button[aria-label="Next page"] >> nth=1');
  await sleep(900);
  await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).then((p) => p.close()).catch(() => null), page.click('[data-page-number="2"] a')]);
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('button[aria-label="Download"]')]);
  check('own flipbook download works', dl2.suggestedFilename() === 'Church news.pdf', dl2.suggestedFilename());
  await sleep(800);
  const own = db.prepare("SELECT (SELECT count(*) FROM flipbook_views WHERE flipbook_id='fb_1') v, (SELECT group_concat(page_number) FROM flipbook_page_events WHERE flipbook_id='fb_1') p, (SELECT count(*) FROM flipbook_link_clicks WHERE flipbook_id='fb_1') c").get();
  check('own flipbook still records views, pages, link clicks', own.v === 1 && own.p.startsWith('1,') && own.c === 1, JSON.stringify(own));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
});
