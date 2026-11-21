import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createRandomSecretKey, getPubKeyFromPrivKey, schnorrVerifyDigest } from '@cashu/cashu-ts';
import { bytesToHex } from '@noble/hashes/utils.js';
import { createQuoteSigner, mintQuoteDigest } from '../src/protocol/signer';
import { signQuote as nodeSignQuote } from '../scripts/quote-signature.mjs';

type Output = { amount: number; B_: string };

// Written from the NUT-20 v1 description, not from the browser port.
function nodeDigest(quoteId: string, outputs: Output[]): string {
  const hash = createHash('sha256');
  hash.update(Buffer.from('Cashu_MintQuoteSig_v1', 'ascii'));
  const frame = (bytes: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    hash.update(Buffer.concat([length, bytes]));
  };
  frame(Buffer.from(quoteId, 'utf8'));
  for (const { amount, B_ } of outputs) {
    let hex = amount === 0 ? '' : BigInt(amount).toString(16);
    if (hex.length % 2) hex = '0' + hex;
    frame(Buffer.from(hex, 'hex'));
    frame(Buffer.from(B_, 'hex'));
  }
  return hash.digest('hex');
}

const point = (n: number) => '02' + n.toString(16).padStart(2, '0').repeat(32);

const vectors: { name: string; quote: string; outputs: Output[] }[] = [
  { name: 'no outputs', quote: '01a1d22d-7261-7257-b127-0a87a8f6c7e2', outputs: [] },
  { name: 'amount 0', quote: 'q', outputs: [{ amount: 0, B_: point(1) }] },
  { name: 'one-byte amounts', quote: '01a1d22d-a16a-77e9-a90a-bffe0b79af0b', outputs: [16, 4, 1].map((amount, i) => ({ amount, B_: point(i + 2) })) },
  { name: 'multi-byte amounts', quote: 'quote-ü-✓', outputs: [256, 65535, 65536, 2 ** 40 + 7].map((amount, i) => ({ amount, B_: point(i + 9) })) },
];

test('browser digest matches an independent node:crypto transcript', () => {
  for (const { name, quote, outputs } of vectors) {
    assert.equal(bytesToHex(mintQuoteDigest(quote, outputs)), nodeDigest(quote, outputs), name);
  }
});

test('amount frames are minimal big-endian, and zero is an empty frame', () => {
  const zero = mintQuoteDigest('q', [{ amount: 0, B_: '' }]);
  const tag = Buffer.from('Cashu_MintQuoteSig_v1');
  const expected = createHash('sha256').update(Buffer.concat([
    tag, Buffer.from([0, 0, 0, 1]), Buffer.from('q'), Buffer.from([0, 0, 0, 0]), Buffer.from([0, 0, 0, 0]),
  ])).digest('hex');
  assert.equal(bytesToHex(zero), expected);
  assert.throws(() => mintQuoteDigest('q', [{ amount: -1, B_: '' }]), /Negative/);
});

test('browser signatures verify against the owner pubkey, as the Node helper does', async () => {
  const key = createRandomSecretKey();
  const pubkey = bytesToHex(getPubKeyFromPrivKey(key));
  const stranger = bytesToHex(getPubKeyFromPrivKey(createRandomSecretKey()));
  for (const { name, quote, outputs } of vectors) {
    const signer = createQuoteSigner(key, pubkey, id => id === quote);
    const blinded = outputs.map(output => ({ ...output, id: '00163d7a87ffcd92' }));
    const browser = await signer.signQuote(quote, blinded);
    const node = nodeSignQuote(key, quote, outputs);
    const digest = nodeDigest(quote, outputs);
    assert.ok(schnorrVerifyDigest(browser, digest, pubkey), name);
    assert.ok(schnorrVerifyDigest(node, bytesToHex(mintQuoteDigest(quote, outputs)), pubkey), name);
    assert.ok(!schnorrVerifyDigest(browser, digest, stranger), name);
    assert.ok(!schnorrVerifyDigest(browser, nodeDigest(quote + 'x', outputs), pubkey), name);
  }
});

test('a signature the test mint accepted in the kill test verifies against the browser digest', () => {
  const outputs = [
    { amount: 16, B_: '032d78ca0e1941724e3db09f376a785232718485c42c6b7746f1c81ed6242dc342' },
    { amount: 4, B_: '03758839ba57a00d09938d97b146ef74153ec8b538274801f45a7aa7c7bedd3110' },
    { amount: 1, B_: '03b8436f303a449ea5d55267ac65d2bd3ec96a1c178bb08762a42cf2a2f8bb768b' },
  ];
  const signature = 'fa64a303e89a03b86d05ce9c99f0abcfa2a8e96ed2bcb0d228fc0bd68321dbbaff85ee8d2ccd9e66dd9adbaf2b77900990eee73fba34a85229030216d4aacae2';
  const pubkey = '03267104b55454724d481196307969b37c420fd7bbadd70e59526d052501db4cfd';
  const digest = mintQuoteDigest('01a1d22d-a16a-77e9-a90a-bffe0b79af0b', outputs);
  assert.ok(schnorrVerifyDigest(signature, digest, pubkey));
});
