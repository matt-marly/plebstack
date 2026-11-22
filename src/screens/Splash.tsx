import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../routes';
import { useSession } from '../session';
import { Mark, Wordmark } from '../ui/Mark';
import { useTitle } from '../ui/Frame';

const HOLD_MS = 900;

export function Splash() {
  const { stackId, introSeen } = useSession();
  const navigate = useNavigate();
  useTitle('Stay humble, stack together');

  useEffect(() => {
    if (!stackId) return;
    const timer = setTimeout(() => navigate(introSeen ? paths.stack(stackId) : paths.intro(1), { replace: true }), HOLD_MS);
    return () => clearTimeout(timer);
  }, [stackId, introSeen, navigate]);

  return (
    <main className="splash">
      <Mark size="large" className="splash-mark" />
      <h1 className="splash-word"><Wordmark /></h1>
      {!stackId && (
        <p className="splash-note">This browser can’t save anything, so it can’t keep a key. Allow site storage and reload.</p>
      )}
    </main>
  );
}
