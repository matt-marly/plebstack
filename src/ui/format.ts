const dayAndTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
});

// Mint events are shown in UTC so three backers in three places read the same record.
export function formatWhen(iso: string): string {
  const parts = Object.fromEntries(dayAndTime.formatToParts(new Date(iso)).map(part => [part.type, part.value]));
  return `${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} UTC`;
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
