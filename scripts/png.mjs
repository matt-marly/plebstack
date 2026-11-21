// Shrinks an opaque 8-bit PNG by mapping it to a 256-colour palette: the most used colours, and every
// other colour to its nearest. Screens are flat colour and greyscale-smoothed text, so this reads the same.

import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function* chunks(png) {
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    yield { type: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) };
    at += 12 + length;
  }
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0);
  return Buffer.concat([head, data, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decode(png) {
  let header;
  const idat = [];
  for (const { type, data } of chunks(png)) {
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') idat.push(data);
  }
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
  const [depth, colourType, , , interlace] = header.subarray(8);
  if (depth !== 8 || interlace !== 0 || (colourType !== 2 && colourType !== 6)) return undefined;
  const channels = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? pixels[out + x - channels] : 0;
      const b = y > 0 ? pixels[out - stride + x] : 0;
      const c = x >= channels && y > 0 ? pixels[out - stride + x - channels] : 0;
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      pixels[out + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

export function optimisePng(png) {
  if (!png.subarray(0, 8).equals(SIGNATURE)) return png;
  const image = decode(png);
  if (!image) return png;
  const { width, height, channels, pixels } = image;
  const count = new Map();
  for (let i = 0; i < pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] !== 255) return png;
    const colour = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
    count.set(colour, (count.get(colour) ?? 0) + 1);
  }
  const palette = [...count.keys()].sort((a, b) => count.get(b) - count.get(a)).slice(0, 256);
  const index = new Map(palette.map((colour, i) => [colour, i]));
  const nearest = colour => {
    let best = 0, distance = Infinity;
    for (const [i, entry] of palette.entries()) {
      const dr = (colour >> 16) - (entry >> 16), dg = ((colour >> 8) & 0xff) - ((entry >> 8) & 0xff), db = (colour & 0xff) - (entry & 0xff);
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < distance) [best, distance] = [i, d];
    }
    index.set(colour, best);
    return best;
  };
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0, p = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    for (let x = 0; x < width; x += 1, p += channels) {
      const colour = (pixels[p] << 16) | (pixels[p + 1] << 8) | pixels[p + 2];
      raw[y * (width + 1) + 1 + x] = index.get(colour) ?? nearest(colour);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 3, 0, 0, 0], 8);
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((colour, i) => plte.set([colour >> 16, (colour >> 8) & 0xff, colour & 0xff], i * 3));
  const out = Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  return out.length < png.length ? out : png;
}
