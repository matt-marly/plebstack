import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../demo/store';
import { DEPOSIT_SAT, createCampaign, sats } from '../demo/world';
import { TEST_MINT } from '../domain/models';
import { paths } from '../routes';
import { isCompressedPubkey, isHttpUrl } from '../ui/format';
import { PageHead, Section, useTitle } from '../ui/parts';

type FieldName = 'title' | 'work' | 'pubkey' | 'confirmed';
type Errors = Partial<Record<FieldName, string>>;

const order: FieldName[] = ['title', 'work', 'pubkey', 'confirmed'];

export function CreateCampaign() {
  useTitle('Start a campaign');
  const { viewer, apply } = useStore();
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState('');
  const [work, setWork] = useState('');
  // The key follows whoever is viewing until someone types their own.
  const [typedKey, setTypedKey] = useState<string>();
  const pubkey = typedKey ?? viewer.pubkey;
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function validate(): Errors {
    const found: Errors = {};
    if (!title.trim()) found.title = 'Enter a title for the work, such as the name of the issue.';
    if (!isHttpUrl(work)) found.work = 'Enter a public link to the work, starting with https://.';
    if (!isCompressedPubkey(pubkey)) found.pubkey = 'Enter the maintainer’s public key: 66 characters, starting with 02 or 03.';
    if (!confirmed) found.confirmed = 'Tick the box once you’ve checked this key on your own device.';
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
      title, publicWorkUrl: work, contributionSat: DEPOSIT_SAT, beneficiaryPubkey: pubkey,
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
          Set this up as the maintainer who’ll be paid. Plebs see everything on this page, and none of it can change
          once the first deposit arrives.
        </p>
      </PageHead>

      <form ref={form} onSubmit={submit} noValidate>
        <Section label="The work">
          <div className="field">
            <label htmlFor="title">Title</label>
            <p className="field-hint" id="title-hint">What the plebs are paying for, in a few words.</p>
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

        <Section label="The terms">
          <p>Three plebs. {sats(DEPOSIT_SAT)} each. One mint. One maintainer key.</p>
          <div className="field">
            <p className="field-label">Each pleb stacks</p>
            <p className="field-fixed">{sats(DEPOSIT_SAT)}</p>
            <p className="field-hint">Three deposits of {sats(DEPOSIT_SAT)} make one {sats(DEPOSIT_SAT * 3)} payout. Fixed in this version.</p>
          </div>
          <div className="field">
            <p className="field-label">Plebs</p>
            <p className="field-fixed">Three. Fixed in this version.</p>
          </div>
          <div className="field">
            <p className="field-label">Mint</p>
            <p className="field-fixed"><span className="mono">{TEST_MINT}</span></p>
            <p className="field-hint">Test mint, fake sats. Fixed in this version.</p>
          </div>
        </Section>

        <Section label="Who is paid">
          <div className="field">
            <label htmlFor="pubkey">Maintainer’s public key</label>
            <p className="field-hint" id="pubkey-hint">
              Filled in from this browser. The payout is locked to this key, and a payout locked to the wrong key
              can’t be recovered. Confirm it on your own device before anyone deposits.
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
            <label htmlFor="confirmed">I’ve checked this key on my own device.</label>
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
