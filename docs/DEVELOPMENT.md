# Development

[Back to README](../README.md)

## Requirements

Use Node.js 24 or newer, npm supplied with Node, and Git. Internet access is required for the first dependency installation and for live Nostr connections.

The same setup commands work in PowerShell, Command Prompt, and common Unix shells:

```sh
git clone https://github.com/agammann/community-board.git
cd community-board
npm ci
npm run dev
```

Open the local URL printed in the terminal. The default development port is 5173. If that port is occupied, use the address the server actually prints. To request a different port:

```sh
npm run dev -- --port 4173
```

Keep the server running while using the site. Stop it with Ctrl+C.

## Commands

| Command                      | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `npm ci`                     | Install the exact dependency versions from the lockfile |
| `npm run dev`                | Start the development website                           |
| `npm run lint`               | Lint application code with no warnings allowed          |
| `npm test`                   | Run protocol and MCP contract tests                     |
| `npm run typecheck`          | Check TypeScript without emitting files                 |
| `npm run build`              | Produce the deployment files in `dist/`                 |
| `npm run check`              | Run lint, tests, type checking, the build, and audit    |
| `npm run audit:dependencies` | Audit the locked dependency tree using npm              |
| `npm start`                  | Preview the existing production build locally           |
| `npm run mcp`                | Run the stdio MCP server                                |
| `npm run test:e2e`           | Run the built browser journey against a private relay   |
| `npm run test:mcp`           | Exercise all five stdio tools, restart and recovery     |
| `npm run audit:json`         | Print the complete current npm audit as JSON            |
| `npm run package:release`    | Package a clean committed source tree and checksums     |

`npm start` requires a successful build first. Rebuild after editing source when testing the production preview. It runs a local Worker and does not deploy anything. The development website and MCP server are independent processes.

Tests generate temporary keys and test files, but do not publish to public relays. Testing posting manually in the website or through MCP does publish real events, including when the website runs on localhost.

The resilience tests cover invalid recovery files, partial and duplicate feed responses, offline reads, relay write failures, and live subscription recovery after a local WebSocket server disconnects. The reconnect test takes about ten seconds and needs permission to listen on a loopback port.

Reply-draft tests cover separate conversations and delayed acknowledgments: sending one reply clears only its submitted text, preserving drafts in other threads and edits made while the send was pending. These drafts live in page memory. See the [dated verification record](VERIFICATION-2026-10-02.md) for the rendered app and stdio MCP checks against an isolated relay.

## Browser and assistant checks

After `npm ci` and `npm run build`, install the test browser and run:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:mcp
```

On Linux, use `npx playwright install --with-deps chromium` when browser system libraries are missing. To use an existing Chrome installation, set `COMMUNITY_BOARD_BROWSER_EXECUTABLE` to its executable's absolute path. These tests use real local WebSockets and signed Nostr events; they redirect the three configured relay destinations to a private loopback relay and submit no public events. Reports and screenshots go into ignored `test-results/`. The browser check downloads a generated recovery file privately, uses it for restoration, and removes it before exit.

The MCP check starts the actual server from another working directory, exercises all five tools, checks rejected writes and retries, restarts with the same local identity, rejects a recovery file for another board, and restores the exact original key. It removes its own temporary key directory afterward.

## Build on the project

- Add a category in `CATEGORIES` and update the protocol documentation; keep the default category and existing event tags readable.
- Add website interactions in `app/board-app.tsx` and exercise them against the private relay before using public relays.
- Add assistant tools in `mcp/server.mjs`, reusing the shared signing and bounds checks. Keep recovery keys in local files and avoid returning them in tool text.
- Change hosting routes in `worker/index.ts` with a route test. Keep existing board URLs and per-board browser identities intact.

Keep `RELAYS` publication/retrieval destinations separate from any assumptions about durable storage. A relay acknowledgment confirms acceptance at that time. It does not promise equal readback or permanent retention.

## Source release

Commit the changes before running `npm run package:release`. The packager uses only tracked source from a clean Git tree; it includes the lockfile and licenses and excludes local state, build output and test artifacts. It writes the versioned ZIP, its `.sha256` sidecar and `SHA256SUMS` into `release-artifacts/`.

The verification workflow runs on Windows and Linux. Its Windows job extracts that actual source ZIP into a new folder, installs with `npm ci`, checks it and runs its browser/assistant journeys. The publication job runs only after verification of a main push, requires the same current main commit and matching tag, verifies every uploaded asset's hash and size, and publishes the complete draft. Pull requests and manual verification runs do not publish releases. Previously published versions remain unchanged; bump the version and add a changelog section for another release.

## How it is organized

The web app and MCP server share `lib/nostr-board.ts`. This module builds and signs events, connects to relays, and interprets the board's thread format. The website signs in the browser. The MCP process signs locally using keys from its private state directory.

Configured relays are listed in `RELAYS` near the top of that module. Publishing succeeds after at least one relay acknowledges the event. Connection status does not guarantee that a relay will accept a new write. See [the protocol reference](PROTOCOL.md) for tags, bounds, and pagination behavior.

Live subscriptions reconnect automatically after established connections drop. Refreshing merges relay results with posts already loaded in the current page, so a partial response does not erase the conversation. If all relays are unreachable, the page keeps those posts and reports the connection failure.

Browser storage contains device keys and recently visited boards. Published content is retrieved from Nostr. The app requires no server database or application secrets.

## Hosting and forks

The website uses React and Vite with a small Cloudflare Worker. The `build/` and `scripts/` folders support that build, including the official Sites deployment. They are infrastructure code, separate from the product's Nostr logic.

The browser entry points render the board and assistant setup. Only `/b/<one segment>` receives the shared board shell; the original URL remains available to the existing device and recovery logic. Static assets use the hosting layer's canonical paths, including `/connect/`. Unknown paths do not receive a global app fallback. The app has no server API, server renderer, or account sign-in route.

`.openai/hosting.json` contains the official site's project ID. A normal clone can develop, test, and preview without changing it. **Register your own project and replace that ID before publishing a fork through Sites.** Do not use the official project ID for your own deployment.

The generated entrypoint is `dist/server/index.js`, with browser assets in `dist/client/`. Publishing requires a hosting provider configuration; `npm start` remains local only. This repository does not provide a one command external deployment script.

The checkout's `.sites-runtime/` directory is ignored. Clean clones default to the portable build profile; they do not depend on a Codex installation.

## Updating dependencies

Use npm consistently. Commit `package.json` and `package-lock.json` together after changes, then run `npm run check`. The final audit queries the npm registry and fails on any reported advisory; a successful audit is a dated dependency check, not a guarantee about all application behavior. Do not commit `node_modules`, `dist`, local state, or recovery files.

## Troubleshooting

| Symptom                                         | What to do                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node` or `npm` is not found                    | Install Node.js 24 or newer, reopen the terminal, and check `node --version` and `npm --version` |
| A script cannot be found                        | Run commands from the repository root, where `package.json` lives                                |
| PowerShell blocks `npm.ps1`                     | Use `npm.cmd` with the same arguments; no execution policy change is needed                      |
| Production preview reports a missing entrypoint | Run `npm run build`, then `npm start`                                                            |
| Board loads slowly or posting fails             | Check the relay panel and your connection. Keep the draft and retry                              |
| An old shared link cannot load                  | Confirm the full board ID. Relay retention and availability are outside this app's control       |
| Device identity changed                         | Restore the board's recovery file through **Manage this device**                                 |

The website supports creation, posts, replies, live updates, categories, sharing, and key recovery. Deletion, moderation, and WebMCP are not implemented. The MCP transport is local stdio. Client support for the board's custom display tags varies.
