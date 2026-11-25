// Plays the stage the way a demo does: the stage alone in one window at 1920x1080, and the people played in a
// second window of the same browser, which shares its storage. The stage is never clicked; it follows the
// board through the storage event. Everything goes to testnut: real locked quotes, a real batch, a real swap.
//
//   node scripts/stage-demo.mjs                 (starts its own dev server)
//   node scripts/stage-demo.mjs http://localhost:5173
//   node scripts/stage-demo.mjs --video         (records the stage window into .evidence/stage-<time>/stage.webm)
//   node scripts/stage-demo.mjs --video --portrait  (records the stage as a phone shows it, 390x844)
//   node scripts/stage-demo.mjs --shots         (saves stills of both layouts into docs/screens-live/stage-*.png)
//   node scripts/stage-demo.mjs --pace=4000     (milliseconds between steps; 2500 by default)
//   node scripts/stage-demo.mjs --calm          (the stage window asks for reduced motion)
//   node scripts/stage-demo.mjs --miss          (the goal is missed: two pay, Ada stops collecting, both take theirs back;
//                                                stills stay in .evidence, so --shots keeps the paid run's)

import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { axeViolations, reflowIssues } from './a11y.mjs';
import { optimisePng } from './png.mjs';

const MINT = 'https://testnut.cashudevkit.org';
const WIDE = { width: 1920, height: 1080 };
const TALL = { width: 390, height: 844 };
const root = fileURLToPath(new URL('..', import.meta.url));
const flag = name => process.argv.includes(`--${name}`);
const video = flag('video');
const miss = flag('miss');
const shots = flag('shots') && !miss;
const calm = flag('calm');
const portrait = flag('portrait');
const STAGE = portrait ? TALL : WIDE;
const pace = Number(process.argv.find(arg => arg.startsWith('--pace='))?.split('=')[1] ?? 2500);
const shotsDir = join(root, 'docs', 'screens-live');
const started = new Date().toISOString();
const dir = join(root, '.evidence', `stage-${started.replace(/[:.]/g, '-')}`);
mkdirSync(dir, { recursive: true });
if (shots) {
  mkdirSync(shotsDir, { recursive: true });
  for (const file of readdirSync(shotsDir)) if (/^stage-.*\.png$/.test(file)) rmSync(join(shotsDir, file));
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
  server = await createServer({ root, logLevel: 'error', server: { port: 5198 } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const errors = [];
// One context, so both windows share one browser's storage, as one browser plays everyone.
const context = await browser.newContext({
  viewport: STAGE, deviceScaleFactor: portrait ? 2 : 1, reducedMotion: calm ? 'reduce' : 'no-preference',
  ...(video ? { recordVideo: { dir, size: STAGE } } : {}),
});
const stage = await context.newPage();
stage.on('pageerror', error => errors.push(`stage: ${error.message}`));
// Beside the recorded stage, the other layout follows the same board, so one run checks and shoots both.
// A recording keeps to one window.
const other = video ? undefined : await context.newPage();
other?.on('pageerror', error => errors.push(`other stage: ${error.message}`));
await other?.setViewportSize(portrait ? WIDE : TALL);
const wide = portrait ? other : stage;
const tall = portrait ? stage : other;
const page = await context.newPage();
page.on('pageerror', error => errors.push(`phone: ${error.message}`));
await page.setViewportSize({ width: 390, height: 844 });
const scratch = await browser.newPage();

const beat = (ms = pace) => page.waitForTimeout(ms);
const heading = name => page.getByRole('heading', { level: 1, name });
const dialog = () => page.getByRole('dialog');
const caption = (on = stage) => on.locator('.stage-line').innerText();
const goal = (on = stage) => on.locator('.pile-goal').innerText();
const settledOn = on => on.waitForFunction(() => !document.querySelector('.ghost'), undefined, { timeout: 30_000 });
const settled = async () => {
  await settledOn(stage);
  if (other) await settledOn(other);
};
const told = async text => {
  for (const page of [stage, other].filter(Boolean)) {
    await page.waitForFunction(want => [...document.querySelectorAll('.stage-history li')]
      .some(item => item.textContent.includes(want)), text, { timeout: 90_000 });
  }
};

// Every slab in flight stays on screen: it starts and lands inside the window, in either layout.
const flown = [];
async function watchFlights(page) {
  await page.exposeFunction(`flew${page === wide ? 'Wide' : 'Tall'}`, box => flown.push({ layout: page === wide ? 'wide' : 'tall', ...box }));
  await page.addInitScript(name => {
    const report = window[name];
    new MutationObserver(() => {
      for (const ghost of document.querySelectorAll('.ghost:not([data-seen])')) {
        ghost.setAttribute('data-seen', '');
        const send = () => {
          const box = ghost.getBoundingClientRect();
          report({ top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: innerWidth, height: innerHeight });
        };
        // Where it lands, then where it starts once its animation has begun.
        send();
        requestAnimationFrame(() => requestAnimationFrame(send));
      }
    }).observe(document, { subtree: true, childList: true });
  }, `flew${page === wide ? 'Wide' : 'Tall'}`);
}
for (const page of [stage, other].filter(Boolean)) await watchFlights(page);

async function playAs(name) {
  await page.getByRole('button', { name: /^Playing as/ }).click();
  await dialog().getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: `Playing as ${name}` }).waitFor();
}

// Counted on a scratch page, so neither window is touched.
async function scratchImage(png, work, arg) {
  return scratch.evaluate(async ([data, body, input]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    return new Function('image', 'input', body)(image, input);
  }, [png.toString('base64'), work, arg]);
}

const limePixels = png => scratchImage(png, `
  const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const px = context.getImageData(0, 0, image.width, image.height).data;
  let count = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (Math.abs(px[i] - 200) < 14 && Math.abs(px[i + 1] - 241) < 14 && Math.abs(px[i + 2] - 53) < 24) count += 1;
  }
  return count;`);

// 1920 wide on screen, 1600 wide on disk: downscaled in the browser, then mapped to a palette.
async function shrink(png, width) {
  const data = await scratchImage(png, `
    const height = Math.round(image.height * input / image.width);
    const canvas = Object.assign(document.createElement('canvas'), { width: input, height });
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, input, height);
    return canvas.toDataURL('image/png').split(',')[1];`, width);
  return Buffer.from(data, 'base64');
}

const stills = [];
// The wide stage is saved 1600 wide; the tall one as a phone shows it, 390x844 at 2x.
async function stillOf(page, name) {
  const png = await page.screenshot();
  writeFileSync(join(dir, `${name}.png`), png);
  if (shots) {
    writeFileSync(join(shotsDir, `${name}.png`), optimisePng(page === wide ? await shrink(png, 1600) : png));
    stills.push(`${name}.png`);
  }
  console.log(`still ${name}`);
  return png;
}

// The recorded stage's still, and the other layout's beside it.
async function still(name) {
  const tallName = name.replace(/^stage-/, 'stage-portrait-');
  const png = await stillOf(stage, stage === wide ? name : tallName);
  if (other) {
    const otherPng = await stillOf(other, other === wide ? name : tallName);
    if (await limePixels(otherPng) > 0 !== await limePixels(png) > 0) check(`${name}: both layouts agree on lime`, false);
  }
  return png;
}

// axe against WCAG 2.2 AA, no sideways scroll and no clipped text, on each layout at this moment.
async function stageA11y(where) {
  for (const page of [stage, other].filter(Boolean)) {
    const layout = page === wide ? 'wide' : 'tall';
    const found = [...await axeViolations(page), ...await reflowIssues(page)];
    check(`${where} (${layout}): axe WCAG 2.2 AA clean, no sideways scroll, no clipped text`, found.length === 0, found.join(' | '));
  }
}

// The tall stage reads top to bottom: header, the stack, the three plebs, Ngozi, then the captions.
async function tallOrder() {
  if (!tall) return;
  const tops = await tall.evaluate(() => ['.stage-top', '.pile', '.tiles', '.tile-for', '.stage-captions']
    .map(selector => document.querySelector(selector)?.getBoundingClientRect().top ?? NaN));
  check('T1: the tall stage reads header, stack, plebs, Ngozi, captions', tops.every((top, i) => i === 0 || top > tops[i - 1]), tops.join(','));
}

// Holds one kind of request to the mint until released, so the stage can be caught in that state.
async function hold(method, test) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let arrive;
  const arrived = new Promise(resolve => { arrive = resolve; });
  const handler = async route => {
    if (route.request().method() !== method || !test(new URL(route.request().url()).pathname)) return route.fallback();
    arrive();
    await gate;
    await route.continue().catch(() => {});
  };
  await page.route(`${MINT}/**`, handler);
  return { arrived, release: async () => { release(); await page.unroute(`${MINT}/**`, handler); } };
}

async function chipIn(name, { holdAt } = {}) {
  await playAs(name);
  await heading('Ada is getting 3 plebs to back Ngozi.').waitFor();
  await beat();
  const quoteCheck = holdAt && await hold('GET', path => path.startsWith('/v1/mint/quote/bolt11/'));
  await page.getByRole('button', { name: 'Chip in 21 sats' }).click();
  await page.getByRole('link', { name: 'Open in wallet' }).waitFor({ timeout: 30_000 });
  if (quoteCheck) {
    await quoteCheck.arrived;
    await holdAt();
    await quoteCheck.release();
  }
  await heading('Stacked.').waitFor({ timeout: 90_000 });
  await told(`${name}’s 21 sats land.`);
  await settled();
  await beat();
}

async function sign(name) {
  await playAs(name);
  await heading('Everyone’s in. Sign the group card.').waitFor();
  await page.getByText('What your phone checked').waitFor({ timeout: 30_000 });
  await beat(pace / 2);
  await page.getByRole('button', { name: 'Sign for the 63-sat payout' }).click();
  await dialog().getByRole('button', { name: 'Sign', exact: true }).click();
  await told(`${name} signs the group card.`);
}

// All three in, all three sign, one batch pays Ngozi, and she spends it.
async function reachTheGoal(id) {
  await chipIn('Ishaan', {
    holdAt: async () => {
      if (wide) await wide.locator('.mini svg.qr').waitFor();
      if (tall) await tall.locator('.tile', { hasText: 'paying' }).waitFor();
      await settled();
      await stage.waitForTimeout(1200);
      check('S4: Ishaan’s phone shows the real invoice; still 2 of 3 until the mint says paid',
        (await goal()).startsWith('goal · 42 of 63 sats') && (!wide || (await wide.locator('.mini svg.qr').count()) === 1));
      if (tall) {
        const tiles = await tall.locator('.tile:not(.tile-for)').allInnerTexts();
        check('T2: the tiles say who is where, from the board', tiles.length === 3
          && /Tobi\s+stacked\s+at the mint, locked to Tobi/.test(tiles[0]) && /Ishaan\s+paying\s+on the way to the mint/.test(tiles[2]),
          tiles.map(text => text.replace(/\s+/g, ' ')).join(' | '));
      }
      await tallOrder();
      const png = await still('stage-collecting');
      check('S5: no lime while collecting', await limePixels(png) === 0);
      await stageA11y('S5 collecting');
    },
  });
  check('S6: all three in, at the line', (await goal()).startsWith('at the line · 63 of 63 sats'));

  await sign('Tobi');
  await stage.waitForTimeout(1600);
  check('S7: the signed count follows the signatures', (await goal()).includes('signed 1 of 3'));
  check('S8: no lime at the line', await limePixels(await still('stage-at-the-line')) === 0);
  await stageA11y('S8 at the line');
  await sign('Maren');
  await beat();

  const batch = await hold('POST', path => path === '/v1/mint/bolt11/batch');
  await sign('Ishaan');
  await batch.arrived;
  await stage.locator('.pile[data-phase="sending"]').waitFor();
  await told('One batch goes to the mint.');
  await stage.waitForTimeout(1500);
  check('S9: Sending while the mint has the batch, never Paid', (await goal()).startsWith('sending · waiting for the mint'));
  check('S10: no lime while sending', await limePixels(await still('stage-sending')) === 0);
  await stage.waitForTimeout(pace);
  await batch.release();

  await stage.locator('.pile[data-moment]').waitFor({ timeout: 60_000 });
  check('S11: the words come first: the paid caption is up when the lime starts',
    (await caption()).startsWith('The mint pays Ngozi in one batch.'));
  if (!calm && shots) {
    // A screenshot takes longer than the fill, so the still holds every animation 340ms into the moment.
    if (other) await other.locator('.pile[data-moment]').waitFor({ timeout: 10_000 });
    for (const page of [stage, other].filter(Boolean)) {
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 340;
        }
      });
    }
    await still('stage-paid-moment');
    for (const page of [stage, other].filter(Boolean)) await page.evaluate(() => { for (const animation of document.getAnimations()) animation.play(); });
  }
  await stage.locator('[data-payout][data-paid]').waitFor({ timeout: 30_000 });
  if (other) await other.locator('[data-payout][data-paid]').waitFor({ timeout: 30_000 });
  await settled();
  await stage.waitForTimeout(1200);
  const events = (await page.evaluate(campaignId => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${campaignId}`)).value, id)).events;
  check('S12: Paid on the stage only once the mint confirmed the batch',
    events.some(event => event.type === 'settled' && event.status === 'confirmed') && (await goal()) === 'goal reached · 63 sats paid');
  const paid = await still('stage-paid');
  check('S13: lime on Paid', await limePixels(paid) > 0);
  check('S14: Ngozi’s card holds the payout, locked to her key',
    (await stage.locator('[data-payout]').innerText()).includes('63 sats · locked to her key'));
  await tallOrder();
  await stageA11y('S14 paid');
  await beat();

  await playAs('Ngozi');
  await heading('63 sats for you.').waitFor();
  await told('Ngozi’s phone checks the payout');
  await beat();
  await page.getByRole('button', { name: 'Spend', exact: true }).click();
  await heading(/^Yours\./).waitFor({ timeout: 60_000 });
  await told('Ngozi spends it.');
  await stage.waitForTimeout(1500);
  check('S15: the swap on the stage: 1 sat fee, 62 received',
    (await caption()) === 'Ngozi spends it. 1 sat swap fee, 62 sats received.'
    && (await stage.locator('[data-payout]').innerText()).includes('62 sats received · 1 sat swap fee'));
  await still('stage-spent');
  await stageA11y('S15 spent');
  await stage.waitForTimeout(pace);
}

// With no payout this time, each pleb asks the mint for their own back. Nobody approves it.
async function takeBack(name) {
  await playAs(name);
  await heading('No payout this time.').waitFor();
  await beat();
  await page.getByRole('button', { name: 'Take mine back' }).click();
  await dialog().getByRole('button', { name: 'Take mine back' }).click();
  await heading('Back to you.').waitFor({ timeout: 90_000 });
  await told(`${name} takes their 21 sats back.`);
  await settled();
  await beat();
}

// Two in, the third never comes: Ada stops collecting, and Tobi and Maren each take their own 21 back.
async function missTheGoal(id) {
  check('M1: two of three in, still collecting', (await goal()).startsWith('goal · 42 of 63 sats'));
  await playAs('Ada');
  await heading('2 of 3 in.').waitFor();
  await beat();
  await page.getByRole('button', { name: 'Stop collecting' }).click();
  await dialog().getByRole('button', { name: 'Stop collecting' }).click();
  await told('Ada stops collecting.');
  await settled();
  await stage.waitForTimeout(1200);
  check('M2: the stage shows the unmet state: no payout, 42 still at the mint',
    await stage.locator('.pile[data-phase="unmet"]').count() === 1
    && (await goal()).startsWith('goal · 42 of 63 sats · no payout')
    && (await caption()).startsWith('Ada stops collecting. No payout this time.'));
  check('M2b: Ishaan, never in, is told the stack didn’t fill, not that it is full',
    await stage.getByText('This stack didn’t fill.').count() > 0 && await stage.getByText('This stack is full.').count() === 0);
  check('M3: no lime when the goal is missed', await limePixels(await still('stage-unmet')) === 0);
  await stageA11y('M3 unmet');
  await beat();

  await takeBack('Tobi');
  await takeBack('Maren');
  await stage.waitForTimeout(1500);
  const events = (await page.evaluate(campaignId => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${campaignId}`)).value, id)).events;
  const confirmed = events.filter(event => event.type === 'settled' && event.status === 'confirmed').map(event => event.operationId);
  const backBy = name => events.some(event => event.type === 'sent' && event.kind === 'reclaim'
    && event.personId === name.toLowerCase() && confirmed.includes(event.operationId));
  check('M4: the mint confirmed both take-backs, and no payout was ever sent',
    backBy('Tobi') && backBy('Maren') && !events.some(event => event.type === 'sent' && event.kind === 'payout'));
  check('M5: the stage says each one is back with its owner',
    (await stage.locator('[data-pocket="tobi"]').innerText()).includes('back with Tobi')
    && (await stage.locator('[data-pocket="maren"]').innerText()).includes('back with Maren'));
  check('M5b: after both take-backs Ishaan still reads that the stack didn’t fill',
    await stage.getByText('This stack didn’t fill.').count() > 0 && await stage.getByText('This stack is full.').count() === 0);
  const back = await still('stage-taken-back');
  check('M6: no lime on the stack after the take-backs', await limePixels(back) === 0);
  await stageA11y('M6 taken back');
  await stage.waitForTimeout(pace);
}

const summary = { started, base, pace, calm, miss };
try {
  await stage.goto(`${base}/stage`);
  await stage.locator('.stage-line').waitFor();
  if (other) {
    await other.goto(`${base}/stage`);
    await other.locator('.stage-line').waitFor();
  }
  check('S0: an empty stage says how to start', (await caption()).startsWith('No stack yet.'));
  check('S0b: the layout follows the window', await stage.locator('.stage[data-tall]').count() === (portrait ? 1 : 0)
    && (!other || await other.locator('.stage[data-tall]').count() === (portrait ? 0 : 1)));
  await stageA11y('S0 empty stage');
  await stage.waitForTimeout(1500);

  // Ada names the work; Ngozi confirms her key on her own side; Ada sets the terms.
  await page.goto(`${base}/`);
  await page.waitForURL(/\/intro\/1$/);
  await page.getByRole('button', { name: 'Skip the intro' }).click();
  await heading('Who are you backing?').waitFor();
  await beat();
  await page.getByRole('button', { name: 'Next' }).click();
  await heading('Get Ngozi’s key.').waitFor();
  const id = summary.campaign = page.url().split('/o/')[1].split('/')[0];
  await stage.locator('.stage-who', { hasText: 'for Ngozi Eze' }).waitFor();
  check('S1: the stage follows the newest stack without a click', (await caption()).startsWith('Ada starts a stack for Ngozi.'));
  await beat();
  await playAs('Ngozi');
  await page.getByRole('button', { name: 'Confirm my key' }).click();
  await heading('Your key is confirmed.').waitFor();
  await told('Ngozi confirms her payout key');
  await beat();
  await playAs('Ada');
  await page.getByRole('button', { name: 'Next' }).click();
  await heading('Set the terms.').waitFor();
  await page.getByRole('button', { name: '48 hours', exact: true }).click();
  await beat(pace / 2);
  await page.getByRole('button', { name: 'Create stack' }).click();
  await heading('Your stack is open.').waitFor();
  await told('Ada opens the stack');
  const board = await page.evaluate(campaignId => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${campaignId}`)).value, id);
  check('S2: the close on the stage is the one saved with the stack',
    (await stage.locator('.stage-organizer').innerText()).includes(`closes ${await stage.evaluate(
      async iso => (await import('/src/ui/format.ts')).formatWhen(iso), board.closesAt)}`));
  const zone = await stage.evaluate(async () => (await import('/src/ui/format.ts')).zoneName(new Date()));
  check('S2b: the caption log names the zone the way the app does',
    (await stage.locator('.stage-history .mono').first().innerText()).endsWith(` ${zone}`), zone);
  await beat();

  await chipIn('Tobi');
  check('S3: a slab lands only when the mint reports the deposit paid', (await goal()).startsWith('goal · 21 of 63 sats'));
  await chipIn('Maren');
  await (miss ? missTheGoal(id) : reachTheGoal(id));

  // Captions are read whole: nothing in the log is cut, at 1920x1080 and at 1280x720.
  if (wide) {
    for (const size of [WIDE, { width: 1280, height: 720 }]) {
      await wide.setViewportSize(size);
      await wide.waitForTimeout(300);
      const cut = await wide.evaluate(() => [...document.querySelectorAll('.stage-captions *')]
        .filter(element => getComputedStyle(element).textOverflow === 'ellipsis' || element.scrollWidth > element.clientWidth + 1)
        .map(element => element.textContent.trim().slice(0, 40)));
      check(`S19: every caption whole at ${size.width}x${size.height}`, cut.length === 0, cut.join(' | '));
    }
    await wide.setViewportSize(WIDE);
  }
  if (!calm) {
    const off = flown.filter(box => box.top < -2 || box.left < -2 || box.bottom > box.height + 2 || box.right > box.width + 2);
    check('S20: every travelling slab starts and lands on screen, in both layouts',
      flown.length > 0 && off.length === 0, `${flown.length} flights${off.length ? `; off: ${JSON.stringify(off[0])}` : ''}`);
  }

  const tree = await stage.locator('body').ariaSnapshot();
  check('S18: the stage has its h1, a name for every phone and image, and a live caption',
    /- heading "Plebstack stage" \[level=1\]/.test(tree) && !/^\s*- (img|button|link)\s*:?$/m.test(tree)
    && (tree.match(/region "[^"]+’s phone: /g) ?? []).length === 4 && await stage.locator('[aria-live]').count() > 0);

  const secrets = await page.evaluate(() => Object.keys(localStorage).filter(key => /^plebstack:person:[^/]+\/key:/.test(key))
    .map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));
  const html = await stage.content();
  // Ngozi and every pleb who chipped in made a key; Ishaan never does when the goal is missed.
  check('S16: no private key anywhere on the stage', secrets.length === (miss ? 3 : 4) && secrets.every(secret => !html.includes(secret)),
    `${secrets.length} keys`);
  check('S17: the stage was never clicked and no window had an error', errors.length === 0, errors.join(' | '));
  summary.pass = true;
} catch (error) {
  summary.pass = false;
  summary.failure = error.message;
  await stage.screenshot({ path: join(dir, 'failure-stage.png') }).catch(() => {});
  await page.screenshot({ path: join(dir, 'failure-phone.png') }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  const recording = video ? stage.video() : undefined;
  const phoneRecording = video ? page.video() : undefined;
  await context.close();
  if (recording) {
    renameSync(await recording.path(), join(dir, 'stage.webm'));
    rmSync(await phoneRecording.path(), { force: true });
    summary.video = join(dir, 'stage.webm');
    console.log(`video: ${summary.video}`);
  }
  summary.stills = stills;
  summary.finished = new Date().toISOString();
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ ...summary, checks }, null, 2) + '\n');
  console.log(`evidence: ${dir}`);
  await browser.close();
  await server?.close();
}
