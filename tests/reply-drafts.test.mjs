import test from "node:test";
import assert from "node:assert/strict";
import { clearSentReplyDraft, updateReplyDraft } from "../lib/reply-drafts.ts";

test("switching conversations preserves separate drafts and sending clears only its thread", () => {
  const picnic = updateReplyDraft({}, "picnic", "I can bring a blanket.");
  const both = updateReplyDraft(picnic, "study", "Which chapter?");
  assert.equal(both.picnic, "I can bring a blanket.");
  assert.equal(both.study, "Which chapter?");
  assert.deepEqual(clearSentReplyDraft(both, "picnic", both.picnic), {
    study: "Which chapter?",
  });
  assert.equal(picnic.study, undefined);
});

test("a delayed acknowledgment preserves text edited after sending", () => {
  const sent = "First reply";
  const edited = updateReplyDraft({ thread: sent }, "thread", "A new thought");
  assert.equal(clearSentReplyDraft(edited, "thread", sent).thread, "A new thought");
  assert.deepEqual(updateReplyDraft(edited, "thread", ""), {});
});
