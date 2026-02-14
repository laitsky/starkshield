---
phase: 01-toolchain-validation-circuit-foundation
plan: 01
subsystem: infra
tags: [noir, barretenberg, garaga, scarb, poseidon2, cairo, zk-pipeline]

# Dependency graph
requires: []
provides:
  - "Validated ZK toolchain: nargo beta.16, bb 3.0.0-nightly.20251104, garaga 1.0.1, scarb 2.14.0"
  - "Noir workspace scaffold with trivial Poseidon2 circuit and shared_lib placeholder"
  - "Garaga-generated Cairo verifier contract (UltraKeccakZKHonk) compiled under scarb"
  - "End-to-end pipeline: compile -> VK -> witness -> prove -> verify -> garaga gen -> scarb build"
affects: [01-02-PLAN, all-future-phases]

# Tech tracking
tech-stack:
  added: [nargo 1.0.0-beta.16, bb 3.0.0-nightly.20251104, garaga 1.0.1, scarb 2.14.0, python 3.10.19]
  patterns: [noir-workspace-layout, garaga-verifier-generation, poseidon2-hashing]

key-files:
  created:
    - .tool-versions
    - .gitignore
    - circuits/Nargo.toml
    - circuits/crates/trivial/Nargo.toml
    - circuits/crates/trivial/src/main.nr
    - circuits/crates/trivial/Prover.toml
    - circuits/crates/shared_lib/Nargo.toml
    - circuits/crates/shared_lib/src/lib.nr
    - contracts/Scarb.toml
    - contracts/src/lib.cairo
    - contracts/src/honk_verifier.cairo
    - contracts/src/honk_verifier_circuits.cairo
    - contracts/src/honk_verifier_constants.cairo
  modified:
    - .tool-versions (downgraded noir to beta.16, scarb to 2.14.0)

key-decisions:
  - "Downgraded from nargo beta.18 to beta.16 for garaga 1.0.1 compatibility"
  - "Downgraded from scarb 2.15.2 to 2.14.0 -- scarb 2.15.2 caused infinite compilation of garaga contracts"
  - "Chained 21 Poseidon2 hashes in trivial circuit for meaningful constraint count (24 ACIR opcodes)"
  - "bb prove requires explicit -k VK path flag; without it, crashes with misleading on_curve assertion"
  - "CRS (bn254_g1.dat) must be pre-downloaded to ~/.bb-crs/ -- bb auto-download can fail in sandboxed environments"

patterns-established:
  - "Pipeline commands: nargo build -> bb write_vk -s ultra_honk --oracle_hash keccak -> nargo execute -> bb prove -s ultra_honk --oracle_hash keccak -k target/vk/vk -> bb verify"
  - "Garaga gen command: garaga gen --system ultra_keccak_zk_honk --vk target/vk/vk --project-name contracts"
  - "Garaga generates a self-contained Scarb project; move it to contracts/ root"
  - "Use scarb 2.14.0 (not 2.15.x) for garaga contract compilation"

# Metrics
duration: 227min
completed: 2026-02-14
---

# Phase 01 Plan 01: Toolchain Validation & Pipeline Spike Summary

**Validated nargo beta.16 + garaga 1.0.1 + scarb 2.14.0 end-to-end ZK pipeline with trivial Poseidon2 circuit, including compile, prove, verify, Cairo verifier generation, and contract build**

## Performance

- **Duration:** 3h 47m (mostly waiting for scarb 2.15.2 compilation that ultimately required downgrade to 2.14.0)
- **Started:** 2026-02-14T07:36:05Z
- **Completed:** 2026-02-14T11:23:11Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Full ZK toolchain installed and pinned: nargo 1.0.0-beta.16, bb 3.0.0-nightly.20251104, garaga 1.0.1, scarb 2.14.0, Python 3.10.19
- End-to-end pipeline validated: nargo build -> bb write_vk -> nargo execute -> bb prove -> bb verify (all exit 0)
- Garaga gen successfully produces Cairo verifier from Noir VK (UltraKeccakZKHonk system)
- Garaga-generated verifier compiles under scarb 2.14.0 in 4 seconds
- Trivial circuit: 21 chained Poseidon2 hashes, 24 ACIR opcodes
- Noir workspace scaffold with trivial circuit and shared_lib placeholder ready for Plan 01-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Install toolchain and scaffold project structure** - `5bfa7d5` (feat)
2. **Task 2: Execute full compile-prove-verify pipeline spike** - `88b9fd5` (feat)

## Files Created/Modified
- `.tool-versions` - Pinned tool versions (noir beta.16, scarb 2.14.0, python 3.10.14)
- `.gitignore` - Excludes .venv, circuits/target, contracts/target
- `circuits/Nargo.toml` - Noir workspace root with shared_lib and trivial members
- `circuits/crates/trivial/Nargo.toml` - Trivial circuit package config with poseidon dependency
- `circuits/crates/trivial/src/main.nr` - 21 chained Poseidon2 hashes asserting against public output
- `circuits/crates/trivial/Prover.toml` - Test inputs x=1, y=2 with computed hash chain result
- `circuits/crates/shared_lib/Nargo.toml` - Shared library package config with poseidon and schnorr
- `circuits/crates/shared_lib/src/lib.nr` - Empty placeholder for Plan 01-02
- `contracts/Scarb.toml` - Garaga-generated contract config with starknet 2.14.0 and garaga git dep
- `contracts/src/lib.cairo` - Module declarations for garaga-generated verifier
- `contracts/src/honk_verifier.cairo` - Garaga-generated UltraKeccakZKHonk verifier entry point
- `contracts/src/honk_verifier_circuits.cairo` - Garaga-generated circuit verification logic
- `contracts/src/honk_verifier_constants.cairo` - Garaga-generated verification constants from VK
- `contracts/tests/test_contract.cairo` - Garaga-generated contract test scaffold

## Decisions Made

1. **Downgraded nargo from beta.18 to beta.16** -- Garaga 1.0.1 explicitly requires beta.16 and bb 3.0.0-nightly.20251104. Beta.18 generated a version warning and the VK format may differ. This is the primary risk resolution from the plan.

2. **Downgraded scarb from 2.15.2 to 2.14.0** -- Scarb 2.15.2 entered an infinite compilation loop (3+ hours, 0% CPU) when building the garaga verifier contract. Scarb 2.14.0 (garaga's recommended version) compiled in 4 seconds. This is a critical compatibility finding.

3. **Changed circuit from single Poseidon2 hash to 21 chained hashes** -- The original single-hash circuit had only 4 ACIR opcodes and could potentially trigger edge cases in bb's proving system with very small circuits.

4. **Poseidon2 API correction** -- The plan specified `poseidon2::hash([x, y])` but the actual API in the poseidon v0.2.3 library is `Poseidon2::hash([x, y], 2)` (struct method with explicit message_size parameter).

5. **bb prove requires explicit -k VK path** -- Without `-k target/vk/vk`, bb crashes with a misleading "on_curve" assertion. The correct command includes the VK path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Poseidon2 API mismatch**
- **Found during:** Task 1 (scaffold validation with nargo check)
- **Issue:** Plan specified `poseidon2::hash([x, y])` but the poseidon library v0.2.3 uses `Poseidon2::hash([x, y], 2)` with struct-based API
- **Fix:** Updated import to `use dep::poseidon::poseidon2::Poseidon2` and call to `Poseidon2::hash([x, y], 2)`
- **Files modified:** circuits/crates/trivial/src/main.nr
- **Verification:** nargo check passes
- **Committed in:** 5bfa7d5 (Task 1 commit)

**2. [Rule 3 - Blocking] Downgraded nargo beta.18 to beta.16 for garaga compatibility**
- **Found during:** Task 2 (garaga gen version warning)
- **Issue:** Garaga 1.0.1 warns about incompatible bb/nargo versions with beta.18 and recommends beta.16
- **Fix:** Ran `noirup --version 1.0.0-beta.16` and `bbup --version 3.0.0-nightly.20251104`, updated .tool-versions
- **Files modified:** .tool-versions
- **Verification:** garaga gen confirms "versions are correctly aligned with garaga 1.0.1"
- **Committed in:** 88b9fd5 (Task 2 commit)

**3. [Rule 3 - Blocking] Downgraded scarb 2.15.2 to 2.14.0**
- **Found during:** Task 2 (scarb build hung for 3+ hours)
- **Issue:** Scarb 2.15.2 entered infinite compilation on garaga contracts (3h+ at 400% CPU, then 0% CPU stuck)
- **Fix:** Installed scarb 2.14.0 (garaga's recommended version), clean build completed in 4 seconds
- **Files modified:** .tool-versions
- **Verification:** scarb build exits 0, Sierra artifacts generated
- **Committed in:** 88b9fd5 (Task 2 commit)

**4. [Rule 1 - Bug] Fixed bb prove command requiring explicit VK path**
- **Found during:** Task 2 (proof generation)
- **Issue:** `bb prove` without `-k` flag crashes with misleading "on_curve" assertion or "Unable to open file: ./target/vk"
- **Fix:** Added `-k target/vk/vk` to bb prove command
- **Files modified:** None (command-line fix)
- **Verification:** bb prove exits 0, proof generated and verified

**5. [Rule 3 - Blocking] Pre-downloaded CRS file for bb**
- **Found during:** Task 2 (proof generation)
- **Issue:** bb could not auto-download CRS from crs.aztec.network in sandboxed environment
- **Fix:** Manually downloaded bn254_g1.dat (3.3GB) to ~/.bb-crs/
- **Files modified:** None (system-level)
- **Verification:** bb prove logs "using cached bn254 crs with num points 2048"

**6. [Rule 2 - Missing Critical] Added .gitignore for build artifacts and venv**
- **Found during:** Task 1 (before first commit)
- **Issue:** No .gitignore existed; would commit .venv/ and build artifacts
- **Fix:** Created .gitignore excluding .venv/, circuits/target/, contracts/target/, .DS_Store
- **Files modified:** .gitignore (new)
- **Committed in:** 5bfa7d5 (Task 1 commit)

---

**Total deviations:** 6 auto-fixed (2 bugs, 1 missing critical, 3 blocking)
**Impact on plan:** All fixes were necessary for the pipeline to work. The nargo and scarb downgrades are the most significant -- they affect all future phases. No scope creep.

## Issues Encountered

1. **bb prove "on_curve" assertion** -- Spent significant time debugging this. The error is misleading; the actual cause was a missing `-k` VK path flag combined with CRS file not being available. With both issues fixed, prove works correctly.

2. **scarb 2.15.2 infinite compilation** -- The garaga verifier contract (130KB+ of Cairo code) caused scarb 2.15.2 to enter a 3+ hour compilation that eventually stalled at 0% CPU. Scarb 2.14.0 handles it in 4 seconds. This is likely a regression in scarb's compiler.

3. **CRS auto-download blocked** -- In sandboxed environments, bb's internal HTTP client cannot reach crs.aztec.network. Manual pre-download of the 3.3GB bn254_g1.dat file to ~/.bb-crs/ resolves this.

## User Setup Required

None - all tools are installed locally. The CRS file (~3.3GB at ~/.bb-crs/bn254_g1.dat) was downloaded during execution.

## Next Phase Readiness
- Toolchain fully validated and pinned at compatible versions
- Noir workspace ready for Plan 01-02 (deposit circuit implementation)
- Garaga verifier generation pipeline is reproducible
- Key risk (garaga/noir compatibility) resolved: beta.16 confirmed working
- **Warning:** scarb 2.15.x is NOT compatible with garaga contracts; must stay on 2.14.0

## Self-Check: PASSED

All 14 created files verified present. Both task commits (5bfa7d5, 88b9fd5) verified in git log. SUMMARY.md exists.

---
*Phase: 01-toolchain-validation-circuit-foundation*
*Completed: 2026-02-14*
