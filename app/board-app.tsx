"use client";
/* Full document navigation intentionally resets the per-board relay connection and device state. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination */
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Plus,
  MessageCircle,
  Link2,
  Check,
  LoaderCircle,
  RefreshCw,
  Users,
  Globe2,
  KeyRound,
  ChevronDown,
  Terminal,
  CornerDownRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  CATEGORIES,
  hex,
  secret,
  getPublicKey,
  newPool,
  makeBoard,
  parseBoard,
  makePost,
  publish,
  loadBoard,
  loadPosts,
  visiblePosts,
  RELAYS,
} from "../lib/nostr-board";
import type { Board, Post } from "../lib/nostr-board";
import type { Event } from "nostr-tools";

type Recent = { id: string; name: string };
function remember(b: Board) {
  try {
    const old = JSON.parse(
      localStorage.getItem("cb_recent") || "[]",
    ) as Recent[];
    localStorage.setItem(
      "cb_recent",
      JSON.stringify(
        [{ id: b.id, name: b.name }, ...old.filter((x) => x.id !== b.id)].slice(
          0,
          12,
        ),
      ),
    );
  } catch {}
}
function identity(id: string) {
  const name = `cb_key_${id}`;
  let value = localStorage.getItem(name);
  if (!value) {
    value = hex(secret());
    localStorage.setItem(name, value);
  }
  return secret(value);
}
function age(t: number) {
  const m = Math.max(0, Math.floor((Date.now() / 1000 - t) / 60));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return new Date(t * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function Logo() {
  return (
    <a className="brand" href="/" aria-label="Community Board home">
      <span className="brandmark">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span>
        community<span className="brand-light">board</span>
      </span>
    </a>
  );
}
export default function BoardApp({ boardId }: { boardId?: string }) {
  const pool = useRef<ReturnType<typeof newPool> | null>(null);
  const key = useRef<Uint8Array | null>(null);
  const events = useRef<Event[]>([]);
  const [board, setBoard] = useState<Board | null>(null),
    [posts, setPosts] = useState<Post[]>([]),
    [pubkey, setPubkey] = useState(""),
    [loading, setLoading] = useState(!!boardId),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [name, setName] = useState(""),
    [about, setAbout] = useState(""),
    [recent, setRecent] = useState<Recent[]>([]),
    [category, setCategory] = useState("All posts");
  const [compose, setCompose] = useState(false),
    [selected, setSelected] = useState<Post | null>(null),
    [help, setHelp] = useState(false),
    [share, setShare] = useState(false),
    [identityOpen, setIdentityOpen] = useState(false);
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [nickname, setNickname] = useState(""),
    [postCategory, setPostCategory] = useState("General"),
    [reply, setReply] = useState(""),
    [copied, setCopied] = useState(false),
    [canLoadMore, setCanLoadMore] = useState(false),
    [relayConnections, setRelayConnections] = useState<string[]>([]);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 5000);
  };
  async function refresh(b = board, older = false) {
    if (!b || !pool.current) return;
    setLoading(true);
    setError("");
    try {
      const oldest = events.current.reduce(
        (m, e) => Math.min(m, e.created_at),
        Infinity,
      );
      const result = await loadPosts(
        pool.current,
        b,
        older && Number.isFinite(oldest) ? oldest - 1 : undefined,
      );
      events.current = older
        ? [...events.current, ...result.events]
        : result.events;
      setPosts(visiblePosts(events.current, b));
      setCanLoadMore(result.events.length >= 200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    pool.current = newPool();
    let active = true;
    try {
      // Restore browser-only history after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(JSON.parse(localStorage.getItem("cb_recent") || "[]"));
    } catch {}
    if (boardId) {
      (async () => {
        try {
          // A private recovery fragment never leaves this browser or appears in a share link.
          const recovery = new URLSearchParams(location.hash.slice(1)).get(
            "key",
          );
          if (recovery) {
            secret(recovery);
            localStorage.setItem(`cb_key_${boardId}`, recovery);
            history.replaceState(null, "", location.pathname);
          }
          key.current = identity(boardId);
          setPubkey(getPublicKey(key.current));
          const b = await loadBoard(pool.current!, boardId);
          if (!active) return;
          setBoard(b);
          remember(b);
          await refresh(b);
        } catch (e) {
          if (active) {
            setError((e as Error).message);
            setLoading(false);
          }
        }
      })();
    }
    return () => {
      active = false;
      pool.current?.destroy();
    };
    // This connection belongs to the current board route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);
  useEffect(() => {
    if (!board || !pool.current) return;
    const current = pool.current;
    const sub = current.subscribe(
      RELAYS,
      {
        kinds: [1],
        "#e": [board.id],
        since: Math.floor(Date.now() / 1000) - 2,
      },
      {
        onevent(e) {
          if (!events.current.some((x) => x.id === e.id)) {
            events.current = [e, ...events.current].slice(0, 1000);
            setPosts(visiblePosts(events.current, board));
          }
        },
      },
    );
    return () => {
      sub.close();
    };
  }, [board]);
  useEffect(() => {
    if (!board) return;
    const check = () => {
      const connected = Array.from(pool.current?.listConnectionStatus() || [])
        .filter(([, v]) => v)
        .map(([url]) => url.replace(/\/$/, ""));
      setRelayConnections(connected);
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [board]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const k = secret();
      const event = makeBoard(name, about, k);
      localStorage.setItem(`cb_key_${event.id}`, hex(k));
      await publish(pool.current!, event);
      remember(parseBoard(event));
      location.assign(`/b/${event.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!board || !key.current) return;
    setBusy(true);
    setError("");
    try {
      const event = makePost(board, body, key.current, {
        title,
        nickname,
        category: postCategory,
      });
      await publish(pool.current!, event);
      if (!events.current.some((x) => x.id === event.id))
        events.current.unshift(event);
      setPosts(visiblePosts(events.current, board));
      setCompose(false);
      setTitle("");
      setBody("");
      notify("Your post is on the board.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!board || !key.current || !selected) return;
    setBusy(true);
    setError("");
    try {
      const event = makePost(board, reply, key.current, {
        nickname,
        parent: selected,
      });
      await publish(pool.current!, event);
      if (!events.current.some((x) => x.id === event.id))
        events.current.unshift(event);
      setPosts(visiblePosts(events.current, board));
      setReply("");
      notify("Reply posted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Select the link and copy it from the field.");
    }
  }
  function recovery() {
    if (!key.current || !board) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            board: location.origin + `/b/${board.id}`,
            key: hex(key.current),
            note: "Private recovery key. Keep this file to restore your identity on this board.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "community-board-recovery.json";
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Recovery file downloaded. Keep it private.");
  }
  async function restore(file: File) {
    try {
      if (file.size > 4096) throw Error("That is not a recovery file.");
      const data = JSON.parse(await file.text());
      const k = secret(data.key);
      if (!board || data.board.split("/").pop() !== board.id)
        throw Error("This recovery file belongs to another board.");
      localStorage.setItem(`cb_key_${board.id}`, hex(k));
      key.current = k;
      setPubkey(getPublicKey(k));
      setIdentityOpen(false);
      notify("Your identity has been restored.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const owner = board?.pubkey === pubkey;
  const roots = posts.filter((p) => !p.parent);
  const filtered = roots.filter(
    (p) => category === "All posts" || p.category === category,
  );
  const shareUrl =
    typeof location !== "undefined" && board
      ? location.origin + `/b/${board.id}`
      : "";
  return (
    <div className="site-shell">
      <header className="site-header">
        <Logo />
        <nav>
          <button className="text-button" onClick={() => setHelp(true)}>
            How it works
          </button>
          <a className="text-button desktop" href="/connect">
            <Terminal size={16} /> Connect an assistant
          </a>
          {boardId ? (
            <a className="button small" href="/">
              <Plus size={16} /> New board
            </a>
          ) : (
            <span className="header-note">A space for your people.</span>
          )}
        </nav>
      </header>
      {!boardId ? (
        <main className="create-layout">
          <section className="create-intro">
            <span className="eyebrow">
              <span className="tiny-square" /> A LITTLE SPACE FOR YOUR PEOPLE
            </span>
            <h1>
              Good things <br />
              start with <br />
              <span>a shared space.</span>
            </h1>
            <p className="intro-copy">
              Create a space for your group in seconds.
              <br />
              Share one link. Anyone can participate.
            </p>
            <div className="intro-bottom">
              <div className="overlap-icons">
                <Users size={23} />
                <MessageCircle size={23} />
                <Globe2 size={23} />
              </div>
              <p>
                Your group. Your conversations.
                <br />
                <strong>Bring everyone together.</strong>
              </p>
            </div>
          </section>
          <section className="create-panel">
            <div className="panel-heading">
              <span className="eyebrow">01 / MAKE IT YOURS</span>
              <span className="subtle">Ready in a moment</span>
            </div>
            <h2>Create your board</h2>
            <p className="subtle">
              A name is all you need to get everyone together.
            </p>
            <form onSubmit={create}>
              <label htmlFor="board-name">Board name</label>
              <input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The weekend crew"
                required
                maxLength={70}
                autoComplete="off"
              />
              <label htmlFor="board-about">
                What’s this space for?{" "}
                <span className="optional">Optional</span>
              </label>
              <textarea
                id="board-about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Plans, ideas, questions, or a little bit of everything."
                rows={3}
                maxLength={280}
              />
              <div className="starter-label">NEED A STARTING POINT?</div>
              <div className="suggestions">
                {["Our neighborhood", "The weekend crew", "Study group"].map(
                  (n) => (
                    <button key={n} type="button" onClick={() => setName(n)}>
                      {n}
                    </button>
                  ),
                )}
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button primary create-button"
                disabled={busy || !name.trim()}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> Creating your
                    board…
                  </>
                ) : (
                  <>
                    Create board <ArrowUpRight size={20} />
                  </>
                )}
              </button>
              <p className="form-note">
                <Globe2 size={14} /> Share your link when you’re ready.
              </p>
            </form>
            <div className="panel-foot">
              <span>One link brings everyone in.</span>
              <Link2 size={19} />
            </div>
          </section>
          {recent.length > 0 && (
            <section className="recent">
              <h3>On this device</h3>
              <div>
                {recent.map((r) => (
                  <a key={r.id} href={`/b/${r.id}`}>
                    {r.name}
                    <ArrowUpRight size={16} />
                  </a>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        <main className="board-main">
          <a className="back-link" href="/">
            <ArrowLeft size={15} /> Your spaces
          </a>
          {!board ? (
            <div className="loading-board">
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={28} />
                  <h2>Opening your board</h2>
                  <p>Connecting to the conversation…</p>
                </>
              ) : (
                <>
                  <h2>We couldn’t open that board</h2>
                  <p className="error" role="alert">
                    {error}
                  </p>
                  <button className="button" onClick={() => location.reload()}>
                    Try again
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <section className="board-heading">
                <div>
                  <span className="eyebrow">
                    YOUR SHARED SPACE{" "}
                    {owner && (
                      <span className="owner-tag">You created this board</span>
                    )}
                  </span>
                  <h1>{board.name}</h1>
                  {board.about !== board.name && <p>{board.about}</p>}
                </div>
                <div className="board-actions">
                  <button className="button" onClick={() => setShare(true)}>
                    <Link2 size={17} /> Share board
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      setError("");
                      setCompose(true);
                    }}
                  >
                    <Plus size={18} /> Write a post
                  </button>
                </div>
              </section>
              <div className="board-toolbar">
                <div className="filters" aria-label="Filter posts">
                  {["All posts", ...CATEGORIES].map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                      {c === "All posts" && <span>{roots.length}</span>}
                    </button>
                  ))}
                </div>
                <button
                  className="icon-button"
                  onClick={() => refresh()}
                  disabled={loading}
                  aria-label="Refresh board"
                >
                  <RefreshCw className={loading ? "spin" : ""} size={18} />
                </button>
              </div>
              {error && !compose && !selected && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="board-body">
                <section className="post-list" aria-label="Posts">
                  {!filtered.length ? (
                    <div className="empty-state">
                      <MessageCircle size={38} strokeWidth={1.3} />
                      <h2>
                        {loading
                          ? "Gathering the conversation…"
                          : roots.length
                            ? "Nothing in this category yet."
                            : "A fresh space. Make yourself at home."}
                      </h2>
                      <p>
                        {roots.length
                          ? "Start a conversation here."
                          : "Ask a question, share an idea, or just say hello."}
                      </p>
                      {!loading && (
                        <button
                          className="button primary"
                          onClick={() => setCompose(true)}
                        >
                          <Plus size={16} /> Write the first post
                        </button>
                      )}
                    </div>
                  ) : (
                    filtered.map((p) => (
                      <article key={p.id} className="post-card">
                        <div className="post-top">
                          <span
                            className={`category category-${p.category.toLowerCase()}`}
                          >
                            {p.category}
                          </span>
                          <span className="post-time">{age(p.created_at)}</span>
                        </div>
                        <button
                          className="post-content"
                          onClick={() => {
                            setError("");
                            setSelected(p);
                          }}
                        >
                          {p.title && <h2>{p.title}</h2>}
                          <p>{p.body}</p>
                        </button>
                        <div className="post-bottom">
                          <span className="author">
                            <span className="avatar">
                              {p.nickname.slice(0, 1).toUpperCase()}
                            </span>
                            {p.nickname}
                            {p.pubkey === pubkey && (
                              <span className="you">you</span>
                            )}
                          </span>
                          <div>
                            <button
                              className="text-button"
                              onClick={() => {
                                setError("");
                                setSelected(p);
                              }}
                            >
                              <MessageCircle size={16} />
                              {posts.filter((r) => r.parent === p.id).length ||
                                "Reply"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                  {canLoadMore && (
                    <button
                      className="button load-more"
                      disabled={loading}
                      onClick={() => refresh(board, true)}
                    >
                      <ChevronDown size={16} /> Load older posts
                    </button>
                  )}
                </section>
                <aside className="board-sidebar">
                  <div className="welcome-card">
                    <span className="eyebrow">EVERYONE’S WELCOME</span>
                    <h3>
                      A board is better
                      <br />
                      with your people.
                    </h3>
                    <p>
                      Send the link to your group. They can read, post, and
                      reply right away.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setShare(true)}
                    >
                      Share the invitation <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="identity-summary">
                    <KeyRound size={18} />
                    <div>
                      <strong>This device</strong>
                      <p>
                        {owner
                          ? "Board creator on this device."
                          : "Your key is saved in this browser."}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => {
                          setError("");
                          setIdentityOpen(true);
                        }}
                      >
                        Manage this device <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                  <details className="relay-status">
                    <summary>
                      {relayConnections.length} of {RELAYS.length} relays
                      connected
                    </summary>
                    {RELAYS.map((url) => (
                      <p key={url}>
                        {url.replace("wss://", "")} ·{" "}
                        {relayConnections.includes(url)
                          ? "Connected"
                          : "Offline"}
                      </p>
                    ))}
                  </details>
                  <p className="side-note">
                    Be kind. Stay on topic.
                    <br />
                    Make room for everyone.
                  </p>
                </aside>
              </div>
            </>
          )}
        </main>
      )}
      <footer>
        <span>Small space. Open possibilities.</span>
        <button onClick={() => setHelp(true)}>
          Built on Nostr <ArrowUpRight size={13} />
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      <Dialog
        open={compose}
        onOpenChange={(v) => {
          if (!busy) setCompose(v);
        }}
      >
        <DialogContent className="cb-dialog">
          <DialogTitle>Something to share?</DialogTitle>
          <DialogDescription>
            Leave a thought, a question, or an invitation for your group.
          </DialogDescription>
          <form onSubmit={post}>
            <div className="compose-categories">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={postCategory === c ? "active" : ""}
                  aria-pressed={postCategory === c}
                  onClick={() => setPostCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <label htmlFor="post-title">
              Title <span className="optional">Optional</span>
            </label>
            <input
              id="post-title"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a little context"
            />
            <label htmlFor="post-body">Your post</label>
            <textarea
              id="post-body"
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What’s on your mind?"
              rows={5}
              required
            />
            <label htmlFor="post-nickname">
              Nickname <span className="optional">Optional</span>
            </label>
            <input
              id="post-nickname"
              maxLength={32}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Guest"
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || !body.trim()}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Plus size={17} />
              )}{" "}
              {busy ? "Posting…" : "Post to board"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v && !busy) setSelected(null);
        }}
      >
        <DialogContent className="cb-dialog thread-dialog">
          <DialogTitle>{selected?.title || "Conversation"}</DialogTitle>
          <DialogDescription>
            {selected?.nickname} · {selected && age(selected.created_at)}
          </DialogDescription>
          <p className="thread-body">{selected?.body}</p>
          <div className="replies">
            {posts
              .filter((p) => p.parent === selected?.id)
              .sort((a, b) => a.created_at - b.created_at)
              .map((p) => (
                <div className="reply" key={p.id}>
                  <CornerDownRight size={16} />
                  <div>
                    <strong>{p.nickname}</strong>
                    <span className="post-time">{age(p.created_at)}</span>
                    <p>{p.body}</p>
                  </div>
                </div>
              ))}
          </div>
          <form onSubmit={sendReply}>
            <label htmlFor="reply">Add a reply</label>
            <textarea
              id="reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={4000}
              rows={3}
              required
              placeholder="Keep the conversation going…"
            />
            <label htmlFor="reply-nickname">
              Nickname <span className="optional">Optional</span>
            </label>
            <input
              id="reply-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={32}
              placeholder="Guest"
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || !reply.trim()}
            >
              {busy ? "Posting…" : "Post reply"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent className="cb-dialog">
          <DialogTitle>Bring your people in.</DialogTitle>
          <DialogDescription>
            Anyone with this link can join the conversation.
          </DialogDescription>
          <label htmlFor="share-link">Board link</label>
          <input
            id="share-link"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            className="button primary full"
            onClick={() => copy(shareUrl)}
          >
            {copied ? <Check size={17} /> : <Link2 size={17} />}{" "}
            {copied ? "Link copied" : "Copy invitation link"}
          </button>
          {typeof navigator !== "undefined" && !!navigator.share && (
            <button
              className="button full"
              onClick={() =>
                navigator
                  .share({ title: board?.name, url: shareUrl })
                  .catch(() => {})
              }
            >
              Share with an app
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
        <DialogContent className="cb-dialog">
          <DialogTitle>Your identity, on this device.</DialogTitle>
          <DialogDescription>
            Each board has its own signing key saved in this browser.
          </DialogDescription>
          <p>
            Save a recovery file to keep access if you change devices or clear
            your browser data. Keep it private.
          </p>
          <button className="button primary full" onClick={recovery}>
            <KeyRound size={16} /> Save recovery file
          </button>
          <label className="file-label">
            Restore from a recovery file
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                if (e.target.files?.[0]) void restore(e.target.files[0]);
              }}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="cb-dialog">
          <DialogTitle>One link. Your whole group.</DialogTitle>
          <DialogDescription>
            A simple public noticeboard that lives on Nostr.
          </DialogDescription>
          <ol className="how-list">
            <li>
              <strong>Name your space.</strong>
              <p>Create a board for any group, place, or occasion.</p>
            </li>
            <li>
              <strong>Share the link.</strong>
              <p>Anyone can open it, write a post, and reply.</p>
            </li>
            <li>
              <strong>Make yourself at home.</strong>
              <p>Write a post, ask a question, or join a conversation.</p>
            </li>
          </ol>
          <p className="help-note">
            Posts are public Nostr events. Relays distribute and store them.
          </p>
          <a className="button full" href="/connect">
            <Terminal size={17} /> Use with an assistant
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}
