// Drives the live UI against testnut in headless Chromium: create a campaign, three joins,
// three signatures, then the payout, until the page shows Paid with a receipt.
//
//   node scripts/live-e2e.mjs                 (starts its own dev server)
//   node scripts/live-e2e.mjs http://localhost:5173
//   node scripts/live-e2e.mjs --shots         (also screenshots each step into docs/screens-live/)
//
// Writes .evidence/live-e2e-<time>/summary.json and a screenshot of the receipt. Browser storage
// is read only to check that no key reached the coordinator, the shared board, the evidence or a screenshot.
// With --shots, a second campaign is collected, stopped and reclaimed for the unmet screens, and the
// payout batch is held back in the browser until the paying-out screens are taken.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { optimisePng } from './png.mjs';

const MINT = 'https://testnut.cashudevkit.org';
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.argv.includes('--shots');
const shotsDir = join(root, 'docs', 'screens-live');
const started = new Date().toISOString();
const dir = join(root, '.evidence', `live-e2e-${started.replace(/[:.]/g, '-')}`);
mkdirSync(dir, { recursive: true });

const checks = {};
function check(name, pass, detail) {
  checks[name] = { pass: Boolean(pass), ...(detail ? { detail } : {}) };
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!pass) throw new Error(`Check failed: ${name}`);
}

let server;
let base = process.argv.slice(2).find(arg => !arg.startsWith('--'))?.replace(/\/$/, '');
if (!base) {
  server = await createServer({ root, logLevel: 'error', server: { port: 5199 } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const viewAs = person => page.getByLabel('Viewing as').selectOption(person);
// A fresh load each time also proves the campaign is rebuilt from storage.
async function openCampaign(id, person) {
  await page.goto(`${base}/campaigns/${id}?live=1`);
  await viewAs(person);
}

const secretKeys = () => page.evaluate(() => Object.keys(localStorage)
  .filter(key => /^plebstack:person:[^/]+\/key:/.test(key))
  .map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));

// Every step in night and paper, desktop and phone. The page is checked for any private key first.
const sizes = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const themes = { night: 'dark', paper: 'light' };
const shotFiles = [];
const shotLeaks = [];
async function shoot(name) {
  if (!shots) return;
  const html = await page.content();
  if ((await secretKeys()).some(secret => html.includes(secret))) shotLeaks.push(name);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  for (const [themeName, value] of Object.entries(themes)) {
    for (const [device, size] of Object.entries(sizes)) {
      await page.setViewportSize(size);
      await page.evaluate(next => { document.documentElement.dataset.theme = next; }, value);
      const file = `${name}-${themeName}-${device}.png`;
      writeFileSync(join(shotsDir, file), optimisePng(await page.screenshot({ fullPage: true, animations: 'disabled' })));
      shotFiles.push(file);
    }
  }
  await page.setViewportSize(sizes.desktop);
  await page.evaluate(previous => { document.documentElement.dataset.theme = previous; }, theme);
  console.log(`shot ${name}`);
}

const campaigns = {
  main: { title: 'Fix DST drift in pocket-ical recurring events', url: 'https://codeberg.org/ngozi/pocket-ical/issues/412' },
  unmet: { title: 'Add Nostr login to a self-hosted invoice app', url: 'https://codeberg.org/ngozi/ledgerline/issues/57' },
};

async function createCampaign({ title, url }) {
  await page.goto(`${base}/?live=1`);
  await viewAs('ngozi');
  await page.getByRole('link', { name: 'Start a campaign' }).first().click();
  const key = await page.getByLabel('Maintainer’s public key').inputValue();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Public link').fill(url);
  await page.getByLabel(/checked this key/).check();
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await page.waitForURL(/\/campaigns\/(?!new)[^/]+$/);
  return { key, id: decodeURIComponent(new URL(page.url()).pathname.split('/').pop()) };
}

async function joinWith(id, person) {
  await openCampaign(id, person);
  await page.getByRole('link', { name: 'Join with 21 sats' }).click();
  await page.getByRole('button', { name: 'Create deposit invoice' }).click();
  await page.getByRole('heading', { name: 'Pay the invoice' }).waitFor({ timeout: 30_000 });
  await page.waitForURL(/\/deposits\/backer-\d$/, { timeout: 180_000 });
  return (await page.locator('.fact').filter({ has: page.locator('dt', { hasText: 'Quote ID' }) }).locator('dd').innerText()).trim();
}

let campaignId;
let releaseBatch;
const summary = { mint: MINT, base, started };

try {
  if (shots) mkdirSync(shotsDir, { recursive: true });
  const created = await createCampaign(campaigns.main);
  const key = created.key;
  check('1: maintainer key made in this browser, only the pubkey shown', /^0[23][0-9a-f]{64}$/.test(key), key);
  campaignId = created.id;
  summary.campaignId = campaignId;
  summary.maintainerPubkey = key;
  check('2: campaign created', campaignId.startsWith('fix-dst-drift'), campaignId);

  // With every storage write refused, joining stops before any request to the mint and says so.
  await openCampaign(campaignId, 'ishaan');
  await page.getByRole('link', { name: 'Join with 21 sats' }).click();
  const mintRequests = [];
  const onRequest = request => { if (request.url().startsWith(MINT)) mintRequests.push(request.url()); };
  page.on('request', onRequest);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Create deposit invoice' }).click();
  const refused = page.getByRole('alert').filter({ hasText: 'Couldn’t save on this device. Nothing was sent to the mint.' });
  await refused.waitFor({ timeout: 10_000 });
  page.off('request', onRequest);
  check('2b: a refused save shows plain copy and sends nothing to the mint', mintRequests.length === 0, `${mintRequests.length} mint requests`);

  // Viewing as survives a reload.
  await page.goto(`${base}/?live=1`);
  await viewAs('maren');
  await page.reload();
  check('2c: Viewing as persists across a reload', await page.getByLabel('Viewing as').inputValue() === 'maren');

  const quotes = {};
  for (const person of ['ishaan', 'tobi', 'maren']) {
    const quoteId = await joinWith(campaignId, person);
    quotes[person] = quoteId;
    check(`3: ${person} deposit PAID at the mint`,
      /^[0-9a-f-]{36}$/.test(quoteId) && await page.getByText(/^Paid and unissued\./).isVisible(), quoteId);
    if (person === 'tobi' && shots) {
      await openCampaign(campaignId, 'tobi');
      await shoot('campaign-collecting');
    }
  }
  summary.quotes = quotes;
  if (shots) {
    await openCampaign(campaignId, 'ishaan');
    await page.locator('.goal[data-phase="at-line"]').waitFor();
    await shoot('campaign-ready');
  }

  for (const [i, person] of ['ishaan', 'tobi', 'maren'].entries()) {
    await openCampaign(campaignId, person);
    await page.getByRole('link', { name: 'Check and sign' }).click();
    const passed = page.getByText(/^Outputs checked on this device:/);
    await passed.waitFor({ timeout: 60_000 });
    const checked = (await page.locator('.checks').innerText()).split('\n').filter(Boolean);
    const line = (await passed.innerText()).replace(/\s+/g, ' ');
    summary[`${person}Checks`] = [line, ...checked];
    if (i === 0) await shoot('approve-check');
    check(`4: ${person} checked the outputs on their own device`,
      /63 sats, keyset [0-9a-f]+, locked to Ngozi’s key/.test(line) && checked.some(text => /add up to 63 sats/.test(text))
      && checked.some(text => /PAID, PAID, PAID/.test(text)), line);
    if (i === 2 && shots) {
      // Hold the batch in the browser so the paying-out screens can be taken; it's sent unchanged after.
      const held = new Promise(resolve => { releaseBatch = resolve; });
      await page.route('**/v1/mint/bolt11/batch', async route => { await held; await route.continue(); });
    }
    await page.getByRole('button', { name: 'Release signature…' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Release signature' }).click();
    if (i < 2) {
      await page.getByText('Signed. You can’t take this back.').waitFor({ timeout: 30_000 });
      check(`5: ${person} signed`, true);
    }
  }

  await page.waitForURL(/\/payout$/, { timeout: 30_000 });
  if (releaseBatch) {
    await page.locator('.state[data-state="paying out"]').waitFor({ timeout: 30_000 });
    await shoot('payout-paying-out');
    releaseBatch();
  }
  const paidMeta = () => page.locator('.state-meta', { hasText: 'paid · confirmed by the mint' });
  await paidMeta().waitFor({ timeout: 90_000 });
  check('5: maren signed; the third signature sent the batch', true);
  const head = await page.locator('.page-purpose').innerText();
  check('6: Paid only after the mint confirmed', /^Stacked\. Paid\. 63 sats from 3 plebs to Ngozi Eze\. Confirmed by the mint at/.test(head), head);

  const receipt = await page.locator('.receipt-foot').innerText();
  summary.receipt = receipt.split('\n');
  check('7: receipt names the mint, all three quotes, the keyset and the confirmed time',
    receipt.includes(`Mint ${MINT}`) && Object.values(quotes).every(id => receipt.includes(id))
    && /Keyset [0-9a-f]{16}/.test(receipt) && /Confirmed \d+ \w+, \d\d:\d\d [A-Z]+[+-]?[\d:]*/.test(receipt), summary.receipt.join(' | '));
  await page.screenshot({ path: join(dir, 'payout-paid.png'), fullPage: true });
  await shoot('receipt');

  await page.goto(`${base}/campaigns/${campaignId}/payout?live=1`);
  await paidMeta().waitFor({ timeout: 10_000 });
  check('8: still Paid after a reload, rebuilt from storage', true);
  if (shots) {
    await openCampaign(campaignId, 'ishaan');
    await page.locator('.goal[data-phase="paid"]').waitFor();
    await shoot('campaign-paid');
  }

  const storage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])));
  const secrets = Object.entries(storage)
    .filter(([key]) => /^plebstack:person:[^/]+\/key:/.test(key))
    .map(([, value]) => JSON.parse(value).value.secretKey);
  const shared = Object.entries(storage).filter(([key]) => /^plebstack:(coordinator|public)\//.test(key));
  check('9: four people hold one key each in their own namespace', secrets.length === 4
    && new Set(Object.keys(storage).filter(key => key.includes('/key:')).map(key => key.split('/')[0])).size === 4, `${secrets.length} keys`);
  check('10: the coordinator and the shared board hold no key',
    shared.every(([key, value]) => !/\/(key|owner):/.test(key) && secrets.every(secret => !value.includes(secret))), `${shared.length} records`);
  summary.storageNamespaces = [...new Set(Object.keys(storage).map(key => key.split('/')[0]))].sort();
  summary.pageErrors = errors;
  check('11: no page errors', errors.length === 0, errors.join(' | '));

  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ ...summary, checks }, null, 2) + '\n');
  const leaked = readdirSync(dir).filter(file => {
    const text = readFileSync(join(dir, file), file.endsWith('.json') ? 'utf8' : 'latin1');
    return secrets.some(secret => text.includes(secret));
  });
  check('12: no private key written to evidence', leaked.length === 0, leaked.join(', ') || `${secrets.length} keys searched`);

  if (shots) {
    const unmet = await createCampaign(campaigns.unmet);
    summary.unmetCampaignId = unmet.id;
    for (const person of ['ishaan', 'tobi']) await joinWith(unmet.id, person);
    await openCampaign(unmet.id, 'ngozi');
    await page.getByRole('button', { name: 'Stop collecting' }).click();
    await openCampaign(unmet.id, 'ishaan');
    await page.getByRole('link', { name: 'Take mine back' }).click();
    await page.getByRole('button', { name: 'Take mine back…' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Take mine back' }).click();
    await page.locator('.state[data-state="reclaimed"]').waitFor({ timeout: 60_000 });
    check('13: unmet campaign, deposit reclaimed at the mint', true, unmet.id);
    await shoot('reclaim-reclaimed');
    await openCampaign(unmet.id, 'ishaan');
    await page.locator('.goal[data-phase="unmet"]').waitFor();
    await shoot('campaign-unmet');
    await page.goto(`${base}/?live=1`);
    await viewAs('ishaan');
    await shoot('home');
    summary.shots = shotFiles;
    check('14: no private key on any screenshotted page', shotLeaks.length === 0, shotLeaks.join(', ') || `${shotFiles.length} files`);
    check('15: no page errors while taking screenshots', errors.length === 0, errors.join(' | '));
  }
  summary.pass = true;
} catch (error) {
  summary.pass = false;
  summary.failure = error.message;
  await page.screenshot({ path: join(dir, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  summary.finished = new Date().toISOString();
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ ...summary, checks }, null, 2) + '\n');
  console.log(`evidence: ${dir}`);
  await browser.close();
  await server?.close();
}
