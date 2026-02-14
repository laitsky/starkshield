# Project Research Summary

**Project:** StarkShield -- Privacy-Preserving Credential Verification on Starknet
**Domain:** ZK Credential Verification Protocol (Hackathon Submission -- Re{define} Privacy Track)
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Executive Summary

StarkShield is a privacy-preserving credential verification protocol for Starknet, targeting the Re{define} Hackathon Privacy Track (deadline Feb 28, 2026; $9,675 STRK prize pool). The protocol proves credential attributes (age, membership) without revealing underlying identity data using Noir ZK circuits verified on-chain via Garaga-generated Cairo verifier contracts. This is the only credential verification project in the Starknet ecosystem -- competitors (Privado ID, zkPass, Semaphore) operate on EVM chains. The "SNARKs-verified-inside-STARKs" architecture via Garaga is technically novel and directly aligned with the hackathon's curated prompt of "prove attributes without revealing identity."

The recommended build approach follows a strict circuit-first, bottom-up pipeline: Noir circuits (compiled with nargo 1.0.0-beta.18) produce verification keys consumed by Garaga 1.0.1 to auto-generate Cairo verifier contracts, which are wrapped by a hand-written StarkShieldRegistry contract for state management. The browser frontend uses noir_js + bb.js WASM for client-side proof generation and starknet.js for on-chain submission. The critical architectural insight is that build dependencies flow strictly upward -- circuits before contracts before SDK before frontend -- with limited parallelization opportunities. Two circuits (age verification and membership proof) share a common library crate and the same Garaga verification pattern.

The primary risk is **version compatibility across the Noir/Barretenberg/Garaga/Cairo toolchain**. Garaga v1.0.1 was tested against Noir beta.16 but the project uses beta.18; the npm package `@noir-lang/noir_js` lags at beta.15 while the CLI compiler is at beta.18; and the deprecated `@noir-lang/backend_barretenberg` must be replaced with `@aztec/bb.js`. These version gaps must be validated end-to-end in a Day 1 spike before any application logic is written. Secondary risks include browser WASM proving performance (must stay under 2^16 constraints for acceptable proving time) and the small-domain brute force attack on age values (circuit must never expose hashes derived solely from age).

## Key Findings

### Recommended Stack

The stack spans four layers: ZK circuits (Noir 1.0.0-beta.18 + Barretenberg), smart contracts (Cairo 2.15.0 via Scarb 2.15.2), verifier generation (Garaga 1.0.1 with Python 3.10), and frontend (React 19 + Vite 6 + TailwindCSS 4). The most critical finding is that `@noir-lang/backend_barretenberg v0.36.0` specified in the original project context is **deprecated and must be replaced** with `@aztec/bb.js 3.0.0-nightly.20251104`. All versions must be pinned exactly -- no ranges, no "latest" tags.

**Core technologies:**
- **Noir 1.0.0-beta.18 + Barretenberg (bbup-matched):** ZK circuit language and proving backend -- purpose-built for ZK with clean syntax and first-class Garaga support
- **Garaga 1.0.1 (Python CLI + Scarb dep):** Auto-generates Cairo verifier contracts from Noir verification keys -- the only production tool for Starknet-native ZK verification
- **@noir-lang/noir_js 1.0.0-beta.15 + @aztec/bb.js 3.0.0-nightly.20251104:** Browser-side witness generation and WASM proof generation -- enables client-side proving without a backend
- **Cairo 2.15.0 (Scarb 2.15.2) + Starknet Foundry 0.56.0:** Smart contract development and testing for Starknet Sepolia
- **React 19 + Vite 6 + starknet-react 5.0.3:** Frontend with wallet integration (ArgentX, Braavos) and ESNext/WASM support via vite-plugin-node-polyfills
- **starknet.js 8.9.0:** Blockchain interaction (use v8 stable, not v9 pre-release)

**Critical version action items:**
1. Replace `@noir-lang/backend_barretenberg` with `@aztec/bb.js`
2. Validate nargo beta.18 circuits work with noir_js beta.15 and Garaga 1.0.1 (2-version gap)
3. Confirm Garaga-generated Cairo code compiles under Scarb 2.15.2 (Garaga targets Cairo 2.12 edition)
4. Use Python 3.10 specifically for Garaga (not 3.11+)

### Expected Features

**Must have (table stakes -- judges expect these):**
- Age threshold circuit (Noir) -- proves age >= threshold without revealing birthdate
- Issuer signature verification in circuit -- credentials signed by trusted authority
- On-chain proof verification via Garaga-generated Cairo verifier
- Verification result registry contract -- stores results without private data
- React SPA with wallet connect (ArgentX/Braavos)
- Client-side proof generation (browser WASM)
- End-to-end proof submission flow
- Demo credential issuer (judges need test credentials)
- 3-minute demo video (explicit submission requirement)
- README with architecture overview

**Should have (differentiators -- what wins):**
- Membership circuit (Merkle proof) -- proves protocol generality with a second credential type
- Issuer registry contract -- multi-issuer support shows protocol thinking
- Visual privacy callouts in UI -- "this data stays on your device" annotations
- Credential wallet card UI -- makes it feel like a product
- Verification dashboard (public view of on-chain events)
- Progress indicators during proof generation (15-30s wait needs feedback)
- Error handling with actionable messages

**Defer (post-hackathon -- do NOT build):**
- Real KYC/identity provider integration
- Cross-chain credential portability
- Credential revocation system
- Encrypted credential storage
- Recursive proof composition
- DAO governance for issuer management

### Architecture Approach

The architecture follows a four-layer model: Circuit Layer (Noir workspace with shared_lib + binary crates), Contract Layer (Garaga auto-generated HonkVerifier + hand-written StarkShieldRegistry), SDK Layer (framework-agnostic TypeScript wrapping noir_js, bb.js, starknet.js), and Presentation Layer (React SPA). The key patterns are **circuit-first development** (circuit defines the trust boundary; all other layers derive from it), **layered proof pipeline** (witness -> proof -> calldata -> submission as separate testable stages), and **registry-as-orchestrator** (StarkShieldRegistry wraps HonkVerifier with nullifier tracking and issuer trust -- users never call HonkVerifier directly).

**Major components:**
1. **shared_lib (Noir library)** -- Poseidon2 hashing, Schnorr sig verification, nullifier derivation, credential struct; shared by all circuit binary crates
2. **age_verify + membership_proof (Noir binaries)** -- Two circuit types proving different credential attributes; compile to ACIR for browser proving
3. **HonkVerifier (Cairo, auto-generated)** -- Garaga-generated on-chain verifier; treated as read-only build artifact, never manually edited
4. **StarkShieldRegistry (Cairo, hand-written)** -- Orchestrator contract managing trusted issuers, nullifier tracking, verification logging, and events
5. **Proof Engine (TypeScript SDK)** -- Initializes WASM, computes witnesses, generates proofs, formats calldata; the heaviest browser-side module
6. **React SPA** -- Three views (Credential Wallet, Proof Generator, Verification Dashboard) consuming the SDK via custom hooks

### Critical Pitfalls

1. **Garaga/Noir/Barretenberg version mismatch (CRITICAL)** -- Garaga 1.0.1 expects Noir beta.16 but project uses beta.18; `@noir-lang/backend_barretenberg` is deprecated. Prevention: validate the full compile -> prove -> verify-on-chain loop end-to-end on Day 1 before writing any application logic. Recovery cost: HIGH (2-3 days if caught late).

2. **Circuit constraint count exceeding browser WASM ceiling (CRITICAL)** -- Browser proving has practical limit at 2^16 constraints (~65K) for acceptable 30s proving time. Poseidon2 + Schnorr + nullifier + expiry can stack up fast. Prevention: set constraint budget per feature, measure with `nargo info` after every addition, test in browser (not just Node.js). Recovery cost: HIGH.

3. **Small-domain hash brute force on age values (CRITICAL)** -- Only 121 possible ages; any public hash derived from age alone is trivially brute-forceable. Prevention: never expose any deterministic transformation of small-domain values as public outputs; nullifiers must include high-entropy secrets. Recovery cost: HIGH (requires circuit redesign).

4. **Unconstrained functions creating under-constrained circuits (CRITICAL)** -- Noir `unconstrained` functions skip constraint generation; forgetting to verify results in constrained context makes the circuit unsound. Prevention: treat as `unsafe`, add adversarial tests, minimize usage at <50K constraints. Recovery cost: MEDIUM.

5. **Missing COOP/COEP headers for SharedArrayBuffer (MODERATE)** -- Barretenberg WASM needs cross-origin isolation for multi-threaded proving; without it, proving is 2-4x slower or fails entirely. Prevention: configure vite-plugin-cross-origin-isolation from the start. Recovery cost: LOW.

## Implications for Roadmap

Based on combined research, the project has strict build-order dependencies that dictate phase structure. The Noir circuits must exist before Garaga can generate verifiers, verifiers must be deployed before the SDK can submit transactions, and the SDK must work before the frontend is useful.

### Phase 0: Environment Setup and Version Validation Spike

**Rationale:** The #1 risk across all research is version incompatibility between 6+ tools (Noir, Barretenberg, Garaga, Cairo/Scarb, noir_js, bb.js). Research shows Garaga expects Noir beta.16 but project uses beta.18, and the npm packages lag behind CLI tools. This MUST be resolved before any feature work begins. Every researcher flagged this as Day 1.
**Delivers:** Validated toolchain with a trivial circuit compiled, proved, verified on-chain, and proved in browser. A `versions.env` file pinning all tool versions. Python 3.10 venv for Garaga.
**Addresses:** Environment prerequisites, developer setup
**Avoids:** Pitfall 1 (version mismatch), Pitfall 4 (Python version), Pitfall 10 (compiler version field), Pitfall 12 (Starknet account setup)

### Phase 1: Circuit Development (shared_lib + age_verify)

**Rationale:** Circuit-first development is the recommended pattern. The circuit defines the entire protocol surface -- public/private input boundaries, nullifier scheme, signature verification approach. All downstream layers derive from it. The age verification circuit is the core table-stakes feature.
**Delivers:** Working age_verify circuit with issuer signature verification, nullifier derivation, expiry check. Compiled ACIR artifacts and verification keys. Constraint budget validated (<2^16). Adversarial test suite.
**Addresses:** Age threshold circuit, issuer signature scheme, public/private separation
**Avoids:** Pitfall 2 (constraint ceiling), Pitfall 3 (small-domain brute force), Pitfall 5 (unconstrained functions), Pitfall 11 (accidental pub)

### Phase 2: Contract Development and Deployment

**Rationale:** Depends on Phase 1 verification keys. Garaga generates the HonkVerifier from VK; the StarkShieldRegistry wraps it with application logic. Must deploy to Sepolia early (not on demo day) to catch declaration cost issues and faucet limitations.
**Delivers:** Deployed HonkVerifier and StarkShieldRegistry on Starknet Sepolia. Trusted issuer registered. End-to-end on-chain verification tested via CLI.
**Addresses:** On-chain proof verification, verification result registry, issuer registry
**Avoids:** Pitfall 8 (declaration cost), Pitfall 9 (signature replay/nullifier), Pitfall 13 (access control)

### Phase 3: SDK and Frontend Core

**Rationale:** Depends on Phase 1 artifacts (circuit JSON for proof engine) and Phase 2 outputs (contract addresses for chain interface). The SDK is the integration layer between browser proving and on-chain verification. Frontend needs the SDK to do anything meaningful.
**Delivers:** Working Proof Engine with browser WASM proving, Credential Manager, Chain Interface. React SPA with wallet connect, proof generation UI, verification submission flow. Demo credential issuer script.
**Addresses:** Client-side proof generation, wallet connection, proof submission flow, demo credential issuance, verification status display
**Avoids:** Pitfall 6 (COOP/COEP headers), Pitfall 7 (Vite config)

### Phase 4: Second Circuit and Stretch Features

**Rationale:** The membership circuit (Merkle proof) is the highest-impact differentiator -- it proves the protocol is general-purpose, not a one-trick demo. It reuses the shared_lib and same Garaga pattern, so the infrastructure from Phases 1-3 accelerates it. Only attempt after core flow works end-to-end.
**Delivers:** Membership proof circuit, second verifier deployment, multi-credential UI. Stretch: privacy callout annotations, verification dashboard, credential wallet cards.
**Addresses:** Multiple credential types (membership), issuer registry contract, visual privacy callouts, credential wallet view, verification dashboard
**Avoids:** Scope creep (hard stop at 2 credential types)

### Phase 5: Polish, Demo, and Submission

**Rationale:** Hackathon judging is heavily influenced by demo quality, code cleanliness, and documentation. A working but poorly presented project loses to a slightly less ambitious but well-demonstrated one. Must have buffer for testnet issues during recording.
**Delivers:** 3-minute demo video, polished README with architecture diagram, error handling for edge cases, deployed demo link on Sepolia.
**Addresses:** Demo video, README/docs, error handling, deployed Starknet link
**Avoids:** Demo video re-recording due to testnet issues (record with pre-generated proofs as backup)

### Phase Ordering Rationale

- **Phases 0-1-2 are strictly sequential:** Circuits must compile before Garaga can generate verifiers, and verifiers must deploy before on-chain testing works. No parallelization possible on the critical path.
- **Phase 3 has partial overlap with Phase 2:** The Credential Manager and React shell can be built against mock data while contracts are being deployed. The Proof Engine needs one compiled circuit artifact (available from Phase 1).
- **Phase 4 is independent of Phase 3 on the circuit side:** The membership circuit can be designed in parallel with frontend work since it reuses shared_lib. But its verifier deployment and frontend integration depend on the patterns established in Phases 2-3.
- **Phase 5 is a hard timebox, not a "remaining features" bucket:** Set a firm cutoff (e.g., 2 days before deadline) to switch to polish-only mode.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 0:** Needs a concrete spike plan -- exact commands to validate the version chain end-to-end. The Garaga beta.16 vs. beta.18 gap is the biggest unknown. If it fails, the entire Noir version must be downgraded.
- **Phase 1:** Circuit design for nullifier derivation and Poseidon2 hashing needs careful specification. The Schnorr signature scheme (which curve? Grumpkin? BN254 embedded?) needs validation against bb.js TypeScript capabilities.
- **Phase 2:** Garaga-generated contract interaction pattern (how StarkShieldRegistry calls HonkVerifier, how to extract public inputs from the verification result) has sparse documentation beyond the Garaga README.

Phases with standard patterns (skip deep research):
- **Phase 3:** React + Vite + starknet-react is well-documented. noir_js + bb.js browser integration has an official tutorial. The Vite config from STACK.md research is copy-paste ready.
- **Phase 5:** Demo recording and README writing are standard practices.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core tools verified against official docs and npm; version compatibility between Garaga/Noir/bb.js has a 2-version gap that is unvalidated. The deprecated backend_barretenberg is a confirmed finding (HIGH confidence), but the beta.18-to-beta.15 artifact compatibility is theoretical (LOW confidence). |
| Features | MEDIUM-HIGH | Feature landscape well-mapped against competitors and hackathon criteria. Judging rubric derived from multiple hackathon sources. Feature dependencies are clear. |
| Architecture | MEDIUM | Core flow (circuit -> Garaga -> contract -> SDK -> frontend) verified with official docs. Integration seams (Garaga npm package for calldata, StarkShieldRegistry calling HonkVerifier) have limited documentation. Project structure follows reference projects (scaffold-garaga, sn-noir-quickstart). |
| Pitfalls | MEDIUM | Critical pitfalls sourced from OpenZeppelin audit guide (HIGH confidence), Garaga docs (MEDIUM), and community benchmarks (MEDIUM). Performance numbers (constraint-to-proving-time mapping) are from community benchmarks, not official. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Garaga v1.0.1 compatibility with Noir beta.18:** No documentation confirms this works. Must be validated in Phase 0 spike. Fallback: downgrade to Noir beta.16.
- **nargo beta.18 ACIR artifacts with noir_js beta.15:** The compiled circuit format may have changed between these versions. Must test in Phase 0.
- **Garaga npm package (`garaga` on npm) for browser-side calldata formatting:** Architecture assumes this exists and works. Verify it exports `getZKHonkCallData` or equivalent. Fallback: generate calldata server-side with Python CLI.
- **@aztec/bb.js Poseidon2 TypeScript API:** The issuer script needs to hash credentials with Poseidon2 in TypeScript in a way that matches Noir's stdlib. Confirm bb.js exposes this API.
- **Schnorr key generation in @aztec/bb.js:** The demo issuer needs to generate Schnorr keypairs. Confirm bb.js exports this functionality for TypeScript use.
- **StarkShieldRegistry calling HonkVerifier:** The exact Cairo interface for cross-contract calls to the Garaga-generated verifier needs to be confirmed from Garaga's generated code.

## Sources

### Primary (HIGH confidence)
- [Noir Official Documentation](https://noir-lang.org/docs/) -- NoirJS tutorial, stdlib, installation, workspaces
- [Noir GitHub Releases](https://github.com/noir-lang/noir/releases) -- v1.0.0-beta.18 release notes
- [Garaga GitHub Releases](https://github.com/keep-starknet-strange/garaga/releases) -- v1.0.0/v1.0.1 release notes, version pins, security advisories
- [Garaga Documentation](https://garaga.gitbook.io/garaga/) -- Installation, Noir verifier generation, UltraKeccakZK Honk workflow
- [OpenZeppelin: Building Safe Noir Circuits](https://www.openzeppelin.com/news/developer-guide-to-building-safe-noir-circuits) -- Small-domain attacks, unconstrained function safety
- [Scarb GitHub Releases](https://github.com/software-mansion/scarb/releases) -- v2.15.2 with Cairo 2.15.0
- [Starknet Foundry Releases](https://github.com/foundry-rs/starknet-foundry/releases) -- v0.56.0
- [starknet.js npm/GitHub](https://www.npmjs.com/package/starknet) -- v8.9.0 stable
- [Starknet Cairo Book](https://www.starknet.io/cairo-book/) -- Events, storage mappings, security
- [Noir Schnorr stdlib](https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/schnorr/) -- Signature verification
- [NAVe: Formally Verifying Noir Programs](https://arxiv.org/abs/2601.09372) -- Formal verification research

### Secondary (MEDIUM confidence)
- [Starknet Re{define} Hackathon](https://hackathon.starknet.org/) -- Privacy track details, curated ideas, submission requirements
- [Starknet Blog: Noir on Starknet](https://www.starknet.io/blog/noir-on-starknet/) -- Garaga + Noir integration workflow
- [noir-lang/poseidon GitHub](https://github.com/noir-lang/poseidon) -- v0.2.3
- [noir-lang/schnorr GitHub](https://github.com/noir-lang/schnorr) -- v0.1.3
- [scaffold-garaga](https://github.com/KevinSheeranxyj/scaffold-garaga) -- Reference architecture
- [sn-noir-quickstart](https://github.com/m-kus/sn-noir-quickstart) -- Workshop repo
- [Privado ID / zkPass / Semaphore docs](https://docs.privado.id/) -- Competitor feature analysis
- [Noir Benchmarks (Savio-Sou)](https://github.com/Savio-Sou/noir-benchmarks) -- Constraint-to-time mapping

### Tertiary (LOW confidence, needs validation)
- @zkpassport/poseidon2 TypeScript library -- BN254 field compatibility unverified
- Garaga npm package browser calldata API -- functionality and export names unverified
- @aztec/bb.js Poseidon2 and Schnorr TypeScript API surface -- assumed but not confirmed in docs

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
