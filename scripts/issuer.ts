/**
 * StarkShield Demo Credential Issuer
 *
 * Generates Poseidon2-Schnorr signed credentials compatible with Noir circuits.
 *
 * Usage:
 *   bunx tsx issuer.ts                                # age credential (default)
 *   bunx tsx issuer.ts --type membership              # membership credential
 *   bunx tsx issuer.ts --expired                      # expired credential
 *   bunx tsx issuer.ts --young                        # age=15 credential
 *   bunx tsx issuer.ts --rotate-key                   # rotate stored issuer key for this type
 *   bunx tsx issuer.ts --issuer-private-key 0xabc...  # use explicit issuer private key
 */

import { Barretenberg, Fr } from '@aztec/bb.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// Credential types
const CREDENTIAL_TYPE_AGE = 0n;
const CREDENTIAL_TYPE_MEMBERSHIP = 1n;

// Attribute keys
const ATTR_KEY_AGE = 1n;
const ATTR_KEY_MEMBERSHIP_GROUP = 2n;

type CredentialMode = 'age' | 'membership';

interface CliOptions {
  mode: CredentialMode;
  expired: boolean;
  young: boolean;
  rotateKey: boolean;
  issuerPrivateKeyHex?: string;
}

interface IssuerKeyStore {
  version: 1;
  keys: Partial<Record<CredentialMode, string>>;
}

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

interface DeploymentsTrustedIssuers {
  age_demo_issuer_pub_key_x?: string;
  membership_demo_issuer_pub_key_x?: string;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const KEY_STORE_PATH = path.join(SCRIPT_DIR, '.issuer_keys.json');
const DEPLOYMENTS_PATH = path.join(SCRIPT_DIR, '..', 'deployments.json');

export function parseCliOptions(argv: string[]): CliOptions {
  const membershipTypeIndex = argv.indexOf('--type');
  const isMembership =
    membershipTypeIndex !== -1 && argv[membershipTypeIndex + 1] === 'membership';

  const issuerPrivateKeyIndex = argv.indexOf('--issuer-private-key');
  const issuerPrivateKeyHex =
    issuerPrivateKeyIndex !== -1
      ? argv[issuerPrivateKeyIndex + 1]
      : undefined;

  return {
    mode: isMembership ? 'membership' : 'age',
    expired: argv.includes('--expired'),
    young: argv.includes('--young'),
    rotateKey: argv.includes('--rotate-key'),
    issuerPrivateKeyHex,
  };
}

function normalizeHex(value: string, label: string): string {
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n) {
      throw new Error(`${label} must be non-zero`);
    }
    const max256 = (1n << 256n) - 1n;
    if (parsed > max256) {
      throw new Error(`${label} must fit in 32 bytes`);
    }
    return `0x${parsed.toString(16).padStart(64, '0')}`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label}: ${detail}`);
  }
}

function compareHex(a: string, b: string): boolean {
  return BigInt(a) === BigInt(b);
}

function randomPrivateKeyHex(): string {
  let bytes = randomBytes(32);
  bytes[0] = bytes[0]! & 0x0f;

  while (bytes.every((byte) => byte === 0)) {
    bytes = randomBytes(32);
    bytes[0] = bytes[0]! & 0x0f;
  }

  return normalizeHex(`0x${bytes.toString('hex')}`, 'issuer private key');
}

function loadKeyStore(): IssuerKeyStore {
  if (!existsSync(KEY_STORE_PATH)) {
    return { version: 1, keys: {} };
  }

  try {
    const raw = readFileSync(KEY_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as IssuerKeyStore;
    if (parsed.version !== 1 || typeof parsed.keys !== 'object') {
      return { version: 1, keys: {} };
    }
    return parsed;
  } catch {
    return { version: 1, keys: {} };
  }
}

function saveKeyStore(store: IssuerKeyStore): void {
  writeFileSync(KEY_STORE_PATH, JSON.stringify(store, null, 2));
}

function resolveIssuerPrivateKey(
  options: CliOptions,
): { privateKeyHex: string; source: 'cli' | 'store' | 'generated' } {
  if (options.issuerPrivateKeyHex) {
    const normalized = normalizeHex(options.issuerPrivateKeyHex, 'issuer private key');
    const store = loadKeyStore();
    store.keys[options.mode] = normalized;
    saveKeyStore(store);
    return { privateKeyHex: normalized, source: 'cli' };
  }

  const store = loadKeyStore();
  if (!options.rotateKey && store.keys[options.mode]) {
    const normalized = normalizeHex(
      store.keys[options.mode]!,
      `${options.mode} issuer private key`,
    );
    return { privateKeyHex: normalized, source: 'store' };
  }

  const generated = randomPrivateKeyHex();
  store.keys[options.mode] = generated;
  saveKeyStore(store);
  return { privateKeyHex: generated, source: 'generated' };
}

function privateKeyBytesFromHex(hex: string): Uint8Array {
  const value = BigInt(hex);
  const bytes = new Uint8Array(32);
  let remaining = value;

  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return bytes;
}

function loadTrustedIssuerPublicKeyX(mode: CredentialMode): string | undefined {
  if (!existsSync(DEPLOYMENTS_PATH)) return undefined;

  try {
    const raw = readFileSync(DEPLOYMENTS_PATH, 'utf-8');
    const deployments = JSON.parse(raw) as { trusted_issuers?: DeploymentsTrustedIssuers };
    if (!deployments.trusted_issuers) return undefined;

    return mode === 'age'
      ? deployments.trusted_issuers.age_demo_issuer_pub_key_x
      : deployments.trusted_issuers.membership_demo_issuer_pub_key_x;
  } catch {
    return undefined;
  }
}

async function main() {
  const options = parseCliOptions(process.argv);
  const isMembership = options.mode === 'membership';

  const typeLabel = isMembership ? 'membership' : 'age verification';
  const modifiers = [
    options.expired ? 'expired' : '',
    options.young ? 'young (age=15)' : '',
  ]
    .filter(Boolean)
    .join(', ');
  console.log(`Generating ${typeLabel} credential${modifiers ? ` (${modifiers})` : ''}...`);

  const keyResolution = resolveIssuerPrivateKey(options);
  const privateKeyHex = keyResolution.privateKeyHex;
  const privateKey = new Fr(privateKeyBytesFromHex(privateKeyHex));

  console.log(
    `Issuer key source: ${keyResolution.source} (${KEY_STORE_PATH})`,
  );

  // Initialize Barretenberg
  const bb = await Barretenberg.new({ threads: 1 });

  try {
    // Generate Schnorr keypair on Grumpkin curve
    const publicKey = await bb.schnorrComputePublicKey(privateKey);
    console.log(`Issuer public key: (${publicKey.x.toString()}, ${publicKey.y.toString()})`);

    const trustedPubKeyX = loadTrustedIssuerPublicKeyX(options.mode);
    if (trustedPubKeyX) {
      const matchesTrusted = compareHex(publicKey.x.toString(), trustedPubKeyX);
      if (matchesTrusted) {
        console.log('Issuer matches deployed trusted demo issuer: YES');
      } else {
        console.warn(
          'WARNING: Issuer key does not match deployed trusted demo issuer. On-chain submission will fail unless the registry owner adds this issuer.',
        );
      }
    }

    // Generate random subject_id and secret_salt
    const subjectId = Fr.random();
    const secretSalt = Fr.random();

    // Set credential fields based on type
    const now = BigInt(Math.floor(Date.now() / 1000));
    const oneYearFromNow = now + 86400n * 365n;
    const expiresAt = options.expired ? now - 86400n : oneYearFromNow;

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
      attributeValue = options.young ? 15n : 25n;
    }

    // Use the public key x-coordinate as issuer_id (deterministic, on-chain verifiable)
    const issuerId = publicKey.x;

    const credentialTypeFr = new Fr(credentialType);
    const attributeKeyFr = new Fr(attributeKey);
    const attributeValueFr = new Fr(attributeValue);
    const issuedAtFr = new Fr(now);
    const expiresAtFr = new Fr(expiresAt);

    // Hash credential fields with Poseidon2
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
    const messageBytes = credentialHash.toBuffer();
    const [sigS, sigE] = await bb.schnorrConstructSignature(messageBytes, privateKey);

    const verified = await bb.schnorrVerifySignature(messageBytes, publicKey, sigS, sigE);
    if (!verified) {
      throw new Error('Signature verification failed locally -- this should not happen');
    }
    console.log('Signature verified locally: OK');

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
    const dappContextId = new Fr(42n);
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
    console.log(`Demo credential written to ${filename}`);

    // Also generate Prover.toml format for Noir circuit
    const proverToml = generateProverToml(credential, isMembership);
    const proverFilename = isMembership ? 'prover_membership.toml' : 'prover_age.toml';
    writeFileSync(proverFilename, proverToml);
    console.log(`Prover.toml written to ${proverFilename}`);
  } finally {
    await bb.destroy();
  }
}

function generateProverToml(cred: CredentialOutput, isMembership: boolean): string {
  const lines: string[] = [];
  lines.push(`subject_id = "${cred.subject_id}"`);
  lines.push(`issuer_id = "${cred.issuer_id}"`);
  lines.push(`credential_type = "${cred.credential_type}"`);
  lines.push(`attribute_key = "${cred.attribute_key}"`);
  lines.push(`attribute_value = "${cred.attribute_value}"`);
  lines.push(`issued_at = "${cred.issued_at}"`);
  lines.push(`expires_at = "${cred.expires_at}"`);
  lines.push(`secret_salt = "${cred.secret_salt}"`);

  const sigStrs = cred.signature.map((b) => `"${b}"`);
  lines.push(`signature = [${sigStrs.join(', ')}]`);

  lines.push(`pub_key_x = "${cred.issuer_pub_key_x}"`);
  lines.push(`pub_key_y = "${cred.issuer_pub_key_y}"`);

  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const tsFr = new Fr(currentTimestamp);
  lines.push(`current_timestamp = "${tsFr.toString()}"`);
  lines.push(`dapp_context_id = "${cred.dapp_context_id}"`);

  if (isMembership) {
    const allowedSet = [
      cred.attribute_value,
      '0x00000000000000000000000000000000000000000000000000000000000000c8',
      '0x000000000000000000000000000000000000000000000000000000000000012c',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    ];
    lines.push(`allowed_set = [${allowedSet.map((v) => `"${v}"`).join(', ')}]`);
  } else {
    lines.push(
      'threshold = "0x0000000000000000000000000000000000000000000000000000000000000012"',
    );
  }

  lines.push('');
  return lines.join('\n');
}

const isMainModule =
  !!process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}
