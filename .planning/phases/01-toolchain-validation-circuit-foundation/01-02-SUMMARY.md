---
phase: 01-toolchain-validation-circuit-foundation
plan: 02
subsystem: infra
tags: [noir, poseidon2, schnorr, grumpkin, bb.js, typescript, credential, nullifier, shared-lib]

# Dependency graph
requires:
  - phase: 01-toolchain-validation-circuit-foundation
    plan: 01
    provides: "Validated ZK toolchain (nargo beta.16, bb 3.0.0-nightly.20251104) and Noir workspace scaffold"
provides:
  - "shared_lib crate with Credential struct (8 fields), Poseidon2 hashing, Schnorr verification, nullifier derivation"
  - "Demo credential issuer TypeScript script generating Poseidon2-Schnorr signed JSON credentials"
  - "Confirmed Poseidon2 hash compatibility between bb.js TypeScript and Noir circuits"
  - "Full pipeline proven with real credential data (Schnorr signature + Poseidon2 hash + nullifier)"
  - "Constraint budget baseline: 1,333 ACIR opcodes for credential hash + Schnorr verify + nullifier"
affects: [02-age-verification-circuit, 03-membership-proof-circuit, 05-proof-engine-sdk]

# Tech tracking
tech-stack:
  added: ["@aztec/bb.js@0.82.3", tsx, typescript]
  patterns: [shared-lib-import-pattern, poseidon2-cross-validation, schnorr-grumpkin-signing, nullifier-derivation]

key-files:
  created:
    - circuits/crates/shared_lib/src/credential.nr
    - circuits/crates/shared_lib/src/poseidon.nr
    - circuits/crates/shared_lib/src/schnorr.nr
    - circuits/crates/shared_lib/src/nullifier.nr
    - scripts/package.json
    - scripts/tsconfig.json
    - scripts/issuer.ts
  modified:
    - circuits/crates/shared_lib/src/lib.nr
    - circuits/crates/trivial/Nargo.toml
    - circuits/crates/trivial/src/main.nr
    - circuits/crates/trivial/Prover.toml
    - .gitignore

key-decisions:
  - "Schnorr API uses EmbeddedCurvePoint struct (not raw x,y fields) from schnorr v0.1.3 external library"
  - "Added assert_credential_signature convenience function alongside verify_credential_signature for circuits that want assertion vs bool"
  - "Issuer uses publicKey.x as issuer_id (deterministic, on-chain verifiable mapping)"
  - "bb.js poseidon2Hash matches Noir Poseidon2::hash -- no message_size parameter needed in bb.js (inferred from array length)"
  - "bb verify requires explicit -i public_inputs_path flag (not just -p proof_path)"
  - "@aztec/bb.js@0.82.3 used (latest stable matching bb 3.0.0-nightly.20251104)"

patterns-established:
  - "Credential struct: 8 Field elements (subject_id, issuer_id, credential_type, attribute_key, attribute_value, issued_at, expires_at, secret_salt)"
  - "Nullifier derivation: Poseidon2(secret_salt, credential_hash, dapp_context_id) -- 3-field hash"
  - "Schnorr signature format: [u8; 64] = sigS (32 bytes) || sigE (32 bytes)"
  - "Cross-validation pattern: Generate values with bb.js TypeScript, embed as constants in Noir #[test], assert match"
  - "Pipeline with public inputs: bb verify -s ultra_honk --oracle_hash keccak -k VK_PATH -p PROOF_PATH -i PUBLIC_INPUTS_PATH"

# Metrics
duration: 10min
completed: 2026-02-14
---

# Phase 01 Plan 02: Shared Crypto Library & Demo Issuer Summary

**shared_lib crate with Poseidon2/Schnorr/nullifier primitives, bb.js TypeScript credential issuer, and cross-validated hash compatibility between TypeScript and Noir -- 1,333 ACIR opcodes (well under 15K budget)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-14T11:26:32Z
- **Completed:** 2026-02-14T11:36:03Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- shared_lib crate with 4 modules (credential, poseidon, schnorr, nullifier) compiles and is importable by binary crates
- Trivial circuit exercises all shared_lib primitives: Credential.hash(), verify_credential_signature(), derive_nullifier()
- Constraint count measured at 1,333 ACIR opcodes (well under 15,000 budget for shared_lib overhead)
- Demo credential issuer generates Poseidon2-Schnorr signed credentials as JSON with auto-generated Prover.toml
- Poseidon2 cross-validation test confirms identical hashes between bb.js TypeScript and Noir circuits
- Nullifier derivation cross-validation test confirms identical outputs between bb.js and Noir
- Full pipeline proven with real credential data: compile -> witness -> prove -> verify (all exit 0)
- Two demo credential types available: age verification and membership

## Task Commits

Each task was committed atomically:

1. **Task 1: Build shared_lib crate with crypto primitives** - `5e37ad1` (feat)
2. **Task 2: Create demo credential issuer TypeScript script** - `6a60a00` (feat)

## Files Created/Modified
- `circuits/crates/shared_lib/src/credential.nr` - Credential struct with 8 Field fields and Poseidon2 hash method
- `circuits/crates/shared_lib/src/poseidon.nr` - Poseidon2 hashing convenience wrappers (hash_credential_fields, hash_2, hash_3)
- `circuits/crates/shared_lib/src/schnorr.nr` - Schnorr signature verification using EmbeddedCurvePoint (verify + assert variants)
- `circuits/crates/shared_lib/src/nullifier.nr` - Per-dApp nullifier derivation using Poseidon2(salt, hash, dapp_id)
- `circuits/crates/shared_lib/src/lib.nr` - Module declarations and Credential re-export
- `circuits/crates/trivial/Nargo.toml` - Added shared_lib dependency
- `circuits/crates/trivial/src/main.nr` - Full credential circuit (hash + verify signature + derive nullifier) with cross-validation tests
- `circuits/crates/trivial/Prover.toml` - Real credential data from demo issuer
- `scripts/package.json` - Node project with @aztec/bb.js dependency
- `scripts/tsconfig.json` - ESNext TypeScript config
- `scripts/issuer.ts` - Demo credential issuer: keypair generation, Poseidon2 hashing, Schnorr signing, JSON output
- `.gitignore` - Added scripts/node_modules, generated credential files

## Decisions Made

1. **Schnorr library API adaptation** -- The schnorr v0.1.3 library uses `EmbeddedCurvePoint` struct from `std::embedded_curve_ops` instead of raw `(pub_key_x, pub_key_y)` fields. The schnorr.nr wrapper accepts raw x,y fields and constructs the EmbeddedCurvePoint internally for convenience.

2. **Added assert_credential_signature function** -- Beyond the plan's verify_credential_signature (returns bool), added assert_credential_signature that fails the circuit directly. This is more efficient for production circuits where invalid signatures should halt execution.

3. **Issuer ID from public key x-coordinate** -- The issuer_id field is set to the Schnorr public key's x-coordinate, providing a deterministic and on-chain verifiable issuer identifier.

4. **@aztec/bb.js@0.82.3 version** -- Used the latest stable bb.js package (0.82.3) rather than the exact nightly version tag (3.0.0-nightly.20251104) since the npm package versioning differs from the CLI binary versioning. Poseidon2 hash compatibility confirmed via cross-validation.

5. **bb verify requires -i flag for public inputs** -- Discovered that `bb verify` needs explicit `-i public_inputs_path` in addition to the proof path. Without it, verification fails with misleading "on_curve" assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Noir `use` statements cannot be inside functions in beta.16**
- **Found during:** Task 2 (adding cross-validation tests)
- **Issue:** Plan template used `use dep::poseidon::...` inside test functions. Noir beta.16 does not support function-scoped imports.
- **Fix:** Moved all `use` statements to module top level
- **Files modified:** circuits/crates/trivial/src/main.nr
- **Verification:** nargo test passes
- **Committed in:** 6a60a00 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed VK path nesting after bb write_vk with -o flag**
- **Found during:** Task 2 (full pipeline prove step)
- **Issue:** `bb write_vk -o target/vk/vk` creates VK at `target/vk/vk/vk` (adds subdirectory). Using `-k target/vk/vk` for prove then looks for VK as a directory, not a file.
- **Fix:** Updated prove command to use `-k target/vk/vk/vk` (the actual VK file path)
- **Files modified:** None (command-line fix)
- **Verification:** bb prove exits 0, proof generated

**3. [Rule 1 - Bug] bb verify requires -i public_inputs_path**
- **Found during:** Task 2 (full pipeline verify step)
- **Issue:** `bb verify` without `-i` flag fails with "on_curve" assertion even with correct proof and VK
- **Fix:** Added `-i target/proof/public_inputs` to verify command
- **Files modified:** None (command-line fix)
- **Verification:** bb verify exits 0, "Proof verified successfully"

**4. [Rule 2 - Missing Critical] Added .gitignore entries for scripts directory**
- **Found during:** Task 2 (before commit)
- **Issue:** No .gitignore entries for node_modules or generated credential files
- **Fix:** Added scripts/node_modules/, scripts/dist/, scripts/demo_credential*.json, scripts/prover_*.toml
- **Files modified:** .gitignore
- **Committed in:** 6a60a00 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical)
**Impact on plan:** All fixes were necessary for correctness and pipeline operation. No scope creep.

## Issues Encountered

1. **bb output path conflicts** -- bb write_vk and bb prove crash with "filesystem_error: File exists" if the output path already exists as a file or directory. Must remove old artifacts before regenerating. This is a bb CLI ergonomic issue, not a bug.

2. **bb verify public inputs requirement** -- The verify command fails with a misleading "on_curve" assertion when public inputs are not provided via `-i`. The 01-01 summary documented the `-k` VK requirement but not the `-i` public inputs requirement (the previous trivial circuit had only 1 public input which may have been handled differently).

## User Setup Required

None - all tools were installed in Plan 01-01. The scripts/ directory requires `npm install` after clone (node_modules is gitignored).

## Next Phase Readiness
- shared_lib crate is ready for Phase 2 (age_verify circuit) and Phase 3 (membership_proof circuit) to depend on
- Demo credentials (age + membership) available for circuit development and testing
- Poseidon2 hash compatibility confirmed -- no risk of silent hash mismatches in later phases
- Constraint budget baseline established: 1,333 ACIR opcodes for the full credential verification flow
- Pipeline commands documented with correct VK and public inputs paths
- **Note:** The bb.js version (0.82.3) npm naming differs from the bb CLI version (3.0.0-nightly.20251104) but they share the same underlying Poseidon2 implementation

## Self-Check: PASSED

All 7 created files verified present. Both task commits (5e37ad1, 6a60a00) verified in git log. SUMMARY.md exists.

---
*Phase: 01-toolchain-validation-circuit-foundation*
*Completed: 2026-02-14*
