import type {
  Authorization, BatchPlan, BlindedOutput, LockedQuote, MintUrl,
  OutputConstruction, RecoveryOperation, Settlement,
} from '../domain/models';

// A signer owns its private key; the coordinator receives signatures and public material only.
export interface QuoteSigner {
  readonly pubkey: string;
  signQuote(quoteId: string, outputs: BlindedOutput[]): Promise<string>;
  stopNewApprovals(quoteId: string): Promise<void>;
  approvalsStopped(quoteId: string): boolean;
}

export interface RecoveryStore {
  saveBeforeDispatch(operation: RecoveryOperation): Promise<void>;
  get(operationId: string): Promise<RecoveryOperation | undefined>;
  listUnresolved(): Promise<RecoveryOperation[]>;
  saveResult(operation: RecoveryOperation): Promise<void>;
}

export interface ProtocolClient {
  createQuote(request: { mint: MintUrl; amountSat: number; ownerPubkey: string }): Promise<LockedQuote>;
  authorizeBatch(plan: BatchPlan, quote: LockedQuote, signer: QuoteSigner): Promise<Authorization>;
  payout(plan: BatchPlan, authorizations: [Authorization, Authorization, Authorization], operation: RecoveryOperation): Promise<Settlement>;
  reclaim(quote: LockedQuote, outputs: OutputConstruction[], signer: QuoteSigner, operation: RecoveryOperation): Promise<Settlement>;
  recover(operation: RecoveryOperation): Promise<Settlement>;
}

function unavailable(): never {
  throw new Error('Protocol integration is not connected in this scaffold.');
}

export const protocol: ProtocolClient = {
  createQuote: async () => unavailable(),
  authorizeBatch: async () => unavailable(),
  payout: async () => unavailable(),
  reclaim: async () => unavailable(),
  recover: async () => unavailable(),
};
