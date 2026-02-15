import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProofGeneration } from '../hooks/useProofGeneration';
import type { PublicOutputs } from '../hooks/useProofGeneration';
import ProofProgress from '../components/ProofProgress';
import PrivacyCallout from '../components/PrivacyCallout';
import ErrorBanner from '../components/ErrorBanner';
import { useWallet } from '../hooks/useWallet';
import type {
  CredentialJSON,
  CircuitType,
  AgeProofParams,
  MembershipProofParams,
} from '../../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}...${hex.slice(-end)}`;
}

function determineCircuitType(credential: CredentialJSON): CircuitType {
  return BigInt(credential.credential_type) === 0n
    ? 'age_verify'
    : 'membership_proof';
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
      className="ml-2 rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-400 transition hover:border-gray-500 hover:text-gray-200"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Credential card (compact)
// ---------------------------------------------------------------------------

function CredentialCard({ credential }: { credential: CredentialJSON }) {
  const circuitType = determineCircuitType(credential);
  const isAge = circuitType === 'age_verify';
  const expiresAtUnix = Number(BigInt(credential.expires_at));
  const expiresAt = new Date(expiresAtUnix * 1000);
  const isExpired = expiresAtUnix <= Math.floor(Date.now() / 1000);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-100">
          {isAge ? 'Age Verification' : 'Membership Verification'}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isAge
              ? 'bg-blue-900/50 text-blue-300'
              : 'bg-purple-900/50 text-purple-300'
          }`}
        >
          {isAge ? 'Age' : 'Membership'}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Issuer</span>
        <span className="font-mono text-gray-400">
          {truncateHex(credential.issuer_id)}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Expires</span>
        <span
          className={isExpired ? 'text-red-400' : 'text-gray-400'}
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
  );
}

// ---------------------------------------------------------------------------
// Public Outputs Preview
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
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-200">Public Outputs</h3>
      <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Circuit Type</span>
          <span className="text-gray-200">
            {outputs.circuitType === 'age_verify'
              ? 'Age Verification'
              : 'Membership Verification'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Nullifier</span>
          <span className="flex items-center font-mono text-xs text-gray-300">
            {truncateHex(nullifier, 8, 6)}
            <CopyButton text={nullifier} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Attribute Key</span>
          <span className="font-mono text-xs text-gray-300">
            {truncateHex(attributeKey)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">
            {outputs.circuitType === 'age_verify' ? 'Threshold' : 'Set Hash'}
          </span>
          <span className="font-mono text-xs text-gray-300">
            {truncateHex(thresholdOrSetHash)}
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

  // ---- Elapsed time counter ----
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ---- Derived ----
  const resolvedCircuitType = credential
    ? determineCircuitType(credential)
    : null;
  const isAgeCircuit = resolvedCircuitType === 'age_verify';
  const isGenerating =
    step === 'initializing' ||
    step === 'generating' ||
    step === 'calldata';

  // ---- Handlers ----

  async function handleLoadDemo(path: string) {
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load: ${resp.status}`);
      const json: CredentialJSON = await resp.json();
      setCredential(json);
      reset();
    } catch (err) {
      // Use hook error state for display
      console.error('Failed to load demo credential:', err);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json: CredentialJSON = JSON.parse(reader.result as string);
        setCredential(json);
        reset();
      } catch (err) {
        console.error('Failed to parse credential:', err);
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

    // If proof succeeded, automatically prepare calldata for preview
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
  }, [walletAccount, calldataResult, publicOutputs, submitOnChain]);

  function handleReset() {
    reset();
    setElapsed(0);
  }

  // ---- Render ----

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-100">Proof Generator</h2>

      {/* Section 1: Credential Selection */}
      {credential ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Selected Credential</span>
            <button
              onClick={() => {
                setCredential(null);
                handleReset();
              }}
              className="text-xs text-gray-500 transition hover:text-gray-300"
            >
              Change
            </button>
          </div>
          <CredentialCard credential={credential} />
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-sm font-medium text-gray-300">
            Select a Credential
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                handleLoadDemo('/credentials/demo_credential.json')
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:border-blue-600 hover:text-blue-300"
            >
              Load Age Demo
            </button>
            <button
              onClick={() =>
                handleLoadDemo(
                  '/credentials/demo_credential_membership.json',
                )
              }
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:border-purple-600 hover:text-purple-300"
            >
              Load Membership Demo
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
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
              >
                Upload JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Proof Parameters */}
      {credential && step === 'idle' && !proofResult && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-sm font-medium text-gray-300">
            Proof Parameters
          </h3>

          {isAgeCircuit ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Age Threshold
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) =>
                    setThreshold(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  min={0}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  dApp Context ID
                </label>
                <input
                  type="number"
                  value={dappContextId}
                  onChange={(e) =>
                    setDappContextId(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  min={0}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Allowed Set (comma-separated hex values)
                </label>
                <input
                  type="text"
                  value={allowedSetInput}
                  onChange={(e) => setAllowedSetInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-mono text-gray-100 focus:border-purple-500 focus:outline-none"
                  placeholder="0x64, 0x65, 0x66"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  dApp Context ID
                </label>
                <input
                  type="number"
                  value={dappContextId}
                  onChange={(e) =>
                    setDappContextId(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-purple-500 focus:outline-none"
                  min={0}
                />
              </div>
            </div>
          )}

          <PrivacyCallout context="proof" />

          <button
            onClick={handleGenerateProof}
            disabled={!credential || isGenerating}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Proof
          </button>
        </div>
      )}

      {/* Section 3: Progress */}
      {(isGenerating || step === 'submitting') && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <ProofProgress currentStep={step} />
          <div className="text-xs text-gray-500">
            Elapsed: {elapsed}s
          </div>
        </div>
      )}

      {/* Section 4: Public Output Preview */}
      {step === 'previewing' && publicOutputs && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <OutputPreview outputs={publicOutputs} />

          {proofResult && (
            <div className="text-xs text-gray-500">
              Proof generated in {(proofResult.provingTimeMs / 1000).toFixed(1)}s
            </div>
          )}

          <div className="flex gap-3">
            {walletAccount ? (
              <button
                onClick={handleSubmit}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-500"
              >
                Submit On-Chain
              </button>
            ) : (
              <div className="flex-1 rounded-lg border border-yellow-700/40 bg-yellow-950/30 px-4 py-2.5 text-center text-sm text-yellow-300">
                Connect wallet to submit
              </div>
            )}
            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-300 transition hover:border-gray-600 hover:text-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Section 5: Result */}
      {step === 'complete' && submitResult && (
        <div className="space-y-4 rounded-xl border border-green-700/40 bg-green-950/20 p-6">
          <div className="flex items-center gap-2 text-green-300">
            <span className="text-lg">{'\u2713'}</span>
            <span className="font-medium">Proof submitted successfully!</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Transaction Hash</span>
              <a
                href={`https://sepolia.starkscan.co/tx/${submitResult.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-400 underline transition hover:text-blue-300"
              >
                {truncateHex(submitResult.transactionHash, 8, 6)}
              </a>
            </div>
            {publicOutputs && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Nullifier</span>
                <span className="font-mono text-xs text-gray-300">
                  {truncateHex(
                    publicOutputs.circuitType === 'age_verify'
                      ? publicOutputs.nullifier
                      : publicOutputs.nullifier,
                    8,
                    6,
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              Generate Another Proof
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-400 transition hover:text-gray-200"
            >
              View Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Section 6: Error */}
      {step === 'error' && error && (
        <div className="space-y-4">
          <ErrorBanner error={error} onDismiss={handleReset} />
          <button
            onClick={handleReset}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-300 transition hover:border-gray-600 hover:text-gray-100"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
