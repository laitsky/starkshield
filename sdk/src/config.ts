/**
 * StarkShield SDK Chain Configuration
 *
 * Centralizes contract addresses, RPC URL, chain ID, and circuit mappings.
 * All addresses sourced from deployments.json (Phase 4).
 */

// Contract addresses from deployments.json
export const REGISTRY_ADDRESS =
  '0x06f4c3158eca3a5109e3b08355bd160e621eee291a9860ba716199c5e8f86f94';
export const AGE_VERIFIER_ADDRESS =
  '0x06e318af5da0aecca732fd0192305f4f755582f762186aa2b253e0d43d031023';
export const MEMBERSHIP_VERIFIER_ADDRESS =
  '0x0209c45d1040f0e0c6893ffacc390c2734dd61b03619b50ad9888dbe8311fe17';

// RPC URL -- same endpoint validated in Phase 4
export const SEPOLIA_RPC_URL =
  'https://api.cartridge.gg/x/starknet/sepolia';

// Starknet Sepolia chain ID
export const SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA
const SEPOLIA_CHAIN_ID_ALIAS = 'SN_SEPOLIA';

// Circuit ID mapping (matches registry.cairo constructor: 0=age, 1=membership)
export const CIRCUIT_IDS = {
  age_verify: 0,
  membership_proof: 1,
} as const;

// VK asset paths (served from sdk/public/vk/ by Vite)
export const VK_PATHS = {
  age_verify: 'vk/age_verify.vk',
  membership_proof: 'vk/membership_proof.vk',
} as const;

export function isSepoliaChainId(chainId: string): boolean {
  const normalized = chainId.toLowerCase();
  return (
    normalized === SEPOLIA_CHAIN_ID.toLowerCase() ||
    normalized === SEPOLIA_CHAIN_ID_ALIAS.toLowerCase()
  );
}

export function resolvePublicAsset(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}${normalizedPath}`;
}
