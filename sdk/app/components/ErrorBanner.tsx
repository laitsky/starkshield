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
      className="relative rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-3 text-red-300"
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 text-red-400 transition hover:text-red-200"
          aria-label="Dismiss error"
        >
          &times;
        </button>
      )}
      <div className="pr-6 space-y-1">
        <p className="text-sm font-semibold">{classified.title}</p>
        <p className="text-sm">{classified.message}</p>
        <p className="text-sm text-red-200">{classified.action}</p>
      </div>
    </div>
  );
}
