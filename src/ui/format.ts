let zoneOverride: string | undefined;

// Tests pin the zone; the app always uses the viewer's own.
export function setTimeZone(zone: string | undefined) {
  zoneOverride = zone;
}

export function viewerTimeZone(): string {
  return zoneOverride ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

const formats = new Map<string, Intl.DateTimeFormat>();

function partsOf(date: Date, timeZone: string, seconds: boolean) {
  const key = `${timeZone}/${seconds}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined,
      hourCycle: 'h23', timeZone, timeZoneName: 'short',
    });
    formats.set(key, format);
  }
  return Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
}

// Data stays ISO; screens show the viewer's local time with its zone, so nobody converts in their head.
export function formatWhen(iso: string, timeZone = viewerTimeZone()): string {
  const parts = partsOf(new Date(iso), timeZone, false);
  return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${parts.timeZoneName}`;
}

export function formatClock(when: string | Date, timeZone = viewerTimeZone()): string {
  const parts = partsOf(new Date(when), timeZone, true);
  return `${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
}

export function shortKey(key: string, lead = 8, tail = 6): string {
  return key.length <= lead + tail + 1 ? key : `${key.slice(0, lead)}…${key.slice(-tail)}`;
}

const pluralRules = new Intl.PluralRules('en', { type: 'cardinal' });

export function plural(count: number, one: string, other: string): string {
  return `${count} ${pluralRules.select(count) === 'one' ? one : other}`;
}

export function listNames(names: string[]): string {
  return new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(names);
}

// A compressed secp256k1 public key: 02 or 03, then 64 hex characters.
export function isCompressedPubkey(value: string): boolean {
  return /^0[23][0-9a-f]{64}$/i.test(value.trim());
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
