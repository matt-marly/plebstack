// Drives every journey against testnut in headless Chromium, in a phone viewport:
//   A. Ada starts a stack, Ngozi confirms her key on her own side, three plebs join, pay the real locked invoices,
//      check the payout and sign; the last signature sends it and the mint confirms: Paid. Ngozi receives the locked
//      payout, spends it with a real swap and copies her ecash.
//   B. two plebs in, one takes theirs back (with a reload mid-request and Check again), the other gets No payout.
//   C. the payout and a take-back race, and the payout lands first.
//   D. the same race, and the take-back lands first.
//   E. the close passes with two of three in: No payout, and each takes theirs back. Time is moved with the
//      browser's own clock control, so nothing in the app has a test switch.
// On every checked screen: each control named, headings in order, AA contrast from the computed colours, 44px targets,
// a live region and a focus ring that is never lime; the sheets trap focus; Reduce Motion shows Paid at once.
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
import { getDecodedToken } from '@cashu/cashu-ts';
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
  // The stage stills come from scripts/stage-demo.mjs and stay.
  for (const file of readdirSync(shotsDir)) if (file.endsWith('.png') && !file.startsWith('stage-')) rmSync(join(shotsDir, file));
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
const errors = [];
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] };
async function phonePage(context) {
  const opened = await context.newPage();
  opened.on('pageerror', error => errors.push(error.message));
  return opened;
}
let page = await phonePage(await browser.newContext(phone));
const scratch = await browser.newPage();

const secretKeys = () => page.evaluate(() => Object.keys(localStorage)
  .filter(key => /^plebstack:person:[^/]+\/key:/.test(key))
  .map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));

const board = id => page.evaluate(campaignId => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${campaignId}`)).value, id);
const campaignOf = () => page.url().split(/\/(?:s|o|m|claim)\//)[1].split('/')[0];
const storageKeys = prefix => page.evaluate(start => Object.keys(localStorage).filter(key => key.startsWith(start)), prefix);
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
  await a11y(where);
}

// Accessibility on every checked screen, with no extra tools: Playwright's aria snapshot for names and headings,
// and the computed colours for contrast.
const a11yChecked = [];
async function a11y(where) {
  const tree = await page.locator('body').ariaSnapshot();
  const unnamed = tree.split('\n').filter(line => /^\s*- (button|link|textbox|checkbox|radio|combobox|switch|img|slider)(\s*\[[^\]]*\])?:?\s*$/.test(line));
  const levels = [...tree.matchAll(/- heading "[^"]*" \[level=(\d)\]/g)].map(match => Number(match[1]));
  const ordered = levels[0] === 1 && levels.filter(level => level === 1).length === 1 && levels.every((level, i) => i === 0 || level <= levels[i - 1] + 1);
  const found = await page.evaluate(() => {
    const parse = value => {
      const rgb = value.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
      if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
      const srgb = value.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/);
      if (srgb) return [srgb[1] * 255, srgb[2] * 255, srgb[3] * 255, srgb[4] === undefined ? 1 : +srgb[4]];
      return undefined;
    };
    const mix = (top, ground) => top.slice(0, 3).map((value, i) => value * top[3] + ground[i] * (1 - top[3]));
    const lum = rgb => {
      const [r, g, b] = rgb.map(value => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const ground = element => {
      const layers = [];
      for (let node = element; node; node = node.parentElement) {
        const colour = parse(getComputedStyle(node).backgroundColor);
        if (colour && colour[3] > 0) layers.push(colour);
        if (colour?.[3] === 1) break;
      }
      return layers.reverse().reduce((under, layer) => mix(layer, under), [11, 11, 12]);
    };
    const visible = element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && !element.closest('[aria-hidden="true"], [inert], .visually-hidden');
    };
    const contrast = [];
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element) || element.closest('[aria-disabled="true"]')) continue;
      if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
      const style = getComputedStyle(element);
      const colour = parse(style.color);
      if (!colour) continue;
      const under = ground(element);
      const measured = ratio(mix(colour, under), under);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (measured < (large ? 3 : 4.5)) contrast.push(`${element.textContent.trim().slice(0, 40)} ${measured.toFixed(2)}`);
    }
    const small = [...document.querySelectorAll('button, a[href], summary, input, select, [role="button"]')]
      .filter(element => visible(element) && !element.closest('.mini'))
      .filter(element => {
        const box = element.getBoundingClientRect();
        return box.height < 44 || box.width < 44;
      })
      .map(element => `${element.textContent.trim().slice(0, 30) || element.getAttribute('aria-label')} ${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`);
    const live = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length;
    return { contrast, small, live };
  });
  // The first control a keyboard reaches after the headline (or round the page) shows a focus ring, never lime.
  await page.evaluate(() => {
    const heading = document.querySelector('main h1');
    if (heading && !heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading?.focus();
  });
  await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement === document.body)) await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return 'nothing focused';
    const style = getComputedStyle(element);
    const shown = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 || style.boxShadow !== 'none';
    const colour = style.outlineColor;
    element.blur();
    return shown && colour !== 'rgb(200, 241, 53)' ? '' : `${element.textContent.trim().slice(0, 30)}: ${style.outlineStyle} ${colour}`;
  });
  a11yChecked.push(where);
  check(`${where}: every control named, headings in order, AA contrast, 44px targets, a live region, a visible focus ring`,
    !unnamed.length && ordered && !found.contrast.length && !found.small.length && found.live > 0 && !ring,
    [unnamed[0], ordered ? '' : `headings ${levels.join(',')}`, found.contrast[0], found.small[0], found.live ? '' : 'no live region', ring]
      .filter(Boolean).join(' | ') || undefined);
}

// A sheet keeps focus inside it, Escape closes it, and focus goes back to the button that opened it.
async function sheetTrap(where, opener) {
  await opener.focus();
  await page.keyboard.press('Enter');
  await dialog().waitFor();
  let inside = true;
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    inside &&= await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  }
  const behind = await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'));
  await page.keyboard.press('Escape');
  await dialog().waitFor({ state: 'detached' });
  const back = await opener.evaluate(element => element === document.activeElement);
  check(`${where}: the sheet traps focus, Escape closes it, focus returns`, inside && behind && back);
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
  await dialog().getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: `Playing as ${name}` }).waitFor();
}

// Ada names the work, Ngozi confirms her key on her own side, Ada sets the terms and opens the stack.
async function openStack({ shots: still = false, close = '48 hours' } = {}) {
  if (!page.url().endsWith('/new')) {
    await page.getByRole('button', { name: /^Playing as/ }).click();
    await dialog().getByRole('button', { name: 'Start a new stack as Ada' }).click();
  }
  await heading('Who are you backing?').waitFor();
  if (still) {
    const link = page.getByLabel('Public link to the work');
    const typed = await link.inputValue();
    await link.fill('');
    await page.getByRole('button', { name: 'Next' }).click();
    check('O1: the public link is required', await page.getByText('Add a public link to the work').isVisible()
      && /^\/new$/.test(new URL(page.url()).pathname));
    await link.fill(typed);
    check('O1: says Paid means ecash received, not work done',
      await page.getByText('Paid means Ngozi received ecash, not that the work was done.').isVisible());
    await noLime('O1 who');
    await shoot('o1-who');
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await heading('Get Ngozi’s key.').waitFor();
  const id = campaignOf();
  if (still) {
    check('O2: a claim link, no key typed by Ada', (await page.locator('.link-text').innerText()).includes(`/claim/${id}`));
    await noLime('O2 key');
    await shoot('o2-key');
  }
  await playAs('Ngozi');
  await heading('Ada is starting a stack for you.').waitFor();
  check(`${id}: the claim link opens as Ngozi`, page.url().endsWith(`/claim/${id}`));
  if (still) {
    await noLime('M1 claim');
    await shoot('m1-claim');
  }
  await page.getByRole('button', { name: 'Confirm my key' }).click();
  await heading('Your key is confirmed.').waitFor();
  await playAs('Ada');
  await heading('Ngozi confirmed her key.').waitFor();
  if (still) {
    check('O2c: key confirmed, the short key shown, on Ngozi’s own storage',
      (await page.locator('.badge').innerText()).includes('Key confirmed') && /^0[23][0-9a-f]{2}…[0-9a-f]{4}$/.test(await page.locator('.rows dd').first().innerText()));
    await noLime('O2c confirmed');
    await shoot('o2c-confirmed');
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await heading('Set the terms.').waitFor();
  await page.getByRole('button', { name: close, exact: true }).click();
  const closes = await page.locator('.close-pick .field-note').innerText();
  check(`${id}: the close is a real time with a zone`, /^Closes \d{1,2} \w{3}, \d\d:00 \S+\. The close never moves anyone’s sats\.$/.test(closes), closes);
  if (still) {
    await noLime('O3 terms');
    await shoot('o3-terms');
  }
  await page.getByRole('button', { name: 'Create stack' }).click();
  await heading('Your stack is open.').waitFor();
  if (still) {
    check('O4: the organizer can share and stop, not move sats',
      await page.getByText('You organize this stack. You can share it and stop collecting, but you can’t move anyone’s sats.').isVisible()
      && await page.locator('svg.qr').isVisible());
    await noLime('O4 share');
    await shoot('o4-share');
  }
  await page.getByRole('button', { name: 'Watch it fill' }).click();
  await heading('Nobody’s in yet.').waitFor();
  const entry = await board(id);
  check(`${id}: Ada organizes, Ngozi is paid, the key came from her side`,
    entry.creatorId === 'ada' && entry.maintainerId === 'ngozi' && entry.key.by === 'maintainer' && entry.closesAt);
  return id;
}

async function chipIn(person, { shotPrefix } = {}) {
  await playAs(person);
  if (shotPrefix) {
    check('P1: organized by Ada, the close from the stack, nobody pre-labelled',
      await heading('Ada is getting 3 plebs to back Ngozi.').isVisible()
      && (await page.locator('.who').innerText()).includes('Organized by Ada')
      && /closes \d{1,2} \w{3}, \d\d:00/.test(await page.locator('.stack-labels').innerText())
      && (await page.locator('.stack-name').count()) === 0);
    await noLime('P1 join');
    await shoot('p1-join');
  }
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
  check('A1: Intro 3 starts a stack; no invite yet in a fresh browser',
    await page.getByRole('button', { name: 'Start a stack' }).isVisible() && !(await page.getByRole('button', { name: 'I have an invite link' }).count()));
  await page.getByRole('button', { name: 'Start a stack' }).click();
  const a = summary.campaigns.paid = await openStack({ shots: true });

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
  await dialog().waitFor({ state: 'detached' });
  await sheetTrap('WRH', page.getByRole('button', { name: 'What’s really happening' }));

  await chipIn('Maren');
  await page.reload();
  await page.getByRole('button', { name: 'Playing as Maren' }).waitFor();
  check('A2: after a reload Maren is still playing and still stacked',
    (await page.locator('.stack-name').allTextContents()).includes('You'));

  await playAs('Ada');
  await heading('2 of 3 in.').waitFor();
  check('O5: names, times and the close; the last signature sends the payout',
    (await page.locator('.rows').innerText()).includes('Tobi Adewale') && /in · \d\d:\d\d/.test(await page.locator('.rows').innerText())
    && (await page.getByText('the last signature sends the payout to the mint').count()) === 1);
  await noLime('O5 watch');
  await shoot('o5-watch');
  await page.getByRole('button', { name: 'Stop collecting' }).click();
  check('O5: stopping says released signatures still count', (await dialog().innerText()).includes('Signatures already released still count.'));
  await shoot('o5-stop', 700);
  await dialog().getByRole('button', { name: 'Keep collecting' }).click();
  await dialog().waitFor({ state: 'detached' });

  await playAs('Ngozi');
  await heading('A stack for you.').waitFor();
  check('M2: the payout will be locked to her key, nothing to do yet',
    await page.getByText('The payout will be locked to your key. Nothing to do yet.', { exact: false }).isVisible()
    && (await page.locator('.track').getAttribute('aria-label')).endsWith('42 of 63 sats at the mint'));
  await noLime('M2 following');
  await shoot('m2-following');

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
  await a11y('P8 paid');
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
  check('A11: the receipt names the organizer and says the close no longer applied',
    (await page.locator('.receipt').innerText()).includes('Organized by Ada')
    && (await page.locator('.receipt').innerText()).includes('so the close no longer applied'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await heading('Stacked. Paid.').waitFor();
  check('A11b: with Reduce Motion, Paid shows its end state at once: nothing animating, the stack already lit',
    await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length) === 0
    && await limePixels(await page.screenshot()) > 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await playAs('Ngozi');
  await heading('63 sats for you.').waitFor();
  const delivered = (await board(a)).events.find(event => event.type === 'delivered');
  const received = await page.evaluate(id => JSON.parse(localStorage.getItem(`plebstack:person:ngozi/received:${id}`))?.value, a);
  check('M3: the locked payout was handed on and saved in Ngozi’s own storage',
    delivered?.proofs.length > 0 && received?.proofs.length === delivered.proofs.length
    && received.proofs.reduce((sum, proof) => sum + proof.amount, 0) === 63
    && received.proofs.every(proof => JSON.parse(proof.secret)[1].data === received.pubkey));
  check('M3: lime only now, on Paid', (await limeStyles()).length > 0);
  await a11y('M3 receive');
  await shoot('m3-receive');
  await page.getByRole('button', { name: 'What’s really happening' }).click();
  check('M3: the sheet says the locked ecash only works with her key', (await dialog().innerText()).includes('it only works with your key'));
  await dialog().getByRole('button', { name: 'Got it' }).click();
  await dialog().waitFor({ state: 'detached' });

  const keysets = (await (await fetch(`${MINT}/v1/keysets`)).json()).keysets;
  const feePpk = keysets.find(keyset => keyset.id === delivered.proofs[0].id)?.input_fee_ppk ?? 0;
  const fee = Math.ceil(delivered.proofs.length * feePpk / 1000);
  await page.getByRole('button', { name: 'Spend', exact: true }).click();
  await heading(`Yours. ${63 - fee} sats.`).waitFor({ timeout: 60_000 });
  const spentText = await page.locator('.lead p').innerText();
  check('M4: a real swap at the mint, fee from its keyset',
    fee === 1 && spentText.startsWith('Swap fee at the mint, 1 sat. Received, 62 sats.'),
    `${delivered.proofs.length} inputs at ${feePpk} ppk: ${spentText}`);
  const swap = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('plebstack:person:ngozi/operation:'))
    .map(key => JSON.parse(localStorage.getItem(key)).value).find(op => op.kind === 'swap'));
  check('M4: the swap was saved in her storage before it went, and its proofs are kept there',
    swap?.status === 'confirmed' && swap.createdAt <= swap.dispatchedAt && swap.proofs.reduce((sum, proof) => sum + proof.amount, 0) === 62);
  await noLime('M4 spent');
  await page.getByRole('button', { name: 'Copy ecash' }).click();
  await page.getByRole('button', { name: 'Copied' }).waitFor();
  const token = await page.evaluate(() => navigator.clipboard.readText());
  const decoded = getDecodedToken(token, keysets.map(keyset => keyset.id));
  const amount = decoded.proofs.reduce((sum, proof) => sum + Number(proof.amount), 0);
  const keysNow = await secretKeys();
  check('M4: Copy ecash gives a real token for 62 sats with no private key in it',
    token.startsWith('cashuB') && decoded.mint === MINT && amount === 62
    && !keysNow.some(secret => token.includes(secret) || JSON.stringify(decoded, (_, v) => typeof v === 'bigint' ? String(v) : v).includes(secret)),
    `${token.length} chars, ${decoded.proofs.length} proofs`);
  await page.getByRole('button', { name: 'Copied' }).waitFor({ state: 'detached' }).catch(() => {});
  await shoot('m4-spent');
  check('A12: Ada’s storage holds no key; Ngozi’s key is only in hers',
    (await storageKeys('plebstack:person:ada/')).length === 0
    && (await storageKeys('plebstack:person:ngozi/key:')).length === 1);

  // ---------------------------------------------------------------- B: no payout, take it back, with a reload
  const b = summary.campaigns.unmet = await openStack();
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
  const c = summary.campaigns.payoutFirst = await openStack();
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
  const d = summary.campaigns.reclaimFirst = await openStack();
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

  // ---------------------------------------------------------------- E: the close passes with two of three in
  const leakedBefore = await page.evaluate(keys => {
    const shared = Object.keys(localStorage).filter(key => /^plebstack:(public|coordinator|person:ada)\//.test(key))
      .map(key => localStorage.getItem(key)).join('\n');
    return keys.filter(secret => shared.includes(secret) || document.documentElement.outerHTML.includes(secret)).length;
  }, await secretKeys());
  check('Z0: no private key on the board, with the coordinator, with Ada or on the page', leakedBefore === 0);

  const clocked = await browser.newContext(phone);
  await clocked.clock.install();
  page = await phonePage(clocked);
  await page.goto(`${base}/`);
  await page.waitForURL(/\/intro\/1$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Start a stack' }).click();
  const e = summary.campaigns.closed = await openStack({ close: '24 hours' });
  await chipIn('Tobi');
  await chipIn('Maren');
  const closesAt = (await board(e)).closesAt;
  await page.clock.fastForward('25:00:00');
  await playAs('Tobi');
  await heading('No payout this time.').waitFor({ timeout: 30_000 });
  const why = await page.locator('.lead > p:not(.state-chip)').innerText();
  check('E1: past the close with 2 of 3 in, No payout, and the reason is the close', why.startsWith('The stack closed at') && why.includes('with 2 of 3 in'), why);
  check('E2: the close moved nobody’s sats', (await board(e)).events.every(event => event.type !== 'sent'), closesAt);
  await noLime('P9 closed');
  await shoot('p9-closed');
  await playAs('Ishaan');
  check('E3: nobody new can join after the close', !(await page.getByRole('button', { name: 'Chip in 21 sats' }).count()));
  await playAs('Maren');
  await takeBack();
  await heading('Back to you.').waitFor({ timeout: 60_000 });
  check('E4: Maren took hers back after the close', (await board(e)).events.some(event => event.type === 'settled' && event.status === 'confirmed'));

  // ---------------------------------------------------------------- everywhere
  const leaked = await page.evaluate(keys => {
    const shared = Object.keys(localStorage).filter(key => /^plebstack:(public|coordinator)\//.test(key))
      .map(key => localStorage.getItem(key)).join('\n');
    return keys.filter(secret => shared.includes(secret) || document.documentElement.outerHTML.includes(secret)).length;
  }, await secretKeys());
  check('Z1: no private key on the board, with the coordinator or on the page (closed run)', leaked === 0);
  check('Z2: no private key on any screenshotted page', shotLeaks.length === 0, shotLeaks.join(', '));
  check('Z3: no page errors', errors.length === 0, errors.join(' | '));
  summary.limeChecked = limeChecked;
  summary.a11yChecked = a11yChecked;
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
