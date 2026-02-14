// StarkShield Registry Contract
//
// Single entry point for all proof verification on StarkShield.
// Routes proofs to the correct Garaga-generated verifier by circuit_id,
// enforces business rules (nullifier uniqueness, issuer trust),
// and creates an on-chain verification log queryable by dApps.

// Verifier interface (matches Garaga-generated contracts)
#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

// Registry interface
#[starknet::interface]
pub trait IStarkShieldRegistry<TContractState> {
    fn verify_and_register(
        ref self: TContractState,
        circuit_id: u8,
        full_proof_with_hints: Span<felt252>,
    );
    fn is_nullifier_used(self: @TContractState, nullifier: u256) -> bool;
    fn get_verification_record(self: @TContractState, nullifier: u256) -> VerificationRecord;
    fn add_trusted_issuer(ref self: TContractState, issuer_pub_key_x: u256);
    fn remove_trusted_issuer(ref self: TContractState, issuer_pub_key_x: u256);
    fn is_trusted_issuer(self: @TContractState, issuer_pub_key_x: u256) -> bool;
}

#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct VerificationRecord {
    pub nullifier: u256,
    pub attribute_key: u256,
    pub threshold_or_set_hash: u256,
    pub timestamp: u64,
    pub circuit_id: u8,
}

#[starknet::contract]
pub mod StarkShieldRegistry {
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use super::{
        IUltraKeccakZKHonkVerifierDispatcher,
        IUltraKeccakZKHonkVerifierDispatcherTrait,
        VerificationRecord,
    };
    use contracts::ownable::assert_only_owner;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        // circuit_id -> verifier contract address
        verifiers: Map<u8, ContractAddress>,
        // issuer_pub_key_x -> is_trusted
        trusted_issuers: Map<u256, bool>,
        // nullifier -> is_used
        nullifier_used: Map<u256, bool>,
        // nullifier -> VerificationRecord
        verification_records: Map<u256, VerificationRecord>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        VerificationPassed: VerificationPassed,
        TrustedIssuerAdded: TrustedIssuerAdded,
        TrustedIssuerRemoved: TrustedIssuerRemoved,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VerificationPassed {
        #[key]
        pub nullifier: u256,
        pub attribute_key: u256,
        pub threshold_or_set_hash: u256,
        pub timestamp: u64,
        pub circuit_id: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TrustedIssuerAdded {
        #[key]
        pub issuer_pub_key_x: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TrustedIssuerRemoved {
        #[key]
        pub issuer_pub_key_x: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        age_verifier: ContractAddress,
        membership_verifier: ContractAddress,
    ) {
        self.owner.write(owner);
        self.verifiers.entry(0).write(age_verifier);       // circuit_id 0 = age_verify
        self.verifiers.entry(1).write(membership_verifier); // circuit_id 1 = membership_proof
    }

    #[abi(embed_v0)]
    impl StarkShieldRegistryImpl of super::IStarkShieldRegistry<ContractState> {
        /// Main entry point: verify a ZK proof and register the result on-chain.
        ///
        /// 1. Route to correct verifier by circuit_id
        /// 2. Call verifier with proof data
        /// 3. Extract public inputs by circuit type
        /// 4. Enforce business rules (trusted issuer, nullifier uniqueness)
        /// 5. Store verification record and emit event
        fn verify_and_register(
            ref self: ContractState,
            circuit_id: u8,
            full_proof_with_hints: Span<felt252>,
        ) {
            // Step 1: Look up verifier address for this circuit_id
            let verifier_addr = self.verifiers.entry(circuit_id).read();
            assert(!verifier_addr.is_zero(), 'Invalid circuit_id');

            // Step 2: Create dispatcher and call verifier
            let verifier = IUltraKeccakZKHonkVerifierDispatcher {
                contract_address: verifier_addr,
            };
            let result = verifier.verify_ultra_keccak_zk_honk_proof(full_proof_with_hints);
            let public_inputs = match result {
                Result::Ok(inputs) => inputs,
                Result::Err(_) => panic!("Proof verification failed"),
            };

            // Step 3: Extract fields by circuit_id
            //
            // age_verify (circuit_id 0, 9 public inputs):
            //   Index 5: nullifier, 6: issuer_pub_key_x, 7: attribute_key, 8: threshold
            //
            // membership_proof (circuit_id 1, 16 public inputs):
            //   Index 12: nullifier, 13: issuer_pub_key_x, 14: attribute_key, 15: allowed_set_hash
            let (nullifier, issuer_pub_key_x, attribute_key, threshold_or_set_hash) =
                if circuit_id == 0 {
                    (
                        *public_inputs.at(5),
                        *public_inputs.at(6),
                        *public_inputs.at(7),
                        *public_inputs.at(8),
                    )
                } else if circuit_id == 1 {
                    (
                        *public_inputs.at(12),
                        *public_inputs.at(13),
                        *public_inputs.at(14),
                        *public_inputs.at(15),
                    )
                } else {
                    panic!("Unsupported circuit_id")
                };

            // Step 4: Enforce trusted issuer
            assert(self.trusted_issuers.entry(issuer_pub_key_x).read(), 'Issuer not trusted');

            // Step 5: Enforce nullifier uniqueness (replay protection)
            assert(!self.nullifier_used.entry(nullifier).read(), 'Nullifier already used');

            // Step 6: Mark nullifier as used
            self.nullifier_used.entry(nullifier).write(true);

            // Step 7: Store verification record
            let timestamp = get_block_timestamp();
            let record = VerificationRecord {
                nullifier,
                attribute_key,
                threshold_or_set_hash,
                timestamp,
                circuit_id,
            };
            self.verification_records.entry(nullifier).write(record);

            // Step 8: Emit event
            self.emit(VerificationPassed {
                nullifier,
                attribute_key,
                threshold_or_set_hash,
                timestamp,
                circuit_id,
            });
        }

        fn is_nullifier_used(self: @ContractState, nullifier: u256) -> bool {
            self.nullifier_used.entry(nullifier).read()
        }

        fn get_verification_record(self: @ContractState, nullifier: u256) -> VerificationRecord {
            self.verification_records.entry(nullifier).read()
        }

        fn add_trusted_issuer(ref self: ContractState, issuer_pub_key_x: u256) {
            assert_only_owner(self.owner.read());
            self.trusted_issuers.entry(issuer_pub_key_x).write(true);
            self.emit(TrustedIssuerAdded { issuer_pub_key_x });
        }

        fn remove_trusted_issuer(ref self: ContractState, issuer_pub_key_x: u256) {
            assert_only_owner(self.owner.read());
            self.trusted_issuers.entry(issuer_pub_key_x).write(false);
            self.emit(TrustedIssuerRemoved { issuer_pub_key_x });
        }

        fn is_trusted_issuer(self: @ContractState, issuer_pub_key_x: u256) -> bool {
            self.trusted_issuers.entry(issuer_pub_key_x).read()
        }
    }
}
