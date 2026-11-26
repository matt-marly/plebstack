// Five devices, one stack, against testnut: each person in their own browser context with their own storage,
// talking only through a Nostr relay. Ada starts the stack, Ngozi confirms her key on her own device,
// three plebs open the invite link, each takes their own seat, pays a real invoice and signs. The last signature
// sends the batch, and Ngozi's device receives the payout and spends it.
//
//   node scripts/multi-device.mjs                         (starts a local relay and its own dev server)
//   node scripts/multi-device.mjs --relays wss://nos.lol  (public relays instead)
//
// Checks too that no device's private key ever went to the relay.

import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { startRelay } from './relay.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const flag = process.argv.indexOf('--relays');
let relay;
let relays = flag > 0 ? process.argv[flag + 1] : undefined;
if (!relays) {
  relay = await startRelay(7447);
  relays = relay.url;
}

const server = await createServer({ root, logLevel: 'error', server: { port: 5198, strictPort: true } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const errors = [];
const pages = [];
async function device(name) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  pages.push([name, page]);
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  page.heading = text => page.getByRole('heading', { level: 1, name: text });
  page.who = async () => (await page.getByRole('button', { name: /^Playing as / }).getAttribute('aria-label')).replace('Playing as ', '');
  return page;
}
const withRelays = url => `${url}${url.includes('?') ? '&' : '?'}relays=${encodeURIComponent(relays)}`;
const secretKeys = page => page.evaluate(() => Object.keys(localStorage)
  .filter(key => /^plebstack:person:[^/]+\/key:/.test(key)).map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));

try {
  // Ada's phone: the intro, home, and a new stack.
  const ada = await device('ada');
  await ada.goto(withRelays(`${base}/`));
  await ada.waitForURL(/\/intro\/1$/);
  check('A fresh device opens on the intro', true);
  await ada.getByRole('button', { name: 'Skip the intro' }).click();
  await ada.waitForURL(/\/home$/);
  check('Skipping the intro lands on home with three actions',
    (await ada.locator('.home-action').count()) === 3 && await ada.getByRole('button', { name: /Start a stack/ }).isVisible());
  await ada.getByRole('button', { name: /Start a stack/ }).click();
  await ada.heading('Who are you backing?').waitFor();
  await ada.getByRole('button', { name: 'Next' }).click();
  await ada.heading('Get Ngozi’s key.').waitFor();
  const claimLink = `http://${(await ada.locator('.link-text').innerText()).trim()}`;
  const id = claimLink.split('/claim/')[1];

  // Ngozi's phone: the claim link, her own key.
  const ngozi = await device('ngozi');
  await ngozi.goto(withRelays(claimLink));
  await ngozi.heading('Ada is starting a stack for you.').waitFor({ timeout: 20_000 });
  check('Ngozi’s device opens the claim link as Ngozi', await ngozi.who() === 'Ngozi');
  await ngozi.getByRole('button', { name: 'Confirm my key' }).click();
  await ngozi.heading('Your key is confirmed.').waitFor();

  await ada.heading('Ngozi confirmed her key.').waitFor({ timeout: 20_000 });
  check('Ada’s device hears the key Ngozi made on hers', true);
  await ada.getByRole('button', { name: 'Next' }).click();
  await ada.heading('Set the terms.').waitFor();
  await ada.getByRole('button', { name: '48 hours', exact: true }).click();
  await ada.getByRole('button', { name: 'Create stack' }).click();
  await ada.heading('Your stack is open.').waitFor();
  const invite = `http://${(await ada.locator('.link-text').innerText()).trim()}`;
  check('The invite link is the stack’s own address', invite.endsWith(`/s/${id}`), invite);

  // Three plebs, three phones, one link.
  const plebs = [];
  for (const label of ['first', 'second', 'third']) {
    const page = await device(label);
    await page.goto(withRelays(invite));
    await page.getByRole('button', { name: 'Chip in 21 sats' }).waitFor({ timeout: 20_000 });
    page.name = await page.who();
    plebs.push(page);
  }
  const names = plebs.map(page => page.name);
  check('Each device took its own seat', new Set(names).size === 3 && names.every(name => ['Tobi', 'Maren', 'Ishaan'].includes(name)), names.join(', '));

  for (const page of plebs) {
    await page.getByRole('button', { name: 'Chip in 21 sats' }).click();
    await page.heading('Stacked.').waitFor({ timeout: 90_000 });
    check(`${page.name}: paid a real invoice and stacked`, true);
  }
  // Stacked stays open until each pleb moves on; once all three are in, Continue takes them to Sign.
  for (const page of plebs) {
    if (page.url().endsWith('/stacked')) await page.getByRole('button', { name: 'Continue' }).click({ timeout: 30_000 });
  }

  for (const [index, page] of plebs.entries()) {
    await page.heading('Everyone’s in. Sign the group card.').waitFor({ timeout: 30_000 });
    await page.getByText('What your phone checked').waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Sign for the 63-sat payout' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign', exact: true }).click();
    if (index < 2) await page.heading(/^Signed\. Waiting for /).waitFor({ timeout: 30_000 });
  }
  for (const page of plebs) await page.heading('Stacked. Paid.').waitFor({ timeout: 90_000 });
  check('Every pleb’s device shows Paid once the mint confirmed', true);

  await ngozi.heading('63 sats for you.').waitFor({ timeout: 30_000 });
  check('Ngozi’s device received the 63-sat payout', true);
  await ngozi.getByRole('button', { name: 'Spend', exact: true }).click();
  await ngozi.heading(/^Yours\. \d+ sats\.$/).waitFor({ timeout: 60_000 });
  check('Ngozi spent it with her own key on her own device', true);

  const keys = (await Promise.all([ada, ngozi, ...plebs].map(secretKeys))).flat();
  check('Each pleb and Ngozi made a key on their own device, and Ada none', (await secretKeys(ada)).length === 0 && keys.length >= 4);
  if (relay) {
    const published = JSON.stringify(relay.events);
    check('No private key ever went to the relay', keys.every(key => !published.includes(key)), `${relay.events.length} events`);
  }
} catch (error) {
  check('the run finished', false, error.message.split('\n')[0]);
  const shots = process.env.SHOTS_DIR;
  for (const [name, page] of shots ? pages : []) {
    await page.screenshot({ path: `${shots}/fail-${name}.png`, fullPage: true }).catch(() => undefined);
    console.log(name, page.url(), (await page.locator('h1').first().innerText().catch(() => '?')));
  }
} finally {
  check('No page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  await server.close();
  await relay?.close();
}

const failed = results.filter(result => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
