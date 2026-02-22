/**
 * ErrorBanner -- WEB-06 Error Classification and Display Component
 *
 * Classifies error messages into user-actionable categories with
 * specific guidance for each error type.
 */

interface ClassifiedError {
  title: string;
  message: string;
  action: string;
}

/**
 * Classify an error string into a user-friendly title, message, and action.
 */
export function classifyError(error: string): ClassifiedError {
  const lower = error.toLowerCase();

  if (lower.includes('expired') || lower.includes('expir')) {
    return {
      title: 'Credential Expired',
      message: error,
      action: 'Request a new credential from the issuer.',
    };
  }

  if (
    lower.includes('network') ||
    lower.includes('chain') ||
    error.includes('SN_SEPOLIA')
  ) {
    return {
      title: 'Wrong Network',
      message: error,
      action: 'Switch your wallet to Starknet Sepolia in your wallet settings.',
    };
  }

  if (
    lower.includes('gas') ||
    lower.includes('fee') ||
    lower.includes('insufficient')
  ) {
    return {
      title: 'Insufficient Gas',
      message: error,
      action: 'Add funds to your Sepolia wallet via a faucet.',
    };
  }

  if (
    lower.includes('rejected') ||
    error.includes('User abort') ||
    lower.includes('cancel')
  ) {
    return {
      title: 'Transaction Rejected',
      message: error,
      action: 'Try again and approve the transaction when prompted.',
    };
  }

  if (
    lower.includes('wasm') ||
    error.includes('WASM') ||
    lower.includes('webassembly')
  ) {
    return {
      title: 'WASM Load Failure',
      message: error,
      action:
        'Try refreshing the page. Ensure you are using a modern browser (Chrome, Firefox, Safari).',
    };
  }

  if (
    lower.includes('wallet') ||
    lower.includes('no wallet') ||
    lower.includes('not installed')
  ) {
    return {
      title: 'Wallet Not Found',
      message: error,
      action:
        'Install ArgentX or Braavos wallet extension and refresh the page.',
    };
  }

  return {
    title: 'Error',
    message: error,
    action: 'Try again. If the problem persists, refresh the page.',
  };
}

interface ErrorBannerProps {
  error: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  const classified = classifyError(error);

  return (
    <div
      role="alert"
      className="brutal-card-static animate-fade-in overflow-hidden"
      style={{ borderLeftWidth: '4px', borderLeftColor: 'var(--color-red)' }}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-red)]">
            {classified.title}
          </p>
          <p className="text-xs text-[var(--color-text-2)] leading-relaxed font-mono">
            {classified.message}
          </p>
          <p className="text-xs text-[var(--color-red)] flex items-center gap-1.5 font-medium">
            &rarr; {classified.action}
          </p>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-1.5 text-[var(--color-text-3)] transition-colors duration-150 hover:text-[var(--color-red)]"
            aria-label="Dismiss error"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
