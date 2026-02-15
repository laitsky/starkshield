import type { ProofStep } from '../hooks/useProofGeneration';

const STEPS: { key: ProofStep; label: string }[] = [
  { key: 'initializing', label: 'Initializing proof engine' },
  { key: 'generating', label: 'Generating ZK proof' },
  { key: 'calldata', label: 'Preparing transaction data' },
  { key: 'previewing', label: 'Previewing outputs' },
  { key: 'submitting', label: 'Submitting to Starknet' },
  { key: 'complete', label: 'Verification complete' },
];

interface ProofProgressProps {
  currentStep: ProofStep;
}

export default function ProofProgress({ currentStep }: ProofProgressProps) {
  if (currentStep === 'idle') return null;

  const isError = currentStep === 'error';
  const activeIndex = isError
    ? -1
    : STEPS.findIndex((s) => s.key === currentStep);

  // For error state, find the last step that was completed
  // (we show all steps as gray except noting the error happened)
  const errorIndex = isError ? STEPS.length : -1;

  return (
    <div className="space-y-3">
      {STEPS.map((step, i) => {
        const isCompleted = !isError && i < activeIndex;
        const isCurrent = !isError && i === activeIndex;
        const isFuture = !isError && i > activeIndex;
        const showError = isError && i === errorIndex;

        let dotClass: string;
        let textClass: string;
        let dot: string;

        if (isCompleted) {
          dotClass = 'text-green-400';
          textClass = 'text-green-400';
          dot = '\u2713'; // checkmark
        } else if (isCurrent) {
          dotClass = 'text-blue-400 animate-pulse';
          textClass = 'text-blue-400 font-medium';
          dot = '\u25CF'; // filled circle
        } else if (showError) {
          dotClass = 'text-red-400';
          textClass = 'text-red-400 font-medium';
          dot = '\u2717'; // X mark
        } else if (isFuture || isError) {
          dotClass = 'text-gray-600';
          textClass = 'text-gray-600';
          dot = '\u25CB'; // empty circle
        } else {
          dotClass = 'text-gray-600';
          textClass = 'text-gray-600';
          dot = '\u25CB';
        }

        return (
          <div
            key={step.key}
            className={`flex items-center gap-3 text-sm`}
          >
            <span className={`w-4 text-center ${dotClass}`}>{dot}</span>
            <span className={textClass}>{step.label}</span>
          </div>
        );
      })}

      {isError && (
        <div className="flex items-center gap-3 text-sm">
          <span className="w-4 text-center text-red-400">{'\u2717'}</span>
          <span className="text-red-400 font-medium">Error occurred</span>
        </div>
      )}
    </div>
  );
}
