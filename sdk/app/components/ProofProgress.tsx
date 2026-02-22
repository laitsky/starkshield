import type { ProofStep } from '../hooks/useProofGeneration';

const STEPS: { key: ProofStep; label: string; description: string }[] = [
  { key: 'initializing', label: 'Setting Up', description: 'Loading the proof engine in your browser' },
  { key: 'generating', label: 'Generating Proof', description: 'Computing your zero-knowledge proof locally' },
  { key: 'calldata', label: 'Preparing Transaction', description: 'Packaging proof data for Starknet' },
  { key: 'previewing', label: 'Review & Confirm', description: 'Check what will be sent on-chain before submitting' },
  { key: 'submitting', label: 'Submitting', description: 'Sending your proof to Starknet Sepolia' },
  { key: 'complete', label: 'Complete', description: 'Your proof has been recorded on-chain' },
];

interface ProofProgressProps {
  currentStep: ProofStep;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function ErrorXIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function ProofProgress({ currentStep }: ProofProgressProps) {
  if (currentStep === 'idle') return null;

  const isError = currentStep === 'error';
  const activeIndex = isError
    ? -1
    : STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="relative space-y-0">
      {/* Vertical connecting line */}
      <div
        className="absolute w-[3px]"
        style={{
          left: '13px',
          top: '14px',
          height: `calc(100% - 28px)`,
          background: `linear-gradient(to bottom, var(--color-green) ${
            activeIndex >= 0 ? (activeIndex / STEPS.length) * 100 : 0
          }%, var(--color-border) ${
            activeIndex >= 0 ? (activeIndex / STEPS.length) * 100 : 0
          }%)`,
        }}
      />

      {STEPS.map((step, i) => {
        const isCompleted = !isError && i < activeIndex;
        const isCurrent = !isError && i === activeIndex;
        const isFuture = !isError && i > activeIndex;

        let dotClass: string;

        if (isCompleted) {
          dotClass = 'timeline-dot-completed';
        } else if (isCurrent) {
          dotClass = 'timeline-dot-active';
        } else if (isError) {
          dotClass = 'timeline-dot-future';
        } else if (isFuture) {
          dotClass = 'timeline-dot-future';
        } else {
          dotClass = 'timeline-dot-future';
        }

        return (
          <div
            key={step.key}
            className={`flex items-center gap-4 py-2.5 animate-fade-in stagger-${i + 1}`}
          >
            <div className={`timeline-dot ${dotClass}`}>
              {isCompleted ? (
                <CheckIcon />
              ) : isCurrent ? (
                <SpinnerIcon />
              ) : (
                <span className="h-1.5 w-1.5 bg-current" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-bold uppercase tracking-wide ${
                  isCompleted
                    ? 'text-[var(--color-green)]'
                    : isCurrent
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-3)]'
                }`}
              >
                {step.label}
              </p>
              {(isCurrent || isCompleted) && (
                <p className="text-xs text-[var(--color-text-3)] mt-0.5 font-mono">{step.description}</p>
              )}
            </div>

            {isCompleted && (
              <span className="text-[10px] font-bold text-[var(--color-green)] uppercase tracking-wider">
                Done
              </span>
            )}
          </div>
        );
      })}

      {isError && (
        <div className="flex items-center gap-4 py-2.5 animate-fade-in">
          <div className="timeline-dot timeline-dot-error">
            <ErrorXIcon />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-red)]">Error occurred</p>
            <p className="text-xs text-[var(--color-text-3)] mt-0.5 font-mono">Check the error details below</p>
          </div>
        </div>
      )}
    </div>
  );
}
