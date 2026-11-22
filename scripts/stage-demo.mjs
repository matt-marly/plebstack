// Plays the stage the way a demo does: the stage alone in one window at 1920x1080, and the people played in a
// second window of the same browser, which shares its storage. The stage is never clicked; it follows the
// board through the storage event. Everything goes to testnut: real locked quotes, a real batch, a real swap.
//
//   node scripts/stage-demo.mjs                 (starts its own dev server)
//   node scripts/stage-demo.mjs http://localhost:5173
//   node scripts/stage-demo.mjs --video         (records the stage window into .evidence/stage-<time>/stage.webm)
//   node scripts/stage-demo.mjs --shots         (saves stills of the stage into docs/screens-live/stage-*.png)
//   node scripts/stage-demo.mjs --pace=4000     (milliseconds between steps; 2500 by default)
//   node scripts/stage-demo.mjs --calm          (the stage window asks for reduced motion)

import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { optimisePng } from './png.mjs';

const MINT = 'https://testnut.cashudevkit.org';
const STAGE = { width: 1920, height: 1080 };
const root = fileURLToPath(new URL('..', import.meta.url));
const flag = name => process.argv.includes(`--${name}`);
const video = flag('video');
const shots = flag('shots');
const calm = flag('calm');
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
  viewport: STAGE, reducedMotion: calm ? 'reduce' : 'no-preference',
  ...(video ? { recordVideo: { dir, size: STAGE } } : {}),
});
const stage = await context.newPage();
stage.on('pageerror', error => errors.push(`stage: ${error.message}`));
const page = await context.newPage();
page.on('pageerror', error => errors.push(`phone: ${error.message}`));
await page.setViewportSize({ width: 390, height: 844 });
const scratch = await browser.newPage();

const beat = (ms = pace) => page.waitForTimeout(ms);
const heading = name => page.getByRole('heading', { level: 1, name });
const dialog = () => page.getByRole('dialog');
const caption = () => stage.locator('.stage-line').innerText();
const goal = () => stage.locator('.pile-goal').innerText();
const settled = () => stage.waitForFunction(() => !document.querySelector('.ghost'), undefined, { timeout: 30_000 });
const told = text => stage.waitForFunction(want => [...document.querySelectorAll('.stage-history li')]
  .some(item => item.textContent.includes(want)), text, { timeout: 90_000 });

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
async function still(name) {
  const png = await stage.screenshot();
  writeFileSync(join(dir, `${name}.png`), png);
  if (shots) {
    writeFileSync(join(shotsDir, `${name}.png`), optimisePng(await shrink(png, 1600)));
    stills.push(`${name}.png`);
  }
  console.log(`still ${name}`);
  return png;
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

const summary = { started, base, pace, calm };
try {
  await stage.goto(`${base}/stage`);
  await stage.locator('.stage-line').waitFor();
  check('S0: an empty stage says how to start', (await caption()).startsWith('No stack yet.'));
  await stage.waitForTimeout(1500);

  // Ada names the work; Ngozi confirms her key on her own side; Ada sets the terms.
  await page.goto(`${base}/`);
  await page.waitForURL(/\/intro\/1$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Start a stack' }).click();
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
  await chipIn('Ishaan', {
    holdAt: async () => {
      await stage.locator('.mini svg.qr').waitFor();
      await settled();
      await stage.waitForTimeout(1200);
      check('S4: Ishaan’s phone shows the real invoice; still 2 of 3 until the mint says paid',
        (await goal()).startsWith('goal · 42 of 63 sats') && (await stage.locator('.mini svg.qr').count()) === 1);
      const png = await still('stage-collecting');
      check('S5: no lime while collecting', await limePixels(png) === 0);
    },
  });
  check('S6: all three in, at the line', (await goal()).startsWith('at the line · 63 of 63 sats'));

  await sign('Tobi');
  await stage.waitForTimeout(1600);
  check('S7: the signed count follows the signatures', (await goal()).includes('signed 1 of 3'));
  check('S8: no lime at the line', await limePixels(await still('stage-at-the-line')) === 0);
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
    await stage.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 340;
      }
    });
    await still('stage-paid-moment');
    await stage.evaluate(() => { for (const animation of document.getAnimations()) animation.play(); });
  }
  await stage.locator('[data-payout][data-paid]').waitFor({ timeout: 30_000 });
  await settled();
  await stage.waitForTimeout(1200);
  const events = (await page.evaluate(campaignId => JSON.parse(localStorage.getItem(`plebstack:public/campaign:${campaignId}`)).value, id)).events;
  check('S12: Paid on the stage only once the mint confirmed the batch',
    events.some(event => event.type === 'settled' && event.status === 'confirmed') && (await goal()) === 'goal reached · 63 sats paid');
  const paid = await still('stage-paid');
  check('S13: lime on Paid', await limePixels(paid) > 0);
  check('S14: Ngozi’s card holds the payout, locked to her key',
    (await stage.locator('[data-payout]').innerText()).includes('63 sats · locked to her key'));
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
  await stage.waitForTimeout(pace);

  const tree = await stage.locator('body').ariaSnapshot();
  check('S18: the stage has its h1, a name for every phone and image, and a live caption',
    /- heading "Plebstack stage" \[level=1\]/.test(tree) && !/^\s*- (img|button|link)\s*:?$/m.test(tree)
    && (tree.match(/region "[^"]+’s phone: /g) ?? []).length === 4 && await stage.locator('[aria-live]').count() > 0);

  const secrets = await page.evaluate(() => Object.keys(localStorage).filter(key => /^plebstack:person:[^/]+\/key:/.test(key))
    .map(key => JSON.parse(localStorage.getItem(key)).value.secretKey));
  const html = await stage.content();
  check('S16: no private key anywhere on the stage', secrets.length === 4 && secrets.every(secret => !html.includes(secret)));
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
