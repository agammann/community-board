import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm, rmdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createServer } from "vite";

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = "SYNTHETIC_RECOVERY_MARKER_NOT_A_KEY";
const boardFile = `${"a".repeat(64)}.json`;
// Copy only known source inputs; never copy checkout-local state or rely on
// Git metadata, because this test also runs in a downloaded source archive.
const fixtureFiles = [
  ".openai/hosting.json", "README.md", "app/board-app.tsx", "app/connect/page.tsx", "app/globals.css",
  "build/sites-vite-plugin.ts", "client/board.tsx", "client/connect.tsx", "components/ui/dialog.tsx",
  "connect/index.html", "index.html", "lib/browser-identity.ts", "lib/nostr-board.ts", "lib/reply-drafts.ts",
  "lib/utils.ts", "package.json", "package-lock.json", "postcss.config.mjs", "public/favicon.svg",
  "scripts/execution-profile.mjs", "scripts/local-link.mjs", "scripts/run-framework.mjs", "tsconfig.json",
  "vite.config.ts", "worker/index.ts",
];

async function copyFixture(temp) {
  const fixture = path.join(temp, "source");
  await mkdir(fixture);
  for (const name of fixtureFiles) {
    const target = path.join(fixture, name);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(source, name), target);
  }
  await symlink(path.join(source, "node_modules"), path.join(fixture, "node_modules"), "junction");
  return fixture;
}

test("development serving does not expose synthetic MCP recovery files", { timeout: 120_000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "community-board-dev-guard-"));
  let server;
  const savedEnv = { ...process.env };
  try {
    const fixture = await copyFixture(temp);
    const legacy = path.join(fixture, "mcp", ".state");
    const custom = path.join(fixture, "public", "custom-state");
    await mkdir(legacy, { recursive: true });
    await mkdir(custom, { recursive: true });
    await writeFile(path.join(legacy, boardFile), marker);
    await writeFile(path.join(legacy, "renamed.json"), marker);
    await writeFile(path.join(custom, boardFile), marker);
    await writeFile(path.join(fixture, "public", "ordinary.json"), '{"public":true}');
    await writeFile(path.join(fixture, ".npmrc"), marker);
    await symlink(legacy, path.join(fixture, "public", "legacy-link"), "junction");
    let symlinkAvailable = false;
    try {
      await symlink(path.join(legacy, boardFile), path.join(fixture, "public", "alias.json"), "file");
      symlinkAvailable = true;
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
      t.diagnostic(`File symlink case unavailable: ${error.code}`);
    }
    process.env.COMMUNITY_BOARD_STATE_DIR = path.join(temp, "unused-state");
    process.env.USERPROFILE = temp;
    process.env.XDG_CONFIG_HOME = path.join(temp, "config");
    process.env.CLOUDFLARE_CF_FETCH_ENABLED = "false";
    process.env.WRANGLER_SEND_METRICS = "false";
    process.env.WRANGLER_WRITE_LOGS = "false";
    process.env.WRANGLER_LOG_PATH = path.join(temp, "logs");
    process.env.WRANGLER_REGISTRY_PATH = path.join(temp, "registry");
    process.env.MINIFLARE_REGISTRY_PATH = path.join(temp, "miniflare");
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_API_KEY;
    server = await createServer({
      root: fixture,
      configFile: path.join(fixture, "vite.config.ts"),
      server: {
        host: "127.0.0.1",
        port: 0,
        // This response-only fixture does not need file watching.
        watch: null,
      },
      logLevel: "silent",
    });
    await server.listen();
    const port = server.httpServer.address().port;
    const base = `http://127.0.0.1:${port}`;
    const urls = [`/mcp/.state/${boardFile}`, `/@fs/${path.join(legacy, boardFile).replaceAll("\\", "/")}`, `/custom-state/${boardFile}`, `/@fs/${path.join(custom, boardFile).replaceAll("\\", "/")}`, `/%6dcp/.state/${boardFile}`, `/custom-state/${boardFile.toUpperCase()}`, "/legacy-link/renamed.json", "/@/public/legacy-link/renamed.json"];
    if (symlinkAvailable) urls.push("/alias.json");
    for (const url of urls) {
      const response = await fetch(base + url);
      assert.equal(response.status, 403, `recovery path not denied at ${url}`);
      assert(!((await response.text()).includes(marker)), `recovery marker served at ${url}`);
    }
    assert.equal((await fetch(`${base}/mcp/.state/${boardFile}`, { method: "HEAD" })).status, 403);
    assert.equal((await fetch(`${base}/.npmrc`)).status, 403);
    assert.match(await (await fetch(`${base}/README.md`)).text(), /Community Board/);
    assert.deepEqual(await (await fetch(`${base}/ordinary.json`)).json(), { public: true });
  } finally {
    if (server) await server.close();
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    const relative = path.relative(os.tmpdir(), temp);
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await rm(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
  }
});

test("production build refuses to copy synthetic recovery files from public", { timeout: 90_000 }, async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "community-board-build-guard-"));
  try {
    const fixture = await copyFixture(temp);
    const custom = path.join(fixture, "public", "custom-state");
    await mkdir(custom, { recursive: true });
    await writeFile(path.join(custom, boardFile), marker);
    const env = { ...process.env, USERPROFILE: temp, XDG_CONFIG_HOME: path.join(temp, "config"), CLOUDFLARE_CF_FETCH_ENABLED: "false", WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: path.join(temp, "logs"), WRANGLER_REGISTRY_PATH: path.join(temp, "registry"), MINIFLARE_REGISTRY_PATH: path.join(temp, "miniflare") };
    delete env.CLOUDFLARE_API_TOKEN;
    delete env.CLOUDFLARE_API_KEY;
    assert.throws(
      () => execFileSync(process.execPath, ["scripts/run-framework.mjs", "build"], { cwd: fixture, env, stdio: "pipe", timeout: 30000 }),
      (error) => /private recovery/i.test(String(error.stderr)),
      "build must refuse to copy a synthetic recovery file from public",
    );
    await assert.rejects(access(path.join(fixture, "dist", "client", "custom-state", boardFile)), { code: "ENOENT" });
    await rm(path.join(custom, boardFile));
    const outside = path.join(fixture, "outside-public");
    await mkdir(outside);
    const outsideLink = path.join(fixture, "public", "outside-link");
    await symlink(outside, outsideLink, "junction");
    assert.throws(
      () => execFileSync(process.execPath, ["scripts/run-framework.mjs", "build"], { cwd: fixture, env, stdio: "pipe", timeout: 30000 }),
      (error) => /outside the allowed/i.test(String(error.stderr)),
      "build must refuse an outside public directory link before copying",
    );
    if (process.platform === "win32") await rmdir(outsideLink);
    else await rm(outsideLink);
    await access(outside);
    const safe = path.join(fixture, "public", "safe-assets");
    await mkdir(safe);
    await writeFile(path.join(safe, "ordinary.txt"), "public fixture");
    await symlink(safe, path.join(fixture, "public", "safe-link"), "junction");
    execFileSync(process.execPath, ["scripts/run-framework.mjs", "build"], { cwd: fixture, env, stdio: "pipe", timeout: 30000 });
  } finally {
    const relative = path.relative(os.tmpdir(), temp);
    assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    await rm(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
  }
});
