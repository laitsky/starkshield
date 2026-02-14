// StarkShield Membership Verification Circuit
// ACIR opcodes: 1,253 (measured via nargo info)
//
// Proves that a signed credential's attribute_value is a member of a public
// allowed_set without revealing which element matched.
//
// Security guarantees (all hard-assert -- proof existence IS the pass signal):
//   1. Issuer signature verified via Schnorr on Grumpkin curve
//   2. Credential expiration enforced (current_timestamp < expires_at)
//   3. Zero attribute_value rejected (prevents false match on zero-padded slots)
//   4. Set membership proven (attribute_value in allowed_set)
//   5. Per-dApp nullifier derived for double-use prevention
//
// Public output ordering in bb proof format (verified empirically):
//   Index  0: pub_key_x        (public input parameter)
//   Index  1: pub_key_y        (public input parameter)
//   Index  2: current_timestamp (public input parameter)
//   Index  3: dapp_context_id   (public input parameter)
//   Index  4: allowed_set[0]    (public input parameter -- array element)
//   Index  5: allowed_set[1]    (public input parameter -- array element)
//   Index  6: allowed_set[2]    (public input parameter -- array element)
//   Index  7: allowed_set[3]    (public input parameter -- array element)
//   Index  8: allowed_set[4]    (public input parameter -- array element)
//   Index  9: allowed_set[5]    (public input parameter -- array element)
//   Index 10: allowed_set[6]    (public input parameter -- array element)
//   Index 11: allowed_set[7]    (public input parameter -- array element)
//   Index 12: nullifier         (return value -- computed)
//   Index 13: issuer_pub_key_x  (return value -- echoed from pub_key_x)
//   Index 14: attribute_key     (return value -- echoed from credential)
//   Index 15: allowed_set_hash  (return value -- Poseidon2 hash of allowed_set)
//
// Pattern: pub parameters first (in declaration order), then return values (in tuple order).
// Total: 16 public fields (4 scalar params + 8 array elements + 4 return values).
// No private data (subject_id, attribute_value, secret_salt, issued_at, expires_at,
// signature) appears in the proof's public_inputs file.

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
    // Cast to u64 for safe ordered comparison (prevents modular wrap-around)
    let ts = current_timestamp as u64;
    let exp = expires_at as u64;
    assert(ts < exp, "Credential has expired");

    // 4. Zero-value guard (HARD ASSERT -- prevents false match on zero-padded array slots)
    assert(attribute_value != 0, "Attribute value cannot be zero");

    // 5. Check set membership (HARD ASSERT -- not in set = no proof)
    let mut found: bool = false;
    for i in 0..8 {
        if allowed_set[i] == attribute_value {
            found = true;
        }
    }
    assert(found, "Attribute value not in allowed set");

    // 6. Hash the allowed set for compact on-chain verification
    let allowed_set_hash = Poseidon2::hash(allowed_set, 8);

    // 7. Derive per-dApp nullifier
    let nullifier = derive_nullifier(secret_salt, credential_hash, dapp_context_id);

    // 8. Return public outputs
    // Contract reads these to: check issuer is trusted, log verification, store nullifier
    (nullifier, pub_key_x, attribute_key, allowed_set_hash)
}

// ============================================================================
// Tests
// ============================================================================

// Test values from freshly generated membership credential (issuer.ts --type membership)
// subject_id: 0x290c48a2c8d2ef313ff06f876f5d6d08d6d2566cb2ae2ccad42428804ba98685
// issuer_id / pub_key_x: 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10
// pub_key_y: 0x040f864a957b841af57b8e0098e30d0965afdd4fd71bba9e8a496264a7334fe1
// credential_type: 1 (membership)
// attribute_key: 2 (membership_group)
// attribute_value: 100 (0x64) -- membership group ID
// issued_at: 0x6990709d
// expires_at: 0x6b71a41d
// secret_salt: 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af
// dapp_context_id: 42 (0x2a)
// expected_nullifier: 0x0878ef3fda449ac2ca8ef12f8b4dd6d9f69aa6fed08e35eb8725993b3266ed66

#[test]
fn test_valid_membership_verification() {
    // Valid membership credential: attribute_value=100, allowed_set includes 100
    let subject_id = 0x290c48a2c8d2ef313ff06f876f5d6d08d6d2566cb2ae2ccad42428804ba98685;
    let issuer_id = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let credential_type = 1;
    let attribute_key = 2;
    let attribute_value = 100;
    let issued_at = 0x6990709d;
    let expires_at = 0x6b71a41d;
    let secret_salt = 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af;

    let signature: [u8; 64] = [
        31, 184, 100, 106, 237, 198, 142, 182, 118, 32, 226, 135, 106, 242, 79, 193,
        238, 244, 42, 16, 252, 7, 18, 213, 137, 47, 12, 124, 60, 76, 197, 164,
        8, 209, 82, 30, 192, 85, 30, 202, 10, 178, 212, 197, 121, 168, 205, 250,
        151, 147, 89, 228, 78, 186, 165, 99, 131, 232, 128, 29, 163, 149, 194, 148,
    ];

    let pub_key_x = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let pub_key_y = 0x040f864a957b841af57b8e0098e30d0965afdd4fd71bba9e8a496264a7334fe1;

    // current_timestamp well before expires_at (same as issued_at)
    let current_timestamp = 0x6990709d;
    let dapp_context_id = 42;

    // allowed_set: includes attribute_value=100, plus 200, 300, then zero-padded
    let allowed_set: [Field; 8] = [100, 200, 300, 0, 0, 0, 0, 0];

    let (nullifier, ret_pub_key_x, ret_attribute_key, _ret_allowed_set_hash) = main(
        subject_id,
        issuer_id,
        credential_type,
        attribute_key,
        attribute_value,
        issued_at,
        expires_at,
        secret_salt,
        signature,
        pub_key_x,
        pub_key_y,
        current_timestamp,
        dapp_context_id,
        allowed_set,
    );

    // Verify the returned nullifier matches the expected value from issuer.ts
    let expected_nullifier = 0x0878ef3fda449ac2ca8ef12f8b4dd6d9f69aa6fed08e35eb8725993b3266ed66;
    assert(nullifier == expected_nullifier, "Nullifier mismatch");

    // Verify echoed public outputs
    assert(ret_pub_key_x == pub_key_x, "pub_key_x mismatch");
    assert(ret_attribute_key == attribute_key, "attribute_key mismatch");
}

#[test(should_fail_with = "Credential has expired")]
fn test_expired_credential_rejected() {
    // Same valid credential, but current_timestamp >= expires_at
    let subject_id = 0x290c48a2c8d2ef313ff06f876f5d6d08d6d2566cb2ae2ccad42428804ba98685;
    let issuer_id = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let credential_type = 1;
    let attribute_key = 2;
    let attribute_value = 100;
    let issued_at = 0x6990709d;
    let expires_at = 0x6b71a41d;
    let secret_salt = 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af;

    let signature: [u8; 64] = [
        31, 184, 100, 106, 237, 198, 142, 182, 118, 32, 226, 135, 106, 242, 79, 193,
        238, 244, 42, 16, 252, 7, 18, 213, 137, 47, 12, 124, 60, 76, 197, 164,
        8, 209, 82, 30, 192, 85, 30, 202, 10, 178, 212, 197, 121, 168, 205, 250,
        151, 147, 89, 228, 78, 186, 165, 99, 131, 232, 128, 29, 163, 149, 194, 148,
    ];

    let pub_key_x = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let pub_key_y = 0x040f864a957b841af57b8e0098e30d0965afdd4fd71bba9e8a496264a7334fe1;

    // Set current_timestamp >= expires_at to trigger expiration
    let current_timestamp = 0x6b71a41d; // equal to expires_at
    let dapp_context_id = 42;
    let allowed_set: [Field; 8] = [100, 200, 300, 0, 0, 0, 0, 0];

    let _ = main(
        subject_id,
        issuer_id,
        credential_type,
        attribute_key,
        attribute_value,
        issued_at,
        expires_at,
        secret_salt,
        signature,
        pub_key_x,
        pub_key_y,
        current_timestamp,
        dapp_context_id,
        allowed_set,
    );
}

#[test(should_fail_with = "Attribute value not in allowed set")]
fn test_value_not_in_set_rejected() {
    // Valid credential, but allowed_set does NOT include attribute_value=100
    // Keep credential intact (valid signature), change allowed_set public input
    let subject_id = 0x290c48a2c8d2ef313ff06f876f5d6d08d6d2566cb2ae2ccad42428804ba98685;
    let issuer_id = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let credential_type = 1;
    let attribute_key = 2;
    let attribute_value = 100;
    let issued_at = 0x6990709d;
    let expires_at = 0x6b71a41d;
    let secret_salt = 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af;

    let signature: [u8; 64] = [
        31, 184, 100, 106, 237, 198, 142, 182, 118, 32, 226, 135, 106, 242, 79, 193,
        238, 244, 42, 16, 252, 7, 18, 213, 137, 47, 12, 124, 60, 76, 197, 164,
        8, 209, 82, 30, 192, 85, 30, 202, 10, 178, 212, 197, 121, 168, 205, 250,
        151, 147, 89, 228, 78, 186, 165, 99, 131, 232, 128, 29, 163, 149, 194, 148,
    ];

    let pub_key_x = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let pub_key_y = 0x040f864a957b841af57b8e0098e30d0965afdd4fd71bba9e8a496264a7334fe1;

    let current_timestamp = 0x6990709d;
    let dapp_context_id = 42;
    // allowed_set excludes 100 -- use [200, 300, 400, 500, 0, 0, 0, 0]
    let allowed_set: [Field; 8] = [200, 300, 400, 500, 0, 0, 0, 0];

    let _ = main(
        subject_id,
        issuer_id,
        credential_type,
        attribute_key,
        attribute_value,
        issued_at,
        expires_at,
        secret_salt,
        signature,
        pub_key_x,
        pub_key_y,
        current_timestamp,
        dapp_context_id,
        allowed_set,
    );
}

#[test(should_fail)]
fn test_wrong_signature_rejected() {
    // Valid credential fields but with tampered signature (first byte flipped)
    let subject_id = 0x290c48a2c8d2ef313ff06f876f5d6d08d6d2566cb2ae2ccad42428804ba98685;
    let issuer_id = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let credential_type = 1;
    let attribute_key = 2;
    let attribute_value = 100;
    let issued_at = 0x6990709d;
    let expires_at = 0x6b71a41d;
    let secret_salt = 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af;

    // Tampered signature: first byte changed from 31 to 32
    let signature: [u8; 64] = [
        32, 184, 100, 106, 237, 198, 142, 182, 118, 32, 226, 135, 106, 242, 79, 193,
        238, 244, 42, 16, 252, 7, 18, 213, 137, 47, 12, 124, 60, 76, 197, 164,
        8, 209, 82, 30, 192, 85, 30, 202, 10, 178, 212, 197, 121, 168, 205, 250,
        151, 147, 89, 228, 78, 186, 165, 99, 131, 232, 128, 29, 163, 149, 194, 148,
    ];

    let pub_key_x = 0x0cf1cf3605ab9a87c812119274fafb6f06d0fe6258288b089c1b6f54c3c79e10;
    let pub_key_y = 0x040f864a957b841af57b8e0098e30d0965afdd4fd71bba9e8a496264a7334fe1;

    let current_timestamp = 0x6990709d;
    let dapp_context_id = 42;
    let allowed_set: [Field; 8] = [100, 200, 300, 0, 0, 0, 0, 0];

    let _ = main(
        subject_id,
        issuer_id,
        credential_type,
        attribute_key,
        attribute_value,
        issued_at,
        expires_at,
        secret_salt,
        signature,
        pub_key_x,
        pub_key_y,
        current_timestamp,
        dapp_context_id,
        allowed_set,
    );
}

#[test]
fn test_different_context_different_nullifier() {
    // Two different dapp_context_ids produce two different nullifiers
    let salt = 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af;
    let hash = 0x2b6fabbfac98577ed874f20be6a52ef35878c381e5129f01d02efb4ddec91610;
    let context_a = 42;
    let context_b = 99;

    let null_a = derive_nullifier(salt, hash, context_a);
    let null_b = derive_nullifier(salt, hash, context_b);

    assert(null_a != null_b, "Different contexts must produce different nullifiers");
}

#[test]
fn test_same_context_same_nullifier() {
    // Same inputs always produce the same nullifier (deterministic)
    let salt = 0x23fdbd4a6c600c56ba21d6322dca64ac6f69518fe8f17de8534cf121123823af;
    let hash = 0x2b6fabbfac98577ed874f20be6a52ef35878c381e5129f01d02efb4ddec91610;
    let context = 42;

    let null_1 = derive_nullifier(salt, hash, context);
    let null_2 = derive_nullifier(salt, hash, context);

    assert(null_1 == null_2, "Same context must produce same nullifier");
}
