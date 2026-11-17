# Community Board v1

Community Board v1 provides public group boards with categorized posts, replies, live updates, shared links and device identity recovery. The website works without an account or API key. An optional local stdio MCP server exposes the same operations to assistants.

## Supported use

Use the published website or the versioned source ZIP with Node.js 24 or newer and `npm ci`. Development starts with `npm run dev`; `npm run build` followed by `npm start` serves the production build locally. A developer can extend the shared protocol module, website, routes or assistant tools using the [development guide](DEVELOPMENT.md).

Posts and board links are public. Deletion, moderation, private boards and browser WebMCP tools are outside v1. Reply drafts persist while the page stays open, including across conversation switches and failed sends; a reload or navigation discards them.

## Recovery and upgrades

Save each board's recovery file through **Manage this device** before clearing browser storage, moving to a different browser or upgrading. The browser stores each board's key encrypted with a passphrase, which is required again on return. Previously saved cleartext browser keys are encrypted when that board is next opened and a passphrase is chosen. Restore a recovery file on the same board to recover its signing identity; at the unlock prompt, a recovery file can explicitly replace a locked key when the passphrase is forgotten. The MCP process stores separate per-board identities in `~/.community-board/mcp/` for new installations. Existing `mcp/.state/` directories remain in use for continuity. Back up the active directory before replacing a checkout, or set `COMMUNITY_BOARD_STATE_DIR` to a private absolute path outside it. Restoring the matching file in the website lets the browser use that MCP identity.

Recovery files contain private signing keys. They restore identity, not relay content. Browser recent-board lists remain local to that browser origin; opening the same board at a different origin does not transfer its stored keys automatically. Do not commit recovery files or send them in assistant messages.

Publishing succeeds when at least one relay acknowledges the event. Connection status alone does not guarantee write acceptance. The website preserves loaded posts during partial refreshes and reports failure when all relays are unavailable. Retention and availability depend on the public relays; the app does not guarantee permanent or identical storage across them.

## Verification

### November 17, 2026 checks

The unpublished 1.0.4 source candidate passed frozen installation, lint, all 37 Node checks, TypeScript checks and the production build on Windows with Node 24.19.0 and bundled npm 11.17.0. Vite 8.3.8 and Rolldown 1.2.19 include the upstream development-server fix. The local stdio server reports the package version and applies a 32-element argument ceiling. Small flat invalid inputs verified the exact ceiling before schema validation. All documented tools use at most five scalar properties.

The production browser journey passed in Chromium 153.0.8010.12 against a private loopback relay. It covered board creation, posts, separate reply drafts, rejected writes, delayed acknowledgments, identity recovery and pagination to 213 root posts. Page and console errors were empty. The actual SDK stdio journey passed all five tools, write retries, process restart and exact identity recovery. These checks published no public events.

The required full audit still fails with 12 high entries from the [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), which lists no patched version. Version 1.0.4 remains unpublished. The available release remains 1.0.3, and the existing hosted website is unchanged.

### October 7, 2026 checks

On October 7, 2026 (UTC), the prepared v1 source passed locked installation, lint, all 14 tests, TypeScript checks and a production build on Windows with Node 24.19.0. The tests include an actual local WebSocket disconnect and reconnect. A complete npm audit reported zero findings at the time of that check.

The built production app ran under real local workerd in Chrome 155.0.8059.12 against a private WebSocket relay. The journey created a board, posted in two categories, kept separate reply drafts, preserved drafts after rejection and during delayed acknowledgments, filtered posts, received a live post from a second browser identity, shared a link without a recovery key, exported/restored the exact identity across reload, paginated to all 213 signed root posts, and rendered assistant setup and invalid links. Desktop and 390/320-pixel layouts were inspected. No page exceptions, console errors or document-level horizontal overflow were observed.

An actual SDK stdio client exercised all five tools from a different working directory. It created a board, posted and replied, read the correct thread relationship, rejected nested replies, checked connections, retried a rejected write, retained identity after process restart, rejected an unrelated board recovery file and restored the original key. Test recovery files remained private; these new checks published no public events.

The release workflow verifies the actual source ZIP in a fresh folder before publication. The [earlier public-relay record](VERIFICATION-2026-10-03.md) preserves the approved board/post publication and immediate and ten-minute readback. That historical test found complete readback from at least one relay in each phase and unequal results among relays. The new local v1 checks verify application behavior with the patched dependencies; they do not repeat or extend that retention measurement or certify every browser, relay or assistant client.
