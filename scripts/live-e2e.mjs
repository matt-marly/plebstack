// Drives the whole pleb journey against testnut in headless Chromium, in a phone viewport:
//   A. three plebs join, pay the real locked invoices, check the payout, sign, send, and the mint confirms: Paid.
//   B. two plebs in, one takes theirs back (with a reload mid-request and Check again), the other gets No payout.
//   C. the payout and a take-back race, and the payout lands first.
//   D. the same race, and the take-back lands first.
// The races are produced by holding one request to the mint until the other one has its answer. Nothing is faked:
// every answer is the mint's.
//
//   node scripts/live-e2e.mjs                 (starts its own dev server)
//   node scripts/live-e2e.mjs http://localhost:5173
//   node scripts/live-e2e.mjs --shots         (also saves a still of every screen into docs/screens-live/)
//
// Writes .evidence/live-e2e-<time>/summary.json. Browser storage is read only to check that no key
// reached the coordinator, the shared board, the page or a screenshot.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { optimisePng } from './png.mjs';

const MINT = 'https://testnut.cashudevkit.org';
const LIME = 'rgb(200, 241, 53)';
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.argv.includes('--shots');
const shotsDir = join(root, 'docs', 'screens-live');
const started = new Date().toISOString();
const dir = join(root, '.evidence', `live-e2e-${started.replace(/[:.]/g, '-')}`);
mkdirSync(dir, { recursive: true });
if (shots) {
  mkdirSync(shotsDir, { recursive: true });
  for (const file of readdirSync(shotsDir)) if (file.endsWith('.png')) rmSync(join(shotsDir, file));
}

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

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const scratch = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const secretKeys = () => page.evaluate(() => Object.keys(localStorage)
  .filter(key => /^plebstack:person:[^/]+\/key:/.test(key))
  .map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));

const board = id => page.evaluate(campaignId => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${campaignId}`)).value, id);
const campaignOf = () => page.url().split('/s/')[1].split('/')[0];
const heading = name => page.getByRole('heading', { level: 1, name });
const dialog = () => page.getByRole('dialog');

// Lime on screen, counted on a scratch page so the app page is left alone.
async function limePixels(png) {
  return scratch.evaluate(async data => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data: px } = context.getImageData(0, 0, image.width, image.height);
    let count = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (Math.abs(px[i] - 200) < 14 && Math.abs(px[i + 1] - 241) < 14 && Math.abs(px[i + 2] - 53) < 24) count += 1;
    }
    return count;
  }, png.toString('base64'));
}

async function limeStyles() {
  return page.evaluate(lime => {
    const props = ['color', 'backgroundColor', 'fill', 'stroke', 'borderTopColor', 'borderBottomColor', 'outlineColor'];
    const found = [];
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      for (const prop of props) if (style[prop] === lime) found.push(`${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''} ${prop}`);
    }
    return found;
  }, LIME);
}

const limeChecked = [];
async function noLime(where) {
  const styles = await limeStyles();
  const pixels = await limePixels(await page.screenshot({ animations: 'disabled' }));
  limeChecked.push(where);
  check(`${where}: no lime before Paid`, styles.length === 0 && pixels === 0, styles[0] ?? (pixels ? `${pixels} lime pixels` : undefined));
}

const shotFiles = [];
const shotLeaks = [];
async function shoot(name, wait = 1200) {
  if (!shots) return;
  await page.waitForTimeout(wait);
  const html = await page.content();
  if ((await secretKeys()).some(secret => html.includes(secret))) shotLeaks.push(name);
  const file = `${name}.png`;
  writeFileSync(join(shotsDir, file), optimisePng(await page.screenshot({ animations: 'disabled' })));
  shotFiles.push(file);
  console.log(`shot ${name}`);
}

// Holds POSTs to one mint path until released, so the other request in a race gets its answer first.
async function hold(path) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let arrive;
  const arrived = new Promise(resolve => { arrive = resolve; });
  const handler = async route => {
    if (route.request().method() !== 'POST' || new URL(route.request().url()).pathname !== path) return route.fallback();
    arrive();
    await gate;
    await route.continue().catch(() => {});
  };
  await page.route(`${MINT}/**`, handler);
  return { arrived, release: async () => { release(); await page.unroute(`${MINT}/**`, handler); } };
}

async function playAs(name) {
  await page.getByRole('button', { name: /^Playing as/ }).click();
  await dialog().getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: `Playing as ${name}` }).waitFor();
}

async function freshStack() {
  await page.getByRole('button', { name: /^Playing as/ }).click();
  await dialog().getByRole('button', { name: 'Open a fresh stack' }).click();
  await page.getByRole('button', { name: 'Chip in 21 sats' }).waitFor();
}

async function chipIn(person, { shotPrefix } = {}) {
  await playAs(person);
  await page.getByRole('button', { name: 'Chip in 21 sats' }).click();
  await page.getByRole('link', { name: 'Open in wallet' }).waitFor({ timeout: 30_000 });
  const invoice = await page.getByRole('link', { name: 'Open in wallet' }).getAttribute('href');
  check(`${person}: a real invoice behind the QR`, /^lightning:ln/.test(invoice ?? '') && await page.locator('svg.qr').isVisible());
  if (shotPrefix) {
    await noLime('P2 pay');
    await shoot('p2-pay');
  }
  await heading('Stacked.').waitFor({ timeout: 90_000 });
  check(`${person}: stacked once the mint reports the invoice paid`, page.url().endsWith('/stacked'));
  if (shotPrefix) {
    await noLime('P3 stacked');
    await shoot('p3-stacked');
  }
}

// P5 for the viewer: wait for the real package check, then sign through the confirm sheet.
async function sign(person, { shotPrefix } = {}) {
  await playAs(person);
  await heading('Everyone’s in. Sign the group card.').waitFor();
  await page.getByText('What your phone checked').waitFor({ timeout: 30_000 });
  if (shotPrefix) {
    await noLime('P5 sign');
    await shoot('p5-sign');
    await page.getByText('What your phone checked').click();
    const checked = await page.locator('.checks').innerText();
    check('P5: the phone’s checks are the real review results',
      ['63 sats in total', 'Every output locked to Ngozi’s key', 'No extra spending conditions', 'The mint’s active keyset',
        'Your own deposit is in this batch', 'PAID · PAID · PAID'].every(text => checked.includes(text)),
      checked.split('\n').filter(Boolean).join(' | '));
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await shoot('p5-checked');
  }
  await page.getByRole('button', { name: 'Sign for the 63-sat payout' }).click();
  await dialog().getByRole('heading', { name: 'Sign the group card?' }).waitFor();
  if (shotPrefix) {
    check('P5s: the sheet says what a signature is and that it can race',
      (await dialog().innerText()).includes('NUT-20 signature over this exact batch')
      && (await dialog().innerText()).includes('If someone takes theirs back first, nothing moves.'));
    await noLime('P5s confirm sheet');
    await shoot('p5s-confirm', 700);
  }
  await dialog().getByRole('button', { name: 'Sign', exact: true }).click();
}

async function takeBack({ confirmText } = {}) {
  await page.getByRole('button', { name: 'Take mine back' }).click();
  if (confirmText) check(confirmText.name, (await dialog().innerText()).includes(confirmText.text));
  await dialog().getByRole('button', { name: 'Take mine back' }).click();
}

const summary = { started, base, campaigns: {} };
try {
  // ---------------------------------------------------------------- A: the stack fills and pays
  await page.goto(`${base}/`);
  await shoot('splash', 250);
  await page.waitForURL(/\/intro\/1$/);
  await shoot('intro-1');
  await page.getByRole('button', { name: 'Next' }).click();
  await shoot('intro-2');
  await page.getByRole('button', { name: 'Next' }).click();
  await shoot('intro-3');
  await noLime('Intro 3');
  await page.getByRole('button', { name: 'Join the demo stack' }).click();
  await page.getByRole('button', { name: 'Chip in 21 sats' }).waitFor();
  const a = summary.campaigns.paid = campaignOf();
  check('A1: the demo stack is open, nobody pre-labelled', (await page.locator('.stack-name').count()) === 0, a);
  await noLime('P1 join');
  await shoot('p1-join');

  await chipIn('Tobi', { shotPrefix: true });
  await page.getByRole('button', { name: 'See who’s in' }).click();
  await heading('Two more plebs and you’re at the line.').waitFor();
  await noLime('P4 waiting');
  await shoot('p4-waiting');
  await page.getByRole('button', { name: 'What’s really happening' }).click();
  const facts = await dialog().innerText();
  check('WRH: the sheet names the signature, the lock and the batch, not the coordinator',
    ['NUT-20 signature over the batch', 'NUT-11 P2PK', 'NUT-29 batch mint'].every(term => facts.includes(term)) && !/key methods/.test(facts));
  await shoot('wrh-sheet', 700);
  await dialog().getByRole('button', { name: 'Got it' }).click();

  await chipIn('Maren');
  await page.reload();
  await page.getByRole('button', { name: 'Playing as Maren' }).waitFor();
  check('A2: after a reload Maren is still playing and still stacked',
    (await page.locator('.stack-name').allTextContents()).includes('You'));
  await chipIn('Ishaan');
  await page.getByRole('button', { name: 'Continue' }).click();

  await sign('Ishaan', { shotPrefix: true });
  await heading('Signed. Waiting for Tobi and Maren.').waitFor();
  check('A3: Ishaan signed, 1 of 3', (await page.locator('.card-head').innerText()).includes('1 of 3 signed'));
  await sign('Tobi');
  await heading('Signed. Waiting for Maren.').waitFor();
  await noLime('P6 signed');
  await shoot('p6-signed');

  const batch = await hold('/v1/mint/bolt11/batch');
  await sign('Maren');
  await batch.arrived;
  await heading('All three signed. Sending.').waitFor();
  check('A4: the last signature sent the batch; Sending, never Paid, while the mint has it',
    !(await page.getByText('Stacked. Paid.').count()) && (await page.locator('.stack-labels').innerText()).includes('signed 3 of 3'));
  await noLime('P7 sending');
  await shoot('p7-sending');
  await batch.release();

  await heading('Stacked. Paid.').waitFor({ timeout: 60_000 });
  const lit = await page.locator('.stack[data-lighting]').count();
  const confirmed = (await board(a)).events.some(event => event.type === 'settled' && event.status === 'confirmed');
  check('A5: Paid only once the mint confirmed, and the moment played on its answer', confirmed && lit === 1);
  check('A6: lime on Paid', (await limeStyles()).length > 0 && await limePixels(await page.screenshot({ animations: 'disabled' })) > 0);
  check('A7: the receipt says who got what, confirmed by the mint',
    (await page.locator('.receipt').innerText()).includes('Ngozi got 63 sats')
    && (await page.locator('.receipt').innerText()).includes('Confirmed by the mint ·'));
  await shoot('p8-paid');
  await page.getByText('Proof details').click();
  const proof = await page.locator('.proof').innerText();
  const quoteIds = (await board(a)).events.filter(event => event.type === 'deposited').map(event => event.quote.id);
  const keysetId = (await board(a)).events.find(event => event.type === 'sent')?.keysetId;
  check('A8: proof details: mint, the three quote ids, keyset, confirmed time, test mint',
    proof.includes(MINT) && quoteIds.length === 3 && quoteIds.every(id => proof.includes(id)) && proof.includes(keysetId)
    && proof.includes('UTC') && proof.includes('Test mint, fake sats'));
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await shoot('p8-proof');
  await page.reload();
  await heading('Stacked. Paid.').waitFor();
  check('A9: after a reload Paid is static, the moment does not replay', (await page.locator('[data-lighting]').count()) === 0);
  await playAs('Tobi');
  await heading('Stacked. Paid.').waitFor();
  check('A10: Tobi sees Paid without a second moment', (await page.locator('[data-lighting]').count()) === 0);

  // ---------------------------------------------------------------- B: no payout, take it back, with a reload
  await freshStack();
  const b = summary.campaigns.unmet = campaignOf();
  await chipIn('Tobi');
  await chipIn('Maren');
  await page.getByRole('button', { name: 'See who’s in' }).click();
  await heading('One more pleb and you’re at the line.').waitFor();
  const reclaim = await hold('/v1/mint/bolt11');
  await takeBack();
  await reclaim.arrived;
  await heading('Taking it back.').waitFor();
  check('B1: Taking back while the mint has it', (await page.locator('.track').getAttribute('aria-label')).endsWith('on the way back to you'));
  await noLime('P10 taking back');
  await shoot('p10-taking-back');
  await page.reload();
  await page.getByRole('button', { name: 'Check again' }).waitFor();
  check('B2: after a reload the unanswered take-back offers Check again', await heading('Taking it back.').isVisible());
  await shoot('p10-check-again');
  await reclaim.release();
  await page.getByRole('button', { name: 'Check again' }).click();
  await heading('Back to you.').waitFor({ timeout: 60_000 });
  const ecash = await page.locator('.ecash').innerText();
  check('B3: back to you, as ecash saved in this browser', ecash.startsWith('cashuB')
    && (await page.locator('.track').getAttribute('aria-label')).endsWith('back with you'));
  await noLime('P10 back to you');
  await shoot('p10-back');

  await playAs('Tobi');
  await heading('No payout this time.').waitFor();
  check('B4: Tobi is told why, honestly', (await page.locator('.lead > p:not(.state-chip)').innerText()).startsWith('Maren took theirs back and the stack closed.'));
  await noLime('P9 no payout');
  await shoot('p9-unmet');
  await takeBack();
  await heading('Back to you.').waitFor({ timeout: 60_000 });
  check('B5: Tobi is back too', (await board(b)).events.filter(event => event.type === 'settled' && event.status === 'confirmed').length === 2);

  // ---------------------------------------------------------------- C: the race, payout first
  await freshStack();
  const c = summary.campaigns.payoutFirst = campaignOf();
  await chipIn('Tobi');
  await chipIn('Maren');
  await chipIn('Ishaan');
  await page.getByRole('button', { name: 'Continue' }).click();
  await sign('Ishaan');
  await heading(/^Signed\. Waiting for/).waitFor();
  await sign('Tobi');
  await heading('Signed. Waiting for Maren.').waitFor();
  const lateReclaim = await hold('/v1/mint/bolt11');
  await takeBack({ confirmText: { name: 'C1: the take-back sheet warns a signed take-back can race', text: 'If the payout reaches the mint first' } });
  await lateReclaim.arrived;
  await heading('Taking it back.').waitFor();
  await sign('Maren');
  await heading('Stacked. Paid.').waitFor({ timeout: 60_000 });
  await lateReclaim.release();
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${id}`)).value.events
    .filter(event => event.type === 'settled').length === 2, c, { timeout: 60_000 });
  await playAs('Tobi');
  await heading('The payout got there first.').waitFor();
  check('C2: the payout won; Tobi’s 21 sats went to Ngozi and the take-back was turned down',
    (await page.locator('.lead > p:not(.state-chip)').innerText()).includes('Your 21 sats went to Ngozi')
    && (await page.locator('.track').getAttribute('aria-label')).endsWith('with Ngozi, locked to her key'));
  await shoot('p10r-race');
  await page.getByRole('button', { name: 'See the receipt' }).click();
  await heading('Stacked. Paid.').waitFor();

  // ---------------------------------------------------------------- D: the race, take-back first
  await freshStack();
  const d = summary.campaigns.reclaimFirst = campaignOf();
  await chipIn('Tobi');
  await chipIn('Maren');
  await chipIn('Ishaan');
  await page.getByRole('button', { name: 'Continue' }).click();
  await sign('Ishaan');
  await heading(/^Signed\. Waiting for/).waitFor();
  await sign('Tobi');
  await heading('Signed. Waiting for Maren.').waitFor();
  const firstReclaim = await hold('/v1/mint/bolt11');
  const lateBatch = await hold('/v1/mint/bolt11/batch');
  await takeBack();
  await firstReclaim.arrived;
  await sign('Maren');
  await lateBatch.arrived;
  await heading('All three signed. Sending.').waitFor();
  await firstReclaim.release();
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${id}`)).value.events
    .some(event => event.type === 'settled' && event.status === 'confirmed'), d, { timeout: 60_000 });
  await lateBatch.release();
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${id}`)).value.events
    .filter(event => event.type === 'settled').length === 2, d, { timeout: 60_000 });
  await heading('No payout this time.').waitFor();
  const settled = (await board(d)).events.filter(event => event.type === 'settled').map(event => event.status);
  check('D1: the take-back landed first and the mint turned the batch down', settled.join() === 'confirmed,rejected', settled.join());
  check('D2: Maren is told the payout didn’t go, and her 21 sats are still hers',
    (await page.locator('.lead > p:not(.state-chip)').innerText()).startsWith('Tobi took theirs back first, so the payout didn’t go.'));
  await noLime('P9 after the race');
  await shoot('p9-race');
  await playAs('Tobi');
  await heading('Your take-back got there first.').waitFor();
  await noLime('P10 take-back first');
  await shoot('p10r-reverse');

  // ---------------------------------------------------------------- everywhere
  const leaked = await page.evaluate(keys => {
    const shared = Object.keys(localStorage).filter(key => /^plebstack:(public|coordinator)\//.test(key))
      .map(key => localStorage.getItem(key)).join('\n');
    return keys.filter(secret => shared.includes(secret) || document.documentElement.outerHTML.includes(secret)).length;
  }, await secretKeys());
  check('Z1: no private key on the board, with the coordinator or on the page', leaked === 0);
  check('Z2: no private key on any screenshotted page', shotLeaks.length === 0, shotLeaks.join(', '));
  check('Z3: no page errors', errors.length === 0, errors.join(' | '));
  summary.limeChecked = limeChecked;
  summary.shots = shotFiles;
  summary.pass = true;
} catch (error) {
  summary.pass = false;
  summary.failure = error.message;
  await page.screenshot({ path: join(dir, 'failure.png'), fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  summary.finished = new Date().toISOString();
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ ...summary, checks }, null, 2) + '\n');
  console.log(`evidence: ${dir}`);
  await browser.close();
  await server?.close();
}
