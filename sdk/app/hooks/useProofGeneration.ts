import { useState, useCallback, useMemo } from 'react';
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

type ProofSdkModule = typeof import('../../src/index');
let proofSdkModule: ProofSdkModule | null = null;

async function loadProofSdk(): Promise<ProofSdkModule> {
  if (proofSdkModule) return proofSdkModule;
  proofSdkModule = await import('../../src/index');
  return proofSdkModule;
}

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
 * Age verify (8 public inputs):
 *   [0] pubKeyX, [1] pubKeyY, [2] currentTimestamp,
 *   [3] threshold, [4] dappContextId, [5] nullifier,
 *   [6] echoedIssuerX, [7] echoedThreshold
 *
 * Membership proof (15 public inputs):
 *   [0] pubKeyX, [1] pubKeyY, [2] currentTimestamp, [3] dappContextId,
 *   [4..11] allowedSet, [12] nullifier, [13] echoedIssuerX, [14] setHash
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

  if (circuitType === 'age_verify' && publicInputs.length >= 8) {
    return {
      circuitType: 'age_verify',
      threshold: publicInputs[3],
      dappContextId: publicInputs[4],
      currentTimestamp: publicInputs[2],
      issuerPubKeyX: publicInputs[0],
      issuerPubKeyY: publicInputs[1],
      nullifier: publicInputs[5],
      echoedAttributeKey: '0x1',
      echoedThreshold: publicInputs[7],
      echoedIssuerX: publicInputs[6],
    };
  }

  if (circuitType === 'membership_proof' && publicInputs.length >= 15) {
    return {
      circuitType: 'membership_proof',
      dappContextId: publicInputs[3],
      currentTimestamp: publicInputs[2],
      issuerPubKeyX: publicInputs[0],
      issuerPubKeyY: publicInputs[1],
      allowedSet: publicInputs.slice(4, 12),
      nullifier: publicInputs[12],
      echoedAttributeKey: '0x2',
      setHash: publicInputs[14],
      echoedIssuerX: publicInputs[13],
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
        const sdk = await loadProofSdk();
        await sdk.initWasm();

        setState((s) => ({ ...s, step: 'generating' }));

        let proofResult: ProofResult;
        if (ct === 'age_verify') {
          proofResult = await sdk.generateAgeProof(
            credential,
            params as AgeProofParams,
          );
        } else {
          proofResult = await sdk.generateMembershipProof(
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
        const sdk = await loadProofSdk();
        const calldataResult = await sdk.generateCalldata(proofResult, ct);
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
        const sdk = await loadProofSdk();
        const submitResult = await sdk.submitProof(walletAccount, calldataResult);
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
