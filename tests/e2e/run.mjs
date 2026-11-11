// End-to-end tests: runs the real app against a local stand-in for Cloudflare D1 (SQLite built
// from the repo's migrations), with stand-in external sites, driving it in Chromium.
//
//   npm run build && npm run test:e2e          all suites
//   npm run test:e2e -- stats                  suites whose name contains "stats"
//
// Each suite gets a fresh database and a fresh app server on port 3000; the stand-in external
// sites use ports 4000–4300. Screenshots and logs go to tests/e2e/.output/. Set CHROMIUM_PATH
// to use an already-installed Chromium instead of Playwright's own.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const out = process.env.E2E_OUT || join(here, ".output");
const filter = process.argv[2] ?? "";

const suites = [
  { file: "01-projects-and-keys.cjs", server: "start" },
  { file: "02-hosted-viewer.cjs", server: "start" },
  { file: "03-developer-access.cjs", server: "start" },
  // Production mode refuses webhooks to localhost (correctly), so this suite runs on next dev.
  { file: "04-stats-delivery.cjs", server: "dev" },
  { file: "05-developer-kit.cjs", server: "start" },
  { file: "06-security.cjs", server: "start" },
].filter((s) => s.file.includes(filter));

const appEnv = {
  ...process.env,
  NODE_OPTIONS: `--import ${join(here, "harness/mock-d1.mjs")} --no-warnings`,
  MOCK_D1_PATH: join(out, "test.db"),
  CLOUDFLARE_ACCOUNT_ID: "test",
  CLOUDFLARE_D1_DATABASE_ID: "test",
  CLOUDFLARE_D1_API_TOKEN: "test",
  // Presigning R2 URLs happens locally; the browser's requests to R2 are intercepted by the tests.
  CLOUDFLARE_R2_ACCESS_KEY_ID: "test",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: "test",
  AUTH_SECRET: "e2e-test-secret-e2e-test-secret-123",
  NEXTAUTH_URL: "http://localhost:3000",
  AUTH_TRUST_HOST: "true",
  CRON_SECRET: "cron-test-secret",
  NEXT_TELEMETRY_DISABLED: "1",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startApp(mode, logFile) {
  const log = openSync(logFile, "w");
  const args = mode === "dev" ? ["next", "dev", "-p", "3000"] : ["next", "start", "-p", "3000"];
  // Its own process group, so stopping it stops Next's worker processes too.
  return spawn("npx", args, { cwd: root, env: appEnv, stdio: ["ignore", log, log], detached: true });
}

function stop(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // already gone
  }
}

// next dev compiles each route on first request; doing that up front keeps the suite's own
// timeouts about the app rather than the compiler.
async function warmUp() {
  for (const path of [
    "/login",
    "/dashboard",
    "/dashboard/developers",
    "/v1/view/vt_warmup",
    "/api/v1/project",
    "/api/v1/viewer-tokens",
    "/api/v1/events",
    "/api/v1/stats",
    "/api/viewer/views",
    "/api/viewer/events",
    "/api/cron",
    "/api/developer/projects",
  ]) {
    await fetch(`http://localhost:3000${path}`, { redirect: "manual" }).catch(() => {});
  }
}

if (!existsSync(join(root, ".next/BUILD_ID"))) {
  console.error("No production build found — run `npm run build` first.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The React component's test page, bundled like a project would.
await build({
  entryPoints: [join(here, "react-app/main.tsx")],
  bundle: true,
  outfile: join(out, "react.js"),
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  logLevel: "error",
});

const fixtures = spawn(process.execPath, [join(here, "harness/fixtures.mjs"), out], { stdio: ["ignore", "pipe", "inherit"], detached: true });
await new Promise((resolve) => fixtures.stdout.once("data", resolve));

const results = [];
try {
  for (const suite of suites) {
    console.log(`\n=== ${suite.file} (next ${suite.server})`);
    const setup = spawnSync(process.execPath, ["--no-warnings", join(here, "harness/setup-db.mjs"), join(out, "test.db")], { stdio: "inherit" });
    if (setup.status !== 0) throw new Error("Couldn't build the test database");

    const logFile = join(out, `server-${suite.file.replace(/\.cjs$/, "")}.log`);
    const app = startApp(suite.server, logFile);
    let ok = false;
    try {
      await waitForHttp("http://localhost:3000/login", 180_000);
      if (suite.server === "dev") await warmUp();
      const result = spawnSync(process.execPath, ["--no-warnings", join(here, "suites", suite.file)], {
        cwd: root,
        env: { ...process.env, E2E_OUT: out },
        stdio: "inherit",
        timeout: 15 * 60_000,
      });
      ok = result.status === 0;
    } finally {
      stop(app);
      await sleep(1000);
    }
    if (!ok) {
      console.log(`--- last lines of the app's log (${logFile}):`);
      console.log(readFileSync(logFile, "utf8").split("\n").slice(-40).join("\n"));
    }
    results.push({ suite: suite.file, ok });
  }
} finally {
  stop(fixtures);
}

console.log("\n=== Summary");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.suite}`);
const failed = results.filter((r) => !r.ok).length;
if (results.length === 0) console.log(`No suite matches "${filter}".`);
process.exit(failed || results.length === 0 ? 1 : 0);
