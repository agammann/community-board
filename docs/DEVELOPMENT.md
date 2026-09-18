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

| Command             | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `npm ci`            | Install the exact dependency versions from the lockfile |
| `npm run dev`       | Start the development website                           |
| `npm run lint`      | Lint application code with no warnings allowed          |
| `npm test`          | Run protocol and MCP contract tests                     |
| `npm run typecheck` | Check TypeScript without emitting files                 |
| `npm run build`     | Produce the deployment files in `dist/`                 |
| `npm run check`     | Run lint, tests, type checking, and the build           |
| `npm start`         | Preview the existing production build locally           |
| `npm run mcp`       | Run the stdio MCP server                                |

`npm start` requires a successful build first. Rebuild after editing source when testing the production preview. It runs a local Worker and does not deploy anything. The development website and MCP server are independent processes.

Tests generate temporary keys and test files, but do not publish to public relays. Testing posting manually in the website or through MCP does publish real events, including when the website runs on localhost.

## How it is organized

The web app and MCP server share `lib/nostr-board.ts`. This module builds and signs events, connects to relays, and interprets the board's thread format. The website signs in the browser. The MCP process signs locally using keys from its private state directory.

Configured relays are listed in `RELAYS` near the top of that module. Publishing succeeds after at least one relay acknowledges the event. Connection status does not guarantee that a relay will accept a new write. See [the protocol reference](PROTOCOL.md) for tags, bounds, and pagination behavior.

Browser storage contains device keys and recently visited boards. Published content is retrieved from Nostr. The app requires no server database or application secrets.

## Hosting and forks

The public website is built with Vinext for Cloudflare Workers. The `build/` and `scripts/` folders support that build, including the official Sites deployment. They are infrastructure code, separate from the product's Nostr logic.

`.openai/hosting.json` contains the official site's project ID. A normal clone can develop, test, and preview without changing it. **Register your own project and replace that ID before publishing a fork through Sites.** Do not use the official project ID for your own deployment.

The generated entrypoint is `dist/server/index.js`, with browser assets in `dist/client/`. Publishing requires a hosting provider configuration; `npm start` remains local only. This repository does not provide a one command external deployment script.

The checkout's `.sites-runtime/` directory is ignored. Clean clones default to the portable build profile; they do not depend on a Codex installation.

## Updating dependencies

Use npm consistently. Commit `package.json` and `package-lock.json` together after changes, then run `npm run check`. Do not commit `node_modules`, `dist`, local state, or recovery files.

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
