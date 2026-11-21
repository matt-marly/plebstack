import type { Campaign, LockedQuote } from '../domain/models';
import { ProtocolError, protocol, type WaitOptions } from '../protocol/client';

// Each backer gets a key per campaign, so one key never links a person's deposits across campaigns.
function owner(campaignId: string, personId: string): string {
  return `backer:${campaignId}:${personId}`;
}

export function abandonUnanswered() {
  try {
    protocol.abandonUnanswered();
  } catch {
    // No storage at all: the next live request reports it before anything is sent.
  }
}

export async function createLiveQuote(campaign: Campaign, personId: string): Promise<LockedQuote> {
  const ownerPubkey = protocol.enrollKey(owner(campaign.id, personId));
  return protocol.createQuote({ mint: campaign.mint, amountSat: campaign.contributionSat, ownerPubkey });
}

export function isLiveQuote(quoteId: string): boolean {
  try {
    return protocol.findDeposit(quoteId) !== undefined;
  } catch {
    return false;
  }
}

export function waitForLiveDeposit(quoteId: string, options: WaitOptions): Promise<LockedQuote> {
  return protocol.waitForDeposit(quoteId, options);
}

export function failureCopy(error: unknown): string {
  if (!(error instanceof ProtocolError)) return 'Something went wrong in this browser. Nothing is counted as deposited.';
  switch (error.kind) {
    case 'not-locked': return 'The mint’s answer wasn’t locked to your key, so it was set aside. Don’t pay any invoice from it. Nothing was deposited.';
    case 'issued-early': return 'The mint says this quote was already issued, but nothing was issued from this browser. It isn’t counted as a deposit.';
    case 'timeout': return 'The mint hasn’t reported this invoice paid yet. Nothing is counted until it does.';
    case 'mint': return 'Couldn’t get an answer from the mint. Nothing is counted as deposited.';
    default: return error.message;
  }
}
