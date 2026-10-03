# October 3, 2026 verification

Environment: Windows, Node 24.19.0, npm 11.21.0 and sandboxed Edge 154.0.4258.48. This record covers the direct Vite build migration from `ccd13826747c276e316dd911bdbe3bdaa5fc1bb9`. It describes a local production build; it does not establish that the migration has been deployed to the public website.

## Build and dependency checks

A locked `npm ci` and the complete `npm run check` passed. The check ran lint, all 14 tests, TypeScript checking, a production build and `npm audit`, which reported zero vulnerabilities at the time of the check. The 11 existing tests remain, including real local WebSocket disconnect/reconnect coverage; three focused tests cover board paths, asset delegation and rejected requests. The dependency audit is a dated registry result, not a general security guarantee.

The build now uses Vite and a small route Worker. Shared Nostr signing, relay, draft and MCP implementation files are unchanged. Direct ESLint configuration retains the applicable TypeScript, React, hooks, accessibility and import rules. Next-specific rules were removed with Next/Vinext; the generic external synchronous-script safeguard remains.

## Browser and saved identity

The previous and new compiled builds ran under separate local workerd instances behind one loopback browser origin. A fictional board created through the previous interface retained its exact local identity and recent-board data after switching to the new build and reloading. The creator indicator and recent-board navigation also survived. This is a same-origin browser-storage check on one machine, not cross-device synchronization.

Actual browser flows passed against a private WebSocket relay:

- Create categorized posts, filter them and receive a live post from a second browser identity.
- Keep separate thread drafts; clear only sent text; retain drafts after rejected writes; preserve newer edits while acknowledgments are delayed.
- Confirm that the shared board link contains no recovery key.
- Download a generated test identity, reject an invalid recovery file, restore the valid file in another isolated browser context and retain the identity after reload.
- Open a generated recovery fragment, verify it is cleared from the URL, and retain that identity after visiting assistant setup and returning to the board.
- Paginate from 197 to all 213 root posts in the signed fixture.
- Render home and board views at 1440, 390 and 320 pixels, assistant setup, and the invalid-board-link error. No page/console errors, warnings or document-level horizontal overflow were recorded. Category and code strips retain their internal scrolling; screenshots cover the viewport.

All 27 observed native browser WebSockets reached the private loopback relay. Signing, event verification, subscriptions, acknowledgments and application code were real; relay destinations alone were redirected. No fixture event was sent to public relays. Generated recovery bytes stayed private and were not included in reports.

Twelve GET/HEAD checks passed against the compiled server: the homepage, canonical assistant setup, unknown-route 404, malformed-board-path 400 and board trailing-slash redirect. The local asset service returned 307 for `/connect` to `/connect/`; the application returned 308 for a trailing board slash. All four JavaScript/CSS assets actually fetched by the candidate browser matched the built files byte for byte.

## MCP and test limits

An actual stdio MCP client listed and exercised `create_board`, `create_post`, `reply_to_post`, `read_board` and `relay_status`. It created a fictional board, posted and replied, read the correct parent relationship, rejected a nested reply and observed all three configured relay connections redirected locally. No signing key was recorded in tool-result evidence. The browser, MCP child, relay, proxy and both workerd backends closed successfully.

Two earlier harness attempts remain recorded: the first stopped because two WebSocket wrappers interacted incorrectly; the second passed upgrade and initial browser checks but used a download-path API unsupported by its remote browser connection. The completed run corrected the harness to validate actual native destinations and read the real download through a bounded stream. Application code and acceptance requirements did not change between those attempts.

Public-relay write acceptance/retention and a new public-site deployment were not tested here. No claim follows for every browser, physical mobile device, relay or MCP client. The application has no LLM or native WebMCP integration, so a hosted-model/API-key mode is not applicable. The [October 2 record](VERIFICATION-2026-10-02.md) preserves the earlier published-site and read-only public-relay findings.
