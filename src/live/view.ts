import {
  closeOf, isPending, maintainerOf, people, sats, type CampaignRecord, type LogEntry, type SavedOperation, type Slot, type World,
} from '../demo/world';
import type { DepositState } from '../domain/models';
import type { QuoteState } from '../protocol/mint';
import type { Board, BoardCampaign } from './board';

export function boardWorld(board: Board, viewerId: string, notice = '', now = new Date()): World {
  return { viewerId, notice, campaigns: board.list().map(entry => campaignRecord(entry, now)) };
}

// Each slot's state comes from what the mint answered, in the order it answered. A released
// signature stops counting once a quote in its batch is gone: after a confirmed reclaim or a rejected batch.
// Past the close with fewer than three in, collecting stops: the record reads as stopped from then on.
export function campaignRecord(entry: BoardCampaign, now = new Date()): CampaignRecord {
  const { campaign, creatorId, maintainerId, maintainerName, key, closesAt, createdAt, events } = entry;
  const maintainer = maintainerOf({ maintainerId, maintainerName });
  const organizer = people[creatorId];
  const each = sats(campaign.contributionSat);
  const totalSat = campaign.contributionSat * campaign.backerCount;
  const slots: Slot[] = campaign.depositIds.map(id => ({ id }));
  const log: LogEntry[] = [{ at: createdAt, text: `${organizer.short} opened the stack for ${maintainer.short}: three plebs, ${each} each.` }];
  const operations: SavedOperation[] = [];
  const paid = new Set<string>();
  const released = new Set<string>();
  const stopped = new Set<string>();
  const mintStates = new Map<string, QuoteState>();
  let broken = false;
  let collectionStopped = false;
  let stoppedAt: string | undefined;

  const slotOf = (personId: string) => slots.find(slot => slot.backerId === personId);
  const short = (personId: string) => people[personId]?.short ?? personId;
  const payoutWas = (status: SavedOperation['status']) => operations.some(op => op.kind === 'payout' && op.status === status);

  for (const event of events) {
    const add = (text: string) => log.push({ at: event.at, text });
    switch (event.type) {
      case 'joined': {
        const open = slots.find(slot => !slot.backerId);
        if (!open || slotOf(event.personId)) break;
        Object.assign(open, { backerId: event.personId, quote: event.quote });
        add(`${short(event.personId)} made a deposit invoice for ${each}.`);
        break;
      }
      case 'deposited': {
        const slot = slotOf(event.personId);
        if (!slot || slot.quote?.id !== event.quote.id) break;
        slot.quote = event.quote;
        slot.inAt = event.at;
        paid.add(slot.id);
        add(`${short(event.personId)} stacked ${sats(event.quote.amountSat)} at the mint.`);
        if (paid.size === slots.length) add('All three deposits are in. Each pleb checks the outputs and signs.');
        break;
      }
      case 'released': {
        const slot = slotOf(event.personId);
        if (!slot) break;
        if (!broken) released.add(slot.id);
        slot.signedAt = event.at;
        add(`${short(event.personId)} signed.`);
        break;
      }
      case 'stopped': {
        const slot = slotOf(event.personId);
        if (slot) stopped.add(slot.id);
        add(`${short(event.personId)} stopped signing on their device.`);
        break;
      }
      case 'collection-stopped':
        collectionStopped = true;
        stoppedAt = event.at;
        add(`${organizer.short} stopped collecting.`);
        break;
      case 'sent': {
        const payout = event.kind === 'payout';
        const slot = slotOf(event.personId);
        if (!payout && !slot) break;
        operations.push({
          id: event.operationId, kind: event.kind, slotIds: payout ? slots.map(other => other.id) : [slot!.id],
          savedBy: event.personId, amountSat: payout ? totalSat : campaign.contributionSat, savedAt: event.at, status: 'dispatched',
          ...(event.keysetId ? { keysetId: event.keysetId } : {}),
        });
        add(payout ? 'All three signed. One batch sent to the mint.' : `${short(event.personId)} asked the mint for their own ${each} back.`);
        break;
      }
      case 'settled': {
        const at = operations.findIndex(op => op.id === event.operationId);
        if (at < 0) break;
        const op = operations[at];
        if (event.status === 'not-sent') {
          operations.splice(at, 1);
          break;
        }
        for (const [quoteId, state] of Object.entries(event.quoteStates ?? {})) mintStates.set(quoteId, state);
        const repeat = event.status === 'unresolved' && op.status === 'unresolved';
        operations[at] = { ...op, status: event.status, ...(event.status === 'unresolved' ? {} : { settledAt: event.at }) };
        if (repeat) break;
        const who = short(op.savedBy);
        if (op.kind === 'payout') {
          if (event.status === 'confirmed') add(`The mint confirmed the batch: ${sats(totalSat)} issued to ${maintainer.short}’s key.`);
          else if (event.status === 'rejected') add(`The mint rejected the payout batch (${event.reason}). Nothing was paid.`);
          else add('No answer from the mint for the payout. The request is saved; the result is unknown until the mint is asked again.');
          if (event.status === 'rejected') broken = true;
        } else {
          if (event.status === 'confirmed') add(`The mint confirmed ${who}’s reclaim: ${each} minted to their own outputs.`);
          else if (event.status === 'rejected') {
            add(payoutWas('confirmed') ? `${who}’s reclaim was rejected. The payout got there first.` : `The mint rejected ${who}’s reclaim (${event.reason}).`);
          } else add(`No answer from the mint for ${who}’s reclaim. The request is saved.`);
          if (event.status === 'confirmed') broken = true;
        }
        if (broken) released.clear();
        break;
      }
      case 'package': case 'delivered':
        break;
    }
  }

  const payoutConfirmed = payoutWas('confirmed');
  const payoutPending = operations.some(op => op.kind === 'payout' && isPending(op));
  for (const slot of slots) {
    if (!slot.quote || !paid.has(slot.id)) continue;
    const reclaims = operations.filter(op => op.kind === 'reclaim' && op.slotIds.includes(slot.id));
    let state: DepositState = 'deposited';
    if (reclaims.some(op => op.status === 'confirmed')) state = 'reclaimed';
    else if (payoutConfirmed) state = 'paid';
    else if (reclaims.some(isPending)) state = 'reclaiming';
    else if (payoutPending && released.has(slot.id)) state = 'paying out';
    else if (released.has(slot.id)) state = 'approved';
    const issued = state === 'paid' || state === 'reclaimed';
    const quote = { ...slot.quote, mintState: issued ? 'ISSUED' as const : mintStates.get(slot.quote.id) ?? slot.quote.mintState };
    slot.quote = quote;
    slot.deposit = {
      id: slot.id, campaignId: campaign.id, quote, state, authorizationReleased: state === 'paid' || released.has(slot.id),
      newApprovalsStopped: stopped.has(slot.id),
    };
  }

  const record: CampaignRecord = {
    campaign: { ...campaign, collectionStopped },
    creatorId,
    maintainerId,
    maintainerName,
    keyBy: key.by,
    closesAt,
    slots,
    outputsVerified: paid.size === slots.length && !broken,
    operations,
    log,
    mintFavours: 'creator',
    ...(stoppedAt ? { stoppedAt } : {}),
  };
  record.close = closeOf(record, now);
  if (record.close === 'closed') record.campaign = { ...record.campaign, collectionStopped: true };
  return record;
}
