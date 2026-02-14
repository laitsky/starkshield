# Phase 2: Age Verification Circuit - Research

**Researched:** 2026-02-14
**Domain:** Noir ZK circuit design -- age threshold comparison, credential signature verification, expiration enforcement, nullifier derivation, public output design
**Confidence:** HIGH (core patterns verified against existing Phase 1 codebase, Noir official docs, and OpenZeppelin circuit safety guide)

## Summary

Phase 2 builds the first production circuit on top of the shared_lib foundation from Phase 1. The age_verify circuit accepts a signed credential (8 private fields), a public threshold, and a public current_timestamp, then outputs a tuple of public values: (passed, nullifier, issuer_pub_key_x, attribute_key, threshold). The circuit enforces four invariants: (1) the issuer's Schnorr signature over the credential hash is valid, (2) the credential has not expired (current_timestamp < expires_at), (3) the age comparison result (attribute_value >= threshold) is computed and exposed as a public boolean, and (4) a per-dApp nullifier is derived for replay detection without cross-dApp linkability.

The critical design decision is how to handle the age comparison on Field types. Noir Fields do not support ordered comparison operators directly in a safe way for arbitrary field elements. The correct approach is to cast the relevant Field values (attribute_value, threshold, current_timestamp, expires_at) to bounded integer types (u64) before comparison. This adds range constraint overhead but guarantees correct ordering semantics and prevents modular arithmetic wrap-around attacks. The u64 type is sufficient for all our use cases: age values (0-200), timestamps (fits in 64 bits until year 584 billion), and thresholds.

The existing shared_lib crate (Credential struct, Schnorr verification, Poseidon2 hashing, nullifier derivation) provides all cryptographic primitives. The age_verify circuit needs only to import shared_lib, add the comparison and expiration logic, define public inputs/outputs correctly, and include comprehensive tests. The constraint budget baseline from Phase 1 is 1,333 ACIR opcodes for the shared_lib primitives; the age comparison and expiration check should add minimal overhead (u64 cast range checks ~100-200 gates each), keeping the total well under the 50K constraint target.

**Primary recommendation:** Create a new `age_verify` binary crate in the Noir workspace that imports shared_lib. Cast Field values to u64 for all ordered comparisons. Use `pub` parameter annotations (not return values) for public inputs to match the existing trivial circuit pattern and Barretenberg's public input handling. Provide current_timestamp as a public input so the on-chain verifier can enforce freshness.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Noir (nargo) | 1.0.0-beta.16 | Circuit compiler | Pinned in Phase 1 for garaga compatibility |
| Barretenberg (bb CLI) | 3.0.0-nightly.20251104 | Prove/verify | Pinned in Phase 1, matched to nargo |
| noir-lang/poseidon | v0.2.3 | Poseidon2 hashing | Already a dependency of shared_lib |
| noir-lang/schnorr | v0.1.3 | Schnorr verification | Already a dependency of shared_lib |
| shared_lib (local) | path dep | Credential, Schnorr, nullifier, Poseidon2 | Built in Phase 1, all primitives verified |
| @aztec/bb.js | 0.82.3 | TypeScript credential issuance for tests | Confirmed compatible in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Garaga CLI | 1.0.1 | Verifier generation (Phase 4) | NOT needed in Phase 2, but circuit design must produce VK-compatible proofs |
| scripts/issuer.ts | local | Generate test credentials | Extend to produce age-specific test fixtures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| u64 for comparisons | Field.lt() method | Field.lt() exists but operates on raw field element ordering which can be surprising for values near the modulus. u64 is explicit, safe, and the gate overhead is acceptable for 4 casts. |
| pub parameters for public outputs | Return values (-> pub) | Both work in Noir. Using pub parameters matches Phase 1's trivial circuit pattern and is more explicit about which values are public inputs vs computed outputs. Return values are cleaner for multiple outputs but change the Prover.toml format. We will use return value approach for cleaner output grouping. |
| Single bool return for pass/fail | Assert and reject invalid witnesses entirely | Returning a boolean `passed` flag allows the verifier contract to handle both pass and fail cases. Hard-asserting would prevent generating a proof for age < threshold, which makes testing harder and gives the contract less flexibility. However, for expiration and signature: these MUST be hard asserts (invalid signature or expired credential = no valid proof possible). |

## Architecture Patterns

### Recommended Project Structure
```
circuits/
├── Nargo.toml                          # Workspace: add age_verify member
└── crates/
    ├── shared_lib/                     # Existing: unchanged
    │   ├── Nargo.toml
    │   └── src/
    │       ├── lib.nr
    │       ├── credential.nr
    │       ├── schnorr.nr
    │       ├── nullifier.nr
    │       └── poseidon.nr
    ├── trivial/                        # Existing: keep as pipeline reference
    │   └── ...
    └── age_verify/                     # NEW: Phase 2 circuit
        ├── Nargo.toml                  # type = "bin", deps: shared_lib, poseidon
        ├── Prover.toml                 # Default test inputs (from issuer)
        └── src/
            └── main.nr                 # Age verification circuit + tests
```

### Pattern 1: Public Input / Output Design for Credential Circuits
**What:** A standard pattern for how to structure circuit inputs as private (credential data) vs public (verification parameters and outputs).
**When to use:** Every credential verification circuit in StarkShield.

The circuit separates inputs into three categories:
1. **Private witness** (known only to prover): All 8 credential fields, the 64-byte signature
2. **Public inputs** (provided by verifier, visible to all): current_timestamp, dapp_context_id, threshold, issuer public key coordinates
3. **Public outputs** (computed by circuit, visible to all): passed boolean, nullifier, issuer_pub_key_x (echoed for contract to check trusted issuers), attribute_key (echoed for contract to know what was verified), threshold (echoed for contract to log)

**Design decision -- pub parameters vs return values:**

In Noir, there are two ways to expose public values:
- `pub` parameter annotations on `fn main()` inputs
- `-> pub` return type from `fn main()`

The Phase 1 trivial circuit used `pub` parameters for both public inputs (dapp_context_id) and expected public outputs (expected_nullifier), with the circuit asserting computed values match the expected ones. This works but requires the prover to pre-compute all public outputs and pass them in.

For the age_verify circuit, use **return values** for computed outputs. This is cleaner: the circuit computes the nullifier, passed flag, etc., and returns them. The prover does not need to pre-compute these values. Public inputs (current_timestamp, threshold, dapp_context_id) remain as `pub` parameters.

```noir
fn main(
    // --- Private witness (credential) ---
    subject_id: Field,
    issuer_id: Field,
    credential_type: Field,
    attribute_key: Field,
    attribute_value: Field,
    issued_at: Field,
    expires_at: Field,
    secret_salt: Field,
    signature: [u8; 64],
    // --- Public inputs (verification parameters) ---
    pub_key_x: pub Field,
    pub_key_y: pub Field,
    current_timestamp: pub Field,
    threshold: pub Field,
    dapp_context_id: pub Field,
) -> pub (bool, Field, Field, Field, Field) {
    // Returns: (passed, nullifier, issuer_pub_key_x, attribute_key, threshold)
}
```

**Important note on return value serialization:** When using `-> pub` return types, the public outputs appear in the proof's public inputs array. The order matches the return tuple order, followed by any `pub` parameter inputs. This ordering matters for Phase 4 (contract verification) and Phase 5 (SDK proof handling).

### Pattern 2: Safe Integer Comparison for Field Values
**What:** Cast Field to u64 before performing ordered comparisons (>=, <) to avoid modular arithmetic wrap-around.
**When to use:** Any time you compare credential field values (age, timestamps, thresholds).

```noir
// UNSAFE: Field comparison can wrap around the modulus
// let passed = attribute_value.lt(threshold);  // DON'T DO THIS for business logic

// SAFE: Cast to bounded integer type, then compare
let age = attribute_value as u64;
let min_age = threshold as u64;
let passed: bool = age >= min_age;
```

**Why u64 and not a smaller type:** u64 accommodates both age values (small numbers) and Unix timestamps (which are ~10 digits and fit in u64). Using a single type for all comparisons avoids confusion and the gate overhead difference between u32 and u64 is minimal.

**Range constraint cost:** Each `as u64` cast adds range constraint gates (~64 gates for a 64-bit decomposition). With 4 casts (attribute_value, threshold, current_timestamp, expires_at), this adds ~256 gates -- negligible against the ~1,333 ACIR opcode baseline.

### Pattern 3: Hard Assert vs Soft Boolean Output
**What:** Some circuit checks must cause proof generation to fail (hard assert), while others should produce a boolean result (soft check).
**When to use:** Security-critical vs business-logic checks.

| Check | Type | Rationale |
|-------|------|-----------|
| Signature verification | **Hard assert** | An invalid signature means the credential is forged. No valid proof should exist. |
| Expiration check | **Hard assert** | An expired credential should not produce any valid proof. The verifier should not need to check this. |
| Age >= threshold | **Soft boolean** | The circuit should be able to produce a valid proof that says "passed = false" so the verifier can see the result. However, see design note below. |

**Design note on age comparison:** The success criteria state "a credential with age < threshold produces passed=false or the circuit rejects the witness." Both approaches are valid. The simplest approach for a hackathon is to **hard-assert age >= threshold** as well, making it impossible to generate a proof for an underage credential. This simplifies the contract (it only ever sees "passed = true" proofs) and avoids a privacy concern where a "passed = false" proof still reveals that someone tried and failed. The `passed` output can still be included as a constant `true` for consistency with the public output schema, or the output schema can be simplified.

**Recommendation:** Hard-assert all checks (signature, expiration, AND age >= threshold). The `passed` field in public outputs is always `true` for any valid proof. An invalid credential simply cannot produce a proof. This is the standard ZK pattern: the proof's existence IS the assertion.

### Anti-Patterns to Avoid
- **Returning private data as public output:** Never include subject_id, issuer_id, credential_type, attribute_value, issued_at, expires_at, or secret_salt in public outputs. The OpenZeppelin guide specifically warns against naive age verification that returns the age value.
- **Using Field.lt() for business logic comparisons:** Field.lt() compares raw field element representations. For values near the BN254 modulus (~2^254), this produces counterintuitive results. Always cast to integer types for ordered comparisons.
- **Using && and || for boolean logic:** Noir does not support these operators. Use bitwise `&` and `|` instead, or chain separate assert statements.
- **Comparing Field values without range-constraining inputs:** If a malicious prover provides attribute_value close to the field modulus, casting `as u64` will fail the range check (the value does not fit in 64 bits). This is actually a desirable security property -- it prevents wrap-around attacks. But be aware that ALL Field inputs used in comparisons must survive the u64 cast.
- **Making current_timestamp a private input:** If the prover controls the timestamp, they can use any value they want (e.g., timestamp = 0 to bypass expiration). The timestamp MUST be a public input so the verifier (on-chain contract) can check that it is recent/valid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential hashing | Manual field hashing | `shared_lib::credential::Credential.hash()` | Already built, cross-validated with bb.js |
| Schnorr verification | Custom signature check | `shared_lib::schnorr::assert_credential_signature()` | Uses assert variant for hard failure |
| Nullifier derivation | Custom nullifier logic | `shared_lib::nullifier::derive_nullifier()` | Already cross-validated with bb.js |
| Range-safe comparison | Manual bit decomposition | `as u64` cast + standard `>=` operator | Noir compiler handles the range constraint generation |
| Test credential generation | Manual hex value construction | `scripts/issuer.ts` (extend for test cases) | Ensures Poseidon2/Schnorr compatibility |

**Key insight:** Every cryptographic primitive needed for the age_verify circuit already exists in shared_lib. Phase 2 adds ONLY the comparison logic, expiration check, and public output wiring. This should be a focused, small circuit.

## Common Pitfalls

### Pitfall 1: Field Modular Wrap-Around in Comparisons
**What goes wrong:** Using Field.lt() or direct Field comparison for age/timestamp checks. A malicious prover could craft field values near the modulus that appear to satisfy `age >= threshold` due to wrap-around.
**Why it happens:** Developers treat Field like an integer, but Field arithmetic wraps modulo the BN254 prime (~2^254).
**How to avoid:** ALWAYS cast Field to u64 before ordered comparisons. The cast itself adds a range constraint that rejects values > 2^64.
**Warning signs:** Tests pass with small values but a fuzz test with large field values breaks assumptions.

### Pitfall 2: Private Timestamp Allows Expiration Bypass
**What goes wrong:** Making current_timestamp a private input. The prover can set it to any value (e.g., 0 or a past timestamp) to make an expired credential appear valid.
**Why it happens:** Developer treats all "parameters" as private by default.
**How to avoid:** Mark current_timestamp as `pub`. The on-chain verifier contract checks that the public timestamp input is recent (within acceptable bounds).
**Warning signs:** Expired credentials produce valid proofs when they shouldn't.

### Pitfall 3: Returning Actual Age as Public Output
**What goes wrong:** The circuit accidentally includes attribute_value in public outputs, or a hash of the age that can be brute-forced (age has only ~150 possible values).
**Why it happens:** Developer wants the verifier to "see" the result clearly.
**How to avoid:** Public outputs include ONLY: passed (bool), nullifier, issuer_pub_key_x, attribute_key, threshold. The actual age value NEVER appears in public outputs. Even hashing it is unsafe due to the small domain.
**Warning signs:** Any public output that varies with the actual age (other than the pass/fail boolean).

### Pitfall 4: Forgetting to Update Workspace Nargo.toml
**What goes wrong:** Creating the age_verify crate but not adding it to the workspace members list. `nargo build` silently only builds the default-member (trivial).
**Why it happens:** Noir workspace behavior mirrors Rust workspaces -- you must explicitly list members.
**How to avoid:** Add "crates/age_verify" to the workspace members list in `circuits/Nargo.toml`. Use `nargo build --package age_verify` to build specifically.
**Warning signs:** `nargo build` succeeds but no `age_verify.json` appears in target/.

### Pitfall 5: Prover.toml Field Formatting for u8 Arrays
**What goes wrong:** Signature bytes in Prover.toml are formatted as hex strings instead of decimal integers, or quoted incorrectly.
**Why it happens:** Noir's Prover.toml format requires specific TOML formatting for different types.
**How to avoid:** Follow the exact format from the trivial circuit's Prover.toml: `signature = ["24", "176", ...]` (array of quoted decimal strings for [u8; 64]).
**Warning signs:** "Expected witness values to be integers" or "Failed to parse" errors from nargo execute.

### Pitfall 6: Incorrect VK/Proof Path After Adding New Circuit
**What goes wrong:** Running bb commands with paths pointing to trivial circuit artifacts instead of age_verify artifacts.
**Why it happens:** Phase 1 commands used `target/trivial.json`. New circuit produces `target/age_verify.json`.
**How to avoid:** Update all bb commands to reference the correct circuit name: `-b target/age_verify.json`, `-o target/age_verify_vk/`, etc.
**Warning signs:** VK generation succeeds but proof generation fails with "circuit mismatch" or wrong constraint count.

### Pitfall 7: Boolean Output Encoding in Public Inputs
**What goes wrong:** The `passed` boolean in public outputs may be encoded as a Field (0 or 1) rather than a native bool, depending on how Barretenberg serializes public inputs. The contract in Phase 4 needs to know the encoding.
**Why it happens:** ZK proof systems work with field elements. Booleans are encoded as 0/1 Field elements in the public inputs array.
**How to avoid:** Document the public output encoding: bool maps to Field 0 (false) or 1 (true). Write a test that generates a proof and inspects the public_inputs file to verify the encoding.
**Warning signs:** Phase 4 contract reads wrong values from the public inputs array.

## Code Examples

Verified patterns from existing codebase and official documentation:

### Age Verify Circuit Main Function
```noir
// circuits/crates/age_verify/src/main.nr
// Source: Adapted from Phase 1 trivial circuit + Noir official docs
use dep::shared_lib::credential::Credential;
use dep::shared_lib::schnorr::assert_credential_signature;
use dep::shared_lib::nullifier::derive_nullifier;

fn main(
    // Private witness: credential fields
    subject_id: Field,
    issuer_id: Field,
    credential_type: Field,
    attribute_key: Field,
    attribute_value: Field,
    issued_at: Field,
    expires_at: Field,
    secret_salt: Field,
    // Private witness: signature
    signature: [u8; 64],
    // Public inputs: verification parameters
    pub_key_x: pub Field,
    pub_key_y: pub Field,
    current_timestamp: pub Field,
    threshold: pub Field,
    dapp_context_id: pub Field,
) -> pub (Field, Field, Field, Field) {
    // Returns: (nullifier, issuer_pub_key_x, attribute_key, threshold)
    // Note: If this function returns at all, the proof is valid (all asserts passed).
    // The existence of a valid proof IS the "passed = true" signal.

    // 1. Construct credential and compute hash
    let credential = Credential {
        subject_id,
        issuer_id,
        credential_type,
        attribute_key,
        attribute_value,
        issued_at,
        expires_at,
        secret_salt,
    };
    let credential_hash = credential.hash();

    // 2. Verify issuer signature (HARD ASSERT -- forged credential = no proof)
    assert_credential_signature(pub_key_x, pub_key_y, signature, credential_hash);

    // 3. Check expiration (HARD ASSERT -- expired credential = no proof)
    let ts = current_timestamp as u64;
    let exp = expires_at as u64;
    assert(ts < exp, "Credential has expired");

    // 4. Check age threshold (HARD ASSERT -- underage = no proof)
    let age = attribute_value as u64;
    let min_age = threshold as u64;
    assert(age >= min_age, "Age below threshold");

    // 5. Derive per-dApp nullifier
    let nullifier = derive_nullifier(secret_salt, credential_hash, dapp_context_id);

    // 6. Return public outputs
    // The contract reads these to: check issuer is trusted, log the verification,
    // and store the nullifier for replay prevention.
    (nullifier, pub_key_x, attribute_key, threshold)
}
```

### Nargo.toml for age_verify Crate
```toml
# circuits/crates/age_verify/Nargo.toml
[package]
name = "age_verify"
type = "bin"
compiler_version = ">=0.36.0"

[dependencies]
poseidon = { tag = "v0.2.3", git = "https://github.com/noir-lang/poseidon" }
shared_lib = { path = "../shared_lib" }
```

### Updated Workspace Nargo.toml
```toml
# circuits/Nargo.toml
[workspace]
members = ["crates/shared_lib", "crates/trivial", "crates/age_verify"]
default-member = "crates/age_verify"
```

### Test: Valid Age Verification
```noir
#[test]
fn test_valid_age_verification() {
    // Use hardcoded values from demo credential (age=25, threshold=18)
    // These values are from the issuer.ts output, cross-validated in Phase 1
    let subject_id = 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b;
    let issuer_id = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let credential_type = 0;
    let attribute_key = 1;  // age
    let attribute_value = 25;  // age = 25
    let issued_at = 0x69905d7b;  // some past timestamp
    let expires_at = 0x6b7190fb;  // future timestamp
    let secret_salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;

    // ... (signature bytes, pub key from demo credential)
    // Test that main() returns without assertion failure
    // Actual full test requires all values from demo_credential.json
}
```

### Test: Expired Credential Rejected
```noir
#[test(should_fail_with = "Credential has expired")]
fn test_expired_credential_rejected() {
    // Same credential but with current_timestamp >= expires_at
    // This test verifies the expiration check works
}
```

### Test: Age Below Threshold Rejected
```noir
#[test(should_fail_with = "Age below threshold")]
fn test_age_below_threshold_rejected() {
    // Same credential (age=25) but with threshold=30
    // This test verifies the age comparison works
}
```

### Test: Wrong Issuer Signature Rejected
```noir
#[test(should_fail)]
fn test_wrong_signature_rejected() {
    // Valid credential fields but with a signature from a different keypair
    // This test verifies signature verification is enforced
}
```

### Test: Different dApp Context Produces Different Nullifier
```noir
#[test]
fn test_different_context_different_nullifier() {
    // Same credential, two different dapp_context_ids
    // Assert the nullifiers are different
    let salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;
    let hash = 0x267da9221ca9314ab3ca3c5eb771bb3961c0925ec7dee6497c03e98c81a0482d;
    let context_a = 42;
    let context_b = 99;

    let null_a = derive_nullifier(salt, hash, context_a);
    let null_b = derive_nullifier(salt, hash, context_b);

    assert(null_a != null_b, "Different contexts must produce different nullifiers");
}
```

### Test: Same Context Produces Same Nullifier (Deterministic)
```noir
#[test]
fn test_same_context_same_nullifier() {
    let salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;
    let hash = 0x267da9221ca9314ab3ca3c5eb771bb3961c0925ec7dee6497c03e98c81a0482d;
    let context = 42;

    let null_1 = derive_nullifier(salt, hash, context);
    let null_2 = derive_nullifier(salt, hash, context);

    assert(null_1 == null_2, "Same context must produce same nullifier");
}
```

### Pipeline Commands for age_verify
```bash
# Build the age_verify circuit
cd circuits && nargo build --package age_verify

# Run tests
nargo test --package age_verify

# Check constraint count
nargo info --package age_verify

# Generate witness
nargo execute --package age_verify

# Generate VK
bb write_vk -s ultra_honk --oracle_hash keccak \
  -b target/age_verify.json -o target/age_verify_vk

# Generate proof
bb prove -s ultra_honk --oracle_hash keccak \
  -b target/age_verify.json -w target/age_verify.gz \
  -k target/age_verify_vk/vk -o target/age_verify_proof

# Verify proof locally
bb verify -s ultra_honk --oracle_hash keccak \
  -k target/age_verify_vk/vk \
  -p target/age_verify_proof/proof \
  -i target/age_verify_proof/public_inputs
```

### Extending issuer.ts for Test Fixtures
```typescript
// Generate an expired credential for testing
const expiredCredential = {
  ...baseCredential,
  expires_at: new Fr(BigInt(Math.floor(Date.now() / 1000)) - 86400n), // expired yesterday
};

// Generate a credential with age below threshold for testing
const youngCredential = {
  ...baseCredential,
  attribute_value: new Fr(15n), // age = 15
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Field.lt() for comparisons | Cast to u64, use native >= operator | Always (best practice) | Prevents modular wrap-around attacks on comparison logic |
| Return `passed: bool` as public output | Proof existence IS the pass signal | Standard ZK pattern | Simplifies contract, removes the "what does passed=false mean?" question |
| Soft-fail age check (return false) | Hard-assert (no proof for invalid input) | Design choice for this project | Prevents revealing that someone tried and failed an age check |
| `expected_nullifier` as pub input + assert | Compute nullifier and return as pub output | Phase 2 design improvement | Prover doesn't need to pre-compute nullifier; cleaner separation of inputs vs outputs |

**Deprecated/outdated from Phase 1 patterns:**
- The trivial circuit's pattern of passing expected outputs as `pub` parameters and asserting equality is replaced by the cleaner return-value approach for computed outputs. This is an evolution, not a bug in Phase 1 -- the trivial circuit was designed for pipeline validation, not production use.

## Open Questions

1. **Exact public output ordering in bb proof format**
   - What we know: When using `-> pub (Field, Field, Field, Field)` return type, the values appear in the proof's public inputs. The `pub` parameter inputs also appear.
   - What's unclear: The exact ordering of return values vs pub parameters in the serialized public_inputs file. Is it [return values first, then pub params] or vice versa?
   - Recommendation: After building the circuit, generate a proof and inspect `target/age_verify_proof/public_inputs` to document the exact ordering. This is critical for Phase 4 (contract reads public inputs by index).

2. **Whether `-> pub bool` works or needs Field encoding**
   - What we know: Noir documentation says any type can be public. Bool should work as a return type.
   - What's unclear: How bb serializes a bool in the public inputs file (as "0"/"1" field elements?). The recommended approach avoids this question by not including `passed` in the return tuple (proof existence = passed).
   - Recommendation: Use the "proof existence = passed" pattern. If the requirements strictly need a `passed` field in public outputs, add it as a constant `1` Field return value and verify serialization.

3. **Constraint count impact of u64 casts**
   - What we know: Each u64 cast adds ~64 range constraint gates. Four casts = ~256 gates.
   - What's unclear: Exact gate count after full circuit compilation with all optimizations.
   - Recommendation: Run `nargo info --package age_verify` after implementation and document the constraint count. Target: under 5K ACIR opcodes total (shared_lib ~1,333 + comparison/expiration overhead).

4. **Whether `nargo execute --package age_verify` reads from `crates/age_verify/Prover.toml`**
   - What we know: In Phase 1, `nargo execute` reads Prover.toml from the package directory.
   - What's unclear: Whether the `--package` flag correctly resolves the Prover.toml path in a workspace.
   - Recommendation: Test this early. If it doesn't work, fall back to `cd crates/age_verify && nargo execute`.

5. **bb output paths with --package flag**
   - What we know: In Phase 1, bb wrote to `target/` relative to the workspace root. With a new package name, the compiled JSON goes to `target/age_verify.json`.
   - What's unclear: Whether witness output goes to `target/age_verify.gz` or `target/witness.gz` or somewhere else when using `--package`.
   - Recommendation: Run `nargo execute --package age_verify` and check what files appear in `target/`. Document the exact paths.

## Sources

### Primary (HIGH confidence)
- **Existing Phase 1 codebase** (circuits/crates/shared_lib/src/*.nr, circuits/crates/trivial/src/main.nr) -- verified working implementations of all crypto primitives
- **Phase 1 Research, Plans, and Summaries** (.planning/phases/01-*) -- established patterns, version pins, pipeline commands, constraint baseline
- [Noir Fields documentation](https://noir-lang.org/docs/noir/concepts/data_types/fields) -- Field.lt(), assert_max_bit_size(), type casting
- [Noir Integers documentation](https://noir-lang.org/docs/noir/concepts/data_types/integers) -- u64 type, range constraints, comparison operators
- [Noir Data Types documentation](https://noir-lang.org/docs/noir/concepts/data_types) -- pub keyword, public output types, any type can be public
- [Noir Tests documentation](https://noir-lang.org/docs/tooling/tests) -- #[test], #[test(should_fail_with = "...")], fuzz testing
- [Noir stdlib Field source](https://github.com/noir-lang/noir/blob/master/noir_stdlib/src/field/mod.nr) -- Field.lt() implementation, assert_max_bit_size implementation

### Secondary (MEDIUM confidence)
- [OpenZeppelin Guide to Building Safe Noir Circuits](https://www.openzeppelin.com/news/developer-guide-to-building-safe-noir-circuits) -- overflow/underflow attacks, privacy leaks, naive age verification anti-pattern, range check best practices
- [Noir "Thinking in Circuits"](https://noir-lang.org/docs/explainers/explainer-writing-noir) -- gate costs of operations, optimization patterns, unconstrained execution
- [noir-lang/noir_sort assert_max_bit_size pattern](https://github.com/noir-lang/noir_sort) -- `diff.assert_max_bit_size(16)` for comparison

### Tertiary (LOW confidence)
- Public output ordering in bb proof format -- not formally documented, needs empirical verification
- Bool serialization in public inputs -- assumed to be 0/1 Field encoding but not verified
- Exact constraint count for u64 casts -- estimated at ~64 gates each based on bit decomposition, needs measurement

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools and libraries are Phase 1-validated, no new dependencies needed
- Architecture: HIGH -- circuit design follows established patterns from Phase 1 + Noir official docs + OpenZeppelin security guide
- Pitfalls: HIGH -- modular arithmetic risks verified via OpenZeppelin guide and Noir stdlib source; timestamp attack documented in multiple ZK security resources
- Code examples: MEDIUM -- adapted from working Phase 1 code and official docs, but the exact age_verify circuit has not been compiled yet; minor syntax adjustments may be needed (particularly around return value syntax in beta.16)
- Public output ordering: LOW -- needs empirical verification after first successful compilation

**Research date:** 2026-02-14
**Valid until:** 2026-02-28 (stable -- no new tool versions expected during hackathon; all deps are pinned)
