import type { PayoutKey } from '../live/board';
import { Icon } from './Icon';
import { Avatar } from './parts';

export const fixing = (title: string) => `Fixing ${/^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title}`;

// Who the stack backs, and how far their payout key can be trusted.
export function Who({ name, title, keyBy, organizer }: { name: string; title: string; keyBy?: PayoutKey['by']; organizer?: string }) {
  return (
    <div className="who">
      <Avatar name={name} size="large" />
      <div className="who-text">
        <p className="who-name">{name}</p>
        <p className="who-work">{fixing(title)}</p>
        {organizer && <p className="who-work">Organized by {organizer}</p>}
        {keyBy && (
          <p className="status" data-kind="fact" data-weak={keyBy === 'pasted' || undefined}>
            <Icon name={keyBy === 'pasted' ? 'ring' : 'check'} />
            {keyBy === 'pasted' ? 'Key pasted, not confirmed by her' : <><strong>Key confirmed</strong>on her phone</>}
          </p>
        )}
      </div>
    </div>
  );
}
