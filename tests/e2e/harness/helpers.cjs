// Shared by every suite: paths, the browser, sign-in and pass/fail reporting.
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const OUT = process.env.E2E_OUT || path.join(ROOT, "tests/e2e/.output");
const BASE = "http://localhost:3000";

let failures = 0;
function check(name, ok, extra = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
}

/** Uses CHROMIUM_PATH when set (a preinstalled browser), otherwise Playwright's own. */
function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

async function login(page, email = "admin@test.local") {
  await page.goto(BASE + "/login");
  await page.fill("#email", email);
  await page.fill('input[name="password"]', "testpass123");
  await Promise.all([page.waitForURL(/\/dashboard/), page.click('button[type="submit"]')]);
}

/** The test database the app is reading (see run.mjs). */
function openDb() {
  return new DatabaseSync(path.join(OUT, "test.db"));
}

/** Runs a suite and sets the exit code from its checks. */
function run(suite) {
  suite().then(
    () => {
      console.log(failures ? `${failures} FAILED` : "ALL PASSED");
      process.exitCode = failures ? 1 : 0;
    },
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}

module.exports = { ROOT, OUT, BASE, check, launch, login, openDb, run, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
