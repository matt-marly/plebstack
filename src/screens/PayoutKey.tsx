import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { maintainerOf } from '../demo/world';
import { failureCopy, liveActions } from '../live/actions';
import type { BoardDraft } from '../live/board';
import { paths } from '../routes';
import { MAINTAINER, usePlayAs, useSession } from '../session';
import { formatWhen, shortKey } from '../ui/format';
import { Frame } from '../ui/Frame';
import { organizerSteps } from '../ui/GoalRail';
import { Avatar, CopyButton, Note, Quiet, ShareButton } from '../ui/parts';
import { Qr } from '../ui/Qr';
import { organizerFacts } from '../ui/Really';
import { Sheet } from '../ui/Sheet';
import { Who } from '../ui/Who';
import { Field } from './Backing';

const rail = { at: 1, paid: false, steps: organizerSteps } as const;

// O2: the payout key comes from Ngozi's own side. Ada can paste one instead, and it says so wherever it shows.
export function PayoutKey({ draft }: { draft: BoardDraft }) {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const playAs = usePlayAs();
  const [qr, setQr] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [failure, setFailure] = useState<string>();
  const maintainer = maintainerOf(draft);
  const name = maintainer.short;
  const link = `${location.origin}${paths.claim(draft.id)}`;
  const facts = organizerFacts(name, '21 sats');
  const opened = liveActions.world(draft.organizerId).campaigns.some(record => record.campaign.id === draft.id);

  function paste() {
    try {
      liveActions.pasteKey(draft.organizerId, draft.id, pasted);
      setPasting(false);
      refresh(`Key pasted. ${name}’s device hasn’t confirmed it.`);
    } catch (error) {
      setFailure(failureCopy(error));
    }
  }

  const openAsMaintainer = () => playAs(MAINTAINER, paths.claim(draft.id));

  if (draft.key) {
    const confirmed = draft.key.by === 'maintainer';
    return (
      <Frame rail={rail} title={confirmed ? 'Key confirmed' : 'Key pasted'} facts={facts}
        actions={(
          <button type="button" className="button" data-variant="primary"
            onClick={() => navigate(paths.organize(draft.id, opened ? 'watch' : 'terms'))}>
            Next
          </button>
        )}>
        <div className="lead rise">
          <h1>{confirmed ? `${name} confirmed her key.` : 'Key pasted.'}</h1>
          <p>{confirmed
            ? 'The payout can only ever be locked to this key. You never see the private half.'
            : `${name}’s device hasn’t confirmed this key. The payout can only ever be locked to it, so check it with her before you share the stack.`}</p>
        </div>
        <Who name={maintainer.name} title={draft.title} keyBy={draft.key.by} />
        <dl className="rows">
          <div><dt>Payout key</dt><dd className="mono">{shortKey(draft.key.pubkey, 4, 4)}</dd></div>
          <div><dt>{confirmed ? 'Confirmed' : 'Pasted'}</dt><dd className="mono">{formatWhen(draft.key.at)}</dd></div>
          <div><dt>{confirmed ? 'On' : 'Confirmed by her'}</dt><dd className="mono">{confirmed ? `${name}’s own storage` : 'No'}</dd></div>
        </dl>
      </Frame>
    );
  }

  return (
    <Frame rail={rail} title={`Get ${name}’s key`} facts={facts}
      actions={(
        <>
          <ShareButton label="Share claim link" done="Claim link copied" title="Plebstack" url={link}
            text={`I’m starting a stack for you on Plebstack. Confirm your key here so only you can spend what lands.`}
            notice={`Claim link copied. ${name} opens it on her own phone.`} />
          <button type="button" className="button" data-variant="secondary" onClick={() => { setFailure(undefined); setPasting(true); }}>
            Paste a key instead
          </button>
        </>
      )}>
      <div className="lead rise">
        <h1>Get {name}’s key.</h1>
        <p>Send {name} this link. She confirms on her own phone, so only she decides where the money lands.</p>
      </div>
      <div className="link-card">
        <p className="mono link-text">{link.replace(/^https?:\/\//, '')}</p>
        <div className="link-buttons">
          <CopyButton text={link} label="Copy link" />
          <button type="button" className="button" data-variant="secondary" onClick={() => setQr(true)}>Show QR</button>
        </div>
      </div>
      <div className="waiting-on" aria-live="polite">
        <Avatar name={name} />
        <p>Waiting for {name} to confirm on her phone.</p>
      </div>
      <p className="demo-line">
        One browser plays everyone for this demo, so {name}’s phone is her own part of this browser.
      </p>
      <Quiet onClick={openAsMaintainer}>Open the link as {name}</Quiet>
      <Sheet open={qr} onClose={() => setQr(false)} title="Claim link">
        <div className="invoice">
          <Qr text={link} label={`QR code of ${name}’s claim link`} />
          <p className="mono small">{link.replace(/^https?:\/\//, '')}</p>
        </div>
        <button type="button" className="button" data-variant="secondary" onClick={() => setQr(false)}>Back to the claim link</button>
      </Sheet>
      <Sheet open={pasting} onClose={() => setPasting(false)} title={`Paste ${name}’s key`}>
        <Field label="Public key" value={pasted} onChange={value => { setPasted(value); setFailure(undefined); }}
          placeholder="02… or 03…" hint="66 characters: 02 or 03, then 64 hex." error={failure} />
        <Note><p>{name}’s device won’t have confirmed this key. Only use one she gave you herself: the payout can only ever go to it, and the stack will say it wasn’t confirmed.</p></Note>
        <div className="sheet-actions">
          <button type="button" className="button" data-variant="primary" onClick={paste}>Use this key, not confirmed</button>
          <button type="button" className="button" data-variant="secondary" onClick={() => setPasting(false)}>Send the claim link instead</button>
        </div>
      </Sheet>
    </Frame>
  );
}
