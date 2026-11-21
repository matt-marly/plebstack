import type { Campaign, CampaignState, Deposit, MoneyState } from './models';

// The campaign's maintainer and per-backer amount, so every sentence names who is paid and how much.
export interface StateTerms {
  maintainer: { name: string; short: string };
  amountSat: number;
}

export interface StateCopy {
  word: string;
  phrase: string;
  icon: string;
  sentence: (terms: StateTerms) => string;
}

const sats = (amount: number) => `${amount.toLocaleString('en')} ${amount === 1 ? 'sat' : 'sats'}`;

export const stateCopy: Record<MoneyState, StateCopy> = {
  deposited: { word: 'Deposited', phrase: 'Stacked', icon: 'tray-down',
    sentence: t => `${sats(t.amountSat)} at the mint, locked to your key. Not paid to ${t.maintainer.short}.` },
  ready: { word: 'Ready', phrase: 'At the line', icon: 'three-line-bracket',
    sentence: () => 'All three deposits are in. Each pleb checks the outputs and signs.' },
  approved: { word: 'Approved', phrase: 'Signed', icon: 'pen-nib',
    sentence: () => 'You signed. You can’t take it back. A reclaim can still race the payout.' },
  'paying out': { word: 'Paying out', phrase: 'Sending', icon: 'clock',
    sentence: () => 'Sent to the mint as one batch. Not paid until the mint confirms.' },
  paid: { word: 'Paid', phrase: 'Stacked. Paid.', icon: 'circle-check',
    sentence: t => `Paid to ${t.maintainer.name}. Confirmed by the mint.` },
  reclaiming: { word: 'Reclaiming', phrase: 'Unstacking', icon: 'counterclockwise-arrow',
    sentence: t => `Asking the mint for your own ${sats(t.amountSat)}. If you signed, the payout may still win.` },
  reclaimed: { word: 'Reclaimed', phrase: 'Back to you', icon: 'tray-left',
    sentence: t => `${sats(t.amountSat)} minted to your own outputs, as ecash at this mint. Confirmed by the mint.` },
};

// Only a mint-confirmed issuance may use a state colour that reads as settled.
export const confirmedStates: readonly MoneyState[] = ['paid', 'reclaimed'];

// Signal lime has one meaning: the mint confirmed the payout.
export const signalStates: readonly MoneyState[] = ['paid'];

export type DepositEvent =
  | { type: 'release-authorization' }
  | { type: 'submit-payout' }
  | { type: 'request-reclaim' }
  | { type: 'mint-confirmed'; destination: 'creator' | 'owner' }
  | { type: 'batch-rejected' }
  | { type: 'stop-local-approval' };

export function transitionDeposit(deposit: Deposit, event: DepositEvent): Deposit {
  if (event.type === 'stop-local-approval') return { ...deposit, newApprovalsStopped: true };
  if (deposit.state === 'paid' || deposit.state === 'reclaimed') {
    throw new Error('A confirmed issuance is terminal.');
  }
  switch (event.type) {
    case 'release-authorization':
      if (deposit.state !== 'deposited' || deposit.newApprovalsStopped) throw new Error('Deposit is not available for approval.');
      return { ...deposit, state: 'approved', authorizationReleased: true };
    case 'submit-payout':
      if (deposit.state !== 'approved') throw new Error('Approval is required before payout.');
      return { ...deposit, state: 'paying out' };
    case 'request-reclaim':
      return { ...deposit, state: 'reclaiming' };
    case 'batch-rejected':
      // Another owner's reclaim settled first, so the signed output set can never be issued.
      // The quote is still paid and unissued; a later batch needs a fresh review and signature.
      if (deposit.state !== 'approved' && deposit.state !== 'paying out') {
        throw new Error('Only an approved or submitted deposit can lose its batch.');
      }
      return { ...deposit, state: 'deposited', authorizationReleased: false };
    case 'mint-confirmed':
      if (event.destination === 'creator' && !deposit.authorizationReleased) {
        throw new Error('Creator issuance requires a released authorization.');
      }
      if (event.destination === 'owner' && deposit.state !== 'reclaiming') {
        throw new Error('Owner issuance requires a reclaim operation.');
      }
      // Only the adapter may emit this event, after matching and verifying saved outputs.
      return { ...deposit, state: event.destination === 'creator' ? 'paid' : 'reclaimed',
        quote: { ...deposit.quote, mintState: 'ISSUED' } };
  }
}

export function campaignState(campaign: Campaign, deposits: Deposit[], outputsVerified = false): CampaignState {
  const owned = deposits.filter(d => d.campaignId === campaign.id && campaign.depositIds.includes(d.id));
  const complete = owned.length === 3 && new Set(owned.map(d => d.quote.id)).size === 3;
  if (complete && owned.every(d => d.state === 'paid')) return 'paid';
  if (owned.length > 0 && owned.every(d => d.state === 'reclaimed')) return 'reclaimed';
  if (owned.some(d => d.state === 'reclaiming')) return 'reclaiming';
  if (owned.some(d => d.state === 'paying out')) return 'paying out';
  if (campaign.collectionStopped || owned.some(d => d.state === 'reclaimed')) return 'unmet';
  if (!complete || owned.some(d => d.quote.mint !== campaign.mint || d.quote.amountSat !== campaign.contributionSat
      || d.quote.mintState !== 'PAID')) return 'collecting';
  if (!outputsVerified) return 'collecting';
  if (owned.every(d => d.state === 'approved')) return 'approved';
  return 'ready';
}
