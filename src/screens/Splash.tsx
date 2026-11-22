import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../routes';
import { homePath, storageWorks, useSession } from '../session';
import { Mark, Wordmark } from '../ui/Mark';
import { useTitle } from '../ui/Frame';

const HOLD_MS = 900;

export function Splash() {
  const { stackId, introSeen, viewer } = useSession();
  const navigate = useNavigate();
  const [canSave] = useState(storageWorks);
  useTitle('Stay humble, stack together');

  useEffect(() => {
    if (!canSave) return;
    const home = homePath(viewer.id, stackId);
    const next = !introSeen ? paths.intro(1) : home === paths.splash() ? paths.intro(3) : home;
    const timer = setTimeout(() => navigate(next, { replace: true }), HOLD_MS);
    return () => clearTimeout(timer);
  }, [canSave, stackId, introSeen, viewer.id, navigate]);

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
