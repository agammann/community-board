# Community Board v1

Community Board v1 provides public group boards with categorized posts, replies, live updates, shared links and device identity recovery. The website works without an account or API key. An optional local stdio MCP server exposes the same operations to assistants.

## Supported use

Use the published website or the versioned source ZIP with Node.js 24 or newer and `npm ci`. Development starts with `npm run dev`; `npm run build` followed by `npm start` serves the production build locally. A developer can extend the shared protocol module, website, routes or assistant tools using the [development guide](DEVELOPMENT.md).

Posts and board links are public. Deletion, moderation, private boards and browser WebMCP tools are outside v1. Reply drafts persist while the page stays open, including across conversation switches and failed sends; a reload or navigation discards them.

## Recovery and upgrades

Save each board's recovery file through **Manage this device** before clearing browser storage, moving to a different browser or upgrading. Restore the file on the same board to recover its signing identity. The MCP process stores a separate per-board identity in `mcp/.state/` by default; back up that directory or use a separate absolute `COMMUNITY_BOARD_STATE_DIR` before replacing its checkout. Restoring the matching file in the website lets the browser use that MCP identity.

Recovery files contain private signing keys. They restore identity, not relay content. Browser recent-board lists remain local to that browser origin; opening the same board at a different origin does not transfer its stored keys automatically. Do not commit recovery files or send them in assistant messages.

Publishing succeeds when at least one relay acknowledges the event. Connection status alone does not guarantee write acceptance. The website preserves loaded posts during partial refreshes and reports failure when all relays are unavailable. Retention and availability depend on the public relays; the app does not guarantee permanent or identical storage across them.

## Verification

On October 7, 2026 (UTC), the prepared v1 source passed locked installation, lint, all 14 tests, TypeScript checks and a production build on Windows with Node 24.19.0. The tests include an actual local WebSocket disconnect and reconnect. A complete npm audit reported zero findings at the time of that check.

The built production app ran under real local workerd in Chrome 155.0.8059.12 against a private WebSocket relay. The journey created a board, posted in two categories, kept separate reply drafts, preserved drafts after rejection and during delayed acknowledgments, filtered posts, received a live post from a second browser identity, shared a link without a recovery key, exported/restored the exact identity across reload, paginated to all 213 signed root posts, and rendered assistant setup and invalid links. Desktop and 390/320-pixel layouts were inspected. No page exceptions, console errors or document-level horizontal overflow were observed.

An actual SDK stdio client exercised all five tools from a different working directory. It created a board, posted and replied, read the correct thread relationship, rejected nested replies, checked connections, retried a rejected write, retained identity after process restart, rejected an unrelated board recovery file and restored the original key. Test recovery files remained private; these new checks published no public events.

The release workflow verifies the actual source ZIP in a fresh folder before publication. The [earlier public-relay record](VERIFICATION-2026-10-03.md) preserves the approved board/post publication and immediate and ten-minute readback. That historical test found complete readback from at least one relay in each phase and unequal results among relays. The new local v1 checks verify application behavior with the patched dependencies; they do not repeat or extend that retention measurement or certify every browser, relay or assistant client.
