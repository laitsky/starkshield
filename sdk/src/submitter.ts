/**
 * StarkShield SDK Proof Submission Module
 *
 * Bridges bb.js ProofData to garaga calldata to starknet.js transaction.
 * This is the critical "write path" -- browser proof -> on-chain verification.
 */

import { init as initGaraga, getZKHonkCallData } from 'garaga';
import { WalletAccount } from 'starknet';
import {
  REGISTRY_ADDRESS,
  CIRCUIT_IDS,
  SEPOLIA_CHAIN_ID,
  VK_PATHS,
  isSepoliaChainId,
  resolvePublicAsset,
} from './config';
import { getWalletExtensionChainId } from './wallet';
import type { ProofResult, CircuitType, SubmitResult, CalldataResult } from './types';

let garagaInitialized = false;

/**
 * Ensure garaga WASM is initialized (idempotent).
 */
async function ensureGaragaInit(): Promise<void> {
  if (garagaInitialized) return;
  await initGaraga();
  garagaInitialized = true;
}

/**
 * Convert publicInputs from string[] (hex field elements) to Uint8Array.
 *
 * Each public input is a 32-byte hex string (0x-prefixed).
 * This function converts them to a flat Uint8Array (N * 32 bytes).
 *
 * NOTE: flattenFieldsAsArray is NOT re-exported from @aztec/bb.js top-level
 * (only deflattenFields is). This is a 3-line reimplementation per research.
 */
function flattenPublicInputs(publicInputs: string[]): Uint8Array {
  const result = new Uint8Array(publicInputs.length * 32);
  for (let i = 0; i < publicInputs.length; i++) {
    const hex = publicInputs[i].replace('0x', '').padStart(64, '0');
    for (let j = 0; j < 32; j++) {
      result[i * 32 + j] = parseInt(hex.substring(j * 2, j * 2 + 2), 16);
    }
  }
  return result;
}

/**
 * Generate garaga calldata from a browser-generated proof.
 *
 * Flow: init garaga WASM -> flatten public inputs -> fetch VK -> getZKHonkCallData
 *
 * @param proofResult - ProofResult from generateAgeProof or generateMembershipProof
 * @param circuitType - Which circuit the proof was generated for
 * @returns CalldataResult with bigint[] calldata ready for transaction submission
 */
export async function generateCalldata(
  proofResult: ProofResult,
  circuitType: CircuitType,
): Promise<CalldataResult> {
  await ensureGaragaInit();

  // Step 1: proof bytes are already Uint8Array from bb.js
  const proofBytes = proofResult.proof;

  // Step 2: Convert publicInputs from string[] (hex) to Uint8Array
  const publicInputsBytes = flattenPublicInputs(proofResult.publicInputs);

  // Step 3: Load VK bytes (static asset served by Vite from public/vk/)
  const vkPath = VK_PATHS[circuitType];
  const vkResponse = await fetch(resolvePublicAsset(vkPath));
  if (!vkResponse.ok) {
    throw new Error(`Failed to load VK file from ${vkPath}: ${vkResponse.status}`);
  }
  const vkBytes = new Uint8Array(await vkResponse.arrayBuffer());

  // Step 4: Generate calldata via garaga WASM
  const calldata: bigint[] = getZKHonkCallData(proofBytes, publicInputsBytes, vkBytes);

  return { calldata, circuitType };
}

/**
 * Submit a proof to StarkShieldRegistry on-chain.
 *
 * Formats calldata for verify_and_register(circuit_id: u8, full_proof_with_hints: Span<felt252>)
 * and submits via the connected wallet.
 *
 * @param walletAccount - Connected WalletAccount from connectWallet()
 * @param calldataResult - CalldataResult from generateCalldata()
 * @returns SubmitResult with transaction hash
 */
export async function submitProof(
  walletAccount: WalletAccount,
  calldataResult: CalldataResult,
): Promise<SubmitResult> {
  const walletChainId = await getWalletExtensionChainId(walletAccount);
  if (walletChainId && !isSepoliaChainId(walletChainId)) {
    throw new Error(
      `Wrong wallet network: extension is on ${walletChainId}. Please switch ArgentX/Braavos to Starknet Sepolia (${SEPOLIA_CHAIN_ID}) before submitting.`,
    );
  }

  const chainId = await walletAccount.getChainId();
  if (!isSepoliaChainId(chainId)) {
    throw new Error(
      `Wrong network: connected to ${chainId}. Please switch wallet to Starknet Sepolia (${SEPOLIA_CHAIN_ID}) before submitting.`,
    );
  }

  const circuitId = CIRCUIT_IDS[calldataResult.circuitType];
  const { calldata } = calldataResult;

  // garaga.getZKHonkCallData() returns *full* verifier calldata, already encoded
  // as Span<felt252>: [len, ...full_proof_with_hints].
  // Do not prepend another length here, or verifier deserialization will fail.
  const looksLikePrefixedSpan =
    calldata.length > 0 && calldata[0] === BigInt(calldata.length - 1);
  const proofSpan: bigint[] = looksLikePrefixedSpan
    ? calldata
    : [BigInt(calldata.length), ...calldata];

  // verify_and_register(circuit_id: u8, full_proof_with_hints: Span<felt252>)
  const txCalldata: string[] = [
    circuitId.toString(),
    ...proofSpan.map((v) => '0x' + v.toString(16)),
  ];

  const result = await walletAccount.execute({
    contractAddress: REGISTRY_ADDRESS,
    entrypoint: 'verify_and_register',
    calldata: txCalldata,
  });

  // Wait for transaction acceptance (throws on rejection)
  await walletAccount.waitForTransaction(result.transaction_hash);

  return {
    transactionHash: result.transaction_hash,
    circuitId,
    success: true,
  };
}
