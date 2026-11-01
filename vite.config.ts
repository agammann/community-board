import path from "node:path";
import { lstat, readdir, readlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { localLinkTarget, unsafeWindowsSegment } from "./scripts/local-link.mjs";
import { sites } from "./build/sites-vite-plugin.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const managedLinux = readExecutionProfile() === "managed-linux";
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const keyFile = /^[a-f0-9]{64}\.json$/i;
const comparable = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
const inside = (base: string, value: string) => {
  const relative = path.relative(comparable(base), comparable(value));
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};

// Resolve each link only after checking its literal target. This avoids
// following a request or public-asset link to an untrusted network path.
async function resolveInRoots(input: string, roots: string[]): Promise<string | undefined> {
  let target = path.resolve(input);
  const allowed = roots.map((base) => path.resolve(base));
  for (let hops = 0; hops <= 32; hops++) {
    const base = allowed.filter((item) => inside(item, target)).sort((a, b) => a.length - b.length)[0];
    if (!base) throw Error("A file link points outside the allowed development or public asset directories.");
    const parts = path.relative(base, target).split(path.sep).filter(Boolean);
    let current = base;
    let followed = false;
    for (let index = 0; index < parts.length; index++) {
      if (process.platform === "win32" && unsafeWindowsSegment(parts[index])) throw Error("Ambiguous Windows file paths are not allowed.");
      current = path.join(current, parts[index]);
      let info;
      try { info = await lstat(current); }
      catch (error) {
        if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return undefined;
        throw error;
      }
      if (!info.isSymbolicLink()) continue;
      const link = localLinkTarget(await readlink(current));
      target = path.resolve(path.dirname(current), link, ...parts.slice(index + 1));
      if (!allowed.some((item) => inside(item, target))) throw Error("A file link points outside the allowed development or public asset directories.");
      followed = true;
      break;
    }
    if (!followed) return current;
  }
  throw Error("A file link contains a cycle or too many links.");
}

async function checkPublicAssets() {
  const publicDir = path.join(root, "public");
  const publicRoot = await resolveInRoots(publicDir, [root]);
  if (!publicRoot) return;
  const walk = async (dir: string, ancestors: Set<string>): Promise<void> => {
    if (ancestors.has(comparable(dir))) throw Error("A public asset link contains a directory cycle.");
    const nextAncestors = new Set(ancestors).add(comparable(dir));
    for (const entry of await readdir(dir)) {
      const item = path.join(dir, entry);
      if (keyFile.test(entry)) throw Error("A private recovery file may be in public assets. Move recovery files outside the checkout before building.");
      const info = await lstat(item);
      if (info.isSymbolicLink()) {
        const target = await resolveInRoots(item, [publicRoot]);
        if (!target) throw Error("A public asset link has a missing target.");
        if (keyFile.test(path.basename(target))) throw Error("A public asset link points to a private recovery file.");
        if ((await lstat(target)).isDirectory()) await walk(target, nextAncestors);
      } else if (info.isDirectory()) await walk(item, nextAncestors);
    }
  };
  await walk(publicRoot, new Set());
}

// Recovery files are named by public board IDs. Guard them even when an MCP
// process uses a different in-root override or Vite's public directory.
function privateRecoveryFiles() {
  const legacy = path.resolve(root, "mcp", ".state");
  return {
    name: "private-recovery-files",
    enforce: "pre" as const,
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        let pathname: string;
        try { pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname); }
        catch { res.statusCode = 400; res.end(); return; }
        if (pathname.includes("\0")) { res.statusCode = 400; res.end(); return; }
        const rawFs = pathname.startsWith("/@fs/");
        const raw = rawFs ? pathname.slice(5) : pathname.replace(/^\/+/, "");
        const candidates = rawFs ? [path.resolve(raw)] : [path.resolve(root, raw), path.resolve(root, "public", raw)];
        if (pathname.startsWith("/@/")) candidates.push(path.resolve(root, pathname.slice(3)));
        for (const candidate of candidates) {
          if (keyFile.test(path.basename(candidate)) || inside(legacy, candidate)) {
            res.statusCode = 403; res.end(); return;
          }
          // Do not probe arbitrary filesystem or network paths before Vite's
          // own allow-list has had a chance to reject them.
          const roots = [server.config.root, ...server.config.server.fs.allow];
          if (!roots.some((base) => inside(base, candidate))) continue;
          try {
            const target = await resolveInRoots(candidate, roots);
            if (target && (keyFile.test(path.basename(target)) || inside(legacy, target))) {
              res.statusCode = 403; res.end(); return;
            }
          } catch (error) {
            if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
              res.statusCode = 403; res.end(); return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(async ({ command }) => {
  if (command === "build") await checkPublicAssets();
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    resolve: { alias: { "@": root } },
    server: {
      port: 5173,
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      watch: {
        ignored: ["**/.sites-runtime/**", "**/.wrangler/**"],
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      },
    },
    environments: {
      client: { build: {
        outDir: "dist/client",
        rolldownOptions: { input: { home: path.join(root, "index.html"), connect: path.join(root, "connect/index.html") } },
      } },
      server: { build: { outDir: "dist/server", rolldownOptions: { output: { entryFileNames: "index.js" } } } },
    },
    plugins: [
      privateRecoveryFiles(),
      react(),
      sites({ mockAuth: false }),
      cloudflare({
        viteEnvironment: { name: "server" }, inspectorPort: false, remoteBindings: false,
        config: {
          name: "community-board", main: "./worker/index.ts", compatibility_date: "2026-10-01",
          compatibility_flags: ["nodejs_compat"],
          assets: { binding: "ASSETS", run_worker_first: false, html_handling: "auto-trailing-slash", not_found_handling: "none" },
        },
      }),
    ],
  };
});
