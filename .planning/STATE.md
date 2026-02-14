# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Users can prove who they are without revealing who they are -- private credential verification that is fully on-chain, composable, and trust-minimized.
**Current focus:** Phase 4 - Smart Contracts & Deployment (COMPLETE -- both plans done)

## Current Position

Phase: 4 of 8 (Smart Contracts & Deployment) -- COMPLETE
Plan: 2 of 2 in current phase (complete)
Status: Phase 04 complete, ready for Phase 05 (Proof Engine SDK)
Last activity: 2026-02-14 -- Plan 04-02 executed (StarkShieldRegistry deployed + validated on Sepolia)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 47min
- Total execution time: 4.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2/2 | 237min | 119min |
| 02 | 1/1 | 4min | 4min |
| 03 | 1/1 | 4min | 4min |
| 04 | 2/2 | 37min | 19min |

**Recent Trend:**
- Last 5 plans: 4min, 4min, 25min, 12min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: @noir-lang/backend_barretenberg is deprecated; must use @aztec/bb.js instead
- [Roadmap]: Garaga v1.0.1 tested on Noir beta.16, project uses beta.18 -- Day 1 spike validates compatibility
- [01-01]: Downgraded nargo to beta.16 for garaga 1.0.1 compatibility (beta.18 triggers version warning)
- [01-01]: Downgraded scarb to 2.14.0 (2.15.2 causes infinite compilation of garaga contracts)
- [01-01]: bb prove requires explicit -k VK path; CRS must be pre-downloaded to ~/.bb-crs/
- [01-02]: Schnorr library uses EmbeddedCurvePoint struct from std::embedded_curve_ops
- [01-02]: bb.js poseidon2Hash matches Noir Poseidon2::hash (no message_size param needed in bb.js)
- [01-02]: bb verify requires explicit -i public_inputs_path flag
- [01-02]: @aztec/bb.js@0.82.3 used for TypeScript credential issuance
- [Roadmap]: Phase 5 (Proof Engine SDK) can overlap with Phases 3-4 since it only needs Phase 2 circuit artifacts
- [02-01]: Hard-assert all checks (signature, expiration, age >= threshold) -- proof existence IS the pass signal
- [02-01]: Return values for computed outputs instead of Phase 1's expected-value assertion pattern
- [02-01]: Public output ordering: pub params first (declaration order), then return values (tuple order)
- [02-01]: 1,224 ACIR opcodes for age_verify circuit (well under 5,000 target)
- [03-01]: Linear scan over [Field; 8] for set membership -- 29 extra ACIR opcodes vs Merkle tree complexity
- [03-01]: Zero-value guard (assert attribute_value != 0) prevents false match on zero-padded array slots
- [03-01]: Return Poseidon2 hash of allowed_set for compact on-chain verification (1 Field vs 8)
- [03-01]: 1,253 ACIR opcodes for membership_proof circuit (only 29 more than age_verify)
- [03-01]: 16 public fields in membership_proof bb proof: 4 scalar params + 8 array elements + 4 return values
- [04-01]: Garaga public_inputs_size (25/32) includes internal Honk elements beyond Noir-level count (9/16)
- [04-01]: garaga verify-onchain requires explicit --public-inputs flag for Honk proofs
- [04-01]: Env vars follow garaga convention: SEPOLIA_RPC_URL, SEPOLIA_ACCOUNT_PRIVATE_KEY, SEPOLIA_ACCOUNT_ADDRESS
- [04-01]: Verifier interface: verify_ultra_keccak_zk_honk_proof(Span<felt252>) -> Result<Span<u256>, felt252>
- [04-01]: Gas baseline: ~2.19 STRK per verifier-only call (128 l1_data_gas)
- [04-02]: Hand-rolled ownable (assert_only_owner) instead of OpenZeppelin due to Scarb 2.14.0 version gap
- [04-02]: sncast for registry deployment (garaga CLI only for verifier contracts)
- [04-02]: u256 calldata serialization: low 128 bits first, high 128 bits second
- [04-02]: verify_and_register gas: ~2.25 STRK (l2_gas 281M, l1_data_gas 768) -- registry adds minimal overhead
- [04-02]: Both demo issuers (age + membership) have different key pairs -- both registered as trusted

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 RESOLVED]: Garaga v1.0.1 compatibility confirmed with Noir beta.16 (beta.18 was incompatible, downgraded)
- [Phase 1]: nargo beta.16 ACIR artifacts with noir_js -- version gap may cause issues (was beta.18 gap, now beta.16)
- [Phase 1 RESOLVED]: scarb 2.15.x incompatible with garaga contracts -- must use scarb 2.14.0
- [Phase 1 RESOLVED]: @aztec/bb.js Poseidon2 and Schnorr TypeScript APIs confirmed working -- cross-validation tests pass

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 04-02-PLAN.md (Phase 04 complete -- all contracts deployed on Sepolia)
Resume file: .planning/phases/04-smart-contracts-deployment/04-02-SUMMARY.md
