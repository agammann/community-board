import { ArrowLeft, ArrowUpRight, Terminal } from "lucide-react";
export default function Connect() {
  return (
    <main className="connect-main">
      <a className="back-link" href="/">
        <ArrowLeft size={16} /> Back to Community Board
      </a>
      <h1>
        Your assistant can
        <br />
        bring the group together.
      </h1>
      <p>
        The website works on its own. If you use an assistant that supports MCP,
        connect the local server to create boards, read posts, and join
        conversations.
      </p>
      <h2>Connect the MCP server</h2>
      <p>
        Download the source from GitHub, install Node.js 24 or newer, then run{" "}
        <code>npm ci</code> inside the project. Add this to your assistant’s MCP
        configuration, replacing the path with your project folder:
      </p>
      <pre>
        {JSON.stringify(
          {
            mcpServers: {
              "community-board": {
                command: "node",
                args: ["/absolute/path/to/community-board/mcp/server.mjs"],
              },
            },
          },
          null,
          2,
        )}
      </pre>
      <p>
        Use an absolute path. On Windows, forward slashes work in the
        configuration above.
      </p>
      <h2>Try asking</h2>
      <blockquote>
        “Create a board for our weekend trip, then add a post asking who can
        bring a tent.”
      </blockquote>
      <h2>Five focused tools</h2>
      <ul>
        <li>
          <code>create_board</code> creates a board and a shareable link.
        </li>
        <li>
          <code>read_board</code> reads posts and replies.
        </li>
        <li>
          <code>create_post</code> publishes a signed note.
        </li>
        <li>
          <code>reply_to_post</code> joins a conversation.
        </li>
        <li>
          <code>relay_status</code> checks relay connections.
        </li>
      </ul>
      <h2>Your identity stays local</h2>
      <p>
        The server saves a separate anonymous key for each board in its local{" "}
        <code>mcp/.state</code> directory. No account, API key, or paid AI
        service is needed. To manage an assistant created board in the browser,
        restore its local recovery file using “Manage this device” on the board.
      </p>
      <p>
        Board posts are public Nostr events. Your assistant only publishes when
        you ask it to. The website never needs an AI connection.
      </p>
      <a
        className="button primary"
        href="https://github.com/agammann/community-board"
        target="_blank"
        rel="noreferrer"
      >
        <Terminal size={17} /> Get the source <ArrowUpRight size={16} />
      </a>
    </main>
  );
}
