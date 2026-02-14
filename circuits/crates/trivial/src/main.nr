use dep::shared_lib::credential::Credential;
use dep::shared_lib::schnorr::verify_credential_signature;
use dep::shared_lib::nullifier::derive_nullifier;

fn main(
    // Credential fields (private)
    subject_id: Field,
    issuer_id: Field,
    credential_type: Field,
    attribute_key: Field,
    attribute_value: Field,
    issued_at: Field,
    expires_at: Field,
    secret_salt: Field,
    // Signature (private)
    signature: [u8; 64],
    // Issuer public key (will be public in real circuits)
    pub_key_x: Field,
    pub_key_y: Field,
    // dApp context (public)
    dapp_context_id: pub Field,
    // Expected outputs (public)
    expected_nullifier: pub Field,
) {
    // 1. Construct credential and hash it
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

    // 2. Verify issuer signature over credential hash
    let sig_valid = verify_credential_signature(
        pub_key_x,
        pub_key_y,
        signature,
        credential_hash,
    );
    assert(sig_valid, "Invalid issuer signature");

    // 3. Derive nullifier and assert match
    let nullifier = derive_nullifier(secret_salt, credential_hash, dapp_context_id);
    assert(nullifier == expected_nullifier, "Nullifier mismatch");
}
