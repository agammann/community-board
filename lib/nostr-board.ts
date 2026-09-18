import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
} from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";
import type { Event, Filter } from "nostr-tools";

export const RELAYS = [
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.ditto.pub",
];
export const CATEGORIES = ["General", "Question", "Offer", "Event"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Board = {
  id: string;
  name: string;
  about: string;
  pubkey: string;
  event: Event;
};
export type Post = {
  id: string;
  pubkey: string;
  body: string;
  title: string;
  category: string;
  nickname: string;
  created_at: number;
  parent: string | null;
  event: Event;
};
export const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function secret(value?: string) {
  if (!value) return generateSecretKey();
  if (!/^[a-f0-9]{64}$/i.test(value)) throw Error("Invalid identity key.");
  const k = Uint8Array.from(value.match(/../g)!, (x) => parseInt(x, 16));
  getPublicKey(k);
  return k;
}
export { getPublicKey };
export function tag(e: Event, name: string) {
  return e.tags.find((t) => t[0] === name)?.[1] || "";
}
function text(v: string, max: number, label: string, required = true) {
  const s = v.trim();
  if ((required && !s) || s.length > max)
    throw Error(
      `${label} must be ${required ? "1" : "0"} to ${max} characters.`,
    );
  return s;
}
export function makeBoard(name: string, about: string, key: Uint8Array) {
  const n = text(name, 70, "Board name");
  const a = text(about, 280, "Description", false);
  return finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["t", "community-board"],
        ["board", "v1"],
        ["subject", n],
        ...RELAYS.map((r) => ["relay", r]),
      ],
      content: a || n,
    },
    key,
  );
}
export function parseBoard(e: Event): Board {
  if (e.kind !== 1 || tag(e, "board") !== "v1")
    throw Error("This link does not point to a community board.");
  return {
    id: e.id,
    name: tag(e, "subject").slice(0, 70) || "Untitled board",
    about: e.content.slice(0, 280),
    pubkey: e.pubkey,
    event: e,
  };
}
export function makePost(
  board: Board,
  body: string,
  key: Uint8Array,
  opts: {
    title?: string;
    nickname?: string;
    category?: string;
    parent?: Post;
  } = {},
) {
  const b = text(body, 4000, "Post");
  const title = text(opts.title || "", 120, "Title", false);
  const nick = text(opts.nickname || "", 32, "Nickname", false);
  const tags = [
    ["e", board.id, RELAYS[0], "root", board.pubkey],
    ["p", board.pubkey],
    ["t", "community-board"],
    [
      "category",
      CATEGORIES.includes(opts.category as Category)
        ? opts.category!
        : "General",
    ],
  ];
  if (title) tags.push(["subject", title]);
  if (nick) tags.push(["nickname", nick]);
  if (opts.parent) {
    tags.push(["e", opts.parent.id, RELAYS[0], "reply", opts.parent.pubkey]);
    if (opts.parent.pubkey !== board.pubkey)
      tags.push(["p", opts.parent.pubkey]);
  }
  return finalizeEvent(
    { kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content: b },
    key,
  );
}
export function parsePost(e: Event, board: Board): Post | null {
  if (
    e.kind !== 1 ||
    e.id === board.id ||
    e.content.length > 4000 ||
    !e.tags.some((t) => t[0] === "e" && t[1] === board.id && t[3] === "root")
  )
    return null;
  return {
    id: e.id,
    pubkey: e.pubkey,
    body: e.content,
    title: tag(e, "subject").slice(0, 120),
    category: CATEGORIES.includes(tag(e, "category") as Category)
      ? tag(e, "category")
      : "General",
    nickname: tag(e, "nickname").slice(0, 32) || "Guest",
    created_at: e.created_at,
    parent: e.tags.find((t) => t[0] === "e" && t[3] === "reply")?.[1] || null,
    event: e,
  };
}
export function visiblePosts(events: Event[], board: Board) {
  return events
    .map((e) => parsePost(e, board))
    .filter((p): p is Post => !!p)
    .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id));
}
export function newPool() {
  return new SimplePool({ enableReconnect: false });
}
export async function publish(pool: SimplePool, event: Event) {
  if (!verifyEvent(event)) throw Error("This post could not be signed.");
  const results = await Promise.allSettled(
    pool.publish(RELAYS, event, { maxWait: 7000 }),
  );
  const accepted = results.flatMap((r, i) =>
    r.status === "fulfilled" ? [RELAYS[i]] : [],
  );
  if (!accepted.length)
    throw Error(
      "No relay accepted your post. Your draft is still here. Please retry.",
    );
  return { id: event.id, accepted };
}
export async function query(pool: SimplePool, filter: Filter) {
  return pool.querySync(RELAYS, filter, { maxWait: 7000 });
}
export async function loadBoard(pool: SimplePool, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error("That board link is not valid.");
  const event = await pool.get(RELAYS, { ids: [id] }, { maxWait: 7000 });
  if (!event)
    throw Error(
      "Could not load this board from the relays. Check your connection and try again.",
    );
  return parseBoard(event);
}
export async function loadPost(pool: SimplePool, board: Board, id: string) {
  const event = await pool.get(
    RELAYS,
    { ids: [id], kinds: [1] },
    { maxWait: 7000 },
  );
  const post = event ? parsePost(event, board) : null;
  if (!post) throw Error("That post could not be found on this board.");
  return post;
}
export async function loadPosts(
  pool: SimplePool,
  board: Board,
  until?: number,
) {
  const events = await query(pool, {
    kinds: [1],
    "#e": [board.id],
    limit: 200,
    ...(until ? { until } : {}),
  });
  return { posts: visiblePosts(events, board), events };
}
