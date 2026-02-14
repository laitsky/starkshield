# Phase 4: Smart Contracts & Deployment - Research

**Researched:** 2026-02-14
**Domain:** Cairo smart contracts, Garaga verifier generation/deployment, Starknet Sepolia deployment, ZK proof verification on-chain
**Confidence:** MEDIUM (Garaga CLI verified locally; Cairo contract patterns verified via official docs; gas cost data is LOW confidence -- no published benchmarks found for Honk verification)

## Summary

Phase 4 transforms the circuits built in Phases 2-3 into on-chain infrastructure. The phase has two distinct deliverables: (1) generating Garaga verifier contracts for BOTH the age_verify and membership_proof circuits (each has a different VK and different public_inputs_size), declaring and deploying them on Starknet Sepolia, and (2) building the StarkShieldRegistry contract that wraps both verifiers with trusted issuer management, nullifier tracking, verification logging, and event emission.

The critical architectural insight is that **each circuit requires its own verifier contract** because `garaga gen` bakes the VK constants into the generated Cairo code. The age_verify verifier expects 9 public inputs (PUB_9) while membership_proof expects 16 (PUB_16). This follows the pattern used by production projects like starkware-private-erc20, which deploys separate verifier contracts per circuit and routes from a main contract via dispatchers. The existing `contracts/` directory contains a verifier generated from the trivial circuit's VK (PUB_17) -- this must be regenerated for the real circuits.

The StarkShieldRegistry contract will be a hand-written Cairo contract using the component pattern for Ownable (hand-rolled, not OpenZeppelin, due to Scarb 2.14.0 version gap with OZ releases). It stores verifier contract addresses per circuit_id, a trusted_issuers mapping, a nullifier set, and a verification_records mapping. The contract calls the verifier via the `IUltraKeccakZKHonkVerifierDispatcher` pattern, extracts public inputs from the Result, and performs business logic checks.

**Primary recommendation:** Generate separate verifier projects for age_verify and membership_proof using `garaga gen` with their respective VKs, deploy them independently via `garaga declare` + `garaga deploy`, then build the StarkShieldRegistry as a separate Scarb package that calls verifiers via dispatchers.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Garaga (Python CLI) | 1.0.1 | Generate verifier contracts, declare, deploy, verify-onchain, generate calldata | Only tool for Noir-to-Cairo verifier generation. Verified installed locally. |
| Garaga (Scarb dep) | v1.0.1 (git tag) | Cairo library dependency for generated verifier contracts | Required by auto-generated verifier code. Already in Scarb.lock. |
| Scarb | 2.14.0 | Cairo package manager and build tool | Pinned in .tool-versions. Required for Garaga compatibility (2.15.2 causes infinite compilation). |
| Starknet Foundry (snforge) | 0.53.0 | Contract testing framework | Pinned in contracts/.tool-versions. Provides fork testing, cheatcodes. |
| Starknet Foundry (sncast) | 0.53.0 | Contract declaration, deployment, invocation | CLI for Sepolia deployment. Alternative to garaga declare/deploy for the Registry. |
| Cairo (starknet) | 2.14.0 | Starknet contract standard library | Bundled with Scarb 2.14.0. Provides storage, events, contract macros. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| snforge_std | 0.53.0 | Test utilities (declare, deploy, cheatcodes, fork testing) | All contract tests |
| assert_macros | 2.14.0 | Test assertion macros | Contract test assertions |
| Python 3.10 | 3.10.14 | Garaga SDK runtime | All garaga CLI invocations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Ownable | OpenZeppelin OwnableComponent | OZ v3.0.0 targets Scarb 2.13.1, v4.0.0-alpha.0 targets 2.15.1 -- neither matches our Scarb 2.14.0. Hand-rolling a simple owner check (3 functions) is safer than fighting version mismatches during a hackathon. |
| garaga declare/deploy | sncast declare/deploy | garaga CLI handles the declare+deploy flow for generated verifiers specifically. Use sncast for the StarkShieldRegistry (custom contract). Both work. |
| Separate verifier contracts per circuit | Single verifier with multiple VKs | Garaga generates one contract per VK. No built-in multi-VK support. Separate contracts is the documented pattern. |

**Installation (already done from Phase 1, verify only):**
```bash
# Verify Garaga
source .venv/bin/activate && garaga --version  # Should show 1.0.1

# Verify Scarb
scarb --version  # Should show 2.14.0

# Install Starknet Foundry if not present
curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
snfoundryup -v 0.53.0
```

## Architecture Patterns

### Recommended Project Structure (Phase 4 Scope)

```
contracts/
├── Scarb.toml                              # Workspace root (if multi-package) or single package
├── .tool-versions                          # scarb 2.14.0, starknet-foundry 0.53.0
├── src/
│   ├── lib.cairo                           # Module declarations
│   ├── honk_verifier.cairo                 # Garaga-generated (DO NOT EDIT)
│   ├── honk_verifier_circuits.cairo        # Garaga-generated (DO NOT EDIT)
│   ├── honk_verifier_constants.cairo       # Garaga-generated (DO NOT EDIT)
│   ├── registry.cairo                      # StarkShieldRegistry contract
│   └── ownable.cairo                       # Simple owner-only access control
├── tests/
│   ├── test_contract.cairo                 # Garaga-generated verifier test
│   ├── test_registry.cairo                 # Registry integration tests
│   └── proof_calldata.txt                  # Garaga-generated test fixture
└── .secrets                                # Deployment credentials (gitignored)

# Separate verifier projects (generated by garaga gen, deployed independently):
contracts_age_verifier/                     # garaga gen output for age_verify VK
├── Scarb.toml
├── src/
│   ├── lib.cairo
│   ├── honk_verifier.cairo
│   ├── honk_verifier_circuits.cairo
│   └── honk_verifier_constants.cairo
└── tests/

contracts_membership_verifier/              # garaga gen output for membership_proof VK
├── Scarb.toml
├── src/
│   ├── lib.cairo
│   ├── honk_verifier.cairo
│   ├── honk_verifier_circuits.cairo
│   └── honk_verifier_constants.cairo
└── tests/
```

**Important structural decision:** Each `garaga gen` invocation produces a complete Scarb project. The two verifier projects are generated, declared, and deployed independently. The StarkShieldRegistry contract exists in its own Scarb project (or the existing `contracts/` directory can be repurposed) and references the deployed verifier addresses. The verifier interface (`IUltraKeccakZKHonkVerifier`) is defined inline in the Registry since it is a simple single-function trait.

### Pattern 1: Multi-Circuit Verifier Deployment

**What:** Deploy separate Garaga-generated verifier contracts for each circuit, then wire them into a registry via their deployed addresses.
**When to use:** Always when you have multiple circuits with different VKs.
**Example:**

```bash
# Step 1: Generate verifier for age_verify circuit
source .venv/bin/activate
garaga gen --system ultra_keccak_zk_honk \
  --vk circuits/target/age_verify_vk/vk \
  --project-name contracts_age_verifier

# Step 2: Generate verifier for membership_proof circuit
garaga gen --system ultra_keccak_zk_honk \
  --vk circuits/target/membership_proof_vk/vk \
  --project-name contracts_membership_verifier

# Step 3: Build both
cd contracts_age_verifier && scarb build && cd ..
cd contracts_membership_verifier && scarb build && cd ..

# Step 4: Create .secrets file (add to .gitignore!)
cat > .secrets << 'EOF'
STARKNET_RPC="https://rpc.starknet-testnet.lava.build:443"
STARKNET_PRIVATE_KEY=0x<your_private_key>
STARKNET_ACCOUNT_ADDRESS=0x<your_account_address>
EOF

# Step 5: Declare and deploy age verifier
garaga declare --project-path contracts_age_verifier --env-file .secrets --network sepolia
# Note the class hash, then:
garaga deploy --class-hash <AGE_CLASS_HASH> --env-file .secrets --network sepolia

# Step 6: Declare and deploy membership verifier
garaga declare --project-path contracts_membership_verifier --env-file .secrets --network sepolia
garaga deploy --class-hash <MEMBERSHIP_CLASS_HASH> --env-file .secrets --network sepolia
```

Source: garaga CLI --help output (verified locally), sn-noir-quickstart deployment workflow

### Pattern 2: StarkShieldRegistry Contract with Dispatcher Calls

**What:** A custom Cairo contract that stores verifier addresses and routes proof verification to the correct verifier based on circuit_id.
**When to use:** When a single entry point needs to handle proofs from multiple circuits.
**Example:**

```cairo
// contracts/src/registry.cairo

use starknet::ContractAddress;

// Define the verifier interface (matches Garaga-generated contract)
#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}

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
mod StarkShieldRegistry {
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{
        IUltraKeccakZKHonkVerifierDispatcher,
        IUltraKeccakZKHonkVerifierDispatcherTrait,
        VerificationRecord,
    };

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
        self.verifiers.entry(0).write(age_verifier);       // circuit_id 0 = age
        self.verifiers.entry(1).write(membership_verifier); // circuit_id 1 = membership
    }

    // ... implementation follows
}
```

Source: Cairo Book (Storage Mappings, Contract Events, Interacting with Another Contract)

### Pattern 3: Extracting Public Inputs from Verifier Result

**What:** The Garaga verifier returns `Result<Span<u256>, felt252>`. On success, public_inputs are a Span of u256 values in the order documented by the circuit.
**When to use:** After calling the verifier, extract specific fields by index.
**Example:**

```cairo
// For age_verify circuit (9 public inputs):
// Index 0: pub_key_x, Index 1: pub_key_y, Index 2: current_timestamp,
// Index 3: threshold, Index 4: dapp_context_id,
// Index 5: nullifier (return), Index 6: issuer_pub_key_x (return),
// Index 7: attribute_key (return), Index 8: threshold (return)

fn extract_age_verify_outputs(public_inputs: Span<u256>) -> (u256, u256, u256, u256) {
    let nullifier = *public_inputs.at(5);
    let issuer_pub_key_x = *public_inputs.at(6);
    let attribute_key = *public_inputs.at(7);
    let threshold = *public_inputs.at(8);
    (nullifier, issuer_pub_key_x, attribute_key, threshold)
}

// For membership_proof circuit (16 public inputs):
// Index 0: pub_key_x, Index 1: pub_key_y, Index 2: current_timestamp,
// Index 3: dapp_context_id, Index 4-11: allowed_set[0..8],
// Index 12: nullifier (return), Index 13: issuer_pub_key_x (return),
// Index 14: attribute_key (return), Index 15: allowed_set_hash (return)

fn extract_membership_outputs(public_inputs: Span<u256>) -> (u256, u256, u256, u256) {
    let nullifier = *public_inputs.at(12);
    let issuer_pub_key_x = *public_inputs.at(13);
    let attribute_key = *public_inputs.at(14);
    let allowed_set_hash = *public_inputs.at(15);
    (nullifier, issuer_pub_key_x, attribute_key, allowed_set_hash)
}
```

Source: Verified from age_verify/src/main.nr and membership_proof/src/main.nr public output documentation

### Pattern 4: Simple Ownable Access Control (No OpenZeppelin)

**What:** A minimal owner-check pattern avoiding the OpenZeppelin version mismatch.
**When to use:** When Scarb version doesn't align with any OZ release.
**Example:**

```cairo
// contracts/src/ownable.cairo
use starknet::ContractAddress;
use starknet::get_caller_address;

fn assert_only_owner(owner: ContractAddress) {
    let caller = get_caller_address();
    assert(caller == owner, 'Caller is not the owner');
}
```

### Anti-Patterns to Avoid

- **Editing Garaga-generated files:** `honk_verifier.cairo`, `honk_verifier_circuits.cairo`, and `honk_verifier_constants.cairo` are overwritten by every `garaga gen` invocation. All custom logic goes in `registry.cairo`.
- **Single verifier for multiple circuits:** Each circuit has a unique VK baked into the constants file. You cannot reuse one verifier contract for a different circuit's proofs.
- **Using the existing trivial circuit verifier:** The current `contracts/` directory has a verifier from the trivial circuit (PUB_17). This must be regenerated for age_verify (PUB_9) and membership_proof (PUB_16).
- **Storing raw proof data on-chain:** Only store the extracted verification result (nullifier, attribute_key, threshold/set_hash, timestamp). The proof itself is verified transiently.
- **Using OpenZeppelin with Scarb 2.14.0:** OZ v3.0.0 targets Scarb 2.13.1, v4.0.0-alpha targets 2.15.1. Version mismatch will cause compilation errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZK proof verification | Custom pairing/MSM checks | Garaga-generated `UltraKeccakZKHonkVerifier` | Generated code uses Garaga's optimized builtins for elliptic curve operations. Cryptographically verified. |
| Calldata serialization | Manual felt252 proof encoding | `garaga calldata --system ultra_keccak_zk_honk` CLI or `garaga` npm `getZKHonkCallData()` | Handles proof + hints serialization, MSM precomputation. Getting this wrong = silent verification failures. |
| Contract declaration/deployment | Manual RPC calls | `garaga declare` + `garaga deploy` (for verifiers) or `sncast declare` + `sncast deploy` (for Registry) | Handles class hash computation, transaction formatting, fee estimation. |
| Test calldata fixtures | Hand-written proof arrays | `garaga calldata --format snforge --output-path tests/` | Generates valid calldata files for snforge fork tests. |

**Key insight:** The entire proof verification pipeline (calldata encoding, MSM hints, KZG pairing check) is generated code. The only hand-written contract logic is the business rules: nullifier tracking, issuer trust, event emission, and circuit routing.

## Common Pitfalls

### Pitfall 1: Wrong VK for Verifier Generation

**What goes wrong:** Regenerating the verifier with the trivial circuit's VK instead of the real circuit's VK. The verifier expects PUB_17 but receives a proof with 9 or 16 public inputs. Verification fails silently or with a cryptic deserialization error.
**Why it happens:** The existing `contracts/` directory was generated from the trivial circuit during Phase 1. Developer forgets to regenerate for the real circuits.
**How to avoid:** Run `garaga gen` separately for each circuit with its specific VK path. Verify `public_inputs_size` in the generated constants file matches expected: 9 for age_verify, 16 for membership_proof.
**Warning signs:** `honk_verifier_constants.cairo` showing wrong `public_inputs_size` or wrong `log_circuit_size`.

### Pitfall 2: Public Input Index Mismatch Between Circuit and Contract

**What goes wrong:** The contract extracts the nullifier from the wrong index in the public_inputs Span. This silently reads incorrect data -- the nullifier might be mistaken for a timestamp or threshold.
**Why it happens:** Public input ordering is not obvious. It follows: pub parameters (declaration order) first, then return values (tuple order). Developers guess wrong.
**How to avoid:** Reference the circuit source comments that document exact indices. For age_verify: nullifier at index 5, issuer_pub_key_x at 6, attribute_key at 7, threshold at 8. For membership_proof: nullifier at 12, issuer_pub_key_x at 13, attribute_key at 14, allowed_set_hash at 15.
**Warning signs:** Nullifier values that look like timestamps, or trusted issuer checks that always fail.

### Pitfall 3: Garaga .secrets File Missing or Misconfigured

**What goes wrong:** `garaga declare` or `garaga deploy` fails with authentication errors, or uses wrong network.
**Why it happens:** The .secrets file must contain specific environment variables and the account must be funded with STRK on Sepolia.
**How to avoid:** Create `.secrets` with format: `STARKNET_RPC="..."`, `STARKNET_PRIVATE_KEY=0x...`, `STARKNET_ACCOUNT_ADDRESS=0x...`. Fund the account via Starknet Sepolia faucet before any transactions. Add `.secrets` to `.gitignore`.
**Warning signs:** "insufficient balance" errors, "account not found" errors, network mismatch errors.

### Pitfall 4: Scarb 2.14.0 and OpenZeppelin Incompatibility

**What goes wrong:** Adding OpenZeppelin cairo-contracts as a dependency causes compilation failures. OZ v3.0.0 requires Scarb 2.13.1, v4.0.0-alpha requires 2.15.1. Neither matches 2.14.0.
**Why it happens:** Cairo/Scarb ecosystem moves fast. Minor version bumps can break ABI compatibility.
**How to avoid:** Do NOT use OpenZeppelin for this phase. Hand-roll the simple Ownable pattern (one storage variable, one assert function). It is 10 lines of code vs. hours of debugging dependency issues.
**Warning signs:** Scarb build errors mentioning version mismatches or undefined types from openzeppelin.

### Pitfall 5: Gas Cost Exceeding 500K Target

**What goes wrong:** A single verification transaction costs more than 500,000 gas units, failing the success criteria.
**Why it happens:** ZK proof verification on Starknet involves heavy elliptic curve operations. The Garaga-generated verifier alone may consume significant gas. Adding the Registry's business logic on top increases it further.
**How to avoid:** First benchmark the bare Garaga verifier call (via `garaga verify-onchain`). Then benchmark the full `verify_and_register()` path. The Registry adds minimal overhead (storage writes + event emission). If the base verifier exceeds 500K, the target may need revision (this is an open question -- no published benchmarks exist for Honk verification gas cost on Starknet).
**Warning signs:** Transaction receipt showing high `l2_gas` consumption. Compare against the 500K target early.

### Pitfall 6: snforge Fork Test Requiring Deployed Garaga Dependencies

**What goes wrong:** The existing test uses `#[fork(url: "...", block_tag: latest)]` which means it runs against real Sepolia. If Garaga's internal dependencies are not declared on Sepolia, library dispatcher calls fail.
**Why it happens:** The Garaga verifier contract uses `IUltraKeccakZKHonkVerifierLibraryDispatcher` in tests, which requires the class to be declared on the fork network.
**How to avoid:** Use `garaga declare` first to declare the verifier on Sepolia, THEN run fork tests. Alternatively, for unit testing the Registry logic without verification, mock the verifier response.
**Warning signs:** Fork tests failing with "class hash not found" or "entry point not found" errors.

### Pitfall 7: Contract Size Limits

**What goes wrong:** The Garaga-generated verifier contract is large (the constants file alone is 130KB of Cairo source). Declaration may fail if the compiled contract exceeds Starknet's class size limits.
**Why it happens:** The verifier embeds precomputed lines and VK data as constants.
**How to avoid:** Garaga v1.0.1 is designed to produce contracts within Starknet limits. If declaration fails, verify garaga version and try `garaga declare --fee strk` (ensure sufficient STRK balance for the large declare transaction).
**Warning signs:** "contract too large" errors during `scarb build` or `garaga declare`.

## Code Examples

Verified patterns from official sources:

### Garaga Verifier Interface (from existing generated code)

```cairo
// Source: contracts/src/honk_verifier.cairo (Garaga-generated)
#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}
```

### Calling Verifier from Registry via Dispatcher

```cairo
// Source: Cairo Book - Interacting with Another Contract
use super::{IUltraKeccakZKHonkVerifierDispatcher, IUltraKeccakZKHonkVerifierDispatcherTrait};

fn call_verifier(
    verifier_address: ContractAddress,
    calldata: Span<felt252>,
) -> Span<u256> {
    let verifier = IUltraKeccakZKHonkVerifierDispatcher {
        contract_address: verifier_address,
    };
    let result = verifier.verify_ultra_keccak_zk_honk_proof(calldata);
    match result {
        Result::Ok(public_inputs) => public_inputs,
        Result::Err(err) => panic!("Proof verification failed"),
    }
}
```

### Storage Map Pattern for Nullifiers

```cairo
// Source: Cairo Book - Storage Mappings
use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};

#[storage]
struct Storage {
    nullifier_used: Map<u256, bool>,
    verification_records: Map<u256, VerificationRecord>,
}

// Check nullifier
let is_used = self.nullifier_used.entry(nullifier).read();
assert(!is_used, 'Nullifier already used');

// Store nullifier and record
self.nullifier_used.entry(nullifier).write(true);
self.verification_records.entry(nullifier).write(record);
```

### Event Emission Pattern

```cairo
// Source: Cairo Book - Contract Events
#[event]
#[derive(Drop, starknet::Event)]
pub enum Event {
    VerificationPassed: VerificationPassed,
}

#[derive(Drop, starknet::Event)]
pub struct VerificationPassed {
    #[key]
    pub nullifier: u256,          // Indexed for filtering
    pub attribute_key: u256,
    pub threshold_or_set_hash: u256,
    pub timestamp: u64,
    pub circuit_id: u8,
}

// Emit
self.emit(VerificationPassed {
    nullifier,
    attribute_key,
    threshold_or_set_hash,
    timestamp: get_block_timestamp(),
    circuit_id,
});
```

### Garaga Calldata Generation for Tests

```bash
# Generate calldata for snforge test (age_verify)
source .venv/bin/activate
garaga calldata \
  --system ultra_keccak_zk_honk \
  --proof circuits/target/age_verify_proof/proof \
  --vk circuits/target/age_verify_vk/vk \
  --format snforge \
  --output-path contracts_age_verifier/tests/

# Generate calldata for snforge test (membership_proof)
garaga calldata \
  --system ultra_keccak_zk_honk \
  --proof circuits/target/membership_proof_proof/proof \
  --vk circuits/target/membership_proof_vk/vk \
  --format snforge \
  --output-path contracts_membership_verifier/tests/
```

### sncast Deployment for Registry Contract

```bash
# Create account for Sepolia (if not already done)
sncast account create --network sepolia --name sepolia
# Fund via faucet, then:
sncast account deploy --network sepolia --name sepolia

# Declare the Registry contract
sncast --account sepolia declare \
  --contract-name StarkShieldRegistry \
  --network sepolia

# Deploy with constructor args (owner, age_verifier_addr, membership_verifier_addr)
sncast --account sepolia deploy \
  --class-hash <REGISTRY_CLASS_HASH> \
  --constructor-calldata <OWNER_ADDR> <AGE_VERIFIER_ADDR> <MEMBERSHIP_VERIFIER_ADDR> \
  --network sepolia
```

### Garaga Deployment Flow

```bash
# .secrets file format
cat > .secrets << 'EOF'
STARKNET_RPC="https://rpc.starknet-testnet.lava.build:443"
STARKNET_PRIVATE_KEY=0x<your_private_key>
STARKNET_ACCOUNT_ADDRESS=0x<your_account_address>
EOF

# Declare verifier (returns class hash)
garaga declare \
  --project-path contracts_age_verifier \
  --env-file .secrets \
  --network sepolia

# Deploy verifier (returns contract address)
garaga deploy \
  --class-hash <CLASS_HASH_FROM_DECLARE> \
  --env-file .secrets \
  --network sepolia

# Verify on-chain (end-to-end test)
garaga verify-onchain \
  --system ultra_keccak_zk_honk \
  --contract-address <DEPLOYED_ADDRESS> \
  --proof circuits/target/age_verify_proof/proof \
  --vk circuits/target/age_verify_vk/vk \
  --env-file .secrets \
  --network sepolia
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual VK parsing + custom verifier | `garaga gen --system ultra_keccak_zk_honk` | Garaga v1.0.0 | Auto-generated Cairo verifiers. No custom crypto code needed. |
| `starkli` for deployment | `garaga declare` + `garaga deploy` or `sncast` | Garaga v1.0.0 | Integrated declare/deploy flow in garaga CLI. sncast remains standard for custom contracts. |
| `--system ultra_keccak_honk` (non-ZK) | `--system ultra_keccak_zk_honk` (ZK mode) | Garaga v1.0.0 | MUST use ZK mode for privacy. Non-ZK leaks witness data. |
| OpenZeppelin Ownable for all projects | Version-matched OZ or hand-rolled | Ongoing | Fast-moving Scarb versions create version gaps with OZ releases. |

**Deprecated/outdated:**
- The existing `contracts/` directory's verifier (from trivial circuit VK) must be replaced with per-circuit verifiers
- `snforge_std` v0.53.0 uses `start_cheat_caller_address` not the older `cheat_caller_address`
- Garaga versions prior to v0.17.0 have security issues -- v1.0.1 is safe

## Open Questions

1. **Gas cost of Honk verification on Starknet**
   - What we know: Garaga uses optimized builtins and non-deterministic techniques. Groth16 costs ~181K gas for verification. Honk is likely more expensive due to different proof structure (multilinear, not pairing-only).
   - What's unclear: No published benchmarks exist for UltraKeccakZKHonk verification gas cost on Starknet. The 500K gas target in success criteria may or may not be achievable.
   - Recommendation: Benchmark immediately after first verifier deployment. Run `garaga verify-onchain` and check the transaction receipt for gas consumed. If base verification exceeds ~450K, the Registry overhead (~50K for storage writes + event) may push past 500K. If exceeded, document the actual cost and note that Garaga's ongoing optimizations may improve this.

2. **Whether garaga gen can be run for multiple VKs into the same project**
   - What we know: `garaga gen` takes `--project-name` and generates a complete Scarb project. The VK constants are baked into `honk_verifier_constants.cairo`. Running it twice overwrites the project.
   - What's unclear: Whether there's a way to put two VKs in one project with different module names.
   - Recommendation: Use separate projects per circuit (proven pattern from starkware-private-erc20). This is simpler and avoids any undocumented behavior.

3. **snforge_std v0.53.0 cheatcode API for caller spoofing**
   - What we know: The cheatcode API changed names across versions. v0.53.0 should have `start_cheat_caller_address`.
   - What's unclear: Exact import path and function signature in v0.53.0.
   - Recommendation: Check `snforge_std` 0.53.0 source or docs at test time. The registry tests need caller spoofing for owner-only function testing.

4. **Whether garaga declare/deploy or sncast should be used for verifier deployment**
   - What we know: Both work. `garaga declare/deploy` is purpose-built for verifier contracts. `sncast declare/deploy` is the general-purpose tool.
   - What's unclear: Whether `garaga declare` handles the verifier's large contract size better than `sncast declare`.
   - Recommendation: Use `garaga declare` + `garaga deploy` for verifier contracts (they're designed for it). Use `sncast declare` + `sncast deploy` for the StarkShieldRegistry (custom contract).

5. **Constructor argument serialization for the Registry**
   - What we know: sncast expects `--constructor-calldata` as space-separated felt252 values. ContractAddress is a single felt252. u256 serializes as two felt252s (low, high).
   - What's unclear: Exact serialization order for the Registry constructor (owner: ContractAddress, age_verifier: ContractAddress, membership_verifier: ContractAddress).
   - Recommendation: Three ContractAddress values = three felt252 values in `--constructor-calldata`. Test with sncast on Sepolia.

## Sources

### Primary (HIGH confidence)

- **garaga CLI --help output** (verified locally, garaga v1.0.1) -- `garaga gen`, `garaga declare`, `garaga deploy`, `garaga verify-onchain`, `garaga calldata` exact flags and options
- **[Garaga Noir Verifier docs](https://garaga.gitbook.io/garaga/smart-contract-generators/noir)** -- Pipeline workflow, calldata formats (starkli/array/snforge), version requirements (beta.16, bb nightly)
- **[Cairo Book - Storage Mappings](https://www.starknet.io/cairo-book/ch101-01-01-storage-mappings.html)** -- `Map<K, V>` type, `entry().read()/write()`, nested maps, import requirements
- **[Cairo Book - Contract Events](https://www.starknet.io/cairo-book/ch101-03-contract-events.html)** -- Event enum/struct syntax, `#[key]` attribute for indexing, `self.emit()` pattern
- **[Cairo Book - Interacting with Another Contract](https://www.starknet.io/cairo-book/ch102-02-interacting-with-another-contract.html)** -- Dispatcher pattern, `IFooDispatcher { contract_address }.method()`, SafeDispatcher
- **[Starknet Foundry - Deploy](https://foundry-rs.github.io/starknet-foundry/starknet/deploy.html)** -- `sncast deploy` syntax, constructor-calldata, network flags
- **[Starknet Foundry - Declare](https://foundry-rs.github.io/starknet-foundry/starknet/declare.html)** -- `sncast declare` syntax, `--contract-name` auto-compilation
- **[Starknet Foundry - Testing Smart Contracts](https://foundry-rs.github.io/starknet-foundry/testing/contracts.html)** -- `declare/deploy` in tests, dispatcher usage, SafeDispatcher for error handling
- **[Starknet Sepolia Quickstart](https://docs.starknet.io/build/quickstart/sepolia)** -- Account creation, funding, declare/deploy/invoke/call workflow
- **Existing project files** -- `contracts/src/honk_verifier.cairo` (verifier interface), `contracts/Scarb.toml`, `circuits/crates/age_verify/src/main.nr` (public output ordering), `circuits/crates/membership_proof/src/main.nr` (public output ordering)

### Secondary (MEDIUM confidence)

- **[sn-noir-quickstart](https://github.com/m-kus/sn-noir-quickstart)** -- garaga declare/deploy commands with `--fee strk` flag, end-to-end deployment workflow
- **[starkware-private-erc20](https://github.com/wakeuplabs-io/starkware-private-erc20)** -- Multi-circuit pattern: separate verifier contracts per circuit, main contract routes to verifiers by type
- **[scaffold-garaga](https://github.com/KevinSheeranxyj/scaffold-garaga)** -- 2-app-state branch adds nullifier storage pattern, Makefile deployment workflow
- **[OpenZeppelin cairo-contracts releases](https://github.com/OpenZeppelin/cairo-contracts/releases)** -- v3.0.0 (Scarb 2.13.1), v4.0.0-alpha.0 (Scarb 2.15.1) -- gap at Scarb 2.14.0 confirmed
- **[Starknet Noir blog post](https://www.starknet.io/blog/noir-on-starknet/)** -- High-level workflow description, "significantly lower transaction fees" claim (no numbers)

### Tertiary (LOW confidence)

- **Gas cost for Honk verification** -- No published benchmarks found. Groth16 is ~181K gas (from HackMD article by Nebra). Honk is structurally different (MSM-heavy) and likely more expensive. The 500K target is an educated guess that needs validation.
- **snforge_std v0.53.0 cheatcode API** -- `start_cheat_caller_address` likely exists based on general Starknet Foundry docs, but exact v0.53.0 signature not verified
- **.secrets file format** -- Inferred from garaga CLI help (`--env-file`) and sn-noir-quickstart. Exact variable names (STARKNET_RPC vs RPC_URL) need validation against garaga source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tool versions verified locally, Scarb/garaga compatibility confirmed from Phase 1
- Architecture (multi-verifier pattern): HIGH -- confirmed by multiple projects (private-erc20, scaffold-garaga) and garaga CLI design (one VK per gen invocation)
- Architecture (Registry contract): MEDIUM -- standard Cairo patterns from official docs, but the specific integration of dispatcher calls + business logic is novel for this project
- Deployment workflow: MEDIUM -- garaga declare/deploy verified in help output; exact .secrets format needs validation at execution time
- Gas costs: LOW -- no benchmarks found; 500K target is unvalidated
- Pitfalls: HIGH -- version mismatches, VK confusion, and public input ordering are well-documented hazards from Phase 1-3 experience

**Research date:** 2026-02-14
**Valid until:** 2026-02-21 (7 days -- deployment-heavy phase with network-dependent variables)
