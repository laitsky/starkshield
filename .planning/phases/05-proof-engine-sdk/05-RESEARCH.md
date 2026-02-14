# Phase 5: Proof Engine SDK - Research

**Researched:** 2026-02-14
**Domain:** Browser-side ZK proof generation via noir_js + bb.js WASM, credential loading, witness computation
**Confidence:** HIGH (API types verified from installed packages, version compatibility validated against project artifacts)

## Summary

Phase 5 builds a browser-based proof generation engine that loads credential JSON files, transforms them into circuit-compatible witness inputs, and generates ZK proofs entirely client-side via WASM. The core stack is `@noir-lang/noir_js` for witness execution (ACVM) and `@aztec/bb.js` for proof generation (UltraHonkBackend). The compiled circuit JSON artifacts from Phase 2/3 (`circuits/target/age_verify.json` and `circuits/target/membership_proof.json`) are consumed directly by noir_js.

A critical version decision drives the implementation: the project's circuits are compiled with nargo 1.0.0-beta.16, so noir_js must be 1.0.0-beta.16 to match. For proof generation, bb.js must be 3.0.0-nightly.20251104, which matches the bb CLI version used throughout the project and provides the `{ keccak: true }` option needed for Garaga-compatible proofs. The project's existing bb.js 0.82.3 (used in `scripts/` for the issuer) is a different version line with an incompatible internal API -- the SDK MUST use the 3.0.0-nightly version. The browser environment requires SharedArrayBuffer for multithreaded WASM proving, which demands COOP/COEP headers (`Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`).

The two demo credential JSON files already exist (`scripts/demo_credential.json` and `scripts/demo_credential_membership.json`) with the exact schema matching the circuit ABI parameters. The credential-to-witness transformation is straightforward: map JSON fields to the circuit's `InputMap` format, converting hex strings to Field values and the signature array to `u8[64]`.

**Primary recommendation:** Build the SDK as a TypeScript package (`sdk/`) using Vite for browser bundling. Use noir_js 1.0.0-beta.16 + bb.js 3.0.0-nightly.20251104 + garaga 1.0.1. Structure the SDK with three modules: WASM initialization, credential loading/validation, and proof generation. Test end-to-end with a minimal Vite dev server using the existing demo credential JSON files.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @noir-lang/noir_js | 1.0.0-beta.16 | Witness execution from circuit JSON + inputs | Matches nargo beta.16 used to compile circuits. ACVM interprets compiled ACIR bytecode. |
| @noir-lang/noirc_abi | 1.0.0-beta.16 | ABI encoding for circuit inputs | Required dependency of noir_js. Handles Field/Array/Integer type encoding. |
| @noir-lang/acvm_js | 1.0.0-beta.16 | ACVM WASM module for witness computation | Required dependency of noir_js. Executes ACIR opcodes in browser WASM. |
| @aztec/bb.js | 3.0.0-nightly.20251104 | UltraHonkBackend WASM proof generation | Matches bb CLI version (3.0.0-nightly.20251104). Has `{ keccak: true }` for Garaga-compatible proofs. |
| garaga | 1.0.1 | Calldata generation for on-chain proof submission | Provides `getZKHonkCallData(proof, publicInputs, vk)` to produce Starknet calldata. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite | 6.x | Build tool and dev server for browser testing | Required for WASM module loading, ESNext target, node polyfills |
| vite-plugin-node-polyfills | 0.17.0 | Buffer/global/process polyfills for browser | bb.js needs Buffer and other Node.js globals in browser |
| typescript | 5.x | Type safety for SDK code | SDK is TypeScript-first |
| vitest | latest | Unit testing (Node environment) | Test credential validation, input transformation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bb.js 3.0.0-nightly.20251104 | bb.js 0.82.3 (already in scripts/) | 0.82.3 uses `acirProveUltraKeccakHonk` (old internal API). 3.0.0-nightly uses `circuitProve` (new API) and has `keccakZK` option. Must use 3.0.0-nightly to match bb CLI and guarantee proof compatibility. |
| noir_js 1.0.0-beta.16 | noir_js 1.0.0-beta.15 (tutorial version) | beta.15 is one version behind circuits compiled with nargo beta.16. Minor ACIR format changes (element_type_sizes) between beta.15 and beta.16. Use beta.16 to match nargo version exactly. |
| Vite dev server for testing | Playwright/headless browser | Vite dev server is faster for manual testing. Playwright adds complexity. Use Vite for Phase 5, add Playwright in Phase 7 if needed. |

**Installation:**
```bash
# In sdk/ directory
npm init -y
npm install @noir-lang/noir_js@1.0.0-beta.16 @aztec/bb.js@3.0.0-nightly.20251104 garaga@1.0.1
npm install -D vite@6 vite-plugin-node-polyfills@0.17.0 typescript@5
```

## Architecture Patterns

### Recommended Project Structure
```
sdk/
├── package.json                    # Dependencies: noir_js, bb.js, garaga
├── tsconfig.json                   # ESNext target, strict mode
├── vite.config.ts                  # WASM config, COOP/COEP headers, polyfills
├── src/
│   ├── index.ts                    # Public API exports
│   ├── init.ts                     # WASM initialization (noir_js + bb.js)
│   ├── credentials.ts              # Credential loading, validation, transformation
│   ├── prover.ts                   # Proof generation engine
│   ├── types.ts                    # SDK type definitions
│   └── circuits/                   # Compiled circuit artifacts (copied from circuits/target/)
│       ├── age_verify.json         # Compiled circuit (base64 ACIR bytecode + ABI)
│       └── membership_proof.json   # Compiled circuit (base64 ACIR bytecode + ABI)
├── test/
│   ├── credentials.test.ts         # Credential validation unit tests
│   └── e2e.html                    # Browser test page for end-to-end proving
└── credentials/                    # Demo credential files
    ├── demo_credential.json        # Age verification credential (from scripts/)
    └── demo_credential_membership.json  # Membership credential (from scripts/)
```

### Pattern 1: WASM Initialization Gate
**What:** Initialize all WASM modules (ACVM, noirc_abi) before any proving operations. Gate all SDK methods behind initialization.
**When to use:** Always. WASM modules must be loaded before noir_js can execute circuits.
**Example:**
```typescript
// Source: Noir tutorial https://noir-lang.org/docs/tutorials/noirjs_app/
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';
import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';

let initialized = false;

export async function initWasm(): Promise<void> {
  if (initialized) return;
  await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);
  initialized = true;
}
```

### Pattern 2: Credential-to-Witness Transformation
**What:** Transform a credential JSON file into the `InputMap` format that noir_js `execute()` expects. Maps JSON field names to circuit parameter names with correct type encoding.
**When to use:** Every time a credential is loaded for proof generation.
**Example:**
```typescript
// Source: Verified against circuits/target/age_verify.json ABI parameters
import type { InputMap } from '@noir-lang/noir_js';

interface CredentialJSON {
  subject_id: string;       // hex Field
  issuer_id: string;        // hex Field
  credential_type: string;  // hex Field
  attribute_key: string;    // hex Field
  attribute_value: string;  // hex Field
  issued_at: string;        // hex Field
  expires_at: string;       // hex Field
  secret_salt: string;      // hex Field
  signature: number[];      // u8[64]
  issuer_pub_key_x: string; // hex Field
  issuer_pub_key_y: string; // hex Field
}

function credentialToAgeInputs(
  cred: CredentialJSON,
  threshold: number,
  dappContextId: number,
): InputMap {
  const currentTimestamp = Math.floor(Date.now() / 1000);
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
    signature: cred.signature.map(b => b.toString()),
    // Public inputs
    pub_key_x: cred.issuer_pub_key_x,
    pub_key_y: cred.issuer_pub_key_y,
    current_timestamp: '0x' + currentTimestamp.toString(16),
    threshold: '0x' + threshold.toString(16),
    dapp_context_id: '0x' + dappContextId.toString(16),
  };
}
```

### Pattern 3: Proof Generation Pipeline
**What:** Chain noir_js witness execution with bb.js proof generation. noir_js produces a compressed witness, bb.js generates the proof.
**When to use:** Every proof generation request.
**Example:**
```typescript
// Source: bb.js 3.0.0-nightly.20251104 backend.d.ts + Noir tutorial
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend, type ProofData } from '@aztec/bb.js';
import ageCircuit from './circuits/age_verify.json';

async function generateAgeProof(inputs: InputMap): Promise<ProofData> {
  const noir = new Noir(ageCircuit as any);
  const backend = new UltraHonkBackend(ageCircuit.bytecode);

  // Step 1: Execute circuit to get compressed witness
  const { witness } = await noir.execute(inputs);

  // Step 2: Generate proof with keccak hash (Garaga compatibility)
  const proof = await backend.generateProof(witness, { keccak: true });

  // Step 3: Cleanup
  await backend.destroy();

  return proof; // { proof: Uint8Array, publicInputs: string[] }
}
```

### Pattern 4: Vite Configuration for WASM + COOP/COEP
**What:** Configure Vite to handle bb.js WASM loading, node polyfills, and SharedArrayBuffer headers.
**When to use:** Always for browser-based proof generation.
**Example:**
```typescript
// vite.config.ts
// Source: Noir tutorial + vite-plugin-cross-origin-isolation
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['@aztec/bb.js'],
  },
  build: {
    target: 'esnext', // Required for bb.js top-level await
  },
});
```

### Anti-Patterns to Avoid
- **Using bb.js 0.82.3 for browser proving:** This version has a different internal API (`acirProveUltraKeccakHonk` vs `circuitProve`). It does NOT match the bb CLI version (3.0.0-nightly) used to generate VKs and test proofs. The SDK MUST use bb.js 3.0.0-nightly.20251104.
- **Mixing noir_js versions with nargo versions:** Circuits compiled with nargo beta.16 must use noir_js beta.16. Version mismatches can cause ACIR deserialization failures.
- **Omitting WASM initialization:** Calling `new Noir()` or `noir.execute()` before `initACVM()` and `initNoirC()` causes cryptic WASM errors.
- **Skipping COOP/COEP headers:** bb.js multithreading requires SharedArrayBuffer, which requires cross-origin isolation headers. Without them, bb.js falls back to single-threaded mode (significantly slower).
- **Hardcoding hex field values without 0x prefix:** noir_js InputMap expects hex strings with `0x` prefix for Field types. Omitting the prefix causes silent zero values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ACIR witness computation | Custom witness solver | noir_js `Noir.execute()` | Interprets ACIR opcodes, handles Brillig VM, manages memory correctly |
| ZK proof generation | Custom prover | bb.js `UltraHonkBackend.generateProof()` | WASM compilation of Barretenberg C++ -- cryptographically verified, optimized |
| Proof calldata formatting | Manual felt252 serialization | garaga npm `getZKHonkCallData()` | Handles proof splitting, public input ordering, hint generation for on-chain verifier |
| WASM module loading | Custom WASM loader | Vite WASM URL imports (`?url` suffix) | Handles WASM binary fetching, MIME types, bundling correctly |
| Credential field type encoding | Custom hex-to-field conversion | noir_js InputMap string format | noir_js handles hex string -> Field conversion internally via noirc_abi |
| Base64 ACIR decompression | Custom gunzip + base64 | UltraHonkBackend constructor | Constructor handles base64 decode + gzip decompression of circuit bytecode |

**Key insight:** The proof generation pipeline has exactly three steps (init WASM, execute witness, generate proof), each handled by a purpose-built library. The SDK's value-add is the credential loading/validation layer and the orchestration between these libraries -- NOT reimplementing any cryptographic or circuit execution logic.

## Common Pitfalls

### Pitfall 1: bb.js Version Mismatch with CLI
**What goes wrong:** Using bb.js 0.82.3 (from scripts/) instead of 3.0.0-nightly.20251104 for proof generation. The proof format or internal Honk protocol may differ, causing proofs that verify in bb.js but fail on-chain in the Garaga verifier.
**Why it happens:** The project already has bb.js 0.82.3 installed in scripts/. Developer assumes "same package, different version" is fine.
**How to avoid:** The SDK package (`sdk/package.json`) MUST pin `@aztec/bb.js@3.0.0-nightly.20251104`. Do NOT reuse the scripts/ node_modules.
**Warning signs:** Proof verifies locally (`backend.verifyProof()`) but calldata generation or on-chain verification fails.

### Pitfall 2: noir_js WASM Not Initialized
**What goes wrong:** Calling `new Noir(circuit)` or `noir.execute(inputs)` before the WASM modules are loaded. This causes runtime errors like "wasm not initialized" or "memory access out of bounds".
**Why it happens:** WASM initialization is async and must complete before any noir_js operations. Developers forget the init step or don't await it.
**How to avoid:** Gate all SDK methods behind an `initWasm()` call. Use a module-level boolean flag. Consider lazy initialization in the proof generation function.
**Warning signs:** "RuntimeError: memory access out of bounds", "TypeError: Cannot read properties of undefined".

### Pitfall 3: Missing COOP/COEP Headers for SharedArrayBuffer
**What goes wrong:** bb.js proof generation is extremely slow (~2-5x) because it falls back to single-threaded WASM when SharedArrayBuffer is unavailable.
**Why it happens:** SharedArrayBuffer requires the page to be cross-origin isolated, which requires COOP/COEP headers. Default Vite dev server does not set these.
**How to avoid:** Add custom middleware in vite.config.ts to set `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` headers. For production, configure the hosting server similarly.
**Warning signs:** Proof generation takes >60 seconds for circuits that should prove in <15 seconds. Console message about "SharedArrayBuffer is not defined".

### Pitfall 4: Credential JSON Field Format Mismatch
**What goes wrong:** The credential JSON has hex strings like `"0x0000...0019"` (25 in hex) for attribute_value, but the circuit expects a Field. If the SDK passes the wrong format to noir_js, the witness computation produces incorrect values and the proof fails circuit assertions.
**Why it happens:** The credential JSON from issuer.ts uses zero-padded 32-byte hex strings (e.g., `"0x0000000000000000000000000000000000000000000000000000000000000019"`), but noir_js InputMap also accepts shorter hex (e.g., `"0x19"`) or decimal strings.
**How to avoid:** Pass credential JSON hex strings directly to the InputMap without modification. noir_js handles hex-to-Field conversion. The signature array is the special case -- it must be passed as an array of decimal string representations of u8 values.
**Warning signs:** Circuit assertion failures ("Age below threshold", "Attribute value not in allowed set") when the credential values are correct.

### Pitfall 5: signature Array Encoding
**What goes wrong:** The credential JSON has `signature` as `number[]` (e.g., `[24, 176, 76, ...]`), but noir_js InputMap expects string values. Passing raw numbers instead of strings causes type errors or silent truncation.
**Why it happens:** The circuit parameter `signature: [u8; 64]` is an array of integers. noir_js needs each element as a string.
**How to avoid:** Map the signature array: `cred.signature.map(b => b.toString())`.
**Warning signs:** noir_js throws "expected string, got number" or witness execution produces wrong signature bytes.

### Pitfall 6: Vite optimizeDeps Including bb.js
**What goes wrong:** Vite pre-bundles @aztec/bb.js and breaks its WASM loading mechanism. The WASM modules fail to load at runtime.
**Why it happens:** Vite's dependency optimizer tries to bundle bb.js's WASM imports, which are loaded dynamically at runtime via fetch().
**How to avoid:** Add `optimizeDeps: { exclude: ['@aztec/bb.js'] }` in vite.config.ts.
**Warning signs:** "Failed to fetch" errors for .wasm files, or "CompileError: WebAssembly.instantiate()".

### Pitfall 7: Circuit JSON Import in Browser
**What goes wrong:** The ~20KB compiled circuit JSON files are imported but not bundled correctly, or their `bytecode` field (base64-encoded gzipped ACIR, ~19KB string) gets corrupted during bundling.
**Why it happens:** JSON imports in Vite work by default, but the large base64 string may cause issues with some bundler configurations.
**How to avoid:** Import circuit JSON files directly: `import circuit from './circuits/age_verify.json'`. Vite handles JSON imports natively. The `bytecode` field is a base64 string that bb.js's UltraHonkBackend constructor handles (base64 decode + gunzip).
**Warning signs:** "Error decompressing bytecode" or "Invalid ACIR format".

## Code Examples

Verified patterns from official sources and installed package type definitions:

### Complete Proof Generation Flow
```typescript
// Source: Noir tutorial + bb.js 3.0.0-nightly types + project circuit ABI
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend, type ProofData } from '@aztec/bb.js';
import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';
// Vite WASM URL imports
import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';
// Circuit artifacts
import ageCircuit from './circuits/age_verify.json';
import membershipCircuit from './circuits/membership_proof.json';

// 1. Initialize WASM
await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);

// 2. Load credential and build inputs
const credential = await fetch('/credentials/demo_credential.json').then(r => r.json());
const inputs = {
  subject_id: credential.subject_id,
  issuer_id: credential.issuer_id,
  credential_type: credential.credential_type,
  attribute_key: credential.attribute_key,
  attribute_value: credential.attribute_value,
  issued_at: credential.issued_at,
  expires_at: credential.expires_at,
  secret_salt: credential.secret_salt,
  signature: credential.signature.map((b: number) => b.toString()),
  pub_key_x: credential.issuer_pub_key_x,
  pub_key_y: credential.issuer_pub_key_y,
  current_timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
  threshold: '0x' + (18).toString(16),  // age >= 18
  dapp_context_id: '0x' + (42).toString(16),
};

// 3. Execute circuit to get witness
const noir = new Noir(ageCircuit as any);
const { witness } = await noir.execute(inputs);

// 4. Generate proof
const backend = new UltraHonkBackend(ageCircuit.bytecode);
const proof: ProofData = await backend.generateProof(witness, { keccak: true });
// proof.publicInputs: string[] (hex-encoded field elements)
// proof.proof: Uint8Array (raw proof bytes)

// 5. Verify locally (optional sanity check)
const isValid = await backend.verifyProof(proof, { keccak: true });
console.log('Proof valid:', isValid);

// 6. Cleanup
await backend.destroy();
```

### Credential JSON Schema (from existing demo files)
```typescript
// Source: scripts/demo_credential.json (verified existing file)
// Age credential schema:
interface AgeCredentialJSON {
  subject_id: string;       // "0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b"
  issuer_id: string;        // "0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f"
  credential_type: string;  // "0x00...00" (0 = age)
  attribute_key: string;    // "0x00...01" (1 = age)
  attribute_value: string;  // "0x00...19" (25 decimal)
  issued_at: string;        // "0x00...69905d7b" (unix timestamp)
  expires_at: string;       // "0x00...6b7190fb" (unix timestamp)
  secret_salt: string;      // "0x05692e1402fd6856..."
  signature: number[];      // [24, 176, 76, ...] (64 u8 values)
  issuer_pub_key_x: string; // "0x16e4953b04718a75..."
  issuer_pub_key_y: string; // "0x29531f99cc6e18ff..."
  credential_hash: string;  // "0x267da9221ca9314a..." (for reference, not used in circuit)
  nullifier: string;        // "0x1b291cc63a9aa3f4..." (for reference, not used in circuit)
  dapp_context_id: string;  // "0x00...2a" (42 decimal, for reference)
}
```

### Credential Validation
```typescript
// Source: Circuit ABI from circuits/target/age_verify.json
function validateAgeCredential(cred: AgeCredentialJSON): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields (matching circuit ABI parameters)
  const requiredFields = [
    'subject_id', 'issuer_id', 'credential_type', 'attribute_key',
    'attribute_value', 'issued_at', 'expires_at', 'secret_salt',
    'signature', 'issuer_pub_key_x', 'issuer_pub_key_y',
  ];
  for (const field of requiredFields) {
    if (!(field in cred)) errors.push(`Missing field: ${field}`);
  }

  // Signature must be exactly 64 bytes
  if (cred.signature && cred.signature.length !== 64) {
    errors.push(`Signature must be 64 bytes, got ${cred.signature.length}`);
  }

  // Signature values must be 0-255
  if (cred.signature) {
    for (let i = 0; i < cred.signature.length; i++) {
      if (cred.signature[i] < 0 || cred.signature[i] > 255) {
        errors.push(`Signature byte ${i} out of range: ${cred.signature[i]}`);
      }
    }
  }

  // Hex field validation
  const hexFields = ['subject_id', 'issuer_id', 'credential_type', 'attribute_key',
    'attribute_value', 'issued_at', 'expires_at', 'secret_salt',
    'issuer_pub_key_x', 'issuer_pub_key_y'];
  for (const field of hexFields) {
    const val = cred[field as keyof AgeCredentialJSON] as string;
    if (val && !val.startsWith('0x')) {
      errors.push(`${field} must start with 0x, got: ${val.substring(0, 10)}`);
    }
  }

  // credential_type check (0 = age)
  if (cred.credential_type && BigInt(cred.credential_type) !== 0n) {
    errors.push(`Expected credential_type 0 (age), got ${cred.credential_type}`);
  }

  return { valid: errors.length === 0, errors };
}
```

### Membership Proof Input Transformation
```typescript
// Source: circuits/target/membership_proof.json ABI (verified)
// membership_proof circuit has different public inputs: no threshold, has allowed_set
function credentialToMembershipInputs(
  cred: MembershipCredentialJSON,
  allowedSet: string[], // Array of up to 8 hex Field values (zero-padded)
  dappContextId: number,
): InputMap {
  // Pad allowed_set to exactly 8 elements
  const paddedSet = [...allowedSet];
  while (paddedSet.length < 8) {
    paddedSet.push('0x0');
  }
  if (paddedSet.length > 8) {
    throw new Error(`allowed_set has ${paddedSet.length} elements, max 8`);
  }

  return {
    subject_id: cred.subject_id,
    issuer_id: cred.issuer_id,
    credential_type: cred.credential_type,
    attribute_key: cred.attribute_key,
    attribute_value: cred.attribute_value,
    issued_at: cred.issued_at,
    expires_at: cred.expires_at,
    secret_salt: cred.secret_salt,
    signature: cred.signature.map((b: number) => b.toString()),
    pub_key_x: cred.issuer_pub_key_x,
    pub_key_y: cred.issuer_pub_key_y,
    current_timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16),
    dapp_context_id: '0x' + dappContextId.toString(16),
    allowed_set: paddedSet,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@noir-lang/backend_barretenberg` v0.36.0 | `@aztec/bb.js` 3.0.0-nightly with `UltraHonkBackend` | Late 2025 | Old package is deprecated. All proving uses bb.js. |
| bb.js 0.x series (0.82.3) | bb.js 3.0.0-nightly.20251104 | Late 2025 | 0.x uses old `acirProveUltraKeccakHonk` API. 3.0.0 uses new `circuitProve` API with `keccakZK`/`starknet` options. |
| Manual WASM init via `Barretenberg.new()` | `UltraHonkBackend` auto-initializes on first use | bb.js 0.82+ | Backend handles SRS loading and Barretenberg API creation internally via lazy `instantiate()`. |
| `new UltraHonkBackend(bytecode, barretenbergInstance)` | `new UltraHonkBackend(bytecode, backendOptions?)` | bb.js refactor | Constructor takes config options, not a pre-built API instance. The backend creates its own Barretenberg internally. |

**Deprecated/outdated:**
- `@noir-lang/backend_barretenberg`: DO NOT USE. Replaced by `@aztec/bb.js`.
- bb.js 0.82.3 `UltraHonkBackendOptions.keccak`: In 0.82.3, `{ keccak: true }` calls the non-ZK keccak Honk prover. In 3.0.0-nightly, `{ keccak: true }` sets `oracleHashType: 'keccak'` with `disableZk: true` (non-ZK). Use `{ keccakZK: true }` for the ZK variant in 3.0.0-nightly if needed, but `{ keccak: true }` should work for Garaga verification based on Phase 4 evidence.
- Passing `Barretenberg` instance to `UltraHonkBackend` constructor: Some tutorials show this pattern but it is NOT the actual API. The constructor takes `(acirBytecode: string, backendOptions?: BackendOptions, circuitOptions?: CircuitOptions)`.

## Open Questions

1. **bb.js 3.0.0-nightly `{ keccak: true }` vs `{ keccakZK: true }` for Garaga compatibility**
   - What we know: Phase 4 successfully verified proofs on-chain using CLI-generated proofs with `bb prove -s ultra_honk --oracle_hash keccak`. In bb.js 3.0.0-nightly, `{ keccak: true }` sets `disableZk: true`, while `{ keccakZK: true }` sets `disableZk: false`.
   - What's unclear: Whether the Garaga `verify_ultra_keccak_zk_honk_proof` function accepts both ZK and non-ZK keccak Honk proofs, or only one variant.
   - Recommendation: Start with `{ keccak: true }` (matching the CLI's behavior that was validated in Phase 4). If on-chain verification fails in Phase 6, switch to `{ keccakZK: true }`. This is a one-line change.

2. **noir_js beta.16 + bb.js 3.0.0-nightly cross-version compatibility**
   - What we know: The Noir tutorial pins noir_js beta.15 + bb.js 3.0.0-nightly.20251104 as a tested combination. noir_js beta.16 exists on npm and has matching ACVM/noirc_abi dependencies.
   - What's unclear: Whether noir_js beta.16 witness output format is compatible with bb.js 3.0.0-nightly proof generation. The witness is a compressed byte array -- format changes between beta.15 and beta.16 are possible but unlikely (no ACIR format breaking changes in beta.16 release notes).
   - Recommendation: Use noir_js beta.16 (matching nargo). If witness execution succeeds but proof generation fails, fall back to noir_js beta.15.

3. **Proof generation performance in browser**
   - What we know: Target is <30 seconds on M1. CLI proof generation for age_verify (1,224 ACIR opcodes) is fast. bb.js WASM is inherently slower than native bb CLI.
   - What's unclear: Exact browser proving time for these circuits. UltraHonk is designed for fast proving, but WASM overhead and potential single-thread fallback could slow things down.
   - Recommendation: Measure proof generation time as the FIRST validation step. If >30s, ensure SharedArrayBuffer is enabled (COOP/COEP headers) and multithreading is active. The 1,224 opcode circuit is very small -- should prove quickly even in WASM.

4. **garaga npm WASM init in browser**
   - What we know: The garaga npm package requires `await garaga.init()` before using `getZKHonkCallData()`. This loads a WASM module.
   - What's unclear: Whether garaga's WASM init works in the same browser context as bb.js and noir_js WASM modules (no conflicts, no duplicate SharedArrayBuffer issues).
   - Recommendation: Test garaga WASM init alongside noir_js and bb.js init early. If conflicts arise, garaga calldata generation can be deferred to Phase 6 (it's only needed for on-chain submission, not proof generation).

## Sources

### Primary (HIGH confidence)
- `@aztec/bb.js@3.0.0-nightly.20251104` installed package type definitions -- `UltraHonkBackend`, `ProofData`, `UltraHonkBackendOptions` with `keccak`/`keccakZK`/`starknet`/`starknetZK` options
- `@aztec/bb.js@0.82.3` installed package source (`scripts/node_modules/@aztec/bb.js/src/barretenberg/backend.ts`) -- confirmed API differences from 3.0.0-nightly
- `circuits/target/age_verify.json` -- compiled circuit ABI with 14 parameters (8 private witness, 5 public inputs, 1 return tuple)
- `circuits/target/membership_proof.json` -- compiled circuit ABI with 14 parameters (different public inputs: allowed_set replaces threshold)
- `scripts/demo_credential.json` and `scripts/demo_credential_membership.json` -- existing credential JSON schema
- `scripts/issuer.ts` -- existing issuer TypeScript using bb.js 0.82.3 for Poseidon2/Schnorr
- [Noir web app tutorial](https://noir-lang.org/docs/tutorials/noirjs_app/) -- noir_js 1.0.0-beta.15 + bb.js 3.0.0-nightly.20251104 version pairing, WASM init pattern, Vite config

### Secondary (MEDIUM confidence)
- [Garaga Noir docs](https://garaga.gitbook.io/garaga/smart-contract-generators/noir) -- `getZKHonkCallData(proof, publicInputs, vk)` API
- [noir_js API reference](https://noir-lang.org/docs/reference/NoirJS/noir_js/classes/Noir) -- `Noir.execute(inputs)` returns `{ witness: Uint8Array, returnValue: InputValue }`
- npm registry version checks -- confirmed noir_js 1.0.0-beta.16, acvm_js 1.0.0-beta.16, noirc_abi 1.0.0-beta.16 all exist
- [Noir v1.0.0-beta.16 release notes](https://github.com/noir-lang/noir/releases/tag/v1.0.0-beta.16) -- no ACIR format breaking changes
- Phase 4 deployment summary -- Garaga verifiers accept `ultra_keccak_zk_honk` proofs on-chain

### Tertiary (LOW confidence)
- noir_js beta.16 + bb.js 3.0.0-nightly compatibility -- not officially documented as tested pair, inferred from matching nargo versions
- Browser proving performance estimates -- based on circuit size (1,224 ACIR opcodes) and UltraHonk's design for fast proving, but not measured in browser WASM
- garaga npm WASM browser compatibility -- documented for Node.js, browser usage assumed from package exports but not explicitly tested

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all package versions verified on npm, types inspected from installed packages
- Architecture: HIGH -- patterns derived from official Noir tutorial, verified against project's actual circuit ABI and credential JSON format
- Pitfalls: HIGH -- version mismatch risks verified by inspecting actual source code of both bb.js versions, WASM init requirements confirmed from tutorial
- Code examples: HIGH -- credential schema verified against existing demo files, InputMap format verified against circuit ABI parameters
- Performance: LOW -- no browser benchmarks available, target of <30s is a project requirement not a measured value

**Research date:** 2026-02-14
**Valid until:** 2026-02-21 (7 days -- bb.js nightly may update, but pinned version is stable)
