---
phase: 07-web-application
plan: 02
subsystem: ui
tags: [react-19, proof-generation, zk-proof-lifecycle, progress-indicator, public-outputs-preview, starkscan, localStorage]

# Dependency graph
requires:
  - phase: 07-web-application
    provides: React SPA scaffold, WalletContext, Layout, CredentialWallet view, useWallet hook
  - phase: 05-proof-engine-sdk
    provides: SDK proof engine (initWasm, generateAgeProof, generateMembershipProof, verifyProofLocally)
  - phase: 06-wallet-chain-sdk
    provides: Wallet connection (connectWallet), proof submission (generateCalldata, submitProof)
provides:
  - Proof Generator view (WEB-02) at /prove with full proof workflow
  - useProofGeneration hook managing lifecycle (init -> generate -> calldata -> preview -> submit)
  - ProofProgress step-based progress indicator component
  - Public output preview with nullifier, attribute key, threshold/set hash
  - localStorage persistence of verification history for Dashboard
  - Inline error classifier covering 6 error categories
affects: [07-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [proof-lifecycle-hook, step-based-progress, public-output-parsing, localStorage-verification-persistence, inline-error-classification]

key-files:
  created:
    - sdk/app/hooks/useProofGeneration.ts
    - sdk/app/components/ProofProgress.tsx
  modified:
    - sdk/app/views/ProofGenerator.tsx

key-decisions:
  - "2-stage user flow: generate proof -> preview public outputs -> submit on-chain (not auto-submit)"
  - "Public output parsing uses positional indexing (age: 9 fields, membership: 16 fields) matching circuit output ordering"
  - "localStorage key 'starkshield_verifications' stores JSON array of verification records for Dashboard persistence"

patterns-established:
  - "Pattern: useProofGeneration hook encapsulates full proof lifecycle with step-based state machine"
  - "Pattern: ProofStep type shared between hook and progress component via export"
  - "Pattern: Inline error classifier with classifyError function (to be extracted to ErrorBanner in 07-03)"
  - "Pattern: saveVerification writes to localStorage for cross-view persistence"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 7 Plan 2: Proof Generator View Summary

**Proof Generator view with credential selection, age/membership parameter inputs, step-based progress indicator, public output preview before submission, on-chain submission with Starkscan link, and localStorage verification persistence**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T05:12:17Z
- **Completed:** 2026-02-15T05:14:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- useProofGeneration hook manages the full proof lifecycle (init -> generate -> calldata -> preview -> submit -> complete) with step tracking, error handling, and public output parsing for both age_verify (9 fields) and membership_proof (16 fields) circuits
- ProofProgress component shows real-time step-by-step visual feedback with green checkmarks (completed), blue pulsing dot (current), gray circles (future), and red X (error)
- Proof Generator view implements the complete WEB-02 workflow: credential selection (from navigation state or demo loading or file upload), parameter input (threshold for age, allowed set for membership), real-time progress with elapsed timer, public output preview, on-chain submission, and result display with Starkscan link
- localStorage persistence of verification results bridges to the Verification Dashboard (07-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build proof generation hook and progress indicator component** - `447df81` (feat)
2. **Task 2: Build the Proof Generator view with credential selection, input forms, output preview, and submit** - `97e7f34` (feat)

## Files Created/Modified
- `sdk/app/hooks/useProofGeneration.ts` - Custom hook managing proof lifecycle with step state machine, public output parsing, and exposed generateProof/prepareCalldata/submitOnChain/reset functions
- `sdk/app/components/ProofProgress.tsx` - Step-based vertical progress indicator with color-coded states (green/blue/gray/red)
- `sdk/app/views/ProofGenerator.tsx` - Full Proof Generator view with 6 sections: credential selection, parameters, progress, output preview, result, and error

## Decisions Made
- Implemented 2-stage user flow: proof generation runs through initializing -> generating -> calldata automatically, then pauses at "previewing" for user to review public outputs before clicking "Submit On-Chain"
- Public output parsing uses positional array indexing based on circuit output ordering (age: threshold at [0], nullifier at [5]; membership: nullifier at [12], setHash at [14])
- Verification records stored in localStorage under key `starkshield_verifications` as JSON array with newest-first ordering for Dashboard consumption

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Proof Generator view is fully functional at /prove, ready for end-to-end testing with wallet and chain
- Verification Dashboard (07-03) can read from localStorage `starkshield_verifications` key
- Inline error classifier and privacy callout can be extracted to shared components (ErrorBanner, PrivacyCallout) in 07-03
- PublicOutputs type is exported from useProofGeneration for reuse in Dashboard if needed

## Self-Check: PASSED

All 3 files verified on disk. Both task commits (447df81, 97e7f34) found in git log.

---
*Phase: 07-web-application*
*Completed: 2026-02-15*
