import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../demo/store';
import { createCampaign, sats } from '../demo/world';
import { TEST_MINT } from '../domain/models';
import { paths } from '../routes';
import { isCompressedPubkey, isHttpUrl } from '../ui/format';
import { PageHead, Section, useTitle } from '../ui/parts';

type FieldName = 'title' | 'work' | 'amount' | 'pubkey' | 'confirmed';
type Errors = Partial<Record<FieldName, string>>;

const order: FieldName[] = ['title', 'work', 'amount', 'pubkey', 'confirmed'];
const MAX_DEPOSIT_SAT = 10_000;

function parseAmount(text: string): number | undefined {
  if (!/^\d+$/.test(text.trim())) return undefined;
  const amount = Number(text);
  return amount >= 1 && amount <= MAX_DEPOSIT_SAT ? amount : undefined;
}

export function CreateCampaign() {
  useTitle('Start a campaign');
  const { viewer, apply } = useStore();
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState('');
  const [work, setWork] = useState('');
  const [amount, setAmount] = useState('21');
  // The key follows whoever is viewing until someone types their own.
  const [typedKey, setTypedKey] = useState<string>();
  const pubkey = typedKey ?? viewer.pubkey;
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const each = parseAmount(amount);

  function validate(): Errors {
    const found: Errors = {};
    if (!title.trim()) found.title = 'Enter a title for the work, such as the name of the issue.';
    if (!isHttpUrl(work)) found.work = 'Enter a public link to the work, starting with https://.';
    if (each === undefined) found.amount = `Enter a whole number of sats from 1 to ${MAX_DEPOSIT_SAT.toLocaleString('en')}.`;
    if (!isCompressedPubkey(pubkey)) found.pubkey = 'Enter the creator’s public key: 66 characters, starting with 02 or 03.';
    if (!confirmed) found.confirmed = 'Tick the box once you’ve checked this key against the receiving wallet.';
    return found;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    const firstInvalid = order.find(name => found[name]);
    if (firstInvalid) {
      form.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    const next = apply((world, at) => createCampaign(world, {
      title, publicWorkUrl: work, contributionSat: each!, beneficiaryPubkey: pubkey,
    }, at));
    navigate(paths.campaign(next.campaigns[next.campaigns.length - 1].campaign.id));
  }

  const describe = (name: FieldName, hint?: boolean) =>
    [hint && `${name}-hint`, errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined;
  const fieldError = (name: FieldName) =>
    errors[name] && <p className="field-error" id={`${name}-error`}>{errors[name]}</p>;

  return (
    <>
      <PageHead back={{ to: paths.home(), label: 'Campaigns' }} title="Start a campaign">
        <p>
          Set this up as the person who’ll be paid. Backers see everything on this page, and none of it can change
          once the first deposit arrives.
        </p>
      </PageHead>

      <form ref={form} onSubmit={submit} noValidate>
        <Section label="The work">
          <div className="field">
            <label htmlFor="title">Title</label>
            <p className="field-hint" id="title-hint">What the backers are paying for, in a few words.</p>
            <input id="title" name="title" type="text" autoComplete="off" value={title} onChange={event => setTitle(event.target.value)}
              aria-invalid={errors.title ? true : undefined} aria-describedby={describe('title', true)} />
            {fieldError('title')}
          </div>
          <div className="field">
            <label htmlFor="work">Public link</label>
            <p className="field-hint" id="work-hint">An issue, a pull request, an episode. Anyone should be able to open it.</p>
            <input id="work" name="work" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://"
              value={work} onChange={event => setWork(event.target.value)}
              aria-invalid={errors.work ? true : undefined} aria-describedby={describe('work', true)} />
            {fieldError('work')}
          </div>
        </Section>

        <Section label="The money">
          <div className="field">
            <label htmlFor="amount">Each backer deposits</label>
            <p className="field-hint" id="amount-hint">
              {each !== undefined
                ? `Three deposits of ${sats(each)} make one payment of ${sats(each * 3)}.`
                : 'Three equal deposits make one payment.'}
            </p>
            <div className="field-suffix">
              <input id="amount" name="amount" type="text" inputMode="numeric" autoComplete="off" value={amount}
                onChange={event => setAmount(event.target.value)}
                aria-invalid={errors.amount ? true : undefined} aria-describedby={describe('amount', true)} />
              <span aria-hidden="true">sats</span>
            </div>
            {fieldError('amount')}
          </div>
          <div className="field">
            <p className="field-label">Backers</p>
            <p className="field-fixed">Three. Fixed in this version.</p>
          </div>
          <div className="field">
            <p className="field-label">Mint</p>
            <p className="field-fixed"><span className="mono">{TEST_MINT}</span></p>
            <p className="field-hint">A test mint with fake sats. Fixed in this version.</p>
          </div>
        </Section>

        <Section label="Who is paid">
          <div className="field">
            <label htmlFor="pubkey">Creator’s public key</label>
            <p className="field-hint" id="pubkey-hint">
              Filled in from this browser’s wallet. The payout is locked to this key, and a payout locked to the
              wrong key can’t be recovered.
            </p>
            <textarea id="pubkey" name="pubkey" rows={3} autoComplete="off" autoCapitalize="off" spellCheck={false}
              value={pubkey} onChange={event => setTypedKey(event.target.value)}
              aria-invalid={errors.pubkey ? true : undefined} aria-describedby={describe('pubkey', true)} />
            {fieldError('pubkey')}
          </div>
          <div className="check">
            <input id="confirmed" name="confirmed" type="checkbox" checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)}
              aria-invalid={errors.confirmed ? true : undefined} aria-describedby={describe('confirmed')} />
            <label htmlFor="confirmed">I’ve checked this key against the wallet that will receive the payout.</label>
            {fieldError('confirmed')}
          </div>
          <div className="actions form-actions">
            <button type="submit" className="button" data-variant="primary">Create campaign</button>
          </div>
        </Section>
      </form>
    </>
  );
}
