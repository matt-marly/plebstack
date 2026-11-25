import { useState } from 'react';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export interface Fact {
  icon: string;
  text: string;
  term: string;
}

const testMint = (each: string): Fact => ({
  icon: 'info', text: `This is a test mint. It marks its own invoices paid, so the ${each} are fake sats.`, term: 'testnut.cashudevkit.org',
});

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

export function organizerFacts(maintainer: string, each: string): Fact[] {
  return [
    { icon: 'pleb', text: 'You never hold anyone’s sats or any key. What you set goes on the public board.', term: 'no key in the organizer’s storage' },
    { icon: 'key', text: `The payout can only be locked to the key ${maintainer} confirmed on her own device, or the one you pasted.`, term: 'compressed secp256k1 public key' },
    { icon: 'mint', text: 'Each pleb’s sats wait at the mint, locked to their own key.', term: 'NUT-20 locked mint quote' },
    { icon: 'swap', text: `The last signature sends one batch to the mint, locked to ${maintainer}’s key. Paid shows only once the mint confirms.`, term: 'NUT-29 batch mint · NUT-11 P2PK' },
    { icon: 'info', text: 'The close is a rule in this app. It stops collecting; it never moves anyone’s sats.', term: 'app rule, not a lock at the mint' },
    testMint(each),
  ];
}

export function maintainerFacts(total: string): Fact[] {
  return [
    { icon: 'key', text: 'Your key was made in this browser. Only its public half was shared.', term: 'secp256k1 key · this browser' },
    { icon: 'maintainer', text: 'The payout is locked to your key. Only your key can spend it.', term: 'NUT-11 P2PK' },
    { icon: 'swap', text: 'The locked ecash reached you over the shared board. That’s safe: it only works with your key.', term: 'P2PK-locked proofs' },
    { icon: 'nib', text: `All three plebs paid you ${total} in one batch, or none of it would have come.`, term: 'NUT-29 batch mint' },
    { icon: 'mint', text: 'Spend swaps it at the mint for ecash only you hold. The mint keeps its swap fee.', term: 'NUT-03 swap, signed with your key' },
    testMint(total),
  ];
}

// The plain sentence first, the real term under it in mono.
export function Really({ facts }: { facts: Fact[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="help" onClick={() => setOpen(true)}>
        <Icon name="info" />What’s really happening
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="What’s really happening">
        <ul className="facts" role="list">
          {facts.map(fact => (
            <li key={fact.term}>
              <Icon name={fact.icon} />
              <p>{fact.text}<span className="mono">{fact.term}</span></p>
            </li>
          ))}
        </ul>
        <button type="button" className="button" data-variant="secondary" onClick={() => setOpen(false)}>Close</button>
      </Sheet>
    </>
  );
}
