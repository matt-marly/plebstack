import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { findCampaign, maintainerOf, people, sats, statusOf, fellShort, type CampaignRecord } from '../demo/world';
import { liveActions, type Wallet } from '../live/actions';
import type { BoardDraft } from '../live/board';
import { useSession } from '../session';
import { formatClock, shortKey } from '../ui/format';
import { TestMint, useTitle } from '../ui/Frame';
import { Icon } from '../ui/Icon';
import { closeLine, PLEBS, type Journey, type Stop } from '../ui/journey';
import { Mark, Wordmark } from '../ui/Mark';
import { MiniPhone, maintainerView, plebView } from '../ui/Mini';
import { Avatar } from '../ui/parts';
import { LoneSlab, Pile } from '../ui/Pile';
import { captionOf, lookOf, pocketLabel, snapOf, stageEvents, storyOf, type Caption, type StageSnap } from '../ui/story';
import { fixing } from '../ui/Who';

const WIDTH = 1920;
const HEIGHT = 1080;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Flight {
  id: number;
  from: Rect;
  to: Rect;
  lit: boolean;
  // A deposit landing drops onto its spot, overshoots a little and settles.
  drop: boolean;
  done: () => void;
}

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A phone, or any window taller than wide, gets the stage as one column that scrolls, at its own size.
const TALL = '(max-width: 699px), (max-aspect-ratio: 4/5)';

interface Fit {
  tall: boolean;
  scale: number;
}

function measure(): Fit {
  const tall = matchMedia(TALL).matches;
  return { tall, scale: tall ? 1 : Math.min(innerWidth / WIDTH, innerHeight / HEIGHT) };
}

function useFit(): Fit {
  const [fit, setFit] = useState(measure);
  useLayoutEffect(() => {
    const update = () => setFit(measure());
    const query = matchMedia(TALL);
    update();
    addEventListener('resize', update);
    query.addEventListener('change', update);
    return () => {
      removeEventListener('resize', update);
      query.removeEventListener('change', update);
    };
  }, []);
  return fit;
}

// One slab in flight between a phone and the stack, or from the stack to Ngozi.
function Ghost({ flight }: { flight: Flight }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const { from, to, drop } = flight;
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const scale = from.w / to.w;
    // The arc and the bounce follow the stack's size, so they read the same in either layout.
    const big = Math.max(from.h, to.h);
    const arc = Math.min(dy, 0) - big * 0.9;
    const lift = Math.round(big * 0.45);
    const animation = ref.current!.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transform: `translate(${dx / 2}px, ${dy / 2 + arc / 2}px) scale(${(scale + 1) / 2})`, offset: drop ? 0.42 : 0.5 },
      ...(drop ? [{ transform: `translate(0, -${lift}px)`, offset: 0.74 }, { transform: 'translate(0, 3px)', offset: 0.9 }] : []),
      { transform: 'none' },
    ], { duration: drop ? 1500 : 1000, easing: 'cubic-bezier(.45, 0, .2, 1)', fill: 'forwards' });
    animation.onfinish = flight.done;
    return () => animation.cancel();
  }, [flight]);
  const { to } = flight;
  return (
    <div ref={ref} className="ghost" style={{ left: to.x, top: to.y, width: to.w, height: to.h }}>
      <LoneSlab tone={flight.lit ? 'lit' : 'ink'} />
    </div>
  );
}

const inPocket: Stop[] = ['wallet', 'to-mint', 'back'];

function payoutLine(record: CampaignRecord | undefined, draft: BoardDraft | undefined, wallet: Wallet, arrived: boolean): string {
  const spend = wallet.spend;
  if (spend?.status === 'confirmed' && spend.receivedSat !== undefined) {
    return `${sats(spend.receivedSat)} received · ${sats(spend.grossSat - spend.receivedSat)} swap fee`;
  }
  if (record && statusOf(record) === 'paid' && arrived) {
    return `${sats(record.campaign.contributionSat * record.campaign.backerCount)} · locked to her key`;
  }
  const key = record?.campaign.beneficiaryPubkey ?? draft?.key?.pubkey;
  if (!key) return 'no payout key yet';
  const by = record?.keyBy ?? draft?.key?.by;
  return `${by === 'pasted' ? 'key pasted, not confirmed' : 'key confirmed'} · ${shortKey(key)}`;
}

function StageView({ id }: { id: string | undefined }) {
  const { world } = useSession();
  const { tall, scale } = useFit();
  const canvas = useRef<HTMLDivElement>(null);
  const draft = id ? liveActions.draft(id) : undefined;
  const record = findCampaign(world, id);
  // Ngozi's own phone screen is part of the stage, so the stage reads what her phone shows: amounts, never her key.
  const wallet = useMemo<Wallet>(() => (draft ? liveActions.wallet(draft.maintainerId, draft.id) : {}), [world, draft?.id]);
  const snap = useMemo(() => snapOf(draft, record, wallet), [draft, record, wallet]);

  const [captions, setCaptions] = useState<Caption[]>(() => storyOf(snap).map(event => captionOf(event, snap)).slice(-3));
  const [away, setAway] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [tick, setTick] = useState<string>();
  const [moment, setMoment] = useState(false);
  const [arrived, setArrived] = useState(true);
  const [paidTold, setPaidTold] = useState(() => snap.paidAt !== undefined);
  const [flights, setFlights] = useState<Flight[]>([]);
  const seen = useRef<StageSnap>(snap);
  const queue = useRef<Caption[]>([]);
  const playing = useRef(false);
  const alive = useRef(true);
  const fitted = useRef(scale);
  fitted.current = scale;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  function rectOf(selector: string): Rect | undefined {
    const frame = canvas.current;
    const found = frame?.querySelector(selector);
    if (!frame || !found) return undefined;
    const base = frame.getBoundingClientRect();
    const box = found.getBoundingClientRect();
    // A slab never flies in from somewhere scrolled out of sight; it appears in place instead.
    if (box.bottom < 0 || box.top > innerHeight) return undefined;
    const s = fitted.current;
    return { x: (box.left - base.left) / s, y: (box.top - base.top) / s, w: box.width / s, h: box.height / s };
  }

  function fly(from: string, to: string, lit: boolean, drop: boolean): Promise<void> {
    const start = rectOf(from);
    const end = rectOf(to);
    if (calm() || !start || !end) return Promise.resolve();
    return new Promise(resolve => {
      const flight: Flight = { id: Math.random(), from: start, to: end, lit, drop, done: () => {
        setFlights(list => list.filter(other => other !== flight));
        resolve();
      } };
      setFlights(list => [...list, flight]);
    });
  }

  const without = (who: string) => (set: ReadonlySet<string>) => new Set([...set].filter(other => other !== who));

  // Each real change plays in the order it happened; the caption leads, then the slabs move.
  async function play(caption: Caption) {
    const who = caption.who ?? '';
    const quiet = calm();
    switch (caption.kind) {
      case 'landed':
        await fly(`[data-pocket="${who}"] svg`, `[data-slab="${who}"]`, false, true);
        setAway(without(who));
        await wait(quiet ? 0 : 500);
        break;
      case 'back':
        await fly(`[data-slab="${who}"]`, `[data-pocket="${who}"] svg`, false, false);
        setGone(without(who));
        await wait(quiet ? 0 : 400);
        break;
      case 'signed':
        setTick(who);
        await wait(quiet ? 0 : 1200);
        setTick(undefined);
        break;
      case 'paid':
        setPaidTold(true);
        setMoment(true);
        await wait(quiet ? 0 : 1000);
        await fly('.pile-base [data-index="1"]', '[data-payout] svg', true, false);
        setArrived(true);
        await wait(quiet ? 0 : 500);
        break;
      default:
        await wait(quiet ? 0 : 700);
    }
  }

  async function pump() {
    if (playing.current) return;
    playing.current = true;
    while (queue.current.length && alive.current) {
      const next = queue.current.shift()!;
      setCaptions(list => [...list, next].slice(-3));
      await play(next);
    }
    playing.current = false;
  }

  // Before paint, so a slab that has to travel in is never seen in the stack first.
  useLayoutEffect(() => {
    const prev = seen.current;
    seen.current = snap;
    if (prev === snap) return;
    const events = stageEvents(prev, snap);
    if (!events.length) return;
    for (const event of events) {
      if (event.kind === 'landed') setAway(set => new Set(set).add(event.who!));
      if (event.kind === 'back') setGone(set => new Set(set).add(event.who!));
      if (event.kind === 'paid') {
        setPaidTold(false);
        setArrived(false);
      }
    }
    queue.current.push(...events.map(event => captionOf(event, snap)));
    void pump();
  }, [snap]);

  const maintainer = record ? maintainerOf(record)
    : draft ? maintainerOf({ maintainerId: draft.maintainerId, maintainerName: draft.maintainerName }) : people.ngozi;
  const organizer = people[record?.creatorId ?? draft?.organizerId ?? 'ada'];
  const each = record ? sats(record.campaign.contributionSat) : undefined;
  const current = captions.at(-1) ?? {
    text: 'No stack yet. Start one as Ada in another window.', term: `${location.host}/new`, at: '', kind: 'drafted' as const,
  };
  const look = lookOf(record, { travelling: away.size, paidTold });
  const her = maintainerView(draft, record, wallet, arrived);
  const close = record && closeLine(record);

  const pocket = (pleb: string, stop: Stop) => {
    const held = inPocket.includes(stop) && !gone.has(pleb);
    return (
      <p className="pocket" data-pocket={pleb}>
        <LoneSlab tone={held ? 'ink' : 'open'} className="pocket-slab" />
        <span className="mono" data-moving={stop === 'to-mint' || stop === 'to-you' || undefined}>
          {pocketLabel(stop, people[pleb].short, maintainer.short)}
        </span>
      </p>
    );
  };

  const plebColumn = (id: string) => {
    const { journey, view } = plebView(record, id, draft);
    return (
      <div key={id} className="stage-column">
        <h2 className="stage-who"><strong>{people[id].name}</strong><span className="mono">pleb{each ? ` · ${each}` : ''}</span></h2>
        <MiniPhone label={`${people[id].name}’s phone`} playing={people[id].short} rail={journey?.rail ?? { at: 0, paid: false }} view={view} tick={tick === id} />
        {pocket(id, journey?.stop ?? 'wallet')}
      </div>
    );
  };

  // In a tall window each pleb is a small tile: who, where they are, and where their sats are.
  const plebTile = (id: string) => {
    const { journey, view } = plebView(record, id, draft);
    return (
      <section key={id} className="tile" aria-label={`${people[id].name}’s phone: ${view.title}`}>
        <h2 className="tile-who"><Avatar name={people[id].short} size="small" />{people[id].short}</h2>
        <p className="tile-state">{stateWord(journey, record)}</p>
        {pocket(id, journey?.stop ?? 'wallet')}
        {tick === id && <span className="mini-tick" aria-hidden="true"><Icon name="nib" /></span>}
      </section>
    );
  };

  // Lime holds the payout from the mint's answer until she spends it; spent ecash is just hers.
  const paidHome = look.lit && arrived && wallet.spend?.status !== 'confirmed';
  const payout = (
    <p className="pocket" data-payout data-paid={paidHome || undefined}>
      <LoneSlab tone={paidHome ? 'lit' : wallet.spend?.status === 'confirmed' ? 'ink' : 'open'} className="pocket-slab" />
      <span className="mono">{payoutLine(record, draft, wallet, arrived)}</span>
    </p>
  );
  const herWho = (
    <h2 className="stage-who">
      <strong>for {maintainer.name}</strong>
      <span className="mono">{draft ? fixing(draft.title).toLowerCase() : 'the maintainer'}</span>
    </h2>
  );
  const centre = (
    <div className="stage-centre">
      <Pile record={record} look={look} away={away} moment={moment} />
      <p className="stage-organizer">
        <Avatar name={organizer.short} size="small" />
        <span>Organized by {organizer.short}</span>
        {close && <span className="mono">{tall ? close : `· ${close}`}</span>}
      </p>
    </div>
  );

  return (
    <div className="stage" data-tall={tall || undefined}>
      <div ref={canvas} className="stage-canvas" style={tall ? undefined : { '--fit': scale } as CSSProperties}>
        <h1 className="visually-hidden">Plebstack stage</h1>
        <header className="stage-top">
          <span className="stage-brand">
            <Mark size="large" className="stage-mark" />
            <Wordmark className="stage-word" />
          </span>
          <div className="stage-honest">
            <TestMint />
            <p>Live from every phone in the stack. Every number here comes from the mint.</p>
          </div>
        </header>

        {tall ? (
          <main className="stage-floor">
            {centre}
            <div className="tiles">{PLEBS.map(plebTile)}</div>
            <section className="tile tile-for" aria-label={`${maintainer.name}’s phone: ${her.view.title}`}>
              {herWho}
              <p className="tile-state">{her.view.title}</p>
              {payout}
            </section>
          </main>
        ) : (
          <main className="stage-floor">
            <div className="stage-plebs">{PLEBS.map(plebColumn)}</div>
            {centre}
            <div className="stage-column stage-for">
              {herWho}
              <MiniPhone label={`${maintainer.name}’s phone`} playing={maintainer.short} rail={her.rail} view={her.view} />
              {payout}
            </div>
          </main>
        )}

        <footer className="stage-captions">
          <div key={`${current.kind}/${current.at}/${current.who ?? ''}`} className="stage-now">
            <p className="stage-line">{current.text}</p>
            <p className="stage-term mono">{current.term}</p>
          </div>
          <ol className="stage-history" aria-label="Last three">
            {[...captions].reverse().map((caption, index) => (
              <li key={`${caption.kind}/${caption.at}/${caption.who ?? ''}`} data-now={index === 0 || undefined}>
                <span className="mono">{formatClock(caption.at)}</span>
                <span>{caption.text}</span>
              </li>
            ))}
          </ol>
        </footer>
        <div className="stage-ghosts" aria-hidden="true">
          {flights.map(flight => <Ghost key={flight.id} flight={flight} />)}
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">{current.text} {current.term}</p>
    </div>
  );
}

// One word for where a pleb is, as their own phone has it.
function stateWord(journey: Journey | undefined, record: CampaignRecord | undefined): string {
  switch (journey?.screen) {
    case undefined: return 'not open yet';
    case 'join': return journey.step.kind !== 'watch' ? 'not in yet' : record && fellShort(record) ? 'didn’t fill' : 'stack is full';
    case 'pay': return 'paying';
    case 'stacked': case 'waiting': return 'stacked';
    case 'sign': return journey.step.kind === 'stopped' ? 'stopped signing' : 'to sign';
    case 'signed': return 'signed';
    case 'sending': return 'sending';
    case 'paid': case 'race': return 'paid';
    case 'unmet': return 'no payout';
    case 'back': return journey.step.kind === 'reclaimed' ? 'back' : 'taking back';
  }
}

// The stage for a meetup screen or a demo video. It never needs a click: another window plays the people,
// and every change on the board arrives here through the storage event.
export function Stage() {
  const { campaignId } = useParams();
  const { stackId } = useSession();
  const id = campaignId ?? stackId;
  useTitle('Stage');
  return <StageView key={id ?? 'none'} id={id} />;
}
