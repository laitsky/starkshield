---
phase: 06-wallet-chain-sdk
plan: 02
subsystem: sdk
tags: [starknet.js, rpc-provider, on-chain-reader, verification-query, e2e-test-page]

# Dependency graph
requires:
  - phase: 04-smart-contracts-deployment
    provides: "Deployed StarkShieldRegistry with is_nullifier_used and get_verification_record view functions"
  - phase: 05-proof-engine-sdk
    provides: "Browser proof generation (ProofResult with proof bytes + publicInputs)"
  - phase: 06-wallet-chain-sdk/plan-01
    provides: "Wallet connection, calldata generation, proof submission modules, config with contract addresses"
provides:
  - "Read-only on-chain verification queries via RpcProvider (no wallet needed)"
  - "isNullifierUsed check for nullifier existence"
  - "getVerificationRecord for full verification record retrieval"
  - "Complete E2E test page with wallet connect, proof generation, on-chain submission, and query UI"
affects: [07-demo-app, 08-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [rpc-provider-read-only-contract, minimal-inlined-abi-with-u256-struct, options-object-contract-constructor]

key-files:
  created:
    - sdk/src/reader.ts
  modified:
    - sdk/src/index.ts
    - sdk/index.html

key-decisions:
  - "starknet.js v8 Contract constructor uses options object { abi, address, providerOrAccount } not positional args"
  - "Minimal inlined ABI includes u256 struct definition for Contract auto-serialization of bigint args"
  - "Cached Contract instance for repeated read queries (singleton pattern)"

patterns-established:
  - "Read-only queries: RpcProvider + Contract with minimal ABI (no wallet needed)"
  - "Verification record: check isNullifierUsed first, then fetch full record if exists"
  - "Nullifier extraction from publicInputs: age_verify at index 5, membership_proof at index 12"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 6 Plan 2: On-Chain Reader & E2E Test Page Summary

**On-chain verification reader via RpcProvider with minimal ABI and full E2E test page for wallet-to-chain flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T01:02:20Z
- **Completed:** 2026-02-15T01:05:28Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Created reader.ts with isNullifierUsed and getVerificationRecord using starknet.js RpcProvider and minimal inlined ABI
- Updated barrel exports in index.ts to include reader module functions
- Rebuilt index.html as full E2E test page with four sections: wallet connection, proof generation, on-chain submission, and verification query
- Submit buttons run complete flow: generate proof -> garaga calldata -> submit to registry -> auto-query verification record
- Query section allows standalone nullifier lookup against deployed StarkShieldRegistry

## Task Commits

Each task was committed atomically:

1. **Task 1: Build on-chain reader module and update E2E test page** - `85da22e` (feat)

## Files Created/Modified

- `sdk/src/reader.ts` - On-chain verification queries using RpcProvider with minimal inlined ABI (isNullifierUsed, getVerificationRecord)
- `sdk/src/index.ts` - Added re-exports for isNullifierUsed and getVerificationRecord from reader module
- `sdk/index.html` - Full E2E test page with wallet connect, proof generation, on-chain submission, and verification query sections

## Decisions Made

- **Contract constructor v8 style:** starknet.js v8 Contract uses an options object `{ abi, address, providerOrAccount }` instead of the v5-style positional `(abi, address, provider)`. Discovered during TypeScript compilation and corrected.
- **Minimal inlined ABI:** Only the two view functions (is_nullifier_used, get_verification_record) and the u256/VerificationRecord struct definitions are inlined. This avoids bundling the full contract ABI while enabling starknet.js auto-serialization of u256 arguments.
- **Cached contract instance:** A singleton `cachedContract` avoids re-creating the RpcProvider and Contract on every query call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Contract constructor for starknet.js v8**
- **Found during:** Task 1 (reader.ts creation)
- **Issue:** Plan specified `new Contract(abi, address, provider)` (v5 style) but starknet.js v8 uses `new Contract({ abi, address, providerOrAccount })` (options object)
- **Fix:** Changed to options object constructor pattern
- **Files modified:** sdk/src/reader.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 85da22e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Constructor API change from v5 to v8 is a straightforward fix. No scope creep.

## Issues Encountered

None beyond the constructor API deviation noted above.

## User Setup Required

None - reader module uses the same RPC endpoint and contract addresses already configured in config.ts.

## Next Phase Readiness

- Phase 6 complete: all SDK modules built (config, wallet, submitter, reader)
- Full browser-to-chain pipeline operational: proof generation -> calldata -> submission -> verification query
- E2E test page validates the complete flow (requires wallet extension for on-chain testing)
- Ready for Phase 7 (demo app) and Phase 8 (testing)

## Self-Check: PASSED

All created files verified present. Task commit (85da22e) verified in git log.

---
*Phase: 06-wallet-chain-sdk*
*Completed: 2026-02-15*
