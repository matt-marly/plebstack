import { createHash } from 'node:crypto';
import { schnorrSignDigest } from '@cashu/cashu-ts';

// Amended NUT-20 transcript, also used for NUT-29. The v4.13.1 public
// signMintQuote helper uses legacy bytes; wallet internals use these bytes.
export function signQuote(key, quote, outputs) {
  const hash = createHash('sha256');
  hash.update('Cashu_MintQuoteSig_v1');
  const frame = bytes => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    hash.update(length);
    hash.update(bytes);
  };
  frame(Buffer.from(quote, 'utf8'));
  for (const output of outputs) {
    const value = BigInt(output.amount);
    if (value < 0n) throw new Error('Negative output');
    let hex = value === 0n ? '' : value.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    frame(Buffer.from(hex, 'hex'));
    frame(Buffer.from(output.B_, 'hex'));
  }
  return schnorrSignDigest(new Uint8Array(hash.digest()), key);
}
