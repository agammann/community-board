import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.ts";

function assets() {
  const requests = [];
  const env = { ASSETS: { async fetch(request) {
    requests.push(request);
    const known = ["/", "/connect/"];
    return new Response(request.method === "HEAD" ? null : "asset response", {
      status: known.includes(new URL(request.url).pathname) ? 200 : 404,
    });
  } } };
  return { env, requests };
}

test("board deep links receive the shell without changing the visible route", async () => {
  for (const id of ["a".repeat(64), "invalid", "%E2%9C%93"]) {
    for (const method of ["GET", "HEAD"]) {
      const { env, requests } = assets();
      const response = await worker.fetch(new Request(`https://board.test/b/${id}`, { method }), env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Location"), null);
      assert.equal(requests.length, 1);
      assert.equal(new URL(requests[0].url).pathname, "/");
      assert.equal(requests[0].method, method);
    }
  }
});

test("static requests keep their identity and unknown routes stay missing", async () => {
  const { env, requests } = assets();
  for (const path of ["/", "/connect/", "/missing", "/api/missing", "/b/", "/b/one/two"]) {
    const request = new Request("https://board.test" + path);
    const response = await worker.fetch(request, env);
    assert.equal(requests.at(-1), request);
    assert.equal(response.status, ["/", "/connect/"].includes(path) ? 200 : 404);
  }
});

test("board canonical redirects retain the query; malformed URLs and writes stop before assets", async () => {
  const { env, requests } = assets();
  const redirect = await worker.fetch(new Request("https://board.test/b/example/?view=1"), env);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("Location"), "/b/example?view=1");
  assert.equal((await worker.fetch(new Request("https://board.test/b/%invalid"), env)).status, 400);
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const response = await worker.fetch(new Request("https://board.test/b/example", { method }), env);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "GET, HEAD");
  }
  assert.equal(requests.length, 0);
});
