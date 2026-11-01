import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MCP handshake exposes the scoped tools and rejects invalid board IDs before network access", async () => {
  const state = await mkdtemp(path.join(tmpdir(), "community-board-test-"));
  const client = new Client({ name: "contract-check", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../mcp/server.mjs", import.meta.url))],
    env: { ...process.env, COMMUNITY_BOARD_STATE_DIR: state },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      "create_board",
      "create_post",
      "read_board",
      "relay_status",
      "reply_to_post",
    ]);
    const byName = Object.fromEntries(tools.map((entry) => [entry.name, entry.inputSchema]));
    assert.equal(byName.create_board.type, "object");
    assert.equal(byName.create_board.properties.name.type, "string");
    assert.equal(byName.create_board.properties.name.maxLength, 70);
    assert(byName.create_board.required.includes("name"));
    assert.equal(byName.create_post.properties.body.maxLength, 4000);
    assert(byName.create_post.required.includes("body"));
    assert(byName.reply_to_post.required.includes("post_id"));
    const result = await client.callTool({
      name: "read_board",
      arguments: { board_id: "invalid" },
    });
    assert.equal(result.isError, true);
    for (const args of [{ name: " " }, { name: "x".repeat(71) }, { name: 4 }]) {
      const invalid = await client.callTool({ name: "create_board", arguments: args });
      assert.equal(invalid.isError, true);
    }
    const oversized = await client.callTool({ name: "create_post", arguments: { board_id: "a".repeat(64), body: "x".repeat(4001) } });
    assert.equal(oversized.isError, true);
    const invalidCategory = await client.callTool({ name: "create_post", arguments: { board_id: "a".repeat(64), body: "hello", category: "not-a-category" } });
    assert.equal(invalidCategory.isError, true);
  } finally {
    await client.close();
    await rm(state, { recursive: true, force: true });
  }
});
