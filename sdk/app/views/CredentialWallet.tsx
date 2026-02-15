import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  validateAgeCredential,
  validateMembershipCredential,
} from '../../src/index';
import type { CredentialJSON, ValidationResult } from '../../src/index';

interface LoadedCredential {
  credential: CredentialJSON;
  validation: ValidationResult;
  displayName: string;
  attributeType: 'Age' | 'Membership';
  expirationStatus: 'active' | 'expired';
  expiresAt: Date;
  issuerTruncated: string;
}

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}...${hex.slice(-end)}`;
}

function parseCredential(cred: CredentialJSON): LoadedCredential {
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
  };
}

const DEMO_CREDENTIALS = [
  '/credentials/demo_credential.json',
  '/credentials/demo_credential_membership.json',
];

export default function CredentialWallet() {
  const [credentials, setCredentials] = useState<LoadedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
            return parseCredential(json);
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

  function handleFileLoad(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json: CredentialJSON = JSON.parse(reader.result as string);
        const loaded = parseCredential(json);

        if (!loaded.validation.valid) {
          setError(`Invalid credential: ${loaded.validation.errors.join(', ')}`);
          return;
        }

        setCredentials((prev) => [...prev, loaded]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse credential file');
      }
    };
    reader.readAsText(file);

    // Reset file input so the same file can be loaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleGenerateProof(cred: LoadedCredential) {
    navigate('/prove', { state: { credential: cred.credential } });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading credentials...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-100">Credential Wallet</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileLoad}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-600 hover:text-gray-100"
          >
            Load Credential
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-green-700/40 bg-green-950/30 px-4 py-3 text-sm text-green-300">
        <span className="mt-0.5 shrink-0" aria-hidden="true">&#128274;</span>
        <span>Your credential data stays on your device. It is never uploaded to any server.</span>
      </div>

      {credentials.length === 0 && !loading && (
        <div className="py-10 text-center text-gray-500">
          No credentials loaded. Use the button above to load a credential JSON file.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {credentials.map((cred, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-100">{cred.displayName}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  cred.attributeType === 'Age'
                    ? 'bg-blue-900/50 text-blue-300'
                    : 'bg-purple-900/50 text-purple-300'
                }`}
              >
                {cred.attributeType}
              </span>
            </div>

            {/* Body */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Issuer</span>
                <span className="font-mono text-gray-300">{cred.issuerTruncated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expires</span>
                <span className="text-gray-300">
                  {cred.expiresAt.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    cred.expirationStatus === 'active'
                      ? 'bg-green-900/50 text-green-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}
                >
                  {cred.expirationStatus === 'active' ? 'Active' : 'Expired'}
                </span>
              </div>
              {!cred.validation.valid && (
                <div className="mt-1 rounded border border-red-700/30 bg-red-950/20 px-2 py-1 text-xs text-red-400">
                  Validation: {cred.validation.errors.join(', ')}
                </div>
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => handleGenerateProof(cred)}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              Generate Proof
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
