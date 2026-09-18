import test from "node:test";
import assert from "node:assert/strict";
import { verifyEvent } from "nostr-tools/pure";
import {
  secret,
  makeBoard,
  parseBoard,
  makePost,
  parsePost,
} from "../lib/nostr-board.ts";
const owner = secret(),
  guest = secret(),
  stranger = secret();
const board = parseBoard(makeBoard("Test board", "Protocol tests only", owner));
const event = makePost(board, "A question", guest, {
    title: "Hello",
    category: "Question",
  }),
  post = parsePost(event, board);
test("board and posts are valid signed plaintext Nostr events", () => {
  assert.ok(verifyEvent(board.event));
  assert.ok(verifyEvent(event));
  assert.equal(event.kind, 1);
  assert.equal(event.content, "A question");
  assert.equal(post.title, "Hello");
  assert.equal(post.category, "Question");
});
test("replies carry root, parent and participant tags", () => {
  const e = makePost(board, "A reply", owner, { parent: post });
  assert.ok(
    e.tags.some((t) => t[0] === "e" && t[1] === board.id && t[3] === "root"),
  );
  assert.ok(
    e.tags.some((t) => t[0] === "e" && t[1] === post.id && t[3] === "reply"),
  );
  assert.ok(e.tags.some((t) => t[0] === "p" && t[1] === post.pubkey));
});
test("foreign roots are excluded and content bounds apply", () => {
  const other = parseBoard(makeBoard("Other", "", stranger));
  assert.equal(parsePost(event, other), null);
  assert.throws(() => makeBoard("x".repeat(71), "", owner));
  assert.throws(() => makePost(board, "x".repeat(4001), owner));
  assert.throws(() => secret("not-a-key"));
});
