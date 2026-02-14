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

// Types
export type {
  CredentialJSON,
  CircuitType,
  ProofResult,
  AgeProofParams,
  MembershipProofParams,
  ValidationResult,
} from './types';
