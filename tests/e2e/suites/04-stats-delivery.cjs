// Phase 3: events API, stats API, signed webhooks with retries, scheduled job and 30-day cleanup.
// Needs the app running under `next dev`: production refuses webhooks to localhost.
const { BASE, OUT: dir, check, launch, openDb, run, sleep } = require("../harness/helpers.cjs");
const crypto = require('node:crypto');
const fs = require('node:fs');
const HOOK = 'http://localhost:4300/hook';
const db = openDb();
const RECEIVED = `${dir}/received.json`;
const PDF_URL = 'http://localhost:4000/sample.pdf';
const control = (q) => fetch(`http://localhost:4300/control?${q}`).then((r) => r.text());
const received = () => JSON.parse(fs.readFileSync(RECEIVED, 'utf8'));
async function call(key, method, path, body, headers = {}) {
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function verify(secret, header, body) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? '');
  if (!m) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${m[1]}.${body}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(m[2])) && Math.abs(Date.now() / 1000 - Number(m[1])) < 300;
}
async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await sleep(250); }
  return false;
}
const projectSeqs = (projectId) => db.prepare('SELECT seq FROM api_events WHERE project_id=? ORDER BY seq').all(projectId).map((r) => r.seq);

run(async () => {
  await control('mode=ok&reset=1');
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + '/login');
  await page.fill('#email', 'admin@test.local');
  await page.fill('input[name="password"]', 'testpass123');
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
  const { projectId, key } = await page.evaluate(async () => {
    const p = await (await fetch('/api/developer/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Youth site', allowedOrigins: ['http://localhost:4100'] }) })).json();
    const k = await (await fetch(`/api/developer/projects/${p.project.id}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'dev' }) })).json();
    return { projectId: p.project.id, key: k.key.key };
  });

  async function viewDocument(docId, flips = 1, clickLink = false) {
    const t = await call(key, 'POST', '/api/v1/viewer-tokens', { document: { id: docId, title: `Doc ${docId}`, url: PDF_URL } });
    const viewer = await ctx.newPage();
    viewer.on('pageerror', (e) => errors.push(e.message));
    await viewer.goto(`http://localhost:4100/?src=${encodeURIComponent(t.body.url)}`);
    const frame = await (await viewer.waitForSelector('#v')).contentFrame();
    await frame.waitForFunction(() => [...document.querySelectorAll('[data-page-number] canvas')].some((c) => c.width > 0), null, { timeout: 30000 });
    await sleep(500);
    for (let i = 0; i < flips; i++) { await frame.click('button[aria-label="Next page"] >> nth=1'); await sleep(800); }
    if (clickLink) {
      await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).then((p) => p.close()).catch(() => null), frame.click('[data-page-number="2"] a')]);
      await sleep(500);
    }
    await viewer.close();
  }

  // ---- Events recorded in order, view start included
  await viewDocument('spring', 3, false);
  let rows = db.prepare('SELECT seq,type,page_number FROM api_events WHERE project_id=? ORDER BY seq').all(projectId);
  check('view start + page views recorded in order', rows[0]?.type === 'view_start' && rows.slice(1).every((r) => r.type === 'page_view') && rows.length >= 4, rows.map((r) => `${r.type}:${r.page_number ?? ''}`).join(' '));
  check('document page count reported by viewer', db.prepare("SELECT page_count FROM api_documents WHERE external_id='spring'").get().page_count === 6);

  // ---- Pull API
  let r = await call(key, 'GET', '/api/v1/events');
  check('events API: no auth -> 401', (await call(null, 'GET', '/api/v1/events')).status === 401);
  check('events API returns all', r.status === 200 && r.body.events.length === rows.length && r.body.hasMore === false, JSON.stringify(r.body).slice(0, 100));
  const first = r.body.events[0];
  check('event shape: public type, external doc id, visitor on start', first.type === 'view.started' && first.document.id === 'spring' && first.document.title === 'Doc spring' && first.visitor?.deviceType === 'desktop' && first.visitor.referrer.startsWith('http://localhost:4100') && !('pageNumber' in first));
  check('page events have pageNumber, no visitor', r.body.events[1].type === 'page.viewed' && r.body.events[1].pageNumber === 1 && !r.body.events[1].visitor);
  check('ISO timestamps with ms', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(first.occurredAt));
  const p1 = await call(key, 'GET', '/api/v1/events?limit=2');
  const p2 = await call(key, 'GET', `/api/v1/events?limit=2&after=${p1.body.nextCursor}`);
  check('pagination: limit + cursor', p1.body.events.length === 2 && p1.body.hasMore && p2.body.events[0].sequence > p1.body.events[1].sequence);
  const end = await call(key, 'GET', `/api/v1/events?after=${r.body.nextCursor}`);
  check('caught up: empty page keeps cursor', end.body.events.length === 0 && end.body.nextCursor === r.body.nextCursor && !end.body.hasMore);
  check('bad cursor -> 400', (await call(key, 'GET', '/api/v1/events?after=abc')).status === 400);
  check('limit too high -> 400', (await call(key, 'GET', '/api/v1/events?limit=501')).status === 400);
  check('documentId filter (unknown) -> empty', (await call(key, 'GET', '/api/v1/events?documentId=nope')).body.events.length === 0);

  // ---- Stats API
  await viewDocument('autumn', 1, true);
  r = await call(key, 'GET', '/api/v1/stats');
  check('project stats: totals and per-document', r.status === 200 && r.body.totals.views === 2 && r.body.documents.length === 2 && r.body.totals.linkClicks === 1, JSON.stringify(r.body.totals));
  check('project stats: no internal ids leaked', !JSON.stringify(r.body).includes('internalId') && !JSON.stringify(r.body).includes('doc_'));
  r = await call(key, 'GET', '/api/v1/stats?documentId=autumn&days=7');
  check('document stats detail', r.status === 200 && r.body.totals.views === 1 && r.body.links[0]?.url === 'https://example.com/clicked' && r.body.pages.length >= 2 && r.body.devices[0]?.label === 'desktop' && r.body.viewsByDay.length === 1, JSON.stringify(r.body).slice(0, 200));
  check('document stats: unknown -> 404', (await call(key, 'GET', '/api/v1/stats?documentId=nope')).status === 404);
  check('stats: days out of range -> 400', (await call(key, 'GET', '/api/v1/stats?days=31')).status === 400);

  // ---- Webhook setup via dashboard
  await page.goto(`${BASE}/dashboard/developers/${projectId}`);
  await page.waitForSelector('text=Send stats to your project');
  const hookInput = 'input[placeholder^="https://your-site.com"]';
  await page.fill(hookInput, 'ftp://example.com/x');
  await page.click('button:has-text("Turn on")');
  await page.waitForSelector('text=Use a full https:// address.');
  check('webhook: non-http address rejected', true);
  await page.fill(hookInput, `${HOOK}`);
  await page.click('button:has-text("Turn on")');
  await page.waitForSelector('text=Webhook turned on.');
  await page.waitForSelector('text=Signing secret');
  const proj = () => db.prepare('SELECT * FROM api_projects WHERE id=?').get(projectId);
  let secret = proj().webhook_secret;
  check('secret issued (whsec_)', /^whsec_[A-Za-z0-9_-]{32}$/.test(secret));
  check('starts from now: cursor = latest event', proj().webhook_cursor === Math.max(...projectSeqs(projectId)));
  check('secret masked until shown', !(await page.textContent('body')).includes(secret));
  await page.click('button:has-text("Show")');
  check('secret shown on request', (await page.textContent('body')).includes(secret));
  check('status: up to date', await page.isVisible('text=Up to date'));

  await page.click('button:has-text("Send test event")');
  await page.waitForSelector('text=Test delivered');
  let got = received();
  const test = JSON.parse(got[0].body);
  check('test event received, signed correctly', got.length === 1 && test.test === true && test.events[0].type === 'view.started' && verify(secret, got[0].signature, got[0].body));
  check('wrong secret fails verification', !verify('whsec_wrong', got[0].signature, got[0].body));

  // ---- Live delivery
  await control('reset=1');
  const startCursor = proj().webhook_cursor;
  await viewDocument('spring', 2, false);
  await waitFor(() => proj().webhook_cursor === Math.max(...projectSeqs(projectId)));
  got = received();
  let delivered = got.flatMap((g) => JSON.parse(g.body).events.map((e) => e.sequence));
  const expected = projectSeqs(projectId).filter((s) => s > startCursor);
  check('new events delivered as they happen', JSON.stringify(delivered) === JSON.stringify(expected), `${delivered} vs ${expected}`);
  check('every delivery correctly signed', got.every((g) => verify(secret, g.signature, g.body)));
  check('no duplicates under concurrent events', new Set(delivered).size === delivered.length);

  // ---- Failure, back-off, retry
  await control('mode=fail&reset=1');
  const beforeFail = proj().webhook_cursor;
  await viewDocument('spring', 2, false);
  await waitFor(() => proj().webhook_failures > 0);
  const attemptsAfterFail = received().length;
  check('failure recorded with back-off', proj().webhook_failures >= 1 && proj().webhook_next_attempt_at > Date.now() / 1000 && proj().webhook_cursor === beforeFail);
  await viewDocument('spring', 1, false);
  await sleep(1500);
  check('no hammering during back-off', received().length === attemptsAfterFail, `${attemptsAfterFail} -> ${received().length}`);
  await page.reload();
  await page.waitForSelector('text=Failing');
  check('dashboard shows failing + waiting count', await page.isVisible('text=/events? waiting/'));
  check('failed delivery in log with HTTP code', await page.isVisible('text=Responded with HTTP 500'));
  await page.screenshot({ path: `${dir}/p3-failing.png`, fullPage: true });

  await control('mode=ok&reset=1');
  await page.click('button:has-text("Retry now")');
  await page.waitForSelector('text=/Delivered \\d+ events?/');
  got = received();
  delivered = got.flatMap((g) => JSON.parse(g.body).events.map((e) => e.sequence));
  check('retry delivers everything waiting, in order, no gaps', JSON.stringify(delivered) === JSON.stringify(projectSeqs(projectId).filter((s) => s > beforeFail)) && proj().webhook_failures === 0);
  await page.reload();
  check('status back to up to date', await page.isVisible('text=Up to date'));

  // ---- Scheduled job
  check('cron: no auth -> 401', (await call(null, 'GET', '/api/cron')).status === 401);
  check('cron: wrong secret -> 401', (await call('nope', 'GET', '/api/cron')).status === 401);
  await control('mode=fail&reset=1');
  const beforeCron = proj().webhook_cursor;
  await viewDocument('winter', 1, false);
  await waitFor(() => proj().webhook_failures > 0);
  await control('mode=ok');
  r = await call('cron-test-secret', 'GET', '/api/cron');
  check('cron respects back-off (nothing sent yet)', r.status === 200 && r.body.webhookEventsDelivered === 0, JSON.stringify(r.body));
  db.prepare('UPDATE api_projects SET webhook_next_attempt_at=? WHERE id=?').run(Math.floor(Date.now() / 1000) - 1, projectId);
  r = await call('cron-test-secret', 'POST', '/api/cron');
  check('cron retries once back-off has passed', r.body.webhookEventsDelivered > 0 && proj().webhook_cursor === Math.max(...projectSeqs(projectId)) && proj().webhook_cursor > beforeCron, JSON.stringify(r.body));

  // Retention: age some rows past 30 days.
  const old = Date.now() - 31 * 86400_000;
  const oldView = db.prepare('SELECT id FROM api_views WHERE project_id=? ORDER BY viewed_at LIMIT 1').get(projectId).id;
  db.prepare('UPDATE api_views SET viewed_at=? WHERE id=?').run(Math.floor(old / 1000), oldView);
  db.prepare("UPDATE api_events SET occurred_at=? WHERE view_id=? AND type='view_start'").run(old, oldView);
  db.prepare('UPDATE api_webhook_deliveries SET attempted_at=? WHERE rowid IN (SELECT rowid FROM api_webhook_deliveries LIMIT 1)').run(old);
  const tok = db.prepare('SELECT id FROM api_viewer_tokens LIMIT 1').get().id;
  db.prepare('UPDATE api_viewer_tokens SET expires_at=? WHERE id=?').run(Math.floor(Date.now() / 1000) - 2 * 86400, tok);
  const eventsBefore = db.prepare('SELECT count(*) n FROM api_events WHERE view_id=?').get(oldView).n;
  const maxSeqBefore = Math.max(...projectSeqs(projectId));
  r = await call('cron-test-secret', 'GET', '/api/cron');
  check('cleanup removes old view with all its events', r.body.removed.views === 1 && r.body.removed.events === eventsBefore && db.prepare('SELECT count(*) n FROM api_events WHERE view_id=?').get(oldView).n === 0, JSON.stringify(r.body.removed));
  check('cleanup removes long-expired tokens and old delivery logs', r.body.removed.expiredTokens === 1 && r.body.removed.deliveries === 1);
  check('recent data kept', db.prepare('SELECT count(*) n FROM api_views WHERE project_id=?').get(projectId).n > 0);
  // Deleting the newest event must not let its number be handed out again.
  db.prepare('DELETE FROM api_events WHERE seq=?').run(maxSeqBefore);
  await viewDocument('spring', 0, false);
  check('sequence never reused after deletion', Math.max(...projectSeqs(projectId)) > maxSeqBefore && !projectSeqs(projectId).includes(maxSeqBefore));

  // ---- New secret
  await page.reload();
  page.once('dialog', (d) => d.accept());
  await page.click('button:has-text("New secret")');
  await page.waitForSelector('text=New secret created.');
  const newSecret = proj().webhook_secret;
  await control('reset=1');
  await page.click('button:has-text("Send test event")');
  await page.waitForSelector('text=Test delivered');
  got = received();
  check('new secret used immediately; old one no longer verifies', newSecret !== secret && verify(newSecret, got[0].signature, got[0].body) && !verify(secret, got[0].signature, got[0].body));

  // ---- Dashboard stats
  await page.reload();
  await page.waitForSelector('text=Doc spring');
  check('project page lists documents with counts', await page.isVisible('text=/\\d+ views? · \\d+ page views?/'));
  await page.screenshot({ path: `${dir}/p3-project.png`, fullPage: true });
  await page.click('text=Doc autumn');
  await page.waitForURL(/\/documents\/doc_/);
  await page.waitForSelector('text=Page engagement');
  const body = await page.textContent('body');
  check('document stats page: title, id, completion %', body.includes('Doc autumn') && body.includes('autumn') && /\d+%/.test(body), body.match(/\d+%/)?.[0]);
  check('document stats page title', (await page.title()) === 'Doc autumn stats | Smithton Church Newsletter', await page.title());
  await page.screenshot({ path: `${dir}/p3-document.png`, fullPage: true });

  // ---- Turn off, delete
  await page.goto(`${BASE}/dashboard/developers/${projectId}`);
  page.once('dialog', (d) => d.accept());
  await page.click('button:has-text("Turn off")');
  await page.waitForSelector('text=Webhook turned off.');
  check('webhook off: url and secret cleared', proj().webhook_url === null && proj().webhook_secret === null);
  await control('reset=1');
  await viewDocument('spring', 0, false);
  await sleep(1000);
  check('nothing sent once off', received().length === 0);

  await page.evaluate(async (id) => fetch(`/api/developer/projects/${id}`, { method: 'DELETE' }), projectId);
  const left = ['api_events', 'api_webhook_deliveries', 'api_views', 'api_projects'].map((t) => db.prepare(`SELECT count(*) n FROM ${t}`).get().n);
  check('project delete removes events and delivery logs', left.every((n) => n === 0), left.join(','));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
});
