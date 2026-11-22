// Drives the pleb journey against testnut in headless Chromium: three plebs each chip in, pay the
// real locked invoice, land on Stacked and wait, until the stack is at the line.
//
//   node scripts/live-e2e.mjs                 (starts its own dev server)
//   node scripts/live-e2e.mjs http://localhost:5173
//   node scripts/live-e2e.mjs --shots         (also screenshots each screen into docs/screens-live/)
//
// Writes .evidence/live-e2e-<time>/summary.json. Browser storage is read only to check that no key
// reached the coordinator, the shared board, the page or a screenshot.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { optimisePng } from './png.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.argv.includes('--shots');
const shotsDir = join(root, 'docs', 'screens-live');
const started = new Date().toISOString();
const dir = join(root, '.evidence', `live-e2e-${started.replace(/[:.]/g, '-')}`);
mkdirSync(dir, { recursive: true });
if (shots) mkdirSync(shotsDir, { recursive: true });

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
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const secretKeys = () => page.evaluate(() => Object.keys(localStorage)
  .filter(key => /^plebstack:person:[^/]+\/key:/.test(key))
  .map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));

const shotFiles = [];
const shotLeaks = [];
async function shoot(name) {
  if (!shots) return;
  await page.waitForTimeout(1200);
  const html = await page.content();
  if ((await secretKeys()).some(secret => html.includes(secret))) shotLeaks.push(name);
  const file = `${name}.png`;
  writeFileSync(join(shotsDir, file), optimisePng(await page.screenshot({ animations: 'disabled' })));
  shotFiles.push(file);
  console.log(`shot ${name}`);
}

async function playAs(name) {
  await page.getByRole('button', { name: /^Playing as/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(name) }).click();
}

async function chipIn(person) {
  await page.getByRole('button', { name: 'Chip in 21 sats' }).click();
  await page.getByRole('link', { name: 'Open in wallet' }).waitFor({ timeout: 30_000 });
  const invoice = await page.getByRole('link', { name: 'Open in wallet' }).getAttribute('href');
  check(`${person}: a real invoice behind the QR`, /^lightning:ln/.test(invoice ?? '') && await page.locator('svg.qr').isVisible());
  await shoot(`p2-pay-${person}`);
  await page.getByRole('heading', { name: 'Stacked.' }).waitFor({ timeout: 90_000 });
  check(`${person}: stacked once the mint reports the invoice paid`, page.url().endsWith('/stacked'));
  await shoot(`p3-stacked-${person}`);
}

const summary = { started, base };
try {
  await page.goto(`${base}/`);
  await page.waitForURL(/\/intro\/1$/);
  await shoot('intro-1');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Chip in 21 sats' }).waitFor();
  summary.campaignId = page.url().split('/s/')[1].split('/')[0];
  check('1: the demo stack is open, nobody pre-labelled', (await page.locator('.stack-name').count()) === 0, summary.campaignId);
  await shoot('p1-join');

  await playAs('Tobi');
  await chipIn('tobi');
  await page.getByRole('button', { name: 'See who’s in' }).click();
  await page.getByRole('heading', { name: 'Two more plebs and you’re at the line.' }).waitFor();
  check('2: Tobi waits, two more to go', page.url().endsWith('/waiting'));
  await shoot('p4-waiting');

  await playAs('Maren');
  await chipIn('maren');
  await page.reload();
  await page.getByRole('button', { name: 'Playing as Maren' }).waitFor();
  check('3: after a reload Maren is still playing and still stacked',
    await page.getByRole('button', { name: 'Playing as Maren' }).isVisible() && (await page.locator('.stack-name').allTextContents()).includes('You'));

  await playAs('Ishaan');
  await chipIn('ishaan');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'At the line.' }).waitFor();
  check('4: three locked deposits, the stack is at the line',
    (await page.locator('.stack-labels').innerText()).includes('at the line · 63 of 63 sats'));
  await shoot('at-the-line');

  const leaked = await page.evaluate(keys => {
    const shared = Object.keys(localStorage).filter(key => /^plebstack:(public|coordinator)\//.test(key))
      .map(key => localStorage.getItem(key)).join('\n');
    return keys.filter(secret => shared.includes(secret) || document.documentElement.outerHTML.includes(secret)).length;
  }, await secretKeys());
  check('5: no private key on the board, with the coordinator or on the page', leaked === 0);
  check('6: no private key on any screenshotted page', shotLeaks.length === 0, shotLeaks.join(', '));
  check('7: no page errors', errors.length === 0, errors.join(' | '));
  summary.shots = shotFiles;
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
