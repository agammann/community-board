import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { localRelay, isolateRelays } from "./test-support/relay.mjs";
import { chromium } from "playwright";
import { secret, makePost, parseBoard } from "../lib/nostr-board.ts";
import { finalizeEvent } from "nostr-tools/pure";
const out = path.resolve("test-results/browser");
await mkdir(out, { recursive: true });
const processLog = [];
let base, server, relay, browser, context, page;
const report = {
  fallback: "Browser plugin not available",
  started: new Date().toISOString(),
  method:
    "Built production app under real local workerd. Actual signed events, WebSocket subscriptions and relay acknowledgments on isolated loopback relay; only relay destinations redirected, no public posts.",
  checks: {},
  errors: [],
  consoleErrors: [],
  layouts: [],
};
const save = () =>
  writeFile(out + "/report.json", JSON.stringify(report, null, 2));
const close = () =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
const openThread = (title) =>
  page
    .locator(".post-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .locator(".post-content")
    .click();
async function createPost(
  target,
  title,
  body,
  category = "General",
  nickname = "Alex",
) {
  await target
    .getByRole("button", { name: "Write a post", exact: true })
    .click();
  await target.locator("#post-title").fill(title);
  await target.locator("#post-body").fill(body);
  await target.locator("#post-nickname").fill(nickname);
  await target
    .getByRole("dialog")
    .getByRole("button", { name: category, exact: true })
    .click();
  await target
    .getByRole("button", { name: "Post to board", exact: true })
    .click();
  await target.getByRole("dialog").waitFor({ state: "hidden" });
  await target.getByRole("heading", { name: title, exact: true }).waitFor();
}
try {
  server = spawn(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--local",
      "--persist-to",
      ".wrangler/state",
      "--ip",
      "127.0.0.1",
      "--port",
      "0",
      "--inspector-port",
      "0",
    ],
    {
      cwd: process.cwd(),
      windowsHide: true,
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: "false",
        CLOUDFLARE_CF_FETCH_ENABLED: "false",
      },
    },
  );
  server.stdout.on("data", (d) => processLog.push(d.toString()));
  server.stderr.on("data", (d) => processLog.push(d.toString()));
  base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poll);
      reject(Error("Local Worker startup timed out"));
    }, 30000);
    const poll = setInterval(() => {
      const match = processLog.join("").match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        clearInterval(poll);
        resolve(match[0]);
      }
    }, 50);
    server.once("error", (error) => {
      clearTimeout(timeout);
      clearInterval(poll);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      clearInterval(poll);
      reject(Error("Local Worker exited: " + code + " " + processLog.join("")));
    });
  });
  relay = await localRelay();
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.DEBUG;
  delete env.DEBUG_FILE;
  browser = await chromium.launch({
    headless: true,
    env,
    ...(process.env.COMMUNITY_BOARD_BROWSER_EXECUTABLE
      ? { executablePath: process.env.COMMUNITY_BOARD_BROWSER_EXECUTABLE }
      : {}),
  });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  await isolateRelays(context, relay.url);
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  await page.goto(base);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.title(), "Community Board");
  await page
    .getByLabel("Board name", { exact: true })
    .fill("Private October QA");
  await page.getByRole("button", { name: "Create board", exact: true }).click();
  await page.waitForURL(/\/b\/[a-f0-9]{64}$/);
  await page
    .getByRole("heading", { name: "Private October QA", exact: true })
    .waitFor();
  report.checks.createBoard = true;
  await createPost(
    page,
    "Picnic plans",
    "Who can bring a picnic blanket?",
    "Question",
  );
  await createPost(page, "Study group", "A study space is available.", "Offer");
  report.checks.postCategories = true;
  const boardURL = page.url(),
    boardId = boardURL.split("/").at(-1),
    board = parseBoard(relay.events.get(boardId));
  await openThread("Picnic plans");
  await page.locator("#reply").fill("I will bring the picnic blanket.");
  await close();
  await openThread("Study group");
  assert.equal(await page.locator("#reply").inputValue(), "");
  await page.locator("#reply").fill("I can join on Tuesday.");
  await close();
  await openThread("Picnic plans");
  assert.equal(
    await page.locator("#reply").inputValue(),
    "I will bring the picnic blanket.",
  );
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#reply").value === "",
  );
  await close();
  await openThread("Study group");
  assert.equal(
    await page.locator("#reply").inputValue(),
    "I can join on Tuesday.",
  );
  report.checks.separateDraftsAndSuccessfulClear = true;
  await save();
  relay.setWrites(false);
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.match(
    await page.getByRole("dialog").getByRole("alert").innerText(),
    /No relay accepted/,
  );
  assert.equal(
    await page.locator("#reply").inputValue(),
    "I can join on Tuesday.",
  );
  relay.setWrites(true);
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#reply").value === "",
  );
  report.checks.rejectedWriteRetainsDraftThenRetrySucceeds = true;
  await page.locator("#reply").fill("First sent thought.");
  relay.holdAcknowledgments(true);
  const accepted = relay.metrics.accepted;
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  for (let i = 0; relay.metrics.accepted === accepted && i < 20; i++)
    await page.waitForTimeout(50);
  assert(relay.metrics.accepted > accepted);
  await page.locator("#reply").fill("A new thought while sending.");
  relay.holdAcknowledgments(false);
  await page.getByRole("button", { name: "Post reply", exact: true }).waitFor();
  assert.equal(
    await page.locator("#reply").inputValue(),
    "A new thought while sending.",
  );
  report.checks.delayedAckPreservesEdits = true;
  await page.screenshot({
    path: out + "/retained-thread-draft.png",
    fullPage: false,
  });
  await close();
  await page.getByRole("button", { name: "Question", exact: true }).click();
  assert.equal(await page.locator(".post-card").count(), 1);
  await page
    .getByRole("heading", { name: "Picnic plans", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /All posts/ }).click();
  assert.equal(await page.locator(".post-card").count(), 2);
  report.checks.categoryFilter = true;
  const guestContext = await browser.newContext();
  await isolateRelays(guestContext, relay.url);
  const guest = await guestContext.newPage();
  guest.setDefaultTimeout(20000);
  await guest.goto(boardURL);
  await guest
    .getByRole("heading", { name: "Picnic plans", exact: true })
    .waitFor();
  await createPost(
    guest,
    "Guest arrival",
    "This arrived from a second browser identity.",
    "General",
    "Sam",
  );
  await page
    .getByRole("heading", { name: "Guest arrival", exact: true })
    .waitFor();
  report.checks.secondIdentityLivePost = true;
  await page.getByRole("button", { name: "Share board", exact: true }).click();
  assert.equal(await page.locator("#share-link").inputValue(), boardURL);
  assert(!new URL(await page.locator("#share-link").inputValue()).hash);
  await close();
  report.checks.shareLinkHasNoRecoveryKey = true;
  await page.getByRole("button", { name: "Manage this device" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save recovery file" }).click();
  const download = await downloaded;
  await download.saveAs(out + "/private-generated-recovery.json");
  await close();
  await guest.getByRole("button", { name: "Manage this device" }).click();
  await guest.locator('input[type="file"]').setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await guest.getByRole("dialog").getByRole("alert").waitFor();
  assert.match(
    await guest.getByRole("dialog").getByRole("alert").innerText(),
    /missing a board link/,
  );
  await guest
    .locator('input[type="file"]')
    .setInputFiles(out + "/private-generated-recovery.json");
  await guest.getByRole("dialog").waitFor({ state: "hidden" });
  await guest.getByText("You created this board", { exact: true }).waitFor();
  await guest.reload();
  await guest.getByText("You created this board", { exact: true }).waitFor();
  report.checks.recoveryExportValidationRestoreReload = true;
  const fixtureKey = secret();
  for (let i = 0; i < 210; i++) {
    const fixture = makePost(board, "Older private fixture " + i, fixtureKey, {
      title: "Older " + i,
    });
    relay.insert(
      finalizeEvent(
        {
          kind: fixture.kind,
          tags: fixture.tags,
          content: fixture.content,
          created_at: Math.floor(Date.now() / 1000) - 100 - i,
        },
        fixtureKey,
      ),
    );
  }
  const historyContext = await browser.newContext();
  await isolateRelays(historyContext, relay.url);
  const history = await historyContext.newPage();
  history.setDefaultTimeout(20000);
  await history.goto(boardURL);
  await history
    .getByRole("button", { name: "Load older posts", exact: true })
    .waitFor();
  const firstPage = await history.locator(".post-card").count();
  assert(firstPage < 213);
  await history
    .getByRole("button", { name: "Load older posts", exact: true })
    .click();
  await history.waitForFunction(
    () => document.querySelectorAll(".post-card").length === 213,
  );
  report.checks.olderPagination = {
    initialRoots: firstPage,
    loadedRoots: await history.locator(".post-card").count(),
  };
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    report.layouts.push(layout);
    assert(layout.scrollWidth <= layout.width);
    await page.screenshot({
      path: out + "/board-" + width + ".png",
      fullPage: true,
    });
  }
  await page.goto(base + "/connect");
  assert.match(await page.locator("h1").innerText(), /assistant/);
  assert.match(await page.locator("main").innerText(), /stdio/);
  await page.goto(base + "/b/invalid");
  await page
    .getByRole("heading", { name: "We couldn’t open that board" })
    .waitFor();
  assert.match(await page.getByRole("alert").innerText(), /not valid/);
  report.checks.setupAndInvalidLink = true;
  assert.equal(report.errors.length, 0);
  assert.deepEqual(report.consoleErrors, []);
  report.outcome = "pass";
} catch (e) {
  report.outcome = "failure";
  report.failure = e.message;
  process.exitCode = 1;
  await page
    ?.screenshot({ path: out + "/failure.png", fullPage: true })
    .catch(() => {});
} finally {
  report.metrics = relay?.metrics;
  report.finished = new Date().toISOString();
  await save();
  console.log(JSON.stringify(report));
  await browser?.close();
  await relay?.close();
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  await rm(path.join(out, "private-generated-recovery.json"), { force: true });
  await writeFile(out + "/worker.log", processLog.join(""));
}
