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
import { buildVoyagerTxUrl } from '../explorer';

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}\u2026${hex.slice(-end)}`;
}

function formatAttributeKey(attributeKey: string): string {
  const normalized = attributeKey.toLowerCase();
  if (normalized === '0x1') return 'age (0x1)';
  if (normalized === '0x2') return 'membership_group (0x2)';
  return truncateHex(attributeKey);
}

function formatThresholdOrSetHash(
  circuitType: StoredVerification['circuitType'],
  value: string,
): string {
  if (circuitType === 'age_verify') {
    try {
      const threshold = Number(BigInt(value));
      return `${threshold} (${truncateHex(value)})`;
    } catch {
      return truncateHex(value);
    }
  }
  return truncateHex(value);
}

function CircuitBadge({ circuitType }: { circuitType: StoredVerification['circuitType'] }) {
  const isAge = circuitType === 'age_verify';
  return (
    <span className={`badge ${isAge ? 'badge-age' : 'badge-membership'}`}>
      {isAge ? 'Age' : 'Membership'}
    </span>
  );
}

function OnChainStatus({ confirmed }: { confirmed?: boolean }) {
  if (confirmed === true) {
    return (
      <span className="badge badge-confirmed flex items-center gap-1">
        Confirmed
      </span>
    );
  }
  if (confirmed === false) {
    return (
      <span className="badge badge-pending">
        Pending
      </span>
    );
  }
  return (
    <span className="badge badge-checking">
      Checking...
    </span>
  );
}

function VerificationCard({ verification, index }: { verification: StoredVerification; index: number }) {
  const voyagerUrl = buildVoyagerTxUrl(verification.txHash);
  const timestamp = new Date(verification.timestamp).toLocaleString();
  const isAge = verification.circuitType === 'age_verify';

  return (
    <div
      className="brutal-card p-5 space-y-4 animate-fade-in-up"
      style={{
        animationDelay: `${index * 0.04}s`,
        borderLeftWidth: '4px',
        borderLeftColor: isAge ? 'var(--color-cyan)' : 'var(--color-accent-2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <CircuitBadge circuitType={verification.circuitType} />
        <OnChainStatus confirmed={verification.confirmed} />
      </div>

      {/* Details */}
      <div className="space-y-0">
        <div className="data-row">
          <div className="space-y-0.5">
            <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Nullifier</span>
            <p className="text-[10px] text-[var(--color-text-3)]">Unique proof identifier</p>
          </div>
          <span className="font-mono text-xs text-[var(--color-text-2)]">
            {truncateHex(verification.nullifier)}
          </span>
        </div>
        <div className="data-row">
          <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Attribute Key</span>
          <span className="font-mono text-xs text-[var(--color-text-2)]">
            {formatAttributeKey(verification.attributeKey)}
          </span>
        </div>
        <div className="data-row">
          <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">
            {verification.circuitType === 'age_verify' ? 'Threshold' : 'Set Hash'}
          </span>
          <span className="font-mono text-xs text-[var(--color-text-2)]">
            {formatThresholdOrSetHash(verification.circuitType, verification.threshold)}
          </span>
        </div>
        <div className="data-row">
          <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Submitted</span>
          <span className="text-xs text-[var(--color-text-2)] font-mono">{timestamp}</span>
        </div>
      </div>

      {/* Voyager link */}
      <a
        href={voyagerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-cyan)] transition-colors duration-150 hover:text-[var(--color-accent)]"
      >
        View on Voyager
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats row
// ---------------------------------------------------------------------------

function StatsRow({ verifications }: { verifications: StoredVerification[] }) {
  const total = verifications.length;
  const confirmed = verifications.filter((v) => v.confirmed === true).length;
  const ageCount = verifications.filter((v) => v.circuitType === 'age_verify').length;
  const membershipCount = verifications.filter((v) => v.circuitType === 'membership_proof').length;

  const stats = [
    { label: 'Total Proofs', value: total, color: 'var(--color-accent)' },
    { label: 'Confirmed', value: confirmed, color: 'var(--color-green)' },
    { label: 'Age Proofs', value: ageCount, color: 'var(--color-cyan)' },
    { label: 'Membership', value: membershipCount, color: 'var(--color-accent-2)' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="brutal-card-static p-4 space-y-2 animate-fade-in"
          style={{ animationDelay: `${i * 0.03}s`, borderTopWidth: '3px', borderTopColor: stat.color }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-3)]">{stat.label}</span>
          <p className="text-3xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-8 w-8 border-3 border-[var(--color-border-hard)] border-t-[var(--color-accent)] animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-3)]">Loading verifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-3">
        <span className="section-label">// Dashboard</span>
        <h2 className="text-3xl font-extrabold uppercase text-[var(--color-text)]">
          Verification Dashboard
        </h2>
        <p className="text-sm text-[var(--color-text-2)]">
          Track your proof submissions and their on-chain confirmation status.
          Confirmed proofs are permanently recorded on Starknet Sepolia.
        </p>
        <p className="text-xs text-[var(--color-text-3)] font-mono leading-relaxed">
          Integration note: downstream dApps should validate the stored threshold (age) or set-hash (membership) as part of their access policy.
        </p>
      </div>

      {/* Stats */}
      {verifications.length > 0 && (
        <StatsRow verifications={verifications} />
      )}

      {/* Empty state */}
      {verifications.length === 0 && (
        <div className="brutal-card-static p-12 text-center space-y-5 animate-fade-in">
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase text-[var(--color-text-2)]">No verifications yet</p>
            <p className="text-xs text-[var(--color-text-3)] font-mono leading-relaxed max-w-md mx-auto">
              Once you generate a proof and submit it on-chain, your verification history will appear here
              with real-time on-chain confirmation status.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/prove')}
              className="btn-primary flex items-center gap-2"
            >
              Generate a Proof
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-secondary flex items-center gap-2 !text-xs"
            >
              View Credentials
            </button>
          </div>
        </div>
      )}

      {/* Verification cards */}
      {verifications.length > 0 && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {verifications.map((v, idx) => (
              <VerificationCard key={`${v.txHash}-${idx}`} verification={v} index={idx} />
            ))}
          </div>

          {/* Actions */}
          <div className="separator" />
          <div className="pt-2 flex items-center justify-between">
            <div>
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="btn-secondary flex items-center gap-2 !text-xs"
                >
                  Clear History
                </button>
              ) : (
                <div className="flex items-center gap-3 animate-fade-in">
                  <span className="text-xs text-[var(--color-text-2)] font-mono">
                    Are you sure? This cannot be undone.
                  </span>
                  <button
                    onClick={handleClearHistory}
                    className="btn-danger !py-2 !px-4 !text-xs"
                  >
                    Yes, Clear All
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="btn-secondary !py-2 !px-4 !text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-3)] hover:text-[var(--color-accent)] transition-colors"
            >
              Back to Credentials
            </button>
          </div>
        </>
      )}
    </div>
  );
}
