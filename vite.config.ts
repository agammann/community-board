import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const managedLinux = readExecutionProfile() === "managed-linux";
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
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
