import type { PayoutKey } from '../live/board';
import { shortKey } from './format';
import { Icon } from './Icon';
import { Avatar } from './parts';

export const fixing = (title: string) => `Fixing ${/^[A-Z][a-z]/.test(title) ? title[0].toLowerCase() + title.slice(1) : title}`;

// Who the stack backs, and how far their payout key can be trusted: the key's status on its own row.
export function Who({ name, title, keyBy, pubkey, organizer }: {
  name: string; title: string; keyBy?: PayoutKey['by']; pubkey?: string; organizer?: string;
}) {
  return (
    <div className="who-card">
      <div className="person-tag">
        <Avatar name={name} size="large" />
        <span className="person-tag-text">
          <span className="role-caps">Maintainer</span>
          <span className="person-tag-name">{name}</span>
          <span className="who-work">{fixing(title)}</span>
        </span>
      </div>
      {keyBy && (
        <div className="who-foot">
          <p className="status" data-kind="fact" data-weak={keyBy === 'pasted' || undefined}>
            <Icon name={keyBy === 'pasted' ? 'ring' : 'check'} />
            {keyBy === 'pasted' ? 'Key pasted, not confirmed by her' : <><strong>Key confirmed</strong>on her phone</>}
          </p>
          {pubkey && <span className="mono">{shortKey(pubkey, 4, 4)}</span>}
        </div>
      )}
      {organizer && (
        <div className="who-foot">
          <span className="person-tag" data-size="small">
            <Avatar name={organizer} size="small" />
            <span className="who-by">Organized by <strong>{organizer}</strong></span>
          </span>
        </div>
      )}
    </div>
  );
}
