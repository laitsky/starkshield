// StarkShield simple owner-only access control
// Hand-rolled (no OpenZeppelin) due to Scarb 2.14.0 version gap with OZ releases.

use starknet::ContractAddress;
use starknet::get_caller_address;

pub fn assert_only_owner(owner: ContractAddress) {
    let caller = get_caller_address();
    assert(caller == owner, 'Caller is not the owner');
}
