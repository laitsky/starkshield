---
phase: 02-age-verification-circuit
plan: 01
subsystem: circuits
tags: [noir, zk-proof, age-verification, schnorr, poseidon2, nullifier, barretenberg]

# Dependency graph
requires:
  - phase: 01-toolchain-validation-circuit-foundation
    provides: shared_lib (Credential, Schnorr, nullifier, Poseidon2), bb pipeline patterns, issuer.ts
provides:
  - age_verify Noir circuit with signature check, expiration enforcement, age comparison, nullifier derivation
  - Compiled circuit artifact (target/age_verify.json)
  - Verified bb proof pipeline (execute, write_vk, prove, verify)
  - Empirically documented public output ordering (9 fields)
  - Extended issuer.ts with --expired and --young flags
affects: [phase-03-starknet-contract, phase-04-verifier, phase-05-sdk]

# Tech tracking
tech-stack:
  added: []
  patterns: [return-value-public-outputs, hard-assert-all-checks, u64-safe-comparison, pub-params-first-then-returns]

key-files:
  created:
    - circuits/crates/age_verify/Nargo.toml
    - circuits/crates/age_verify/src/main.nr
    - circuits/crates/age_verify/Prover.toml
  modified:
    - circuits/Nargo.toml
    - scripts/issuer.ts

key-decisions:
  - "Hard-assert all checks (signature, expiration, age >= threshold) -- proof existence IS the pass signal"
  - "Return values for computed outputs (nullifier, echoed fields) instead of pub parameter + assert pattern from Phase 1"
  - "Public output ordering: pub parameters first (declaration order), then return values (tuple order) -- verified empirically"
  - "1,224 ACIR opcodes -- well under 5,000 target, no optimization needed"

patterns-established:
  - "Return-value public outputs: use -> pub tuple for computed outputs, pub params for verification inputs"
  - "Safe integer comparison: cast Field to u64 before ordered comparisons (>=, <)"
  - "bb public inputs ordering: pub params first, return values second"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 2 Plan 1: Age Verification Circuit Summary

**Age verification Noir circuit with Schnorr signature check, expiration enforcement, u64-safe age comparison, per-dApp nullifier derivation, and full bb prove/verify pipeline validation at 1,224 ACIR opcodes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T12:26:52Z
- **Completed:** 2026-02-14T12:30:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built age_verify circuit with all 5 roadmap requirements (CIRC-01 age comparison, CIRC-03 signature verification, CIRC-04 expiration check, CIRC-05 per-dApp nullifiers, CIRC-06 clean public outputs)
- All 6 nargo tests pass: valid proof, expired rejection, underage rejection, wrong signature rejection, different context different nullifier, same context same nullifier
- Full bb pipeline validated: compile -> execute -> write_vk -> prove -> verify all exit 0 with "Proof verified successfully"
- Public output ordering documented empirically: 9 fields (5 pub params + 4 return values), no private data leaks
- 1,224 ACIR opcodes -- extremely efficient, well under 5,000 target

## Task Commits

Each task was committed atomically:

1. **Task 1: Create age_verify circuit crate with Noir tests and test fixtures** - `8c24192` (feat)
2. **Task 2: Validate full bb prove/verify pipeline and document public output ordering** - `cab5176` (docs)

## Files Created/Modified
- `circuits/crates/age_verify/Nargo.toml` - Binary crate config with shared_lib and poseidon deps
- `circuits/crates/age_verify/src/main.nr` - Age verification circuit (14 params + return tuple) with 6 tests and public output documentation
- `circuits/crates/age_verify/Prover.toml` - Default witness inputs from Phase 1 demo credential
- `circuits/Nargo.toml` - Updated workspace with age_verify member as default
- `scripts/issuer.ts` - Extended with --expired and --young flags, updated generateProverToml for age_verify circuit

## Decisions Made
- **Hard-assert all checks:** Proof existence = "passed = true". No separate boolean output needed. Invalid credentials simply cannot produce proofs.
- **Return value approach:** Computed outputs (nullifier, echoed fields) returned via `-> pub` tuple instead of Phase 1's expected-value assertion pattern. Cleaner separation of inputs vs outputs.
- **Public output ordering confirmed:** pub parameters appear first (declaration order), then return values (tuple order). This is critical for Phase 4 contract integration.
- **Constraint efficiency:** 1,224 ACIR opcodes is lower than the Phase 1 trivial circuit's 1,333 due to removing the expected_nullifier assertion. No optimization work needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all compilation, testing, and pipeline steps succeeded on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- age_verify circuit artifacts ready for Phase 3 (Starknet contract verifier integration)
- Public output ordering documented for Phase 4 (contract reads public inputs by index)
- Extended issuer.ts provides test fixture generation for Phase 5 (SDK integration)
- VK at `circuits/target/age_verify_vk/vk` ready for garaga verifier generation

## Self-Check: PASSED

- All 4 key files verified present on disk
- Both task commits (8c24192, cab5176) found in git log

---
*Phase: 02-age-verification-circuit*
*Completed: 2026-02-14*
