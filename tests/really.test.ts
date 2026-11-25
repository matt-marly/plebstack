import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MAIN_CAMPAIGN, RACE_CAMPAIGN, UNMET_CAMPAIGN, checkMint, confirmDeposit, findCampaign, initialWorld, isHeld, releaseApproval,
  requestQuote, requestReclaim, setViewer, slotOf, statusOf, tally, type CampaignRecord, type World,
} from '../src/demo/world';
import { reallyContext, type ReallyContext } from '../src/ui/explain';
import { journeyOf, PLEBS } from '../src/ui/journey';
import { SatsMap } from '../src/ui/SatsMap';

const at = (time: string) => `2026-11-13T${time}:00Z`;
const record = (world: World, id = MAIN_CAMPAIGN) => findCampaign(world, id)!;

// Every sentence the sheet can show, the folded story included.
const said = (context: ReallyContext) => [
  context.status.phrase ?? '', context.now.lead, context.now.text, context.now.term,
  ...context.next.steps.flatMap(step => [step.text, step.term ?? '']),
  context.next.aside ? `${context.next.aside.lead} ${context.next.aside.text}` : '',
  ...context.story.map(fact => `${fact.text} ${fact.term}`),
].join('\n');

const paidClaim = /\bgot \d+ sats|reached you|went to \w+ in one batch|were paid|plebs paid|confirmed the batch|goal reached/i;
const ownAtMint = /your (\d+ sats|sats) are at the mint/i;
const countAtMint = /(?:(\d+) of \d+ sats|All (\d+) sats) are at the mint/;

function confirmedPaid(record: CampaignRecord) {
  return statusOf(record) === 'paid' && record.operations.some(op => op.kind === 'payout' && op.status === 'confirmed');
}

// Nothing is paid before the mint confirmed it, and nothing is at the mint that isn't.
function assertHonest(context: ReallyContext, record: CampaignRecord, where: string, viewerId?: string) {
  const text = said(context);
  const paid = confirmedPaid(record);
  if (!paid) {
    assert.doesNotMatch(text, paidClaim, where);
    assert.notEqual(context.status.state, 'paid', where);
    assert.ok(!context.now.map?.paid, where);
    assert.ok(!context.now.map?.slabs.some(slab => slab.tone === 'lit'), where);
  }
  if (context.now.map?.slabs.some(slab => slab.tone === 'lit')) assert.ok(context.now.map.paid, where);
  const own = viewerId ? slotOf(record, viewerId) : undefined;
  const ownHeld = own?.deposit !== undefined && ['deposited', 'approved', 'paying out'].includes(own.deposit.state);
  if (!ownHeld) assert.doesNotMatch(text, ownAtMint, where);
  if (!own) assert.doesNotMatch(text, /You made a key/, where);
  const counted = text.match(countAtMint);
  if (counted) {
    const { held, heldSat } = tally(record);
    assert.ok(counted[2] ? held === 3 && Number(counted[2]) === heldSat : Number(counted[1]) === heldSat, `${where}: ${counted[0]}`);
  }
  assert.ok(context.next.steps.length > 0, where);
  assert.ok(context.story.length >= 6, where);
}

function worlds(): [string, World][] {
  const start = initialWorld();
  const asked = requestQuote(setViewer(start, 'ishaan'), MAIN_CAMPAIGN, at('14:00'));
  const full = confirmDeposit(asked, MAIN_CAMPAIGN, 'backer-3', at('14:01'));
  const signed = releaseApproval(setViewer(full, 'tobi'), MAIN_CAMPAIGN, 'backer-1', at('14:02'));
  const racing = requestReclaim(setViewer(start, 'ishaan'), RACE_CAMPAIGN, 'backer-3', at('14:10'));
  const leaving = requestReclaim(setViewer(start, 'tobi'), UNMET_CAMPAIGN, 'backer-1', at('14:20'));
  return [
    ['start', start], ['invoice open', asked], ['all in', full], ['one signed', signed],
    ['paid', checkMint(start, RACE_CAMPAIGN, at('14:05'), 'creator')],
    ['take-back lost the race', checkMint(racing, RACE_CAMPAIGN, at('14:11'), 'creator')],
    ['take-back won the race', checkMint(racing, RACE_CAMPAIGN, at('14:11'), 'owner')],
    ['taking it back', leaving], ['taken back', checkMint(leaving, UNMET_CAMPAIGN, at('14:21'))],
    ['someone leaving while collecting', requestReclaim(setViewer(start, 'maren'), MAIN_CAMPAIGN, 'backer-2', at('14:30'))],
  ];
}

test('the sheet never says paid, reached or at the mint before the state makes it true, for any role', () => {
  let checked = 0;
  for (const [name, world] of worlds()) {
    for (const current of world.campaigns) {
      const id = current.campaign.id;
      for (const pleb of PLEBS) {
        const seen = setViewer(world, pleb);
        const own = record(seen, id);
        const { step, screen } = journeyOf(seen, own);
        assertHonest(reallyContext({ role: 'pleb', at: screen, step, record: own, viewerId: pleb }), own, `${name} · ${id} · ${pleb} on ${screen}`, pleb);
        checked += 1;
      }
      assertHonest(reallyContext({ role: 'organizer', at: 'watch', record: current, maintainer: 'Ngozi' }), current, `${name} · ${id} · organizer`);
      const stage = confirmedPaid(current) ? 'receive' : 'follow';
      assertHonest(reallyContext({ role: 'maintainer', at: stage, record: current, organizer: 'Ada' }), current, `${name} · ${id} · maintainer`);
      checked += 2;
    }
  }
  assert.ok(checked > 100);
});

test('before a stack exists nothing is at the mint and nobody is paid', () => {
  for (const stage of ['who', 'key', 'confirmed', 'pasted', 'terms'] as const) {
    const context = reallyContext({ role: 'organizer', at: stage, maintainer: 'Ngozi' });
    assert.equal(context.now.lead, 'Nothing is at the mint yet.', stage);
    assert.doesNotMatch(said(context), paidClaim, stage);
    assert.equal(context.now.map, undefined);
  }
  for (const stage of ['claim', 'claim-pasted', 'follow'] as const) {
    const text = said(reallyContext({ role: 'maintainer', at: stage, organizer: 'Ada' }));
    assert.doesNotMatch(text, paidClaim, stage);
    assert.doesNotMatch(text, stage === 'follow' ? /All three plebs paid/ : /Your key was made|All three plebs paid/, stage);
  }
  assert.match(said(reallyContext({ role: 'maintainer', at: 'claim', organizer: 'Ada' })), /Confirming makes your key in this browser/);
});

test('organizer on Watch, 2 of 3 in: the sats are at the mint, locked to each pleb, and the close is the way out', () => {
  const world = initialWorld();
  const context = reallyContext({ role: 'organizer', at: 'watch', record: record(world), maintainer: 'Ngozi' });
  assert.deepEqual(context.status, { state: 'collecting', phrase: '2 of 3 in' });
  assert.equal(`${context.now.lead} ${context.now.text}`, '42 of 63 sats are at the mint, each 21 locked to the pleb who paid it. You hold none of it.');
  assert.equal(context.now.term, 'NUT-20 locked mint quote · testnut');
  assert.deepEqual(context.next.steps.map(step => step.text), [
    'One more pleb chips in 21 sats.', 'All three check the payout and sign.',
    'The last signature sends one batch: 63 sats to Ngozi, locked to her key. Paid shows only once the mint confirms.',
  ]);
  assert.deepEqual(context.next.steps.map(step => step.term), ['NUT-20 locked mint quote · testnut', 'NUT-20 signature over the batch', 'NUT-29 batch mint · NUT-11 P2PK']);
  assert.equal(context.next.current, 0);
  assert.match(context.next.aside!.text, /Nobody is paid, and each pleb takes their own 21 sats back\./);
  const map = context.now.map!;
  assert.deepEqual(map.slabs.map(slab => [slab.at, slab.name]), [[1, 'Tobi'], [1, 'Maren'], [0, 'open spot']]);
  assert.deepEqual(map.nodes.map(node => node.name), ['Plebs', 'Mint', 'Ngozi']);
  assert.equal(map.paid, false);
});

test('pleb on Stacked: their own 21 sats at the mint, Ngozi has nothing yet; on Join, still in the wallet', () => {
  const world = setViewer(initialWorld(), 'maren');
  const own = record(world);
  const { step, screen } = journeyOf(world, own);
  assert.equal(screen, 'waiting');
  const context = reallyContext({ role: 'pleb', at: screen, step, record: own, viewerId: 'maren' });
  assert.equal(`${context.now.lead} ${context.now.text}`, 'Your 21 sats are at the mint, locked to your key. Only your key can say where they go. Ngozi has nothing yet.');
  assert.equal(context.next.steps[0].text, 'One more pleb chips in 21 sats.');
  assert.match(context.next.aside!.lead, /Changed your mind/);
  assert.deepEqual(context.now.map!.nodes.map(node => node.name), ['You', 'Mint', 'Ngozi']);
  assert.ok(context.now.map!.slabs.some(slab => slab.own && slab.name === 'You' && slab.at === 1));
  assert.match(said(context), /NUT-20 signature over the batch[\s\S]*NUT-29 batch mint · NUT-11 P2PK/);

  const outside = setViewer(initialWorld(), 'ishaan');
  const join = journeyOf(outside, record(outside));
  const joining = reallyContext({ role: 'pleb', at: join.screen, step: join.step, record: record(outside), viewerId: 'ishaan' });
  assert.equal(`${joining.now.lead} ${joining.now.text}`, 'Your 21 sats are still in your wallet. Nothing is locked yet.');
  assert.doesNotMatch(said(joining), /Your sats are at the mint|You made a key/);
  assert.match(said(joining), /When you chip in, your sats wait at the mint/);
});

test('maintainer on Receive: 63 sats reached her once the mint confirmed; Spend is next, and the map is lime only now', () => {
  const world = checkMint(initialWorld(), RACE_CAMPAIGN, at('14:05'), 'creator');
  const paid = record(world, RACE_CAMPAIGN);
  const context = reallyContext({ role: 'maintainer', at: 'receive', record: paid, organizer: 'Ada' });
  assert.deepEqual(context.status, { state: 'paid', phrase: 'Confirmed by the mint' });
  assert.match(`${context.now.lead} ${context.now.text}`, /^63 sats reached you, locked to your key\. The mint confirmed the batch at .+\. Only your key can spend it\.$/);
  assert.equal(context.next.steps[0].term, 'NUT-03 swap, signed with your key');
  assert.match(said(context), /it only works with your key/);
  assert.equal(context.now.map!.paid, true);
  assert.ok(context.now.map!.slabs.every(slab => slab.at === 2 && slab.tone === 'lit'));
  assert.match(renderToStaticMarkup(createElement(SatsMap, context.now.map!)), /data-paid="true"/);

  const following = reallyContext({ role: 'maintainer', at: 'follow', record: record(initialWorld()), organizer: 'Ada' });
  assert.doesNotMatch(said(following), /reached you|plebs paid/);
  assert.match(said(following), /Once it’s paid, the locked ecash reaches you/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(SatsMap, following.now.map!)), /data-paid|color-signal/);

  const spent = reallyContext({ role: 'maintainer', at: 'spent', record: paid, organizer: 'Ada', spend: { grossSat: 63, receivedSat: 62 } });
  assert.equal(spent.now.lead, '62 sats of ecash only you hold.');
  assert.equal(spent.now.map!.paid, false, 'spent ecash is just hers, not lime');
});

test('the map only names slabs that are someone’s, and keeps the open spot anonymous', () => {
  const world = initialWorld();
  const context = reallyContext({ role: 'organizer', at: 'watch', record: record(world), maintainer: 'Ngozi' });
  const markup = renderToStaticMarkup(createElement(SatsMap, context.now.map!));
  assert.match(markup, /aria-hidden="true"/);
  assert.doesNotMatch(markup, /Ishaan/);
  assert.ok(record(world).slots.filter(isHeld).length === 2);
  const empty = { ...record(world), slots: record(world).slots.map(slot => ({ id: slot.id })) };
  const open = reallyContext({ role: 'organizer', at: 'share', record: empty, maintainer: 'Ngozi' }).now.map!;
  assert.deepEqual(open.slabs.map(slab => slab.name), ['3 open spots', undefined, undefined]);
});
