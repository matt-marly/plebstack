import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generatePath, matchPath } from 'react-router-dom';
import { TEST_MINT, type Campaign, type Deposit } from '../src/domain/models';
import { campaignState, confirmedStates, stateCopy, transitionDeposit } from '../src/domain/states';
import { protocol } from '../src/protocol/client';
import { routes } from '../src/routes';

function deposit(id = '1'): Deposit {
  return { id, campaignId: 'campaign', state: 'deposited', authorizationReleased: false,
    newApprovalsStopped: false, quote: { id: `quote-${id}`, mint: TEST_MINT, ownerPubkey: 'public-key',
      amountSat: 21, invoice: 'invoice', mintState: 'PAID' } };
}
const campaign: Campaign = { id: 'campaign', title: 'Public episode', publicWorkUrl: 'https://example.org/episode',
  mint: TEST_MINT, beneficiaryPubkey: 'creator-public-key', backerCount: 3, contributionSat: 21,
  collectionStopped: false, depositIds: ['1', '2', '3'] };

test('stopping new approvals does not revoke a released signature', () => {
  const approved = transitionDeposit(deposit(), { type: 'release-authorization' });
  const stopped = transitionDeposit(approved, { type: 'stop-local-approval' });
  assert.equal(stopped.state, 'approved');
  assert.equal(stopped.authorizationReleased, true);
  assert.match(stateCopy.approved.sentence, /reclaim can still race payout/);
  const unpaid = transitionDeposit(deposit(), { type: 'stop-local-approval' });
  assert.throws(() => transitionDeposit(unpaid, { type: 'release-authorization' }));
});

test('batch can win after reclaim begins; only confirmed issuance settles it', () => {
  const approved = transitionDeposit(deposit(), { type: 'release-authorization' });
  const reclaiming = transitionDeposit(approved, { type: 'request-reclaim' });
  assert.equal(reclaiming.state, 'reclaiming');
  assert.equal(reclaiming.quote.mintState, 'PAID');
  const paid = transitionDeposit(reclaiming, { type: 'mint-confirmed', destination: 'creator' });
  assert.equal(paid.state, 'paid');
  assert.throws(() => transitionDeposit(paid, { type: 'mint-confirmed', destination: 'owner' }));
});

test('owner reclaim can win and terminal reclaimed cannot become paid', () => {
  const approved = transitionDeposit(deposit(), { type: 'release-authorization' });
  const reclaiming = transitionDeposit(approved, { type: 'request-reclaim' });
  const reclaimed = transitionDeposit(reclaiming, { type: 'mint-confirmed', destination: 'owner' });
  assert.equal(reclaimed.state, 'reclaimed');
  assert.throws(() => transitionDeposit(reclaimed, { type: 'mint-confirmed', destination: 'creator' }));
});

test('cannot confirm a creator issuance without authorization', () => {
  assert.throws(() => transitionDeposit(deposit(), { type: 'mint-confirmed', destination: 'creator' }));
  assert.throws(() => transitionDeposit(deposit(), { type: 'submit-payout' }));
});

test('readiness needs three distinct matching paid quotes and verified outputs', () => {
  const deposits = ['1', '2', '3'].map(deposit);
  assert.equal(campaignState(campaign, deposits), 'collecting');
  assert.equal(campaignState(campaign, deposits, true), 'ready');
  deposits[2].quote.id = deposits[1].quote.id;
  assert.equal(campaignState(campaign, deposits, true), 'collecting');
  deposits[2].quote.id = 'different';
  deposits[2].quote.amountSat = 700;
  assert.equal(campaignState(campaign, deposits, true), 'collecting');
});

test('one reclaimed quote breaks readiness without relabeling other deposits', () => {
  const deposits = ['1', '2', '3'].map(deposit);
  deposits[0] = transitionDeposit(transitionDeposit(deposits[0], { type: 'request-reclaim' }),
    { type: 'mint-confirmed', destination: 'owner' });
  assert.equal(campaignState(campaign, deposits, true), 'unmet');
  assert.equal(deposits[1].state, 'deposited');
});

test('a rejected batch returns approved deposits to deposited and drops the signature', () => {
  const approved = transitionDeposit(deposit(), { type: 'release-authorization' });
  const submitted = transitionDeposit(approved, { type: 'submit-payout' });
  for (const lost of [approved, submitted]) {
    const back = transitionDeposit(lost, { type: 'batch-rejected' });
    assert.equal(back.state, 'deposited');
    assert.equal(back.authorizationReleased, false);
    assert.equal(back.quote.mintState, 'PAID');
    assert.equal(transitionDeposit(back, { type: 'release-authorization' }).state, 'approved');
  }
  assert.throws(() => transitionDeposit(deposit(), { type: 'batch-rejected' }));
  assert.throws(() => transitionDeposit(transitionDeposit(deposit(), { type: 'request-reclaim' }), { type: 'batch-rejected' }));
});

test('each of the seven states has a word, an icon and a sentence that opens with the word', () => {
  const states = Object.keys(stateCopy);
  assert.equal(states.length, 7);
  for (const copy of Object.values(stateCopy)) {
    assert.ok(copy.word && copy.icon);
    assert.ok(copy.sentence.startsWith(copy.word), copy.sentence);
  }
  assert.deepEqual([...confirmedStates], ['paid', 'reclaimed']);
});

test('every documented route has a shell path', () => {
  const document = readFileSync(new URL('../docs/ia-userflows.md', import.meta.url), 'utf8');
  for (const path of Object.values(routes)) {
    assert.ok(document.includes('`' + path + '`'), path);
    assert.ok(matchPath(path, generatePath(path, { campaignId: 'campaign', depositId: '1' })));
  }
});

test('nothing manufactures a funded quote: bad keys are refused and payout calls are not connected', async () => {
  await assert.rejects(protocol.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: 'public-key' }),
    /not a valid compressed public key/);
  await assert.rejects(protocol.recover({} as never), /not connected/);
});
