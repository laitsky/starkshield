use dep::poseidon::poseidon2::Poseidon2;

/// Derive a per-dApp nullifier.
/// nullifier = Poseidon2(secret_salt, credential_hash, dapp_context_id)
///
/// Properties:
/// - Same user + same credential + same dApp = same nullifier (replay detection)
/// - Same user + same credential + different dApp = different nullifier (unlinkability)
pub fn derive_nullifier(
    secret_salt: Field,
    credential_hash: Field,
    dapp_context_id: Field,
) -> Field {
    Poseidon2::hash([secret_salt, credential_hash, dapp_context_id], 3)
}
