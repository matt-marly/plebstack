import {
  Amount, OutputData, hasValidDleq, hashToCurve, pointFromHex, schnorrVerifyDigest, signP2PKProof, type Proof,
} from '@cashu/cashu-ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import type {
  Authorization, BatchPlan, BlindedOutput, IssuedProof, MintUrl, OutputConstruction, PublicKeyset,
} from '../domain/models';
import { mintQuoteDigest } from './signer';

const G = pointFromHex('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');

export type PackageCheck =
  | 'campaign' | 'mint' | 'outputs' | 'blinded-message' | 'amount' | 'lock' | 'tags' | 'keyset'
  | 'foreign-quote' | 'not-owner' | 'stopped' | 'released';

export class PackageError extends Error {
  constructor(readonly check: PackageCheck, message: string) {
    super(message);
    this.name = 'PackageError';
  }
}

export interface PackageTerms {
  campaignId: string;
  mint: MintUrl;
  beneficiaryPubkey: string;
  totalSat: number;
  keysetId: string;
  quoteId?: string;
  ownerPubkey?: string;
}

export function construction(data: OutputData): OutputConstruction {
  return {
    message: { amount: Number(data.blindedMessage.amount.toBigInt()), id: data.blindedMessage.id, B_: data.blindedMessage.B_ },
    secretHex: bytesToHex(data.secret),
    blindingFactorHex: data.blindingFactor.toString(16).padStart(64, '0'),
  };
}

// No refund key or locktime: once issued, only the beneficiary's key can spend these.
export function payoutOutputs(beneficiaryPubkey: string, totalSat: number, keyset: PublicKeyset): OutputConstruction[] {
  return OutputData.createP2PKData({ pubkey: beneficiaryPubkey, blindKeys: false }, totalSat, keyset).map(construction);
}

export function messages(outputs: OutputConstruction[]): BlindedOutput[] {
  return outputs.map(({ message }) => ({ amount: message.amount, id: message.id, B_: message.B_ }));
}

export function sameOutputs(a: BlindedOutput[], b: BlindedOutput[]): boolean {
  return a.length === b.length && a.every((output, i) => output.amount === b[i].amount && output.id === b[i].id && output.B_ === b[i].B_);
}

export function outputsDigest(outputs: BlindedOutput[]): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(outputs.map(({ amount, id, B_ }) => [amount, id, B_])))));
}

// B_ = hash_to_curve(secret) + r*G, computed here rather than trusted from the package.
export function rederive(output: OutputConstruction): string | undefined {
  try {
    const r = BigInt('0x' + output.blindingFactorHex);
    return hashToCurve(hexToBytes(output.secretHex)).add(G.multiply(r)).toHex(true);
  } catch {
    return undefined;
  }
}

function p2pkLock(secret: string): { data: unknown; tags: unknown } | undefined {
  try {
    const parsed = JSON.parse(secret) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 || parsed[0] !== 'P2PK') return undefined;
    const body = parsed[1] as { data?: unknown; tags?: unknown };
    return typeof body === 'object' && body !== null ? { data: body.data, tags: body.tags } : undefined;
  } catch {
    return undefined;
  }
}

function lockProblem(secret: string, beneficiaryPubkey: string, n: number): PackageError | undefined {
  const lock = p2pkLock(secret);
  if (!lock || lock.data !== beneficiaryPubkey) return new PackageError('lock', `Output ${n} is not locked to the maintainer’s key.`);
  if (!Array.isArray(lock.tags) || lock.tags.length > 0) return new PackageError('tags', `Output ${n} carries extra spending conditions.`);
  return undefined;
}

function secretText(hex: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(hexToBytes(hex));
  } catch {
    return '';
  }
}

export function verifyPackage(plan: BatchPlan, terms: PackageTerms): BlindedOutput[] {
  if (plan.campaignId !== terms.campaignId) throw new PackageError('campaign', 'This payout is for a different campaign.');
  if (plan.mint !== terms.mint) throw new PackageError('mint', 'This payout names a different mint.');
  if (plan.beneficiaryPubkey !== terms.beneficiaryPubkey) throw new PackageError('lock', 'This payout names a different maintainer key.');
  if (plan.keyset.id !== terms.keysetId) throw new PackageError('keyset', 'This payout uses a keyset that is not the mint’s active sat keyset.');
  if (plan.outputs.length === 0) throw new PackageError('outputs', 'This payout has no outputs.');

  let sum = 0;
  for (const [i, output] of plan.outputs.entries()) {
    const n = i + 1;
    const { amount, id, B_ } = output.message;
    if (id !== terms.keysetId) throw new PackageError('keyset', `Output ${n} uses keyset ${id}, not the mint’s active ${terms.keysetId}.`);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new PackageError('amount', `Output ${n} has an invalid amount.`);
    if (rederive(output) !== B_) throw new PackageError('blinded-message', `Output ${n} does not match its disclosed secret and blinding factor.`);
    const problem = lockProblem(secretText(output.secretHex), terms.beneficiaryPubkey, n);
    if (problem) throw problem;
    sum += amount;
  }
  if (sum !== terms.totalSat || plan.totalSat !== terms.totalSat) {
    throw new PackageError('amount', `The outputs add up to ${sum} sats; the campaign total is ${terms.totalSat}.`);
  }

  if (new Set(plan.quoteIds).size !== plan.quoteIds.length || plan.ownerPubkeys.length !== plan.quoteIds.length) {
    throw new PackageError('foreign-quote', 'The deposit list repeats a quote or is incomplete.');
  }
  if (terms.quoteId !== undefined) {
    const at = plan.quoteIds.indexOf(terms.quoteId);
    if (at < 0) throw new PackageError('foreign-quote', 'This payout does not include your deposit.');
    if (plan.ownerPubkeys[at] !== terms.ownerPubkey) throw new PackageError('foreign-quote', 'This payout lists your deposit under another key.');
  }
  return messages(plan.outputs);
}

export function planTerms(plan: BatchPlan): PackageTerms {
  return {
    campaignId: plan.campaignId, mint: plan.mint, beneficiaryPubkey: plan.beneficiaryPubkey,
    totalSat: plan.totalSat, keysetId: plan.keyset.id,
  };
}

export function authorizationProblem(plan: BatchPlan, authorizations: Authorization[]): string | undefined {
  if (authorizations.length !== plan.quoteIds.length) return `Expected ${plan.quoteIds.length} approvals, got ${authorizations.length}.`;
  const outputs = messages(plan.outputs);
  for (const [i, authorization] of authorizations.entries()) {
    const n = i + 1;
    if (authorization.quoteId !== plan.quoteIds[i]) return `Approval ${n} is for a different deposit or out of order.`;
    if (!sameOutputs(authorization.outputs, outputs)) return `Approval ${n} covers different outputs.`;
    let valid = false;
    try {
      valid = typeof authorization.signature === 'string'
        && schnorrVerifyDigest(authorization.signature, mintQuoteDigest(authorization.quoteId, outputs), plan.ownerPubkeys[i]);
    } catch { /* malformed signature or key */ }
    if (!valid) return `Approval ${n} is not signed by that deposit’s key.`;
  }
  return undefined;
}

function issued(proof: Proof): IssuedProof {
  return {
    amount: proof.amount.toNumber(), id: proof.id, secret: proof.secret, C: proof.C,
    ...(proof.dleq ? { dleq: { e: proof.dleq.e, s: proof.dleq.s, r: proof.dleq.r ?? '' } } : {}),
  };
}

// Unblinds each signature for its output in order, checking amount, keyset and DLEQ when present.
export function issuedProofs(outputs: OutputConstruction[], keyset: PublicKeyset, answer: unknown): IssuedProof[] {
  const signatures = (answer as { signatures?: unknown } | null)?.signatures;
  if (!Array.isArray(signatures) || signatures.length !== outputs.length) {
    throw new Error(`The mint returned ${Array.isArray(signatures) ? signatures.length : 'no'} signatures for ${outputs.length} outputs.`);
  }
  return outputs.map((output, i) => {
    const n = i + 1;
    const signature = signatures[i] as { amount?: unknown; id?: unknown; C_?: unknown; dleq?: { e: string; s: string } };
    if (signature?.amount !== output.message.amount || signature.id !== keyset.id || typeof signature.C_ !== 'string') {
      throw new Error(`Signature ${n} does not match output ${n}.`);
    }
    const data = new OutputData(
      { amount: Amount.from(output.message.amount), id: output.message.id, B_: output.message.B_ },
      BigInt('0x' + output.blindingFactorHex), hexToBytes(output.secretHex),
    );
    const proof = data.toProof({
      id: signature.id, amount: Amount.from(signature.amount), C_: signature.C_, ...(signature.dleq ? { dleq: signature.dleq } : {}),
    }, keyset);
    if (signature.dleq && !hasValidDleq(proof, keyset)) throw new Error(`Signature ${n} carries an invalid DLEQ proof.`);
    return issued(proof);
  });
}

// Throws unless every signature unblinds to a proof for the planned output, locked to the beneficiary.
export function payoutProofs(plan: Pick<BatchPlan, 'outputs' | 'keyset' | 'beneficiaryPubkey' | 'totalSat'>, answer: unknown): IssuedProof[] {
  const proofs = issuedProofs(plan.outputs, plan.keyset, answer);
  for (const [i, proof] of proofs.entries()) {
    const problem = lockProblem(proof.secret, plan.beneficiaryPubkey, i + 1);
    if (problem) throw problem;
  }
  const total = proofs.reduce((sum, proof) => sum + proof.amount, 0);
  if (total !== plan.totalSat) throw new Error(`The proofs add up to ${total} sats, not ${plan.totalSat}.`);
  return proofs;
}

// The pubkey a saved payout locks to, read back from its first output.
export function lockedTo(outputs: OutputConstruction[]): string | undefined {
  const data = outputs[0] && p2pkLock(secretText(outputs[0].secretHex))?.data;
  return typeof data === 'string' ? data : undefined;
}

export function inputFee(count: number, inputFeePpk: number): number {
  return Math.ceil(count * inputFeePpk / 1000);
}

// NUT-11 witnesses go over the wire as JSON strings; the SDK hands back an object.
export function signLockedProof(proof: IssuedProof, secretKey: Uint8Array): IssuedProof {
  const signed = signP2PKProof({ ...proof, amount: Amount.from(proof.amount) }, secretKey);
  const witness = typeof signed.witness === 'string' ? signed.witness : JSON.stringify(signed.witness);
  return { ...proof, witness };
}
