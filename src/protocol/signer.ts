import { schnorrSignDigest } from '@cashu/cashu-ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import type { BlindedOutput } from '../domain/models';
import type { QuoteSigner } from './client';

const TAG = utf8ToBytes('Cashu_MintQuoteSig_v1');

function amountBytes(amount: number): Uint8Array {
  let value = BigInt(amount);
  if (value < 0n) throw new Error('Negative output amount.');
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  return Uint8Array.from(bytes);
}

// NUT-20 v1 transcript, as cashu-ts 4.13.1 builds it internally. Its public signMintQuote
// still signs the legacy concatenated hex, which this mint does not accept.
export function mintQuoteDigest(quoteId: string, outputs: Pick<BlindedOutput, 'amount' | 'B_'>[]): Uint8Array {
  const hash = sha256.create().update(TAG);
  const frame = (bytes: Uint8Array) => {
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, bytes.length);
    hash.update(length).update(bytes);
  };
  frame(utf8ToBytes(quoteId));
  for (const output of outputs) {
    frame(amountBytes(output.amount));
    frame(hexToBytes(output.B_));
  }
  return hash.digest();
}

export interface StopList {
  has(quoteId: string): boolean;
  add(quoteId: string): void;
}

// A stop only prevents new signatures from this key. One already released stays valid at the mint.
export function createQuoteSigner(secretKey: Uint8Array, pubkey: string, owns: (quoteId: string) => boolean,
  stops: StopList = new Set<string>()): QuoteSigner {
  return {
    pubkey,
    async signQuote(quoteId, outputs) {
      if (!owns(quoteId)) throw new Error('This key does not own that quote.');
      if (stops.has(quoteId)) throw new Error('New approvals for this deposit are stopped on this device.');
      return schnorrSignDigest(mintQuoteDigest(quoteId, outputs), secretKey);
    },
    // Minting a quote into the owner's own outputs is not an approval, so a stop does not block it.
    async signOwnMint(quoteId, outputs) {
      if (!owns(quoteId)) throw new Error('This key does not own that quote.');
      return schnorrSignDigest(mintQuoteDigest(quoteId, outputs), secretKey);
    },
    async stopNewApprovals(quoteId) {
      stops.add(quoteId);
    },
    approvalsStopped: quoteId => stops.has(quoteId),
  };
}
