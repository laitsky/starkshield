use dep::poseidon::poseidon2::Poseidon2;

pub struct Credential {
    pub subject_id: Field,
    pub issuer_id: Field,
    pub credential_type: Field,
    pub attribute_key: Field,
    pub attribute_value: Field,
    pub issued_at: Field,
    pub expires_at: Field,
    pub secret_salt: Field,
}

impl Credential {
    /// Compute Poseidon2 hash over all 8 credential fields.
    /// This hash is the canonical credential commitment used for signatures and nullifiers.
    pub fn hash(self) -> Field {
        Poseidon2::hash(
            [
                self.subject_id,
                self.issuer_id,
                self.credential_type,
                self.attribute_key,
                self.attribute_value,
                self.issued_at,
                self.expires_at,
                self.secret_salt,
            ],
            8,
        )
    }
}
