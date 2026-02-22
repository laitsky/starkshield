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

function parseFelt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Unexpected felt value type: ${typeof value}`);
}

function parseU256(value: unknown): bigint {
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string') {
    return parseFelt(value);
  }

  if (Array.isArray(value) && value.length >= 2) {
    const low = parseFelt(value[0]);
    const high = parseFelt(value[1]);
    return low + (high << 128n);
  }

  if (value && typeof value === 'object') {
    const maybe = value as Record<string, unknown>;
    if ('low' in maybe && 'high' in maybe) {
      const low = parseFelt(maybe.low);
      const high = parseFelt(maybe.high);
      return low + (high << 128n);
    }
  }

  throw new Error('Unexpected u256 response format');
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value !== 0n;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return BigInt(value) !== 0n;

  if (Array.isArray(value) && value.length > 0) {
    return parseBool(value[0]);
  }

  if (value && typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    if (entries.length === 1) {
      return parseBool(entries[0]);
    }
  }

  throw new Error('Unexpected boolean response format');
}

function parseNumberish(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(BigInt(value));
  throw new Error(`Unexpected numeric value type: ${typeof value}`);
}

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
  return parseBool(result);
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
    nullifier: parseU256(record.nullifier),
    attributeKey: parseU256(record.attribute_key),
    thresholdOrSetHash: parseU256(record.threshold_or_set_hash),
    timestamp: parseNumberish(record.timestamp),
    circuitId: parseNumberish(record.circuit_id),
  };
}
