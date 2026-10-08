import { WebSocketServer } from "ws";
import { verifyEvent } from "nostr-tools/pure";
import { once } from "node:events";
export async function localRelay() {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const events = new Map(),
    subscriptions = new Map();
  let allowWrites = true,
    hold = false;
  const acknowledgments = [];
  const metrics = { connections: 0, accepted: 0, rejected: 0, queries: 0 };
  const matches = (event, f) =>
    (!f.ids || f.ids.some((id) => event.id.startsWith(id))) &&
    (!f.kinds || f.kinds.includes(event.kind)) &&
    (!f.authors || f.authors.includes(event.pubkey)) &&
    (f.since === undefined || event.created_at >= f.since) &&
    (f.until === undefined || event.created_at <= f.until) &&
    Object.entries(f)
      .filter(([k]) => k.startsWith("#"))
      .every(([k, v]) =>
        event.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])),
      );
  const deliver = (event) => {
    for (const [socket, subs] of subscriptions)
      for (const [id, filters] of subs)
        if (socket.readyState === 1 && filters.some((f) => matches(event, f)))
          socket.send(JSON.stringify(["EVENT", id, event]));
  };
  server.on("connection", (socket) => {
    metrics.connections++;
    const subs = new Map();
    subscriptions.set(socket, subs);
    socket.on("close", () => subscriptions.delete(socket));
    socket.on("message", (bytes) => {
      const [type, id, ...rest] = JSON.parse(bytes.toString());
      if (type === "REQ") {
        metrics.queries++;
        subs.set(id, rest);
        const sent = new Set();
        for (const filter of rest) {
          const found = [...events.values()]
            .filter((e) => matches(e, filter))
            .sort(
              (a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id),
            )
            .slice(0, filter.limit ?? 10000);
          for (const event of found)
            if (!sent.has(event.id)) {
              sent.add(event.id);
              socket.send(JSON.stringify(["EVENT", id, event]));
            }
        }
        socket.send(JSON.stringify(["EOSE", id]));
      } else if (type === "CLOSE") subs.delete(id);
      else if (type === "EVENT") {
        const event = id;
        const valid = verifyEvent(event) && allowWrites;
        if (valid) {
          events.set(event.id, event);
          metrics.accepted++;
          const ack = () => {
            if (socket.readyState === 1)
              socket.send(
                JSON.stringify([
                  "OK",
                  event.id,
                  true,
                  "stored by private test relay",
                ]),
              );
          };
          if (hold) acknowledgments.push(ack);
          else ack();
          deliver(event);
        } else {
          metrics.rejected++;
          socket.send(
            JSON.stringify([
              "OK",
              event.id,
              false,
              "blocked: private relay write rejected",
            ]),
          );
        }
      }
    });
  });
  return {
    url: "ws://127.0.0.1:" + server.address().port,
    events,
    metrics,
    setWrites(value) {
      allowWrites = value;
    },
    holdAcknowledgments(value) {
      hold = value;
      if (!hold) while (acknowledgments.length) acknowledgments.shift()();
    },
    insert(event) {
      if (!verifyEvent(event)) throw Error("Invalid fixture signature");
      events.set(event.id, event);
      deliver(event);
    },
    disconnect() {
      for (const socket of server.clients) socket.close();
    },
    async close() {
      for (const socket of server.clients) socket.terminate();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
export async function isolateRelays(context, url) {
  await context.addInitScript(
    ({ url }) => {
      const Native = window.WebSocket;
      window.WebSocket = class extends Native {
        constructor(address, protocols) {
          const source = new URL(address, location.href);
          if (
            ["nos.lol", "relay.primal.net", "relay.ditto.pub"].includes(
              source.hostname,
            )
          )
            super(url, protocols);
          else if (["127.0.0.1", "localhost"].includes(source.hostname))
            super(address, protocols);
          else
            throw Error("External WebSocket blocked in private verification");
        }
      };
    },
    { url },
  );
}
