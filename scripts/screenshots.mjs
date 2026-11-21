// Captures every screen of the prototype into docs/screens/.
//
//   npm run dev            (in one terminal)
//   npm run screenshots    (in another; pass a different base URL as the first argument)
//
// Uses the Chromium that ships with Playwright (`npx playwright install chromium`),
// and falls back to an installed Chrome if that download is missing.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const only = process.argv[3];
const outDir = fileURLToPath(new URL('../docs/screens/', import.meta.url));

const viewports = {
  desktop: { width: 1280, height: 900 },
  phone: { width: 390, height: 844 },
};

const main = '/campaigns/pocket-ical-412';
const unmet = '/campaigns/pocket-ical-388';
const race = '/campaigns/pocket-ical-401';

async function fillCampaign(page) {
  await page.getByLabel('Title').fill('Fix daylight-saving drift in recurring events');
  await page.getByLabel('Public link').fill('https://git.example.org/ngozi/pocket-ical/issues/412');
  await page.getByLabel(/checked this key/).check();
}

// name, path, then options: beat, as (person), theme, device, view (viewport only), before (set-up steps)
const shots = [
  ['home', '/'],
  ['home', '/', { theme: 'dark' }],
  ['home', '/', { device: 'phone' }],

  ['create', '/campaigns/new', { as: 'ngozi', before: fillCampaign }],
  ['create-errors', '/campaigns/new', { as: 'ngozi', before: page => page.getByRole('button', { name: 'Create campaign' }).click() }],
  ['create', '/campaigns/new', { as: 'ngozi', device: 'phone', before: fillCampaign }],

  ['campaign-collecting', main],
  ['campaign-collecting', main, { device: 'phone' }],
  ['campaign-ready', main, { beat: 'ready' }],
  ['campaign-ready', main, { beat: 'ready', theme: 'dark' }],
  ['campaign-ready', main, { beat: 'ready', device: 'phone' }],
  ['campaign-approved', main, { beat: 'approved' }],
  ['campaign-approved', main, { beat: 'approved', device: 'phone' }],
  ['campaign-paying-out', main, { beat: 'paying-out' }],
  ['campaign-paid', main, { beat: 'paid' }],
  ['campaign-unmet', unmet],
  ['campaign-unmet', unmet, { theme: 'dark' }],
  ['campaign-after-reclaim-won', race, { beat: 'race-reclaim-wins' }],

  ['back-join', `${main}/back`],
  ['back-awaiting-deposit', `${main}/back`, { beat: 'joining' }],
  ['back-awaiting-deposit', `${main}/back`, { beat: 'joining', device: 'phone' }],

  ['deposit-deposited', `${main}/deposits/backer-3`, { beat: 'ready' }],
  ['deposit-approved', `${main}/deposits/backer-3`, { beat: 'approved' }],
  ['deposit-paying-out', `${race}/deposits/backer-3`],
  ['deposit-someone-elses', `${main}/deposits/backer-1`],

  ['approve-review', `${main}/deposits/backer-3/approve`, { beat: 'reviewing' }],
  ['approve-review', `${main}/deposits/backer-3/approve`, { beat: 'reviewing', device: 'phone' }],
  ['approve-confirm', `${main}/deposits/backer-3/approve`, {
    beat: 'reviewing', view: true, before: page => page.getByRole('button', { name: 'Release signature…' }).click(),
  }],
  ['approve-confirm', `${main}/deposits/backer-3/approve`, {
    beat: 'reviewing', view: true, theme: 'dark', before: page => page.getByRole('button', { name: 'Release signature…' }).click(),
  }],
  ['approve-stopped', `${main}/deposits/backer-3/approve`, { beat: 'stopped' }],

  ['payout-paying-out', `${main}/payout`, { beat: 'paying-out' }],
  ['payout-paying-out', `${main}/payout`, { beat: 'paying-out', device: 'phone' }],
  ['payout-paid', `${main}/payout`, { beat: 'paid' }],
  ['payout-paid', `${main}/payout`, { beat: 'paid', theme: 'dark' }],
  ['payout-paid', `${main}/payout`, { beat: 'paid', device: 'phone' }],
  ['payout-not-sent', `${main}/payout`],

  ['reclaim-unmet', `${unmet}/deposits/backer-2/reclaim`],
  ['reclaim-confirm', `${unmet}/deposits/backer-2/reclaim`, {
    view: true, before: page => page.getByRole('button', { name: 'Take mine back…' }).click(),
  }],
  ['reclaim-reclaiming', `${unmet}/deposits/backer-2/reclaim`, { beat: 'reclaiming' }],
  ['reclaim-reclaimed', `${unmet}/deposits/backer-2/reclaim`, { beat: 'reclaimed' }],
  ['reclaim-reclaimed', `${unmet}/deposits/backer-2/reclaim`, { beat: 'reclaimed', theme: 'dark' }],
  ['reclaim-reclaimed', `${unmet}/deposits/backer-2/reclaim`, { beat: 'reclaimed', device: 'phone' }],
  ['reclaim-race-warning', `${race}/deposits/backer-3/reclaim`],
  ['reclaim-race-reclaiming', `${race}/deposits/backer-3/reclaim`, { beat: 'race-reclaiming' }],
  ['reclaim-race-payout-won', `${race}/deposits/backer-3/reclaim`, { beat: 'race-payout-wins' }],
  ['reclaim-race-reclaim-won', `${race}/deposits/backer-3/reclaim`, { beat: 'race-reclaim-wins' }],

  ['recovery', '/recovery'],
  ['recovery-timed-out', '/recovery', { beat: 'timed-out' }],
  ['recovery-timed-out', '/recovery', { beat: 'timed-out', theme: 'dark' }],
  ['recovery-settled', '/recovery', { beat: 'race-payout-wins' }],
  ['recovery', '/recovery', { device: 'phone' }],

  ['demo-control', main, { beat: 'two-of-three', demo: true, view: true }],
  ['demo-control', `${main}/payout`, { beat: 'paid', demo: true, view: true, device: 'phone' }],
  ['not-found', '/nothing-here'],
];

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}

const browser = await launch();
await mkdir(outDir, { recursive: true });
let count = 0;

for (const [name, path, options = {}] of shots) {
  const { beat, as, theme = 'light', device = 'desktop', view = false, demo = false, before } = options;
  const file = `${name}${device === 'phone' ? '-phone' : ''}-${theme}.png`;
  if (only && !file.includes(only)) continue;

  const context = await browser.newContext({
    viewport: viewports[device],
    deviceScaleFactor: 2,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const query = new URLSearchParams({ ...(demo && { demo: '1' }), ...(beat && { beat }) }).toString();
  await page.goto(`${base}${path}${query ? `?${query}` : ''}`, { waitUntil: 'networkidle' });
  if (as) await page.getByLabel('Viewing as').selectOption(as);
  if (before) await before(page);
  await page.screenshot({ path: `${outDir}${file}`, fullPage: !view });
  await context.close();
  count += 1;
  console.log(file);
}

await browser.close();
console.log(`${count} screenshots in docs/screens/`);
