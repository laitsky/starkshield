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

fn deploy_registry() -> IStarkShieldRegistryDispatcher {
    let contract = declare("StarkShieldRegistry").unwrap().contract_class();

    let mut calldata = array![];
    calldata.append(OWNER_ADDR);
    calldata.append(MOCK_AGE_VERIFIER);
    calldata.append(MOCK_MEMBERSHIP_VERIFIER);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IStarkShieldRegistryDispatcher { contract_address }
}

#[test]
fn test_owner_can_add_trusted_issuer() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();
    let issuer_key: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };

    // Before adding: issuer should not be trusted
    assert(!registry.is_trusted_issuer(issuer_key), 'Should not be trusted yet');

    // Add as owner
    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key);

    // After adding: issuer should be trusted
    assert(registry.is_trusted_issuer(issuer_key), 'Should be trusted now');
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

    // Try to add as non-owner -- should panic
    start_cheat_caller_address(registry.contract_address, non_owner);
    registry.add_trusted_issuer(issuer_key);
}

#[test]
fn test_owner_can_remove_trusted_issuer() {
    let registry = deploy_registry();
    let owner: ContractAddress = OWNER_ADDR.try_into().unwrap();
    let issuer_key: u256 = u256 {
        low: TEST_ISSUER_PUB_KEY_X_LOW.try_into().unwrap(),
        high: TEST_ISSUER_PUB_KEY_X_HIGH.try_into().unwrap(),
    };

    // Add issuer first
    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key);
    assert(registry.is_trusted_issuer(issuer_key), 'Should be trusted');

    // Remove issuer
    registry.remove_trusted_issuer(issuer_key);
    assert(!registry.is_trusted_issuer(issuer_key), 'Should not be trusted');
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

    // Add as owner
    start_cheat_caller_address(registry.contract_address, owner);
    registry.add_trusted_issuer(issuer_key);

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

    start_cheat_caller_address(registry.contract_address, owner);

    // Add issuer A only
    registry.add_trusted_issuer(issuer_a);

    assert(registry.is_trusted_issuer(issuer_a), 'Issuer A should be trusted');
    assert(!registry.is_trusted_issuer(issuer_b), 'Issuer B should NOT be trusted');

    // Add issuer B
    registry.add_trusted_issuer(issuer_b);
    assert(registry.is_trusted_issuer(issuer_a), 'Issuer A still trusted');
    assert(registry.is_trusted_issuer(issuer_b), 'Issuer B now trusted');

    // Remove issuer A only
    registry.remove_trusted_issuer(issuer_a);
    assert(!registry.is_trusted_issuer(issuer_a), 'Issuer A removed');
    assert(registry.is_trusted_issuer(issuer_b), 'Issuer B unchanged');
}
