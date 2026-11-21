import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { findBeat } from '../src/demo/beats';
import { WorldProvider } from '../src/demo/store';
import { RACE_CAMPAIGN, findCampaign, initialWorld } from '../src/demo/world';
import { isSignal, signalStates, stateColour, stateCopy, type ToneState } from '../src/domain/states';
import { routes } from '../src/routes';
import { Reclaim } from '../src/screens/Reclaim';
import { campaignGoal, slabOffset } from '../src/ui/GoalLine';
import { Icon } from '../src/ui/Icon';

function render(path: string, element: ReturnType<typeof createElement>, route: string): string {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(WorldProvider, null, createElement(Routes, null, createElement(Route, { path: route, element })))));
}

function stateBlocks(html: string): { state: string; signal: boolean }[] {
  return [...html.matchAll(/<div class="state" data-state="([^"]+)"([^>]*)>/g)]
    .map(([, state, rest]) => ({ state, signal: rest.includes('data-signal') }));
}

test('paid is the only state that takes the signal colour', () => {
  assert.deepEqual([...signalStates], ['paid']);
  for (const [state, colour] of Object.entries(stateColour) as [ToneState, string][]) {
    assert.equal(colour === 'var(--color-signal)', isSignal(state), state);
  }
  assert.equal(stateColour.reclaimed, 'var(--color-state-reclaimed)');
});

test('no state token but paid resolves to the signal colour, in night or paper', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  for (const block of css.split(/\n}\n/).filter(text => text.includes('--color-signal:'))) {
    const tokens = Object.fromEntries([...block.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
    for (const [name, value] of Object.entries(tokens)) {
      if (!name.startsWith('--color-state-') || name === '--color-state-paid') continue;
      assert.notEqual(value.toLowerCase(), tokens['--color-signal'].toLowerCase(), name);
      assert.notEqual(value, 'var(--color-signal)', name);
    }
  }
  assert.match(css, /--color-state-paid: var\(--color-signal\)/);
});

test('both reclaim race outcomes: the Paid block is lit, the Reclaimed block is not', () => {
  for (const [beatId, state, signal] of [['race-payout-wins', 'paid', true], ['race-reclaim-wins', 'reclaimed', false]] as const) {
    const beat = findBeat(beatId)!;
    const html = render(`${beat.path}?beat=${beat.id}`, createElement(Reclaim), routes.reclaim);
    assert.deepEqual(stateBlocks(html), [{ state, signal }], beatId);
    if (!signal) assert.doesNotMatch(html, /data-signal|--color-signal/, beatId);
  }
});

test('the seven glyphs are seven different drawings', () => {
  const drawings = Object.values(stateCopy).map(copy => renderToStaticMarkup(createElement(Icon, { name: copy.icon })));
  assert.equal(new Set(drawings).size, 7);
  for (const drawing of drawings) assert.match(drawing, /aria-hidden="true"/);
});

test('goal line: offsets are stable per key, the label follows the campaign, and only Paid reaches it', () => {
  assert.equal(slabOffset('02abc', 0), slabOffset('02abc', 2));
  assert.deepEqual([0, 1, 2].map(index => slabOffset(undefined, index)), [12, 0, 24]);
  const goal = (beatId: string) => campaignGoal(findCampaign(findBeat(beatId)!.world(), findBeat(beatId)!.path.split('/')[2])!, 'ishaan');
  assert.deepEqual([goal('two-of-three').phase, goal('two-of-three').label, goal('two-of-three').text],
    ['collecting', 'goal · 42 of 63 sats', '2 of 3 deposits in, 42 of 63 sats.']);
  assert.deepEqual([goal('ready').phase, goal('ready').label], ['at-line', 'at the line · 63 of 63 sats']);
  assert.equal(goal('approved').phase, 'at-line');
  assert.equal(goal('paying-out').phase, 'sending');
  assert.deepEqual([goal('paid').phase, goal('paid').label], ['paid', 'goal reached · 63 sats paid']);
  const reclaimed = goal('reclaimed');
  assert.equal(reclaimed.phase, 'unmet');
  assert.deepEqual(reclaimed.slabs.map(slab => slab.kind), ['filled', 'reclaimed', 'open']);
  assert.ok(reclaimed.slabs[1].own);
  const race = campaignGoal(findCampaign(initialWorld(), RACE_CAMPAIGN)!);
  assert.equal(race.phase, 'sending');
});
