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
const tabs = [['now', 'Right now'], ['next', 'What’s next'], ['story', 'The whole story']] as const;
type Tab = typeof tabs[number][0];

// Where your sats are, what happens next, and the whole story: three steps, one at a time, plain words first
// and the protocol term under each. Built from the record, so it says only what is true yet.
export function Really({ context }: { context: ReallyContext }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('now');
  const { status, now, next, story } = context;
  const at = tabs.findIndex(([id]) => id === tab);
  const close = () => {
    setOpen(false);
    setTab('now');
  };
  return (
    <>
      <button type="button" className="help" aria-label="Details, what’s really happening" onClick={() => setOpen(true)}>
        <Icon name="info" /><span className="help-text" aria-hidden="true">Details</span>
      </button>
      <Sheet open={open} onClose={close} title="What’s really happening" footer={(
        <>
          {at < tabs.length - 1 ? (
            <button type="button" className="button" data-variant="primary" onClick={() => setTab(tabs[at + 1][0])}>
              {tabs[at + 1][1]}<Icon name="chevron" />
            </button>
          ) : null}
          <button type="button" className="button" data-variant={at < tabs.length - 1 ? 'quiet' : 'secondary'} onClick={close}>Close</button>
        </>
      )}>
        <div className="sheet-for">
          <Status {...status} />
          <span>{youre[context.role]}</span>
        </div>
        <div className="segments" role="tablist" aria-label="Details">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}
              onKeyDown={event => {
                const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                if (!step) return;
                const nextTab = tabs[(at + step + tabs.length) % tabs.length][0];
                setTab(nextTab);
                (event.currentTarget.parentElement?.querySelector(`#tab-${nextTab}`) as HTMLElement | null)?.focus();
              }}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel" role="tabpanel" id="panel-now" aria-labelledby="tab-now" hidden={tab !== 'now'}>
          {now.map && <SatsMap {...now.map} />}
          <p className="now"><strong>{now.lead}</strong> {now.text}<span className="mono">{now.term}</span></p>
        </div>
        <div className="panel" role="tabpanel" id="panel-next" aria-labelledby="tab-next" hidden={tab !== 'next'}>
          <Steps steps={next.steps} current={next.current} />
          {next.aside && (
            <p className="if-not"><Icon name={next.aside.icon} /><span><strong>{next.aside.lead}</strong> {next.aside.text}</span></p>
          )}
        </div>
        <div className="panel story" role="tabpanel" id="panel-story" aria-labelledby="tab-story" hidden={tab !== 'story'}>
          <ul className="facts" role="list">
            {story.map(fact => (
              <li key={fact.term}>
                <Icon name={fact.icon} />
                <p>{fact.text}<span className="mono">{fact.term}</span></p>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
