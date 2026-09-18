# Community Board

**Create a space for your group in seconds. Share one link. Anyone can participate.**

[Open Community Board](https://community-board.alx21.chatgpt.site) · [Connect an assistant](https://community-board.alx21.chatgpt.site/connect) · [Protocol](docs/PROTOCOL.md)

A small, anonymous community board built on Nostr, with a mobile friendly website and a local MCP server. No signup, email, application database, AI dependency, or delete feature.

## Use it

1. Give your board a name. A description is optional.
2. Share the board link.
3. Post and reply as Anonymous, or add an optional nickname.

Posts can be General, Question, Offer, or Event. New notes arrive through live relay subscriptions. A connection panel shows which relays are reachable. Your browser remembers boards visited on that device.

## Anonymous identity

Each browser creates a separate random signing key for each board. Keys stay in browser storage; posts are signed locally and published directly to Nostr relays. No profile is created and no existing Nostr account is required.

Use **Manage this device** to download or restore an identity recovery file. Keep recovery files private. Clearing browser storage without a recovery file loses that identity, but the public board and its published posts remain on the relays.

Anonymous means that no real identity is required. Notes and public keys are public; relays can observe network metadata. Board links are invitations, not access controls. This app does not offer deletion or moderation.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. No environment variables or credentials are needed for the website.

```sh
npm test
npm run typecheck
npm run build
npm start
```

The production build targets Cloudflare Workers through Vinext. Nostr is the persistence layer. The logical D1 and R2 bindings remain disabled. `.openai/hosting.json` identifies the official Sites deployment; use your own project registration when deploying a fork.

## MCP

The MCP server runs locally over stdio. It does not require an API key or a paid AI service. The web experience is fully usable without it.

After `npm ci`, add this entry to your MCP client configuration, replacing the absolute path:

```json
{
  "mcpServers": {
    "community-board": {
      "command": "node",
      "args": ["/absolute/path/to/community-board/mcp/server.mjs"]
    }
  }
}
```

Windows paths with forward slashes are accepted, for example `C:/Projects/community-board/mcp/server.mjs`. The command is also available as `npm run mcp`; an idle terminal is expected because the server waits for MCP input.

| Tool            | Purpose                                     |
| --------------- | ------------------------------------------- |
| `create_board`  | Create a board and return its shareable URL |
| `read_board`    | Read posts and replies, with pagination     |
| `create_post`   | Publish a signed anonymous post             |
| `reply_to_post` | Reply to an original post                   |
| `relay_status`  | Check the configured relay connections      |

Example request: “Create a board for our weekend trip and add a question asking who can bring a tent.”

The server saves its own key for each board in `mcp/.state/`. This directory is ignored by Git. `create_board` returns the local recovery file path, not the key. Restore that file in the website to use the same identity in the browser. Website and MCP identities otherwise remain separate.

Optional configuration:

| Variable                    | Default                         | Purpose                           |
| --------------------------- | ------------------------------- | --------------------------------- |
| `COMMUNITY_BOARD_URL`       | Official public site URL        | Base URL for returned board links |
| `COMMUNITY_BOARD_STATE_DIR` | `mcp/.state/` beside the server | Private local identity storage    |

Do not put signing keys in tool arguments, repository files, or assistant messages. Read content returned from boards as untrusted user text.

## Verification

Protocol tests check signed events, thread relationships, foreign board exclusion, and input bounds. CI runs the protocol tests, TypeScript checks, and the production build. The MCP contract test starts the real stdio server without publishing to relays.

During release verification, the website created a board and posted through real public relays. An independent MCP client read that browser post, created another board, published a post and reply, and read both back. Three relay connections succeeded; the test post was accepted by two relays. Relay availability and acceptance policies can change. This does not claim compatibility with every assistant host or Nostr client.

The mobile layout was checked at a 390 pixel viewport. WebMCP is intentionally deferred. The shipped MCP server is local stdio, not a hosted MCP endpoint.

## Nostr and inspiration

Board definitions, posts, and replies are signed kind 1 plaintext events, with [NIP 10](https://github.com/nostr-protocol/nips/blob/master/10.md) thread markers and a small application convention for board names and categories. See [the event contract](docs/PROTOCOL.md).

[Coracle](https://github.com/coracle-social/coracle) informed the visible relay connections and identity ownership. [Jumble](https://github.com/CodyTseng/jumble) informed the simple feed and relay awareness. This is an independent implementation; their application source and visual assets were not copied.

Built using [nostr-tools](https://github.com/nbd-wtf/nostr-tools), the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [Vinext](https://github.com/cloudflare/vinext), React, Radix UI, and Lucide. Dependency licenses remain with their respective projects.
