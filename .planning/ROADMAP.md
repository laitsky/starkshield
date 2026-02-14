# Roadmap: StarkShield

## Overview

StarkShield delivers privacy-preserving credential verification on Starknet in 8 phases following the strict bottom-up build pipeline: Noir circuits (compiled and tested) feed verification keys to Garaga for Cairo verifier generation, contracts deploy to Sepolia, the TypeScript SDK wraps browser-side proving and chain interaction, the React frontend consumes the SDK, and the final phase packages everything for hackathon submission. The critical path runs through toolchain validation and circuit development -- nothing downstream can begin until circuits compile and prove correctly. With a 14-day window (Feb 14-28, 2026), phases are sequenced to unblock downstream work as early as possible, with the proof engine SDK parallelizable alongside contract development.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Toolchain Validation & Circuit Foundation** - Validate full toolchain end-to-end, build shared crypto library, create demo credential issuer *(completed 2026-02-14)*
- [x] **Phase 2: Age Verification Circuit** - Core circuit proving age >= threshold with signature verification, nullifiers, and expiration *(completed 2026-02-14)*
- [x] **Phase 3: Membership Verification Circuit** - Second credential type proving set membership, demonstrating protocol generality *(completed 2026-02-14)*
- [ ] **Phase 4: Smart Contracts & Deployment** - Garaga verifier generation, StarkShieldRegistry contract, Sepolia deployment
- [ ] **Phase 5: Proof Engine SDK** - Browser WASM proof generation via noir_js + bb.js with credential loading
- [ ] **Phase 6: Wallet & Chain SDK** - Wallet connection, proof submission, and on-chain verification queries
- [ ] **Phase 7: Web Application** - React SPA with Credential Wallet, Proof Generator, and Verification Dashboard views
- [ ] **Phase 8: Demo & Submission** - Demo video, README with architecture diagram, DoraHacks BUIDL submission

## Phase Details

### Phase 1: Toolchain Validation & Circuit Foundation
**Goal**: The full compile-prove-verify pipeline works end-to-end across all tool versions, reusable crypto primitives exist as a shared library, and demo credentials can be generated for testing
**Depends on**: Nothing (first phase)
**Requirements**: CIRC-07, CIRC-08, DEMO-01
**Success Criteria** (what must be TRUE):
  1. A trivial Noir circuit compiles with nargo beta.18, generates a proof with bb.js, produces a Garaga Cairo verifier that compiles under Scarb 2.15.x, and verifies a proof on Starknet Sepolia -- the full pipeline works
  2. The shared_lib crate exports Poseidon2 hashing, Schnorr signature verification, nullifier derivation, and credential struct definition, and is importable by binary circuit crates
  3. The demo credential issuer script generates a Poseidon2-Schnorr keypair, signs a credential with 8 fields, and outputs a valid JSON file that the shared_lib can verify
  4. Running `nargo info` on the trivial circuit confirms the constraint measurement tooling works and the shared_lib primitives have known constraint costs
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Install and pin full toolchain (nargo, bb, Garaga, Scarb), scaffold project structure, validate complete compile-prove-verify pipeline with trivial circuit
- [x] 01-02-PLAN.md -- Build shared_lib crate (Poseidon2, Schnorr, nullifier, Credential struct), create TypeScript demo credential issuer, cross-validate Poseidon2 compatibility

### Phase 2: Age Verification Circuit
**Goal**: Users can generate a zero-knowledge proof that their age meets a threshold without revealing their actual age, with full protocol features (issuer signatures, expiration, nullifiers, clean public outputs)
**Depends on**: Phase 1
**Requirements**: CIRC-01, CIRC-03, CIRC-04, CIRC-05, CIRC-06
**Success Criteria** (what must be TRUE):
  1. The age_verify circuit accepts a signed credential and threshold, and outputs (passed: bool, nullifier, issuer_pubkey, attribute_key, threshold) -- no private data appears in public outputs
  2. A credential with age >= threshold produces a valid proof; a credential with age < threshold produces passed=false or the circuit rejects the witness
  3. An expired credential (current_timestamp >= expires_at) is rejected by the circuit regardless of age value
  4. A credential signed by a different keypair than the one verified in-circuit is rejected (signature verification enforced)
  5. The same user verifying the same credential with two different dApp context_ids produces two different nullifiers (cross-dApp unlinkability), and the same context_id always produces the same nullifier (replay detection)
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md -- Build age_verify circuit crate (imports shared_lib, hard-asserts signature/expiration/threshold, returns nullifier + public outputs), validate full bb prove/verify pipeline, document public output ordering

### Phase 3: Membership Verification Circuit
**Goal**: Users can generate a zero-knowledge proof of group membership without revealing which member they are, proving the protocol handles multiple credential types
**Depends on**: Phase 1
**Requirements**: CIRC-02
**Success Criteria** (what must be TRUE):
  1. The membership_proof circuit accepts a signed credential with a membership attribute and an allowed set, and proves the user's value is in the set without revealing it
  2. The circuit reuses shared_lib for signature verification, nullifier derivation, and expiration -- same security guarantees as age verification
  3. Both circuits (age_verify and membership_proof) compile and their combined constraint counts remain under 50K each (verified via `nargo info`)
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md -- Build membership_proof circuit (set membership check, shared_lib reuse, bb pipeline validation, public output ordering)

### Phase 4: Smart Contracts & Deployment
**Goal**: On-chain infrastructure exists on Starknet Sepolia to verify ZK proofs, track nullifiers, manage trusted issuers, and log verifications -- a complete trust-minimized verification backend
**Depends on**: Phase 2, Phase 3
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, DEMO-04
**Success Criteria** (what must be TRUE):
  1. The Garaga-generated HonkVerifier contract is deployed on Starknet Sepolia and successfully verifies a valid proof submitted via CLI (sncast or starknet.js script)
  2. The StarkShieldRegistry contract accepts a proof via verify_and_register(), routes to the correct circuit verifier (circuit_id 0 for age, 1 for membership), rejects previously-seen nullifiers, and emits a VerificationPassed event
  3. Trusted issuers can be added and removed by the contract owner, and proofs from non-trusted issuers are rejected
  4. Verification records are queryable on-chain by nullifier, and past verifications are visible on Starkscan via events
  5. A single verification transaction costs less than 500,000 gas units on Sepolia
**Plans**: TBD

Plans:
- [ ] 04-01: Garaga verifier generation and HonkVerifier deployment
- [ ] 04-02: StarkShieldRegistry contract development, testing, and deployment

### Phase 5: Proof Engine SDK
**Goal**: A browser-based proof generation engine that loads credentials, computes witnesses, and generates ZK proofs entirely client-side via WASM -- no backend required
**Depends on**: Phase 2 (compiled circuit artifacts)
**Requirements**: SDK-01, SDK-05, SDK-06
**Success Criteria** (what must be TRUE):
  1. The proof engine initializes noir_js and bb.js WASM backends in a browser environment and generates a valid proof from a demo credential JSON file
  2. Credential JSON files are loaded, validated (correct schema, required fields present), and transformed into circuit-compatible witness inputs
  3. Proof generation completes in under 30 seconds on modern hardware (M1 or equivalent) in a browser tab with SharedArrayBuffer enabled
**Plans**: TBD

Plans:
- [ ] 05-01: Proof engine with WASM initialization, credential loading, and proof generation

### Phase 6: Wallet & Chain SDK
**Goal**: Users can connect their Starknet wallet, submit ZK proofs to the on-chain registry, and query verification results -- the complete chain interaction layer
**Depends on**: Phase 4, Phase 5
**Requirements**: SDK-02, SDK-03, SDK-04
**Success Criteria** (what must be TRUE):
  1. Users can connect ArgentX or Braavos wallet via the SDK and the connected account address is available for transaction signing
  2. A generated proof can be submitted to StarkShieldRegistry via a formatted transaction, and the SDK returns the transaction hash upon acceptance
  3. The SDK can query on-chain verification status by nullifier and return whether a verification exists, its attribute key, threshold, and timestamp
**Plans**: TBD

Plans:
- [ ] 06-01: Wallet connection and proof submission via starknet.js v8
- [ ] 06-02: Verification status querying and calldata formatting

### Phase 7: Web Application
**Goal**: A complete React SPA where users can view their credentials, generate and submit proofs, review past verifications, and understand exactly what data stays private -- the full user-facing product
**Depends on**: Phase 5, Phase 6
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06
**Success Criteria** (what must be TRUE):
  1. The Credential Wallet view displays loaded credentials with issuer name, attribute type, expiration status, and a "Generate Proof" action button per credential
  2. The Proof Generator view lets users select an attribute, set a threshold, see real-time proof generation progress, preview public outputs before submission, and submit the proof on-chain
  3. The Verification Dashboard shows past verifications with truncated nullifier, attribute, timestamp, and clickable Starkscan transaction links
  4. Privacy callout annotations ("this data stays on your device") appear at credential loading, proof generation, and before submission
  5. The application works in Chrome, Firefox, and Safari with COOP/COEP headers configured, and shows actionable error messages for expired credentials, wrong network, insufficient gas, rejected transactions, WASM load failures, and missing wallet extensions
**Plans**: TBD

Plans:
- [ ] 07-01: React SPA scaffold with COOP/COEP, wallet connect, and Credential Wallet view
- [ ] 07-02: Proof Generator view with progress indicators and public output preview
- [ ] 07-03: Verification Dashboard, privacy callouts, and error handling

### Phase 8: Demo & Submission
**Goal**: A polished hackathon submission package with a compelling demo video, clear documentation, and all DoraHacks artifacts -- the project is judge-ready
**Depends on**: Phase 7
**Requirements**: DEMO-02, DEMO-03, DEMO-05
**Success Criteria** (what must be TRUE):
  1. A demo video of 3 minutes or less shows the complete end-to-end flow: credential issuance, proof generation in browser, on-chain verification, and result querying -- with no cuts hiding errors
  2. The README includes a project overview, Mermaid architecture diagram, verified setup commands that work from a clean clone, and a deployment guide with Sepolia contract addresses
  3. The DoraHacks BUIDL submission is complete with project description, team info, Privacy track selection, GitHub repo link, demo video link, and deployed contract addresses
**Plans**: TBD

Plans:
- [ ] 08-01: Demo video recording and README documentation
- [ ] 08-02: DoraHacks BUIDL submission

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

Note: Phase 5 (Proof Engine SDK) depends only on Phase 2, not Phase 4. It can begin as soon as Phase 2 completes, potentially overlapping with Phases 3-4. Phase 6 requires both Phase 4 and Phase 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Toolchain Validation & Circuit Foundation | 2/2 | Complete | 2026-02-14 |
| 2. Age Verification Circuit | 1/1 | Complete | 2026-02-14 |
| 3. Membership Verification Circuit | 1/1 | Complete | 2026-02-14 |
| 4. Smart Contracts & Deployment | 0/2 | Not started | - |
| 5. Proof Engine SDK | 0/1 | Not started | - |
| 6. Wallet & Chain SDK | 0/2 | Not started | - |
| 7. Web Application | 0/3 | Not started | - |
| 8. Demo & Submission | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-14*
*Deadline: 2026-02-28 23:59 UTC*
