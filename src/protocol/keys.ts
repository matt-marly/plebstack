import { createRandomSecretKey, getPubKeyFromPrivKey, pointFromHex } from '@cashu/cashu-ts';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { RecordStore } from './storage';

// Stored only in the owner's own browser. Nothing outside this module reads secretKey.
interface KeyRecord {
  pubkey: string;
  secretKey: string;
  createdAt: string;
}

interface OwnerRecord {
  pubkey: string;
}

export function isValidPubkey(value: string): boolean {
  if (!/^0[23][0-9a-f]{64}$/.test(value)) return false;
  try {
    pointFromHex(value).assertValidity();
    return true;
  } catch {
    return false;
  }
}

export function hasKey(store: RecordStore, pubkey: string): boolean {
  return store.read<KeyRecord>(`key:${pubkey}`) !== undefined;
}

export function secretKeyFor(store: RecordStore, pubkey: string): Uint8Array | undefined {
  const record = store.read<KeyRecord>(`key:${pubkey}`);
  return record && hexToBytes(record.secretKey);
}

// Returns the owner's compressed pubkey, creating and saving a key the first time.
export function ensureKey(store: RecordStore, owner: string, now = new Date()): string {
  const existing = store.read<OwnerRecord>(`owner:${owner}`);
  if (existing && hasKey(store, existing.pubkey)) return existing.pubkey;
  const secretKey = createRandomSecretKey();
  const pubkey = bytesToHex(getPubKeyFromPrivKey(secretKey));
  store.write<KeyRecord>(`key:${pubkey}`, { pubkey, secretKey: bytesToHex(secretKey), createdAt: now.toISOString() });
  store.write<OwnerRecord>(`owner:${owner}`, { pubkey });
  return pubkey;
}

// The maintainer's key is made the same way; only the pubkey leaves for Campaign.beneficiaryPubkey.
export function enrollMaintainer(store: RecordStore, owner: string, now = new Date()): string {
  const pubkey = ensureKey(store, `maintainer:${owner}`, now);
  if (!isValidPubkey(pubkey)) throw new Error('The maintainer key is not a valid compressed public key.');
  return pubkey;
}
