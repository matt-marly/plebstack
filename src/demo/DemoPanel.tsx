import { useEffect, useRef, useState } from 'react';
import '../styles/demo.css';
import { beats } from './beats';
import { useStore } from './store';

const groups = [...new Set(beats.map(beat => beat.group))];

function typingInto(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

// Recording control, shown only after a visit with ?demo=1.
// Left and right arrows step through the beats; H hides the bar for a clean take.
export function DemoPanel() {
  const { beatId, showBeat } = useStore();
  const [hidden, setHidden] = useState(false);
  const list = useRef<HTMLDetailsElement>(null);
  const index = beats.findIndex(beat => beat.id === beatId);
  const current = beats[index];

  function step(by: number) {
    const next = Math.min(Math.max(index + by, 0), beats.length - 1);
    if (next !== index) showBeat(beats[next].id);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || typingInto(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'ArrowRight') step(1);
      else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'h' || event.key === 'H') setHidden(value => !value);
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (hidden) return null;

  return (
    <aside className="demo" aria-label="Demo control">
      <div className="demo-steps">
        <button type="button" onClick={() => step(-1)} disabled={index <= 0}>Back</button>
        <button type="button" onClick={() => step(1)} disabled={index === beats.length - 1}>Next</button>
      </div>
      <p className="demo-now">
        <span className="demo-count">{current ? `${index + 1} / ${beats.length}` : `– / ${beats.length}`}</span>
        <strong>{current ? current.title : 'Not on a beat'}</strong>
        <span className="demo-line">{current ? current.line : 'Press Next to start the story.'}</span>
      </p>
      <details className="demo-list" ref={list}>
        <summary>All beats</summary>
        <div className="demo-menu">
          {groups.map(group => (
            <section key={group}>
              <h2>{group}</h2>
              <ol>
                {beats.filter(beat => beat.group === group).map(beat => (
                  <li key={beat.id}>
                    <button type="button" aria-current={beat.id === beatId ? 'step' : undefined}
                      onClick={() => { showBeat(beat.id); list.current?.removeAttribute('open'); }}>
                      <span>{beats.indexOf(beat) + 1}</span>{beat.title}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </details>
      <button type="button" onClick={() => setHidden(true)}>Hide <kbd>H</kbd></button>
    </aside>
  );
}
