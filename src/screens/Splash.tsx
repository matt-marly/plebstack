import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../routes';
import { storageWorks, useSession } from '../session';
import { Mark, Wordmark } from '../ui/Mark';
import { useTitle } from '../ui/Frame';

const HOLD_MS = 900;

export function Splash() {
  const { introSeen } = useSession();
  const navigate = useNavigate();
  const [canSave] = useState(storageWorks);
  useTitle('Back a builder, together');

  useEffect(() => {
    if (!canSave) return;
    // First visit: the intro. After that: home, where your stack is one tap away.
    const next = !introSeen ? paths.intro(1) : paths.home();
    const timer = setTimeout(() => navigate(next, { replace: true }), HOLD_MS);
    return () => clearTimeout(timer);
  }, [canSave, introSeen, navigate]);

  return (
    <main className="splash">
      <Mark size="large" className="splash-mark" />
      <h1 className="splash-word"><Wordmark /></h1>
      {!canSave && (
        <p className="splash-note">This browser can’t save anything, so it can’t keep a key. Allow site storage and reload.</p>
      )}
    </main>
  );
}
