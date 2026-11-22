import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Rgb = [number, number, number];

const tokens: Record<string, string> = Object.fromEntries(
  [...readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').matchAll(/--color-([\w-]+):\s*([^;]+);/g)]
    .map(([, name, value]) => [name, value.trim()]),
);

function colour(name: string): { rgb: Rgb; alpha: number } {
  const value = tokens[name];
  assert.ok(value, name);
  const alias = value.match(/^var\(--color-([\w-]+)\)$/);
  if (alias) return colour(alias[1]);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb, alpha: 1 };
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  assert.ok(rgba, `${name}: ${value}`);
  return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: Number(rgba[4]) };
}

// A see-through token laid over the ground it sits on.
function over(top: string, ground: Rgb): Rgb {
  const { rgb, alpha } = colour(top);
  return rgb.map((value, i) => value * alpha + ground[i] * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(value => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const solid = (name: string) => colour(name).rgb;
const grounds: Record<string, Rgb> = {
  canvas: solid('canvas'), surface: solid('surface'), card: solid('card'),
  'wash on canvas': over('wash', solid('canvas')), 'wash on surface': over('wash', solid('surface')),
};
const text = [
  'ink', 'muted', 'faint', 'error', 'signal', 'test-mint', 'state-deposited', 'state-ready', 'state-approved',
  'state-paying-out', 'state-paid', 'state-reclaiming', 'state-reclaimed',
];

test('the ratio matches the WCAG reference values', () => {
  assert.equal(ratio([255, 255, 255], [0, 0, 0]).toFixed(1), '21.0');
  assert.equal(ratio([118, 118, 118], [255, 255, 255]).toFixed(2), '4.54');
});

test('every text colour reads at 4.5:1 or better on every night ground', () => {
  for (const name of text) {
    for (const [ground, rgb] of Object.entries(grounds)) {
      const measured = ratio(solid(name), rgb);
      assert.ok(measured >= 4.5, `${name} on ${ground}: ${measured.toFixed(2)}`);
    }
  }
});

test('text on the filled buttons reads at 4.5:1 or better', () => {
  assert.ok(ratio(solid('on-ink'), solid('ink')) >= 4.5);
  assert.ok(ratio(solid('on-signal'), solid('signal')) >= 4.5);
});

test('field borders and the dashed goal line and open slots reach 3:1', () => {
  for (const name of ['border', 'dash']) {
    for (const ground of ['canvas', 'surface', 'card']) {
      const measured = ratio(solid(name), grounds[ground]);
      assert.ok(measured >= 3, `${name} on ${ground}: ${measured.toFixed(2)}`);
    }
  }
});
