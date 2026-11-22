import { Amount, getEncodedToken } from '@cashu/cashu-ts';
import { findCampaign, isPending, people, sats, slotOf, slugify, statusOf, type CampaignDraft } from '../demo/world';
import { TEST_MINT, type BatchPlan, type Campaign, type LockedQuote, type Settlement } from '../domain/models';
import { PackageError } from '../protocol/batch';
import { NOT_SAVED, ProtocolError, type BatchReview, type CampaignTerms, type WaitOptions } from '../protocol/client';
import type { QuoteState } from '../protocol/mint';
import { StorageError } from '../protocol/storage';
import { formatWhen } from '../ui/format';
import { createActors, type Actors } from './actors';
import type { BoardCampaign, BoardEvent } from './board';
import { boardWorld } from './view';

export interface LiveReview extends BatchReview {
  quoteStates: QuoteState[];
}

function terms(campaign: Campaign): CampaignTerms {
  const { id, mint, beneficiaryPubkey, backerCount, contributionSat } = campaign;
  return { id, mint, beneficiaryPubkey, backerCount, contributionSat };
}

// A write this browser must make before anything goes to the mint.
function beforeSending<T>(write: () => T): T {
  try {
    return write();
  } catch (error) {
    throw new ProtocolError('storage', NOT_SAVED, { cause: error });
  }
}

type EventOf<T extends BoardEvent['type']> = Extract<BoardEvent, { type: T }>;

function lastOf<T extends BoardEvent['type']>(entry: BoardCampaign, type: T, match: (event: EventOf<T>) => boolean = () => true) {
  return entry.events.filter((event): event is EventOf<T> => event.type === type).filter(match).pop();
}

export function createLiveActions(actors: Actors, now = () => new Date()) {
  const { board, coordinator } = actors;
  const at = () => now().toISOString();

  function entry(campaignId: string): BoardCampaign {
    const found = board.get(campaignId);
    if (!found) throw new Error(`No campaign ${campaignId}.`);
    return found;
  }

  function record(campaignId: string, personId: string) {
    return findCampaign(boardWorld(board, personId), campaignId)!;
  }

  // Paid quotes in slot order, which is join order.
  function paidQuotes(current: BoardCampaign): LockedQuote[] {
    return current.events.flatMap(event => event.type === 'joined'
      ? lastOf(current, 'deposited', paid => paid.quote.id === event.quote.id)?.quote ?? [] : []);
  }

  function ownQuote(current: BoardCampaign, personId: string): LockedQuote {
    const quote = lastOf(current, 'deposited', event => event.personId === personId)?.quote;
    if (!quote) throw new ProtocolError('unknown-quote', 'You have no deposit in this campaign.');
    return quote;
  }

  function joinedTerms(personId: string, campaignId: string): CampaignTerms {
    const saved = actors.notes(personId).read<CampaignTerms>(`terms:${campaignId}`);
    if (!saved) throw new PackageError('campaign', 'This browser has no record of the terms you joined on.');
    return saved;
  }

  async function ensurePackage(current: BoardCampaign): Promise<BatchPlan> {
    const published = lastOf(current, 'package')?.plan;
    if (published) return published;
    const plan = await coordinator.preparePayout(terms(current.campaign), paidQuotes(current));
    board.append(current.campaign.id, { type: 'package', at: at(), plan });
    return plan;
  }

  function settle(campaignId: string, operationId: string, status: EventOf<'settled'>['status'],
    extra: { reason?: string; quoteStates?: Record<string, QuoteState> } = {}) {
    board.append(campaignId, { type: 'settled', at: at(), operationId, status, ...extra });
  }

  async function settlePayout(campaignId: string, personId: string, settlement: Settlement): Promise<string> {
    const { campaign, creatorId } = entry(campaignId);
    const maintainer = people[creatorId];
    const totalSat = campaign.contributionSat * campaign.backerCount;
    if (settlement.kind === 'confirmed') {
      settle(campaignId, settlement.operationId, 'confirmed');
      return `Stacked. Paid. ${sats(totalSat)} from 3 plebs to ${maintainer.name}. Confirmed by the mint at ${formatWhen(at())}.`;
    }
    if (settlement.kind === 'pending') {
      settle(campaignId, settlement.operationId, 'unresolved');
      return 'Still waiting for the mint. The request is saved. Nothing is paid until the mint confirms.';
    }
    // Which deposits are still at the mint decides who goes back to Deposited.
    const quoteIds = paidQuotes(entry(campaignId)).map(quote => quote.id);
    const states = await coordinator.checkQuotes(campaign.mint, quoteIds).catch(() => undefined);
    const quoteStates = states && Object.fromEntries(quoteIds.map((id, i) => [id, states[i]]));
    settle(campaignId, settlement.operationId, 'rejected', { reason: settlement.reason, ...(quoteStates ? { quoteStates } : {}) });
    const own = slotOf(record(campaignId, personId), personId);
    const stillThere = own?.quote && quoteStates?.[own.quote.id] === 'PAID';
    return `The payout was rejected. Nothing was paid to ${maintainer.short}.${stillThere ? ` Your ${sats(campaign.contributionSat)} are still at the mint.` : ''}`;
  }

  function settleReclaim(campaignId: string, settlement: Settlement): string {
    const { campaign, creatorId } = entry(campaignId);
    const each = sats(campaign.contributionSat);
    const before = record(campaignId, creatorId).operations;
    if (settlement.kind === 'confirmed') {
      settle(campaignId, settlement.operationId, 'confirmed');
      return before.some(op => op.kind === 'payout' && isPending(op))
        ? `Your reclaim got there first. ${each} minted to your own outputs.` : `Back to you. ${each} minted to your own outputs.`;
    }
    if (settlement.kind === 'pending') {
      settle(campaignId, settlement.operationId, 'unresolved');
      return 'Still waiting for the mint. The request is saved. Check again asks the mint about the same request.';
    }
    settle(campaignId, settlement.operationId, 'rejected', { reason: settlement.reason });
    return before.some(op => op.kind === 'payout' && op.status === 'confirmed')
      ? `The payout got there first. Your ${each} went to ${people[creatorId].short}. Your reclaim was rejected.`
      : `The mint rejected your reclaim (${settlement.reason}).`;
  }

  // If even this write fails, the board shows the request as sent until Check again finds it was never saved.
  function notSent(campaignId: string, operationId: string, error: unknown) {
    try {
      settle(campaignId, operationId, 'not-sent', { reason: (error as Error).message });
    } catch { /* the original failure is the one to report */ }
  }

  // A request this browser never saved was never sent; the board drops it.
  async function recovered(campaignId: string, operationId: string, recover: () => Promise<Settlement>) {
    try {
      return await recover();
    } catch (error) {
      if (error instanceof ProtocolError && error.kind === 'unknown-operation') settle(campaignId, operationId, 'not-sent');
      throw error;
    }
  }

  return {
    world: (viewerId: string, notice = '') => boardWorld(board, viewerId, notice),

    maintainerKey: (personId: string) => actors.person(personId).enrollMaintainer(personId),

    createCampaign(personId: string, draft: CampaignDraft): string {
      const base = slugify(draft.title);
      let id = base;
      for (let n = 2; board.get(id); n += 1) id = `${base}-${n}`;
      beforeSending(() => board.create({
        campaign: {
          id, title: draft.title.trim(), publicWorkUrl: draft.publicWorkUrl.trim(), mint: TEST_MINT,
          beneficiaryPubkey: draft.beneficiaryPubkey.trim(), backerCount: 3, contributionSat: draft.contributionSat,
          collectionStopped: false, depositIds: ['backer-1', 'backer-2', 'backer-3'],
        },
        creatorId: personId, createdAt: at(), events: [],
      }));
      return id;
    },

    async join(personId: string, campaignId: string): Promise<LockedQuote> {
      const { campaign, creatorId } = entry(campaignId);
      const current = record(campaignId, personId);
      if (personId === creatorId || slotOf(current, personId) || statusOf(current) !== 'collecting'
        || !current.slots.some(slot => !slot.backerId)) {
        throw new Error('This campaign has no open slot for you.');
      }
      const client = actors.person(personId);
      // Each backer gets a key per campaign, so one key never links a person's deposits across campaigns.
      const ownerPubkey = client.enrollKey(`backer:${campaignId}:${personId}`);
      beforeSending(() => actors.notes(personId).write(`terms:${campaignId}`, terms(campaign)));
      const quote = await client.createQuote({ mint: campaign.mint, amountSat: campaign.contributionSat, ownerPubkey });
      board.append(campaignId, { type: 'joined', at: at(), personId, quote });
      return quote;
    },

    async waitForDeposit(personId: string, campaignId: string, quoteId: string, options: WaitOptions): Promise<string> {
      const paid = await actors.person(personId).waitForDeposit(quoteId, options);
      if (!lastOf(entry(campaignId), 'deposited', event => event.quote.id === quoteId)) {
        board.append(campaignId, { type: 'deposited', at: at(), personId, quote: paid });
      }
      const current = entry(campaignId);
      // The coordinator publishes the package as soon as all three are in; a backer's review asks again if this fails.
      if (paidQuotes(current).length === current.campaign.backerCount) await ensurePackage(current).catch(() => {});
      return `Stacked. ${sats(paid.amountSat)} at the mint, locked to your key.`;
    },

    async review(personId: string, campaignId: string): Promise<LiveReview> {
      const current = entry(campaignId);
      const quote = ownQuote(current, personId);
      const saved = joinedTerms(personId, campaignId);
      const plan = await ensurePackage(current);
      const client = actors.person(personId);
      const review = await client.reviewBatch(saved, plan, quote);
      const quoteStates = await client.checkQuotes(saved.mint, plan.quoteIds);
      if (quoteStates.some(state => state !== 'PAID')) {
        throw new ProtocolError('not-paid', `The mint reports ${quoteStates.join(', ')}: not every deposit in this payout is paid and unissued.`);
      }
      return { ...review, quoteStates };
    },

    async sign(personId: string, campaignId: string): Promise<{ notice: string; complete: boolean }> {
      const current = entry(campaignId);
      const quote = ownQuote(current, personId);
      const client = actors.person(personId);
      const authorization = await client.authorizeBatch(joinedTerms(personId, campaignId), await ensurePackage(current), quote,
        client.signerFor(quote.ownerPubkey));
      board.append(campaignId, { type: 'released', at: at(), personId, authorization });
      return { notice: 'Signed. You can’t take it back.', complete: statusOf(record(campaignId, personId)) === 'approved' };
    },

    async stopSigning(personId: string, campaignId: string): Promise<string> {
      const quote = ownQuote(entry(campaignId), personId);
      const signer = actors.person(personId).signerFor(quote.ownerPubkey);
      await signer.stopNewApprovals(quote.id).catch(error => beforeSending(() => { throw error; }));
      beforeSending(() => board.append(campaignId, { type: 'stopped', at: at(), personId }));
      return 'You stopped signing on this device. A signature you already released still counts.';
    },

    // Everything before the first await runs at once, so the board reads Paying out while the mint is asked.
    async payout(personId: string, campaignId: string): Promise<string> {
      const current = entry(campaignId);
      const plan = lastOf(current, 'package')?.plan;
      const authorizations = plan?.quoteIds.map(id => lastOf(current, 'released', event => event.authorization.quoteId === id)?.authorization);
      if (!plan || !authorizations || authorizations.some(authorization => !authorization)) {
        throw new ProtocolError('authorization', 'Not every deposit is signed yet.');
      }
      const operationId = `op-${crypto.randomUUID()}`;
      beforeSending(() => board.append(campaignId, {
        type: 'sent', at: at(), kind: 'payout', operationId, personId: current.creatorId, keysetId: plan.keyset.id,
      }));
      let settlement: Settlement;
      try {
        settlement = await coordinator.payout(plan, authorizations as NonNullable<(typeof authorizations)[number]>[], operationId);
      } catch (error) {
        notSent(campaignId, operationId, error);
        throw error;
      }
      return settlePayout(campaignId, personId, settlement);
    },

    async checkPayout(personId: string, campaignId: string, operationId: string): Promise<string> {
      return settlePayout(campaignId, personId, await recovered(campaignId, operationId, () => coordinator.recover(operationId)));
    },

    async reclaim(personId: string, campaignId: string): Promise<string> {
      const quote = ownQuote(entry(campaignId), personId);
      const client = actors.person(personId);
      if (!client.findDeposit(quote.id)) throw new ProtocolError('not-owner', 'This browser holds no key for that deposit.');
      const operationId = `op-${crypto.randomUUID()}`;
      beforeSending(() => board.append(campaignId, { type: 'sent', at: at(), kind: 'reclaim', operationId, personId }));
      let settlement: Settlement;
      try {
        settlement = await client.reclaim(quote.id, operationId);
      } catch (error) {
        notSent(campaignId, operationId, error);
        throw error;
      }
      return settleReclaim(campaignId, settlement);
    },

    async checkReclaim(personId: string, campaignId: string, operationId: string): Promise<string> {
      return settleReclaim(campaignId, await recovered(campaignId, operationId, () => actors.person(personId).recover(operationId)));
    },

    // The pleb's own ecash from a confirmed take-back, read from their own saved request, to paste into a wallet.
    async ecash(personId: string, campaignId: string): Promise<string | undefined> {
      const op = record(campaignId, personId).operations
        .find(saved => saved.kind === 'reclaim' && saved.savedBy === personId && saved.status === 'confirmed');
      if (!op) return undefined;
      const settlement = await actors.person(personId).recover(op.id);
      if (settlement.kind !== 'confirmed' || settlement.proofs.length === 0) return undefined;
      return getEncodedToken({
        mint: entry(campaignId).campaign.mint, unit: 'sat',
        proofs: settlement.proofs.map(proof => ({ ...proof, amount: Amount.from(proof.amount) })),
      });
    },

    stopCollecting(personId: string, campaignId: string): string {
      if (entry(campaignId).creatorId !== personId) throw new Error('Only the organizer can stop collecting.');
      beforeSending(() => board.append(campaignId, { type: 'collection-stopped', at: at() }));
      return 'Collecting stopped. Signatures already released still count.';
    },

    abandonUnanswered() {
      for (const personId of Object.keys(people)) {
        try {
          actors.person(personId).abandonUnanswered();
        } catch {
          // No storage at all: the next live request reports it before anything is sent.
        }
      }
    },
  };
}

export type LiveActions = ReturnType<typeof createLiveActions>;

export const liveActions = createLiveActions(createActors({ storage: () => globalThis.localStorage }));

export function failureCopy(error: unknown): string {
  if (error instanceof StorageError) return 'Couldn’t save on this device.';
  if (error instanceof PackageError) return `These outputs don’t match the campaign. Don’t sign. ${error.message}`;
  if (!(error instanceof ProtocolError)) return error instanceof Error ? error.message : 'Something went wrong in this browser.';
  switch (error.kind) {
    case 'not-locked': return 'The mint’s answer wasn’t locked to your key, so it was set aside. Don’t pay any invoice from it. Nothing is stacked.';
    case 'issued-early': return 'The mint says this quote was already issued, but nothing was issued from this browser. It isn’t counted as stacked.';
    case 'timeout': return 'The mint hasn’t reported this invoice paid yet. Not stacked until it does.';
    case 'mint': return 'Couldn’t get an answer from the mint. Nothing changed.';
    default: return error.message;
  }
}
