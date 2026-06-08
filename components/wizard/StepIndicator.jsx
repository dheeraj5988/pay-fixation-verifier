'use client';

const STEPS = [
  { id: 1, label: 'Employee Details' },
  { id: 2, label: 'Pay Anchor' },
  { id: 3, label: 'Chain History' },
  { id: 4, label: 'Review' },
];

export default function StepIndicator({ current, onStepClick, maxReached }) {
  return (
    <nav aria-label="Wizard progress" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
        {STEPS.map((s, idx) => {
          const isActive = s.id === current;
          const isReachable = s.id <= maxReached;
          const isComplete = s.id < current;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => isReachable && onStepClick(s.id)}
                className={[
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isComplete
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    : isReachable
                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isActive
                      ? 'bg-white text-indigo-600'
                      : isComplete
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600',
                  ].join(' ')}
                >
                  {isComplete ? '✓' : s.id}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <span className="hidden h-px w-6 bg-slate-300 sm:block" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}