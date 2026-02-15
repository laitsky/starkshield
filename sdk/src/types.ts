/**
 * StarkShield SDK Type Definitions
 *
 * Types for credentials, proof data, and circuit parameters.
 */

/** Raw credential JSON as produced by the issuer */
export interface CredentialJSON {
  subject_id: string;
  issuer_id: string;
  credential_type: string;
  attribute_key: string;
  attribute_value: string;
  issued_at: string;
  expires_at: string;
  secret_salt: string;
  signature: number[];
  issuer_pub_key_x: string;
  issuer_pub_key_y: string;
  /** Reference data -- not used as circuit input */
  credential_hash?: string;
  /** Reference data -- not used as circuit input */
  nullifier?: string;
  /** Reference data -- not used as circuit input */
  dapp_context_id?: string;
}

/** Supported circuit types */
export type CircuitType = 'age_verify' | 'membership_proof';

/** Result from proof generation */
export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
  provingTimeMs: number;
}

/** Parameters for age verification proof */
export interface AgeProofParams {
  threshold: number;
  dappContextId: number;
  currentTimestamp?: number;
}

/** Parameters for membership proof */
export interface MembershipProofParams {
  allowedSet: string[];
  dappContextId: number;
  currentTimestamp?: number;
}

/** Result of credential validation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Connected wallet state */
export interface WalletState {
  address: string;
  chainId: string;
  connected: boolean;
}

/** Result from proof submission to on-chain registry */
export interface SubmitResult {
  transactionHash: string;
  circuitId: number;
  success: boolean;
}

/** Result from calldata generation */
export interface CalldataResult {
  calldata: bigint[];
  circuitType: CircuitType;
}

/** Verification record from on-chain query */
export interface VerificationRecord {
  exists: boolean;
  nullifier: bigint;
  attributeKey: bigint;
  thresholdOrSetHash: bigint;
  timestamp: number;
  circuitId: number;
}
