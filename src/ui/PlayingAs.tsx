import { useState } from 'react';
import { maintainerOf, people, slotOf, slotStatus, statusOf, type CampaignRecord } from '../demo/world';
import { liveActions } from '../live/actions';
import { paths } from '../routes';
import { MAINTAINER, ORGANIZER, homePath, usePlayAs, useSession } from '../session';
import { PLEBS } from './journey';
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
    { id: ORGANIZER, name: people[ORGANIZER].name, note: 'organizer' },
    { id: MAINTAINER, name: maintainer.name, note: draft?.key?.by === 'maintainer' ? 'maintainer · key confirmed' : 'maintainer' },
    ...PLEBS.map(pleb => ({ id: pleb, name: people[pleb].name, note: standing(record, pleb) })),
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

  return (
    <>
      <button type="button" className="chip-button" onClick={() => setOpen(true)}>
        <span className="avatar" data-size="small" aria-hidden="true">{viewer.short[0]}</span>
        Playing as {viewer.id === MAINTAINER ? maintainer.short : viewer.short}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Playing as">
        <p className="sheet-text">One browser plays everyone for this demo. Each person’s key stays in their own part of this browser’s storage, and no one else’s screen reads it. Ada never has a key.</p>
        <ul className="people" role="list">
          {cast.map(person => (
            <li key={person.id}>
              <button type="button" className="person" aria-pressed={viewer.id === person.id} onClick={() => play(person.id)}>
                <span className="avatar" aria-hidden="true">{person.name[0]}</span>
                <span className="person-name">{person.name}</span>
                <span className="person-note">{person.note}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="button" data-variant="quiet" onClick={startOver}>Start a new stack as Ada</button>
        {/* The stage follows this window through storage, so the people can be played here while it shows. */}
        <a className="text-button" href={paths.stage(id)} target="_blank" rel="noopener">Open the stage in a new window</a>
      </Sheet>
    </>
  );
}
