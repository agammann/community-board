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
    const result = await client.callTool({
      name: "read_board",
      arguments: { board_id: "invalid" },
    });
    assert.equal(result.isError, true);
  } finally {
    await client.close();
    await rm(state, { recursive: true, force: true });
  }
});
