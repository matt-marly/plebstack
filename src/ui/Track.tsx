import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { stopLabel, type Stop } from './journey';

// Where the chip sits along You (0) → Mint (1) → maintainer (2).
const position: Record<Stop, number> = {
  wallet: 0, 'to-mint': 0.5, 'at-mint': 1, 'to-maintainer': 1.5, 'with-maintainer': 2, 'to-you': 0.5, back: 0,
};

const moving = (stop: Stop) => position[stop] % 1 !== 0;

export function Track({ stop, from, maintainer, amount }: { stop: Stop; from?: Stop; maintainer: string; amount: string }) {
  const [at, setAt] = useState(position[from ?? stop]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAt(position[stop]));
    return () => cancelAnimationFrame(frame);
  }, [stop]);

  const label = stopLabel(stop, maintainer);
  const stops = [
    { name: 'You', icon: 'pleb', note: stop === 'back' ? 'your ecash' : 'your wallet' },
    { name: 'Mint', icon: 'mint', note: stop === 'at-mint' ? 'locked to you' : 'testnut' },
    { name: maintainer, icon: 'maintainer', note: stop === 'with-maintainer' ? 'locked to her key' : 'the payout' },
  ];
  return (
    <section className="track" aria-label={`Where your ${amount} are: ${label}`}>
      <div className="track-head" aria-hidden="true">
        <span>Where your {amount} are</span>
        <span className="track-label">{label}</span>
      </div>
      <div className="track-row" aria-hidden="true">
        {stops.map((item, index) => (
          <div key={item.name} className="track-stop" data-here={position[stop] === index || undefined}
            style={{ gridColumn: index * 2 + 1 }}>
            <span className="track-box"><Icon name={item.icon} /></span>
            <span className="track-name">{item.name}</span>
            <span className="track-note">{item.note}</span>
          </div>
        ))}
        {[0, 1].map(index => (
          <span key={index} className="track-link" data-passed={at >= index + 1 || undefined} style={{ gridColumn: index * 2 + 2 }} />
        ))}
        <svg className="track-chip" data-moving={moving(stop) || undefined} style={{ '--at': at } as CSSProperties}
          viewBox="0 0 44 18" focusable="false">
          <polygon points="2,8 10,2 42,2 34,8" fill="#f8f8f6" />
          <polygon points="2,8 34,8 34,16 2,16" fill="#f4f4f1" />
          <polygon points="34,8 42,2 42,10 34,16" fill="#979795" />
        </svg>
      </div>
    </section>
  );
}
