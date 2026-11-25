import { Icon } from './Icon';
import { Slab } from './Slab';
import type { SatsMapProps } from './explain';

const icons = ['pleb', 'mint', 'maintainer'];
const columns = [0, 0.5, 1, 1.5, 2];

// Where every slot's sats are: three stops, and one slab per slot at the stop the record says, or breathing
// between two while the mint hasn't answered. A picture only; the sentence under it says the same.
export function SatsMap({ head, meta, nodes, slabs, paid }: SatsMapProps) {
  const money = slabs.filter(slab => slab.tone !== 'open');
  const counts = [0, 1, 2].map(at => money.filter(slab => slab.at === at).length);
  const most = Math.max(...counts);
  const here = most === 0 ? 0 : counts.lastIndexOf(most);
  const crossed = [money.some(slab => slab.at >= 1 || slab.tone === 'outline'), money.some(slab => slab.at === 2)];
  return (
    <figure className="map" data-paid={paid || undefined} aria-hidden="true">
      <div className="map-head">
        <span>{head}</span>
        {meta && <span>{meta}</span>}
      </div>
      <div className="map-grid">
        {columns.map((at, column) => (
          <div key={at} className="map-pile" style={{ gridColumn: column + 1 }}>
            {slabs.filter(slab => slab.at === at).map((slab, index) => (
              <span key={index} className="map-slab" data-moving={at % 1 !== 0 || undefined} data-own={slab.own || undefined}>
                <svg viewBox="0 0 46 22" focusable="false">
                  <Slab x={1} y={9} width={30} height={11} depth={[14, 7]} tone={slab.tone} />
                </svg>
                {slab.name && <span>{slab.name}</span>}
              </span>
            ))}
          </div>
        ))}
        {nodes.map((node, index) => (
          <div key={index} className="map-node" data-here={here === index || undefined} style={{ gridColumn: index * 2 + 1 }}>
            <span className="map-box"><Icon name={icons[index]} /></span>
            <span className="map-name">{node.name}</span>
            <span className="map-note">{node.note}</span>
          </div>
        ))}
        {crossed.map((passed, index) => (
          <span key={index} className="map-link" data-passed={passed || undefined} style={{ gridColumn: index * 2 + 2 }} />
        ))}
      </div>
    </figure>
  );
}
