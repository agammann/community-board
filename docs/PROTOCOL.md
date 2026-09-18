# Event contract

Community Board uses signed Nostr kind 1 plaintext events. The event ID is the board ID and the `/b/<id>` route key.

## Board root

A board root has kind `1`, description text in `content`, and these tags:

```json
[
  ["t", "community-board"],
  ["board", "v1"],
  ["subject", "Board name"],
  ["relay", "wss://nos.lol"],
  ["relay", "wss://relay.primal.net"],
  ["relay", "wss://relay.ditto.pub"]
]
```

The `board` tag is an application convention, not a standardized Nostr community kind. Generic clients can render the root and replies as normal notes, but may not display board names, categories, or nicknames as this application does.

## Posts and replies

A post is a kind 1 note with a marked `e` root tag pointing at the board and a `p` tag for its creator. Optional `subject`, `nickname`, and `category` tags supply the UI fields; content remains readable plaintext.

A reply also has an `e` tag marked `reply` pointing at the original post, plus the relevant participant public key. The UI supports one visible reply level. MCP replies must target an original post.

The client validates event signatures through nostr-tools, deduplicates relay results, and filters out events whose marked root belongs to another board. Text is rendered as text rather than HTML. Nicknames are self asserted, not verified identities.

## Bounds and retrieval

Board names are limited to 70 characters, descriptions to 280, titles to 120, nicknames to 32, and note bodies to 4,000. The feed requests up to 200 recent events per relay and exposes older event pagination. Live event memory is bounded to 1,000 records. Date based pagination may omit additional notes if a single timestamp contains more than a full page.

The application publishes to three configured public relays and succeeds when at least one acknowledges the event. It does not promise permanent storage or acceptance by all relays. Browser signing keys and MCP signing keys are local identity material; published notes live on relays.

No deletion, moderation, private board, encryption, or hosted signer is implemented. The app has no server database, account service, AI model, or analytics collection. Relays and the site hosting provider have their own infrastructure and logging policies.
