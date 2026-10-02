# October 2, 2026 verification

Environment: Windows, Node 24.19.0, npm 11.21.0, Edge 154.0.4258.48. The baseline was commit `1d7cd241aec0440616618cf778cee5b20789ccee`; the final checks below include the reply-draft fix.

## Reproduced issue and fix

On the original app, typing a reply under one post, closing the dialog, and opening another post displayed the first conversation's draft in the second conversation. Reply text was shared across all threads.

Drafts now belong to their post ID. Returning to a conversation restores its draft. A successful send clears only the submitted text for that thread; text edited while waiting for relay acknowledgment remains available. Failed sends preserve the draft. Reloading or leaving the page still discards unsent drafts.

## Source checks

`npm ci` and `npm run check` completed successfully. The final check ran lint, all 11 tests, TypeScript checking and the production build. Existing tests include an actual local WebSocket disconnect and reconnect. Two focused regressions cover separate drafts and edits made before a delayed acknowledgment.

## Production build in the browser

The built app ran under local workerd through `npm start`. Playwright used isolated Edge profiles at 1440, 390 and 320 pixels. The Browser plugin was unavailable. WebSocket destinations were redirected to a private loopback relay; application signing, protocol messages, subscriptions, verification and acknowledgments were real. No test notes were sent to public relays.

The following flows passed:

- Create a board, publish categorized posts, filter categories, and receive a live post from a second browser identity.
- Switch between two reply drafts without transferring their text; successfully send one while retaining the other.
- Reject a write at every relay, retain the draft, and successfully retry after writes resume.
- Delay relay acknowledgments, edit the reply while it is sending, and retain the newer text when the original send completes.
- Export a generated test identity, reject an invalid recovery file, restore that identity in another browser, and retain it after reload.
- Open the share dialog and verify the link contains no recovery fragment.
- Load older events: the initial page showed 197 original posts; pagination reached all 213 original posts in the fixture, including 210 older signed notes.
- Open assistant setup and display the invalid-board-link error.

No page exceptions or horizontal overflow were observed. The tests used synthetic board content and generated test identities. They do not establish compatibility with every browser, relay, MCP client, or mobile device.

## MCP and published-site checks

An actual MCP stdio client connected to the repository server and listed all five tools. Against the same kind of isolated relay it created a board, published a post, replied, read both events with the correct parent relationship, rejected replying to a reply, and checked relay status. No tool arguments or results exposed a signing key.

A separate, unmodified `relay_status` call connected to all three configured public relays. This was a read-only connectivity check; it did not test public-relay write acceptance or retention.

The published homepage, help dialog and assistant setup page rendered and responded to controls. The read-only browser harness blocked a hosting challenge POST under `/cdn-cgi/challenge-platform/`, producing a corresponding console network error; there were no page exceptions. No board was created or posted on the published site during this review.

The fixed source has been tested locally. Publishing it and verifying that release are separate steps. The application has no LLM or native WebMCP integration; its assistant interface is the local stdio MCP server documented in [MCP setup](MCP.md).
