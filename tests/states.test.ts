import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePath, matchPath } from 'react-router-dom';
import { TEST_MINT, type Campaign, type Deposit } from '../src/domain/models';
import { campaignState, confirmedStates, signalStates, stateCopy, transitionDeposit } from '../src/domain/states';
import { ProtocolError, createProtocolClient, protocol } from '../src/protocol/client';
import { memoryStorage } from '../src/protocol/storage';
import { paths, routes } from '../src/routes';

function deposit(id = '1'): Deposit {
  return { id, campaignId: 'campaign', state: 'deposited', authorizationReleased: false,
    newApprovalsStopped: false, quote: { id: `quote-${id}`, mint: TEST_MINT, ownerPubkey: 'public-key',
      amountSat: 21, invoice: 'invoice', mintState: 'PAID' } };
}
const terms = { maintainer: { name: 'Ngozi Eze', short: 'Ngozi' }, amountSat: 21 };
const campaign: Campaign = { id: 'campaign', title: 'Public episode', publicWorkUrl: 'https://example.org/episode',
  mint: TEST_MINT, beneficiaryPubkey: 'creator-public-key', backerCount: 3, contributionSat: 21,
  collectionStopped: false, depositIds: ['1', '2', '3'] };

test('stopping new approvals does not revoke a released signature', () => {
  const approved = transitionDeposit(deposit(), { type: 'release-authorization' });
  const stopped = transitionDeposit(approved, { type: 'stop-local-approval' });
  assert.equal(stopped.state, 'approved');
  assert.equal(stopped.authorizationReleased, true);
  assert.match(stateCopy.approved.sentence(terms), /can’t take it back\. A reclaim can still race the payout/);
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

test('each of the seven states keeps its plain word, with a pleb phrase and a sentence under it', () => {
  assert.deepEqual(Object.values(stateCopy).map(copy => copy.word),
    ['Deposited', 'Ready', 'Approved', 'Paying out', 'Paid', 'Reclaiming', 'Reclaimed']);
  assert.deepEqual(Object.values(stateCopy).map(copy => copy.phrase),
    ['Stacked', 'At the line', 'Signed', 'Sending', 'Stacked. Paid.', 'Unstacking', 'Back to you']);
  for (const copy of Object.values(stateCopy)) {
    assert.ok(copy.icon);
    assert.match(copy.sentence(terms), /^[A-Z0-9].*\.$/);
  }
  assert.equal(stateCopy.deposited.sentence(terms), '21 sats at the mint, locked to your key. Not paid to Ngozi.');
  assert.equal(stateCopy.paid.sentence(terms), 'Paid to Ngozi Eze. Confirmed by the mint.');
  assert.match(stateCopy['paying out'].sentence(terms), /Not paid until the mint confirms/);
  assert.deepEqual([...confirmedStates], ['paid', 'reclaimed']);
  assert.deepEqual([...signalStates], ['paid']);
});

test('every route and every journey screen has a path that matches it', () => {
  for (const path of Object.values(routes)) {
    assert.ok(matchPath(path, generatePath(path, { campaignId: 'campaign', page: '1', screen: 'pay' })), path);
  }
  for (const screen of ['join', 'pay', 'stacked', 'waiting', 'sign', 'signed', 'sending', 'paid', 'race', 'unmet', 'back'] as const) {
    assert.equal(matchPath(routes.screen, paths.screen('campaign', screen))?.params.screen, screen);
  }
});

test('nothing manufactures a funded quote: bad keys, unknown quotes and unknown requests are refused unsent', async () => {
  await assert.rejects(protocol.createQuote({ mint: TEST_MINT, amountSat: 21, ownerPubkey: 'public-key' }),
    /not a valid compressed public key/);
  const fetch = async () => { throw new Error('nothing should be sent'); };
  const client = createProtocolClient({ storage: memoryStorage(), fetch });
  await assert.rejects(client.recover('op-missing'), (error: ProtocolError) => error.kind === 'unknown-operation');
  await assert.rejects(client.reclaim('quote-missing', 'op-1'), (error: ProtocolError) => error.kind === 'not-owner');
});
