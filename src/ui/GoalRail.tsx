import type { Rail } from './journey';

const steps = ['Join', 'Stack', 'Sign', 'Paid'];

// The goal line as a step bar: behind you solid, ahead dashed, lime only once paid.
export function GoalRail({ at, paid }: Rail) {
  return (
    <nav className="rail" aria-label="Steps" data-paid={paid || undefined}>
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
