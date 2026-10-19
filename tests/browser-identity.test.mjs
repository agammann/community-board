import assert from "node:assert/strict";
import test from "node:test";
import { hex, secret } from "../lib/nostr-board.ts";
import {
  identityStatus,
  openIdentity,
  recoverLockedIdentity,
  replaceIdentity,
} from "../lib/browser-identity.ts";

const board = "a".repeat(64);
const passphrase = "test-only-long-device-passphrase";

function storage() {
  const values = new Map();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, String(value)),
    removeItem: (name) => values.delete(name),
    values,
  };
}

test("new identity is encrypted at rest, unlocks only with its passphrase, and survives reload", async () => {
  const device = storage();
  const created = await openIdentity(device, board, passphrase);
  assert.equal(identityStatus(device, board), "locked");
  assert.equal(device.getItem(`cb_key_${board}`), null);
  assert(!device.getItem(`cb_vault_${board}`).includes(hex(created.key)));
  await assert.rejects(openIdentity(device, board, "incorrect passphrase"), /Passphrase is incorrect/);
  const reopened = await openIdentity(device, board, passphrase);
  assert.equal(hex(reopened.key), hex(created.key));
});

test("legacy key migrates without changing identity and is removed only after verified encryption", async () => {
  const device = storage();
  const original = secret();
  device.setItem(`cb_key_${board}`, hex(original));
  assert.equal(identityStatus(device, board), "protect");
  await assert.rejects(openIdentity(device, board, "short"), /at least 12/);
  assert.equal(device.getItem(`cb_key_${board}`), hex(original));
  const migrated = await openIdentity(device, board, passphrase);
  assert.equal(hex(migrated.key), hex(original));
  assert.equal(device.getItem(`cb_key_${board}`), null);
  assert.equal(hex((await openIdentity(device, board, passphrase)).key), hex(original));
});

test("failed encrypted write leaves the legacy key available for a later retry", async () => {
  const device = storage();
  const original = secret();
  device.setItem(`cb_key_${board}`, hex(original));
  const setItem = device.setItem;
  device.setItem = (name, value) => {
    if (name === `cb_vault_${board}`) throw Error("Storage unavailable");
    setItem(name, value);
  };
  await assert.rejects(openIdentity(device, board, passphrase), /Storage unavailable/);
  assert.equal(device.getItem(`cb_key_${board}`), hex(original));
  assert.equal(device.getItem(`cb_vault_${board}`), null);
});

test("interrupted migration keeps the old identity and refuses conflicting saved keys", async () => {
  const device = storage();
  const original = secret();
  device.setItem(`cb_key_${board}`, hex(original));
  const migrated = await openIdentity(device, board, passphrase);
  device.setItem(`cb_key_${board}`, hex(original));
  assert.equal(hex((await openIdentity(device, board, passphrase)).key), hex(original));
  assert.equal(device.getItem(`cb_key_${board}`), null);
  device.setItem(`cb_key_${board}`, hex(secret()));
  await assert.rejects(openIdentity(device, board, passphrase), /Two different saved identities/);
  assert.equal(hex(migrated.key), hex(original));
  assert(device.getItem(`cb_key_${board}`));
});

test("restores a recovery identity without writing cleartext and rejects wrong-board vault copies", async () => {
  const device = storage();
  const created = await openIdentity(device, board, passphrase);
  const recovered = secret();
  await replaceIdentity(device, created, recovered);
  assert.equal(device.getItem(`cb_key_${board}`), null);
  assert.equal(hex((await openIdentity(device, board, passphrase)).key), hex(recovered));
  const otherBoard = "b".repeat(64);
  device.setItem(`cb_vault_${otherBoard}`, device.getItem(`cb_vault_${board}`));
  await assert.rejects(openIdentity(device, otherBoard, passphrase), /incorrect or saved identity data is damaged/);
});

test("recovery file can reset a forgotten passphrase only through explicit replacement", async () => {
  const device = storage();
  await openIdentity(device, board, passphrase);
  const recovered = secret();
  const newPassphrase = "another-long-test-passphrase";
  await recoverLockedIdentity(device, board, newPassphrase, recovered);
  await assert.rejects(openIdentity(device, board, passphrase), /Passphrase is incorrect/);
  assert.equal(hex((await openIdentity(device, board, newPassphrase)).key), hex(recovered));
  assert.equal(device.getItem(`cb_key_${board}`), null);
});
