/**
 * useVerifications -- Hook for loading, enriching, and managing verification records
 *
 * Loads past verifications from localStorage, enriches them with on-chain data
 * via getVerificationRecord, and provides clear history functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { getVerificationRecord } from '../../src/index';

const STORAGE_KEY = 'starkshield_verifications';

export interface StoredVerification {
  txHash: string;
  nullifier: string;
  circuitType: 'age_verify' | 'membership_proof';
  timestamp: number;
  attributeKey: string;
  threshold: string;
  /** Enriched from on-chain (optional, added after query) */
  onChainTimestamp?: number;
  onChainCircuitId?: number;
  confirmed?: boolean;
}

function loadFromStorage(): StoredVerification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredVerification[];
  } catch {
    return [];
  }
}

function saveToStorage(verifications: StoredVerification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(verifications));
}

export function useVerifications() {
  const [verifications, setVerifications] = useState<StoredVerification[]>([]);
  const [loading, setLoading] = useState(true);

  const enrichWithOnChain = useCallback(
    async (items: StoredVerification[]): Promise<StoredVerification[]> => {
      const enriched = await Promise.all(
        items.map(async (v) => {
          try {
            const record = await getVerificationRecord(v.nullifier);
            if (record.exists) {
              return {
                ...v,
                onChainTimestamp: record.timestamp,
                onChainCircuitId: record.circuitId,
                confirmed: true,
              };
            }
            // Record not found on-chain -- mark as not confirmed
            return { ...v, confirmed: false };
          } catch {
            // On-chain query failed -- leave confirmation status undefined
            return v;
          }
        }),
      );
      return enriched;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = loadFromStorage();
      if (!cancelled) {
        setVerifications(stored);
        setLoading(false);
      }

      // Enrich with on-chain data (non-blocking)
      if (stored.length > 0) {
        try {
          const enriched = await enrichWithOnChain(stored);
          if (!cancelled) {
            setVerifications(enriched);
            saveToStorage(enriched);
          }
        } catch {
          // Enrichment failed silently -- local data still shows
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [enrichWithOnChain]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setVerifications([]);
  }, []);

  return {
    verifications,
    loading,
    clearHistory,
  };
}
