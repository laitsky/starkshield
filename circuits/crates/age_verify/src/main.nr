// StarkShield Age Verification Circuit
// ACIR opcodes: 1,224 (measured via nargo info)
//
// Public output ordering in bb proof format (verified empirically):
//   Index 0: pub_key_x        (public input parameter)
//   Index 1: pub_key_y        (public input parameter)
//   Index 2: current_timestamp (public input parameter)
//   Index 3: threshold         (public input parameter)
//   Index 4: dapp_context_id   (public input parameter)
//   Index 5: nullifier         (return value -- computed)
//   Index 6: issuer_pub_key_x  (return value -- echoed from pub_key_x)
//   Index 7: threshold         (return value -- echoed from input)
//
// Pattern: pub parameters first (in declaration order), then return values (in tuple order).
// Total: 8 public fields. No private data (subject_id, attribute_value, secret_salt,
// issued_at, expires_at, signature) appears in the proof's public_inputs file.

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
) -> pub (Field, Field, Field) {
    // Returns: (nullifier, issuer_pub_key_x, threshold)
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

    // 2. Enforce circuit semantics before signature verification.
    assert(credential_type == 0, "Invalid credential type for age");
    assert(attribute_key == 1, "Invalid attribute key for age");
    assert(issuer_id == pub_key_x, "Issuer ID does not match pub_key_x");

    // 3. Verify issuer signature (HARD ASSERT -- forged credential = no proof)
    assert_credential_signature(pub_key_x, pub_key_y, signature, credential_hash);

    // 4. Check expiration (HARD ASSERT -- expired credential = no proof)
    // Cast to u64 for safe ordered comparison (prevents modular wrap-around)
    let ts = current_timestamp as u64;
    let exp = expires_at as u64;
    assert(ts < exp, "Credential has expired");

    // 5. Check age threshold (HARD ASSERT -- underage = no proof)
    let age = attribute_value as u64;
    let min_age = threshold as u64;
    assert(age >= min_age, "Age below threshold");

    // 6. Derive per-dApp nullifier
    let nullifier = derive_nullifier(secret_salt, credential_hash, dapp_context_id);

    // 7. Return public outputs
    // Contract reads these to: check issuer is trusted, log verification, store nullifier
    (nullifier, pub_key_x, threshold)
}

// ============================================================================
// Tests
// ============================================================================

// Test values from Phase 1 demo credential (cross-validated between TypeScript and Noir)
// subject_id: 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b
// issuer_id / pub_key_x: 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f
// pub_key_y: 0x29531f99cc6e18ff4bcc3062202fc9865b580ffa6e15ede4aae60ed06b38efea
// credential_type: 0 (age)
// attribute_key: 1 (age)
// attribute_value: 25 (0x19)
// issued_at: 0x69905d7b
// expires_at: 0x6b7190fb
// secret_salt: 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59
// dapp_context_id: 42 (0x2a)
// expected_nullifier: 0x1b291cc63a9aa3f46a2597d6618f3358c53e88b0f383ef951f68594abd87982d

#[test]
fn test_valid_age_verification() {
    // Valid credential: age=25, threshold=18, not expired
    let subject_id = 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b;
    let issuer_id = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let credential_type = 0;
    let attribute_key = 1;
    let attribute_value = 25;
    let issued_at = 0x69905d7b;
    let expires_at = 0x6b7190fb;
    let secret_salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;

    let signature: [u8; 64] = [
        24, 176, 76, 145, 246, 151, 115, 148, 5, 131, 240, 78, 246, 123, 43, 195,
        199, 214, 105, 177, 183, 47, 183, 125, 156, 218, 52, 133, 80, 176, 7, 203,
        153, 53, 74, 182, 9, 92, 144, 204, 178, 193, 49, 13, 33, 73, 251, 206,
        217, 69, 187, 163, 14, 89, 23, 186, 223, 32, 32, 144, 73, 87, 16, 97,
    ];

    let pub_key_x = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let pub_key_y = 0x29531f99cc6e18ff4bcc3062202fc9865b580ffa6e15ede4aae60ed06b38efea;

    // current_timestamp well before expires_at
    let current_timestamp = 0x69905d7b; // same as issued_at
    let threshold = 18;
    let dapp_context_id = 42;

    let (nullifier, ret_pub_key_x, ret_threshold) = main(
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
        threshold,
        dapp_context_id,
    );

    // Verify the returned nullifier matches the expected value from Phase 1 cross-validation
    let expected_nullifier = 0x1b291cc63a9aa3f46a2597d6618f3358c53e88b0f383ef951f68594abd87982d;
    assert(nullifier == expected_nullifier, "Nullifier mismatch");

    // Verify echoed public outputs
    assert(ret_pub_key_x == pub_key_x, "pub_key_x mismatch");
    assert(ret_threshold == threshold, "threshold mismatch");
}

#[test(should_fail_with = "Credential has expired")]
fn test_expired_credential_rejected() {
    // Same valid credential, but current_timestamp >= expires_at
    let subject_id = 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b;
    let issuer_id = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let credential_type = 0;
    let attribute_key = 1;
    let attribute_value = 25;
    let issued_at = 0x69905d7b;
    let expires_at = 0x6b7190fb;
    let secret_salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;

    let signature: [u8; 64] = [
        24, 176, 76, 145, 246, 151, 115, 148, 5, 131, 240, 78, 246, 123, 43, 195,
        199, 214, 105, 177, 183, 47, 183, 125, 156, 218, 52, 133, 80, 176, 7, 203,
        153, 53, 74, 182, 9, 92, 144, 204, 178, 193, 49, 13, 33, 73, 251, 206,
        217, 69, 187, 163, 14, 89, 23, 186, 223, 32, 32, 144, 73, 87, 16, 97,
    ];

    let pub_key_x = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let pub_key_y = 0x29531f99cc6e18ff4bcc3062202fc9865b580ffa6e15ede4aae60ed06b38efea;

    // Set current_timestamp >= expires_at to trigger expiration
    let current_timestamp = 0x6b7190fb; // equal to expires_at
    let threshold = 18;
    let dapp_context_id = 42;

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
        threshold,
        dapp_context_id,
    );
}

#[test(should_fail_with = "Age below threshold")]
fn test_age_below_threshold_rejected() {
    // Same valid credential (age=25), but threshold=30
    let subject_id = 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b;
    let issuer_id = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let credential_type = 0;
    let attribute_key = 1;
    let attribute_value = 25;
    let issued_at = 0x69905d7b;
    let expires_at = 0x6b7190fb;
    let secret_salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;

    let signature: [u8; 64] = [
        24, 176, 76, 145, 246, 151, 115, 148, 5, 131, 240, 78, 246, 123, 43, 195,
        199, 214, 105, 177, 183, 47, 183, 125, 156, 218, 52, 133, 80, 176, 7, 203,
        153, 53, 74, 182, 9, 92, 144, 204, 178, 193, 49, 13, 33, 73, 251, 206,
        217, 69, 187, 163, 14, 89, 23, 186, 223, 32, 32, 144, 73, 87, 16, 97,
    ];

    let pub_key_x = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let pub_key_y = 0x29531f99cc6e18ff4bcc3062202fc9865b580ffa6e15ede4aae60ed06b38efea;

    let current_timestamp = 0x69905d7b;
    let threshold = 30; // age=25 < threshold=30
    let dapp_context_id = 42;

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
        threshold,
        dapp_context_id,
    );
}

#[test(should_fail_with = "Invalid credential type for age")]
fn test_wrong_credential_type_rejected() {
    // Valid credential values except credential_type is set to membership (1).
    let subject_id = 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b;
    let issuer_id = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let credential_type = 1;
    let attribute_key = 1;
    let attribute_value = 25;
    let issued_at = 0x69905d7b;
    let expires_at = 0x6b7190fb;
    let secret_salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;

    let signature: [u8; 64] = [
        24, 176, 76, 145, 246, 151, 115, 148, 5, 131, 240, 78, 246, 123, 43, 195,
        199, 214, 105, 177, 183, 47, 183, 125, 156, 218, 52, 133, 80, 176, 7, 203,
        153, 53, 74, 182, 9, 92, 144, 204, 178, 193, 49, 13, 33, 73, 251, 206,
        217, 69, 187, 163, 14, 89, 23, 186, 223, 32, 32, 144, 73, 87, 16, 97,
    ];

    let pub_key_x = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let pub_key_y = 0x29531f99cc6e18ff4bcc3062202fc9865b580ffa6e15ede4aae60ed06b38efea;
    let current_timestamp = 0x69905d7b;
    let threshold = 18;
    let dapp_context_id = 42;

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
        threshold,
        dapp_context_id,
    );
}

#[test(should_fail)]
fn test_wrong_signature_rejected() {
    // Valid credential fields but with tampered signature (first byte flipped)
    let subject_id = 0x14a0cf45bdb4ee2266b1c7496d9d3305aa60e684b2023c3fea9c10c08617482b;
    let issuer_id = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let credential_type = 0;
    let attribute_key = 1;
    let attribute_value = 25;
    let issued_at = 0x69905d7b;
    let expires_at = 0x6b7190fb;
    let secret_salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;

    // Tampered signature: first byte changed from 24 to 25
    let signature: [u8; 64] = [
        25, 176, 76, 145, 246, 151, 115, 148, 5, 131, 240, 78, 246, 123, 43, 195,
        199, 214, 105, 177, 183, 47, 183, 125, 156, 218, 52, 133, 80, 176, 7, 203,
        153, 53, 74, 182, 9, 92, 144, 204, 178, 193, 49, 13, 33, 73, 251, 206,
        217, 69, 187, 163, 14, 89, 23, 186, 223, 32, 32, 144, 73, 87, 16, 97,
    ];

    let pub_key_x = 0x16e4953b04718a75e6b87b08bdcb3b4e7960e84604ac408c4dab76aff702a86f;
    let pub_key_y = 0x29531f99cc6e18ff4bcc3062202fc9865b580ffa6e15ede4aae60ed06b38efea;

    let current_timestamp = 0x69905d7b;
    let threshold = 18;
    let dapp_context_id = 42;

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
        threshold,
        dapp_context_id,
    );
}

#[test]
fn test_different_context_different_nullifier() {
    // Two different dapp_context_ids produce two different nullifiers
    let salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;
    let hash = 0x267da9221ca9314ab3ca3c5eb771bb3961c0925ec7dee6497c03e98c81a0482d;
    let context_a = 42;
    let context_b = 99;

    let null_a = derive_nullifier(salt, hash, context_a);
    let null_b = derive_nullifier(salt, hash, context_b);

    assert(null_a != null_b, "Different contexts must produce different nullifiers");
}

#[test]
fn test_same_context_same_nullifier() {
    // Same inputs always produce the same nullifier (deterministic)
    let salt = 0x05692e1402fd6856b17628d56e84a5948c3a01c672ecf6d652b0c424d463ea59;
    let hash = 0x267da9221ca9314ab3ca3c5eb771bb3961c0925ec7dee6497c03e98c81a0482d;
    let context = 42;

    let null_1 = derive_nullifier(salt, hash, context);
    let null_2 = derive_nullifier(salt, hash, context);

    assert(null_1 == null_2, "Same context must produce same nullifier");
}
