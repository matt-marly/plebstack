import type { Rail } from './journey';

export const plebSteps = ['Join', 'Stack', 'Sign', 'Paid'] as const;
export const backSteps = ['Join', 'Stack', 'Sign', 'Back'] as const;
export const organizerSteps = ['Who', 'Key', 'Terms', 'Share'] as const;
export const maintainerSteps = ['Claim', 'Follow', 'Receive', 'Spend'] as const;

export type RailState = 'done' | 'now' | 'ahead';

export function railStates({ at, paid, done, pending }: Rail): RailState[] {
  return [0, 1, 2, 3].map(index => (paid || done || index < at ? 'done' : index === at && !pending ? 'now' : 'ahead'));
}

// Four segments: behind solid, now ringed, ahead faint. Lime only once paid.
// Slim, in a screen's step header: the names are for screen readers only, since the step's own name sits above.
export function GoalRail({ steps, branch, lighting, slim, ...rail }: Rail & { lighting?: boolean; slim?: boolean }) {
  const names = steps ?? (branch === 'back' ? backSteps : plebSteps);
  const states = railStates({ ...rail, branch });
  return (
    <div className="rail" data-paid={rail.paid || undefined} data-branch={branch} data-lighting={lighting || undefined}>
      <ol aria-label="Steps">
        {names.map((name, index) => {
          const state = states[index];
          return (
            <li key={name} data-state={state} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="rail-slab" aria-hidden="true" />
              <span className={slim ? 'rail-name visually-hidden' : 'rail-name'}>{name}</span>
              {state !== 'now' && <span className="visually-hidden">{state === 'done' ? ', done' : ', to come'}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
