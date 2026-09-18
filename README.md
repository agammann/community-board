# Community Board

**Create a space for your group in seconds. Share one link. Anyone can participate.**

[Open the app](https://community-board.alx21.chatgpt.site) · [MCP setup](docs/MCP.md) · [Development](docs/DEVELOPMENT.md) · [Event format](docs/PROTOCOL.md)

A lightweight group noticeboard built on Nostr, with a mobile friendly website and an optional local MCP server.

## Create a board

1. Open the app and enter a board name. Add a description if useful.
2. Select **Create board**, then **Share board** to copy the link.
3. Send the link to your group. Everyone can post and reply.

Use General, Question, Offer, or Event to organize posts. Nicknames are optional. New posts arrive live, and the connection panel shows which relays are reachable.

## Run locally

Install [Node.js 24 or newer](https://nodejs.org/en/download) and [Git](https://git-scm.com/downloads), then run these commands in a terminal:

```sh
git clone https://github.com/agammann/community-board.git
cd community-board
npm ci
npm run dev
```

Open the local URL printed by the server. Keep the terminal running while using the app; press Ctrl+C to stop it. The website needs internet access to reach Nostr relays. It does not require environment variables or a separate database.

To check the project and preview a production build:

```sh
npm run check
npm start
```

`check` runs lint, tests, TypeScript checks, and the production build. `start` serves that built version locally; it does not publish a website. See [development instructions](docs/DEVELOPMENT.md) for individual commands, deployment notes, and troubleshooting.

## Connect an assistant

The local MCP server can create boards, read posts, publish notes, reply, and check relay connections. After the installation above, configure your MCP client with:

| Setting   | Value                                              |
| --------- | -------------------------------------------------- |
| Transport | Local process / stdio                              |
| Command   | `node`                                             |
| Argument  | Absolute path to `mcp/server.mjs` in your checkout |

For example, the argument might be `C:/Projects/community-board/mcp/server.mjs` on Windows or `/home/you/community-board/mcp/server.mjs` on Linux.

Follow the [MCP setup guide](docs/MCP.md) for a copyable configuration, connection checks, and optional settings. The website works independently of an assistant.

## Keep access to your device identity

Each board has its own signing key on your device. On a board, open **Manage this device** and select **Save recovery file** before changing browsers or clearing browser data. To restore it, open the same board and select the saved file under **Restore from a recovery file**. Keep that file private.

Posts live on Nostr relays. Board links are public invitations. This version focuses on creating boards, posting, and replying; deletion and moderation are outside its scope.

## Project layout

| Path                    | Purpose                                |
| ----------------------- | -------------------------------------- |
| `app/`                  | Website routes, interface, and styles  |
| `lib/nostr-board.ts`    | Shared signing, relay, and event logic |
| `mcp/server.mjs`        | Local MCP server                       |
| `tests/`                | Protocol and MCP contract checks       |
| `docs/`                 | Setup and protocol documentation       |
| `build/` and `scripts/` | Build and hosting support              |

## Inspiration and dependencies

[Coracle](https://github.com/coracle-social/coracle) informed the relay visibility and key recovery experience. [Jumble](https://github.com/CodyTseng/jumble) informed the simple feed layout. This is an independent implementation.

Built with [nostr-tools](https://github.com/nbd-wtf/nostr-tools), the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [Vinext](https://github.com/cloudflare/vinext), React, Radix Dialog, and Lucide. Retained build tooling includes its upstream license.
