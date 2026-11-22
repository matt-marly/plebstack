export const TEST_MINT = 'https://testnut.cashudevkit.org' as const;
export type MintUrl = typeof TEST_MINT;
export type MoneyState = 'deposited' | 'ready' | 'approved' | 'paying out' | 'paid' | 'reclaiming' | 'reclaimed';
export type DepositState = Exclude<MoneyState, 'ready'>;
export type CampaignState = MoneyState | 'collecting' | 'unmet';

export interface Campaign {
  id: string;
  title: string;
  publicWorkUrl: string;
  mint: MintUrl;
  beneficiaryPubkey: string;
  backerCount: 3;
  contributionSat: number;
  collectionStopped: boolean;
  depositIds: string[];
}

export interface LockedQuote {
  id: string;
  mint: MintUrl;
  ownerPubkey: string;
  amountSat: number;
  invoice: string;
  mintState: 'UNPAID' | 'PAID' | 'ISSUED';
}

export interface Deposit {
  id: string;
  campaignId: string;
  quote: LockedQuote;
  state: DepositState;
  authorizationReleased: boolean;
  newApprovalsStopped: boolean;
}

export interface BlindedOutput {
  amount: number;
  id: string;
  B_: string;
}

export interface OutputConstruction {
  message: BlindedOutput;
  secretHex: string;
  blindingFactorHex: string;
}

export interface PublicKeyset {
  id: string;
  unit: 'sat';
  inputFeePpk: number;
  keys: Record<string, string>;
}

// Public material only: anyone holding it can re-derive every blinded message, nobody can spend with it.
export interface BatchPlan {
  campaignId: string;
  mint: MintUrl;
  beneficiaryPubkey: string;
  quoteIds: [string, string, string];
  ownerPubkeys: [string, string, string];
  keyset: PublicKeyset;
  outputs: OutputConstruction[];
  totalSat: number;
}

export interface Authorization {
  quoteId: string;
  signature: string;
  outputs: BlindedOutput[];
}

export interface IssuedProof {
  amount: number;
  id: string;
  secret: string;
  C: string;
  witness?: string;
  dleq?: { e: string; s: string; r: string };
}

// ISSUED alone does not identify the destination of an issuance.
export type Settlement =
  | { kind: 'pending'; operationId: string }
  | { kind: 'confirmed'; operationId: string; destination: 'creator' | 'owner'; proofs: IssuedProof[] }
  | { kind: 'rejected'; operationId: string; reason: string };

// rejected: the mint answered with a Cashu error, so nothing was issued and nothing needs recovering.
export type OperationStatus = 'prepared' | 'dispatched' | 'unresolved' | 'confirmed' | 'rejected';

export interface RecoveryOperation {
  version: 1;
  id: string;
  // swap: the maintainer spending the locked payout into her own unlocked ecash.
  kind: 'payout' | 'reclaim' | 'swap';
  mint: MintUrl;
  quoteIds: string[];
  outputs: OutputConstruction[];
  keysetId: string;
  requestBody: string;
  createdAt: string;
  status: OperationStatus;
  dispatchedAt?: string;
  settledAt?: string;
  reason?: string;
  response?: string;
  proofs?: IssuedProof[];
}
