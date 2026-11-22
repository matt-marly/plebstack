// Renders the home-screen icons from the slab mark into public/icons/.
//
//   node scripts/icons.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { optimisePng } from './png.mjs';

const dir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const slabs = [[15, 9, 20, 6], [10, 17.5, 24, 6], [13, 26, 27, 6], [8, 34.5, 29, 6]];

// The mark spans x 8–40 and y 9–40.5; it is centred, and scale sets how much of the square it fills.
function svg(scale) {
  const offset = +(24 - 24 * scale).toFixed(2);
  const rects = slabs.map(([x, y, w, h]) => `<rect x="${x}" y="${y - 0.75}" width="${w}" height="${h}" rx="1.5"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#0B0B0C"/>`
    + `<g fill="#F4F4F1" transform="translate(${offset} ${offset}) scale(${scale})">${rects}</g></svg>`;
}

// Maskable icons are cropped to a circle, so the mark stays inside the middle 80%.
const icons = [
  { file: 'icon-192.png', size: 192, scale: 0.72 },
  { file: 'icon-512.png', size: 512, scale: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.66 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, scale } of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(scale)}`);
  writeFileSync(dir + file, optimisePng(await page.screenshot({ type: 'png' })));
  console.log(file);
}
writeFileSync(dir + 'icon.svg', `${svg(0.72)}\n`);
await browser.close();
