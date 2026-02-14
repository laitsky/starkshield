use dep::schnorr;
use std::embedded_curve_ops::EmbeddedCurvePoint;

/// Verify a Schnorr signature over a Poseidon2 message hash.
/// The signature is 64 bytes (32-byte s + 32-byte e).
/// pub_key_x, pub_key_y are Grumpkin curve point coordinates.
/// message_hash is serialized to 32 big-endian bytes before verification.
pub fn verify_credential_signature(
    pub_key_x: Field,
    pub_key_y: Field,
    signature: [u8; 64],
    message_hash: Field,
) -> bool {
    let message_bytes: [u8; 32] = message_hash.to_be_bytes();
    let public_key = EmbeddedCurvePoint { x: pub_key_x, y: pub_key_y, is_infinite: false };
    schnorr::verify_signature(public_key, signature, message_bytes)
}

/// Assert a Schnorr signature is valid (fails circuit if invalid).
/// Preferred over verify_credential_signature when you want assertion instead of bool.
pub fn assert_credential_signature(
    pub_key_x: Field,
    pub_key_y: Field,
    signature: [u8; 64],
    message_hash: Field,
) {
    let message_bytes: [u8; 32] = message_hash.to_be_bytes();
    let public_key = EmbeddedCurvePoint { x: pub_key_x, y: pub_key_y, is_infinite: false };
    schnorr::assert_valid_signature(public_key, signature, message_bytes)
}
