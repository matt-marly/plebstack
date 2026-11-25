import { useState } from 'react';
import { maintainerOf, people, slotOf, slotStatus, statusOf, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
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

  const playing = viewer.id === MAINTAINER ? maintainer.short : viewer.short;
  return (
    <>
      <button type="button" className="switcher" aria-label={`Playing as ${playing}`} onClick={() => setOpen(true)}>
        <Avatar name={playing} />
        <span className="switcher-text" aria-hidden="true">
          <span className="switcher-label">Playing as</span>
          <span className="switcher-name">{playing}</span>
        </span>
        <Icon name="swap" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Playing as">
        <p className="sheet-text">One browser plays everyone for this demo. Each person’s key stays in their own part of this browser’s storage, and no one else’s screen reads it. Ada never has a key.</p>
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
        <button type="button" className="button" data-variant="secondary" onClick={startOver}>Start a new stack as Ada</button>
        {/* The stage follows this window through storage, so the people can be played here while it shows. */}
        <a className="button" data-variant="quiet" href={paths.stage(id)} target="_blank" rel="noopener">
          Open the stage in a new window<Icon name="chevron" />
        </a>
      </Sheet>
    </>
  );
}
