import { hex, secret } from "./nostr-board.ts";

const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const vaultName = (boardId: string) => `cb_vault_${boardId}`;
const legacyName = (boardId: string) => `cb_key_${boardId}`;

type Vault = {
  version: 1;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type IdentitySession = {
  boardId: string;
  key: Uint8Array;
  wrappingKey: CryptoKey;
  salt: string;
};

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function bytes(value: string, length: number): Uint8Array {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw Error("Saved identity data is damaged. Restore a recovery file.");
  const decoded = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  if (decoded.length !== length || base64(decoded) !== value)
    throw Error("Saved identity data is damaged. Restore a recovery file.");
  return decoded;
}

function parseVault(value: string): Vault {
  let data: Vault;
  try {
    data = JSON.parse(value);
  } catch {
    throw Error("Saved identity data is damaged. Restore a recovery file.");
  }
  if (
    data?.version !== 1 ||
    data.iterations !== ITERATIONS ||
    typeof data.ciphertext !== "string" ||
    data.ciphertext.length > 256
  )
    throw Error("Saved identity data is damaged. Restore a recovery file.");
  bytes(data.salt, 16);
  bytes(data.iv, 12);
  bytes(data.ciphertext, 48);
  return data;
}

async function derive(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (passphrase.length > 1024) throw Error("Passphrase is too long.");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function decrypt(vault: Vault, boardId: string, wrappingKey: CryptoKey) {
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(vault.iv, 12) as BufferSource,
        additionalData: encoder.encode(boardId),
      },
      wrappingKey,
      bytes(vault.ciphertext, 48) as BufferSource,
    );
    return secret(hex(new Uint8Array(plain)));
  } catch {
    throw Error("Passphrase is incorrect or saved identity data is damaged.");
  }
}

async function encrypt(key: Uint8Array, boardId: string, wrappingKey: CryptoKey, salt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(boardId) },
    wrappingKey,
    key as BufferSource,
  );
  return JSON.stringify({
    version: 1,
    iterations: ITERATIONS,
    salt,
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(ciphertext)),
  } satisfies Vault);
}

export function identityStatus(storage: Storage, boardId: string) {
  if (storage.getItem(vaultName(boardId))) return "locked" as const;
  if (storage.getItem(legacyName(boardId))) return "protect" as const;
  return "new" as const;
}

export async function openIdentity(storage: Storage, boardId: string, passphrase: string, initialKey?: Uint8Array) {
  const saved = storage.getItem(vaultName(boardId));
  const legacy = storage.getItem(legacyName(boardId));
  if (initialKey && (saved || legacy)) throw Error("An identity already exists for this board.");
  if (!saved && passphrase.length < 12)
    throw Error("Use a passphrase of at least 12 characters.");
  if (saved) {
    const vault = parseVault(saved);
    const wrappingKey = await derive(passphrase, bytes(vault.salt, 16));
    const key = await decrypt(vault, boardId, wrappingKey);
    if (legacy) {
      if (hex(secret(legacy)) !== hex(key))
        throw Error("Two different saved identities were found. Save a recovery file before continuing.");
      storage.removeItem(legacyName(boardId));
      if (storage.getItem(legacyName(boardId)))
        throw Error("Could not remove the old unprotected identity. Check browser storage settings.");
    }
    return { boardId, key, wrappingKey, salt: vault.salt } satisfies IdentitySession;
  }
  const key = initialKey ? secret(hex(initialKey)) : (legacy ? secret(legacy) : secret());
  const salt = base64(crypto.getRandomValues(new Uint8Array(16)));
  const wrappingKey = await derive(passphrase, bytes(salt, 16));
  const serialized = await encrypt(key, boardId, wrappingKey, salt);
  storage.setItem(vaultName(boardId), serialized);
  const verified = await decrypt(parseVault(storage.getItem(vaultName(boardId)) || ""), boardId, wrappingKey);
  if (hex(verified) !== hex(key)) throw Error("Could not verify the saved identity.");
  if (legacy) {
    storage.removeItem(legacyName(boardId));
    if (storage.getItem(legacyName(boardId)))
      throw Error("Could not remove the old unprotected identity. Check browser storage settings.");
  }
  return { boardId, key, wrappingKey, salt } satisfies IdentitySession;
}

export async function replaceIdentity(storage: Storage, session: IdentitySession, key: Uint8Array) {
  const name = vaultName(session.boardId);
  const prior = storage.getItem(name);
  if (!prior) throw Error("Saved identity is missing. Restore a recovery file.");
  const serialized = await encrypt(key, session.boardId, session.wrappingKey, session.salt);
  try {
    storage.setItem(name, serialized);
    const verified = await decrypt(parseVault(storage.getItem(name) || ""), session.boardId, session.wrappingKey);
    if (hex(verified) !== hex(key)) throw Error("Could not verify the restored identity.");
  } catch (error) {
    storage.setItem(name, prior);
    throw error;
  }
  session.key = key;
}

export async function recoverLockedIdentity(
  storage: Storage,
  boardId: string,
  passphrase: string,
  key: Uint8Array,
) {
  if (passphrase.length < 12) throw Error("Use a passphrase of at least 12 characters.");
  const name = vaultName(boardId);
  const prior = storage.getItem(name);
  if (!prior) throw Error("No locked identity was found for this board.");
  const legacy = storage.getItem(legacyName(boardId));
  if (legacy && hex(secret(legacy)) !== hex(key))
    throw Error("A different older identity is also present. Save its recovery key before replacing it.");
  const salt = base64(crypto.getRandomValues(new Uint8Array(16)));
  const wrappingKey = await derive(passphrase, bytes(salt, 16));
  const serialized = await encrypt(key, boardId, wrappingKey, salt);
  try {
    storage.setItem(name, serialized);
    const verified = await decrypt(parseVault(storage.getItem(name) || ""), boardId, wrappingKey);
    if (hex(verified) !== hex(key)) throw Error("Could not verify the restored identity.");
  } catch (error) {
    storage.setItem(name, prior);
    throw error;
  }
  if (legacy) {
    storage.removeItem(legacyName(boardId));
    if (storage.getItem(legacyName(boardId)))
      throw Error("Could not remove the old unprotected identity. Check browser storage settings.");
  }
  return { boardId, key, wrappingKey, salt } satisfies IdentitySession;
}
