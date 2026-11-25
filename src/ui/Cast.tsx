import { people } from '../demo/world';
import { MAINTAINER, ORGANIZER } from '../session';
import { PLEBS } from './journey';
import { PersonTag } from './parts';

// Who's who in every stack this browser plays.
export function Cast() {
  return (
    <ul className="cast" role="list" aria-label="Who’s who">
      <li><PersonTag name={people[ORGANIZER].short} role="organizer · never holds a key" size="small" /></li>
      <li><PersonTag name={people[MAINTAINER].short} role="maintainer · gets the payout" size="small" /></li>
      <li><PersonTag name={PLEBS.map(pleb => people[pleb].short).join(', ')} role="plebs · 21 sats each" size="small" /></li>
    </ul>
  );
}
