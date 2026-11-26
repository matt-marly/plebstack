import type { ReactNode } from 'react';
import { maintainerOf, people, sats, fellShort, statusOf, tally, type CampaignRecord, type World } from '../demo/world';
import type { Wallet } from '../live/actions';
import type { BoardDraft } from '../live/board';
import { whyClosed } from '../screens/Join';
import { whyUnmet } from '../screens/Unmet';
import { listNames, shortKey } from './format';
import { Brand } from './Frame';
import { GoalRail, maintainerSteps } from './GoalRail';
import { GroupCard } from './GroupCard';
import { Icon } from './Icon';
import { journeyOf, whoIsIn, type Journey, type Rail } from './journey';
import { Avatar, Status } from './parts';
import { Qr } from './Qr';
import { PayoutTrack, Track } from './Track';
import { fixing, Who } from './Who';

export interface MiniView {
  // The headline, which is also what a screen reader hears for this phone.
  title: string;
  body: ReactNode;
  actions?: ReactNode;
}

// A phone-sized screen drawn at its real size and scaled down. Inert: it shows, it never acts.
export function MiniPhone({ label, playing, rail, view, tick }: {
  label: string; playing: string; rail: Rail; view: MiniView; tick?: boolean;
}) {
  return (
    <section className="mini" aria-label={`${label}: ${view.title}`}>
      <div className="mini-glass" aria-hidden="true" inert>
        <div className="mini-screen">
          <div className="top-bar"><Brand /><span className="env"><span className="env-dot" aria-hidden="true" />Testnet</span></div>
          <GoalRail {...rail} slim />
          <p className="mini-playing"><strong>{playing}</strong>’s phone</p>
          {view.body}
          {view.actions && <div className="mini-actions">{view.actions}</div>}
        </div>
      </div>
      {tick && <span className="mini-tick" aria-hidden="true"><Icon name="nib" /></span>}
    </section>
  );
}

function Lead({ chip, title, text, display }: { chip?: ReactNode; title: string; text?: string; display?: boolean }) {
  return (
    <div className="lead">
      {chip}
      <h1 className={display ? 'display' : undefined}>{title}</h1>
      {text && <p>{text}</p>}
    </div>
  );
}

// What that phone offers, as words: nothing on the stage looks like something to tap.
function Offers({ items }: { items: string[] }) {
  return (
    <p className="mini-next">
      <span className="mini-next-label">On this phone</span>
      <span>{items.join(' · ')}</span>
    </p>
  );
}

const missing = ['', 'One more pleb', 'Two more plebs', 'Three more plebs'];

type Shown = { journey?: Journey; view: MiniView };

// That pleb's own current screen, from the same live record their phone reads, with its own words and buttons.
export function plebView(record: CampaignRecord | undefined, personId: string, draft?: BoardDraft): Shown {
  if (!record) {
    const who = draft ? maintainerOf({ maintainerId: draft.maintainerId, maintainerName: draft.maintainerName }).short : 'a maintainer';
    const title = 'Not open yet.';
    return { view: { title, body: <Lead title={title} text={`${people[draft?.organizerId ?? 'ada'].short} is setting up a stack for ${who}. Nothing to pay yet.`} /> } };
  }
  const world: World = { viewerId: personId, campaigns: [record], notice: '' };
  const journey = journeyOf(world, record);
  const maintainer = maintainerOf(record);
  const organizer = people[record.creatorId].short;
  const each = sats(record.campaign.contributionSat);
  const total = sats(record.campaign.contributionSat * record.campaign.backerCount);
  const track = <Track stop={journey.stop} maintainer={maintainer.short} amount={each} />;
  const shown = (title: string, body: ReactNode, actions?: ReactNode): Shown => ({ journey, view: { title, body, actions } });

  switch (journey.screen) {
    case 'join': {
      const full = journey.step.kind !== 'join';
      const short = full && fellShort(record);
      const title = short ? 'This stack didn’t fill.' : full ? 'This stack is full.' : `${organizer} is getting 3 plebs to back ${maintainer.short}.`;
      return shown(title, (
        <>
          <Lead title={title} text={full ? whyClosed(record, personId)
            : `Chip in ${each}. If all three of you sign, ${maintainer.short} gets ${total}. If not, everyone takes their own back.`} />
          <Who name={maintainer.name} title={record.campaign.title} keyBy={record.keyBy} pubkey={record.campaign.beneficiaryPubkey}
            organizer={organizer} />
        </>
      ), full ? <Offers items={['Start a new stack', 'See how it works', `Play as ${organizer}`]} /> : (
        <>
          <Offers items={[`Chip in ${each}`]} />
          <p className="fine">Nobody holds your keys but you. Not us, not the organizer.</p>
        </>
      ));
    }
    case 'pay': {
      const quote = record.slots.find(slot => slot.backerId === personId)!.quote!;
      return shown(`Pay ${each} to stack.`, (
        <>
          <Lead title={`Pay ${each} to stack.`} />
          <div className="invoice">
            <Qr text={`lightning:${quote.invoice}`} label={`QR code of the Lightning invoice for ${each}`} />
            <p className="small muted">Test mint: it marks its own invoices paid. Fake sats.</p>
          </div>
          {track}
        </>
      ), <Offers items={['Open in wallet', 'Copy invoice']} />);
    }
    case 'stacked': case 'waiting': {
      const others = whoIsIn(record, personId).filter(name => name !== 'you');
      const title = `${missing[record.campaign.backerCount - tally(record).held]} and you’re at the line.`;
      return shown(title, (
        <>
          <Lead chip={<Status state="deposited" />} title={title} />
          <div className="in">
            {record.slots.map(slot => (slot.deposit && slot.deposit.state !== 'reclaimed'
              ? <Avatar key={slot.id} name={people[slot.backerId!].short} own={slot.backerId === personId} />
              : <Avatar key={slot.id} open />))}
            <p>{others.length ? `${listNames(others)} and you are in` : 'You’re the first one in'}</p>
          </div>
          {track}
        </>
      ), <Offers items={['Share invite', 'Take mine back']} />);
    }
    case 'sign': {
      const stopped = journey.step.kind === 'stopped';
      const title = stopped ? 'You stopped signing on this device.' : 'Everyone’s in. Sign the group card.';
      return shown(title, (
        <>
          <Lead chip={<Status state="ready" />} title={title} />
          <GroupCard record={record} viewerId={personId} />
        </>
      ), stopped ? <Offers items={['Take mine back']} /> : (
        <>
          <Offers items={[`Sign for the ${record.campaign.contributionSat * record.campaign.backerCount}-sat payout`]} />
          <p className="fine">Once you sign, you can’t unsign.</p>
        </>
      ));
    }
    case 'signed': {
      const waitingOn = journey.step.kind === 'approved' ? journey.step.waitingOn : [];
      const title = waitingOn.length ? `Signed. Waiting for ${listNames(waitingOn)}.` : 'All three signed.';
      return shown(title, (
        <>
          <Lead chip={<Status state="approved" />} title={title} />
          <GroupCard record={record} viewerId={personId} />
        </>
      ), waitingOn.length ? <Offers items={['Share a nudge', 'Take mine back']} /> : <Offers items={['Send to the mint']} />);
    }
    case 'sending':
      return shown('All three signed. Sending.', (
        <>
          <Lead chip={<Status state="paying out" />} title="All three signed. Sending."
            text="The payout is with the mint as one batch. Nothing is paid until the mint confirms." />
          {track}
        </>
      ));
    case 'paid':
      return shown('Stacked. Paid.', (
        <>
          <Lead chip={<Status state="paid" phrase="Confirmed by the mint" />} title="Stacked. Paid." display />
          <section className="card receipt">
            <div className="receipt-to">
              <Avatar name={maintainer.short} size="large" />
              <div>
                <p className="receipt-title">{maintainer.short} got {total}</p>
                <p className="group-sub">Organized by {organizer}</p>
              </div>
            </div>
          </section>
          {track}
        </>
      ), <Offers items={['Share the stack']} />);
    case 'race':
      return shown('The payout got there first.', (
        <>
          <Lead chip={<Status state="paid" phrase="Confirmed by the mint" />} title="The payout got there first."
            text={`Your ${each} went to ${maintainer.short}. Your take-back was turned down.`} />
          {track}
        </>
      ), <Offers items={['See the receipt']} />);
    case 'unmet':
      return shown('No payout this time.', (
        <>
          <Lead chip={<Status state="unmet" />} title="No payout this time." text={whyUnmet(record, personId)} />
          {track}
        </>
      ), <Offers items={['Take mine back']} />);
    case 'back': {
      const back = journey.step.kind === 'reclaimed';
      return shown(back ? 'Back to you.' : 'Taking it back.', (
        <>
          <Lead chip={<Status state={back ? 'reclaimed' : 'reclaiming'} />} title={back ? 'Back to you.' : 'Taking it back.'} display={back}
            text={back ? `Your ${each} are now ecash saved in this browser. Paste it into any Cashu wallet.` : `Asking the mint for your own ${each}.`} />
          {track}
        </>
      ), back && <Offers items={['Copy ecash']} />);
    }
  }
}

export interface MaintainerMini {
  rail: Rail;
  view: MiniView;
}

// Ngozi's own current screen: claim, follow, receive, spend. Amounts only; nothing here reads her key.
export function maintainerView(draft: BoardDraft | undefined, record: CampaignRecord | undefined, wallet: Wallet, arrived: boolean): MaintainerMini {
  const rail = (at: Rail['at']): Rail => ({ at, paid: false, steps: maintainerSteps });
  const organizer = people[draft?.organizerId ?? record?.creatorId ?? 'ada'].short;
  if (!draft?.key && !record) {
    const title = `${organizer} is starting a stack for you.`;
    return { rail: rail(0), view: { title, body: (
      <>
        <Lead title={title} text="Confirm to make your key in this browser. Only its public half is shared, so only you can spend what lands." />
        {draft && <div className="link-card"><p className="card-title">{fixing(draft.title)}</p><p className="small muted">3 plebs · 21 sats each</p></div>}
      </>
    ), actions: <Offers items={['Confirm my key']} /> } };
  }
  if (!record) {
    const title = 'Your key is confirmed.';
    return { rail: rail(1), view: { title, body: (
      <>
        <Lead title={title} text={`${organizer} is setting the terms next. The payout will be locked to your key. Nothing to do yet.`} />
        <dl className="rows">
          <div><dt>Your payout key</dt><dd className="mono">{shortKey(draft!.key!.pubkey, 4, 4)}</dd></div>
        </dl>
      </>
    ) } };
  }
  const total = sats(record.campaign.contributionSat * record.campaign.backerCount);
  const state = statusOf(record);
  const spend = wallet.spend;
  if (spend?.status === 'confirmed' && spend.receivedSat !== undefined) {
    const title = `Yours. ${sats(spend.receivedSat)}.`;
    return { rail: { ...rail(3), done: true }, view: { title, body: (
      <>
        <Lead title={title} display text={`Swap fee at the mint, ${sats(spend.grossSat - spend.receivedSat)}. Received, ${sats(spend.receivedSat)}. Copy it into any Cashu wallet.`} />
        <dl className="rows">
          <div><dt>From the payout</dt><dd className="mono">{sats(spend.grossSat)}</dd></div>
          <div><dt>Swap fee at the mint</dt><dd className="mono">{sats(spend.grossSat - spend.receivedSat)}</dd></div>
          <div><dt>Received</dt><dd className="mono">{sats(spend.receivedSat)}</dd></div>
        </dl>
      </>
    ), actions: <Offers items={['Copy ecash']} /> } };
  }
  if (spend) {
    const rejected = spend.status === 'rejected';
    const title = rejected ? 'The mint turned down the swap.' : 'Swapping at the mint.';
    return { rail: rail(3), view: { title, body: (
      <Lead chip={<Status state={rejected ? 'not swapped' : 'swapping'} />} title={title}
        text={rejected ? `Nothing was swapped. Your ${total} are still locked to your key.` : 'Your swap is saved in this browser. Nothing is yours to copy until the mint answers.'} />
    ) } };
  }
  if (state === 'paid' && arrived) {
    const title = `${total} for you.`;
    return { rail: rail(2), view: { title, body: (
      <>
        <Lead chip={<Status state="paid" phrase="Confirmed by the mint" />} title={title} display text="Three plebs stacked together." />
        <PayoutTrack title={`Where your ${total} are`} stop="locked" label="locked to your key" />
      </>
    ), actions: <Offers items={['Spend']} /> } };
  }
  const { held, heldSat, targetSat } = tally(record);
  const unmet = state === 'unmet' || state === 'reclaimed';
  const sending = state === 'paying out' || state === 'paid';
  const title = unmet ? 'No payout this time.' : sending ? 'On its way to you.' : 'A stack for you.';
  return { rail: rail(1), view: { title, body: (
    <>
      <Lead chip={unmet ? <Status state="unmet" /> : sending ? <Status state="paying out" />
        : <Status state="collecting" phrase={held === 3 ? 'At the line' : `${held} of 3 in`} />} title={title}
        text={unmet ? 'Each pleb takes their own back. Nothing was paid to you.'
          : sending ? 'All three signed and the batch is with the mint. Nothing is yours until the mint confirms.'
            : `${organizer} is organizing it. The payout will be locked to your key. Nothing to do yet.`} />
      <PayoutTrack title="Where the sats for you are" stop={unmet ? 'none' : sending ? 'to-you' : held ? 'at-mint' : 'none'}
        label={unmet ? 'none coming' : sending ? `${total} on the way to you` : held ? `${heldSat} of ${sats(targetSat)} at the mint` : 'nothing stacked yet'} />
    </>
  ), actions: <Offers items={['Share the stack']} /> } };
}
