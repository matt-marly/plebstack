import { useState } from 'react';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface Fact {
  icon: string;
  text: string;
  term: string;
}

export function reallyFacts(maintainer: string, each: string, total: string): Fact[] {
  return [
    { icon: 'mint', text: `Your sats are at the mint, locked to your key. Only your key can say where they go.`, term: 'NUT-20 locked mint quote' },
    { icon: 'key', text: 'You made a key in this browser. Only the public half leaves.', term: 'secp256k1 key · this browser' },
    { icon: 'pleb', text: 'The organizer never holds your sats or your key.', term: 'terms saved in this browser' },
    { icon: 'nib', text: 'Signing is a signature over this exact batch. It sends nothing by itself.', term: 'NUT-20 signature over the batch' },
    { icon: 'maintainer', text: `The payout is locked to ${maintainer}’s key. Only that key can spend it.`, term: 'NUT-11 P2PK' },
    { icon: 'swap', text: `All three deposits go in one batch: ${total} to ${maintainer}, or none of it. Paid shows only once the mint confirms.`, term: 'NUT-29 batch mint' },
    { icon: 'info', text: `This is a test mint. It marks its own invoices paid, so your ${each} are fake sats.`, term: 'testnut.cashudevkit.org' },
  ];
}

// The plain sentence first, the real term under it in mono.
export function Really({ maintainer, each, total }: { maintainer: string; each: string; total: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="chip-button" onClick={() => setOpen(true)}>
        <Icon name="info" />What’s really happening
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="What’s really happening">
        <ul className="facts" role="list">
          {reallyFacts(maintainer, each, total).map(fact => (
            <li key={fact.term}>
              <Icon name={fact.icon} />
              <p>{fact.text}<span className="mono">{fact.term}</span></p>
            </li>
          ))}
        </ul>
        <button type="button" className="button" data-variant="quiet" onClick={() => setOpen(false)}>Got it</button>
      </Sheet>
    </>
  );
}
