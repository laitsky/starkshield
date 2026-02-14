/**
 * StarkShield Demo Credential Issuer
 *
 * Generates Poseidon2-Schnorr signed credentials compatible with Noir circuits.
 * The issuer generates a Schnorr keypair on the Grumpkin curve, defines credential
 * fields, hashes them with Poseidon2, signs the hash, and outputs a JSON file
 * that can be used as witness data for circuit proving.
 *
 * Usage:
 *   npx tsx issuer.ts                    # Generate age verification credential (age=25, valid expiry)
 *   npx tsx issuer.ts --type membership  # Generate membership credential
 *   npx tsx issuer.ts --expired          # Generate expired credential (age=25, expired yesterday)
 *   npx tsx issuer.ts --young            # Generate young credential (age=15, valid expiry)
 */

import { Barretenberg, Fr } from '@aztec/bb.js';
import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

// Credential types
const CREDENTIAL_TYPE_AGE = 0n;
const CREDENTIAL_TYPE_MEMBERSHIP = 1n;

// Attribute keys
const ATTR_KEY_AGE = 1n;
const ATTR_KEY_MEMBERSHIP_GROUP = 2n;

interface CredentialOutput {
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
  credential_hash: string;
  nullifier: string;
  dapp_context_id: string;
}

async function main() {
  const isMembership = process.argv.includes('--type') &&
    process.argv[process.argv.indexOf('--type') + 1] === 'membership';
  const isExpired = process.argv.includes('--expired');
  const isYoung = process.argv.includes('--young');

  const typeLabel = isMembership ? 'membership' : 'age verification';
  const modifiers = [
    isExpired ? 'expired' : '',
    isYoung ? 'young (age=15)' : '',
  ].filter(Boolean).join(', ');
  console.log(`Generating ${typeLabel} credential${modifiers ? ` (${modifiers})` : ''}...`);

  // Initialize Barretenberg
  const bb = await Barretenberg.new({ threads: 1 });

  try {
    // Generate Schnorr keypair on Grumpkin curve
    // The private key is an Fr element (BN254 scalar field)
    const privateKeyBytes = randomBytes(32);
    // Ensure the private key is a valid scalar (non-zero, less than field modulus)
    privateKeyBytes[0] = privateKeyBytes[0]! & 0x0f; // Ensure top bits are clear for valid scalar
    const privateKey = new Fr(privateKeyBytes);
    const publicKey = await bb.schnorrComputePublicKey(privateKey);

    console.log(`Issuer public key: (${publicKey.x.toString()}, ${publicKey.y.toString()})`);

    // Generate random subject_id and secret_salt
    const subjectId = Fr.random();
    const secretSalt = Fr.random();

    // Set credential fields based on type
    const now = BigInt(Math.floor(Date.now() / 1000));
    const oneYearFromNow = now + 86400n * 365n;

    // --expired: set expires_at to yesterday instead of +1 year
    const expiresAt = isExpired ? (now - 86400n) : oneYearFromNow;

    let credentialType: bigint;
    let attributeKey: bigint;
    let attributeValue: bigint;

    if (isMembership) {
      credentialType = CREDENTIAL_TYPE_MEMBERSHIP;
      attributeKey = ATTR_KEY_MEMBERSHIP_GROUP;
      attributeValue = 100n; // membership group ID = 100
    } else {
      credentialType = CREDENTIAL_TYPE_AGE;
      attributeKey = ATTR_KEY_AGE;
      // --young: set age to 15 instead of 25
      attributeValue = isYoung ? 15n : 25n;
    }

    // Use the public key x-coordinate as issuer_id (deterministic, on-chain verifiable)
    const issuerId = publicKey.x;

    const credentialTypeFr = new Fr(credentialType);
    const attributeKeyFr = new Fr(attributeKey);
    const attributeValueFr = new Fr(attributeValue);
    const issuedAtFr = new Fr(now);
    const expiresAtFr = new Fr(expiresAt);

    // Hash credential fields with Poseidon2
    // CRITICAL: This hash MUST match what the Noir circuit computes via Poseidon2::hash(fields, 8)
    const credentialFields = [
      subjectId,
      issuerId,
      credentialTypeFr,
      attributeKeyFr,
      attributeValueFr,
      issuedAtFr,
      expiresAtFr,
      secretSalt,
    ];

    const credentialHash = await bb.poseidon2Hash(credentialFields);
    console.log(`Credential hash: ${credentialHash.toString()}`);

    // Sign the credential hash with Schnorr
    // The message for signing is the credential hash as 32 big-endian bytes
    const messageBytes = credentialHash.toBuffer();
    const [sigS, sigE] = await bb.schnorrConstructSignature(messageBytes, privateKey);

    // Verify the signature locally to ensure correctness
    const verified = await bb.schnorrVerifySignature(messageBytes, publicKey, sigS, sigE);
    if (!verified) {
      throw new Error('Signature verification failed locally -- this should not happen');
    }
    console.log('Signature verified locally: OK');

    // Combine sigS + sigE into a single 64-byte array matching Noir's [u8; 64]
    // Noir schnorr expects: bytes 0-31 = s, bytes 32-63 = e
    const sigSBytes = sigS.toBuffer();
    const sigEBytes = sigE.toBuffer();
    const signatureBytes: number[] = [];
    for (let i = 0; i < 32; i++) {
      signatureBytes.push(sigSBytes[i]!);
    }
    for (let i = 0; i < 32; i++) {
      signatureBytes.push(sigEBytes[i]!);
    }

    // Compute nullifier for a test dApp context
    const dappContextId = new Fr(42n); // test dApp ID
    const nullifier = await bb.poseidon2Hash([secretSalt, credentialHash, dappContextId]);
    console.log(`Nullifier (dApp 42): ${nullifier.toString()}`);

    // Build output credential JSON
    const credential: CredentialOutput = {
      subject_id: subjectId.toString(),
      issuer_id: issuerId.toString(),
      credential_type: credentialTypeFr.toString(),
      attribute_key: attributeKeyFr.toString(),
      attribute_value: attributeValueFr.toString(),
      issued_at: issuedAtFr.toString(),
      expires_at: expiresAtFr.toString(),
      secret_salt: secretSalt.toString(),
      signature: signatureBytes,
      issuer_pub_key_x: publicKey.x.toString(),
      issuer_pub_key_y: publicKey.y.toString(),
      credential_hash: credentialHash.toString(),
      nullifier: nullifier.toString(),
      dapp_context_id: dappContextId.toString(),
    };

    // Write output file
    const filename = isMembership ? 'demo_credential_membership.json' : 'demo_credential.json';
    writeFileSync(filename, JSON.stringify(credential, null, 2));
    console.log(`\nDemo credential written to ${filename}`);

    // Also generate Prover.toml format for Noir circuit
    const proverToml = generateProverToml(credential);
    const proverFilename = isMembership ? 'prover_membership.toml' : 'prover_age.toml';
    writeFileSync(proverFilename, proverToml);
    console.log(`Prover.toml written to ${proverFilename}`);

  } finally {
    await bb.destroy();
  }
}

function generateProverToml(cred: CredentialOutput): string {
  const lines: string[] = [];
  lines.push(`subject_id = "${cred.subject_id}"`);
  lines.push(`issuer_id = "${cred.issuer_id}"`);
  lines.push(`credential_type = "${cred.credential_type}"`);
  lines.push(`attribute_key = "${cred.attribute_key}"`);
  lines.push(`attribute_value = "${cred.attribute_value}"`);
  lines.push(`issued_at = "${cred.issued_at}"`);
  lines.push(`expires_at = "${cred.expires_at}"`);
  lines.push(`secret_salt = "${cred.secret_salt}"`);

  // Format signature as TOML array of strings
  const sigStrs = cred.signature.map(b => `"${b}"`);
  lines.push(`signature = [${sigStrs.join(', ')}]`);

  lines.push(`pub_key_x = "${cred.issuer_pub_key_x}"`);
  lines.push(`pub_key_y = "${cred.issuer_pub_key_y}"`);

  // age_verify circuit public inputs
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const tsFr = new Fr(currentTimestamp);
  lines.push(`current_timestamp = "${tsFr.toString()}"`);
  lines.push(`threshold = "0x0000000000000000000000000000000000000000000000000000000000000012"`); // 18
  lines.push(`dapp_context_id = "${cred.dapp_context_id}"`);
  lines.push('');

  return lines.join('\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
