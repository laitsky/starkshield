import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProofGeneration } from '../hooks/useProofGeneration';
import type { PublicOutputs } from '../hooks/useProofGeneration';
import ProofProgress from '../components/ProofProgress';
import PrivacyCallout from '../components/PrivacyCallout';
import ErrorBanner from '../components/ErrorBanner';
import { useWallet } from '../hooks/useWallet';
import {
  resolvePublicAsset,
  isNullifierUsed,
  getVerificationRecord,
  validateAgeCredential,
  validateMembershipCredential,
} from '../../src/index';
import type {
  CredentialJSON,
  CircuitType,
  AgeProofParams,
  MembershipProofParams,
} from '../../src/index';
import { buildVoyagerTxUrl } from '../explorer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}\u2026${hex.slice(-end)}`;
}

function determineCircuitType(credential: CredentialJSON): CircuitType | null {
  try {
    const credentialType = BigInt(credential.credential_type);
    if (credentialType === 0n) return 'age_verify';
    if (credentialType === 1n) return 'membership_proof';
    return null;
  } catch {
    return null;
  }
}

function validateCredentialForProof(credential: CredentialJSON): string | null {
  let credentialType: bigint;
  try {
    credentialType = BigInt(credential.credential_type);
  } catch {
    return 'Invalid credential_type value.';
  }

  const validation =
    credentialType === 0n
      ? validateAgeCredential(credential)
      : credentialType === 1n
        ? validateMembershipCredential(credential)
        : {
            valid: false,
            errors: [`Unsupported credential_type: ${credential.credential_type}`],
          };

  if (!validation.valid) {
    return validation.errors.join(', ');
  }

  try {
    BigInt(credential.expires_at);
  } catch {
    return 'Invalid expires_at value.';
  }

  return null;
}

function formatUnixTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'unknown time';
  }
  return new Date(seconds * 1000).toLocaleString();
}

function nextTestContextId(current: number): number {
  const candidate = Number.isFinite(current) ? Math.trunc(current) + 1 : 1;
  if (candidate <= 0) return 1;
  return candidate;
}

function randomTestContextId(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

// ---------------------------------------------------------------------------
// localStorage persistence for Verification Dashboard
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'starkshield_verifications';

interface StoredVerification {
  txHash: string;
  nullifier: string;
  circuitType: string;
  timestamp: number;
  attributeKey: string;
  threshold: string;
}

interface ExistingVerificationStatus {
  timestamp: number;
  circuitId: number;
}

function saveVerification(v: StoredVerification): void {
  try {
    const existing: StoredVerification[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '[]',
    );
    existing.unshift(v);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

// ---------------------------------------------------------------------------
// Copy to clipboard helper
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no-op
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1.5 text-[var(--color-text-3)] transition-colors duration-150 hover:text-[var(--color-accent)]"
      aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="0" ry="0" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Credential card (compact)
// ---------------------------------------------------------------------------

function CredentialCard({ credential }: { credential: CredentialJSON }) {
  const circuitType = determineCircuitType(credential);
  const isAge = circuitType === 'age_verify';
  const expiresAtUnix = (() => {
    try {
      return Number(BigInt(credential.expires_at));
    } catch {
      return 0;
    }
  })();
  const expiresAt = new Date(expiresAtUnix * 1000);
  const isExpired = expiresAtUnix <= Math.floor(Date.now() / 1000);

  return (
    <div
      className="brutal-card-static p-4 space-y-3"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: isExpired
          ? 'var(--color-red)'
          : isAge
            ? 'var(--color-cyan)'
            : 'var(--color-accent-2)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase text-[var(--color-text)]">
            {circuitType === 'age_verify'
              ? 'Age Verification'
              : circuitType === 'membership_proof'
                ? 'Membership Verification'
                : 'Unknown Credential'}
          </h3>
          <span className={`badge mt-1 ${isAge ? 'badge-age' : 'badge-membership'}`}>
            {isAge ? 'Age' : 'Membership'}
          </span>
        </div>
      </div>
      <div className="space-y-0">
        <div className="data-row">
          <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Issuer</span>
          <span className="font-mono text-xs text-[var(--color-text-2)]">
            {truncateHex(credential.issuer_id)}
          </span>
        </div>
        <div className="data-row">
          <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Expires</span>
          <span
            className={`text-xs ${isExpired ? 'text-[var(--color-red)]' : 'text-[var(--color-text-2)]'}`}
          >
            {expiresAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            {isExpired ? ' (Expired)' : ''}
          </span>
        </div>
      </div>

      {isExpired && (
        <div className="p-2.5 border border-[var(--color-red)] bg-[var(--color-surface-raised)] text-xs text-[var(--color-red)] font-mono flex items-start gap-2">
          <span className="shrink-0 mt-px">!</span>
          <span>This credential has expired. The on-chain verifier will reject proofs from expired credentials.</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public Outputs Preview with explanations
// ---------------------------------------------------------------------------

function OutputPreview({ outputs }: { outputs: PublicOutputs }) {
  if (!outputs) return null;

  const nullifier =
    outputs.circuitType === 'age_verify'
      ? outputs.nullifier
      : outputs.nullifier;
  const attributeKey =
    outputs.circuitType === 'age_verify'
      ? outputs.echoedAttributeKey
      : outputs.echoedAttributeKey;
  const thresholdOrSetHash =
    outputs.circuitType === 'age_verify'
      ? outputs.echoedThreshold
      : outputs.setHash;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase text-[var(--color-text)]">Public Outputs</h3>
        <p className="text-xs text-[var(--color-text-3)] mt-1">
          These values will be visible on-chain. They prove your claim without revealing your private data.
        </p>
      </div>

      <div className="brutal-card-static p-4 space-y-0">
        <div className="data-row">
          <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Circuit Type</span>
          <span className="text-xs text-[var(--color-text)]">
            {outputs.circuitType === 'age_verify'
              ? 'Age Verification'
              : 'Membership Verification'}
          </span>
        </div>
        <div className="data-row">
          <div className="space-y-0.5">
            <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Nullifier</span>
            <p className="text-[10px] text-[var(--color-text-3)]">Unique per-dApp ID that prevents replay attacks</p>
          </div>
          <span className="flex items-center font-mono text-xs text-[var(--color-text-2)]">
            {truncateHex(nullifier, 8, 6)}
            <CopyButton text={nullifier} />
          </span>
        </div>
        <div className="data-row">
          <div className="space-y-0.5">
            <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Attribute Key</span>
            <p className="text-[10px] text-[var(--color-text-3)]">Identifies what attribute is being verified</p>
          </div>
          <span className="flex items-center font-mono text-xs text-[var(--color-text-2)]">
            {truncateHex(attributeKey)}
            <CopyButton text={attributeKey} />
          </span>
        </div>
        <div className="data-row">
          <div className="space-y-0.5">
            <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">
              {outputs.circuitType === 'age_verify' ? 'Threshold' : 'Set Hash'}
            </span>
            <p className="text-[10px] text-[var(--color-text-3)]">
              {outputs.circuitType === 'age_verify'
                ? 'The minimum age being proven (e.g. >= 18)'
                : 'Hash of the allowed membership set'}
            </p>
          </div>
          <span className="flex items-center font-mono text-xs text-[var(--color-text-2)]">
            {truncateHex(thresholdOrSetHash)}
            <CopyButton text={thresholdOrSetHash} />
          </span>
        </div>
      </div>

      <PrivacyCallout context="submission" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProofGenerator View
// ---------------------------------------------------------------------------

export default function ProofGenerator() {
  const location = useLocation();
  const navigate = useNavigate();
  const { walletAccount } = useWallet();

  const {
    step,
    proofResult,
    calldataResult,
    submitResult,
    error,
    circuitType,
    publicOutputs,
    generateProof,
    prepareCalldata,
    submitOnChain,
    reset,
  } = useProofGeneration();

  // ---- Credential state ----
  const [credential, setCredential] = useState<CredentialJSON | null>(
    (location.state as { credential?: CredentialJSON } | null)?.credential ??
      null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Parameter state ----
  const [threshold, setThreshold] = useState(18);
  const [dappContextId, setDappContextId] = useState(42);
  const [allowedSetInput, setAllowedSetInput] = useState('0x64, 0x65, 0x66');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nullifierStatus, setNullifierStatus] = useState<
    'idle' | 'checking' | 'unused' | 'used' | 'error'
  >('idle');
  const [nullifierStatusError, setNullifierStatusError] = useState<string | null>(null);
  const [existingVerification, setExistingVerification] =
    useState<ExistingVerificationStatus | null>(null);
  const [contextSwitchMessage, setContextSwitchMessage] = useState<string | null>(null);
  const contextSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Elapsed time counter ----
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!credential) return;
    const validationError = validateCredentialForProof(credential);
    if (!validationError) return;

    setUploadError(`Invalid credential: ${validationError}`);
    setCredential(null);
    reset();
  }, [credential, reset]);

  useEffect(() => {
    const isActive =
      step !== 'idle' &&
      step !== 'complete' &&
      step !== 'error' &&
      step !== 'previewing';

    if (isActive) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [step]);

  useEffect(() => {
    return () => {
      if (contextSwitchTimeoutRef.current) {
        clearTimeout(contextSwitchTimeoutRef.current);
        contextSwitchTimeoutRef.current = null;
      }
    };
  }, []);

  // ---- Derived ----
  const resolvedCircuitType = credential
    ? determineCircuitType(credential)
    : null;
  const isAgeCircuit = resolvedCircuitType === 'age_verify';
  const isGenerating =
    step === 'initializing' ||
    step === 'generating' ||
    step === 'calldata';
  const nullifier = publicOutputs?.nullifier ?? null;

  // ---- Check if credential is expired ----
  const credentialExpired = credential
    ? (() => {
        try {
          return Number(BigInt(credential.expires_at)) <= Math.floor(Date.now() / 1000);
        } catch {
          return true;
        }
      })()
    : false;

  useEffect(() => {
    let cancelled = false;

    async function checkNullifierReuse(nextNullifier: string) {
      setNullifierStatus('checking');
      setNullifierStatusError(null);
      setExistingVerification(null);

      try {
        const used = await isNullifierUsed(nextNullifier);
        if (cancelled) return;

        if (!used) {
          setNullifierStatus('unused');
          return;
        }

        const record = await getVerificationRecord(nextNullifier);
        if (cancelled) return;

        if (record.exists) {
          setExistingVerification({
            timestamp: record.timestamp,
            circuitId: record.circuitId,
          });
        }
        setNullifierStatus('used');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setNullifierStatus('error');
        setNullifierStatusError(
          `Could not check on-chain nullifier status (${message}).`,
        );
      }
    }

    if (step === 'previewing' && nullifier) {
      void checkNullifierReuse(nullifier);
    } else {
      setNullifierStatus('idle');
      setNullifierStatusError(null);
      setExistingVerification(null);
    }

    return () => {
      cancelled = true;
    };
  }, [step, nullifier]);

  // ---- Handlers ----

  async function handleLoadDemo(path: string) {
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load: ${resp.status}`);
      const json: CredentialJSON = await resp.json();

      const validationError = validateCredentialForProof(json);
      if (validationError) {
        setUploadError(`Demo credential is invalid: ${validationError}`);
        return;
      }

      setCredential(json);
      setUploadError(null);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(`Failed to load demo credential: ${message}`);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json: CredentialJSON = JSON.parse(reader.result as string);
        const validationError = validateCredentialForProof(json);
        if (validationError) {
          setUploadError(`Invalid credential: ${validationError}`);
          return;
        }
        setCredential(json);
        setUploadError(null);
        reset();
      } catch {
        setUploadError(
          'Failed to parse JSON. Your credential file must contain fields like subject_id, issuer_id, credential_type, signature, etc. See the Credentials page for the full format guide.',
        );
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const handleGenerateProof = useCallback(async () => {
    if (!credential || !resolvedCircuitType) return;

    let params: AgeProofParams | MembershipProofParams;
    if (resolvedCircuitType === 'age_verify') {
      params = {
        threshold,
        dappContextId,
        currentTimestamp: Math.floor(Date.now() / 1000),
      };
    } else {
      const parsedSet = allowedSetInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      params = {
        allowedSet: parsedSet,
        dappContextId,
        currentTimestamp: Math.floor(Date.now() / 1000),
      };
    }

    const result = await generateProof(credential, resolvedCircuitType, params);

    if (result) {
      await prepareCalldata(result, resolvedCircuitType);
    }
  }, [
    credential,
    resolvedCircuitType,
    threshold,
    dappContextId,
    allowedSetInput,
    generateProof,
    prepareCalldata,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!walletAccount || !calldataResult || !publicOutputs) return;
    if (nullifierStatus === 'checking' || nullifierStatus === 'used') return;

    const nextNullifier = publicOutputs.nullifier;
    try {
      const used = await isNullifierUsed(nextNullifier);
      if (used) {
        const record = await getVerificationRecord(nextNullifier);
        if (record.exists) {
          setExistingVerification({
            timestamp: record.timestamp,
            circuitId: record.circuitId,
          });
        }
        setNullifierStatus('used');
        setNullifierStatusError(null);
        return;
      }
      setNullifierStatus('unused');
      setNullifierStatusError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNullifierStatus('error');
      setNullifierStatusError(
        `Could not pre-check nullifier before submission (${message}).`,
      );
      return;
    }

    const result = await submitOnChain(walletAccount, calldataResult);

    if (result && publicOutputs) {
      const nullifier =
        publicOutputs.circuitType === 'age_verify'
          ? publicOutputs.nullifier
          : publicOutputs.nullifier;
      const attributeKey =
        publicOutputs.circuitType === 'age_verify'
          ? publicOutputs.echoedAttributeKey
          : publicOutputs.echoedAttributeKey;
      const thresholdValue =
        publicOutputs.circuitType === 'age_verify'
          ? publicOutputs.echoedThreshold
          : publicOutputs.setHash;

      saveVerification({
        txHash: result.transactionHash,
        nullifier,
        circuitType: publicOutputs.circuitType,
        timestamp: Date.now(),
        attributeKey,
        threshold: thresholdValue,
      });
    }
  }, [
    walletAccount,
    calldataResult,
    publicOutputs,
    nullifierStatus,
    submitOnChain,
  ]);

  function handleReset() {
    if (contextSwitchTimeoutRef.current) {
      clearTimeout(contextSwitchTimeoutRef.current);
      contextSwitchTimeoutRef.current = null;
    }
    reset();
    setElapsed(0);
    setNullifierStatus('idle');
    setNullifierStatusError(null);
    setExistingVerification(null);
    setContextSwitchMessage(null);
  }

  function switchToTestContext(nextId: number) {
    setDappContextId(nextId);
    setContextSwitchMessage(
      `Selected test dApp Context ID ${nextId}. Returning to parameter step...`,
    );

    if (contextSwitchTimeoutRef.current) {
      clearTimeout(contextSwitchTimeoutRef.current);
    }
    contextSwitchTimeoutRef.current = setTimeout(() => {
      contextSwitchTimeoutRef.current = null;
      handleReset();
    }, 700);
  }

  // ---- Render ----

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-3">
        <span className="section-label">// Prove</span>
        <h2 className="text-3xl font-extrabold uppercase text-[var(--color-text)]">Proof Generator</h2>
        <p className="text-sm text-[var(--color-text-2)]">
          Generate a zero-knowledge proof from your credential and submit it on-chain.
          Your private data never leaves your browser.
        </p>
      </div>

      {/* Section 1: Credential Selection */}
      {credential ? (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="section-label">01 &mdash; Selected Credential</span>
            <button
              onClick={() => {
                setCredential(null);
                handleReset();
              }}
              className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-3)] transition-colors duration-150 hover:text-[var(--color-accent)]"
            >
              Change
            </button>
          </div>
          <CredentialCard credential={credential} />
        </div>
      ) : (
        <div className="brutal-card-static p-6 space-y-5 animate-fade-in">
          <span className="section-label">01 &mdash; Select a Credential</span>
          <p className="text-xs text-[var(--color-text-3)]">
            Choose a demo credential to try the flow, or upload your own issuer-signed JSON file.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                handleLoadDemo(resolvePublicAsset('credentials/demo_credential.json'))
              }
              className="btn-secondary flex items-center gap-2 !text-xs"
            >
              <span className="badge badge-age !text-[8px] !py-0 !px-1.5">Age</span>
              Demo Credential
            </button>
            <button
              onClick={() =>
                handleLoadDemo(
                  resolvePublicAsset('credentials/demo_credential_membership.json'),
                )
              }
              className="btn-secondary flex items-center gap-2 !text-xs"
            >
              <span className="badge badge-membership !text-[8px] !py-0 !px-1.5">Mbr</span>
              Demo Credential
            </button>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2 !text-xs"
              >
                Upload Your JSON
              </button>
            </div>
          </div>
          {uploadError && (
            <div
              className="p-3 flex items-start gap-2 border border-[var(--color-red)] bg-[var(--color-surface-raised)] animate-fade-in"
            >
              <span className="text-[var(--color-red)] text-xs font-bold shrink-0">!</span>
              <p className="text-xs text-[var(--color-red)] font-mono leading-relaxed">{uploadError}</p>
            </div>
          )}
          <p className="text-[10px] text-[var(--color-text-3)] font-mono">
            Not sure about the file format? Check the{' '}
            <a href="/" className="text-[var(--color-cyan)] hover:text-[var(--color-accent)] transition-colors">
              Credentials page
            </a>{' '}
            for a detailed schema guide.
          </p>
        </div>
      )}

      {/* Section 2: Proof Parameters */}
      {credential && step === 'idle' && !proofResult && (
        <div className="brutal-card-static p-6 space-y-5 animate-fade-in-up">
          <div>
            <span className="section-label">02 &mdash; Proof Parameters</span>
            <p className="text-xs text-[var(--color-text-3)] mt-2">
              {isAgeCircuit
                ? 'Configure what you want to prove about your age. The proof will verify your age meets the threshold without revealing your actual age.'
                : 'Configure the membership set to verify against. The proof will verify your membership tier is in the allowed set without revealing which one.'}
            </p>
          </div>

          <div className="p-3 border border-[var(--color-border-hard)] bg-[var(--color-surface-raised)] text-[10px] text-[var(--color-text-3)] font-mono leading-relaxed">
            Demo note: in a real integration, the verifying dApp sets these parameters (threshold / allowed set and context).
            StarkShield stores the resulting threshold or set-hash on-chain so dApps can enforce their own policy.
          </div>

          {isAgeCircuit ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--color-text-2)]">
                  Age Threshold
                </label>
                <p className="text-[10px] text-[var(--color-text-3)] mb-2">
                  The minimum age to prove. E.g. 18 means "I am at least 18 years old."
                </p>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) =>
                    setThreshold(parseInt(e.target.value, 10) || 0)
                  }
                  className="input-field"
                  min={1}
                  max={150}
                  placeholder="18"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--color-text-2)]">
                  dApp Context ID
                </label>
                <p className="text-[10px] text-[var(--color-text-3)] mb-2">
                  A unique identifier for the application requesting verification. This scopes the nullifier
                  so the same credential produces different proofs for different dApps.
                </p>
                <input
                  type="number"
                  value={dappContextId}
                  onChange={(e) =>
                    setDappContextId(parseInt(e.target.value, 10) || 0)
                  }
                  className="input-field"
                  min={0}
                  placeholder="42"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--color-text-2)]">
                  Allowed Set (comma-separated hex values)
                </label>
                <p className="text-[10px] text-[var(--color-text-3)] mb-2">
                  The set of valid membership tiers. The proof verifies your tier is one of these values
                  without revealing which one. E.g. 0x64 = Gold, 0x65 = Platinum, 0x66 = Diamond.
                </p>
                <input
                  type="text"
                  value={allowedSetInput}
                  onChange={(e) => setAllowedSetInput(e.target.value)}
                  className="input-field"
                  placeholder="0x64, 0x65, 0x66"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--color-text-2)]">
                  dApp Context ID
                </label>
                <p className="text-[10px] text-[var(--color-text-3)] mb-2">
                  A unique identifier for the application requesting verification. This scopes the nullifier
                  so the same credential produces different proofs for different dApps.
                </p>
                <input
                  type="number"
                  value={dappContextId}
                  onChange={(e) =>
                    setDappContextId(parseInt(e.target.value, 10) || 0)
                  }
                  className="input-field"
                  min={0}
                  placeholder="42"
                />
              </div>
            </div>
          )}

          <PrivacyCallout context="proof" />

          {/* Expired credential warning */}
          {credentialExpired && (
            <div
              className="p-3 flex items-start gap-2 border border-[var(--color-red)] bg-[var(--color-surface-raised)]"
            >
              <span className="text-[var(--color-red)] text-xs font-bold shrink-0">!</span>
              <p className="text-xs text-[var(--color-red)] font-mono">
                This credential has expired. You can still generate a proof locally, but it will be rejected by the on-chain verifier.
              </p>
            </div>
          )}

          <button
            onClick={handleGenerateProof}
            disabled={!credential || isGenerating}
            className="btn-primary w-full !py-3 flex items-center justify-center gap-2"
          >
            {credentialExpired ? 'Generate Proof (Credential Expired)' : 'Generate Proof'}
          </button>

          {/* Pre-generation info */}
          <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-3)] font-mono">
            <span>Estimated time: ~15-30s</span>
            <span>Runs entirely in your browser via WASM</span>
          </div>
        </div>
      )}

      {/* Section 3: Progress */}
      {(isGenerating || step === 'submitting') && (
        <div className="brutal-card-static p-6 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="section-label">03 &mdash; Processing</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--color-text-3)] font-mono">
                ~15-30s typical
              </span>
              <span className="badge badge-checking font-mono">{elapsed}s</span>
            </div>
          </div>
          <ProofProgress currentStep={step} />

          {elapsed > 30 && (
            <p className="text-[10px] text-[var(--color-text-3)] font-mono animate-fade-in">
              Taking longer than usual. This is normal on slower devices &mdash; the proof is being computed locally.
            </p>
          )}
        </div>
      )}

      {/* Section 4: Public Output Preview */}
      {step === 'previewing' && publicOutputs && (
        <div className="brutal-card-static p-6 space-y-5 animate-fade-in-up">
          <OutputPreview outputs={publicOutputs} />

          {proofResult && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-green)] font-mono">
              Proof generated in {(proofResult.provingTimeMs / 1000).toFixed(1)}s
            </div>
          )}

          {nullifierStatus === 'checking' && (
            <div className="p-3 border border-[var(--color-border-hard)] bg-[var(--color-surface-raised)]">
              <p className="text-xs text-[var(--color-text-2)] font-mono">
                Checking if this nullifier is already verified on-chain...
              </p>
            </div>
          )}

          {nullifierStatus === 'used' && (
            <div
              className="p-3 border border-[var(--color-green)] bg-[var(--color-surface-raised)]"
            >
              <p className="text-xs font-bold uppercase text-[var(--color-green)]">
                Already verified
              </p>
              <p className="text-[10px] text-[var(--color-text-3)] font-mono mt-1">
                This nullifier is already registered on-chain for this dApp context.
                Submission is skipped to avoid an unnecessary wallet popup and revert.
              </p>
              <p className="text-[10px] text-[var(--color-text-3)] font-mono mt-1">
                Demo tip: choose a new test dApp Context ID to generate a different nullifier.
              </p>
              {existingVerification && (
                <p className="text-[10px] text-[var(--color-text-3)] font-mono mt-1">
                  Recorded at {formatUnixTimestamp(existingVerification.timestamp)} ({existingVerification.timestamp}),
                  circuit id {existingVerification.circuitId}.
                </p>
              )}
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      switchToTestContext(nextTestContextId(dappContextId));
                    }}
                    className="btn-secondary !text-xs"
                  >
                    Use New Test Context (ID {nextTestContextId(dappContextId)})
                  </button>
                  <button
                    onClick={() => {
                      switchToTestContext(randomTestContextId());
                    }}
                    className="btn-secondary !text-xs"
                  >
                    Use Random Test Context
                  </button>
                </div>
                {contextSwitchMessage && (
                  <p className="text-[10px] text-[var(--color-green)] font-mono mt-2">
                    {contextSwitchMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {nullifierStatus === 'error' && nullifierStatusError && (
            <div
              className="p-3 border border-[var(--color-red)] bg-[var(--color-surface-raised)]"
            >
              <p className="text-xs text-[var(--color-red)] font-mono">{nullifierStatusError}</p>
            </div>
          )}

          <div className="flex gap-3">
            {walletAccount ? (
              <button
                onClick={handleSubmit}
                disabled={nullifierStatus !== 'unused'}
                className="btn-success flex-1 flex items-center justify-center gap-2"
              >
                {nullifierStatus === 'checking'
                  ? 'Checking Status...'
                  : nullifierStatus === 'used'
                    ? 'Already Verified'
                    : 'Submit On-Chain'}
              </button>
            ) : (
              <div
                className="brutal-card-static flex-1 p-4 text-center space-y-2"
                style={{ borderColor: 'var(--color-accent)' }}
              >
                <p className="text-xs font-bold uppercase text-[var(--color-accent)]">
                  Wallet required
                </p>
                <p className="text-[10px] text-[var(--color-text-3)] font-mono">
                  Connect your Starknet wallet (ArgentX or Braavos) using the button in the header to submit this proof on-chain.
                </p>
              </div>
            )}
            <button
              onClick={handleReset}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Section 5: Result */}
      {step === 'complete' && submitResult && (
        <div
          className="brutal-card-static p-6 space-y-5 animate-fade-in overflow-hidden"
          style={{ borderLeftWidth: '4px', borderLeftColor: 'var(--color-green)' }}
        >
          <div>
            <p className="text-sm font-bold uppercase text-[var(--color-green)]">Proof submitted successfully</p>
            <p className="text-xs text-[var(--color-text-3)] mt-1 font-mono">Your zero-knowledge proof is now on Starknet Sepolia. It may take a few minutes to be confirmed.</p>
          </div>

          <div className="brutal-card-static p-4 space-y-0">
            <div className="data-row">
              <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Transaction Hash</span>
              <span className="flex items-center">
                <a
                  href={buildVoyagerTxUrl(submitResult.transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-xs text-[var(--color-cyan)] transition-colors duration-150 hover:text-[var(--color-accent)]"
                >
                  {truncateHex(submitResult.transactionHash, 8, 6)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
                <CopyButton text={submitResult.transactionHash} />
              </span>
            </div>
            {publicOutputs && (
              <div className="data-row">
                <span className="text-xs font-bold uppercase text-[var(--color-text-3)]">Nullifier</span>
                <span className="flex items-center font-mono text-xs text-[var(--color-text-2)]">
                  {truncateHex(
                    publicOutputs.circuitType === 'age_verify'
                      ? publicOutputs.nullifier
                      : publicOutputs.nullifier,
                    8,
                    6,
                  )}
                  <CopyButton text={publicOutputs.nullifier} />
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              Generate Another
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex items-center gap-2"
            >
              View Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Section 6: Error */}
      {step === 'error' && error && (
        <div className="space-y-4 animate-fade-in">
          <ErrorBanner error={error} onDismiss={handleReset} />
          <button
            onClick={handleReset}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
