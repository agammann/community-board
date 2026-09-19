import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import {
  secret,
  hex,
  makeBoard,
  parseBoard,
  makePost,
  parseRecovery,
  mergeEvents,
  visiblePosts,
  newPool,
  query,
  publish,
} from "../lib/nostr-board.ts";

const key = secret();
const board = parseBoard(
  makeBoard("Local resilience tests", "Never published", key),
);

test("recovery accepts the saved key and rejects incomplete or unrelated files", () => {
  const file = { board: `https://example.com/b/${board.id}`, key: hex(key) };
  assert.deepEqual(parseRecovery(file, board.id), key);
  for (const value of [
    null,
    {},
    { board: file.board },
    { ...file, key: "" },
    { ...file, key: 0 },
    { ...file, key: "invalid" },
    { ...file, board: "invalid" },
    { ...file, board: "https://example.com/b/other" },
  ]) {
    assert.throws(() => parseRecovery(value, board.id));
  }
  assert.throws(() => secret(""));
});

test("partial and overlapping refreshes preserve loaded posts and deduplicate live arrivals", () => {
  const first = makePost(board, "Already loaded", key);
  const live = makePost(board, "Arrived while refreshing", key);
  const older = makePost(board, "Older page", key);
  const merged = mergeEvents([first, live], [first, older]);
  assert.equal(merged.length, 3);
  assert.deepEqual(
    new Set(visiblePosts(merged, board).map((p) => p.body)),
    new Set(["Already loaded", "Arrived while refreshing", "Older page"]),
  );
  assert.deepEqual(mergeEvents(merged, []), merged);
  assert.equal(visiblePosts([first, first], board).length, 1);
});

test("offline reads report failure instead of an empty board", async () => {
  const disconnected = {
    querySync: async () => [],
    listConnectionStatus: () => new Map([["wss://example.com", false]]),
  };
  await assert.rejects(query(disconnected, {}), /unreachable/);
  const connected = {
    ...disconnected,
    listConnectionStatus: () => new Map([["wss://example.com", true]]),
  };
  assert.deepEqual(await query(connected, {}), []);
});

test("posting reports total failure and tolerates an individual relay rejection", async () => {
  const event = makePost(board, "Publish fixture", key);
  await assert.rejects(
    publish(
      {
        publish: () => [
          Promise.reject(Error("offline")),
          Promise.reject(Error("offline")),
          Promise.reject(Error("offline")),
        ],
      },
      event,
    ),
    /draft is still here/,
  );
  const result = await publish(
    {
      publish: () => [
        Promise.reject(Error("rejected")),
        Promise.resolve("ok"),
        Promise.reject(Error("offline")),
      ],
    },
    event,
  );
  assert.equal(result.accepted.length, 1);
  assert.equal(result.id, event.id);
});

test(
  "live subscriptions resume after a real WebSocket disconnect",
  { timeout: 25000 },
  async () => {
    const relay = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await once(relay, "listening");
    const pool = newPool();
    let connections = 0;
    let subscription;
    let deadline;
    const event = makePost(board, "Delivered after reconnect", key);
    try {
      const received = new Promise((resolve, reject) => {
        deadline = setTimeout(
          () => reject(Error("Live subscription did not reconnect")),
          22000,
        );
        relay.on("connection", (socket) => {
          const connection = ++connections;
          socket.on("message", (bytes) => {
            const [type, id] = JSON.parse(bytes.toString());
            if (type !== "REQ") return;
            if (connection === 1) {
              socket.send(JSON.stringify(["EOSE", id]));
              socket.close();
            } else {
              socket.send(JSON.stringify(["EVENT", id, event]));
              socket.send(JSON.stringify(["EOSE", id]));
            }
          });
        });
        subscription = pool.subscribe(
          [`ws://127.0.0.1:${relay.address().port}`],
          { kinds: [1] },
          { onevent: resolve },
        );
      });
      assert.equal((await received).id, event.id);
      assert.ok(connections >= 2);
    } finally {
      clearTimeout(deadline);
      await subscription?.close();
      pool.destroy();
      for (const socket of relay.clients) socket.terminate();
      await new Promise((resolve) => relay.close(resolve));
    }
  },
);
