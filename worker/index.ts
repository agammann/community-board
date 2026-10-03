type Environment = {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

const worker = {
  async fetch(request: Request, env: Environment): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    try {
      decodeURIComponent(url.pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const board = /^\/b\/([^/]+)(\/?)$/.exec(url.pathname);
    if (board) {
      if (board[2]) {
        return new Response(null, {
          status: 308,
          headers: { Location: `/b/${board[1]}${url.search}` },
        });
      }
      // Only a recognized board path receives the shared client shell. The
      // browser keeps /b/<id>, including its private recovery fragment.
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }
    // The asset service owns static canonical URLs and genuine missing pages.
    // There is no global SPA fallback and no application API.
    return env.ASSETS.fetch(request);
  },
};

export default worker;
