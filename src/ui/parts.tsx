import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { isSignal, stateColour, stateCopy, type ToneState } from '../domain/states';
import { paths } from '../routes';
import { ORGANIZER, usePlayAs, useSession } from '../session';
import { Icon } from './Icon';

const statusCopy: Partial<Record<ToneState, { word: string; phrase: string }>> = {
  ...stateCopy, unmet: { word: 'Unmet', phrase: 'Didn’t fill' }, collecting: { word: 'Collecting', phrase: '' },
  open: { word: 'Not open yet', phrase: '' }, awaiting: { word: 'Invoice', phrase: 'not paid yet' },
  swapping: { word: 'Swapping', phrase: 'Waiting for the mint' }, 'not swapped': { word: 'Not swapped', phrase: 'Turned down by the mint' },
  swapped: { word: 'Swapped', phrase: 'Yours to copy' },
};

// Where the money is, as a dot and a word. Paid takes its lime from the stylesheet, under data-paid only.
export function Status({ state, phrase }: { state: ToneState; phrase?: string }) {
  const copy = statusCopy[state]!;
  const paid = isSignal(state);
  return (
    <p className="status" data-paid={paid || undefined} style={paid ? undefined : { '--tone': stateColour[state] } as React.CSSProperties}>
      <span className="status-dot" aria-hidden="true" />
      <strong>{copy.word}</strong>
      <span>{phrase ?? copy.phrase}</span>
    </p>
  );
}

// A quiet button only ever goes somewhere, so it always carries the chevron.
export function Quiet({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="button" data-variant="quiet" {...props}>
      {children}<Icon name="chevron" />
    </button>
  );
}

// The way out of any finished or closed stack: Ada starts the next one.
export function NewStack({ variant = 'quiet' }: { variant?: 'primary' | 'quiet' }) {
  const playAs = usePlayAs();
  const start = () => playAs(ORGANIZER, paths.start());
  return variant === 'quiet' ? <Quiet onClick={start}>Start a new stack</Quiet>
    : <button type="button" className="button" data-variant={variant} onClick={start}>Start a new stack</button>;
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

export function CopyButton({ text, label, variant = 'secondary' }: { text: string; label: string; variant?: string }) {
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

// Nothing to tap while the mint answers: the footer stays, and says what it waits for.
export function Pending({ label = 'Waiting for the mint…' }: { label?: string }) {
  return <button type="button" className="button" data-variant="primary" aria-disabled="true">{label}</button>;
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

// Who someone is in this stack: avatar, name, and the part they play.
export function PersonTag({ name, role, own, open, size }: { name?: string; role?: string; own?: boolean; open?: boolean; size?: 'small' }) {
  return (
    <span className="person-tag" data-size={size} data-own={own || undefined}>
      <Avatar name={name} own={own} open={open} size={size ? undefined : 'large'} />
      <span className="person-tag-text">
        {name && <span className="person-tag-name">{name}</span>}
        {role && <span className="person-tag-role">{role}</span>}
      </span>
    </span>
  );
}

export function Avatar({ name, own, open, size }: { name?: string; own?: boolean; open?: boolean; size?: 'small' | 'large' }) {
  return (
    <span className="avatar" data-size={size} data-own={own || undefined} data-open={open || undefined} aria-hidden="true">
      {name?.[0]}
    </span>
  );
}
