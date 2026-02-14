/**
 * Proof Generation Engine
 *
 * Generates ZK proofs for age_verify and membership_proof circuits using
 * noir_js for witness execution and bb.js UltraHonkBackend for proof generation.
 */

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import ageCircuit from './circuits/age_verify.json';
import membershipCircuit from './circuits/membership_proof.json';
import { initWasm } from './init';
import { credentialToAgeInputs, credentialToMembershipInputs } from './credentials';
import type {
  CredentialJSON,
  AgeProofParams,
  MembershipProofParams,
  ProofResult,
  CircuitType,
} from './types';

/**
 * Generate a ZK proof for age verification.
 *
 * Flow: initWasm -> build inputs -> execute witness -> generate proof -> cleanup
 *
 * @param credential - Raw credential JSON from issuer
 * @param params - Age proof parameters (threshold, dappContextId, optional timestamp)
 * @returns ProofResult with proof bytes, public inputs, and proving time in ms
 */
export async function generateAgeProof(
  credential: CredentialJSON,
  params: AgeProofParams,
): Promise<ProofResult> {
  try {
    // Ensure WASM is loaded before any noir_js operations
    await initWasm();

    const inputs = credentialToAgeInputs(credential, params);

    // Execute circuit to get compressed witness
    const noir = new Noir(ageCircuit as any);
    const { witness } = await noir.execute(inputs);

    // Generate proof with keccak hash (Garaga compatibility)
    // NOTE: Use { keccak: true } per Phase 4 CLI validation.
    // If on-chain verification fails later (Phase 6), switch to { keccakZK: true }.
    const backend = new UltraHonkBackend(ageCircuit.bytecode);
    const startTime = performance.now();
    const proof = await backend.generateProof(witness, { keccak: true });
    const provingTimeMs = performance.now() - startTime;

    // Cleanup WASM resources
    await backend.destroy();

    return {
      proof: proof.proof,
      publicInputs: proof.publicInputs,
      provingTimeMs,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`Age proof generation failed: ${message}`);
  }
}

/**
 * Generate a ZK proof for membership verification.
 *
 * @param credential - Raw credential JSON from issuer
 * @param params - Membership proof parameters (allowedSet, dappContextId, optional timestamp)
 * @returns ProofResult with proof bytes, public inputs, and proving time in ms
 */
export async function generateMembershipProof(
  credential: CredentialJSON,
  params: MembershipProofParams,
): Promise<ProofResult> {
  try {
    await initWasm();

    const inputs = credentialToMembershipInputs(credential, params);

    const noir = new Noir(membershipCircuit as any);
    const { witness } = await noir.execute(inputs);

    const backend = new UltraHonkBackend(membershipCircuit.bytecode);
    const startTime = performance.now();
    const proof = await backend.generateProof(witness, { keccak: true });
    const provingTimeMs = performance.now() - startTime;

    await backend.destroy();

    return {
      proof: proof.proof,
      publicInputs: proof.publicInputs,
      provingTimeMs,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`Membership proof generation failed: ${message}`);
  }
}

/**
 * Verify a proof locally using bb.js UltraHonkBackend.
 *
 * This is an optional sanity check -- the authoritative verification
 * happens on-chain via the Garaga verifier contracts.
 *
 * @param circuitType - Which circuit the proof was generated for
 * @param proofData - The proof result to verify
 * @returns true if the proof is valid
 */
export async function verifyProofLocally(
  circuitType: CircuitType,
  proofData: ProofResult,
): Promise<boolean> {
  try {
    await initWasm();

    const circuit =
      circuitType === 'age_verify' ? ageCircuit : membershipCircuit;
    const backend = new UltraHonkBackend(circuit.bytecode);
    const isValid = await backend.verifyProof(
      { proof: proofData.proof, publicInputs: proofData.publicInputs },
      { keccak: true },
    );
    await backend.destroy();
    return isValid;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`Proof verification failed: ${message}`);
  }
}
