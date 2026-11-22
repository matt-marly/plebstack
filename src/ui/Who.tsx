import type { PayoutKey } from '../live/board';
import { Avatar } from './parts';

export const fixing = (title: string) => `Fixing ${/^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title}`;

const badges = { maintainer: 'Key confirmed', pasted: 'Key pasted, not confirmed by her' };

// Who the stack backs, and how far their payout key can be trusted.
export function Who({ name, title, keyBy, organizer }: { name: string; title: string; keyBy?: PayoutKey['by']; organizer?: string }) {
  return (
    <div className="who">
      <Avatar name={name} size="large" />
      <div>
        <p className="who-name">
          {name}
          {keyBy && <span className="badge" data-key={keyBy}><span className="badge-dot" aria-hidden="true" />{badges[keyBy]}</span>}
        </p>
        <p className="who-work">{fixing(title)}</p>
        {organizer && <p className="who-work">Organized by {organizer}</p>}
      </div>
    </div>
  );
}
