import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LogEntry } from '../demo/world';
import { isSignal, stateColour, type ToneState } from '../domain/states';
import { formatWhen, shortKey } from './format';
import { Icon } from './Icon';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Plebstack`;
  }, [title]);
}

// After an action replaces the control that had focus, put focus back on the page heading.
export function focusHeading() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus());
}

export function PageHead({ back, eyebrow, title, children }: {
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {back && (
        <p className="page-back">
          <Link to={back.to}><Icon name="arrow-left" size={16} />{back.label}</Link>
        </p>
      )}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 tabIndex={-1}>{title}</h1>
      {children && <div className="page-purpose">{children}</div>}
    </header>
  );
}

export function Section({ label, children, quiet }: { label: string; children: ReactNode; quiet?: boolean }) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={id} data-quiet={quiet || undefined}>
      <h2 id={id} className="section-label">{label}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function Amount({ value, of, size = 'large' }: { value: number; of?: number; size?: 'large' | 'row' }) {
  const unit = (of ?? value) === 1 ? 'sat' : 'sats';
  return (
    <span className="amount" data-size={size}>
      <span className="amount-figure">{value.toLocaleString('en')}</span>
      {of !== undefined && <span className="amount-of"> of {of.toLocaleString('en')}</span>}
      <span className="amount-unit"> {unit}</span>
    </span>
  );
}

// Glyph and word take the state's colour; only a signal state is lit.
export function tone(state: ToneState) {
  return { 'data-signal': isSignal(state) || undefined, style: { '--state': stateColour[state] } as CSSProperties };
}

export function StateBlock({ state, icon, word, phrase, sentence, children }: {
  state: ToneState;
  icon: string;
  word: string;
  phrase?: string;
  sentence: string;
  children?: ReactNode;
}) {
  return (
    <div className="state" data-state={state} {...tone(state)}>
      <Icon name={icon} size={28} />
      <div className="state-text">
        <p className="state-word">{word}</p>
        {phrase && <p className="state-phrase">{phrase}</p>}
        <p className="state-sentence">{sentence}</p>
        {children}
      </div>
    </div>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return <dl className="facts">{children}</dl>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function KeyText({ value, label }: { value: string; label: string }) {
  return (
    <details className="reveal">
      <summary>
        <span className="mono">{shortKey(value)}</span>
        <span className="reveal-hint">Show full {label}</span>
      </summary>
      <p className="mono wrap-anywhere">{value}</p>
      <CopyButton text={value} label={`Copy ${label}`} />
    </details>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be refused; the text stays on screen to select by hand.
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="copy">
      <button type="button" className="button" data-size="small" onClick={copy}>
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'Copied' : label}
      </button>
      <span role="status" className="visually-hidden">{copied ? 'Copied to the clipboard.' : ''}</span>
    </span>
  );
}

export function Note({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="note">
      {title && <p className="note-title">{title}</p>}
      {children}
    </div>
  );
}

export function RecordList({ entries }: { entries: LogEntry[] }) {
  return (
    <ol className="record" role="list">
      {[...entries].reverse().map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <time dateTime={entry.at}>{formatWhen(entry.at)}</time>
          <span>{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function ConfirmDialog({ open, title, confirmLabel, cancelLabel = 'Not yet', onConfirm, onCancel, children }: {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // Escape is handled here so the parent's state changes before the dialog does. The close event
    // arrives a moment later, so it's ignored if the dialog has been opened again by then.
    <dialog ref={ref} className="dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onCancel(); }}
      onClose={() => { if (!ref.current?.open) onCancel(); }}>
      <h2 id={titleId}>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="button" data-variant="primary" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
