# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Users can prove who they are without revealing who they are -- private credential verification that is fully on-chain, composable, and trust-minimized.
**Current focus:** Phase 2 - Age Verification Circuit (complete, ready for Phase 3)

## Current Position

Phase: 2 of 8 (Age Verification Circuit)
Plan: 1 of 1 in current phase
Status: Phase complete
Last activity: 2026-02-14 -- Phase 2 Plan 1 executed (age_verify circuit + bb pipeline)

Progress: [███░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 81min
- Total execution time: 4.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2/2 | 237min | 119min |
| 02 | 1/1 | 4min | 4min |

**Recent Trend:**
- Last 5 plans: 227min, 10min, 4min
- Trend: accelerating

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: @noir-lang/backend_barretenberg is deprecated; must use @aztec/bb.js instead
- [Roadmap]: Garaga v1.0.1 tested on Noir beta.16, project uses beta.18 -- Day 1 spike validates compatibility
- [01-01]: Downgraded nargo to beta.16 for garaga 1.0.1 compatibility (beta.18 triggers version warning)
- [01-01]: Downgraded scarb to 2.14.0 (2.15.2 causes infinite compilation of garaga contracts)
- [01-01]: bb prove requires explicit -k VK path; CRS must be pre-downloaded to ~/.bb-crs/
- [01-02]: Schnorr library uses EmbeddedCurvePoint struct from std::embedded_curve_ops
- [01-02]: bb.js poseidon2Hash matches Noir Poseidon2::hash (no message_size param needed in bb.js)
- [01-02]: bb verify requires explicit -i public_inputs_path flag
- [01-02]: @aztec/bb.js@0.82.3 used for TypeScript credential issuance
- [Roadmap]: Phase 5 (Proof Engine SDK) can overlap with Phases 3-4 since it only needs Phase 2 circuit artifacts
- [02-01]: Hard-assert all checks (signature, expiration, age >= threshold) -- proof existence IS the pass signal
- [02-01]: Return values for computed outputs instead of Phase 1's expected-value assertion pattern
- [02-01]: Public output ordering: pub params first (declaration order), then return values (tuple order)
- [02-01]: 1,224 ACIR opcodes for age_verify circuit (well under 5,000 target)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 RESOLVED]: Garaga v1.0.1 compatibility confirmed with Noir beta.16 (beta.18 was incompatible, downgraded)
- [Phase 1]: nargo beta.16 ACIR artifacts with noir_js -- version gap may cause issues (was beta.18 gap, now beta.16)
- [Phase 1 RESOLVED]: scarb 2.15.x incompatible with garaga contracts -- must use scarb 2.14.0
- [Phase 1 RESOLVED]: @aztec/bb.js Poseidon2 and Schnorr TypeScript APIs confirmed working -- cross-validation tests pass

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 02-01-PLAN.md (Phase 2 complete, ready for Phase 3)
Resume file: .planning/phases/02-age-verification-circuit/02-01-SUMMARY.md
