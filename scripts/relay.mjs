// A tiny in-memory Nostr relay (NIP-01: EVENT, REQ, CLOSE) for trying several devices against one local server,
// and for the browser tests, which can't reach public relays from every network.
//
//   node scripts/relay.mjs            (ws://localhost:7447)
//   PORT=7448 node scripts/relay.mjs
//
// Then open the app with ?relays=ws://localhost:7447 on each device or window.

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

function matches(filter, event) {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.since && event.created_at < filter.since) return false;
  if (filter.until && event.created_at > filter.until) return false;
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith('#')) continue;
    const name = key.slice(1);
    if (!event.tags.some(tag => tag[0] === name && values.includes(tag[1]))) return false;
  }
  return true;
}

function frame(text) {
  const payload = Buffer.from(text);
  const length = payload.length;
  const head = length < 126 ? Buffer.from([0x81, length])
    : length < 65536 ? Buffer.from([0x81, 126, length >> 8, length & 255])
      : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(length)); return b; })()]);
  return Buffer.concat([head, payload]);
}

export function startRelay(port = 7447) {
  const events = [];
  const clients = new Set();

  const server = createServer((_, response) => {
    response.writeHead(200, { 'content-type': 'application/nostr+json', 'access-control-allow-origin': '*' });
    response.end(JSON.stringify({ name: 'plebstack local relay', supported_nips: [1] }));
  });

  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1').update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = { socket, subs: new Map(), send: message => socket.writable && socket.write(frame(JSON.stringify(message))) };
    clients.add(client);
    let buffer = Buffer.alloc(0);
    let pieces = [];

    function handle(text) {
      let message;
      try { message = JSON.parse(text); } catch { return; }
      const [type, ...rest] = message;
      if (type === 'EVENT') {
        const event = rest[0];
        if (!events.some(known => known.id === event.id)) {
          events.push(event);
          for (const other of clients) {
            for (const [id, filters] of other.subs) if (filters.some(filter => matches(filter, event))) other.send(['EVENT', id, event]);
          }
        }
        client.send(['OK', event.id, true, '']);
      } else if (type === 'REQ') {
        const [id, ...filters] = rest;
        client.subs.set(id, filters);
        for (const event of events) if (filters.some(filter => matches(filter, event))) client.send(['EVENT', id, event]);
        client.send(['EOSE', id]);
      } else if (type === 'CLOSE') {
        client.subs.delete(rest[0]);
      }
    }

    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const fin = buffer[0] & 0x80;
        const opcode = buffer[0] & 0x0f;
        let length = buffer[1] & 0x7f;
        let offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
        const masked = buffer[1] & 0x80;
        const total = offset + (masked ? 4 : 0) + length;
        if (buffer.length < total) return;
        const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
        const data = Buffer.from(buffer.subarray(total - length, total));
        if (mask) for (let i = 0; i < data.length; i += 1) data[i] ^= mask[i % 4];
        buffer = buffer.subarray(total);
        if (opcode === 0x8) { socket.end(); return; }
        if (opcode === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
        if (opcode === 0x1 || opcode === 0x0) {
          pieces.push(data);
          if (fin) { handle(Buffer.concat(pieces).toString()); pieces = []; }
        }
      }
    });
    socket.on('close', () => clients.delete(client));
    socket.on('error', () => clients.delete(client));
  });

  return new Promise(resolve => server.listen(port, () => resolve({
    url: `ws://localhost:${port}`,
    events,
    close: () => new Promise(done => { for (const client of clients) client.socket.destroy(); server.close(done); }),
  })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const relay = await startRelay(Number(process.env.PORT ?? 7447));
  console.log(`relay listening on ${relay.url}`);
}
