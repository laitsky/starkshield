// StarkShield Registry Integration Tests
//
// Tests for business logic: trusted issuer management, nullifier tracking,
// owner-only access control. These tests do NOT require real verifier contracts
// -- they test the registry's own logic in isolation.

use contracts::registry::{
    IStarkShieldRegistryDispatcher, IStarkShieldRegistryDispatcherTrait,
};
use snforge_std::{declare, DeclareResultTrait, ContractClassTrait};
use snforge_std::start_cheat_caller_address;
use starknet::ContractAddress;

const OWNER_ADDR: felt252 = 0x1234;
const NON_OWNER_ADDR: felt252 = 0x5678;
const MOCK_AGE_VERIFIER: felt252 = 0xAAAA;
const MOCK_MEMBERSHIP_VERIFIER: felt252 = 0xBBBB;

// Test issuer pub key (from age_verify demo credential -- issuer_id / pub_key_x)
const TEST_ISSUER_PUB_KEY_X_LOW: felt252 = 0x7960e84604ac408c4dab76aff702a86f;
const TEST_ISSUER_PUB_KEY_X_HIGH: felt252 = 0x16e4953b04718a75e6b87b08bdcb3b4e;
const TEST_ISSUER_PUB_KEY_Y_LOW: felt252 = 0x5b580ffa6e15ede4aae60ed06b38efea;
const TEST_ISSUER_PUB_KEY_Y_HIGH: felt252 = 0x29531f99cc6e18ff4bcc3062202fc986;

fn deploy_registry() -> IStarkShieldRegistryDispatcher {
    let contract = declare("StarkShieldRegistry").unwrap().contract_class();

    let mut calldata = array![];
    calldata.append(OWNER_ADDR);
    calldata.append(MOCK_AGE_VERIFIER);
    calldata.append(MOCK_MEMBERSHIP_VERIFIER);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IStarkShieldRegistryDispatcher { contract_address }
}

fn deploy_registry_with_verifiers(
    age_verifier: ContractAddress, membership_verifier: ContractAddress,
) -> IStarkShieldRegistryDispatcher {
    let contract = declare("StarkShieldRegistry").unwrap().contract_class();

    let mut calldata = array![];
    calldata.append(OWNER_ADDR);
    calldata.append(age_verifier.into());
    calldata.append(membership_verifier.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IStarkShieldRegistryDispatcher { contract_address }
}

fn deploy_mock_verifier(
    mode: u8,
    issuer_key_x: u256,
    issuer_key_y: u256,
    nullifier: u256,
    threshold_or_set_hash: u256,
) -> ContractAddress {
    let contract = declare("MockUltraKeccakZKHonkVerifier").unwrap().contract_class();

    // proof_timestamp=0 aligns with local test block timestamp.
    let proof_timestamp: u64 = 0;

    let mut calldata = array![];
    calldata.append(mode.into());
    calldata.append(issuer_key_x.low.into());
    calldata.append(issuer_key_x.high.into());
    calldata.append(issuer_key_y.low.into());
    calldata.append(issuer_key_y.high.into());
    calldata.append(proof_timestamp.into());
    calldata.append(nullifier.low.into());
    calldata.append(nullifier.high.into());
    calldata.append(threshold_or_set_hash.low.into());
    calldata.append(threshold_or_set_hash.high.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    contract_address
}

#[test]
fn test_owner_can_add_trusted_issuer() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();
    let issuer_key: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    // Before adding: issuer should not be trusted
    assert(!registry.is_trusted_issuer(issuer_key, issuer_key_y), 'Should not be trusted yet');

    // Add as owner
    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key, issuer_key_y);

    // After adding: issuer should be trusted
    assert(registry.is_trusted_issuer(issuer_key, issuer_key_y), 'Should be trusted now');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_add_trusted_issuer() {
    let registry = deploy_registry();
    let non_owner: ContractAddress = NON_OWNER_ADDR.try_into().unwrap();
    let issuer_key: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    // Try to add as non-owner -- should panic
    start_cheat_caller_address(registry.contract_address, non_owner);
    registry.add_trusted_issuer(issuer_key, issuer_key_y);
}

#[test]
fn test_owner_can_remove_trusted_issuer() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();
    let issuer_key: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    // Add issuer first
    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key, issuer_key_y);
    assert(registry.is_trusted_issuer(issuer_key, issuer_key_y), 'Should be trusted');

    // Remove issuer
    registry.remove_trusted_issuer(issuer_key);
    assert(!registry.is_trusted_issuer(issuer_key, issuer_key_y), 'Should not be trusted');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_remove_trusted_issuer() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();
    let non_owner: ContractAddress = NON_OWNER_ADDR.try_into().unwrap();
    let issuer_key: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    // Add as owner
    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key, issuer_key_y);

    // Try to remove as non-owner -- should panic
    start_cheat_caller_address(registry.contract_address, non_owner);
    registry.remove_trusted_issuer(issuer_key);
}

#[test]
fn test_nullifier_not_used_initially() {
    let registry = deploy_registry();
    let random_nullifier: u256 = u256 { low: 0x12345678, high: 0xABCDEF };

    assert(!registry.is_nullifier_used(random_nullifier), 'Should not be used');
}

#[test]
fn test_get_verification_record_returns_zero_for_unknown() {
    let registry = deploy_registry();
    let unknown_nullifier: u256 = u256 { low: 0x99999999, high: 0x11111111 };

    let record = registry.get_verification_record(unknown_nullifier);
    assert(record.nullifier == 0, 'Nullifier should be zero');
    assert(record.timestamp == 0, 'Timestamp should be zero');
    assert(record.circuit_id == 0, 'Circuit ID should be zero');
}

#[test]
fn test_multiple_issuers_independent() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();

    let issuer_a: u256 = u256 { low: 0xAAAA, high: 0xBBBB };
    let issuer_b: u256 = u256 { low: 0xCCCC, high: 0xDDDD };
    let issuer_a_y: u256 = u256 { low: 0x1111, high: 0x2222 };
    let issuer_b_y: u256 = u256 { low: 0x3333, high: 0x4444 };

    start_cheat_caller_address(registry.contract_address, owner);

    // Add issuer A only
    registry.add_trusted_issuer(issuer_a, issuer_a_y);

    assert(registry.is_trusted_issuer(issuer_a, issuer_a_y), 'Issuer A should be trusted');
    assert(!registry.is_trusted_issuer(issuer_b, issuer_b_y), 'Issuer B should NOT be trusted');

    // Add issuer B
    registry.add_trusted_issuer(issuer_b, issuer_b_y);
    assert(registry.is_trusted_issuer(issuer_a, issuer_a_y), 'Issuer A still trusted');
    assert(registry.is_trusted_issuer(issuer_b, issuer_b_y), 'Issuer B now trusted');

    // Remove issuer A only
    registry.remove_trusted_issuer(issuer_a);
    assert(!registry.is_trusted_issuer(issuer_a, issuer_a_y), 'Issuer A removed');
    assert(registry.is_trusted_issuer(issuer_b, issuer_b_y), 'Issuer B unchanged');
}

#[test]
fn test_trusted_issuer_rejects_wrong_y_coordinate() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();
    let issuer_x: u256 = u256 { low: 0xAAAA, high: 0xBBBB };
    let trusted_y: u256 = u256 { low: 0x1111, high: 0x2222 };
    let wrong_y: u256 = u256 { low: 0x9999, high: 0x8888 };

    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_x, trusted_y);

    assert(registry.is_trusted_issuer(issuer_x, trusted_y), 'Stored key should be trusted');
    assert(!registry.is_trusted_issuer(issuer_x, wrong_y), 'Wrong y rejected');
}

#[test]
fn test_verify_and_register_age_success() {
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();

    let issuer_key_x: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    let age_nullifier: u256 = u256 { low: 0x1111, high: 0 };
    let member_nullifier: u256 = u256 { low: 0x2222, high: 0 };
    let age_threshold: u256 = u256 { low: 18, high: 0 };
    let member_set_hash: u256 = u256 { low: 0xABCD, high: 0 };

    let age_verifier = deploy_mock_verifier(0, issuer_key_x, issuer_key_y, age_nullifier, age_threshold);
    let membership_verifier =
        deploy_mock_verifier(1, issuer_key_x, issuer_key_y, member_nullifier, member_set_hash);

    let registry = deploy_registry_with_verifiers(age_verifier, membership_verifier);

    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key_x, issuer_key_y);

    registry.verify_and_register(0, array![].span());

    assert(registry.is_nullifier_used(age_nullifier), 'Nullifier should be marked used');
    let record = registry.get_verification_record(age_nullifier);
    assert(record.nullifier == age_nullifier, 'Nullifier stored');
    assert(record.attribute_key == u256 { low: 1, high: 0 }, 'Attribute key should be age');
    assert(record.threshold_or_set_hash == age_threshold, 'Threshold stored');
    assert(record.circuit_id == 0, 'Circuit id should be age');
}

#[test]
#[should_panic(expected: 'Nullifier already used')]
fn test_verify_and_register_rejects_replay() {
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();

    let issuer_key_x: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    let age_nullifier: u256 = u256 { low: 0x3333, high: 0 };
    let member_nullifier: u256 = u256 { low: 0x4444, high: 0 };
    let age_threshold: u256 = u256 { low: 18, high: 0 };
    let member_set_hash: u256 = u256 { low: 0x1234, high: 0 };

    let age_verifier = deploy_mock_verifier(0, issuer_key_x, issuer_key_y, age_nullifier, age_threshold);
    let membership_verifier =
        deploy_mock_verifier(1, issuer_key_x, issuer_key_y, member_nullifier, member_set_hash);

    let registry = deploy_registry_with_verifiers(age_verifier, membership_verifier);

    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key_x, issuer_key_y);

    registry.verify_and_register(0, array![].span());
    registry.verify_and_register(0, array![].span());
}

#[test]
#[should_panic(expected: 'Issuer not trusted')]
fn test_verify_and_register_rejects_untrusted_issuer() {
    let issuer_key_x: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };
    let issuer_key_y: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_Y_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_Y_HIGH.try_into().unwrap(),
    };

    let age_nullifier: u256 = u256 { low: 0x5555, high: 0 };
    let member_nullifier: u256 = u256 { low: 0x6666, high: 0 };
    let age_threshold: u256 = u256 { low: 18, high: 0 };
    let member_set_hash: u256 = u256 { low: 0x5678, high: 0 };

    let age_verifier = deploy_mock_verifier(0, issuer_key_x, issuer_key_y, age_nullifier, age_threshold);
    let membership_verifier =
        deploy_mock_verifier(1, issuer_key_x, issuer_key_y, member_nullifier, member_set_hash);

    let registry = deploy_registry_with_verifiers(age_verifier, membership_verifier);

    registry.verify_and_register(0, array![].span());
}
