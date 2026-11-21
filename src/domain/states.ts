import type { Campaign, CampaignState, Deposit, MoneyState } from './models';

export const stateCopy: Record<MoneyState, { word: string; icon: string; sentence: string }> = {
  deposited: { word: 'Deposited', icon: 'tray-down', sentence: 'Deposited at mint; not paid to creator.' },
  ready: { word: 'Ready', icon: 'three-line-bracket', sentence: 'Ready for each backer to approve.' },
  approved: { word: 'Approved', icon: 'pen-nib', sentence: 'Approved; reclaim can still race payout.' },
  'paying out': { word: 'Paying out', icon: 'clock', sentence: 'Paying out; checking the mint result.' },
  paid: { word: 'Paid', icon: 'circle-check', sentence: 'Paid to the creator; confirmed by the mint.' },
  reclaiming: { word: 'Reclaiming', icon: 'counterclockwise-arrow', sentence: 'Reclaiming; payout may still win if approval was released.' },
  reclaimed: { word: 'Reclaimed', icon: 'tray-left', sentence: 'Reclaimed to your outputs; confirmed by the mint.' },
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
