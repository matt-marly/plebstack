import { useState } from 'react';
import { maintainerOf, people, slotOf, slotStatus, statusOf, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { Link } from 'react-router-dom';
import { Glyph } from './Glyph';
import { Icon } from './Icon';
import { PLEBS } from './journey';
import { Avatar, PersonTag } from './parts';
import { Sheet } from './Sheet';

function standing(record: CampaignRecord | undefined, personId: string): string {
  const slot = record && slotOf(record, personId);
  if (!slot) return record && statusOf(record) !== 'collecting' ? 'not in' : 'not in yet';
  const status = slotStatus(slot);
  return status === 'awaiting' ? 'invoice open' : status === 'deposited' ? 'stacked' : status;
}

// One browser plays everyone: Ada organizes, Ngozi is paid, three plebs chip in. Each keeps their own
// corner of this browser's storage, and nobody's screen reads anyone else's key.
export function PlayingAs({ record }: { record?: CampaignRecord }) {
  const { viewer, stackId } = useSession();
  const playAs = usePlayAs();
  const [open, setOpen] = useState(false);
  const id = record?.campaign.id ?? stackId;
  const draft = id ? liveActions.draft(id) : undefined;
  const maintainer = record ? maintainerOf(record) : draft ? maintainerOf({ maintainerId: MAINTAINER, maintainerName: draft.maintainerName }) : people[MAINTAINER];
  const cast = [
    { id: ORGANIZER, name: people[ORGANIZER].name, note: 'organizer · never holds a key' },
    { id: MAINTAINER, name: maintainer.name, note: draft?.key?.by === 'maintainer' ? 'maintainer · key confirmed' : 'maintainer · gets the payout' },
    ...PLEBS.map(pleb => ({ id: pleb, name: people[pleb].name, note: `pleb · ${standing(record, pleb)}` })),
  ];

  // Each person lands on their own step, not on the screen the last one had open.
  function play(personId: string) {
    setOpen(false);
    playAs(personId, homePath(personId, id), true);
  }

  function startOver() {
    setOpen(false);
    playAs(ORGANIZER, paths.start());
  }

  // Forget every stack, key and person in this browser and start from the intro.
  function resetDemo() {
    if (!confirm('Reset the demo? Every stack, key and sat in this browser is forgotten.')) return;
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('plebstack') || key === 'viewer' || key === 'intro-seen') localStorage.removeItem(key);
    } catch { /* nothing saved, nothing to forget */ }
    location.assign(paths.splash());
  }

  const playing = viewer.id === MAINTAINER ? maintainer.short : viewer.short;
  return (
    <>
      <button type="button" className="switcher" aria-label={`Demo, playing as ${playing}`} onClick={() => setOpen(true)}>
        <span className="switcher-label" aria-hidden="true">Demo</span>
        <Avatar name={playing} own />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Demo mode">
        <p className="sheet-text">Play every person from this one device. Each person’s key stays in their own part of this browser, and Ada never has one.</p>
        <h3 className="sheet-label">Play as</h3>
        <ul className="people" role="list">
          {cast.map(person => (
            <li key={person.id}>
              <button type="button" className="person" aria-pressed={viewer.id === person.id} onClick={() => play(person.id)}>
                <PersonTag name={person.name} role={person.note} own={viewer.id === person.id} />
                {viewer.id === person.id && <span className="person-now">playing</span>}
              </button>
            </li>
          ))}
        </ul>
        <h3 className="sheet-label">More</h3>
        <div className="sheet-rows">
          {/* The stage follows the stack over the relays, so it can sit on another screen. */}
          <a className="sheet-row" href={paths.stage(id)} target="_blank" rel="noopener">
            <Glyph name="watch" /><span>Watch it live<small>The big-screen view, in a new window</small></span><Icon name="chevron" />
          </a>
          <Link className="sheet-row" to={paths.intro(1)} onClick={() => setOpen(false)}>
            <Glyph name="how" /><span>How it works<small>Three short screens</small></span><Icon name="chevron" />
          </Link>
          <button type="button" className="sheet-row" onClick={startOver}>
            <Glyph name="start" /><span>Start a new stack as Ada<small>The old one stays where it is</small></span><Icon name="chevron" />
          </button>
        </div>
        <button type="button" className="button" data-variant="quiet" onClick={resetDemo}>Reset the demo</button>
      </Sheet>
    </>
  );
}
