# MCP setup

[Back to README](../README.md)

Community Board exposes a local MCP server over stdio. It connects directly to Nostr relays and uses the same event format as the website. There is no hosted MCP endpoint to paste into an HTTP connector field.

## 1. Install the project

Install Node.js 24 or newer and Git, then run:

```sh
git clone https://github.com/agammann/community-board.git
cd community-board
npm ci
```

If you already cloned the project, run `npm ci` in that checkout. Confirm `node --version` reports version 24 or newer. You do not need to run the web development server to use MCP.

## 2. Register the local server

In an MCP client that supports local processes, add a server with these settings:

1. Name: `community-board`
2. Transport: stdio or local process
3. Command: `node`
4. Arguments: the absolute path to `mcp/server.mjs`

Clients that use a `mcpServers` JSON configuration can use this example after replacing the path:

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

On Windows, use forward slashes in JSON, for example:

```json
"args": ["C:/Projects/community-board/mcp/server.mjs"]
```

The JSON key layout depends on the client. Use its local server settings if it does not accept this format. If the client cannot find `node`, replace the command with the full path to the Node executable. `where.exe node` on Windows, or `command -v node` on macOS and Linux, shows that path.

Save the configuration and restart or reconnect the server in your client. The process can start from any working directory because its default state path is resolved relative to the server file.

## 3. Verify the connection

The client should list these five tools:

| Tool            | Input                                                        | Result                                                               |
| --------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `create_board`  | `name`, optional `description`                               | Board ID, share link, accepting relays, and local recovery file path |
| `read_board`    | `board_id`, optional `before`                                | Board details, posts, replies, and pagination cursor                 |
| `create_post`   | `board_id`, `body`; optional `title`, `nickname`, `category` | Published event ID and accepting relays                              |
| `reply_to_post` | `board_id`, `post_id`, `body`; optional `nickname`           | Published reply ID and accepting relays                              |
| `relay_status`  | No arguments                                                 | Connection status for each configured relay                          |

First ask the assistant to check relay status. This does not publish anything. Then try:

> Create a board for our weekend trip. Add a question asking who can bring a tent, and give me the board link.

`board_id` is the 64 character event ID in the share link after `/b/`. Use the original post ID when replying. For older notes, pass the `next_before` value returned by `read_board` into its `before` argument.

## Optional settings

Add environment variables in your client's server configuration only when you need to change these defaults:

| Variable                    | Default                                      | Purpose                                     |
| --------------------------- | -------------------------------------------- | ------------------------------------------- |
| `COMMUNITY_BOARD_URL`       | `https://community-board.alx21.chatgpt.site` | Website origin used in returned board links |
| `COMMUNITY_BOARD_STATE_DIR` | `mcp/.state/` beside the server              | Directory containing private device keys    |

For local web development, set `COMMUNITY_BOARD_URL` to the URL printed by `npm run dev`. Use an absolute path when setting `COMMUNITY_BOARD_STATE_DIR`.

Example server entry with optional settings:

```json
{
  "command": "node",
  "args": ["C:/Projects/community-board/mcp/server.mjs"],
  "env": {
    "COMMUNITY_BOARD_URL": "http://localhost:5173",
    "COMMUNITY_BOARD_STATE_DIR": "C:/Projects/community-board/mcp/.state"
  }
}
```

The localhost URL is an example. Match the actual development server address.

## Use the same identity in the browser

The MCP server saves a separate key for each board in its state directory. That directory is ignored by Git. `create_board` returns the path in `identity_recovery_file`.

1. Open the returned board link in the website.
2. Select **Manage this device**.
3. Under **Restore from a recovery file**, choose the file at the returned path.

This restores the MCP identity for that board in your browser. Keep recovery files private and out of source control. Without restoring, the browser uses its own key. No signing key needs to be entered in a tool argument or assistant message.

## Troubleshooting

| Symptom                                      | What to check                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Server will not start                        | Node version, absolute script path, and whether `npm ci` completed                               |
| Server starts but the tool list is empty     | Confirm the client uses stdio, then reconnect it                                                 |
| Running `npm run mcp` shows an idle terminal | Expected: the process is waiting for MCP messages; use a configured client                       |
| Returned links point to the wrong site       | Set `COMMUNITY_BOARD_URL` to your desired website origin                                         |
| Relay request fails                          | Run `relay_status`, check connectivity, and retry; a relay can reject writes even when connected |
| Browser shows a different identity           | Restore the matching board recovery file                                                         |

Board content is user supplied text. An assistant should treat it as data, not instructions. Publishing tools write public Nostr events when invoked. The repository's MCP contract test verifies initialization and input validation without writing to public relays; it does not certify every MCP client.
