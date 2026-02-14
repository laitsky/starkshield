---
phase: 04-smart-contracts-deployment
plan: 01
subsystem: contracts
tags: [garaga, honk-verifier, starknet, sepolia, cairo, scarb]

# Dependency graph
requires:
  - phase: 02-age-verification-circuit
    provides: "age_verify VK and proof files in circuits/target/"
  - phase: 03-membership-verification-circuit
    provides: "membership_proof VK and proof files in circuits/target/"
provides:
  - "Two Garaga HonkVerifier contracts deployed on Starknet Sepolia"
  - "Age verifier at 0x9afed88f1d6bb0da51d98d29a3aaca31ed7ca99dc51a3df06931c543694f52"
  - "Membership verifier at 0x483b48c3dbd32ebbc45b22a2a419c9a95c3999b103f5eb4a3048a0e8000d1da"
  - "deployments.json with both verifier addresses and class hashes"
  - "On-chain proof verification validated via garaga verify-onchain"
affects: [04-02-StarkShieldRegistry, 05-proof-engine-sdk, 06-demo-app]

# Tech tracking
tech-stack:
  added: [garaga-cli-declare, garaga-cli-deploy, garaga-cli-verify-onchain]
  patterns: [garaga-verifier-per-circuit, env-file-secrets-management]

key-files:
  created:
    - contracts_age_verifier/src/honk_verifier.cairo
    - contracts_age_verifier/src/honk_verifier_circuits.cairo
    - contracts_age_verifier/src/honk_verifier_constants.cairo
    - contracts_membership_verifier/src/honk_verifier.cairo
    - contracts_membership_verifier/src/honk_verifier_circuits.cairo
    - contracts_membership_verifier/src/honk_verifier_constants.cairo
    - deployments.json
  modified:
    - .gitignore

key-decisions:
  - "Garaga public_inputs_size (25/32) differs from Noir-level count (9/16) -- includes internal Honk elements"
  - "Each circuit gets its own Scarb project (contracts_age_verifier, contracts_membership_verifier)"
  - "Verifier endpoint: verify_ultra_keccak_zk_honk_proof returns Result<Span<u256>, felt252>"
  - "Env vars follow garaga convention: SEPOLIA_RPC_URL, SEPOLIA_ACCOUNT_PRIVATE_KEY, SEPOLIA_ACCOUNT_ADDRESS"

patterns-established:
  - "One garaga gen per circuit VK -> separate Scarb project per verifier"
  - "garaga declare -> deploy -> verify-onchain pipeline for verifier deployment"
  - "deployments.json as central registry of deployed contract addresses"

# Metrics
duration: 25min
completed: 2026-02-14
---

# Plan 04-01: Garaga Verifier Deployment Summary

**Two Garaga HonkVerifier contracts (age_verify + membership_proof) declared, deployed, and validated on Starknet Sepolia via garaga verify-onchain**

## Performance

- **Duration:** ~25 min (excluding credential setup wait time)
- **Started:** 2026-02-14
- **Completed:** 2026-02-14
- **Tasks:** 1 auto task (Steps 1-10) + 1 human-verify checkpoint
- **Files modified:** 12 (2 Scarb projects generated + deployments.json + .gitignore)

## Accomplishments
- Generated Garaga verifier contracts from real circuit VKs (age_verify: 25 public_inputs_size, membership_proof: 32)
- Both verifier contracts compile successfully under scarb 2.14.0
- Age verifier declared (class hash: `0x7486ff...8f629`) and deployed at `0x9afed88...94f52`
- Membership verifier declared (class hash: `0x69664e...26ef9`) and deployed at `0x483b48...0d1da`
- Both verified on-chain via garaga verify-onchain (SUCCEEDED status)
- Gas costs: ~2.19 STRK per verification tx (128 l1_data_gas each)

## Task Commits

1. **Task 1 (Steps 1-6): Generate and compile verifiers** - `2ab911f` (feat)
2. **Task 1 (Steps 7-10): Deploy and verify on-chain** - pending commit

## Files Created/Modified
- `contracts_age_verifier/` - Full Garaga-generated Scarb project for age_verify verifier
- `contracts_membership_verifier/` - Full Garaga-generated Scarb project for membership_proof verifier
- `deployments.json` - Network + verifier addresses and class hashes
- `.gitignore` - Added .secrets, verifier target dirs

## Decisions Made
- Garaga's `public_inputs_size` (25 for age, 32 for membership) includes internal Honk proof elements beyond the Noir-level public inputs (9 and 16). The Noir-level count is what matters for extracting public outputs from the verifier's `Result<Span<u256>>`.
- Used Alchemy RPC instead of default Lava RPC for Sepolia access
- `--public-inputs` flag required for garaga verify-onchain (not just proof + VK)

## Deviations from Plan

### Auto-fixed Issues

**1. Missing --public-inputs flag for garaga verify-onchain**
- **Found during:** Step 10 (verify-onchain)
- **Issue:** garaga verify-onchain requires explicit `--public-inputs` path for Honk proofs
- **Fix:** Added `--public-inputs circuits/target/<circuit>_proof/public_inputs` to both commands
- **Verification:** Both verify-onchain transactions succeeded on Sepolia

---

**Total deviations:** 1 auto-fixed
**Impact on plan:** Minor CLI flag addition. No scope change.

## Issues Encountered
- Account not deployed initially -- user needed to deploy account contract via wallet extension before garaga declare could work
- RPC version warning (0.10.0 vs expected 0.10.0-rc.1) from starknet-py -- non-blocking, transactions succeeded

## Gas Cost Baseline (CONT-07 Data)
- **Age verify-onchain tx:** ~2.19 STRK, 128 l1_data_gas
- **Membership verify-onchain tx:** ~2.20 STRK, 128 l1_data_gas
- Note: These are raw verifier-only costs. Registry overhead (storage writes + events) will add a small increment in Plan 02.

## On-Chain Verification Transactions
- Age verify: https://sepolia.voyager.online/tx/0x8cd937f028e84bdaddb8161ad3ab2d9dbfa0146c578d264222912c0110b07d
- Membership verify: https://sepolia.voyager.online/tx/0x6b92ea19b27315eb14a3253dae5465fb69db9f867b56f588c34284dfc51895c

## Next Phase Readiness
- Both verifier addresses recorded in deployments.json -- Plan 02 can read these for StarkShieldRegistry constructor
- Verifier interface confirmed: `verify_ultra_keccak_zk_honk_proof(Span<felt252>) -> Result<Span<u256>, felt252>`
- Plan 02 needs to wire `IUltraKeccakZKHonkVerifierDispatcher` to these deployed addresses

---
*Phase: 04-smart-contracts-deployment*
*Plan: 01*
*Completed: 2026-02-14*
