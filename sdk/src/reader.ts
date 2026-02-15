/**
 * StarkShield SDK On-Chain Reader Module
 *
 * Read-only queries against the StarkShieldRegistry contract.
 * Uses RpcProvider (no wallet needed) to check nullifier usage
 * and retrieve full verification records.
 */

import { RpcProvider, Contract } from 'starknet';
import { REGISTRY_ADDRESS, SEPOLIA_RPC_URL } from './config';
import type { VerificationRecord } from './types';

// Minimal ABI for read functions only.
// Full ABI is in contracts/target/dev/contracts_StarkShieldRegistry.contract_class.json.
// We inline only the functions we call to avoid bundling the entire ABI.
const REGISTRY_READ_ABI = [
  {
    type: 'function',
    name: 'is_nullifier_used',
    inputs: [{ name: 'nullifier', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_verification_record',
    inputs: [{ name: 'nullifier', type: 'core::integer::u256' }],
    outputs: [{ type: 'contracts::registry::VerificationRecord' }],
    state_mutability: 'view',
  },
  {
    type: 'struct',
    name: 'contracts::registry::VerificationRecord',
    members: [
      { name: 'nullifier', type: 'core::integer::u256' },
      { name: 'attribute_key', type: 'core::integer::u256' },
      { name: 'threshold_or_set_hash', type: 'core::integer::u256' },
      { name: 'timestamp', type: 'core::integer::u64' },
      { name: 'circuit_id', type: 'core::integer::u8' },
    ],
  },
  {
    type: 'struct',
    name: 'core::integer::u256',
    members: [
      { name: 'low', type: 'core::integer::u128' },
      { name: 'high', type: 'core::integer::u128' },
    ],
  },
];

let cachedContract: Contract | null = null;

/**
 * Get or create a read-only Contract instance for the registry.
 */
function getRegistryContract(): Contract {
  if (cachedContract) return cachedContract;
  const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC_URL });
  cachedContract = new Contract({
    abi: REGISTRY_READ_ABI,
    address: REGISTRY_ADDRESS,
    providerOrAccount: provider,
  });
  return cachedContract;
}

/**
 * Check if a nullifier has been used on-chain.
 *
 * @param nullifier - The nullifier to check (bigint or hex string)
 * @returns true if the nullifier has been used
 */
export async function isNullifierUsed(nullifier: bigint | string): Promise<boolean> {
  const contract = getRegistryContract();
  const result = await contract.is_nullifier_used(nullifier);
  return Boolean(result);
}

/**
 * Get the full verification record for a nullifier.
 *
 * @param nullifier - The nullifier to query (bigint or hex string)
 * @returns VerificationRecord with exists flag and all fields
 */
export async function getVerificationRecord(nullifier: bigint | string): Promise<VerificationRecord> {
  const contract = getRegistryContract();

  // First check if nullifier exists
  const exists = await isNullifierUsed(nullifier);
  if (!exists) {
    return {
      exists: false,
      nullifier: 0n,
      attributeKey: 0n,
      thresholdOrSetHash: 0n,
      timestamp: 0,
      circuitId: 0,
    };
  }

  // Get full record
  const record = await contract.get_verification_record(nullifier);

  return {
    exists: true,
    nullifier: BigInt(record.nullifier),
    attributeKey: BigInt(record.attribute_key),
    thresholdOrSetHash: BigInt(record.threshold_or_set_hash),
    timestamp: Number(record.timestamp),
    circuitId: Number(record.circuit_id),
  };
}
