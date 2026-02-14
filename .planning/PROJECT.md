# StarkShield

## What This Is

StarkShield is a privacy-preserving credential verification protocol built on Starknet. It lets users prove specific attributes about themselves — age, membership status, KYC clearance — to on-chain smart contracts and dApps without revealing any underlying personal data. The protocol uses Noir zero-knowledge circuits compiled through the Garaga SDK to generate Cairo verifier contracts, creating a fully on-chain, trust-minimized verification pipeline where private data never leaves the user's device.

Built for the **Starknet Re{define} Hackathon — Privacy Track**. Deadline: **February 28, 2026**.

## Core Value

Users can prove who they are without revealing who they are — private credential verification that is fully on-chain, composable, and trust-minimized.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Noir ZK circuit for age verification (prove age >= threshold without revealing exact age)
- [ ] Noir ZK circuit for membership verification (prove group membership without revealing identity)
- [ ] Poseidon2-Schnorr signature verification inside circuits
- [ ] Per-dApp nullifier generation (unlinkable cross-dApp verifications)
- [ ] Expiration checking for credentials
- [ ] Cairo verifier contract auto-generated via Garaga SDK (UltraKeccakZK Honk)
- [ ] StarkShieldRegistry contract (trusted issuer registry, nullifier tracking, verification log, event emission)
- [ ] Contract deployment on Starknet Sepolia testnet
- [ ] TypeScript client SDK (proof generation via noir_js + backend_barretenberg WASM, wallet integration via starknet.js v8)
- [ ] React SPA with Credential Wallet view (load/display credentials)
- [ ] React SPA with Proof Generator view (select attribute, set threshold, generate proof, preview outputs, submit on-chain)
- [ ] React SPA with Verification Dashboard (past verifications, nullifier status, tx links)
- [ ] Argent X and Braavos wallet integration
- [ ] Demo credential issuer script (generates signed test credentials)
- [ ] Demo video (≤3 min) showing end-to-end flow
- [ ] DoraHacks BUIDL submission with all artifacts

### Out of Scope

- Real issuer integrations (KYC providers, governments, universities) — post-hackathon partnerships
- Mainnet deployment — requires security audit first
- Gateway contract (single-tx convenience wrapper) — nice-to-have, not MVP
- Mobile SDK — web-first for hackathon
- Cross-chain verification — Starknet-only for MVP
- W3C Verifiable Credentials format — custom compact format for circuit efficiency; W3C transformer is post-hackathon
- EdDSA/BabyJubJub adapter — Poseidon-Schnorr only for MVP (3x fewer constraints)
- Real-time chat/notifications — not relevant to protocol

## Context

**Hackathon:** Starknet Re{define} Hackathon, Privacy Track. Judging March 14, 2026.

**Competitive landscape:** No existing Starknet project does privacy-preserving credential verification. Mist.cash handles private transfers, Tongo handles confidential ERC-20, 0xbow handles compliant privacy pools — StarkShield fills the identity privacy gap.

**Key judge message:** "While Mist.cash and Tongo solve transaction privacy, StarkShield solves identity privacy — proving who you are without revealing who you are."

**Team:** Solo developer (Vincent) + AI pair programmer (Claude). No coordination overhead. Vincent handles architecture decisions, deployment, wallet testing, demo video. Claude handles code generation, boilerplate, testing, documentation.

**Timeline reality:** Original plan was a 4-week sprint (Feb 1–28). Actual start is Feb 14 — compressing full scope into 2 weeks. Every day counts.

## Constraints

- **Deadline**: February 28, 2026 23:59 UTC — hard, non-negotiable
- **Timeline**: 14 days from zero to submission — must parallelize aggressively
- **Tech stack (locked)**: Noir 1.0.0-beta.18, Garaga SDK 1.0.1, Cairo 2.15.x, Scarb 2.15.x, Starknet Foundry 0.56.0, starknet.js v8, React 19 + Vite 6 + TailwindCSS 4, @noir-lang/noir_js 1.0.0-beta.15, @noir-lang/backend_barretenberg 0.36.0
- **Python**: Garaga SDK requires Python 3.10 (not compatible with 3.11+)
- **Performance**: Proof generation < 30s in browser, on-chain verification < 500K gas
- **Credential types**: Exactly 2 for MVP (age verification + membership proof) — no scope creep
- **Network**: Starknet Sepolia testnet only
- **Circuit design**: Poseidon2-Schnorr signatures (5K-8K constraints vs 25K+ for EdDSA), custom compact credential format (8 fixed fields)
- **Nullifier scheme**: Per-dApp context-specific nullifiers for cross-dApp unlinkability

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Poseidon-Schnorr over EdDSA/BabyJubJub | 3x fewer constraints (5-8K vs 25K+), faster browser proving (~15s vs ~45s) | — Pending |
| Custom compact credential format over W3C VC | Flat struct hashes directly with Poseidon2, avoids JSON-LD parsing overhead in circuit | — Pending |
| Per-dApp nullifiers over global nullifiers | More privacy-preserving: verifications across dApps are unlinkable; supports credential renewal | — Pending |
| UltraKeccakZK Honk proof system | Bundled with Noir, compatible with Garaga SDK for Cairo verifier generation | — Pending |
| Poseidon2 external library (v0.1.1) | Moved out of Noir stdlib; must be imported as external dep in Nargo.toml | — Pending |
| Vite target ESNext | Required for bb.js top-level await support in browser | — Pending |

---
*Last updated: 2026-02-14 after initialization*
