import { createRoot } from "react-dom/client";
import BoardApp from "../app/board-app";
import "../app/globals.css";

// Full document navigation still initializes a fresh relay/device session.
const match = /^\/b\/([^/]+)$/.exec(location.pathname);
const boardId = match ? decodeURIComponent(match[1]) : undefined;
createRoot(document.getElementById("community-root")!).render(
  <BoardApp boardId={boardId} />,
);
