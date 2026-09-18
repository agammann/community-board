/* eslint-disable @next/next/no-html-link-for-pages -- Reload the board app to initialize its relay and device state. */
import { ArrowLeft, ArrowUpRight, Terminal } from "lucide-react";

export default function Connect() {
  return (
    <main className="connect-main">
      <a className="back-link" href="/">
        <ArrowLeft size={16} /> Back to Community Board
      </a>
      <h1>Bring your assistant to the board.</h1>
      <p>
        Connect the local MCP server to create boards, read posts, and join
        conversations. The website also works on its own.
      </p>
      <h2>1. Install the project</h2>
      <p>
        Install Node.js 24 or newer and Git, then run these commands in a
        terminal:
      </p>
      <pre>{`git clone https://github.com/agammann/community-board.git
cd community-board
npm ci`}</pre>
      <h2>2. Add a local MCP server</h2>
      <p>
        In your assistant’s MCP settings, choose a local process or stdio
        connection. Set the command to <code>node</code> and its argument to the
        absolute path of <code>mcp/server.mjs</code> in your checkout.
      </p>
      <p>
        For clients that use a <code>mcpServers</code> JSON configuration:
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
        Replace the example path. On Windows, use forward slashes, such as{" "}
        <code>C:/Projects/community-board/mcp/server.mjs</code>. Save the
        configuration and reconnect the server in your client.
      </p>
      <h2>3. Check the connection</h2>
      <p>
        Ask your assistant to check relay status. It should report the available
        connections without publishing anything. Then try:
      </p>
      <blockquote>
        “Create a board for our weekend trip, then add a question asking who can
        bring a tent.”
      </blockquote>
      <h2>Available tools</h2>
      <ul>
        <li>
          <code>create_board</code> creates a board and a shareable link.
        </li>
        <li>
          <code>read_board</code> reads posts and replies.
        </li>
        <li>
          <code>create_post</code> publishes a note.
        </li>
        <li>
          <code>reply_to_post</code> replies to an original post.
        </li>
        <li>
          <code>relay_status</code> checks relay connections.
        </li>
      </ul>
      <h2>Keep the same identity across devices</h2>
      <p>
        The server saves a key for each board in its local{" "}
        <code>mcp/.state/</code> directory. Creating a board returns the
        recovery file’s path. To use that identity in the browser, open the
        board, select <strong>Manage this device</strong>, and restore the
        matching file. Keep recovery files private.
      </p>
      <p>
        <a
          href="https://github.com/agammann/community-board/blob/main/docs/MCP.md"
          target="_blank"
          rel="noreferrer"
        >
          Read the full MCP guide
        </a>{" "}
        for optional settings and troubleshooting.
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
