# Community Board

**Create a space for your group in seconds. Share one link. Anyone can participate.**

[Open the app](https://community-board.alx21.chatgpt.site) · [MCP setup](docs/MCP.md) · [Development](docs/DEVELOPMENT.md) · [Event format](docs/PROTOCOL.md) · [v1 scope and recovery](docs/STABILITY.md)

A lightweight group noticeboard built on Nostr, with a mobile friendly website and an optional local MCP server.

## Create a board

1. Open the app and enter a board name. Add a description if useful.
2. Select **Create board**, then **Share board** to copy the link.
3. Send the link to your group. Everyone can post and reply.

Use General, Question, Offer, or Event to organize posts. Nicknames are optional. New posts arrive live, and the connection panel shows which relays are reachable.

Reply drafts stay with their conversation while the page is open. Switching threads keeps each draft separate, and a rejected post keeps its text for retry. Drafts are not saved across a page reload or navigation.

## Run locally

Install [Node.js 24 or newer](https://nodejs.org/en/download). For a versioned download, open [Releases](https://github.com/agammann/community-board/releases), download `community-board_1.0.0_source.zip`, check its SHA-256 against `SHA256SUMS`, and extract the whole folder. In that folder, run:

```sh
npm ci
npm run dev
```

On Windows, `Get-FileHash ./community-board_1.0.0_source.zip -Algorithm SHA256` prints the checksum before extraction. On Linux use `sha256sum`; on macOS use `shasum -a 256`.

Developers can instead install [Git](https://git-scm.com/downloads) and clone the project:

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

`check` runs lint, tests, TypeScript checks, the production build, and a dependency audit. The audit needs access to the npm registry. `start` serves that built version locally; it does not publish a website. See [development instructions](docs/DEVELOPMENT.md) for individual commands, deployment notes, and troubleshooting.

The [v1 verification record](docs/STABILITY.md) covers the fresh source package, production browser flows, identity recovery and stdio assistant tools. The [October 3 verification record](docs/VERIFICATION-2026-10-03.md) records the completed build, saved-identity, browser/MCP and public-relay checks, including two published events and fresh readback after ten minutes. Relay-specific results and limits are included. The [October 2 record](docs/VERIFICATION-2026-10-02.md) preserves the earlier published-site findings.

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

Posts live on Nostr relays. A recovery file restores your signing identity; it does not back up or recover relay content. Save it separately from the checkout before an upgrade. If a post fails, keep its draft and retry; a connected relay can still reject writes. Relay availability and retention differ, so this app does not promise permanent storage. Board links and posted content are public. This version focuses on creating boards, posting, and replying; deletion and moderation are outside its scope.

## Project layout

| Path                    | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `app/`                  | Website interface and styles            |
| `client/` and `worker/` | Browser entry points and route handling |
| `lib/nostr-board.ts`    | Shared signing, relay, and event logic  |
| `mcp/server.mjs`        | Local MCP server                        |
| `tests/`                | Protocol and MCP contract checks        |
| `docs/`                 | Setup and protocol documentation        |
| `build/` and `scripts/` | Build and hosting support               |

## Inspiration and dependencies

[Coracle](https://github.com/coracle-social/coracle) informed the relay visibility and key recovery experience. [Jumble](https://github.com/CodyTseng/jumble) informed the simple feed layout. This is an independent implementation.

Built with [nostr-tools](https://github.com/nbd-wtf/nostr-tools), the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [Vite](https://vite.dev/), React, Radix Dialog, and Lucide. Retained build tooling includes its upstream license.

## License

This project is licensed under [MIT](LICENSE). [Third-party notices](THIRD_PARTY_NOTICES.md) preserve the retained build tooling license.
