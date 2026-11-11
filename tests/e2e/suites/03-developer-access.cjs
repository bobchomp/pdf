// Per-user developer access switch on the Team page.
const { BASE, OUT: dir, check, launch, run } = require("../harness/helpers.cjs");
async function login(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(BASE + '/login');
  await page.fill('#email', email);
  await page.fill('input[name="password"]', 'testpass123');
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
  return page;
}
const tab = (p) => p.isVisible('nav >> text=Developers');
const apiStatus = (p) => p.evaluate(async () => (await fetch('/api/developer/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X', allowedOrigins: [] }) })).status);
const memberSwitch = 'button[aria-label="Developer access for Member"]';
run(async () => {
  const browser = await launch();
  const admin = await login(browser, 'admin@test.local');
  const member = await login(browser, 'member@test.local');

  check('admin (migrated) has Developers tab', await tab(admin));
  check('member has no tab by default', !(await tab(member)));
  await member.goto(BASE + '/dashboard/developers');
  check('member redirected from developers page', !member.url().includes('/developers'), member.url());
  check('member API blocked (403)', (await apiStatus(member)) === 403);

  await admin.goto(BASE + '/dashboard/admin');
  check('member switch shows off', (await admin.getAttribute(memberSwitch, 'aria-checked')) === 'false');
  await admin.click(memberSwitch);
  await admin.waitForSelector('text=Developer access turned on for Member');
  check('member switch now on', (await admin.getAttribute(memberSwitch, 'aria-checked')) === 'true');
  await admin.screenshot({ path: `${dir}/team.png` });

  await member.goto(BASE + '/dashboard');
  check('member sees tab without signing out', await tab(member));
  await member.click('nav >> text=Developers');
  await member.waitForURL(/\/dashboard\/developers$/);
  await member.waitForSelector('text=Add a project');
  check('member can open developers page', true);
  check('member API allowed (200)', (await apiStatus(member)) === 200);
  check('member still has no Team tab', !(await member.isVisible('nav >> text=Team')));

  await admin.click(memberSwitch);
  await admin.waitForSelector('text=Developer access turned off for Member');
  await member.reload();
  check('access removed immediately (redirected)', !member.url().includes('/developers') && !(await tab(member)), member.url());
  check('member API blocked again', (await apiStatus(member)) === 403);

  await admin.click('button[aria-label="Developer access for Admin"]');
  await admin.waitForSelector('text=Developer access turned off for Admin');
  await admin.reload();
  check('admin can switch own access off', !(await tab(admin)));
  await admin.click('button[aria-label="Developer access for Admin"]');
  await admin.waitForSelector('text=Developer access turned on for Admin');
  await admin.reload();
  check('…and back on', await tab(admin));

  for (const [name, role] of [['New Admin', 'admin'], ['New Member', 'member']]) {
    await admin.fill('input[placeholder="Name"]', name);
    await admin.fill('input[placeholder="Email"]', `${role}2@test.local`);
    await admin.selectOption('form select', role);
    await admin.click('button:has-text("Add teammate")');
    await admin.waitForSelector(`button[aria-label="Developer access for ${name}"]`);
  }
  check('new admin starts with access', (await admin.getAttribute('button[aria-label="Developer access for New Admin"]', 'aria-checked')) === 'true');
  check('new member starts without', (await admin.getAttribute('button[aria-label="Developer access for New Member"]', 'aria-checked')) === 'false');
  await browser.close();
});
