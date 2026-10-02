export type ReplyDrafts = Record<string, string>;

export function updateReplyDraft(
  drafts: ReplyDrafts,
  postId: string,
  body: string,
): ReplyDrafts {
  const next = { ...drafts };
  if (body) next[postId] = body;
  else delete next[postId];
  return next;
}

// A relay acknowledgment must not erase edits made after Send was pressed.
export function clearSentReplyDraft(
  drafts: ReplyDrafts,
  postId: string,
  sentBody: string,
): ReplyDrafts {
  return drafts[postId] === sentBody
    ? updateReplyDraft(drafts, postId, "")
    : drafts;
}
