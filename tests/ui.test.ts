import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MAIN_CAMPAIGN, RACE_CAMPAIGN, UNMET_CAMPAIGN, checkMint, confirmDeposit, findCampaign, initialWorld, requestQuote, setViewer,
  type World,
} from '../src/demo/world';
import { isSignal, signalStates, stateColour, type ToneState } from '../src/domain/states';
import { GoalRail } from '../src/ui/GoalRail';
import { campaignGoal, journeyOf, slabOffset, stopLabel, type Stop } from '../src/ui/journey';
import { qrModules } from '../src/ui/Qr';
import { reallyFacts } from '../src/ui/Really';
import { Stack } from '../src/ui/Stack';
import { Track } from '../src/ui/Track';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const record = (world: World, id = MAIN_CAMPAIGN) => findCampaign(world, id)!;
const html = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);
const at = '2026-11-13T14:02:00Z';

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

test('in the stylesheet, lime only ever hangs off the paid rail', () => {
  const css = source('src/styles/app.css');
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
  assert.equal(as('ishaan', full).screen, 'status');
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

test('binding copy: intro key line, honest test mint, no made-up close time, no recovery file', () => {
  const intro = source('src/screens/Intro.tsx');
  assert.match(intro, /Nobody else holds your key\./);
  assert.doesNotMatch(intro, /holds them|tone="lit"|color-signal/);
  assert.match(source('src/screens/Pay.tsx'), /Test mint: it marks its own invoices paid\. Fake sats\./);
  for (const screen of ['Join', 'Pay', 'Stacked', 'Waiting', 'Status']) {
    const text = source(`src/screens/${screen}.tsx`);
    assert.doesNotMatch(text, /closes|today|recovery file|24 Nov|26 Nov/i, screen);
  }
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
