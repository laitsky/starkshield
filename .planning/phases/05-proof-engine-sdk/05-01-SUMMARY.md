---
phase: 05-proof-engine-sdk
plan: 01
subsystem: sdk
tags: [noir_js, bb.js, wasm, vite, typescript, zk-proof, browser, ultraHonk]

# Dependency graph
requires:
  - phase: 02-circuit-development
    provides: "Compiled circuit artifacts (age_verify.json, membership_proof.json)"
  - phase: 01-toolchain-validation-circuit-foundation
    provides: "Demo credential JSON files, version pins (nargo beta.16, bb 3.0.0-nightly)"
provides:
  - "TypeScript SDK for browser-side ZK proof generation"
  - "WASM initialization gate for noir_js ACVM and noirc_abi"
  - "Credential validation and circuit-compatible witness input transformation"
  - "Proof generation engine for age_verify and membership_proof circuits"
  - "Local proof verification via bb.js UltraHonkBackend"
  - "Browser E2E test page served via Vite with COOP/COEP headers"
affects: [06-wallet-integration, 07-web-app, proof-submission]

# Tech tracking
tech-stack:
  added: ["@noir-lang/noir_js@1.0.0-beta.16", "@aztec/bb.js@3.0.0-nightly.20251104", "garaga@1.0.1", "vite@6", "vite-plugin-node-polyfills@0.25.0", "typescript@5"]
  patterns: ["WASM init gate (initWasm before any noir_js operation)", "credential-to-InputMap transformation", "UltraHonkBackend proof generation with keccak option", "Vite COOP/COEP middleware for SharedArrayBuffer"]

key-files:
  created:
    - sdk/package.json
    - sdk/tsconfig.json
    - sdk/vite.config.ts
    - sdk/src/types.ts
    - sdk/src/init.ts
    - sdk/src/credentials.ts
    - sdk/src/prover.ts
    - sdk/src/index.ts
    - sdk/index.html
    - sdk/src/vite-env.d.ts
  modified: []

key-decisions:
  - "vite-plugin-node-polyfills upgraded from 0.17.0 to 0.25.0 (0.17.0 incompatible with vite 6 peer dep)"
  - "Using { keccak: true } for proof generation matching Phase 4 CLI validation (switch to keccakZK if on-chain fails)"
  - "Signature array mapped via .map(b => b.toString()) for noir_js InputMap string requirement"
  - "bb.js excluded from Vite optimizeDeps to prevent WASM loading breakage"

patterns-established:
  - "WASM Init Gate: Call initWasm() before any noir_js/bb.js operation; idempotent via module-level flag"
  - "Credential Validation: Validate all 11 required fields, signature format (64 u8), hex prefix, credential_type"
  - "InputMap Transformation: Map credential JSON fields to circuit parameter names, signature as string[], hex params with 0x prefix"
  - "Proof Generation Pipeline: initWasm -> credentialToInputs -> noir.execute(inputs) -> backend.generateProof(witness) -> backend.destroy()"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 5 Plan 1: Proof Engine SDK Summary

**Browser-side ZK proof generation SDK using noir_js beta.16 + bb.js 3.0.0-nightly with Vite COOP/COEP dev server**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T15:44:53Z
- **Completed:** 2026-02-14T15:50:44Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Complete TypeScript SDK (`sdk/`) with WASM initialization, credential validation, and proof generation for both age_verify and membership_proof circuits
- Vite dev server configured with COOP/COEP headers (SharedArrayBuffer), bb.js exclusion from optimizeDeps, node polyfills, and esnext build target
- Browser E2E test page at `sdk/index.html` with buttons to generate and locally verify proofs for both circuit types
- All TypeScript compiles without errors; dev server starts cleanly; credential JSON files served as static assets

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold SDK package with Vite, dependencies, and circuit artifacts** - `50d9573` (feat)
2. **Task 2: Build core SDK modules -- WASM init, credential loading, and proof generation** - `356068d` (feat)
3. **Task 3: Create browser E2E test page and validate proof generation for both circuits** - `41d1aff` (feat)

## Files Created/Modified
- `sdk/package.json` - SDK dependencies: noir_js@beta.16, bb.js@3.0.0-nightly, garaga@1.0.1, vite@6
- `sdk/tsconfig.json` - ESNext target, strict mode, bundler moduleResolution
- `sdk/vite.config.ts` - COOP/COEP headers, bb.js exclusion, node polyfills, WASM assets
- `sdk/src/types.ts` - CredentialJSON, ProofResult, AgeProofParams, MembershipProofParams, ValidationResult
- `sdk/src/init.ts` - WASM initialization gate for noir_js ACVM and noirc_abi
- `sdk/src/credentials.ts` - Credential validation and witness input transformation for both circuit types
- `sdk/src/prover.ts` - Proof generation engine: generateAgeProof, generateMembershipProof, verifyProofLocally
- `sdk/src/index.ts` - Public API barrel export
- `sdk/src/vite-env.d.ts` - Vite client type reference for WASM ?url imports
- `sdk/index.html` - Browser E2E test page with proof generation buttons
- `sdk/src/circuits/age_verify.json` - Compiled age verification circuit (copied from circuits/target/)
- `sdk/src/circuits/membership_proof.json` - Compiled membership proof circuit (copied from circuits/target/)
- `sdk/public/credentials/demo_credential.json` - Age demo credential (static asset)
- `sdk/public/credentials/demo_credential_membership.json` - Membership demo credential (static asset)

## Decisions Made
- **vite-plugin-node-polyfills 0.25.0:** Plan specified 0.17.0 but it has `peer vite: ^2-5` -- incompatible with vite 6. Upgraded to 0.25.0 which supports vite 6.
- **{ keccak: true } proof option:** Matches the bb CLI behavior validated in Phase 4 (`bb prove -s ultra_honk --oracle_hash keccak`). If on-chain verification fails in Phase 6, switch to `{ keccakZK: true }` -- a one-line change.
- **skipLibCheck: true in tsconfig:** Added to avoid type conflicts between noir_js beta.16 internal types and bb.js 3.0.0-nightly types, which may have minor incompatibilities in shared type definitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vite-plugin-node-polyfills version incompatibility**
- **Found during:** Task 1 (npm install)
- **Issue:** vite-plugin-node-polyfills@0.17.0 has peer dependency `vite: ^2.0.0 || ^3.0.0 || ^4.0.0 || ^5.0.0` -- does not support vite 6
- **Fix:** Upgraded to vite-plugin-node-polyfills@0.25.0 which adds vite 6 support
- **Files modified:** sdk/package.json
- **Verification:** npm install succeeds, Vite dev server starts correctly
- **Committed in:** 50d9573 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor version bump for vite compatibility. No scope creep. API is identical between 0.17.0 and 0.25.0.

## Issues Encountered
None -- all tasks executed smoothly after the version fix.

## User Setup Required
None - no external service configuration required.

## Browser Verification Required

The user must open http://localhost:5173 in Chrome to complete the browser proof generation validation:

1. Run `cd sdk && npx vite --port 5173` to start the dev server
2. Open http://localhost:5173 in Chrome
3. Click "Generate Age Proof" -- should complete in < 30 seconds
4. Click "Generate Membership Proof" -- should also complete in < 30 seconds
5. Both proofs should show "Proof verified locally: VALID"

## Next Phase Readiness
- SDK provides all proof generation functions needed by wallet integration (Phase 6) and web app (Phase 7)
- garaga npm package installed for future calldata generation (Phase 6 on-chain submission)
- Open question: browser proving time not yet measured -- user validation needed
- Open question: { keccak: true } vs { keccakZK: true } for on-chain Garaga compatibility -- will be validated in Phase 6

## Self-Check: PASSED

- All 14 created files verified present on disk
- All 3 task commits verified in git log (50d9573, 356068d, 41d1aff)

---
*Phase: 05-proof-engine-sdk*
*Completed: 2026-02-14*
