import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { stopLabel, type Stop } from './journey';

interface TrackStop {
  name: string;
  icon: string;
  note: string;
}

// Where the chip sits along You (0) → Mint (1) → maintainer (2).
const position: Record<Stop, number> = {
  wallet: 0, 'to-mint': 0.5, 'at-mint': 1, signed: 1, 'to-maintainer': 1.5, 'with-maintainer': 2, 'to-you': 0.5, back: 0,
};

// Three stops and a chip that travels between them. A chip between stops is on its way, and breathes.
function TrackView({ title, label, at: target, from, stops, paid }: {
  title: string; label: string; at: number; from?: number; stops: TrackStop[]; paid?: boolean;
}) {
  const [at, setAt] = useState(from ?? target);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAt(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <section className="track" aria-label={`${title}: ${label}`} data-paid={paid || undefined}>
      <div className="track-head" aria-hidden="true">
        <span>{title}</span>
        <span className="status track-label"><span className="status-dot" aria-hidden="true" />{label}</span>
      </div>
      <div className="track-row" aria-hidden="true">
        {stops.map((item, index) => (
          <div key={index} className="track-stop" data-here={target === index || undefined} style={{ gridColumn: index * 2 + 1 }}>
            <span className="track-box"><Icon name={item.icon} /></span>
            <span className="track-name">{item.name}</span>
            <span className="track-note">{item.note}</span>
          </div>
        ))}
        {[0, 1].map(index => (
          <span key={index} className="track-link" data-passed={at >= index + 1 || undefined} style={{ gridColumn: index * 2 + 2 }} />
        ))}
        <svg className="track-chip" data-moving={target % 1 !== 0 || undefined} style={{ '--at': at } as CSSProperties}
          viewBox="0 0 44 18" focusable="false">
          <polygon points="2,8 10,2 42,2 34,8" fill="#f8f8f6" />
          <polygon points="2,8 34,8 34,16 2,16" fill="#f4f4f1" />
          <polygon points="34,8 42,2 42,10 34,16" fill="#979795" />
        </svg>
      </div>
    </section>
  );
}

// A pleb's own sats: You → Mint → the maintainer, with the label following the state.
export function Track({ stop, from, maintainer, amount }: { stop: Stop; from?: Stop; maintainer: string; amount: string }) {
  return (
    <TrackView title={`Where your ${amount} are`} label={stopLabel(stop, maintainer)} at={position[stop]}
      from={from && position[from]} stops={[
        { name: 'You', icon: 'pleb', note: stop === 'back' ? 'your ecash' : 'your wallet' },
        { name: 'Mint', icon: 'mint', note: stop === 'at-mint' || stop === 'signed' ? 'locked to you' : 'testnut' },
        { name: maintainer, icon: 'maintainer', note: stop === 'with-maintainer' ? 'locked to her key' : 'the payout' },
      ]} />
  );
}

export type PayoutStop = 'none' | 'at-mint' | 'to-you' | 'locked' | 'spent';

// The maintainer's view of the same money: plebs → Mint → her. Lime only while it waits, locked to her key; spent ecash is just hers.
export function PayoutTrack({ stop, label, title }: { stop: PayoutStop; label: string; title: string }) {
  const at = { none: 0, 'at-mint': 1, 'to-you': 1.5, locked: 2, spent: 2 }[stop];
  return (
    <TrackView title={title} label={label} at={at} paid={stop === 'locked'} stops={[
      { name: 'Plebs', icon: 'pleb', note: 'their wallets' },
      { name: 'Mint', icon: 'mint', note: stop === 'at-mint' ? 'locked to each pleb' : 'testnut' },
      { name: 'You', icon: 'maintainer', note: stop === 'spent' ? 'your ecash' : 'locked to your key' },
    ]} />
  );
}
