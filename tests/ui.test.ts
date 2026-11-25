import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MAIN_CAMPAIGN, RACE_CAMPAIGN, UNMET_CAMPAIGN, checkMint, confirmDeposit, findCampaign, initialWorld, releaseApproval, requestQuote,
  requestReclaim, setViewer, type World,
} from '../src/demo/world';
import { isSignal, signalStates, stateColour, type ToneState } from '../src/domain/states';
import { whyClosed } from '../src/screens/Join';
import { whyUnmet } from '../src/screens/Unmet';
import { checkResults } from '../src/ui/Checked';
import { GoalRail, railStates } from '../src/ui/GoalRail';
import { GroupCard } from '../src/ui/GroupCard';
import {
  campaignGoal, journeyOf, maintainerJourney, organizerJourney, readyToSend, slabOffset, stopLabel, type Stop,
} from '../src/ui/journey';
import { qrModules } from '../src/ui/Qr';
import { maintainerFacts, organizerFacts, reallyFacts } from '../src/ui/Really';
import { Stack } from '../src/ui/Stack';
import { Track } from '../src/ui/Track';
import { Who } from '../src/ui/Who';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const record = (world: World, id = MAIN_CAMPAIGN) => findCampaign(world, id)!;
const html = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);
const at = '2026-11-13T14:02:00Z';
const SCREENS = [
  'Join', 'Pay', 'Stacked', 'Waiting', 'Sign', 'Signed', 'Sending', 'Paid', 'Race', 'Unmet', 'Back',
  'Backing', 'PayoutKey', 'Terms', 'Share', 'Watch', 'Claim', 'Follow', 'Receive', 'Spent', 'Intro',
];

test('paid is the only state that takes the signal colour', () => {
  assert.deepEqual([...signalStates], ['paid']);
  for (const [state, colour] of Object.entries(stateColour) as [ToneState, string][]) {
    assert.equal(colour === 'var(--color-signal)', isSignal(state), state);
  }
});

test('night only: one token block, no state or test-mint colour equals lime or paying-out amber', () => {
  const css = source('src/styles/tokens.css');
  assert.equal(css.match(/:root/g)?.length, 1);
  const tokens = Object.fromEntries([...css.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
  assert.equal(tokens['--color-canvas'], '#0b0b0c');
  assert.equal(tokens['--color-signal'], '#c8f135');
  for (const [name, value] of Object.entries(tokens)) {
    if (name === '--color-signal' || name === '--color-state-paid') continue;
    assert.notEqual(value.toLowerCase(), '#c8f135', name);
  }
  assert.notEqual(tokens['--color-test-mint'], tokens['--color-state-paying-out']);
  assert.doesNotMatch(source('index.html'), /data-theme|prefers-color-scheme: light|fonts\.googleapis|Inter/);
});

test('in the stylesheets, lime only ever hangs off the paid rail', () => {
  const css = source('src/styles/app.css') + source('src/styles/stage.css');
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, , body]) => body.includes('--color-signal'));
  assert.ok(rules.length > 0);
  for (const [, selector] of rules) assert.match(selector, /data-paid/, selector.trim());
});

test('the stack names only slabs that are in, and lights up only once paid', () => {
  const world = initialWorld();
  const outside = html(createElement(Stack, { goal: campaignGoal(record(world), 'ishaan') }));
  assert.deepEqual([...outside.matchAll(/class="stack-name"[^>]*>([^<]+)</g)].map(([, name]) => name), ['Tobi', 'Maren']);
  assert.doesNotMatch(outside, /Ishaan|color-signal/);
  assert.match(outside, /2 of 3 deposits in, 42 of 63 sats\./);
  assert.match(outside, /goal · 42 of 63 sats/);

  const own = html(createElement(Stack, { goal: campaignGoal(record(world), 'maren') }));
  assert.match(own, /data-own="true">You</);
  assert.doesNotMatch(own, />Maren</);

  const ready = confirmDeposit(requestQuote(setViewer(world, 'ishaan'), MAIN_CAMPAIGN, at), MAIN_CAMPAIGN, 'backer-3', at);
  const line = campaignGoal(record(ready), 'ishaan');
  assert.deepEqual([line.phase, line.label], ['at-line', 'at the line · 63 of 63 sats']);
  assert.doesNotMatch(html(createElement(Stack, { goal: line })), /color-signal/);

  const paid = campaignGoal(record(checkMint(initialWorld(), RACE_CAMPAIGN, at, 'creator'), RACE_CAMPAIGN));
  assert.deepEqual([paid.phase, paid.label], ['paid', 'goal reached · 63 sats paid']);
  assert.match(html(createElement(Stack, { goal: paid })), /color-signal/);
});

test('slab offsets are stable per key', () => {
  assert.equal(slabOffset('02abc', 0), slabOffset('02abc', 2));
  assert.deepEqual([0, 1, 2].map(index => slabOffset(undefined, index)), [12, 0, 24]);
});

test('the rail: behind solid, ahead dashed, lime only when paid', () => {
  const stack = html(createElement(GoalRail, { at: 1, paid: false }));
  assert.deepEqual([...stack.matchAll(/data-state="(\w+)"/g)].map(([, state]) => state), ['done', 'now', 'ahead', 'ahead']);
  assert.match(stack, /aria-current="step"[^>]*><span class="rail-slab"[^>]*><\/span><span class="rail-name">Stack</);
  assert.doesNotMatch(stack, /data-paid/);
  assert.match(html(createElement(GoalRail, { at: 3, paid: true })), /data-paid/);
});

test('the viewer’s step picks the screen, the rail position and where their sats are', () => {
  const world = initialWorld();
  const as = (id: string, from = world) => journeyOf(setViewer(from, id), record(from));
  assert.deepEqual([as('ishaan').screen, as('ishaan').rail.at, as('ishaan').stop], ['join', 0, 'wallet']);
  assert.deepEqual([as('maren').screen, as('maren').rail.at, as('maren').stop], ['waiting', 1, 'at-mint']);
  const asked = requestQuote(setViewer(world, 'ishaan'), MAIN_CAMPAIGN, at);
  assert.deepEqual([as('ishaan', asked).screen, as('ishaan', asked).stop], ['pay', 'to-mint']);
  const full = confirmDeposit(asked, MAIN_CAMPAIGN, 'backer-3', at);
  assert.equal(as('ishaan', full).screen, 'sign');
  assert.equal(as('ngozi', full).screen, 'join');
  assert.equal(journeyOf(setViewer(world, 'tobi'), record(world, UNMET_CAMPAIGN)).step.kind, 'take-back');
});

test('the track label follows the state, never a fixed “locked to you”', () => {
  const stops: Stop[] = ['wallet', 'to-mint', 'at-mint', 'to-maintainer', 'with-maintainer', 'to-you', 'back'];
  assert.deepEqual(stops.map(stop => stopLabel(stop, 'Ngozi')), [
    'in your wallet', 'on the way to the mint', 'at the mint, locked to you', 'on the way to Ngozi',
    'with Ngozi, locked to her key', 'on the way back to you', 'back with you',
  ]);
  const paying = html(createElement(Track, { stop: 'to-mint', maintainer: 'Ngozi', amount: '21 sats' }));
  assert.match(paying, /aria-label="Where your 21 sats are: on the way to the mint"/);
  assert.doesNotMatch(paying, /locked to you/);
  assert.match(html(createElement(Track, { stop: 'at-mint', maintainer: 'Ngozi', amount: '21 sats' })), /locked to you/);
});

test('what’s really happening names the batch, the lock and the signature, and drops the code-speak', () => {
  const text = reallyFacts('Ngozi', '21 sats', '63 sats').map(fact => `${fact.text} ${fact.term}`).join('\n');
  assert.match(text, /NUT-20 locked mint quote/);
  assert.match(text, /signature over this exact batch\. It sends nothing by itself/);
  assert.match(text, /NUT-20 signature/);
  assert.match(text, /locked to Ngozi’s key.*\n?.*NUT-11/);
  assert.match(text, /one batch.*NUT-29/);
  assert.match(text, /marks its own invoices paid/);
  assert.doesNotMatch(text, /key methods|coordinator/i);
});

test('binding copy: intro key line, honest test mint, close time only from data, no recovery file', () => {
  const intro = source('src/screens/Intro.tsx');
  assert.match(intro, /Nobody else holds your key\./);
  assert.match(intro, /Start a stack/);
  assert.doesNotMatch(intro, /holds them|tone="lit"|color-signal/);
  assert.match(source('src/screens/Pay.tsx'), /Test mint: it marks its own invoices paid\. Fake sats\./);
  for (const screen of SCREENS) {
    const text = source(`src/screens/${screen}.tsx`);
    assert.doesNotMatch(text, /\btoday\b|recovery file|\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\bWAT\b|GMT[+-]/i, screen);
  }
  assert.match(source('src/screens/Follow.tsx'), /The payout will be locked to/);
  assert.doesNotMatch(source('src/screens/Follow.tsx'), /payout is locked to your key/);
  assert.match(source('src/screens/Watch.tsx'), /Signatures already released still count\./);
  assert.match(source('src/screens/Watch.tsx'), /the last signature sends the payout to the mint/);
  assert.match(source('src/screens/Share.tsx'), /You organize this stack\. You can share it and stop collecting, but you can’t move anyone’s sats\./);
  assert.match(source('src/screens/Backing.tsx'), /received ecash, not that the work was done/);
  assert.match(source('src/screens/Spent.tsx'), /Swap fee at the mint, \{sats\(fee\)\}\. Received, \{sats\(spend\.receivedSat!\)\}\./);
});

test('every fact sheet: the maintainer’s says the locked ecash only works with her key', () => {
  const text = maintainerFacts('63 sats').map(fact => `${fact.text} ${fact.term}`).join('\n');
  assert.match(text, /only works with your key/);
  assert.match(text, /NUT-11/);
  assert.doesNotMatch(organizerFacts('Ngozi', '21 sats').map(fact => fact.text).join(' '), /key methods/);
});

test('the invoice QR is a real code of the whole invoice', () => {
  const invoice = `lightning:lnbc210n1p${'q'.repeat(230)}`;
  const modules = qrModules(invoice);
  assert.ok(modules.length >= 21 && (modules.length - 17) % 4 === 0);
  // Finder patterns sit in three corners.
  for (const [row, col] of [[0, 0], [0, modules.length - 7], [modules.length - 7, 0]]) {
    assert.ok(modules[row][col] && modules[row + 6][col + 6] && !modules[row + 1][col + 1] && modules[row + 3][col + 3]);
  }
});

test('sign, send, paid, and both orders of the race each have their own screen', () => {
  const world = initialWorld();
  const as = (id: string, from: World, campaign = RACE_CAMPAIGN) => journeyOf(setViewer(from, id), record(from, campaign));
  const sending = as('tobi', world);
  // Sending keeps Paid ahead: nothing is current until the mint confirms.
  assert.deepEqual([sending.screen, sending.stop, sending.rail], ['sending', 'to-maintainer', { at: 3, paid: false, pending: true }]);
  assert.deepEqual(railStates(sending.rail), ['done', 'done', 'done', 'ahead']);
  assert.doesNotMatch(html(createElement(GoalRail, sending.rail)), /aria-current|data-paid/);
  assert.equal(sending.here.name, 'Sending · not paid yet');
  assert.equal(campaignGoal(record(world, RACE_CAMPAIGN)).label, 'at the line · signed 3 of 3');

  const paid = checkMint(world, RACE_CAMPAIGN, at, 'creator');
  assert.deepEqual([as('tobi', paid).screen, as('tobi', paid).stop, as('tobi', paid).rail], ['paid', 'with-maintainer', { at: 3, paid: true }]);

  const racing = requestReclaim(setViewer(world, 'tobi'), RACE_CAMPAIGN, 'backer-1', at);
  assert.deepEqual([as('tobi', racing).screen, as('tobi', racing).stop], ['back', 'to-you']);
  const payoutFirst = checkMint(racing, RACE_CAMPAIGN, at, 'creator');
  assert.equal(as('tobi', payoutFirst).screen, 'race');
  assert.equal(as('maren', payoutFirst).screen, 'paid');

  // Taking it back ends on Back, never on Paid.
  assert.deepEqual(as('tobi', racing).rail, { at: 3, paid: false, branch: 'back' });
  assert.match(html(createElement(GoalRail, as('tobi', racing).rail)), /aria-current="step"[^>]*><span class="rail-slab"[^>]*><\/span><span class="rail-name">Back</);
  const reclaimFirst = checkMint(racing, RACE_CAMPAIGN, at, 'owner');
  assert.deepEqual([as('tobi', reclaimFirst).screen, as('tobi', reclaimFirst).stop], ['back', 'back']);
  assert.deepEqual(railStates(as('tobi', reclaimFirst).rail), ['done', 'done', 'done', 'done']);
  assert.doesNotMatch(html(createElement(GoalRail, as('tobi', reclaimFirst).rail)), /Paid|data-paid/);
  assert.equal(as('tobi', reclaimFirst).here.next, 'Done. Your 21 sats are back with you.');
  assert.deepEqual([as('maren', reclaimFirst).screen, as('maren', reclaimFirst).stop], ['unmet', 'at-mint']);
  assert.equal(whyUnmet(record(reclaimFirst, RACE_CAMPAIGN), 'maren'), 'Tobi took theirs back first, so the payout didn’t go.');
  assert.equal(whyUnmet(record(world, UNMET_CAMPAIGN), 'tobi'), 'Ngozi stopped collecting.');
  assert.equal(as('tobi', world, UNMET_CAMPAIGN).screen, 'unmet');
});

test('the group card shows who signed, your turn, and not yet; the last signature is ready to send', () => {
  let world = setViewer(initialWorld(), 'ishaan');
  world = confirmDeposit(requestQuote(world, MAIN_CAMPAIGN, at), MAIN_CAMPAIGN, 'backer-3', at);
  world = releaseApproval(setViewer(world, 'tobi'), MAIN_CAMPAIGN, 'backer-1', at);
  const card = html(createElement(GroupCard, { record: record(world), viewerId: 'maren' }));
  assert.match(card, /1 of 3 signed/);
  assert.match(card, /to Ngozi Eze · only she can spend it/);
  assert.deepEqual([...card.matchAll(/data-tone="(\w+)"/g)].map(([, tone]) => tone), ['signed', 'turn', 'later']);
  assert.equal(journeyOf(setViewer(world, 'tobi'), record(world)).screen, 'signed');
  assert.equal(journeyOf(setViewer(world, 'tobi'), record(world)).stop, 'signed');
  assert.equal(readyToSend(record(world)), false);
  world = releaseApproval(setViewer(world, 'maren'), MAIN_CAMPAIGN, 'backer-2', at);
  assert.equal(readyToSend(record(world)), false);
});

test('what your phone checked comes from the review itself', () => {
  const main = record(initialWorld());
  const lockedTo = main.campaign.beneficiaryPubkey;
  const lines = checkResults(main, {
    totalSat: 63, keysetId: '00abc', lockedTo, amounts: [32, 16, 8, 4, 2, 1], quoteIds: ['q1', 'q2', 'q3'],
    quoteStates: ['PAID', 'PAID', 'PAID'],
  }, 'q2-own-quote-id').map(line => `${line.text} ${line.detail}`);
  assert.deepEqual(lines.map(line => line.split(' ')[0]), ['63', 'Every', 'No', 'The', 'Your', 'All']);
  assert.match(lines[0], /32 \+ 16 \+ 8 \+ 4 \+ 2 \+ 1/);
  assert.match(lines[1], /Ngozi’s key NUT-11 P2PK/);
  assert.match(lines[3], /keyset 00abc/);
  assert.match(lines[5], /PAID · PAID · PAID/);
});

test('the step header says where you are and what’s next, counts and names from the record', () => {
  const world = initialWorld();
  const as = (id: string, from = world, campaign = MAIN_CAMPAIGN) => journeyOf(setViewer(from, id), record(from, campaign));
  assert.deepEqual(as('ishaan').here, { name: 'Join the stack', next: 'chip in 21 sats.' });
  assert.deepEqual(as('maren').here, { name: 'Stacked', next: '1 more pleb chips in.' });
  const full = confirmDeposit(requestQuote(setViewer(world, 'ishaan'), MAIN_CAMPAIGN, at), MAIN_CAMPAIGN, 'backer-3', at);
  const signed = releaseApproval(setViewer(full, 'tobi'), MAIN_CAMPAIGN, 'backer-1', at);
  assert.deepEqual(as('tobi', signed).here, { name: 'Signed', next: 'Maren and Ishaan sign.' });
  assert.deepEqual(as('tobi', world, UNMET_CAMPAIGN).here, { name: 'Take yours back', next: 'take yours back.' });
  assert.equal(as('tobi', checkMint(world, RACE_CAMPAIGN, at, 'creator'), RACE_CAMPAIGN).here.end, true);

  // The organizer's setup is done once the stack is open; the line says what the plebs do next.
  const watch = organizerJourney('watch', 'Ngozi', record(world));
  assert.deepEqual(railStates(watch.rail), ['done', 'done', 'done', 'done']);
  assert.deepEqual(watch.here, { name: 'Watching it fill · setup done', next: '1 more pleb chips in. Nothing for you to do.' });
  assert.equal(organizerJourney('watch', 'Ngozi', record(signed)).here.next, 'Maren and Ishaan sign. Nothing for you to do.');
  assert.deepEqual(organizerJourney('terms', 'Ngozi').rail, { at: 2, paid: false, steps: ['Who', 'Key', 'Terms', 'Share'] });
  assert.equal(maintainerJourney('follow', 'Ada', record(world, UNMET_CAMPAIGN)).here.end, true);
});

test('someone who never chipped in stays at Join with a reason, and is told no sats moved only when none did', () => {
  const world = initialWorld();
  const closed = record(world, UNMET_CAMPAIGN);
  const maren = journeyOf(setViewer(world, 'maren'), closed);
  assert.deepEqual([maren.screen, maren.rail], ['join', { at: 0, paid: false }]);
  assert.equal(maren.here.name, 'This stack closed');
  assert.match(whyClosed(closed, 'maren'), /^Ngozi stopped collecting\. You didn’t chip in, so none of your sats moved\.$/);
  const empty = { ...closed, slots: closed.slots.map(slot => ({ id: slot.id })) } as typeof closed;
  assert.match(whyClosed(empty, 'maren'), /No sats moved\.$/);
  const paid = record(checkMint(world, RACE_CAMPAIGN, at, 'creator'), RACE_CAMPAIGN);
  assert.match(whyClosed(paid, 'maren'), /^Ngozi got 63 sats, confirmed by the mint\. You didn’t chip in/);
});

test('the maintainer card: role, name and work, then the key on its own row, never a money colour', () => {
  const pubkey = '0343' + 'a'.repeat(58) + 'd962';
  const card = html(createElement(Who, { name: 'Ngozi Eze', title: 'Daylight-saving drift', keyBy: 'maintainer', pubkey }));
  assert.match(card, /class="role-caps">Maintainer<.*class="person-tag-name">Ngozi Eze<.*class="who-work">Fixing daylight-saving drift</);
  assert.match(card, /class="who-foot"><p class="status" data-kind="fact"><svg[^]*<strong>Key confirmed<\/strong>on her phone<\/p><span class="mono">0343…d962</);
  assert.doesNotMatch(card, /--tone|color-state|Organized by/);
  const pasted = html(createElement(Who, { name: 'Ngozi Eze', title: 'x', keyBy: 'pasted', organizer: 'Ada' }));
  assert.match(pasted, /data-weak="true".*Key pasted, not confirmed by her/);
  assert.match(pasted, /Organized by <strong>Ada<\/strong>/);
});
