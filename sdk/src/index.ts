/**
 * StarkShield Proof Engine SDK
 *
 * Public API for client-side ZK proof generation.
 * Supports age_verify and membership_proof circuits.
 */

// WASM initialization
export { initWasm } from './init';

// Credential validation and transformation
export {
  validateAgeCredential,
  validateMembershipCredential,
  credentialToAgeInputs,
  credentialToMembershipInputs,
} from './credentials';

// Proof generation and verification
export {
  generateAgeProof,
  generateMembershipProof,
  verifyProofLocally,
} from './prover';

// Wallet connection
export { connectWallet, disconnectWallet, getWalletAccount } from './wallet';

// Proof submission
export { generateCalldata, submitProof } from './submitter';

// On-chain verification queries
export { isNullifierUsed, getVerificationRecord } from './reader';

// Configuration
export {
  REGISTRY_ADDRESS,
  SEPOLIA_RPC_URL,
  CIRCUIT_IDS,
  VK_PATHS,
} from './config';

// Types
export type {
  CredentialJSON,
  CircuitType,
  ProofResult,
  AgeProofParams,
  MembershipProofParams,
  ValidationResult,
  WalletState,
  SubmitResult,
  CalldataResult,
  VerificationRecord,
} from './types';
