import { lstat, mkdir, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep an existing checkout-local identity in place; never silently create a
// different identity just because the default for new installations changed.
export async function stateDirectory({ override, legacy, home, root } = {}) {
  if (override) return override;
  const old = legacy ?? fileURLToPath(new URL("./.state/", import.meta.url));
  let existing;
  try { existing = await lstat(old); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (existing) {
    const info = await stat(old);
    if (!info.isDirectory()) throw Error("Existing Community Board state path is not a directory.");
    return old;
  }
  const actualHome = await realpath(home ?? os.homedir());
  const project = await realpath(root ?? fileURLToPath(new URL("../", import.meta.url)));
  const compare = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  const target = path.join(actualHome, ".community-board", "mcp");
  const requireOutside = (candidate) => {
    const relative = path.relative(compare(project), compare(candidate));
    if (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
      throw Error("Community Board's default state directory resolves inside the checkout. Set COMMUNITY_BOARD_STATE_DIR to a private directory outside it.");
    }
  };
  let ancestor = target;
  while (true) {
    try { await lstat(ancestor); break; }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const resolvedAncestor = await realpath(ancestor);
  requireOutside(path.resolve(resolvedAncestor, path.relative(ancestor, target)));
  await mkdir(target, { recursive: true, mode: 0o700 });
  requireOutside(await realpath(target));
  return target;
}
