import type { Rail } from './journey';

export const plebSteps = ['Join', 'Stack', 'Sign', 'Paid'] as const;
export const organizerSteps = ['Who', 'Key', 'Terms', 'Share'] as const;
export const maintainerSteps = ['Claim', 'Follow', 'Receive', 'Spend'] as const;

// The goal line as a step bar: behind you solid, ahead dashed, lime only once paid.
export function GoalRail({ at, paid, steps = plebSteps, lighting }: Rail & { lighting?: boolean }) {
  return (
    <nav className="rail" aria-label="Steps" data-paid={paid || undefined} data-lighting={lighting || undefined}>
      <div className="rail-line" aria-hidden="true">
        <div className="rail-done" style={{ width: `${paid ? 100 : (at / 3) * 100}%` }} />
      </div>
      <ol>
        {steps.map((name, index) => {
          const state = paid || index < at ? 'done' : index === at ? 'now' : 'ahead';
          return (
            <li key={name} data-state={state} aria-current={state === 'now' ? 'step' : undefined}
              style={{ left: `${(index / 3) * 100}%` }}>
              <span className="rail-slab" aria-hidden="true" />
              <span className="rail-name">{name}</span>
              {state !== 'now' && <span className="visually-hidden">{state === 'done' ? ', done' : ', to come'}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
