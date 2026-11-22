import { useEffect, useRef, useState, type ReactNode } from 'react';
import { stateColour, stateCopy, type ToneState } from '../domain/states';
import { useSession } from '../session';

const chipCopy: Partial<Record<ToneState, { word: string; phrase: string }>> = {
  ...stateCopy, unmet: { word: 'Unmet', phrase: 'Didn’t fill' }, collecting: { word: 'Collecting', phrase: '' },
};

export function StateChip({ state, phrase }: { state: ToneState; phrase?: string }) {
  const copy = chipCopy[state]!;
  return (
    <p className="state-chip" style={{ '--tone': stateColour[state] } as React.CSSProperties}>
      <span className="state-dot" aria-hidden="true" />
      <strong>{copy.word}</strong>
      <span>{phrase ?? copy.phrase}</span>
    </p>
  );
}

// Calm, no red: what happened, what's true now, what you can do.
export function Note({ children }: { children: ReactNode }) {
  return <div className="note" role="alert">{children}</div>;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    return () => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function CopyButton({ text, label, variant = 'quiet' }: { text: string; label: string; variant?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: the text is still on screen to select by hand.
    }
  }
  return (
    <button type="button" className="button" data-variant={variant} onClick={() => void copy()}>
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

// Web Share where there is one, otherwise the text and link go to the clipboard.
export function ShareButton({ label, done, title, text, url, notice, variant = 'primary' }: {
  label: string; done: string; title: string; text: string; url: string; notice?: string; variant?: string;
}) {
  const { announce } = useSession();
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      if (notice) announce(notice);
    } catch {
      // A closed share sheet is not an error.
    }
  }
  return (
    <button type="button" className="button" data-variant={variant} onClick={() => void share()}>
      {copied ? done : label}
    </button>
  );
}

// The invite is this stack's address. One browser plays everyone, so the notice says how to play the next pleb.
export function ShareInvite({ campaignId, title }: { campaignId: string; title: string }) {
  return (
    <ShareButton label="Share invite" done="Invite link copied" title="Plebstack" text={title} url={`${location.origin}/s/${campaignId}`}
      notice="Invite link copied. To play the next pleb in this browser, switch who you’re playing as." />
  );
}

export function Avatar({ name, own, open, size }: { name?: string; own?: boolean; open?: boolean; size?: 'small' | 'large' }) {
  return (
    <span className="avatar" data-size={size} data-own={own || undefined} data-open={open || undefined} aria-hidden="true">
      {name?.[0]}
    </span>
  );
}
