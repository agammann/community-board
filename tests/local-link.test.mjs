import assert from "node:assert/strict";
import { test } from "node:test";
import { localLinkTarget, unsafeWindowsSegment } from "../scripts/local-link.mjs";

test("network and device link text is rejected without accessing a target", () => {
  for (const link of ["\\\\host\\share\\item", "\\\\?\\UNC\\host\\share\\item", "\\\\.\\device", "//host/share/item", "\\??\\device"]) {
    assert.throws(() => localLinkTarget(link, "win32"), /not allowed/);
  }
  assert.equal(localLinkTarget("\\\\?\\C:\\safe\\item", "win32"), "C:\\safe\\item");
  assert.equal(localLinkTarget("../safe/item", "win32"), "../safe/item");
  assert.throws(() => localLinkTarget("//host/share", "linux"), /not allowed/);
  assert.equal(localLinkTarget("/tmp/safe", "linux"), "/tmp/safe");
});

test("ambiguous Windows file segments are rejected without filesystem access", () => {
  assert.equal(unsafeWindowsSegment("a.json::$DATA"), true);
  assert.equal(unsafeWindowsSegment("ABCDEF~1.JSO"), true);
  assert.equal(unsafeWindowsSegment("ordinary.json"), false);
  assert.equal(unsafeWindowsSegment("safe~name.json"), false);
});
