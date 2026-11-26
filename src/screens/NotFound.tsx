import { useNavigate } from 'react-router-dom';
import { people } from '../demo/world';
import { sync } from '../live/sync';
import { paths } from '../routes';
import { ORGANIZER, usePlayAs } from '../session';
import { Hold } from '../ui/Hold';

const relayCount = () => sync?.relays.length ?? 0;

// While a stack is on its way from the relays: the slabs stacking, and what the app is doing.
export function Arriving({ seating }: { seating?: boolean }) {
  const count = relayCount();
  return (
    <Hold mode="stacking" title={seating ? 'Getting your seat' : 'Opening the stack'}
      text={seating ? 'Checking which seats are free.' : `Looking for it on ${count} Nostr relay${count === 1 ? '' : 's'}.`}
      detail="Nothing is paid and no key leaves this device."
      slowAfterMs={6000} slow="Still looking. The organizer’s device has to have shared it once." />
  );
}

// The stack exists but its organizer hasn't opened it yet. This page moves on by itself when they do.
export function NotOpenYet({ organizerId }: { organizerId: string }) {
  const navigate = useNavigate();
  const organizer = people[organizerId]?.short ?? 'The organizer';
  return (
    <Hold mode="stacking" title={`${organizer} is still setting this up`}
      text="Keep this page open. It updates the moment the stack opens."
      detail="Nothing to pay yet.">
      <button type="button" className="button" data-variant="secondary" onClick={() => navigate(paths.home())}>Back to home</button>
    </Hold>
  );
}

// Every pleb seat is taken by another device.
export function Full() {
  const navigate = useNavigate();
  return (
    <Hold mode="empty" title="This stack is full" text="All 3 places are taken. Start your own stack instead.">
      <button type="button" className="button" data-variant="primary" onClick={() => navigate(paths.home())}>Back to home</button>
    </Hold>
  );
}

export function NotFound() {
  const playAs = usePlayAs();
  const navigate = useNavigate();
  return (
    <Hold mode="empty" title="We couldn’t find this stack"
      text="This link doesn’t match a stack yet. Ask the organizer to check it, or start your own.">
      <button type="button" className="button" data-variant="primary" onClick={() => playAs(ORGANIZER, paths.start())}>
        Start a stack
      </button>
      <button type="button" className="button" data-variant="secondary" onClick={() => navigate(paths.intro(1))}>See how it works</button>
    </Hold>
  );
}
