import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEST_MINT } from '../../src/domain/models';
import type { FetchLike } from '../../src/protocol/mint';

export type Checks = Record<string, { pass: boolean; detail?: string }>;

export function evidence(name: string, started: string) {
  const dir = join(import.meta.dirname, '../../.evidence', `${name}-${started.replace(/[:.]/g, '-')}`);
  let sequence = 0;

  function save(file: string, value: unknown) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${file}.json`), JSON.stringify(value, null, 2) + '\n');
  }

  // Every mint call is written out as sent and as answered. Requests carry pubkeys and signatures, never keys.
  function recording(role: string, onSend?: (path: string) => void): FetchLike {
    return async (url, init) => {
      const sentAt = new Date().toISOString();
      onSend?.(new URL(url).pathname);
      const response = await fetch(url, init);
      const raw = await response.text();
      let body: unknown = raw;
      try { body = JSON.parse(raw); } catch { /* keep raw */ }
      const label = new URL(url).pathname.replace(/^\/v1\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
      save(`${String(++sequence).padStart(3, '0')}-${role}-${label}`, {
        role, sentAt, receivedAt: new Date().toISOString(),
        request: { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined },
        response: { status: response.status, raw, body },
      });
      return new Response(raw, { status: response.status });
    };
  }

  async function call(role: string, path: string, body?: unknown) {
    const response = await recording(role)(TEST_MINT + path, body === undefined ? undefined : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  function contains(needles: string[]): string[] {
    const files = (() => { try { return readdirSync(dir); } catch { return []; } })();
    return files.filter(file => {
      const text = readFileSync(join(dir, file), 'utf8');
      return needles.some(needle => text.includes(needle));
    });
  }

  return { dir, save, recording, call, contains };
}

export function checker(checks: Checks) {
  return (name: string, pass: boolean, detail?: string) => {
    checks[name] = { pass, ...(detail ? { detail } : {}) };
    return pass;
  };
}
