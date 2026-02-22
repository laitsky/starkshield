// Mock verifier for StarkShield registry integration tests.
//
// Returns deterministic "valid" public inputs so we can test registry business
// logic without depending on fragile full-proof fixtures.

#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

#[starknet::contract]
pub mod MockUltraKeccakZKHonkVerifier {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        mode: u8,
        pub_key_x: u256,
        pub_key_y: u256,
        proof_timestamp: u64,
        nullifier: u256,
        threshold_or_set_hash: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        mode: u8,
        pub_key_x: u256,
        pub_key_y: u256,
        proof_timestamp: u64,
        nullifier: u256,
        threshold_or_set_hash: u256,
    ) {
        self.mode.write(mode);
        self.pub_key_x.write(pub_key_x);
        self.pub_key_y.write(pub_key_y);
        self.proof_timestamp.write(proof_timestamp);
        self.nullifier.write(nullifier);
        self.threshold_or_set_hash.write(threshold_or_set_hash);
    }

    #[abi(embed_v0)]
    impl MockUltraKeccakZKHonkVerifierImpl of super::IUltraKeccakZKHonkVerifier<ContractState> {
        fn verify_ultra_keccak_zk_honk_proof(
            self: @ContractState, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            let _ = full_proof_with_hints;
            let mode = self.mode.read();
            let pub_key_x = self.pub_key_x.read();
            let pub_key_y = self.pub_key_y.read();
            let proof_timestamp = u256 { low: self.proof_timestamp.read().into(), high: 0 };
            let nullifier = self.nullifier.read();
            let threshold_or_set_hash = self.threshold_or_set_hash.read();

            let dapp_context_id = u256 { low: 42, high: 0 };

            let mut outputs = array![];
            outputs.append(pub_key_x); // index 0
            outputs.append(pub_key_y); // index 1
            outputs.append(proof_timestamp); // index 2

            if mode == 0 {
                // age_verify public output shape (8 values)
                outputs.append(u256 { low: 18, high: 0 }); // index 3 threshold input
                outputs.append(dapp_context_id); // index 4 dapp_context_id
                outputs.append(nullifier); // index 5 returned nullifier
                outputs.append(pub_key_x); // index 6 returned issuer_pub_key_x
                outputs.append(threshold_or_set_hash); // index 7 returned threshold
            } else {
                // membership_proof public output shape (15 values)
                outputs.append(dapp_context_id); // index 3 dapp_context_id
                outputs.append(u256 { low: 100, high: 0 }); // index 4 allowed_set[0]
                outputs.append(u256 { low: 200, high: 0 }); // index 5
                outputs.append(u256 { low: 300, high: 0 }); // index 6
                outputs.append(u256 { low: 0, high: 0 }); // index 7
                outputs.append(u256 { low: 0, high: 0 }); // index 8
                outputs.append(u256 { low: 0, high: 0 }); // index 9
                outputs.append(u256 { low: 0, high: 0 }); // index 10
                outputs.append(u256 { low: 0, high: 0 }); // index 11
                outputs.append(nullifier); // index 12 returned nullifier
                outputs.append(pub_key_x); // index 13 returned issuer_pub_key_x
                outputs.append(threshold_or_set_hash); // index 14 returned allowed_set_hash
            }

            Result::Ok(outputs.span())
        }
    }
}
