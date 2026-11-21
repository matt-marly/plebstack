import assert from 'node:assert/strict';
import test from 'node:test';
import { matchPath } from 'react-router-dom';
import { beats, findBeat } from '../src/demo/beats';
import {
  MAIN_CAMPAIGN, RACE_CAMPAIGN, UNMET_CAMPAIGN, canApprove, checkMint, confirmDeposit, createCampaign, findCampaign,
  headline, initialWorld, latestOperation, pendingOperation, people, progressLine, recordSpend, releaseApproval,
  requestQuote, requestReclaim, rowSentence, sats, setViewer, slotOf, slotStatus, statusOf, stopApproval,
  stopCollecting, tally, termsOf, viewerStep, type World,
} from '../src/demo/world';
import { stateCopy } from '../src/domain/states';
import { routes } from '../src/routes';
import { formatClock, formatWhen, isCompressedPubkey, isHttpUrl, listNames, plural, setTimeZone, shortKey } from '../src/ui/format';

// Notices carry times; pin the zone so the expected text doesn't depend on the machine.
setTimeZone('UTC');

const at = (time: string) => `2026-11-13T${time}:00Z`;
const record = (world: World, id: string) => findCampaign(world, id)!;
const states = (world: World, id: string) => record(world, id).slots.map(slotStatus);
const as = (world: World, personId: string) => setViewer(world, personId);

function ready(): World {
  const joined = requestQuote(initialWorld(), MAIN_CAMPAIGN, at('14:02'));
  return confirmDeposit(joined, MAIN_CAMPAIGN, 'backer-3', at('14:03'));
}

function allApproved(): World {
  let world = releaseApproval(as(ready(), 'tobi'), MAIN_CAMPAIGN, 'backer-1', at('14:04'));
  world = releaseApproval(as(world, 'ishaan'), MAIN_CAMPAIGN, 'backer-3', at('14:05'));
  return releaseApproval(as(world, 'maren'), MAIN_CAMPAIGN, 'backer-2', at('14:06'));
}

test('the starting world holds one campaign of each kind', () => {
  const world = initialWorld();
  assert.equal(world.viewerId, 'ishaan');
  assert.equal(statusOf(record(world, MAIN_CAMPAIGN)), 'collecting');
  assert.deepEqual(states(world, MAIN_CAMPAIGN), ['deposited', 'deposited', 'open']);
  assert.equal(statusOf(record(world, UNMET_CAMPAIGN)), 'unmet');
  assert.deepEqual(states(world, UNMET_CAMPAIGN), ['deposited', 'deposited', 'open']);
  assert.equal(statusOf(record(world, RACE_CAMPAIGN)), 'paying out');
  assert.equal(pendingOperation(record(world, RACE_CAMPAIGN), 'payout')?.status, 'unresolved');
  assert.deepEqual(tally(record(world, MAIN_CAMPAIGN)), { held: 2, approvals: 0, heldSat: 42, targetSat: 63 });
});

test('joining takes the open slot, then the third deposit makes the campaign ready', () => {
  const joined = requestQuote(initialWorld(), MAIN_CAMPAIGN, at('14:02'));
  const slot = slotOf(record(joined, MAIN_CAMPAIGN), 'ishaan')!;
  assert.equal(slotStatus(slot), 'awaiting');
  assert.equal(slot.quote?.mintState, 'UNPAID');
  assert.equal(slot.quote?.ownerPubkey, people.ishaan.pubkey);
  assert.equal(slot.quote?.amountSat, 21);
  assert.equal(statusOf(record(joined, MAIN_CAMPAIGN)), 'collecting');
  assert.throws(() => requestQuote(joined, MAIN_CAMPAIGN, at('14:02')), /already holds a slot/);

  const world = ready();
  assert.equal(statusOf(record(world, MAIN_CAMPAIGN)), 'ready');
  assert.deepEqual(states(world, MAIN_CAMPAIGN), ['deposited', 'deposited', 'deposited']);
  assert.equal(world.notice, 'Stacked. 21 sats at the mint, locked to your key.');
  assert.throws(() => confirmDeposit(world, MAIN_CAMPAIGN, 'backer-3', at('14:03')));
});

test('a deposit cannot be approved before all three are in', () => {
  const world = as(initialWorld(), 'tobi');
  assert.equal(canApprove(record(world, MAIN_CAMPAIGN), slotOf(record(world, MAIN_CAMPAIGN), 'tobi')!), false);
  assert.throws(() => releaseApproval(world, MAIN_CAMPAIGN, 'backer-1', at('14:04')), /cannot be approved/);
});

test('only the owner of a deposit can approve, stop or reclaim it', () => {
  const world = as(ready(), 'tobi');
  assert.throws(() => releaseApproval(world, MAIN_CAMPAIGN, 'backer-3', at('14:04')), /Only the owner/);
  assert.throws(() => stopApproval(world, MAIN_CAMPAIGN, 'backer-3', at('14:04')), /Only the owner/);
  assert.throws(() => requestReclaim(world, MAIN_CAMPAIGN, 'backer-3', at('14:04')), /Only the owner/);
  assert.throws(() => requestReclaim(as(world, 'ngozi'), MAIN_CAMPAIGN, 'backer-1', at('14:04')), /Only the owner/);
});

test('the third signature sends one batch, and nothing is paid until the mint says so', () => {
  let world = releaseApproval(as(ready(), 'tobi'), MAIN_CAMPAIGN, 'backer-1', at('14:04'));
  world = releaseApproval(as(world, 'ishaan'), MAIN_CAMPAIGN, 'backer-3', at('14:05'));
  assert.equal(statusOf(record(world, MAIN_CAMPAIGN)), 'ready');
  assert.deepEqual(states(world, MAIN_CAMPAIGN), ['approved', 'deposited', 'approved']);
  assert.equal(record(world, MAIN_CAMPAIGN).operations.length, 0);

  world = allApproved();
  const sent = record(world, MAIN_CAMPAIGN);
  assert.equal(statusOf(sent), 'paying out');
  assert.deepEqual(states(world, MAIN_CAMPAIGN), ['paying out', 'paying out', 'paying out']);
  assert.equal(sent.operations.length, 1);
  assert.deepEqual(sent.operations[0].slotIds, ['backer-1', 'backer-2', 'backer-3']);
  assert.equal(sent.operations[0].amountSat, 63);
  assert.equal(sent.operations[0].status, 'dispatched');
  assert.ok(sent.slots.every(slot => slot.quote?.mintState === 'PAID'));

  world = checkMint(world, MAIN_CAMPAIGN, at('14:07'));
  const paid = record(world, MAIN_CAMPAIGN);
  assert.equal(statusOf(paid), 'paid');
  assert.ok(paid.slots.every(slot => slot.deposit?.quote.mintState === 'ISSUED'));
  assert.equal(latestOperation(paid, 'payout')?.status, 'confirmed');
  assert.equal(world.notice, 'Stacked. Paid. 63 sats from 3 plebs to Ngozi Eze. Confirmed by the mint at 13 Nov, 14:07 UTC.');
  assert.equal(checkMint(world, MAIN_CAMPAIGN, at('14:08')), world);
});

test('the creator receives 62 sats of the 63 after the swap fee', () => {
  const paid = checkMint(allApproved(), MAIN_CAMPAIGN, at('14:07'));
  assert.throws(() => recordSpend(paid, MAIN_CAMPAIGN, at('14:09')), /Only the creator/);
  const spent = recordSpend(as(paid, 'ngozi'), MAIN_CAMPAIGN, at('14:09'));
  assert.deepEqual(record(spent, MAIN_CAMPAIGN).spend, { at: at('14:09'), feeSat: 1, receivedSat: 62 });
  assert.throws(() => recordSpend(spent, MAIN_CAMPAIGN, at('14:10')), /no unspent payout/);
  assert.throws(() => recordSpend(as(allApproved(), 'ngozi'), MAIN_CAMPAIGN, at('14:09')), /no unspent payout/);
});

test('stopping approval blocks a new signature and leaves the deposit where it is', () => {
  const world = stopApproval(ready(), MAIN_CAMPAIGN, 'backer-3', at('14:04'));
  assert.deepEqual(states(world, MAIN_CAMPAIGN), ['deposited', 'deposited', 'deposited']);
  assert.equal(viewerStep(world, record(world, MAIN_CAMPAIGN)).kind, 'stopped');
  assert.throws(() => releaseApproval(world, MAIN_CAMPAIGN, 'backer-3', at('14:05')), /cannot be approved/);
  const reclaiming = requestReclaim(world, MAIN_CAMPAIGN, 'backer-3', at('14:05'));
  assert.equal(slotStatus(slotOf(record(reclaiming, MAIN_CAMPAIGN), 'ishaan')!), 'reclaiming');
});

test('an unmet campaign lets one backer reclaim without touching the other deposit', () => {
  const reclaiming = requestReclaim(initialWorld(), UNMET_CAMPAIGN, 'backer-2', at('14:10'));
  assert.deepEqual(states(reclaiming, UNMET_CAMPAIGN), ['deposited', 'reclaiming', 'open']);
  assert.equal(statusOf(record(reclaiming, UNMET_CAMPAIGN)), 'reclaiming');
  assert.equal(pendingOperation(record(reclaiming, UNMET_CAMPAIGN), 'reclaim', 'backer-2')?.savedBy, 'ishaan');

  const reclaimed = checkMint(reclaiming, UNMET_CAMPAIGN, at('14:11'));
  assert.deepEqual(states(reclaimed, UNMET_CAMPAIGN), ['deposited', 'reclaimed', 'open']);
  assert.equal(statusOf(record(reclaimed, UNMET_CAMPAIGN)), 'unmet');
  assert.equal(latestOperation(record(reclaimed, UNMET_CAMPAIGN), 'reclaim')?.status, 'confirmed');
  assert.deepEqual(tally(record(reclaimed, UNMET_CAMPAIGN)).heldSat, 21);
  assert.throws(() => requestReclaim(reclaimed, UNMET_CAMPAIGN, 'backer-2', at('14:12')), /terminal/);
});

test('a reclaim after approval is only reclaiming until the mint picks a winner', () => {
  const racing = requestReclaim(initialWorld(), RACE_CAMPAIGN, 'backer-3', at('14:12'));
  const slot = slotOf(record(racing, RACE_CAMPAIGN), 'ishaan')!;
  assert.equal(slot.deposit?.state, 'reclaiming');
  assert.equal(slot.deposit?.authorizationReleased, true);
  assert.equal(statusOf(record(racing, RACE_CAMPAIGN)), 'reclaiming');
  assert.ok(pendingOperation(record(racing, RACE_CAMPAIGN), 'payout'));
  assert.ok(pendingOperation(record(racing, RACE_CAMPAIGN), 'reclaim', 'backer-3'));
});

test('when the payout wins the race, all three are paid and the reclaim is rejected', () => {
  const racing = requestReclaim(initialWorld(), RACE_CAMPAIGN, 'backer-3', at('14:12'));
  const world = checkMint(racing, RACE_CAMPAIGN, at('14:13'), 'creator');
  assert.deepEqual(states(world, RACE_CAMPAIGN), ['paid', 'paid', 'paid']);
  assert.equal(statusOf(record(world, RACE_CAMPAIGN)), 'paid');
  assert.equal(latestOperation(record(world, RACE_CAMPAIGN), 'reclaim')?.status, 'rejected');
  assert.equal(latestOperation(record(world, RACE_CAMPAIGN), 'payout')?.status, 'confirmed');
  assert.equal(viewerStep(world, record(world, RACE_CAMPAIGN)).kind, 'paid');
});

test('when the reclaim wins the race, the batch is rejected and the others keep their deposits', () => {
  const racing = requestReclaim(initialWorld(), RACE_CAMPAIGN, 'backer-3', at('14:12'));
  const world = checkMint(racing, RACE_CAMPAIGN, at('14:13'), 'owner');
  const after = record(world, RACE_CAMPAIGN);
  assert.deepEqual(states(world, RACE_CAMPAIGN), ['deposited', 'deposited', 'reclaimed']);
  assert.equal(statusOf(after), 'unmet');
  assert.ok(after.slots.slice(0, 2).every(slot => slot.deposit?.authorizationReleased === false));
  assert.equal(latestOperation(after, 'payout')?.status, 'rejected');
  assert.equal(latestOperation(after, 'reclaim')?.status, 'confirmed');
  assert.equal(viewerStep(as(world, 'tobi'), after).kind, 'take-back');
  assert.match(headline(after).sentence, /taken back/);
});

test('with no reclaim in flight, a timed-out payout settles as paid when checked', () => {
  const world = checkMint(as(initialWorld(), 'ngozi'), RACE_CAMPAIGN, at('14:20'));
  assert.equal(statusOf(record(world, RACE_CAMPAIGN)), 'paid');
  assert.equal(latestOperation(record(world, RACE_CAMPAIGN), 'payout')?.settledAt, at('14:20'));
});

test('only the organizer can stop collecting, and it moves no money', () => {
  assert.throws(() => stopCollecting(initialWorld(), MAIN_CAMPAIGN, at('15:00')), /Only the organizer/);
  const world = stopCollecting(as(initialWorld(), 'ngozi'), MAIN_CAMPAIGN, at('15:00'));
  assert.equal(statusOf(record(world, MAIN_CAMPAIGN)), 'unmet');
  assert.deepEqual(states(world, MAIN_CAMPAIGN), ['deposited', 'deposited', 'open']);
  assert.equal(headline(record(world, MAIN_CAMPAIGN)).word, 'Unmet');
  assert.throws(() => requestQuote(as(world, 'ishaan'), MAIN_CAMPAIGN, at('15:01')), /not collecting/);
  assert.throws(() => stopCollecting(world, MAIN_CAMPAIGN, at('15:02')), /no longer collecting/);
  assert.throws(() => stopCollecting(as(allApproved(), 'ngozi'), MAIN_CAMPAIGN, at('15:00')), /no longer collecting/);
});

test('a new campaign belongs to whoever made it and starts with three open slots', () => {
  const draft = {
    title: '  Ship the 2.0 changelog  ', publicWorkUrl: 'https://git.example.org/ngozi/pocket-ical/issues/420',
    contributionSat: 21, beneficiaryPubkey: people.ngozi.pubkey,
  };
  const world = createCampaign(as(initialWorld(), 'ngozi'), draft, at('15:00'));
  const made = record(world, 'ship-the-2-0-changelog');
  assert.equal(made.campaign.title, 'Ship the 2.0 changelog');
  assert.equal(made.creatorId, 'ngozi');
  assert.deepEqual(made.slots.map(slotStatus), ['open', 'open', 'open']);
  assert.equal(statusOf(made), 'collecting');
  assert.equal(viewerStep(world, made).kind, 'organize');
  assert.equal(viewerStep(as(world, 'tobi'), made).kind, 'join');
  const again = createCampaign(world, draft, at('15:01'));
  assert.ok(findCampaign(again, 'ship-the-2-0-changelog-2'));
});

test('the next step follows the viewer through the campaign', () => {
  const step = (world: World, id = MAIN_CAMPAIGN) => viewerStep(world, record(world, id));
  const start = initialWorld();
  assert.equal(step(start).kind, 'join');
  assert.equal(step(as(start, 'ngozi')).kind, 'organize');
  assert.deepEqual(step(as(start, 'tobi')), { kind: 'wait', slot: slotOf(record(start, MAIN_CAMPAIGN), 'tobi'), missing: 1 });
  assert.equal(step(start, UNMET_CAMPAIGN).kind, 'take-back');
  assert.equal(step(start, RACE_CAMPAIGN).kind, 'payout-pending');
  assert.equal(step(as(start, 'ngozi'), RACE_CAMPAIGN).kind, 'payout-pending');
  assert.equal(step(requestQuote(start, MAIN_CAMPAIGN, at('14:02'))).kind, 'fund');
  assert.equal(step(ready()).kind, 'approve');

  let world = releaseApproval(as(ready(), 'tobi'), MAIN_CAMPAIGN, 'backer-1', at('14:04'));
  world = releaseApproval(as(world, 'ishaan'), MAIN_CAMPAIGN, 'backer-3', at('14:05'));
  const approved = step(world);
  assert.equal(approved.kind, 'approved');
  assert.deepEqual(approved.kind === 'approved' && approved.waitingOn, ['Maren']);

  const paid = checkMint(allApproved(), MAIN_CAMPAIGN, at('14:07'));
  assert.equal(step(as(paid, 'ishaan')).kind, 'paid');
  assert.equal(step(as(paid, 'ngozi')).kind, 'paid');
});

test('progress and row sentences use the documented words', () => {
  const start = initialWorld();
  const main = record(start, MAIN_CAMPAIGN);
  assert.equal(progressLine(main), '2 of 3 stacked · 42 of 63 sats');
  assert.equal(progressLine(record(start, UNMET_CAMPAIGN)), '2 of 3 stacked · 42 of 63 sats · collecting stopped');
  assert.equal(progressLine(record(start, RACE_CAMPAIGN)), '3 of 3 stacked · 63 of 63 sats · signed 3 of 3');
  assert.equal(progressLine(record(ready(), MAIN_CAMPAIGN)), '3 of 3 stacked · 63 of 63 sats · signed 0 of 3');
  assert.equal(progressLine(record(checkMint(allApproved(), MAIN_CAMPAIGN, at('14:07')), MAIN_CAMPAIGN)), 'goal reached · 63 sats paid');
  assert.equal(headline(main).word, 'Collecting');
  assert.equal(headline(record(ready(), MAIN_CAMPAIGN)).word, 'Ready');
  assert.equal(headline(record(ready(), MAIN_CAMPAIGN)).phrase, 'At the line');

  assert.equal(rowSentence(main, 'approved', true), stateCopy.approved.sentence(termsOf(main)));
  assert.equal(rowSentence(main, 'reclaimed', true), stateCopy.reclaimed.sentence(termsOf(main)));
  assert.match(rowSentence(main, 'deposited', true), /locked to your key\. Not paid to Ngozi\.$/);
  assert.match(rowSentence(main, 'deposited', false), /locked to their key/);
  assert.match(rowSentence(main, 'reclaimed', false), /their own outputs/);
  assert.match(rowSentence(main, 'open', false), /No deposit yet/);
  assert.match(rowSentence(main, 'awaiting', true), /Not stacked until the mint reports it paid/);
  assert.equal(sats(1), '1 sat');
  assert.equal(sats(63), '63 sats');
});

test('every beat of the script builds and opens a documented route', () => {
  assert.equal(new Set(beats.map(beat => beat.id)).size, beats.length);
  const seen = new Set<string>();
  for (const beat of beats) {
    const world = beat.world();
    assert.ok(people[world.viewerId], beat.id);
    assert.ok(Object.values(routes).some(route => matchPath(route, beat.path)), `${beat.id}: ${beat.path}`);
    assert.ok(beat.title && beat.line, beat.id);
    assert.equal(findBeat(beat.id), beat);
    for (const campaign of world.campaigns) {
      seen.add(statusOf(campaign));
      campaign.slots.forEach(slot => seen.add(slotStatus(slot)));
    }
  }
  for (const state of Object.keys(stateCopy)) assert.ok(seen.has(state), `no beat shows "${state}"`);
  assert.ok(seen.has('unmet') && seen.has('collecting') && seen.has('awaiting'));
  assert.equal(findBeat('nope'), undefined);
});

test('the fifteen-second beats end on a confirmed payout, then a confirmed reclaim', () => {
  const main = (id: string) => statusOf(record(findBeat(id)!.world(), MAIN_CAMPAIGN));
  assert.deepEqual(['two-of-three', 'joining', 'ready', 'approved', 'paying-out', 'paid'].map(main),
    ['collecting', 'collecting', 'ready', 'ready', 'paying out', 'paid']);
  assert.equal(record(findBeat('paid')!.world(), MAIN_CAMPAIGN).spend?.receivedSat, 62);
  const unmet = (id: string) => states(findBeat(id)!.world(), UNMET_CAMPAIGN)[1];
  assert.deepEqual(['unmet', 'reclaiming', 'reclaimed'].map(unmet), ['deposited', 'reclaiming', 'reclaimed']);
});

test('format helpers', () => {
  assert.equal(formatWhen('2026-11-13T14:02:00Z'), '13 Nov, 14:02 UTC');
  assert.equal(formatWhen('2026-11-06T23:59:00-05:00'), '7 Nov, 04:59 UTC');
  assert.equal(formatWhen('2026-11-13T14:02:00Z', 'Africa/Lagos'), '13 Nov, 15:02 GMT+1');
  assert.equal(formatWhen('2026-11-12T23:52:43Z', 'Africa/Lagos'), '13 Nov, 00:52 GMT+1');
  assert.equal(formatClock('2026-11-13T18:32:05Z', 'Africa/Lagos'), '19:32:05 GMT+1');
  assert.equal(formatClock(new Date('2026-11-13T18:32:05Z'), 'UTC'), '18:32:05 UTC');
  setTimeZone('Africa/Lagos');
  assert.equal(formatWhen('2026-11-13T14:02:00Z'), '13 Nov, 15:02 GMT+1');
  setTimeZone('UTC');
  assert.equal(shortKey(people.ngozi.pubkey), '02c41f7a…29e8a3');
  assert.equal(shortKey('op-541d70ed'), 'op-541d70ed');
  assert.equal(plural(1, 'slot', 'slots'), '1 slot');
  assert.equal(plural(2, 'slot', 'slots'), '2 slots');
  assert.equal(plural(0, 'slot', 'slots'), '0 slots');
  assert.equal(listNames(['Maren']), 'Maren');
  assert.equal(listNames(['Tobi', 'Maren']), 'Tobi and Maren');
  assert.ok(Object.values(people).every(person => isCompressedPubkey(person.pubkey)));
  assert.equal(isCompressedPubkey(` ${people.tobi.pubkey} `), true);
  assert.equal(isCompressedPubkey(`04${people.tobi.pubkey.slice(2)}`), false);
  assert.equal(isCompressedPubkey(people.tobi.pubkey.slice(0, 60)), false);
  assert.equal(isHttpUrl('https://git.example.org/ngozi/pocket-ical/issues/412'), true);
  assert.equal(isHttpUrl('git.example.org/issues/412'), false);
  assert.equal(isHttpUrl('mailto:ngozi@example.org'), false);
  assert.equal(isHttpUrl(''), false);
});
