import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const LEAVE_MS = 220;

// Everything but the sheet goes inert, wherever the sheet sits: the body, or the phone frame on a desktop.
function inertAround(layer: HTMLElement): Element[] {
  const made: Element[] = [];
  for (let node = layer; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      made.push(sibling);
    }
  }
  return made;
}

// A bottom sheet: modal while open, Escape or the scrim closes it, and focus goes back where it came from.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setShown(true);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setShown(false), reduced ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!shown) return;
    opener.current = document.activeElement as HTMLElement | null;
    const behind = inertAround(panel.current!.parentElement!);
    // The panel itself takes focus, so a long sheet opens at its top and Tab moves into it.
    panel.current?.focus({ preventScroll: true });
    return () => {
      behind.forEach(element => element.removeAttribute('inert'));
      // The control that opened it may be gone, say the screen moved on: then the new screen's headline takes focus.
      if (opener.current?.isConnected) opener.current.focus();
      else document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
    };
  }, [shown]);

  if (!shown) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)];
    if (items.length === 0) return event.preventDefault();
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="sheet-layer" data-leaving={leaving || undefined} onKeyDown={onKeyDown}>
      <div className="sheet-scrim" onClick={onClose} />
      <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id={titleId} className="sheet-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.querySelector('[data-sheet-host]') ?? document.body,
  );
}
