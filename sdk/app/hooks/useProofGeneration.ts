import { useState, useCallback, useMemo } from 'react';
import {
  initWasm,
  generateAgeProof,
  generateMembershipProof,
  generateCalldata,
  submitProof,
} from '../../src/index';
import type {
  ProofResult,
  CalldataResult,
  SubmitResult,
  CredentialJSON,
  CircuitType,
  AgeProofParams,
  MembershipProofParams,
} from '../../src/index';
import type { WalletAccount } from 'starknet';

export type ProofStep =
  | 'idle'
  | 'initializing'
  | 'generating'
  | 'calldata'
  | 'previewing'
  | 'submitting'
  | 'complete'
  | 'error';

interface ProofState {
  step: ProofStep;
  proofResult: ProofResult | null;
  calldataResult: CalldataResult | null;
  submitResult: SubmitResult | null;
  error: string | null;
}

const INITIAL_STATE: ProofState = {
  step: 'idle',
  proofResult: null,
  calldataResult: null,
  submitResult: null,
  error: null,
};

/**
 * Public output structures parsed from proof public inputs.
 *
 * Age verify (9 public inputs):
 *   [0] threshold, [1] dappContextId, [2] currentTimestamp,
 *   [3] issuerPubKeyX, [4] issuerPubKeyY, [5] nullifier,
 *   [6] echoedAttributeKey, [7] echoedThreshold, [8] echoedIssuerX
 *
 * Membership proof (16 public inputs):
 *   [0] dappContextId, [1] currentTimestamp,
 *   [2] issuerPubKeyX, [3] issuerPubKeyY, [4..11] allowedSet,
 *   [12] nullifier, [13] echoedAttributeKey, [14] setHash, [15] echoedIssuerX
 */
interface AgePublicOutputs {
  circuitType: 'age_verify';
  threshold: string;
  dappContextId: string;
  currentTimestamp: string;
  issuerPubKeyX: string;
  issuerPubKeyY: string;
  nullifier: string;
  echoedAttributeKey: string;
  echoedThreshold: string;
  echoedIssuerX: string;
}

interface MembershipPublicOutputs {
  circuitType: 'membership_proof';
  dappContextId: string;
  currentTimestamp: string;
  issuerPubKeyX: string;
  issuerPubKeyY: string;
  allowedSet: string[];
  nullifier: string;
  echoedAttributeKey: string;
  setHash: string;
  echoedIssuerX: string;
}

export type PublicOutputs = AgePublicOutputs | MembershipPublicOutputs | null;

function parsePublicOutputs(
  publicInputs: string[] | undefined,
  circuitType: CircuitType | undefined,
): PublicOutputs {
  if (!publicInputs || !circuitType) return null;

  if (circuitType === 'age_verify' && publicInputs.length >= 9) {
    return {
      circuitType: 'age_verify',
      threshold: publicInputs[0],
      dappContextId: publicInputs[1],
      currentTimestamp: publicInputs[2],
      issuerPubKeyX: publicInputs[3],
      issuerPubKeyY: publicInputs[4],
      nullifier: publicInputs[5],
      echoedAttributeKey: publicInputs[6],
      echoedThreshold: publicInputs[7],
      echoedIssuerX: publicInputs[8],
    };
  }

  if (circuitType === 'membership_proof' && publicInputs.length >= 16) {
    return {
      circuitType: 'membership_proof',
      dappContextId: publicInputs[0],
      currentTimestamp: publicInputs[1],
      issuerPubKeyX: publicInputs[2],
      issuerPubKeyY: publicInputs[3],
      allowedSet: publicInputs.slice(4, 12),
      nullifier: publicInputs[12],
      echoedAttributeKey: publicInputs[13],
      setHash: publicInputs[14],
      echoedIssuerX: publicInputs[15],
    };
  }

  return null;
}

/**
 * Hook managing the full proof generation lifecycle:
 * idle -> initializing -> generating -> calldata -> previewing -> submitting -> complete
 *
 * Exposes three async functions (generateProof, prepareCalldata, submitOnChain)
 * and a reset function.
 */
export function useProofGeneration() {
  const [state, setState] = useState<ProofState>(INITIAL_STATE);
  const [circuitType, setCircuitType] = useState<CircuitType | undefined>();

  const generateProof = useCallback(
    async (
      credential: CredentialJSON,
      ct: CircuitType,
      params: AgeProofParams | MembershipProofParams,
    ): Promise<ProofResult | null> => {
      try {
        setCircuitType(ct);
        setState((s) => ({ ...s, step: 'initializing', error: null }));
        await initWasm();

        setState((s) => ({ ...s, step: 'generating' }));

        let proofResult: ProofResult;
        if (ct === 'age_verify') {
          proofResult = await generateAgeProof(
            credential,
            params as AgeProofParams,
          );
        } else {
          proofResult = await generateMembershipProof(
            credential,
            params as MembershipProofParams,
          );
        }

        setState((s) => ({ ...s, step: 'idle', proofResult }));
        return proofResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, step: 'error', error: message }));
        return null;
      }
    },
    [],
  );

  const prepareCalldata = useCallback(
    async (
      proofResult: ProofResult,
      ct: CircuitType,
    ): Promise<CalldataResult | null> => {
      try {
        setState((s) => ({ ...s, step: 'calldata' }));
        const calldataResult = await generateCalldata(proofResult, ct);
        setState((s) => ({ ...s, step: 'previewing', calldataResult }));
        return calldataResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, step: 'error', error: message }));
        return null;
      }
    },
    [],
  );

  const submitOnChain = useCallback(
    async (
      walletAccount: WalletAccount,
      calldataResult: CalldataResult,
    ): Promise<SubmitResult | null> => {
      try {
        setState((s) => ({ ...s, step: 'submitting' }));
        const submitResult = await submitProof(walletAccount, calldataResult);
        setState((s) => ({ ...s, step: 'complete', submitResult }));
        return submitResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, step: 'error', error: message }));
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setCircuitType(undefined);
  }, []);

  const publicOutputs = useMemo(
    () =>
      parsePublicOutputs(
        state.proofResult?.publicInputs,
        circuitType,
      ),
    [state.proofResult, circuitType],
  );

  return {
    ...state,
    circuitType,
    publicOutputs,
    generateProof,
    prepareCalldata,
    submitOnChain,
    reset,
  };
}
