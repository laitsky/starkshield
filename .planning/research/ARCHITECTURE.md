# Architecture Research

**Domain:** Privacy-preserving ZK credential verification protocol on Starknet
**Researched:** 2026-02-14
**Confidence:** MEDIUM (core flow verified with official docs; some integration seams only have single-source evidence)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                               │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐     │
│  │  Credential   │  │  Proof Generator │  │  Verification         │     │
│  │  Wallet View  │  │  View            │  │  Dashboard View       │     │
│  └──────┬───────┘  └────────┬─────────┘  └───────────┬───────────┘     │
│         │                   │                         │                 │
│  ┌──────┴───────────────────┴─────────────────────────┴───────────┐    │
│  │                React 19 + Vite 6 + TailwindCSS 4               │    │
│  │           starknet-react hooks (useAccount, useConnect)         │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
├───────────────────────────────┼───────────────────────────────────────┤
│                        SDK LAYER                                       │
│  ┌────────────────────────────┴───────────────────────────────────┐    │
│  │                    StarkShield SDK (TypeScript)                  │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │    │
│  │  │ Credential   │  │ Proof         │  │ Wallet + Chain      │  │    │
│  │  │ Manager      │  │ Engine        │  │ Interface           │  │    │
│  │  │              │  │               │  │                     │  │    │
│  │  │ parse/store  │  │ noir_js +     │  │ starknet.js v8      │  │    │
│  │  │ validate     │  │ bb.js WASM    │  │ WalletAccount       │  │    │
│  │  │ serialize    │  │ garaga npm    │  │ get-starknet v4     │  │    │
│  │  └──────────────┘  └───────────────┘  └─────────────────────┘  │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
├───────────────────────────────┼───────────────────────────────────────┤
│                        CIRCUIT LAYER                                   │
│  ┌────────────────────────────┴───────────────────────────────────┐    │
│  │                Noir 1.0.0-beta.18 Workspace                     │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │    │
│  │  │ shared_lib   │  │ age_verify    │  │ membership_proof    │  │    │
│  │  │ (library)    │  │ (binary)      │  │ (binary)            │  │    │
│  │  │              │  │               │  │                     │  │    │
│  │  │ Poseidon2    │  │ age >= thresh │  │ Merkle inclusion    │  │    │
│  │  │ Schnorr sig  │  │ + sig verify  │  │ + sig verify        │  │    │
│  │  │ nullifier    │  │ + nullifier   │  │ + nullifier         │  │    │
│  │  │ credential   │  │ + expiry      │  │ + expiry            │  │    │
│  │  └──────────────┘  └───────────────┘  └─────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────┘    │
├───────────────────────────────────────────────────────────────────────┤
│                        CONTRACT LAYER (Starknet Sepolia)               │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐   │
│  │  HonkVerifier (auto-gen)     │  │  StarkShieldRegistry         │   │
│  │  via Garaga SDK              │  │  (hand-written Cairo)        │   │
│  │                              │  │                              │   │
│  │  verify_ultra_keccak_zk_     │  │  trusted_issuers: Map        │   │
│  │  honk_proof(calldata)        │  │  nullifiers: Map             │   │
│  │  -> Result<public_inputs>    │  │  verification_log: Map       │   │
│  └──────────────────────────────┘  │                              │   │
│                                    │  verify_credential()         │   │
│                                    │  -> calls HonkVerifier       │   │
│                                    │  -> checks nullifier         │   │
│                                    │  -> logs + emits event       │   │
│                                    └──────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────────┤
│                        BUILD/TOOLING LAYER                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐               │
│  │ Demo Issuer  │  │ Deploy Script │  │ Benchmark    │               │
│  │ (TypeScript) │  │ (TypeScript)  │  │ (TypeScript) │               │
│  └──────────────┘  └───────────────┘  └──────────────┘               │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **shared_lib** (Noir library crate) | Poseidon2 hashing, Schnorr signature verification, nullifier derivation, credential struct definition, expiry check | Noir library; imported by binary crates via `{ path = "../shared_lib" }` in Nargo.toml |
| **age_verify** (Noir binary crate) | Prove `age >= threshold` without revealing age; verify issuer signature; derive per-dApp nullifier; check expiry | Noir binary; compiles to ACIR; witness generation via noir_js |
| **membership_proof** (Noir binary crate) | Prove group membership via Merkle inclusion proof; verify issuer signature; derive nullifier; check expiry | Noir binary; compiles to ACIR; Merkle root is a public input |
| **HonkVerifier** (Cairo contract) | Accept proof calldata, run UltraKeccakZK Honk verification, return public inputs on success | Auto-generated by `garaga gen`; deployed as-is; one per circuit OR shared if VK is parameterized |
| **StarkShieldRegistry** (Cairo contract) | Manage trusted issuers, track used nullifiers, orchestrate verification by calling HonkVerifier, log results, emit events | Hand-written Cairo 2.x; calls HonkVerifier via inter-contract call; owns all state |
| **Proof Engine** (SDK module) | Initialize WASM backends, compile witness from user inputs, generate ZK proof, format calldata via garaga npm package | TypeScript; wraps `@noir-lang/noir_js`, `@aztec/bb.js` (UltraHonkBackend), `garaga` npm |
| **Credential Manager** (SDK module) | Parse credential JSON, validate structure, store/retrieve from localStorage or IndexedDB, serialize for circuit input | TypeScript; pure data handling; no cryptographic operations |
| **Wallet + Chain Interface** (SDK module) | Connect browser wallets, submit calldata transactions to StarkShieldRegistry, read verification results, handle events | TypeScript; wraps `starknet.js` v8 WalletAccount + `@starknet-io/get-starknet` v4 |
| **React SPA** | Three views (Credential Wallet, Proof Generator, Verification Dashboard); orchestrates SDK calls; displays status | React 19 + Vite 6 + TailwindCSS 4; uses starknet-react hooks for wallet state |
| **Demo Issuer** (Script) | Generate test credentials with Poseidon2-Schnorr signatures; output JSON files users can load in the SPA | TypeScript CLI script; uses `@aztec/bb.js` for Schnorr key generation and signing |
| **Deploy Script** | Declare and deploy HonkVerifier + StarkShieldRegistry to Starknet Sepolia; register initial trusted issuers | TypeScript or shell; uses `starknet.js` v8 Account or `starkli` CLI |

## Recommended Project Structure

```
starkshield/
├── circuits/                        # Noir workspace root
│   ├── Nargo.toml                   # [workspace] members = ["crates/*"]
│   └── crates/
│       ├── shared_lib/              # Library crate: shared crypto primitives
│       │   ├── Nargo.toml           # type = "lib"
│       │   └── src/
│       │       ├── lib.nr           # Module exports
│       │       ├── credential.nr    # Credential struct (8 fixed fields)
│       │       ├── schnorr.nr       # Schnorr sig verify wrapper
│       │       ├── nullifier.nr     # Per-dApp nullifier derivation
│       │       └── expiry.nr        # Timestamp/block expiry check
│       ├── age_verify/              # Binary crate: age verification circuit
│       │   ├── Nargo.toml           # type = "bin", deps: shared_lib, poseidon
│       │   ├── Prover.toml          # Default prover inputs for testing
│       │   └── src/
│       │       └── main.nr          # main() entry point
│       └── membership_proof/        # Binary crate: membership proof circuit
│           ├── Nargo.toml           # type = "bin", deps: shared_lib, poseidon
│           ├── Prover.toml
│           └── src/
│               └── main.nr
├── contracts/                       # Cairo contracts (Scarb workspace)
│   ├── Scarb.toml                   # Scarb workspace config
│   └── src/
│       ├── lib.cairo                # Module declarations
│       ├── registry.cairo           # StarkShieldRegistry contract
│       ├── honk_verifier.cairo      # Auto-generated by Garaga (DO NOT EDIT)
│       ├── honk_verifier_circuits.cairo  # Auto-generated
│       ├── honk_verifier_constants.cairo # Auto-generated
│       └── interfaces.cairo         # Trait definitions for cross-contract calls
├── client/                          # TypeScript SDK + React web app
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts               # CRITICAL: WASM, polyfills, COOP/COEP
│   ├── src/
│   │   ├── sdk/                     # StarkShield SDK (framework-agnostic)
│   │   │   ├── index.ts             # Public API barrel export
│   │   │   ├── proof-engine.ts      # noir_js + bb.js + garaga calldata
│   │   │   ├── credential.ts        # Credential parsing, validation, storage
│   │   │   ├── chain.ts             # starknet.js WalletAccount, tx submission
│   │   │   ├── types.ts             # Shared TypeScript types
│   │   │   └── constants.ts         # Contract addresses, chain IDs, ABIs
│   │   ├── web/                     # React SPA
│   │   │   ├── App.tsx              # Router, StarknetConfig provider
│   │   │   ├── main.tsx             # Entry point
│   │   │   ├── views/
│   │   │   │   ├── CredentialWallet.tsx
│   │   │   │   ├── ProofGenerator.tsx
│   │   │   │   └── VerificationDashboard.tsx
│   │   │   ├── components/          # Shared UI components
│   │   │   └── hooks/               # Custom React hooks wrapping SDK
│   │   └── artifacts/               # Compiled circuit JSON (committed)
│   │       ├── age_verify.json
│   │       └── membership_proof.json
│   └── public/
├── scripts/                         # CLI tooling
│   ├── package.json
│   ├── issuer.ts                    # Demo credential issuer
│   ├── deploy.ts                    # Contract deployment
│   └── benchmark.ts                 # Proof generation timing
└── docs/                            # Documentation
    └── ...
```

### Structure Rationale

- **circuits/crates/ with workspace:** Noir workspaces allow `nargo build --workspace` to compile all circuits at once. The shared_lib library crate avoids duplicating Poseidon2 hashing, Schnorr verification, nullifier logic, and credential struct definitions across circuits. Binary crates import it via `{ path = "../shared_lib" }`.
- **contracts/ as single Scarb package:** Garaga generates multiple Cairo files (honk_verifier.cairo, honk_verifier_circuits.cairo, honk_verifier_constants.cairo) that must coexist in the same package. The hand-written registry contract imports the generated verifier interface.
- **client/src/sdk/ separated from client/src/web/:** The SDK is framework-agnostic TypeScript -- it could be consumed by a CLI tool, a different frontend framework, or tests. The React web app is a thin consumer of the SDK. This separation also isolates WASM initialization concerns from React rendering.
- **client/src/artifacts/:** Compiled circuit JSON files (ACIR bytecode) are committed to the repo so the web app does not need the Noir toolchain to build. Updated via a build script whenever circuits change.
- **scripts/ as separate package:** Scripts have different runtime requirements (Node.js, not browser) and dependencies (direct starknet.js Account, not WalletAccount). Keeping them separate avoids polluting the client bundle.

## Architectural Patterns

### Pattern 1: Circuit-First Development

**What:** Define the ZK circuit as the source of truth for what the protocol can prove. All other layers (contracts, SDK, frontend) are derived from or constrained by the circuit's public inputs/outputs.

**When to use:** Always. The circuit defines the trust boundary -- what is proven vs. what is trusted.

**Trade-offs:** Forces careful upfront design of the circuit interface (public vs. private inputs), but prevents costly rework when downstream layers discover the circuit does not expose needed information.

**Example:**
```noir
// age_verify/src/main.nr -- THIS defines the entire protocol surface
fn main(
    // Private inputs (never leave user's device)
    credential: Credential,       // 8-field struct
    issuer_signature: [u8; 64],   // Schnorr signature
    issuer_pub_key_x: Field,      // Issuer public key
    issuer_pub_key_y: Field,
    age_value: u8,                // Actual age from credential

    // Public inputs (visible on-chain in verification result)
    age_threshold: pub u8,        // Minimum age to prove
    issuer_pub_key_hash: pub Field, // Hash of issuer key (for registry lookup)
    nullifier: pub Field,         // Per-dApp nullifier
    dapp_id: pub Field,           // dApp context for nullifier
) {
    // 1. Verify issuer signature over credential
    // 2. Verify age_value >= age_threshold
    // 3. Verify nullifier = poseidon2(credential_secret, dapp_id)
    // 4. Verify credential not expired
    // 5. Verify issuer_pub_key_hash = poseidon2(pub_key_x, pub_key_y)
}
```

The contract, SDK, and frontend all derive their data structures from this interface.

### Pattern 2: Layered Proof Pipeline

**What:** Proof generation happens in distinct, decoupled stages: (1) witness computation, (2) proof generation, (3) calldata formatting, (4) on-chain submission. Each stage has its own module.

**When to use:** Whenever browser-based WASM proof generation feeds into on-chain verification.

**Trade-offs:** More modules to maintain, but each stage can be tested independently and failures are isolated (e.g., "proof generated but calldata formatting failed" vs. "something went wrong").

**Example:**
```typescript
// sdk/proof-engine.ts -- layered pipeline

import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { init as initGaraga, getZKHonkCallData } from 'garaga';

export class ProofEngine {
  private noir: Noir;
  private backend: UltraHonkBackend;
  private ready: boolean = false;

  // Stage 0: WASM initialization (one-time, expensive)
  async initialize(circuitArtifact: CompiledCircuit): Promise<void> {
    await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);
    await initGaraga();
    this.noir = new Noir(circuitArtifact);
    const bb = await Barretenberg.new();
    this.backend = new UltraHonkBackend(circuitArtifact.bytecode, bb);
    this.ready = true;
  }

  // Stage 1: Witness computation (fast, ~100ms)
  async computeWitness(inputs: CircuitInputs): Promise<Uint8Array> {
    const { witness } = await this.noir.execute(inputs);
    return witness;
  }

  // Stage 2: Proof generation (slow, 10-30s in browser WASM)
  async generateProof(witness: Uint8Array): Promise<ProofData> {
    return await this.backend.generateProof(witness);
  }

  // Stage 3: Calldata formatting for Starknet (fast, ~500ms)
  async formatCalldata(proof: ProofData, vk: Uint8Array): Promise<string[]> {
    return getZKHonkCallData(proof.proof, proof.publicInputs, vk);
  }
}
```

### Pattern 3: Registry-as-Orchestrator Contract

**What:** The StarkShieldRegistry contract is the single entry point for all on-chain verification. It calls the auto-generated HonkVerifier internally, then performs application-level checks (nullifier uniqueness, issuer trust, logging). Users never call the HonkVerifier directly.

**When to use:** When the auto-generated verifier is stateless and you need stateful logic (nullifier tracking, access control).

**Trade-offs:** Adds one level of indirection and one additional inter-contract call. Gas cost increases slightly (~10-20K gas for the cross-contract call overhead), but you gain a clean separation between cryptographic verification and business logic.

**Example (Cairo pseudo-code):**
```cairo
#[starknet::contract]
mod StarkShieldRegistry {
    use starknet::storage::Map;

    #[storage]
    struct Storage {
        honk_verifier_address: ContractAddress,
        trusted_issuers: Map<felt252, bool>,           // issuer_pub_key_hash -> trusted
        used_nullifiers: Map<felt252, bool>,            // nullifier -> used
        verification_count: u64,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CredentialVerified: CredentialVerified,
    }

    #[derive(Drop, starknet::Event)]
    struct CredentialVerified {
        #[key]
        nullifier: felt252,
        #[key]
        dapp_id: felt252,
        issuer_hash: felt252,
        block_number: u64,
    }

    #[abi(embed_v0)]
    fn verify_credential(
        ref self: ContractState,
        proof_calldata: Array<felt252>,
    ) -> bool {
        // 1. Call HonkVerifier with proof calldata
        // 2. Extract public inputs from result
        // 3. Check issuer_pub_key_hash is in trusted_issuers
        // 4. Check nullifier not in used_nullifiers
        // 5. Store nullifier
        // 6. Emit CredentialVerified event
        // 7. Return true
    }
}
```

## Data Flow

### Flow 1: Credential Issuance (Off-Chain)

```
Demo Issuer Script
    │
    ├── 1. Generate issuer keypair (Schnorr over Grumpkin/BN254)
    │       Uses: @aztec/bb.js Schnorr key generation
    │
    ├── 2. Construct credential struct (8 fixed fields)
    │       Fields: subject_id, issuer_id, credential_type,
    │               attribute_key, attribute_value, issued_at,
    │               expires_at, secret_salt
    │
    ├── 3. Hash credential fields with Poseidon2
    │       Must match EXACTLY what the Noir circuit hashes
    │
    ├── 4. Sign hash with Schnorr private key
    │       Output: 64-byte signature
    │
    └── 5. Output credential JSON file
            Contains: all fields + signature + issuer public key
            User downloads or loads via SPA
```

**CRITICAL DEPENDENCY:** The Poseidon2 hash computation in the issuer script must be field-compatible with what `dep::poseidon::poseidon2` computes inside the Noir circuit. Since the issuer runs in Node.js and the circuit runs in Noir/Barretenberg, both must use the same Poseidon2 parameters (t, rounds, constants for BN254). The `@aztec/bb.js` library provides Poseidon2 in TypeScript that is compatible with the Noir stdlib implementation.

### Flow 2: Proof Generation (Browser, Client-Side)

```
User loads credential JSON in browser
    │
    ├── 1. Credential Manager parses and validates JSON
    │       Checks: required fields present, types correct, not expired
    │
    ├── 2. User selects proof type + parameters in React UI
    │       Example: "Prove age >= 21" or "Prove membership in group X"
    │
    ├── 3. SDK constructs circuit inputs object
    │       Maps credential fields → Noir main() parameter names
    │       Derives nullifier = poseidon2(secret_salt, dapp_id)
    │       Computes issuer_pub_key_hash = poseidon2(pub_key_x, pub_key_y)
    │
    ├── 4. Proof Engine: witness computation (~100ms)
    │       noir.execute(inputs) → witness (Uint8Array)
    │       Runs ACIR interpreter in WASM
    │
    ├── 5. Proof Engine: proof generation (10-30s)          ← BOTTLENECK
    │       backend.generateProof(witness) → { proof, publicInputs }
    │       Runs UltraHonk prover in Barretenberg WASM
    │       Requires SharedArrayBuffer for multithreading (COOP/COEP headers)
    │
    ├── 6. Proof Engine: calldata formatting (~500ms)
    │       garaga.getZKHonkCallData(proof, publicInputs, vk)
    │       Converts proof to Starknet-compatible felt252 array
    │
    └── 7. Preview: show user the proof summary before submission
            Display: nullifier, dapp_id, verification type, estimated gas
```

### Flow 3: On-Chain Verification (Starknet Sepolia)

```
User clicks "Submit Proof" in React UI
    │
    ├── 1. Wallet Interface constructs transaction
    │       Uses starknet.js v8 WalletAccount
    │       Target: StarkShieldRegistry.verify_credential(calldata)
    │
    ├── 2. Wallet popup: user approves transaction
    │       Argent X or Braavos shows tx details
    │
    ├── 3. Transaction submitted to Starknet Sepolia
    │
    ├── 4. StarkShieldRegistry.verify_credential() executes:
    │       ├── 4a. Call HonkVerifier.verify(proof_calldata)
    │       │        → Returns Result<public_inputs> or panics
    │       ├── 4b. Extract public inputs: nullifier, dapp_id,
    │       │        issuer_pub_key_hash, age_threshold (or merkle_root)
    │       ├── 4c. Assert trusted_issuers[issuer_pub_key_hash] == true
    │       ├── 4d. Assert used_nullifiers[nullifier] == false
    │       ├── 4e. Store used_nullifiers[nullifier] = true
    │       └── 4f. Emit CredentialVerified event
    │
    └── 5. Frontend reads tx receipt + events
            Updates Verification Dashboard with result
```

### Flow 4: Verification Query (Read-Only)

```
Any dApp or user queries verification status
    │
    ├── Option A: Read on-chain storage directly
    │       StarkShieldRegistry.is_nullifier_used(nullifier) → bool
    │       Uses: starknet.js Provider.callContract() (no wallet needed)
    │
    └── Option B: Index events
            Filter CredentialVerified events by dapp_id
            Build verification history dashboard
```

### Key Data Flows Summary

1. **Credential Issuance:** Issuer script -> credential JSON -> user's browser localStorage
2. **Proof Generation:** User inputs + credential -> noir_js witness -> bb.js proof -> garaga calldata
3. **On-Chain Verification:** calldata -> WalletAccount tx -> StarkShieldRegistry -> HonkVerifier -> event
4. **Status Query:** dApp -> Provider.callContract -> StarkShieldRegistry storage

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Hackathon demo (1-10 users) | Current architecture is sufficient. Single HonkVerifier contract, single Registry. Starknet Sepolia has ample capacity. |
| 100-1K users | Consider indexing CredentialVerified events with an off-chain service (Apibara, custom indexer) rather than paginating on-chain storage. Nullifier map grows but storage is cheap on Starknet. |
| 10K+ users | Multiple HonkVerifier instances per circuit type. Registry becomes upgradeable via proxy pattern. Proof generation moves to a dedicated worker thread or server-side prover for latency-sensitive flows. Consider batching verifications. |
| 100K+ users | Protocol-level changes: recursive proof aggregation (batch N proofs into 1), sharded nullifier sets, decentralized issuer registry with governance. Out of scope for hackathon. |

### Scaling Priorities

1. **First bottleneck:** Browser proof generation time (10-30s). Mitigated by: clear loading UI, progress indicators, multithreading via SharedArrayBuffer. For post-hackathon: server-side proving option.
2. **Second bottleneck:** Nullifier storage growth. Each verification consumes one storage slot (felt252 -> bool). At 1M verifications this is ~32MB of contract storage, which Starknet handles fine. Not a real concern until much later.

## Anti-Patterns

### Anti-Pattern 1: Calling HonkVerifier Directly

**What people do:** Frontend submits proof calldata directly to the auto-generated HonkVerifier contract, bypassing the Registry.

**Why it is wrong:** The HonkVerifier only checks cryptographic validity. It does not check nullifier uniqueness, issuer trust, or log the result. A valid proof could be replayed (same nullifier used twice) because nobody tracks state.

**Do this instead:** Always route through StarkShieldRegistry, which wraps the HonkVerifier call with application-level state checks.

### Anti-Pattern 2: Computing Poseidon2 Hashes Differently Across Layers

**What people do:** Use different Poseidon2 implementations or parameters in the issuer script vs. the Noir circuit. For example, using a JavaScript Poseidon2 library that uses different round constants than `@aztec/bb.js`.

**Why it is wrong:** If the issuer hashes with implementation A and the circuit verifies with implementation B, all signature verifications fail. This is particularly insidious because both implementations are "correct Poseidon2" -- they just use different constants or field representations.

**Do this instead:** Use `@aztec/bb.js` for ALL Poseidon2 and Schnorr operations in TypeScript (issuer script, SDK). This guarantees field-level compatibility with the Noir stdlib's `dep::poseidon::poseidon2` and `std::schnorr::verify_signature`. The Barretenberg backend is the single source of truth for both TypeScript and Noir cryptographic primitives.

### Anti-Pattern 3: Leaking Private Inputs as Public Outputs

**What people do:** Return the actual age or membership ID as a public output from the circuit "for debugging" or "for the frontend to display."

**Why it is wrong:** Public outputs are on-chain and visible to everyone. Returning `age = 25` when the circuit is supposed to prove `age >= 21` defeats the entire purpose. As noted by OpenZeppelin's Noir security guide, even hashing a small-domain value (like age, which has ~82 possible values) and returning the hash is insecure because an attacker can brute-force all candidates.

**Do this instead:** Return ONLY: nullifier, dapp_id, issuer_pub_key_hash, and the threshold value. Never return any value derived solely from private inputs.

### Anti-Pattern 4: Monolithic WASM Initialization

**What people do:** Initialize noir_js, bb.js, and garaga WASM modules synchronously on page load, blocking the entire React app for 3-5 seconds.

**Why it is wrong:** The user sees a blank screen or frozen UI while multiple WASM modules download and initialize.

**Do this instead:** Lazy-initialize the Proof Engine only when the user navigates to the Proof Generator view. Show the Credential Wallet and other views immediately. Use React Suspense or a loading state to indicate WASM is initializing.

### Anti-Pattern 5: Editing Auto-Generated Garaga Files

**What people do:** Manually modify honk_verifier.cairo, honk_verifier_circuits.cairo, or honk_verifier_constants.cairo to "fix" something or add features.

**Why it is wrong:** Any `garaga gen` invocation overwrites all generated files. Manual edits are silently lost. Worse, the generated code is tightly coupled to the verification key -- any modification breaks cryptographic correctness.

**Do this instead:** Treat generated files as read-only build artifacts. All custom logic goes in the StarkShieldRegistry contract, which calls the generated verifier via its interface.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Starknet Sepolia RPC** | JSON-RPC via starknet.js Provider | Use public endpoints (Blast, Nethermind, Alchemy). Rate limits may apply. Configure fallback providers. |
| **Argent X Wallet** | Browser extension via `@starknet-io/get-starknet` v4 + WalletAccount | Must handle wallet not installed, wrong network, account changes. Use `connect({ modalMode: 'alwaysAsk' })`. |
| **Braavos Wallet** | Same as Argent X -- both are injected connectors | Test with both wallets; account abstraction behavior may differ slightly. |
| **WASM Modules** (acvm_js, noirc_abi, bb.js, garaga) | Fetch and instantiate at runtime | Require COOP/COEP headers for SharedArrayBuffer multithreading. Vite config must exclude `@aztec/bb.js` from optimization. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Noir circuits <-> SDK** | Compiled circuit JSON artifacts (ACIR bytecode) committed to `client/src/artifacts/`. SDK loads them as static imports. | Whenever a circuit changes, artifacts must be rebuilt and committed. Automate with a build script. |
| **SDK Proof Engine <-> SDK Chain Interface** | Proof Engine outputs `string[]` calldata; Chain Interface wraps it in a starknet.js `Call` object. | Clean interface: `formatCalldata()` returns what `execute()` consumes. No coupling. |
| **SDK <-> React Views** | React hooks in `web/hooks/` wrap SDK classes with React state management (useState, useEffect). | Hooks handle loading states, error boundaries, and WASM initialization lifecycle. SDK remains framework-agnostic. |
| **StarkShieldRegistry <-> HonkVerifier** | Inter-contract call via Cairo trait dispatch (IHonkVerifier interface). | The verifier address is stored in Registry storage, set at deployment. Use a trait/interface to type-check the call. |
| **Garaga CLI <-> Noir toolchain** | Garaga reads the verification key (binary) produced by `bb write_vk`. Garaga does NOT read Noir source or ACIR directly. | Pipeline: `nargo build` -> `bb write_vk` -> `garaga gen`. Three separate tools, three separate invocations. |
| **Issuer Script <-> User Browser** | Credential JSON file transferred out-of-band (download, copy-paste, QR code for demo). | No live connection between issuer and user. Credentials are self-contained signed objects. |

## Build Order Dependencies

The following build order is imposed by hard technical dependencies. Violating this order means components cannot compile or function.

```
Phase 1: Circuits (no dependencies on other layers)
    shared_lib -> age_verify -> membership_proof
    │
    ├── Outputs: compiled ACIR JSON, verification keys
    │
Phase 2: Contracts (depends on Phase 1 VK output)
    VK files -> garaga gen -> honk_verifier.cairo (generated)
    honk_verifier.cairo -> registry.cairo (imports verifier interface)
    │
    ├── Outputs: deployed contract addresses
    │
Phase 3: SDK (depends on Phase 1 artifacts + Phase 2 addresses)
    circuit artifacts -> proof-engine.ts
    contract addresses + ABIs -> chain.ts
    │
    ├── Outputs: working SDK module
    │
Phase 4: Frontend (depends on Phase 3 SDK)
    SDK -> React hooks -> Views
    │
    ├── Outputs: working SPA
    │
Phase 5: Integration (depends on all above)
    Deploy contracts -> update SDK constants -> E2E test flow
    │
    ├── Outputs: demo-ready application
```

**Key insight for hackathon scheduling:** Phases 1 and 3 (circuits and SDK skeleton) can be developed in partial parallel. The SDK's Proof Engine needs circuit artifacts, but the SDK's Credential Manager and Chain Interface can be built against mock data while circuits are still being designed. Similarly, the React SPA shell can be built against SDK stubs.

**Parallelization opportunities:**
- Circuit design + React UI shell + Deploy script skeleton (all independent)
- Proof Engine implementation can start once ONE circuit compiles (does not need both)
- Contract development can start once ONE VK is generated

## Sources

- [Garaga SDK Noir Verifier docs](https://garaga.gitbook.io/garaga/smart-contract-generators/noir) -- HIGH confidence, official documentation
- [Garaga GitHub releases](https://github.com/keep-starknet-strange/garaga/releases) -- HIGH confidence, v1.0.0 and v1.0.1 release notes
- [Noir web app tutorial (noir_js + Barretenberg)](https://noir-lang.org/docs/tutorials/noirjs_app/) -- HIGH confidence, official Noir documentation
- [OpenZeppelin: Safe Noir Circuits guide](https://www.openzeppelin.com/news/developer-guide-to-building-safe-noir-circuits) -- HIGH confidence, reputable security firm
- [Noir Schnorr signatures stdlib](https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/schnorr/) -- HIGH confidence, official docs
- [Noir dependencies and workspaces](https://noir-lang.org/docs/noir/modules_packages_crates/dependencies/) -- HIGH confidence, official docs
- [Noir crates and packages](https://noir-lang.org/docs/noir/modules_packages_crates/crates_and_packages) -- HIGH confidence, official docs
- [Noir Poseidon2 library (noir-lang/poseidon)](https://github.com/noir-lang/poseidon) -- HIGH confidence, official Noir-maintained library
- [starknet.js WalletAccount guide](https://starknetjs.com/docs/guides/account/walletAccount/) -- HIGH confidence, official starknet.js docs
- [starknet.js v8.0.0 changelog](https://github.com/starknet-io/starknet.js/blob/v8.0.0/CHANGELOG.md) -- HIGH confidence, official changelog
- [Starknet Cairo Book: Contract Events](https://www.starknet.io/cairo-book/ch101-03-contract-events.html) -- HIGH confidence, official Cairo docs
- [Starknet Cairo Book: Storage Mappings](https://www.starknet.io/cairo-book/ch101-01-01-storage-mappings.html) -- HIGH confidence, official Cairo docs
- [starknet-react wallet hooks](https://www.starknet-react.com/docs/wallets) -- MEDIUM confidence, community library docs
- [Barretenberg bb.js npm package](https://www.npmjs.com/package/@aztec/bb.js) -- HIGH confidence, official Aztec package
- [zk-creds: Flexible Anonymous Credentials (academic paper)](https://eprint.iacr.org/2022/878) -- MEDIUM confidence, academic reference for nullifier patterns
- [PLUME: ECDSA Nullifier Scheme](https://eprint.iacr.org/2022/1255) -- MEDIUM confidence, academic reference for nullifier design
- [scaffold-garaga reference project](https://github.com/KevinSheeranxyj/scaffold-garaga) -- LOW confidence, community project, not official
- [Garaga npm package](https://www.npmjs.com/package/garaga) -- MEDIUM confidence, official package but limited docs at time of research
- [Starknet blog: Noir on Starknet](https://www.starknet.io/blog/noir-on-starknet/) -- HIGH confidence, official Starknet blog

---
*Architecture research for: StarkShield -- Privacy-preserving credential verification on Starknet*
*Researched: 2026-02-14*
