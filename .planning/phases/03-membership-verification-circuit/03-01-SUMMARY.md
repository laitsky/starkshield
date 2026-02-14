---
phase: 03-membership-verification-circuit
plan: 01
subsystem: circuits
tags: [noir, zk-proof, membership-verification, set-membership, schnorr, poseidon2, nullifier, barretenberg]

# Dependency graph
requires:
  - phase: 01-toolchain-validation-circuit-foundation
    provides: shared_lib (Credential, Schnorr, nullifier, Poseidon2), bb pipeline patterns, issuer.ts
  - phase: 02-age-verification-circuit
    provides: age_verify circuit structure to mirror, public output ordering pattern, hard-assert pattern
provides:
  - membership_proof Noir circuit with set membership check, signature verification, expiration enforcement, nullifier derivation
  - Compiled circuit artifact (target/membership_proof.json)
  - Verified bb proof pipeline (execute, write_vk, prove, verify)
  - Empirically documented public output ordering (16 fields)
  - Updated issuer.ts with membership Prover.toml generation (allowed_set instead of threshold)
affects: [phase-04-starknet-contract, phase-05-sdk]

# Tech tracking
tech-stack:
  added: []
  patterns: [linear-scan-set-membership, zero-value-guard, allowed-set-hash-poseidon2, array-public-inputs]

key-files:
  created:
    - circuits/crates/membership_proof/Nargo.toml
    - circuits/crates/membership_proof/src/main.nr
    - circuits/crates/membership_proof/Prover.toml
  modified:
    - circuits/Nargo.toml
    - scripts/issuer.ts

key-decisions:
  - "Linear scan over [Field; 8] for set membership check -- 29 extra ACIR opcodes vs Merkle tree complexity"
  - "Zero-value guard (assert attribute_value != 0) prevents false match on zero-padded array slots"
  - "Return Poseidon2 hash of allowed_set for compact on-chain verification (1 Field vs 8)"
  - "1,253 ACIR opcodes -- only 29 more than age_verify's 1,224, both well under 50K target"
  - "16 public fields in bb proof: 4 scalar params + 8 array elements + 4 return values"

patterns-established:
  - "Set membership via linear scan: for-loop with boolean accumulation over fixed-size pub array"
  - "Array public inputs: serialized as individual Field elements in bb public_inputs file"
  - "Allowed set hashing: Poseidon2::hash(allowed_set, 8) for compact on-chain set verification"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 3 Plan 1: Membership Verification Circuit Summary

**Membership proof Noir circuit with linear-scan set membership over [Field; 8], Schnorr signature verification, zero-value guard, Poseidon2 set hashing, and validated bb pipeline at 1,253 ACIR opcodes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T12:54:44Z
- **Completed:** 2026-02-14T12:59:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built membership_proof circuit mirroring age_verify structure exactly, changing only the domain-specific check (set membership instead of age threshold)
- All 6 nargo tests pass: valid membership, expired rejection, not-in-set rejection, wrong signature rejection, different context different nullifier, same context same nullifier
- Full bb pipeline validated: execute -> write_vk -> prove -> verify all exit 0 with "Proof verified successfully"
- Public output ordering documented empirically: 16 fields (4 scalar pub params + 8 allowed_set elements + 4 return values)
- 1,253 ACIR opcodes (only 29 more than age_verify's 1,224) -- linear scan + zero guard + Poseidon2 hash adds negligible overhead
- Updated issuer.ts generateProverToml to support membership type with allowed_set field

## Task Commits

Each task was committed atomically:

1. **Task 1: Create membership_proof circuit crate with Noir tests and update issuer.ts** - `613046f` (feat)
2. **Task 2: Validate full bb prove/verify pipeline and document public output ordering** - `eba56cb` (docs)

## Files Created/Modified
- `circuits/crates/membership_proof/Nargo.toml` - Binary crate config with shared_lib and poseidon deps
- `circuits/crates/membership_proof/src/main.nr` - Membership verification circuit (15 params including [Field; 8] array + return tuple) with 6 tests and public output documentation
- `circuits/crates/membership_proof/Prover.toml` - Default witness inputs with membership credential and allowed_set [100, 200, 300, 0, 0, 0, 0, 0]
- `circuits/Nargo.toml` - Updated workspace with membership_proof member added
- `scripts/issuer.ts` - Updated generateProverToml to accept isMembership flag, outputs allowed_set for membership circuits

## Decisions Made
- **Linear scan over fixed array:** Used for-loop with boolean accumulation over `[Field; 8]` instead of Merkle tree. Adds only 29 ACIR opcodes for N=8 set membership check -- Merkle trees are dramatically more complex for no benefit at this set size.
- **Zero-value guard:** Added `assert(attribute_value != 0)` as defense-in-depth to prevent zero-padded array slots from producing false membership matches.
- **Allowed set hash return value:** Return `Poseidon2::hash(allowed_set, 8)` instead of echoing the full 8-element array, giving the on-chain contract a single Field to store/compare.
- **1,253 ACIR opcodes:** No optimization needed -- both circuits are extremely efficient (age_verify: 1,224, membership_proof: 1,253).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all compilation, testing, and pipeline steps succeeded on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- membership_proof circuit artifacts ready for Phase 4 (Starknet contract verifier integration)
- Public output ordering documented for Phase 4 (contract reads public inputs by index -- 16 fields for membership vs 9 for age)
- Both circuits compile and test in the same workspace -- no conflicts
- VK at `circuits/target/membership_proof_vk/vk` ready for garaga verifier generation
- Both issuer.ts credential types (age, membership) generate correct Prover.toml format

## Self-Check: PASSED

- All 5 key files verified present on disk
- Both task commits (613046f, eba56cb) found in git log

---
*Phase: 03-membership-verification-circuit*
*Completed: 2026-02-14*
