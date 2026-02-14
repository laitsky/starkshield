# Phase 3: Membership Verification Circuit - Research

**Researched:** 2026-02-14
**Domain:** Noir ZK circuit design -- set membership proof, credential signature verification, expiration enforcement, nullifier derivation, public output design
**Confidence:** HIGH (core patterns verified against working Phase 2 age_verify circuit, Noir official docs for array methods, and established shared_lib primitives)

## Summary

Phase 3 builds the second production circuit on the shared_lib foundation, following the exact patterns established in Phase 2's age_verify circuit. The membership_proof circuit accepts a signed credential (8 private fields), a public allowed set of Field values, and public verification parameters, then proves that the credential's `attribute_value` is in the allowed set without revealing which element it matches. The circuit reuses all shared_lib primitives (signature verification, nullifier derivation, expiration check) and adds only the set membership check logic.

The critical design decision is how to implement "value is in set" privately. Two approaches exist: (1) linear scan over a fixed-size public array using Noir's `.any()` method or a for-loop with equality accumulation, and (2) Merkle tree inclusion proof where the root is public and the path is private. For a hackathon MVP with small sets (2-20 members), the linear scan approach is the clear winner: it adds minimal constraints (one equality comparison per set element), requires no additional cryptographic primitives, needs no off-chain Merkle tree management, and follows the existing circuit's flat-input pattern. The architecture research mentioned Merkle trees, but the actual requirement (CIRC-02) simply says "proves attribute_value is in allowed set" -- a linear scan satisfies this with an order of magnitude less complexity.

The membership_proof circuit mirrors the age_verify circuit structure almost exactly: same private witness fields (credential + signature), same shared_lib imports, same hard-assert pattern (proof existence = pass signal), same public output schema (nullifier, issuer_pub_key_x, attribute_key, allowed_set_hash). The only difference is that the age comparison (`attribute_value >= threshold`) is replaced by a set membership check (`attribute_value is in allowed_set`). The allowed set is passed as a fixed-size public array, and a Poseidon2 hash of the set is returned as a public output so the on-chain contract can verify the set was not tampered with.

**Primary recommendation:** Create a new `membership_proof` binary crate that mirrors the age_verify structure. Use a fixed-size array `allowed_set: pub [Field; N]` as a public input with a compile-time-fixed N (recommend N=8 for the MVP, padded with zeros). Check membership via a for-loop accumulating a boolean match. Return (nullifier, issuer_pub_key_x, attribute_key, allowed_set_hash) as public outputs. Target under 2,000 ACIR opcodes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Noir (nargo) | 1.0.0-beta.16 | Circuit compiler | Pinned in Phase 1 for garaga compatibility |
| Barretenberg (bb CLI) | Matched to nargo | Prove/verify | Pinned in Phase 1 |
| noir-lang/poseidon | v0.2.3 | Poseidon2 hashing | Already a dependency of shared_lib |
| noir-lang/schnorr | v0.1.3 | Schnorr verification | Already a dependency of shared_lib |
| shared_lib (local) | path dep | Credential, Schnorr, nullifier, Poseidon2 | Built in Phase 1, all primitives verified |
| @aztec/bb.js | 0.82.3 | TypeScript credential issuance for tests | Confirmed compatible in Phase 1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| scripts/issuer.ts | local | Generate membership test credentials | Already supports `--type membership` flag |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Linear scan over public array | Merkle tree inclusion proof | Merkle trees are more efficient for large sets (100+) but add massive complexity: need Poseidon2 Merkle tree builder in TypeScript, path witness construction, and the set root must be managed off-chain. For sets of 2-20 elements, linear scan is simpler, fewer constraints, and no additional tooling needed. |
| Fixed-size array [Field; 8] | BoundedVec | BoundedVec is a Noir stdlib container for dynamic-length data, but it adds complexity for the circuit interface. Fixed-size arrays with zero-padding are simpler for public inputs and map directly to Prover.toml format. |
| `.any()` method | Manual for-loop with boolean accumulation | Both produce equivalent constraints. The `.any()` method is more idiomatic Noir but may have surprising constraint behavior. A manual for-loop with `found = found | (allowed_set[i] == attribute_value)` is more explicit and predictable. Both are valid; recommend the for-loop for clarity. |
| Returning allowed_set_hash | Returning the full allowed_set | The full set is already public (as pub input), but returning a Poseidon2 hash as a return value gives the contract a single Field to store/compare, rather than parsing N array elements from public inputs. More gas-efficient on-chain. |

## Architecture Patterns

### Recommended Project Structure
```
circuits/
├── Nargo.toml                          # Workspace: add membership_proof member
└── crates/
    ├── shared_lib/                     # Existing: unchanged
    │   └── src/
    │       ├── lib.nr
    │       ├── credential.nr
    │       ├── schnorr.nr
    │       ├── nullifier.nr
    │       └── poseidon.nr
    ├── trivial/                        # Existing: keep as pipeline reference
    ├── age_verify/                     # Existing: Phase 2 circuit
    └── membership_proof/               # NEW: Phase 3 circuit
        ├── Nargo.toml                  # type = "bin", deps: shared_lib, poseidon
        ├── Prover.toml                 # Default test inputs (membership credential)
        └── src/
            └── main.nr                 # Membership verification circuit + tests
```

### Pattern 1: Set Membership via Linear Scan
**What:** Prove that a private value is contained in a public fixed-size array without revealing which element matches.
**When to use:** When the allowed set is small (2-20 elements) and the set values are public.

The circuit receives the allowed set as a public `[Field; N]` array. It iterates over all N elements, comparing each to the private `attribute_value`. If any element matches, the check passes. Unused slots are padded with zero (0x0), and the circuit must ensure 0x0 is not a valid membership value (or that the credential's attribute_value cannot be 0).

```noir
// Set membership check: attribute_value must be in allowed_set
let mut found: bool = false;
for i in 0..8 {
    if allowed_set[i] == attribute_value {
        found = true;
    }
}
assert(found, "Attribute value not in allowed set");
```

**Constraint cost analysis:** Each iteration adds approximately 1-2 gates for the Field equality comparison plus a few gates for the boolean OR accumulation. For N=8, this is roughly 16-24 additional gates -- negligible compared to the ~1,224 ACIR opcode baseline from signature verification and Poseidon2 hashing.

**Privacy analysis:** The verifier sees the full allowed_set (it is public), but the proof reveals NOTHING about which element matched. The prover could hold attribute_value equal to any element in the set, and the proof would look identical. This is the core privacy property we need.

### Pattern 2: Mirror the age_verify Circuit Structure
**What:** Follow the exact same structure as the age_verify circuit, changing only the domain-specific check.
**When to use:** Every credential verification circuit in StarkShield.

Both circuits share:
1. Same private witness: 8 credential fields + 64-byte signature
2. Same shared_lib imports: Credential, assert_credential_signature, derive_nullifier
3. Same hard-assert pattern: signature check, expiration check, domain-specific check
4. Same public input pattern: pub_key_x, pub_key_y, current_timestamp, dapp_context_id
5. Same return pattern: (nullifier, issuer_pub_key_x, attribute_key, domain_specific_output)

The only differences:
- age_verify takes `threshold: pub Field` -- membership_proof takes `allowed_set: pub [Field; 8]`
- age_verify checks `attribute_value >= threshold` -- membership_proof checks `attribute_value in allowed_set`
- age_verify returns `threshold` -- membership_proof returns `allowed_set_hash`

### Pattern 3: Allowed Set Hashing for On-Chain Verification
**What:** Hash the entire allowed_set array with Poseidon2 and return the hash as a public output, so the on-chain contract can verify the set integrity with a single Field comparison.
**When to use:** When a variable-length public input needs to be compactly represented for contract-side verification.

```noir
use dep::poseidon::poseidon2::Poseidon2;

// Hash the allowed set for compact on-chain verification
let allowed_set_hash = Poseidon2::hash(allowed_set, 8);
```

The contract stores expected allowed_set_hash values (e.g., "valid_group_hashes" mapping), and verifies that the proof's returned hash matches an expected set. This avoids the contract needing to parse 8 separate Field values from the public inputs.

### Anti-Patterns to Avoid
- **Revealing which set element matched:** Never return the matched index or the matched value. The proof should only reveal that SOME element matched.
- **Using attribute_value = 0 as a valid membership value:** Since the array is padded with zeros, a zero attribute_value would trivially match a padding slot. Either (a) ensure 0 is never a valid membership value (enforce this in the issuer), or (b) add a check that `attribute_value != 0` in the circuit.
- **Dynamic array sizes at runtime:** Noir requires fixed compile-time array sizes. Do NOT try to pass the set size as a runtime parameter. Use a fixed N with zero-padding.
- **Forgetting to update the workspace Nargo.toml:** Same pitfall as Phase 2 -- the new crate must be added to the workspace members list.
- **Using a different credential struct:** The membership_proof circuit MUST use the same Credential struct as age_verify. The same 8 fields, same hash order, same Poseidon2 parameters. Reuse shared_lib exactly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential hashing | Manual field hashing | `shared_lib::credential::Credential.hash()` | Already built, cross-validated with bb.js |
| Schnorr verification | Custom signature check | `shared_lib::schnorr::assert_credential_signature()` | Uses assert variant for hard failure |
| Nullifier derivation | Custom nullifier logic | `shared_lib::nullifier::derive_nullifier()` | Already cross-validated with bb.js |
| Set hashing | Custom multi-field hash | `Poseidon2::hash(allowed_set, 8)` | Same Poseidon2 as credential hash, proven compatible |
| Membership credential generation | Manual hex construction | `scripts/issuer.ts --type membership` | Already generates membership credentials |
| Test credential with specific group ID | Hardcoded values | Extend issuer.ts if needed | Ensures Poseidon2/Schnorr compatibility |

**Key insight:** The membership_proof circuit adds ONLY the set membership check on top of the exact same foundation as age_verify. Every cryptographic primitive is reused from shared_lib. The implementation is essentially a copy of age_verify with the comparison logic swapped.

## Common Pitfalls

### Pitfall 1: Zero-Padding Allowing False Membership
**What goes wrong:** The allowed_set is [100, 200, 0, 0, 0, 0, 0, 0] (2 real members, 6 zero-padded). A credential with attribute_value = 0 would incorrectly pass the membership check by matching a padding slot.
**Why it happens:** Zero is the natural padding value for unused array slots, and Field(0) == Field(0) is true.
**How to avoid:** Add an explicit assertion: `assert(attribute_value != 0, "Attribute value cannot be zero")`. This is a reasonable constraint since 0 is not a meaningful group ID or membership value. Alternatively, use a sentinel value (e.g., Field::max) for padding, but that's more complex.
**Warning signs:** Tests pass with normal values but a credential with attribute_value=0 matches against any allowed_set.

### Pitfall 2: Incorrect Public Output Ordering Assumption
**What goes wrong:** Assuming the public output ordering without empirical verification. The membership_proof circuit has a DIFFERENT number of public inputs than age_verify (8 allowed_set elements instead of 1 threshold), so the output indices will be different.
**Why it happens:** Phase 2 documented the ordering for age_verify, but membership_proof has more public inputs.
**How to avoid:** After building the circuit, generate a proof and inspect the public_inputs file to document the exact ordering, just like Phase 2 did. The pattern should be: pub params first (declaration order), then return values (tuple order).
**Warning signs:** Phase 4 contract reads wrong values from the public inputs array for membership proofs.

### Pitfall 3: Constraint Count Explosion from Large Sets
**What goes wrong:** Using N=100 or N=1000 for the allowed_set size, causing the circuit to have thousands of unnecessary equality comparisons even when only a few elements are real members.
**Why it happens:** Developer wants "flexibility" and sets N very large.
**How to avoid:** Use N=8 for the hackathon MVP. This supports up to 8 group members, which is sufficient for demo purposes. The linear scan adds ~16-24 gates for N=8, keeping the circuit well under the 50K constraint target. Document that N can be increased later if needed (each +1 adds ~2-3 gates).
**Warning signs:** `nargo info` shows unexpectedly high constraint counts; proof generation takes noticeably longer than age_verify.

### Pitfall 4: Forgetting Expiration Check
**What goes wrong:** The membership circuit checks set membership and signature but omits the expiration check, allowing expired membership credentials to generate valid proofs.
**Why it happens:** Developer focuses on the new set membership logic and forgets to copy the expiration check from age_verify.
**How to avoid:** Copy the entire age_verify circuit structure and only modify the domain-specific check. The expiration check is part of the shared security guarantee.
**Warning signs:** An expired membership credential produces a valid proof.

### Pitfall 5: Mismatched Credential Type in Tests
**What goes wrong:** Using an age credential (credential_type=0, attribute_key=1) to test the membership circuit, which expects credential_type=1, attribute_key=2.
**Why it happens:** Reusing the Phase 2 Prover.toml without updating the credential type and attribute key fields.
**How to avoid:** Generate a fresh membership credential using `npx tsx issuer.ts --type membership` and use its values for the Prover.toml and test fixtures. The issuer already sets credential_type=1 and attribute_key=2 for membership.
**Warning signs:** Tests fail with "Attribute value not in allowed set" because the attribute_value is 25 (age) instead of 100 (group ID).

### Pitfall 6: Not Verifying Both Circuits Compile Together
**What goes wrong:** The membership_proof circuit compiles alone but breaks when compiled alongside age_verify in the workspace (e.g., shared dependency version conflict or workspace resolution issue).
**Why it happens:** Testing only `nargo build --package membership_proof` and not `nargo build` (workspace-wide).
**How to avoid:** After implementing the circuit, run both `nargo build --package membership_proof` and `nargo test` (workspace-wide) to verify all circuits compile and their tests pass together. Also run `nargo info` for both circuits to verify constraint counts are under 50K.
**Warning signs:** `nargo build` succeeds but `nargo test` fails for one of the circuits.

## Code Examples

Verified patterns from existing codebase and official documentation:

### membership_proof Circuit Main Function
```noir
// circuits/crates/membership_proof/src/main.nr
// Source: Adapted from Phase 2 age_verify circuit + Noir array docs
use dep::shared_lib::credential::Credential;
use dep::shared_lib::schnorr::assert_credential_signature;
use dep::shared_lib::nullifier::derive_nullifier;
use dep::poseidon::poseidon2::Poseidon2;

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
    dapp_context_id: pub Field,
    allowed_set: pub [Field; 8],
) -> pub (Field, Field, Field, Field) {
    // Returns: (nullifier, issuer_pub_key_x, attribute_key, allowed_set_hash)
    // If this function returns, all checks passed. Proof existence = "passed = true".

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

    // 4. Check set membership (HARD ASSERT -- not in set = no proof)
    // Ensure attribute_value is not zero (prevents matching zero-padded slots)
    assert(attribute_value != 0, "Attribute value cannot be zero");
    let mut found: bool = false;
    for i in 0..8 {
        if allowed_set[i] == attribute_value {
            found = true;
        }
    }
    assert(found, "Attribute value not in allowed set");

    // 5. Hash the allowed set for compact on-chain verification
    let allowed_set_hash = Poseidon2::hash(allowed_set, 8);

    // 6. Derive per-dApp nullifier
    let nullifier = derive_nullifier(secret_salt, credential_hash, dapp_context_id);

    // 7. Return public outputs
    (nullifier, pub_key_x, attribute_key, allowed_set_hash)
}
```

### Nargo.toml for membership_proof Crate
```toml
# circuits/crates/membership_proof/Nargo.toml
[package]
name = "membership_proof"
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
members = ["crates/shared_lib", "crates/trivial", "crates/age_verify", "crates/membership_proof"]
default-member = "crates/age_verify"
```

### Prover.toml for membership_proof
```toml
# circuits/crates/membership_proof/Prover.toml
# Values from issuer.ts --type membership (must be generated fresh or adapted from demo)
subject_id = "0x..."
issuer_id = "0x..."
credential_type = "0x0000000000000000000000000000000000000000000000000000000000000001"
attribute_key = "0x0000000000000000000000000000000000000000000000000000000000000002"
attribute_value = "0x0000000000000000000000000000000000000000000000000000000000000064"
issued_at = "0x..."
expires_at = "0x..."
secret_salt = "0x..."
signature = ["...", "..."]
pub_key_x = "0x..."
pub_key_y = "0x..."
current_timestamp = "0x..."
dapp_context_id = "0x000000000000000000000000000000000000000000000000000000000000002a"
allowed_set = ["0x0000000000000000000000000000000000000000000000000000000000000064", "0x00000000000000000000000000000000000000000000000000000000000000c8", "0x000000000000000000000000000000000000000000000000000000000000012c", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000"]
```
Note: allowed_set contains [100, 200, 300, 0, 0, 0, 0, 0] -- three valid group IDs and five zero-padded slots. attribute_value = 100 (0x64) matches the first element.

### Test: Valid Membership Verification
```noir
#[test]
fn test_valid_membership_verification() {
    // Valid membership credential: attribute_value=100, allowed_set includes 100
    // Use hardcoded values from a membership credential generated by issuer.ts
    // ... (same pattern as age_verify tests with membership-specific values)
    let (nullifier, ret_pub_key_x, ret_attribute_key, ret_allowed_set_hash) = main(
        subject_id, issuer_id, credential_type, attribute_key,
        attribute_value, issued_at, expires_at, secret_salt,
        signature, pub_key_x, pub_key_y, current_timestamp,
        dapp_context_id, allowed_set,
    );
    // Verify returned values are correct
    assert(ret_pub_key_x == pub_key_x, "pub_key_x mismatch");
    assert(ret_attribute_key == attribute_key, "attribute_key mismatch");
    // Verify allowed_set_hash matches expected Poseidon2 hash
}
```

### Test: Value Not in Set Rejected
```noir
#[test(should_fail_with = "Attribute value not in allowed set")]
fn test_value_not_in_set_rejected() {
    // Same credential but attribute_value=999, which is not in allowed_set
    // Must use a credential with a different attribute_value
    // OR: use a valid credential but change the allowed_set to exclude it
}
```

### Test: Expired Credential Rejected
```noir
#[test(should_fail_with = "Credential has expired")]
fn test_expired_credential_rejected() {
    // Same as age_verify: set current_timestamp >= expires_at
}
```

### Test: Wrong Signature Rejected
```noir
#[test(should_fail)]
fn test_wrong_signature_rejected() {
    // Same as age_verify: tamper one signature byte
}
```

### Test: Zero Attribute Value Rejected
```noir
#[test(should_fail_with = "Attribute value cannot be zero")]
fn test_zero_attribute_value_rejected() {
    // Credential with attribute_value = 0 should be rejected
    // even if 0 is in the allowed_set (it would match padding)
}
```

### Test: Different Context Different Nullifier
```noir
#[test]
fn test_different_context_different_nullifier() {
    // Reuse derive_nullifier directly with two contexts
    // Same pattern as age_verify test
}
```

### Pipeline Commands for membership_proof
```bash
# Build the membership_proof circuit
cd circuits && nargo build --package membership_proof

# Run tests
nargo test --package membership_proof

# Check constraint count (BOTH circuits)
nargo info --package membership_proof
nargo info --package age_verify

# Generate witness
nargo execute --package membership_proof

# Generate VK
bb write_vk -s ultra_honk --oracle_hash keccak \
  -b target/membership_proof.json -o target/membership_proof_vk

# Generate proof
bb prove -s ultra_honk --oracle_hash keccak \
  -b target/membership_proof.json -w target/membership_proof.gz \
  -k target/membership_proof_vk/vk -o target/membership_proof_proof

# Verify proof locally
bb verify -s ultra_honk --oracle_hash keccak \
  -k target/membership_proof_vk/vk \
  -p target/membership_proof_proof/proof \
  -i target/membership_proof_proof/public_inputs
```

### Extending issuer.ts for Membership Prover.toml
```typescript
// The existing issuer.ts already generates membership credentials with:
// credential_type = 1 (CREDENTIAL_TYPE_MEMBERSHIP)
// attribute_key = 2 (ATTR_KEY_MEMBERSHIP_GROUP)
// attribute_value = 100 (membership group ID)
//
// The generateProverToml function needs to be updated to:
// 1. Include allowed_set instead of threshold when type is membership
// 2. Remove threshold field for membership circuits
// 3. Add allowed_set field as a TOML array of hex-encoded Field values

function generateProverToml(cred: CredentialOutput, isMembership: boolean): string {
  // ... existing credential field formatting ...

  if (isMembership) {
    // Membership circuit: allowed_set instead of threshold
    const allowedSet = [
      cred.attribute_value, // Include the credential's value
      "0x00000000000000000000000000000000000000000000000000000000000000c8", // 200
      "0x000000000000000000000000000000000000000000000000000000000000012c", // 300
      "0x0000000000000000000000000000000000000000000000000000000000000000", // padding
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    ];
    lines.push(`allowed_set = [${allowedSet.map(v => `"${v}"`).join(', ')}]`);
  } else {
    // Age circuit: threshold
    lines.push(`threshold = "0x0000000000000000000000000000000000000000000000000000000000000012"`);
  }

  lines.push(`dapp_context_id = "${cred.dapp_context_id}"`);
  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Merkle tree inclusion proof for set membership | Linear scan over fixed-size public array | Design choice for this project (small sets) | Dramatically simpler implementation, no Merkle tree tooling needed, fewer constraints for small sets |
| Separate circuit designs for each credential type | Mirror structure with only domain check swapped | Phase 2 established the pattern | Consistent public output schema, reusable test patterns, predictable constraint counts |
| Dynamic set sizes via BoundedVec | Fixed [Field; 8] with zero-padding | Simplicity-first for hackathon | No BoundedVec complexity, direct Prover.toml serialization, predictable constraint count |

**When Merkle trees would be better:**
If the allowed set grows beyond ~50 elements, a Merkle tree approach becomes more constraint-efficient: O(log N) hash comparisons vs O(N) equality comparisons. For N=8, linear scan wins. For N=1000, Merkle tree wins. The hackathon uses N=8.

## Open Questions

1. **Exact constraint count for the membership check**
   - What we know: age_verify has 1,224 ACIR opcodes. The membership circuit adds a for-loop with 8 equality comparisons + 1 Poseidon2 hash of the allowed_set. Based on the age_verify baseline, we expect ~1,300-1,500 total.
   - What's unclear: The exact overhead of the for-loop and boolean accumulation in Noir's constraint system.
   - Recommendation: Run `nargo info --package membership_proof` after implementation and document the count. Must be under 50K (realistically should be under 2,000).

2. **Allowed set ordering in public inputs**
   - What we know: Public array parameters in Noir are serialized as individual Field elements in the public inputs file. For `allowed_set: pub [Field; 8]`, this means 8 consecutive Field values in the public inputs.
   - What's unclear: The exact position of these 8 values relative to other public inputs (pub_key_x, pub_key_y, etc.) and relative to the return values.
   - Recommendation: After first successful proof generation, inspect the public_inputs file and document the complete ordering, matching Phase 2's approach.

3. **Whether `.any()` or for-loop is more constraint-efficient**
   - What we know: Both approaches should produce equivalent constraints since `.any()` is syntactic sugar over iteration. The for-loop approach is more explicit.
   - What's unclear: Whether the Noir compiler optimizes `.any()` differently than an explicit loop.
   - Recommendation: Use the explicit for-loop for clarity and predictability. If constraint count is a concern, try `.any()` as an alternative and compare with `nargo info`.

4. **Issuer.ts Prover.toml generation for membership circuit**
   - What we know: The issuer already generates membership credentials via `--type membership`. The generateProverToml function currently only outputs age_verify fields (threshold, current_timestamp).
   - What's unclear: Whether the issuer needs significant modification or just the Prover.toml generation logic.
   - Recommendation: Update generateProverToml to detect membership type and output `allowed_set` instead of `threshold`. Alternatively, manually construct the Prover.toml for the MVP.

## Sources

### Primary (HIGH confidence)
- **Existing Phase 2 age_verify circuit** (`circuits/crates/age_verify/src/main.nr`) -- verified working implementation, exact pattern to follow
- **Existing shared_lib modules** (`circuits/crates/shared_lib/src/*.nr`) -- all crypto primitives reused directly
- **Phase 2 Research and Verification** (`.planning/phases/02-age-verification-circuit/`) -- established patterns, constraint baselines, pipeline commands
- [Noir Arrays documentation](https://noir-lang.org/docs/noir/concepts/data_types/arrays) -- `.any()` method, array syntax, iteration methods
- [Noir Control Flow documentation](https://noir-lang.org/docs/noir/concepts/control_flow) -- for-loop constraints, compile-time iteration counts
- [Noir Generics documentation](https://noir-lang.org/docs/noir/concepts/generics) -- numeric generics for parameterized array sizes

### Secondary (MEDIUM confidence)
- [Noir "Thinking in Circuits"](https://noir-lang.org/docs/explainers/explainer-writing-noir) -- loop unrolling, conditional flattening, gate costs, optimization patterns
- [OpenZeppelin Guide to Building Safe Noir Circuits](https://www.openzeppelin.com/news/developer-guide-to-building-safe-noir-circuits) -- privacy leaks, anti-patterns
- **Architecture Research** (`.planning/research/ARCHITECTURE.md`) -- membership_proof circuit placement, contract routing by circuit_id

### Tertiary (LOW confidence)
- Constraint cost estimates for set membership check (~16-24 gates for N=8) -- based on extrapolation from arithmetic gate costs documented in "Thinking in Circuits", not directly measured
- Public input ordering for array-typed public inputs -- follows the established pattern (pub params first, then returns) but not yet verified for array inputs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- identical to Phase 2, no new dependencies needed
- Architecture: HIGH -- mirrors Phase 2 exactly, only domain-specific check changes
- Pitfalls: HIGH -- zero-padding issue identified from first principles, other pitfalls inherited from Phase 2
- Code examples: MEDIUM -- adapted from verified Phase 2 code, but membership_proof circuit has not been compiled yet; the for-loop set membership check and Poseidon2 hash of the array are untested in this specific configuration
- Constraint estimates: MEDIUM -- based on Phase 2 baseline + arithmetic gate cost analysis, not yet measured

**Research date:** 2026-02-14
**Valid until:** 2026-02-28 (stable -- all deps are pinned, no new tool versions expected during hackathon)
