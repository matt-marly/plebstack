import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { failureCopy, liveActions } from '../live/actions';
import { paths } from '../routes';
import { ORGANIZER, useSession } from '../session';
import { isHttpUrl } from '../ui/format';
import { reallyContext } from '../ui/explain';
import { Frame } from '../ui/Frame';
import { organizerJourney } from '../ui/journey';
import { Note } from '../ui/parts';

export function Field({ label, value, onChange, hint, error, type = 'text', placeholder }: {
  label: string; value: string; onChange: (value: string) => void; hint?: string; error?: string; type?: string; placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} autoComplete="off" spellCheck={type !== 'url'}
        aria-invalid={error ? true : undefined} aria-describedby={[error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined}
        onChange={event => onChange(event.target.value)} />
      {error && <p id={`${id}-error`} className="field-note" data-error>{error}</p>}
      {hint && <p id={`${id}-hint`} className="field-note">{hint}</p>}
    </div>
  );
}

// O1: who the stack backs and what for. Plebs see this first.
export function Backing() {
  const { viewer, viewAs, refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('Ngozi Eze');
  const [title, setTitle] = useState('Daylight-saving drift');
  const [link, setLink] = useState('https://codeberg.org/ngozi/pocket-ical/pulls/412');
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState<string>();
  const first = name.trim().split(/\s+/)[0] || 'the maintainer';
  const errors = {
    name: name.trim() ? undefined : 'Add their name.',
    title: title.trim() ? undefined : 'Say what they’re fixing.',
    link: isHttpUrl(link) ? undefined : 'Add a public link to the work, starting with https://.',
  };
  const organizer = viewer.id === ORGANIZER;
  const { rail, here } = organizerJourney('who', first);

  function next() {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    try {
      const id = liveActions.startStack(viewer.id, { maintainerName: name, title, publicWorkUrl: link });
      refresh(`Stack started for ${first}. Next, ${first} confirms her key.`);
      navigate(paths.organize(id, 'key'));
    } catch (error) {
      setFailure(failureCopy(error));
    }
  }

  return (
    <Frame rail={rail} here={organizer ? here : { ...here, next: 'play as Ada to start a stack.' }} title="Who are you backing?"
      really={reallyContext({ role: 'organizer', at: 'who', maintainer: first })}
      actions={organizer
        ? <button type="button" className="button" data-variant="primary" onClick={next}>Next</button>
        : <button type="button" className="button" data-variant="primary" onClick={() => viewAs(ORGANIZER)}>Play as Ada</button>}>
      <div className="lead rise">
        <h1>Who are you backing?</h1>
        <p>{organizer ? 'Name the person and the work. Plebs see this first.' : 'Ada starts the stacks in this demo. Switch to her to start one.'}</p>
      </div>
      {organizer && (
        <form className="form" onSubmit={event => { event.preventDefault(); next(); }} noValidate>
          <Field label="Their name" value={name} onChange={setName} error={tried ? errors.name : undefined} />
          <Field label="What they’re fixing" value={title} onChange={setTitle} error={tried ? errors.title : undefined} />
          <Field label="Public link to the work" type="url" value={link} onChange={setLink} error={tried ? errors.link : undefined}
            hint={`Paid means ${first} received ecash, not that the work was done. The link is all a stack claims.`} />
          <button type="submit" hidden />
        </form>
      )}
      {failure && <Note><p>{failure}</p></Note>}
    </Frame>
  );
}
