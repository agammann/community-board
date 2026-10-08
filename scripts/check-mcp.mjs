import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getPublicKey } from "nostr-tools/pure";
import { secret } from "../lib/nostr-board.ts";
import { localRelay } from "./test-support/relay.mjs";

const out = path.resolve("test-results/mcp");
await mkdir(out, { recursive: true });
const isolated = await mkdtemp(path.join(tmpdir(), "community-board-mcp-"));
const state = path.join(isolated, "keys");
const relay = await localRelay();
const report = {
  started: new Date().toISOString(),
  method:
    "Actual SDK stdio client and unchanged server, signed events and real WebSockets to an isolated loopback relay. No public posts.",
  checks: {},
};
const environment = {
  ...process.env,
  COMMUNITY_BOARD_QA_RELAY: relay.url,
  COMMUNITY_BOARD_STATE_DIR: state,
  COMMUNITY_BOARD_URL: "http://127.0.0.1:5185",
};
delete environment.OPENAI_API_KEY;
let client;
async function connect() {
  client = new Client({ name: "community-board-check", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [
        "--import",
        pathToFileURL(path.resolve("scripts/test-support/mcp-loopback.mjs"))
          .href,
        path.resolve("mcp/server.mjs"),
      ],
      cwd: isolated,
      env: environment,
      stderr: "pipe",
    }),
  );
}
async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args });
  assert(!response.isError, JSON.stringify(response));
  return JSON.parse(response.content.find((c) => c.type === "text").text);
}
try {
  await connect();
  report.tools = (await client.listTools()).tools.map((x) => x.name).sort();
  assert.deepEqual(report.tools, [
    "create_board",
    "create_post",
    "read_board",
    "relay_status",
    "reply_to_post",
  ]);
  const board = await call("create_board", {
    name: "Private MCP check",
    description: "Local protocol only",
  });
  assert.match(board.board_id, /^[a-f0-9]{64}$/);
  assert.equal(board.accepted_relays.length, 3);
  assert.equal(board.url, `http://127.0.0.1:5185/b/${board.board_id}`);
  const recoveryPath = path.join(state, `${board.board_id}.json`);
  assert.equal(path.resolve(board.identity_recovery_file), recoveryPath);
  const recovery = await readFile(recoveryPath, "utf8");
  const identity = getPublicKey(secret(JSON.parse(recovery).key));
  assert.equal(relay.events.get(board.board_id).pubkey, identity);
  report.checks.createBoardAndPrivateState = true;
  const first = await call("create_post", {
    board_id: board.board_id,
    title: "A local question",
    body: "Who can bring a tent?",
    category: "Question",
    nickname: "Taylor",
  });
  const reply = await call("reply_to_post", {
    board_id: board.board_id,
    post_id: first.id,
    body: "I can bring one.",
    nickname: "Riley",
  });
  const result = await call("read_board", { board_id: board.board_id });
  assert.equal(result.posts.length, 2);
  assert(result.posts.some((p) => p.id === reply.id && p.parent === first.id));
  report.checks.postReplyRead = true;
  const nested = await client.callTool({
    name: "reply_to_post",
    arguments: { board_id: board.board_id, post_id: reply.id, body: "Nested" },
  });
  assert.equal(nested.isError, true);
  assert((await call("relay_status")).relays.every((x) => x.connected));
  report.checks.nestedReplyRejectedAndRelayStatus = true;
  relay.setWrites(false);
  const denied = await client.callTool({
    name: "create_post",
    arguments: { board_id: board.board_id, body: "Rejected write" },
  });
  assert.equal(denied.isError, true);
  relay.setWrites(true);
  const retried = await call("create_post", {
    board_id: board.board_id,
    body: "Retry accepted",
  });
  assert(relay.events.has(retried.id));
  report.checks.rejectedWriteAndExplicitRetry = true;
  await client.close();
  await connect();
  const afterRestart = await call("create_post", {
    board_id: board.board_id,
    body: "Same identity after restart",
  });
  assert.equal(relay.events.get(afterRestart.id).pubkey, identity);
  report.checks.restartKeepsIdentity = true;
  await client.close();
  const wrongBoard = {
    ...JSON.parse(recovery),
    board: "http://127.0.0.1:5185/b/" + "f".repeat(64),
  };
  await writeFile(recoveryPath, JSON.stringify(wrongBoard));
  await connect();
  const wrong = await client.callTool({
    name: "create_post",
    arguments: { board_id: board.board_id, body: "Wrong identity recovery" },
  });
  assert.equal(wrong.isError, true);
  assert.match(wrong.content[0].text, /another board/);
  await client.close();
  await writeFile(recoveryPath, recovery);
  await connect();
  const restored = await call("create_post", {
    board_id: board.board_id,
    body: "Original recovery restored",
  });
  assert.equal(relay.events.get(restored.id).pubkey, identity);
  assert.equal(
    (await call("read_board", { board_id: board.board_id })).posts.length,
    5,
  );
  report.checks.exactRecoveryAndWrongBoardRejection = true;
  report.outcome = "pass";
} catch (error) {
  report.outcome = "failure";
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await client?.close();
  await relay.close();
  assert(
    path.dirname(isolated) === tmpdir() &&
      path.basename(isolated).startsWith("community-board-mcp-"),
  );
  await rm(isolated, { recursive: true, force: true });
  report.metrics = relay.metrics;
  report.finished = new Date().toISOString();
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
