import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, rmdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { stateDirectory } from "../mcp/state-dir.mjs";

test("new defaults stay outside the checkout and existing identities keep their location", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "community-board-state-path-"));
  const legacy = path.join(temp, "checkout", "mcp", ".state");
  const home = path.join(temp, "home");
  const root = path.join(temp, "checkout");
  try {
    await mkdir(root, { recursive: true });
    await mkdir(home, { recursive: true });
    assert.equal(await stateDirectory({ legacy, home, root }), path.join(home, ".community-board", "mcp"));
    await assert.rejects(stateDirectory({ legacy, home: root, root }), /inside the checkout/);
    await mkdir(legacy, { recursive: true });
    assert.equal(await stateDirectory({ legacy, home, root }), legacy);
    assert.equal(await stateDirectory({ override: "relative-override", legacy, home, root }), "relative-override");
  } finally {
    const relative = path.relative(os.tmpdir(), temp);
    assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    await rm(temp, { recursive: true, force: true });
  }
});

test("an invalid legacy path fails instead of silently choosing a new identity", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "community-board-state-error-"));
  try {
    const legacy = path.join(temp, "legacy");
    await writeFile(legacy, "synthetic");
    await assert.rejects(stateDirectory({ legacy, home: temp }), /not a directory/);
  } finally {
    const relative = path.relative(os.tmpdir(), temp);
    assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    await rm(temp, { recursive: true, force: true });
  }
});

test("a dangling legacy link does not silently select a new identity", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "community-board-state-link-"));
  try {
    const legacy = path.join(temp, "legacy");
    const missing = path.join(temp, "missing");
    await mkdir(missing);
    await symlink(missing, legacy, "junction");
    await rmdir(missing);
    await assert.rejects(stateDirectory({ legacy, home: temp }), { code: "ENOENT" });
  } finally {
    const relative = path.relative(os.tmpdir(), temp);
    assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    await rm(temp, { recursive: true, force: true });
  }
});

test("a default state junction into the checkout is rejected", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "community-board-state-junction-"));
  try {
    const root = path.join(temp, "checkout");
    const home = path.join(temp, "home");
    const destination = path.join(root, "public", "state");
    await mkdir(destination, { recursive: true });
    await mkdir(home, { recursive: true });
    await symlink(destination, path.join(home, ".community-board"), "junction");
    await assert.rejects(stateDirectory({ legacy: path.join(root, "missing-legacy"), home, root }), /inside the checkout/);
  } finally {
    const relative = path.relative(os.tmpdir(), temp);
    assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    await rm(temp, { recursive: true, force: true });
  }
});
