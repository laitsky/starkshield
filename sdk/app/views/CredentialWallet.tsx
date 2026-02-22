import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  validateAgeCredential,
  validateMembershipCredential,
  resolvePublicAsset,
} from '../../src/index';
import type { CredentialJSON, ValidationResult } from '../../src/index';
import PrivacyCallout from '../components/PrivacyCallout';

interface LoadedCredential {
  credential: CredentialJSON;
  validation: ValidationResult;
  displayName: string;
  attributeType: 'Age' | 'Membership';
  expirationStatus: 'active' | 'expired';
  expiresAt: Date;
  issuerTruncated: string;
  isDemo: boolean;
}

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}\u2026${hex.slice(-end)}`;
}

function parseCredential(cred: CredentialJSON, isDemo = false): LoadedCredential {
  const credType = BigInt(cred.credential_type);
  const isAge = credType === 0n;

  const validation = isAge
    ? validateAgeCredential(cred)
    : validateMembershipCredential(cred);

  const expiresAtUnix = Number(BigInt(cred.expires_at));
  const expiresAt = new Date(expiresAtUnix * 1000);
  const expirationStatus =
    expiresAtUnix > Math.floor(Date.now() / 1000) ? 'active' : 'expired';

  return {
    credential: cred,
    validation,
    displayName: isAge ? 'Age Verification' : 'Membership Verification',
    attributeType: isAge ? 'Age' : 'Membership',
    expirationStatus,
    expiresAt,
    issuerTruncated: truncateHex(cred.issuer_id),
    isDemo,
  };
}

const DEMO_CREDENTIALS = [
  resolvePublicAsset('credentials/demo_credential.json'),
  resolvePublicAsset('credentials/demo_credential_membership.json'),
];

// Credential JSON schema example for guiding users
const SCHEMA_EXAMPLE = `{
  "subject_id":       "0x14a0cf45...",     // Your identity hash
  "issuer_id":        "0x16e4953b...",     // Issuer public key
  "credential_type":  "0x00...00",         // 0 = Age, 1 = Membership
  "attribute_key":    "0x00...01",         // Attribute identifier
  "attribute_value":  "0x00...19",         // Private value (e.g. age)
  "issued_at":        "0x00...7b",         // Unix timestamp (hex)
  "expires_at":       "0x00...fb",         // Expiration timestamp (hex)
  "secret_salt":      "0x05692e14...",     // Random salt
  "signature":        [24, 176, ...],      // Schnorr signature bytes
  "issuer_pub_key_x": "0x16e4953b...",     // Issuer pub key X
  "issuer_pub_key_y": "0x29531f99..."      // Issuer pub key Y
}`;

export default function CredentialWallet() {
  const [credentials, setCredentials] = useState<LoadedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function loadDemoCredentials() {
      try {
        setLoading(true);
        setError(null);

        const results = await Promise.all(
          DEMO_CREDENTIALS.map(async (path) => {
            const resp = await fetch(path);
            if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
            const json: CredentialJSON = await resp.json();
            return parseCredential(json, true);
          }),
        );

        if (!cancelled) {
          setCredentials(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load demo credentials');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDemoCredentials();
    return () => {
      cancelled = true;
    };
  }, []);

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json: CredentialJSON = JSON.parse(reader.result as string);
        const loaded = parseCredential(json, false);

        if (!loaded.validation.valid) {
          setError(`Invalid credential: ${loaded.validation.errors.join(', ')}`);
          return;
        }

        setCredentials((prev) => [...prev, loaded]);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Failed to parse JSON: ${err.message}`
            : 'Failed to parse credential file. Make sure it\'s valid JSON matching the expected schema.',
        );
      }
    };
    reader.readAsText(file);
  }

  function handleFileLoad(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      processFile(file);
    } else {
      setError('Please upload a .json file');
    }
  }

  function handleGenerateProof(cred: LoadedCredential) {
    if (cred.expirationStatus === 'expired') {
      setError('This credential has expired. Generating a proof will fail on-chain. Please use an active credential.');
      return;
    }
    if (!cred.validation.valid) {
      setError(`Cannot generate proof: credential has validation errors (${cred.validation.errors.join(', ')})`);
      return;
    }
    navigate('/prove', { state: { credential: cred.credential } });
  }

  function handleRemoveCredential(idx: number) {
    setCredentials((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="h-8 w-8 border-3 border-[var(--color-border-hard)] border-t-[var(--color-accent)] animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-3)]">Loading credentials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Section Header */}
      <div className="space-y-3">
        <span className="section-label">// Credentials</span>
        <h2 className="text-3xl font-extrabold uppercase text-[var(--color-text)]">Credential Wallet</h2>
        <p className="text-sm text-[var(--color-text-2)]">
          Your credentials are signed attestations from trusted issuers. Select one to generate a zero-knowledge proof.
        </p>
      </div>

      {/* Quick Start Guide for new users */}
      <div className="warning-callout animate-fade-in space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
          How it works
        </p>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
          <div className="flex items-start gap-2">
            <span className="text-xs font-extrabold text-[var(--color-accent)] mt-0.5">1</span>
            <p className="text-xs text-[var(--color-text-2)]">Load a credential (try the demos below or upload your own)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-extrabold text-[var(--color-accent)] mt-0.5">2</span>
            <p className="text-xs text-[var(--color-text-2)]">Click a credential to generate a ZK proof in your browser</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-extrabold text-[var(--color-accent)] mt-0.5">3</span>
            <p className="text-xs text-[var(--color-text-2)]">Submit the proof on-chain &mdash; your private data never leaves your device</p>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <PrivacyCallout context="credential" />

      {/* Error */}
      {error && (
        <div
          className="brutal-card-static animate-fade-in p-4 flex items-start justify-between gap-3"
          style={{ borderLeftWidth: '4px', borderLeftColor: 'var(--color-red)' }}
        >
          <div className="space-y-1 flex-1">
            <p className="text-xs font-bold uppercase text-[var(--color-red)]">Error</p>
            <p className="text-xs text-[var(--color-red)] font-mono leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 p-1 text-[var(--color-text-3)] hover:text-[var(--color-red)] transition-colors"
            aria-label="Dismiss error"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Empty State */}
      {credentials.length === 0 && !loading && (
        <div className="brutal-card-static p-12 text-center space-y-5 animate-fade-in">
          <p className="text-sm font-bold uppercase text-[var(--color-text-2)]">No credentials loaded</p>
          <p className="text-xs text-[var(--color-text-3)] font-mono leading-relaxed max-w-sm mx-auto">
            Upload a credential JSON file using the card below, or reload the demo credentials to try the flow.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary !text-xs mx-auto flex items-center gap-2"
          >
            Reload Demo Credentials
          </button>
        </div>
      )}

      {/* Credential Cards */}
      <div className="grid gap-5 sm:grid-cols-2">
        {credentials.map((cred, idx) => {
          const isAge = cred.attributeType === 'Age';
          const isExpired = cred.expirationStatus === 'expired';
          const isInvalid = !cred.validation.valid;

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              className={`brutal-card group cursor-pointer p-6 space-y-5 animate-fade-in-up ${isExpired ? 'opacity-60' : ''}`}
              style={{
                animationDelay: `${idx * 0.06}s`,
                borderLeftWidth: '4px',
                borderLeftColor: isExpired
                  ? 'var(--color-red)'
                  : isAge
                    ? 'var(--color-cyan)'
                    : 'var(--color-accent-2)',
              }}
              onClick={() => handleGenerateProof(cred)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleGenerateProof(cred); } }}
              aria-label={`${cred.displayName}${isExpired ? ' (Expired)' : ''} - Generate proof`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase text-[var(--color-text)]">{cred.displayName}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge ${isAge ? 'badge-age' : 'badge-membership'}`}>
                      {cred.attributeType}
                    </span>
                    {cred.isDemo && (
                      <span className="badge badge-demo">Demo</span>
                    )}
                  </div>
                </div>
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCredential(idx);
                  }}
                  className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-red)] transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Remove credential"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Card Body */}
              <div className="space-y-0">
                <div className="data-row">
                  <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Issuer</span>
                  <span className="font-mono text-xs text-[var(--color-text-2)]">{cred.issuerTruncated}</span>
                </div>
                <div className="data-row">
                  <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Expires</span>
                  <span className={`text-xs ${isExpired ? 'text-[var(--color-red)]' : 'text-[var(--color-text-2)]'}`}>
                    {cred.expiresAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="data-row">
                  <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Status</span>
                  <span className={`badge ${cred.expirationStatus === 'active' ? 'badge-active' : 'badge-expired'}`}>
                    {cred.expirationStatus === 'active' ? 'Active' : 'Expired'}
                  </span>
                </div>

                {isExpired && (
                  <div className="mt-3 p-2.5 border border-[var(--color-red)] bg-[var(--color-surface-raised)] text-xs text-[var(--color-red)] font-mono flex items-start gap-2">
                    <span className="shrink-0 mt-px">!</span>
                    <span>This credential has expired and cannot be used for on-chain verification. Request a new one from the issuer.</span>
                  </div>
                )}

                {isInvalid && !isExpired && (
                  <div className="mt-3 p-2.5 border border-[var(--color-red)] bg-[var(--color-surface-raised)] text-xs text-[var(--color-red)] font-mono flex items-start gap-2">
                    <span className="shrink-0 mt-px">!</span>
                    <span>{cred.validation.errors.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-1">
                <span className={`text-xs font-bold uppercase tracking-wide ${
                  isExpired || isInvalid
                    ? 'text-[var(--color-text-3)]'
                    : 'text-[var(--color-accent)] group-hover:text-[var(--color-text)]'
                }`}>
                  {isExpired
                    ? 'Expired'
                    : isInvalid
                      ? 'Invalid'
                      : 'Generate Proof \u2192'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Upload Card with drag-and-drop */}
        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          className={`brutal-card group cursor-pointer p-6 flex flex-col items-center justify-center gap-4 min-h-[240px] animate-fade-in-up ${
            isDragging ? 'card-selected' : ''
          }`}
          style={{
            animationDelay: `${credentials.length * 0.06}s`,
            borderStyle: 'dashed',
            borderColor: isDragging ? 'var(--color-accent)' : undefined,
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload credential JSON file"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileLoad}
            className="hidden"
          />
          <div className={`text-3xl font-extrabold transition-colors duration-150 ${
            isDragging ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-3)] group-hover:text-[var(--color-accent)]'
          }`}>+</div>
          <div className="text-center space-y-2">
            <p className="text-sm font-bold uppercase text-[var(--color-text-2)] group-hover:text-[var(--color-text)]">
              {isDragging ? 'Drop credential here' : 'Load Your Credential'}
            </p>
            <p className="text-xs text-[var(--color-text-3)] font-mono">
              Drag & drop a .json file or click to browse
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSchema((prev) => !prev);
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-cyan)] hover:text-[var(--color-accent)] transition-colors mt-2 inline-block"
            >
              {showSchema ? 'Hide format guide' : 'What format should my file be?'}
            </button>
          </div>
        </div>
      </div>

      {/* Schema Guide (expandable) */}
      {showSchema && (
        <div className="brutal-card-static p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <span className="section-label">// Credential JSON Format</span>
            <button
              onClick={() => setShowSchema(false)}
              className="text-xs font-bold uppercase text-[var(--color-text-3)] hover:text-[var(--color-accent)] transition-colors"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
            StarkShield uses a compact credential format optimized for ZK circuits. Your credential JSON
            must be signed by a trusted issuer and contain all required fields. Here's the expected structure:
          </p>

          <pre className="schema-box">{SCHEMA_EXAMPLE}</pre>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-[var(--color-text-3)]">Required fields</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">subject_id</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Your identity hash (hex)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">issuer_id</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Issuer's public key (hex)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">credential_type</span>
                <span className="text-[10px] text-[var(--color-text-3)]">0x...0 = Age, 0x...1 = Membership</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">attribute_value</span>
                <span className="text-[10px] text-[var(--color-text-3)]">The private value to prove about</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">issued_at / expires_at</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Unix timestamps as hex strings</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">signature</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Schnorr signature byte array</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">issuer_pub_key_x/y</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Issuer's full public key coords</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-cyan)]">secret_salt</span>
                <span className="text-[10px] text-[var(--color-text-3)]">Random salt for nullifier derivation</span>
              </div>
            </div>
          </div>

          <div
            className="p-3"
            style={{ borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: 'var(--color-cyan)', background: 'var(--color-surface-raised)' }}
          >
            <p className="text-[10px] text-[var(--color-text-3)] font-mono leading-relaxed">
              Don't have a credential? Use the demo credentials above to try the full flow.
              In production, credentials are issued by trusted identity providers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
