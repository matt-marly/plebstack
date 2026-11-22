import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAIN_CAMPAIGN, RACE_CAMPAIGN, checkMint, headline, initialWorld, progressLine, recordSpend, requestReclaim, roleLine,
  rowSentence, setViewer, slotStatus, stopCollecting, termsOf, type World,
} from '../src/demo/world';
import { stateCopy } from '../src/domain/states';

const banned = /preimage|block height|locktime|refund|revok|\btokens?\b|self-custod(ial|y)|non-custodial/i;
const at = (time: string) => `2026-11-13T${time}:00Z`;

function sourceFiles(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) return sourceFiles(url);
    return /\.tsx?$/.test(entry.name) ? [url] : [];
  });
}

// String literals and JSX text, with comments and import paths left out.
function visibleText(source: string): string[] {
  const found: string[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (source.startsWith('//', i)) i = source.indexOf('\n', i) === -1 ? source.length : source.indexOf('\n', i);
    else if (source.startsWith('/*', i)) i = source.indexOf('*/', i) + 2;
    else if (char === '\'' || char === '"' || char === '`') {
      let end = i + 1;
      while (end < source.length && source[end] !== char) end += source[end] === '\\' ? 2 : 1;
      const before = source.slice(source.lastIndexOf('\n', i) + 1, i);
      if (!/^\s*(import|export .* from)\b|\bfrom\s*$/.test(before)) found.push(source.slice(i + 1, end));
      i = end + 1;
    } else if (char === '>') {
      const end = source.indexOf('<', i + 1);
      const text = end === -1 ? '' : source.slice(i + 1, end);
      if (end !== -1 && !/[;=(){}]/.test(text)) found.push(text);
      i += 1;
    } else i += 1;
  }
  return found;
}

function worldText(world: World): string[] {
  return [world.notice, ...world.campaigns.flatMap(record => [
    headline(record).sentence, progressLine(record), roleLine(world, record),
    ...record.log.map(entry => entry.text),
    ...record.slots.flatMap(slot => [rowSentence(record, slotStatus(slot), true), rowSentence(record, slotStatus(slot), false)]),
  ])];
}

test('state copy, notices, log lines and row sentences avoid the never-say words', () => {
  const start = initialWorld();
  const terms = termsOf(start.campaigns[0]);
  const texts = Object.values(stateCopy).flatMap(copy => [copy.word, copy.phrase, copy.sentence(terms)]);
  const racing = requestReclaim(start, RACE_CAMPAIGN, 'backer-3', at('14:12'));
  const worlds = [
    start,
    stopCollecting(setViewer(start, 'ngozi'), MAIN_CAMPAIGN, at('15:00')),
    checkMint(racing, RACE_CAMPAIGN, at('14:13'), 'owner'),
    setViewer(checkMint(setViewer(racing, 'tobi'), RACE_CAMPAIGN, at('14:13'), 'owner'), 'tobi'),
    recordSpend(checkMint(setViewer(start, 'ngozi'), RACE_CAMPAIGN, at('14:20')), RACE_CAMPAIGN, at('14:21')),
  ];
  texts.push(...worlds.flatMap(worldText));
  for (const text of texts) assert.doesNotMatch(text, banned, text);
  assert.ok(texts.some(text => text.includes('Stacked. Paid.')));
});

test('no user-visible string in src or index.html uses the never-say words', () => {
  const files = sourceFiles(new URL('../src/', import.meta.url));
  assert.ok(files.length > 20);
  const names = files.map(file => file.pathname.split('/').pop());
  for (const screen of [
    'Sign', 'Signed', 'Sending', 'Paid', 'Race', 'Unmet', 'Back', 'GroupCard', 'Checked', 'TakeBack',
    'Backing', 'PayoutKey', 'Terms', 'Share', 'Watch', 'Claim', 'Follow', 'Receive', 'Spent', 'PlayingAs', 'Who',
    'Stage', 'Mini', 'Pile',
  ]) {
    assert.ok(names.includes(`${screen}.tsx`), screen);
  }
  for (const file of files) {
    for (const text of visibleText(readFileSync(file, 'utf8'))) assert.doesNotMatch(text, banned, `${file.pathname}: ${text}`);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(html, banned);
  assert.doesNotMatch(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'), banned);
});

test('the scan catches a banned word in a string or in JSX text, and skips comments', () => {
  assert.deepEqual(visibleText('// a refund\nconst a = \'Lightning refund\';').filter(text => banned.test(text)), ['Lightning refund']);
  assert.ok(visibleText('<p>Back after the locktime</p>').some(text => banned.test(text)));
  assert.equal(visibleText('import \'./styles/tokens.css\';').length, 0);
});
