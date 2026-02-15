/**
 * StarkShield SDK Chain Configuration
 *
 * Centralizes contract addresses, RPC URL, chain ID, and circuit mappings.
 * All addresses sourced from deployments.json (Phase 4).
 */

// Contract addresses from deployments.json
export const REGISTRY_ADDRESS =
  '0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab';
export const AGE_VERIFIER_ADDRESS =
  '0x9afed88f1d6bb0da51d98d29a3aaca31ed7ca99dc51a3df06931c543694f52';
export const MEMBERSHIP_VERIFIER_ADDRESS =
  '0x483b48c3dbd32ebbc45b22a2a419c9a95c3999b103f5eb4a3048a0e8000d1da';

// RPC URL -- same endpoint validated in Phase 4
export const SEPOLIA_RPC_URL =
  'https://free-rpc.nethermind.io/sepolia-juno/v0_8';

// Starknet Sepolia chain ID
export const SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA

// Circuit ID mapping (matches registry.cairo constructor: 0=age, 1=membership)
export const CIRCUIT_IDS = {
  age_verify: 0,
  membership_proof: 1,
} as const;

// VK asset paths (served from sdk/public/vk/ by Vite)
export const VK_PATHS = {
  age_verify: '/vk/age_verify.vk',
  membership_proof: '/vk/membership_proof.vk',
} as const;
