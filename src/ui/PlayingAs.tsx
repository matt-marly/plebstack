import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { people, slotOf, slotStatus, type CampaignRecord } from '../demo/world';
import { paths } from '../routes';
import { useSession } from '../session';
import { PLEBS } from './journey';
import { Sheet } from './Sheet';

function standing(record: CampaignRecord | undefined, personId: string): string {
  const slot = record && slotOf(record, personId);
  if (!slot) return 'not in yet';
  const status = slotStatus(slot);
  return status === 'awaiting' ? 'invoice open' : status === 'deposited' ? 'stacked' : status;
}

// One browser plays all three plebs. Each keeps their key in their own corner of this browser's storage.
export function PlayingAs({ record, onFresh }: { record?: CampaignRecord; onFresh?: (id: string) => void }) {
  const { viewer, viewAs, freshStack } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Each pleb lands on their own step, not on the screen the last pleb had open.
  function play(id: string) {
    viewAs(id);
    setOpen(false);
    if (record) navigate(paths.stack(record.campaign.id), { replace: true });
  }
  return (
    <>
      <button type="button" className="chip-button" onClick={() => setOpen(true)}>
        <span className="avatar" data-size="small" aria-hidden="true">{viewer.short[0]}</span>
        Playing as {viewer.short}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Playing as">
        <p className="sheet-text">One browser plays everyone for this demo. Each pleb’s key stays in their own part of this browser’s storage, and no one else’s screen reads it.</p>
        <ul className="people" role="list">
          {PLEBS.map(id => (
            <li key={id}>
              <button type="button" className="person" aria-pressed={viewer.id === id}
                onClick={() => play(id)}>
                <span className="avatar" aria-hidden="true">{people[id].short[0]}</span>
                <span className="person-name">{people[id].name}</span>
                <span className="person-note">{standing(record, id)}</span>
              </button>
            </li>
          ))}
        </ul>
        {onFresh && (
          <button type="button" className="button" data-variant="quiet"
            onClick={() => { setOpen(false); onFresh(freshStack()); }}>
            Open a fresh stack
          </button>
        )}
      </Sheet>
    </>
  );
}
