import { useState } from 'react';
import type { NextStep, ReallyContext, Role } from './explain';
import { Icon } from './Icon';
import { Status } from './parts';
import { SatsMap } from './SatsMap';
import { Sheet } from './Sheet';

const youre: Record<Role, string> = { organizer: 'you’re the organizer', pleb: 'you’re a pleb', maintainer: 'you’re the maintainer' };

// Numbered, the one that comes first filled. The plain sentence first, the real term under it in mono.
export function Steps({ steps, current }: { steps: NextStep[]; current?: number }) {
  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li key={step.text} data-now={index === current || undefined}>
          <span className="num" aria-hidden="true">{index + 1}</span>
          <p>{step.text}{step.term && <span className="mono">{step.term}</span>}</p>
        </li>
      ))}
    </ol>
  );
}

// Right now, what happens next, then the whole story folded away. Built from the record, so it says only what is true yet.
export function Really({ context }: { context: ReallyContext }) {
  const [open, setOpen] = useState(false);
  const { status, now, next, story } = context;
  return (
    <>
      <button type="button" className="help" aria-label="Details: what’s really happening" onClick={() => setOpen(true)}>
        <Icon name="info" /><span className="help-text" aria-hidden="true">Details</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="What’s really happening">
        <div className="sheet-for">
          <Status {...status} />
          <span>{youre[context.role]}</span>
        </div>
        <div className="part">
          <h3>Right now</h3>
          {now.map && <SatsMap {...now.map} />}
          <p className="now"><strong>{now.lead}</strong> {now.text}<span className="mono">{now.term}</span></p>
        </div>
        <div className="part">
          <h3>What happens next</h3>
          <Steps steps={next.steps} current={next.current} />
          {next.aside && (
            <p className="if-not"><Icon name={next.aside.icon} /><span><strong>{next.aside.lead}</strong> {next.aside.text}</span></p>
          )}
        </div>
        <details className="disclosure story">
          <summary>
            <span>The whole story <span className="mono">{story.length} facts</span></span>
            <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <ul className="facts" role="list">
            {story.map(fact => (
              <li key={fact.term}>
                <Icon name={fact.icon} />
                <p>{fact.text}<span className="mono">{fact.term}</span></p>
              </li>
            ))}
          </ul>
        </details>
        <div className="sheet-foot">
          <button type="button" className="button" data-variant="secondary" onClick={() => setOpen(false)}>Close</button>
        </div>
      </Sheet>
    </>
  );
}
