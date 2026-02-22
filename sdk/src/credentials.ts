/**
 * Credential Loading, Validation, and Witness Input Transformation
 *
 * Validates credential JSON files and transforms them into circuit-compatible
 * InputMap format for noir_js witness execution.
 */

import type { InputMap } from '@noir-lang/noir_js';
import type {
  CredentialJSON,
  ValidationResult,
  AgeProofParams,
  MembershipProofParams,
} from './types';

const REQUIRED_FIELDS = [
  'subject_id',
  'issuer_id',
  'credential_type',
  'attribute_key',
  'attribute_value',
  'issued_at',
  'expires_at',
  'secret_salt',
  'signature',
  'issuer_pub_key_x',
  'issuer_pub_key_y',
] as const;

const HEX_FIELDS = [
  'subject_id',
  'issuer_id',
  'credential_type',
  'attribute_key',
  'attribute_value',
  'issued_at',
  'expires_at',
  'secret_salt',
  'issuer_pub_key_x',
  'issuer_pub_key_y',
] as const;

function validateSignature(signature: unknown, errors: string[]): void {
  if (signature === undefined || signature === null) {
    errors.push('Signature is required');
    return;
  }
  if (!Array.isArray(signature)) {
    errors.push('Signature must be an array');
    return;
  }
  if (signature.length !== 64) {
    errors.push(`Signature must be 64 bytes, got ${signature.length}`);
  }

  for (let i = 0; i < signature.length; i++) {
    const value = signature[i];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 255
    ) {
      errors.push(`Signature byte ${i} out of range: ${String(value)}`);
    }
  }
}

function validateHexFields(cred: CredentialJSON, errors: string[]): void {
  for (const field of HEX_FIELDS) {
    const val = cred[field as keyof CredentialJSON] as unknown;
    if (typeof val !== 'string') continue;

    if (!val.startsWith('0x')) {
      errors.push(`${field} must start with 0x, got: ${val.substring(0, 10)}`);
      continue;
    }

    try {
      BigInt(val);
    } catch {
      errors.push(`${field} is not valid hex: ${val}`);
    }
  }
}

function parseCredentialField(
  cred: CredentialJSON,
  field: keyof CredentialJSON,
): bigint | null {
  const raw = cred[field] as unknown;
  if (typeof raw !== 'string' || raw.length === 0) return null;

  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function validateCommonCredential(
  cred: CredentialJSON,
  errors: string[],
): void {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in cred) || cred[field as keyof CredentialJSON] === undefined) {
      errors.push(`Missing field: ${field}`);
    }
  }

  validateSignature(cred.signature, errors);
  validateHexFields(cred, errors);
}

/**
 * Validate a credential JSON for age verification circuit compatibility.
 * Checks all required fields, signature format, hex prefixes, and credential_type = 0.
 */
export function validateAgeCredential(cred: CredentialJSON): ValidationResult {
  const errors: string[] = [];
  validateCommonCredential(cred, errors);

  const credentialType = parseCredentialField(cred, 'credential_type');
  if (credentialType === null) {
    errors.push(`Invalid credential_type format: ${cred.credential_type}`);
  } else if (credentialType !== 0n) {
    errors.push(`Expected credential_type 0 (age), got ${cred.credential_type}`);
  }

  const attributeKey = parseCredentialField(cred, 'attribute_key');
  if (attributeKey === null) {
    errors.push(`Invalid attribute_key format: ${cred.attribute_key}`);
  } else if (attributeKey !== 1n) {
    errors.push(`Expected attribute_key 1 (age), got ${cred.attribute_key}`);
  }

  const issuerId = parseCredentialField(cred, 'issuer_id');
  const issuerPubKeyX = parseCredentialField(cred, 'issuer_pub_key_x');
  if (issuerId !== null && issuerPubKeyX !== null && issuerId !== issuerPubKeyX) {
    errors.push('issuer_id must match issuer_pub_key_x');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a credential JSON for membership proof circuit compatibility.
 * Same as age validation but credential_type must be 1 (membership type).
 */
export function validateMembershipCredential(
  cred: CredentialJSON,
): ValidationResult {
  const errors: string[] = [];
  validateCommonCredential(cred, errors);

  const credentialType = parseCredentialField(cred, 'credential_type');
  if (credentialType === null) {
    errors.push(`Invalid credential_type format: ${cred.credential_type}`);
  } else if (credentialType !== 1n) {
    errors.push(
      `Expected credential_type 1 (membership), got ${cred.credential_type}`,
    );
  }

  const attributeKey = parseCredentialField(cred, 'attribute_key');
  if (attributeKey === null) {
    errors.push(`Invalid attribute_key format: ${cred.attribute_key}`);
  } else if (attributeKey !== 2n) {
    errors.push(
      `Expected attribute_key 2 (membership), got ${cred.attribute_key}`,
    );
  }

  const issuerId = parseCredentialField(cred, 'issuer_id');
  const issuerPubKeyX = parseCredentialField(cred, 'issuer_pub_key_x');
  if (issuerId !== null && issuerPubKeyX !== null && issuerId !== issuerPubKeyX) {
    errors.push('issuer_id must match issuer_pub_key_x');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Transform a credential JSON + age proof params into circuit-compatible InputMap.
 *
 * Maps:
 * - 8 private credential fields directly (hex strings pass through)
 * - signature as string array (noir_js needs string values, not numbers)
 * - Public inputs: pub_key_x, pub_key_y, current_timestamp, threshold, dapp_context_id
 */
export function credentialToAgeInputs(
  cred: CredentialJSON,
  params: AgeProofParams,
): InputMap {
  const currentTimestamp =
    params.currentTimestamp ?? Math.floor(Date.now() / 1000);

  return {
    // Private witness inputs
    subject_id: cred.subject_id,
    issuer_id: cred.issuer_id,
    credential_type: cred.credential_type,
    attribute_key: cred.attribute_key,
    attribute_value: cred.attribute_value,
    issued_at: cred.issued_at,
    expires_at: cred.expires_at,
    secret_salt: cred.secret_salt,
    // CRITICAL: signature must be mapped as strings -- noir_js needs string values, not numbers
    signature: cred.signature.map((b) => b.toString()),
    // Public inputs
    pub_key_x: cred.issuer_pub_key_x,
    pub_key_y: cred.issuer_pub_key_y,
    current_timestamp: '0x' + currentTimestamp.toString(16),
    threshold: '0x' + params.threshold.toString(16),
    dapp_context_id: '0x' + params.dappContextId.toString(16),
  };
}

/**
 * Transform a credential JSON + membership proof params into circuit-compatible InputMap.
 *
 * Maps:
 * - 8 private credential fields directly (hex strings pass through)
 * - signature as string array
 * - Public inputs: pub_key_x, pub_key_y, current_timestamp, dapp_context_id, allowed_set
 * - allowed_set padded to exactly 8 elements with '0x0'
 */
export function credentialToMembershipInputs(
  cred: CredentialJSON,
  params: MembershipProofParams,
): InputMap {
  // Pad allowed_set to exactly 8 elements
  if (params.allowedSet.length > 8) {
    throw new Error(
      `allowed_set has ${params.allowedSet.length} elements, max 8`,
    );
  }
  const paddedSet = [...params.allowedSet];
  while (paddedSet.length < 8) {
    paddedSet.push('0x0');
  }

  const currentTimestamp =
    params.currentTimestamp ?? Math.floor(Date.now() / 1000);

  return {
    // Private witness inputs
    subject_id: cred.subject_id,
    issuer_id: cred.issuer_id,
    credential_type: cred.credential_type,
    attribute_key: cred.attribute_key,
    attribute_value: cred.attribute_value,
    issued_at: cred.issued_at,
    expires_at: cred.expires_at,
    secret_salt: cred.secret_salt,
    // CRITICAL: signature must be mapped as strings
    signature: cred.signature.map((b) => b.toString()),
    // Public inputs
    pub_key_x: cred.issuer_pub_key_x,
    pub_key_y: cred.issuer_pub_key_y,
    current_timestamp: '0x' + currentTimestamp.toString(16),
    dapp_context_id: '0x' + params.dappContextId.toString(16),
    allowed_set: paddedSet,
  };
}
