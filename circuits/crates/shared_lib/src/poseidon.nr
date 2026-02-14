use dep::poseidon::poseidon2::Poseidon2;

/// Hash 8 credential fields into a single commitment.
/// This is the standalone function equivalent of Credential.hash().
pub fn hash_credential_fields(fields: [Field; 8]) -> Field {
    Poseidon2::hash(fields, 8)
}

/// Hash 2 fields (e.g., for key derivation or simple commitments).
pub fn hash_2(a: Field, b: Field) -> Field {
    Poseidon2::hash([a, b], 2)
}

/// Hash 3 fields (e.g., for nullifier derivation with context).
pub fn hash_3(a: Field, b: Field, c: Field) -> Field {
    Poseidon2::hash([a, b, c], 3)
}
