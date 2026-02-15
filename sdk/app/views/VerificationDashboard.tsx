/**
 * VerificationDashboard -- WEB-03 Past Verifications View
 *
 * Displays verification history loaded from localStorage, enriched with
 * on-chain confirmation status via getVerificationRecord.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVerifications } from '../hooks/useVerifications';
import type { StoredVerification } from '../hooks/useVerifications';

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}...${hex.slice(-end)}`;
}

function CircuitBadge({ circuitType }: { circuitType: StoredVerification['circuitType'] }) {
  const isAge = circuitType === 'age_verify';
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isAge
          ? 'bg-violet-900/50 text-violet-300'
          : 'bg-blue-900/50 text-blue-300'
      }`}
    >
      {isAge ? 'Age Verification' : 'Membership Verification'}
    </span>
  );
}

function OnChainStatus({ confirmed }: { confirmed?: boolean }) {
  if (confirmed === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-900/50 px-2.5 py-0.5 text-xs font-medium text-green-300">
        <span aria-hidden="true">{'\u2713'}</span>
        Confirmed on-chain
      </span>
    );
  }
  if (confirmed === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/50 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
        Pending
      </span>
    );
  }
  // confirmed === undefined -- not yet enriched
  return (
    <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-400">
      Checking...
    </span>
  );
}

function VerificationCard({ verification }: { verification: StoredVerification }) {
  const starkscanUrl = `https://sepolia.starkscan.co/tx/${verification.txHash}`;
  const timestamp = new Date(verification.timestamp).toLocaleString();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <CircuitBadge circuitType={verification.circuitType} />
        <OnChainStatus confirmed={verification.confirmed} />
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Nullifier</span>
          <span className="font-mono text-gray-300">
            {truncateHex(verification.nullifier)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Attribute Key</span>
          <span className="font-mono text-gray-300">
            {truncateHex(verification.attributeKey)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">
            {verification.circuitType === 'age_verify' ? 'Threshold' : 'Set Hash'}
          </span>
          <span className="font-mono text-gray-300">
            {truncateHex(verification.threshold)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Timestamp</span>
          <span className="text-gray-300">{timestamp}</span>
        </div>
      </div>

      {/* Starkscan link */}
      <a
        href={starkscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-violet-400 transition hover:text-violet-300"
      >
        View on Starkscan
        <span aria-hidden="true">{'\u2197'}</span>
      </a>
    </div>
  );
}

export default function VerificationDashboard() {
  const { verifications, loading, clearHistory } = useVerifications();
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  function handleClearHistory() {
    clearHistory();
    setShowConfirm(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading verifications...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-100">
          Verification Dashboard
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Your past proof verifications
        </p>
      </div>

      {/* Empty state */}
      {verifications.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            No verifications yet. Generate and submit a proof to see it here.
          </p>
          <button
            onClick={() => navigate('/prove')}
            className="mt-4 rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Generate a Proof
          </button>
        </div>
      )}

      {/* Verification cards */}
      {verifications.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {verifications.map((v, idx) => (
              <VerificationCard key={`${v.txHash}-${idx}`} verification={v} />
            ))}
          </div>

          {/* Clear history */}
          <div className="border-t border-gray-800 pt-4">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-400 transition hover:border-red-700/40 hover:text-red-300"
              >
                Clear History
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  Are you sure? This cannot be undone.
                </span>
                <button
                  onClick={handleClearHistory}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
                >
                  Yes, Clear All
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-400 transition hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
