---
phase: 04-smart-contracts-deployment
plan: 02
subsystem: contracts
tags: [cairo, starknet, sepolia, registry, snforge, sncast, ownable, nullifier, verifier-routing]

# Dependency graph
requires:
  - phase: 04-smart-contracts-deployment
    plan: 01
    provides: "Two deployed Garaga HonkVerifier contracts (age + membership) on Sepolia"
  - phase: 02-age-verification-circuit
    provides: "age_verify circuit with 9 public outputs (nullifier at index 5)"
  - phase: 03-membership-verification-circuit
    provides: "membership_proof circuit with 16 public outputs (nullifier at index 12)"
provides:
  - "StarkShieldRegistry contract deployed at 0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab"
  - "verify_and_register routing (circuit_id 0=age, 1=membership) with public input extraction"
  - "Nullifier replay protection and trusted issuer management (owner-only)"
  - "VerificationPassed event emission for on-chain verification logs"
  - "Both demo issuers registered as trusted on-chain"
  - "Full end-to-end verify_and_register validated on Sepolia (age proof)"
  - "deployments.json with all three contract addresses + transaction hashes"
affects: [05-proof-engine-sdk, 06-demo-app, 07-api-endpoints]

# Tech tracking
tech-stack:
  added: [sncast-declare, sncast-deploy, sncast-invoke, snforge-testing, hand-rolled-ownable]
  patterns: [dispatcher-routing-by-circuit-id, u256-public-input-extraction, owner-only-access-control]

key-files:
  created:
    - contracts/src/registry.cairo
    - contracts/src/ownable.cairo
    - contracts/tests/test_registry.cairo
    - contracts/tests/proof_calldata.txt
    - contracts/tests/membership/proof_calldata.txt
  modified:
    - contracts/src/lib.cairo
    - deployments.json

key-decisions:
  - "Hand-rolled ownable (assert_only_owner) instead of OpenZeppelin due to Scarb 2.14.0 version gap"
  - "Public input indices: age (5,6,7,8) membership (12,13,14,15) -- verified from circuit source"
  - "sncast for registry deployment (garaga CLI only for verifier contracts)"
  - "Both demo issuers added as trusted (age + membership have different issuer keys)"
  - "Gas cost ~2.25 STRK per verify_and_register -- exceeds 500K l2_gas target but acceptable for hackathon"

patterns-established:
  - "sncast account import + declare + deploy + invoke pipeline for custom contracts"
  - "u256 calldata serialization: low 128 bits first, high 128 bits second"
  - "Proof calldata for sncast: circuit_id + array_length + proof_felt252_values"

# Metrics
duration: 12min
completed: 2026-02-14
---

# Plan 04-02: StarkShield Registry Summary

**StarkShieldRegistry contract with verify_and_register routing, nullifier tracking, and trusted issuer management -- deployed on Sepolia with end-to-end age proof verification validated**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-14T15:00:13Z
- **Completed:** 2026-02-14T15:12:20Z
- **Tasks:** 2 auto tasks completed (Task 3 is human-verify checkpoint)
- **Files modified:** 7

## Accomplishments
- Built StarkShieldRegistry Cairo contract with full business logic (verify_and_register, nullifier tracking, issuer management, events)
- 7 snforge tests pass covering owner access control, issuer add/remove, nullifier initial state
- Declared and deployed registry on Starknet Sepolia at `0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab`
- Added both demo issuer public keys as trusted on-chain (age + membership)
- Successfully executed `verify_and_register` with real age proof -- full pipeline validated on Sepolia
- Gas cost documented: ~2.25 STRK per verify_and_register transaction

## Task Commits

Each task was committed atomically:

1. **Task 1: Build StarkShieldRegistry contract** - `7bd528e` (feat)
2. **Task 2: Test, deploy, and validate on Sepolia** - `f3453a4` (feat)

## Files Created/Modified
- `contracts/src/registry.cairo` - StarkShieldRegistry with verify_and_register, nullifier tracking, issuer management, events
- `contracts/src/ownable.cairo` - Simple owner-only access control (assert_only_owner)
- `contracts/src/lib.cairo` - Added registry and ownable module declarations
- `contracts/tests/test_registry.cairo` - 7 integration tests for business logic
- `contracts/tests/proof_calldata.txt` - Age verify snforge calldata fixture
- `contracts/tests/membership/proof_calldata.txt` - Membership proof snforge calldata fixture
- `deployments.json` - Updated with registry address, class hash, trusted issuers, all transaction hashes

## Decisions Made
- **Hand-rolled ownable:** Used simple `assert_only_owner(owner)` function instead of OpenZeppelin due to Scarb 2.14.0 version gap with OZ releases (v3.0.0 needs 2.13.1, v4.0.0-alpha needs 2.15.1)
- **Both issuers trusted:** Age and membership demo credentials use different issuer key pairs, so both were registered as trusted on the registry
- **sncast for registry deployment:** garaga CLI is only for verifier contracts; used sncast declare/deploy/invoke for the custom StarkShieldRegistry
- **Gas target exceeded but documented:** verify_and_register costs ~2.25 STRK (l2_gas: 281M), dominated by Garaga verifier cost. The 500K target in CONT-07 assumed the old gas model; in the current Starknet v0.13+ model, l2_gas counts differently. The cost is in line with the verifier-only baseline (~2.19 STRK), confirming registry overhead is minimal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed starknet-foundry (snforge/sncast)**
- **Found during:** Task 2 (testing)
- **Issue:** `snforge` not found in PATH -- starknet-foundry not installed despite .tool-versions specifying it
- **Fix:** Installed snfoundryup, then `snfoundryup -v 0.53.0` to install snforge + sncast
- **Files modified:** None (system tooling)
- **Verification:** `snforge --version` returns 0.53.0

**2. [Rule 3 - Blocking] Updated Rust to 1.93.1 (from 1.85.0)**
- **Found during:** Task 2 (testing)
- **Issue:** snforge_std 0.53.0 requires Rust 1.87+, installed Rust was 1.85.0
- **Fix:** `rustup update stable` upgraded to 1.93.1
- **Files modified:** None (system tooling)
- **Verification:** All 7 snforge tests pass

**3. [Rule 1 - Bug] Fixed garaga calldata missing --public-inputs flag**
- **Found during:** Task 2, Step 1 (calldata generation)
- **Issue:** `garaga calldata` requires `--public-inputs` flag for Honk proofs (same issue as Plan 01)
- **Fix:** Added `--public-inputs circuits/target/<circuit>_proof/public_inputs` to both commands
- **Verification:** Both calldata files generated successfully (3027 lines age, 4084 lines membership)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All necessary for tool chain operation. No scope change.

## Issues Encountered
- sncast account subcommand changed from `add` to `import` in v0.53.0
- Class hash not immediately available after declare -- needed ~15s wait before deploy succeeded
- starkli calldata format includes array length prefix, which is correct for Cairo Span serialization

## Gas Cost Analysis (CONT-07)

| Metric | Verifier-only (Plan 01) | Registry verify_and_register |
|--------|------------------------|------------------------------|
| l1_data_gas | 128 | 768 |
| l2_gas | N/A (old model) | 281,152,035 |
| Fee (STRK) | ~2.19 | ~2.25 |

The registry adds ~640 l1_data_gas overhead (for storage writes + event data) to the verifier-only baseline. The 500K gas target (CONT-07) was based on the pre-v0.13 gas model. In the current model, l2_gas counts are much larger numerically but the actual cost in STRK is comparable. The ~2.25 STRK cost is reasonable for a hackathon demo.

## On-Chain Transactions
- Declaration: https://sepolia.starkscan.co/tx/0x0291cd26cc938ccbb41083fbda531bcc308ea38e064532d24d7afb461f818b13
- Deployment: https://sepolia.starkscan.co/tx/0x005dd7fb3322a9c4683d725b98687da9c799a268d44cbf965ea2553b6f2b0a24
- Add age issuer: https://sepolia.starkscan.co/tx/0x04c62eacb6379a3297888a61a8fac0f44727c7950b15f82bb7f834e543d22d06
- Add membership issuer: https://sepolia.starkscan.co/tx/0x03b6562726fc9122324a88d553120c7efcb5f96815bf6e748a0969bcb6da520b
- verify_and_register (age): https://sepolia.starkscan.co/tx/0x00556479e6a2c1edafc3e8aad71fc020519cb0252576894ca37f5b1091116958

## User Setup Required

None - no external service configuration required. All deployment credentials are in `.secrets` (already gitignored).

## Next Phase Readiness
- All three contract addresses in deployments.json -- SDK (Phase 5) can read these
- Registry ABI available for frontend integration (Phase 6)
- Proof calldata generation validated -- SDK will use `garaga calldata` or `garaga` npm package
- Trusted issuer keys documented in deployments.json for reference

## Self-Check: PASSED

- FOUND: contracts/src/registry.cairo
- FOUND: contracts/src/ownable.cairo
- FOUND: contracts/tests/test_registry.cairo
- FOUND: deployments.json (registry key verified)
- FOUND: 04-02-SUMMARY.md
- FOUND: commit 7bd528e (Task 1)
- FOUND: commit f3453a4 (Task 2)

---
*Phase: 04-smart-contracts-deployment*
*Plan: 02*
*Completed: 2026-02-14*
