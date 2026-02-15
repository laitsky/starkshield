---
phase: 06-wallet-chain-sdk
plan: 01
subsystem: sdk
tags: [starknet.js, get-starknet, wallet, garaga, calldata, proof-submission]

# Dependency graph
requires:
  - phase: 04-smart-contracts-deployment
    provides: "Deployed StarkShieldRegistry contract address, verifier contracts, ABI"
  - phase: 05-proof-engine-sdk
    provides: "Browser proof generation (ProofResult with proof bytes + publicInputs), garaga npm, SDK structure"
provides:
  - "Wallet connection via get-starknet v4 modal (ArgentX/Braavos)"
  - "Proof-to-calldata transformation via garaga getZKHonkCallData"
  - "On-chain proof submission via WalletAccount.execute to StarkShieldRegistry"
  - "Chain config module with contract addresses, RPC URL, circuit IDs"
  - "VK binary files bundled as static assets"
affects: [06-02, 07-demo-app, 08-testing]

# Tech tracking
tech-stack:
  added: [starknet@8.9.2, "@starknet-io/get-starknet@4.0.8"]
  patterns: [wallet-connection-via-get-starknet-modal, garaga-calldata-generation, walletaccount-execute-pattern, inline-public-input-flattening]

key-files:
  created:
    - sdk/src/config.ts
    - sdk/src/wallet.ts
    - sdk/src/submitter.ts
    - sdk/public/vk/age_verify.vk
    - sdk/public/vk/membership_proof.vk
  modified:
    - sdk/package.json
    - sdk/package-lock.json
    - sdk/src/types.ts
    - sdk/src/index.ts
    - sdk/vite.config.ts

key-decisions:
  - "COEP changed from require-corp to credentialless for wallet modal cross-origin compatibility"
  - "Inline flattenPublicInputs instead of importing flattenFieldsAsArray (not re-exported from bb.js top-level)"
  - "Type assertion (as any) for get-starknet -> WalletAccount.connect due to differing StarknetWindowObject type packages"

patterns-established:
  - "Wallet connection: get-starknet connect() -> WalletAccount.connect() -> return walletAccount + state"
  - "Proof submission: ProofResult -> flattenPublicInputs -> fetch VK -> getZKHonkCallData -> execute verify_and_register"
  - "Span<felt252> raw calldata: [circuit_id, array_length, ...hex_elements]"
  - "Garaga lazy init: ensureGaragaInit() pattern for idempotent WASM initialization"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 6 Plan 1: Wallet & Chain SDK Summary

**Wallet connection via get-starknet v4 + proof submission pipeline via garaga calldata and WalletAccount.execute to StarkShieldRegistry**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T00:55:21Z
- **Completed:** 2026-02-15T00:59:38Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Installed starknet@8.9.2 and @starknet-io/get-starknet@4.0.8 for wallet connection and transaction signing
- Created config.ts centralizing all contract addresses, RPC URL, chain ID, circuit mappings, and VK paths from deployments.json
- Created wallet.ts with connectWallet/disconnectWallet/getWalletAccount using get-starknet v4 modal and WalletAccount
- Created submitter.ts with generateCalldata (garaga WASM calldata generation) and submitProof (wallet-signed transaction to registry)
- Bundled VK binary files (1888 bytes each) as static assets in sdk/public/vk/
- Updated COEP from require-corp to credentialless for wallet modal compatibility
- Added WalletState, SubmitResult, CalldataResult, VerificationRecord types
- Updated barrel exports in index.ts for all new modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create config module, and bundle VK static assets** - `1485898` (feat)
2. **Task 2: Build wallet connection and proof submission modules** - `5ef936a` (feat)

## Files Created/Modified

- `sdk/src/config.ts` - Contract addresses, RPC URL, chain ID, circuit ID mappings, VK paths
- `sdk/src/wallet.ts` - Wallet connection/disconnection via get-starknet v4 + WalletAccount
- `sdk/src/submitter.ts` - Proof-to-calldata (garaga) + transaction submission (WalletAccount.execute)
- `sdk/src/types.ts` - Added WalletState, SubmitResult, CalldataResult, VerificationRecord
- `sdk/src/index.ts` - Added barrel exports for wallet, submitter, config modules and new types
- `sdk/package.json` - Added starknet@8.9.2, @starknet-io/get-starknet@4.0.8
- `sdk/vite.config.ts` - Changed COEP from require-corp to credentialless
- `sdk/public/vk/age_verify.vk` - Age verify circuit verification key binary (1888 bytes)
- `sdk/public/vk/membership_proof.vk` - Membership proof circuit verification key binary (1888 bytes)

## Decisions Made

- **COEP credentialless:** Changed from `require-corp` to `credentialless` for Cross-Origin-Embedder-Policy. The `require-corp` policy blocks cross-origin resources that the get-starknet wallet modal needs to load. `credentialless` is less restrictive but still enables SharedArrayBuffer for bb.js WASM workers.
- **Inline flattenPublicInputs:** The research identified that `flattenFieldsAsArray` is NOT re-exported from `@aztec/bb.js` top-level (only `deflattenFields` is). Implemented a 3-line equivalent inline in submitter.ts.
- **Type assertion for wallet provider:** `get-starknet` v4 imports `StarknetWindowObject` from `@starknet-io/types-js` while `starknet.js` v8 imports from `@starknet-io/starknet-types-09`. The interfaces are structurally identical but TypeScript treats them as different types. Used `as any` cast with clear documentation.

## Deviations from Plan

None - plan executed exactly as written. The flattenPublicInputs inline implementation and type assertion were anticipated in the plan and research documents.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. VK files are bundled as static assets. Contract addresses are from existing deployments.json.

## Next Phase Readiness

- Wallet connection and proof submission pipeline complete
- Ready for Plan 02 (on-chain verification status reader module)
- End-to-end flow from browser proof generation to on-chain submission is architecturally complete
- Runtime testing of wallet modal in COOP/COEP context should be validated during integration testing

## Self-Check: PASSED

All created files verified present. Both task commits (1485898, 5ef936a) verified in git log.

---
*Phase: 06-wallet-chain-sdk*
*Completed: 2026-02-15*
