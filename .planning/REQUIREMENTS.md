# Requirements: StarkShield

**Defined:** 2026-02-14
**Core Value:** Users can prove who they are without revealing who they are -- private credential verification that is fully on-chain, composable, and trust-minimized.

## v1 Requirements

Requirements for hackathon submission (Starknet Re{define}, Privacy Track, Feb 28 deadline).

### ZK Circuits

- [ ] **CIRC-01**: Age verification circuit proves attribute_value >= threshold without revealing exact value
- [ ] **CIRC-02**: Membership verification circuit proves attribute_value is in allowed set without revealing identity
- [ ] **CIRC-03**: Poseidon2-Schnorr signature verification over credential fields inside circuit
- [ ] **CIRC-04**: Expiration check (current_timestamp < expires_at) enforced inside circuit
- [ ] **CIRC-05**: Per-dApp nullifier = Poseidon2(user_secret, msg_hash, context_id) prevents replay without linking identity across dApps
- [ ] **CIRC-06**: Public outputs limited to: (passed: bool, nullifier, issuer_pubkey, attribute_key, threshold) -- no private data revealed
- [ ] **CIRC-07**: Shared library crate for Poseidon2 hashing, signature verification, nullifier derivation, and credential struct definition
- [ ] **CIRC-08**: Circuit constraints < 50K (target < 2^16 for acceptable browser proving performance)

### Smart Contracts

- [ ] **CONT-01**: Garaga-generated HonkVerifier contract (UltraKeccakZK Honk) deployed on Starknet Sepolia
- [ ] **CONT-02**: StarkShieldRegistry with trusted_issuers mapping (owner-managed add/remove)
- [ ] **CONT-03**: Nullifier tracking -- reject previously-seen nullifiers in same context to prevent replay
- [ ] **CONT-04**: Verification log -- store (nullifier -> verification record) for dApp queries
- [ ] **CONT-05**: VerificationPassed event emission (nullifier, attribute_key, threshold, timestamp) for downstream dApps
- [ ] **CONT-06**: verify_and_register() with circuit_id routing for age (0) and membership (1) credential types
- [ ] **CONT-07**: On-chain verification gas cost < 500,000 gas units per verification

### Client SDK

- [ ] **SDK-01**: Browser WASM proof generation via @noir-lang/noir_js + @aztec/bb.js
- [ ] **SDK-02**: Wallet connection to ArgentX and Braavos via starknet.js v8
- [ ] **SDK-03**: Proof transaction submission to StarkShieldRegistry with calldata formatting
- [ ] **SDK-04**: On-chain verification status querying (read registry nullifier/verification mappings)
- [ ] **SDK-05**: Credential loading from JSON files with validation
- [ ] **SDK-06**: Proof generation time < 30 seconds on modern hardware (M1/equivalent)

### Web Application

- [ ] **WEB-01**: Credential Wallet view -- display loaded credentials with issuer name, attribute type, expiration status, and "Generate Proof" action
- [ ] **WEB-02**: Proof Generator view -- attribute selector, threshold input, real-time progress indicator, public output preview before submission
- [ ] **WEB-03**: Verification Dashboard -- past verifications with nullifier (truncated), attribute, timestamp, and Starkscan transaction links
- [ ] **WEB-04**: Privacy callout annotations -- visual indicators showing "this data stays on your device" at key points
- [ ] **WEB-05**: Cross-browser WASM compatibility (Chrome, Firefox, Safari) with COOP/COEP headers for SharedArrayBuffer
- [ ] **WEB-06**: Error handling with actionable messages (expired credential, wrong network, insufficient gas, rejected tx, WASM load failure, wallet not installed)

### Demo & Submission

- [ ] **DEMO-01**: Demo credential issuer script -- generates Poseidon2-Schnorr keypair, signs demo credentials, outputs JSON
- [ ] **DEMO-02**: Demo video <=3 minutes showing full end-to-end flow (credential issuance -> proof generation -> on-chain verification)
- [ ] **DEMO-03**: README with project overview, Mermaid architecture diagram, verified setup commands, deployment guide
- [ ] **DEMO-04**: Contracts deployed on Starknet Sepolia with verified addresses resolvable on Starkscan
- [ ] **DEMO-05**: DoraHacks BUIDL submission with project description, team info, Privacy track, GitHub repo, demo video, contract addresses

## v2 Requirements

Deferred to post-hackathon. Tracked but not in current roadmap.

### Extended Credentials

- **CRED-01**: W3C Verifiable Credentials format support via credential transformer
- **CRED-02**: EdDSA/BabyJubJub adapter circuit for interoperability with Semaphore/Polygon ID
- **CRED-03**: Additional credential types beyond age and membership (KYC clearance, credit score range)

### Infrastructure

- **INFRA-01**: StarkShieldGateway contract (single-transaction wrapper: submit + verify + register)
- **INFRA-02**: Mainnet deployment with audited contracts
- **INFRA-03**: AES-256-GCM encrypted credential storage on client device
- **INFRA-04**: Credential revocation system

### Platform

- **PLAT-01**: Mobile SDK (React Native or native)
- **PLAT-02**: Cross-chain verification (bridging proofs to Ethereum L1 or other L2s)
- **PLAT-03**: Real issuer integrations (KYC providers, governments, universities)
- **PLAT-04**: Decentralized issuer governance (DAO-based issuer management)

## Out of Scope

Explicitly excluded from hackathon MVP. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real KYC/identity provider integration | Requires partnerships; post-hackathon business development |
| Mainnet deployment | Requires security audit; Sepolia demo sufficient for hackathon |
| Gateway contract | Nice-to-have convenience wrapper; not core to demo |
| Mobile SDK | Web-first; browser WASM proving is the novel demo |
| Cross-chain verification | Starknet-only; cross-chain adds complexity without hackathon value |
| W3C VC format | Custom compact format is 3x more circuit-efficient; transformer is post-hackathon |
| EdDSA/BabyJubJub | Poseidon-Schnorr is 3x fewer constraints; interop adapter is post-hackathon |
| Encrypted credential storage | Local JSON sufficient for demo; encryption adds scope |
| Recursive proof composition | Massive complexity increase; not needed for 2 credential types |
| DAO governance for issuers | Owner-managed registry sufficient for MVP |
| Real-time notifications | Not relevant to verification protocol |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CIRC-01 | Phase 2: Age Verification Circuit | Pending |
| CIRC-02 | Phase 3: Membership Verification Circuit | Pending |
| CIRC-03 | Phase 2: Age Verification Circuit | Pending |
| CIRC-04 | Phase 2: Age Verification Circuit | Pending |
| CIRC-05 | Phase 2: Age Verification Circuit | Pending |
| CIRC-06 | Phase 2: Age Verification Circuit | Pending |
| CIRC-07 | Phase 1: Toolchain Validation & Circuit Foundation | Pending |
| CIRC-08 | Phase 1: Toolchain Validation & Circuit Foundation | Pending |
| CONT-01 | Phase 4: Smart Contracts & Deployment | Pending |
| CONT-02 | Phase 4: Smart Contracts & Deployment | Pending |
| CONT-03 | Phase 4: Smart Contracts & Deployment | Pending |
| CONT-04 | Phase 4: Smart Contracts & Deployment | Pending |
| CONT-05 | Phase 4: Smart Contracts & Deployment | Pending |
| CONT-06 | Phase 4: Smart Contracts & Deployment | Pending |
| CONT-07 | Phase 4: Smart Contracts & Deployment | Pending |
| SDK-01 | Phase 5: Proof Engine SDK | Pending |
| SDK-02 | Phase 6: Wallet & Chain SDK | Pending |
| SDK-03 | Phase 6: Wallet & Chain SDK | Pending |
| SDK-04 | Phase 6: Wallet & Chain SDK | Pending |
| SDK-05 | Phase 5: Proof Engine SDK | Pending |
| SDK-06 | Phase 5: Proof Engine SDK | Pending |
| WEB-01 | Phase 7: Web Application | Pending |
| WEB-02 | Phase 7: Web Application | Pending |
| WEB-03 | Phase 7: Web Application | Pending |
| WEB-04 | Phase 7: Web Application | Pending |
| WEB-05 | Phase 7: Web Application | Pending |
| WEB-06 | Phase 7: Web Application | Pending |
| DEMO-01 | Phase 1: Toolchain Validation & Circuit Foundation | Pending |
| DEMO-02 | Phase 8: Demo & Submission | Pending |
| DEMO-03 | Phase 8: Demo & Submission | Pending |
| DEMO-04 | Phase 4: Smart Contracts & Deployment | Pending |
| DEMO-05 | Phase 8: Demo & Submission | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after roadmap creation*
