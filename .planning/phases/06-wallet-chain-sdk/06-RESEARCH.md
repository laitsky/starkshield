# Phase 6: Wallet & Chain SDK - Research

**Researched:** 2026-02-15
**Domain:** Starknet wallet connection (ArgentX/Braavos), proof-to-calldata transformation via garaga npm, on-chain proof submission via starknet.js, verification status querying
**Confidence:** MEDIUM (starknet.js v8 API patterns verified from docs + type definitions; garaga npm `getZKHonkCallData` API verified from installed package types; wallet connection flow verified from official WalletAccount tutorial; exact proof bytes -> garaga calldata bridging needs runtime validation)

## Summary

Phase 6 adds the on-chain interaction layer to the existing SDK (`sdk/`). The SDK already generates browser-side ZK proofs via noir_js + bb.js (Phase 5), producing `ProofData` with `proof: Uint8Array` and `publicInputs: string[]`. Phase 6 bridges this to Starknet by: (1) connecting the user's ArgentX or Braavos wallet, (2) transforming the proof output into garaga calldata via `getZKHonkCallData`, (3) formatting and submitting a `verify_and_register` transaction to the deployed StarkShieldRegistry contract, and (4) querying verification status (nullifier usage and verification records) from the registry.

The critical data flow is: `bb.js ProofData` -> convert `publicInputs: string[]` to `Uint8Array` via `flattenFieldsAsArray` -> load VK bytes (bundled as static asset) -> call `garaga.getZKHonkCallData(proofBytes, publicInputsBytes, vkBytes)` -> get `bigint[]` calldata -> pass to `starknet.js account.execute()` with the registry contract address, `verify_and_register` entrypoint, and `[circuit_id, ...calldataArray]` as the calldata. The garaga npm package returns calldata as `bigint[]`, which maps directly to starknet.js's `BigNumberish[]` calldata format.

For wallet connection, the project should use `starknet@8.x` (the requirement spec says "v8") with `@starknet-io/get-starknet` v4.x for wallet discovery. The `WalletAccount` class keeps the private key in the browser wallet and delegates signing to it. Since the existing SDK uses Vite with vanilla TypeScript (no React), the wallet connection must use the vanilla JS pattern with `get-starknet`'s `connect()` function and `WalletAccount` constructor.

**Primary recommendation:** Add `starknet@8.9.2`, `@starknet-io/get-starknet@4.x` to the SDK package. Create three new modules: `wallet.ts` (connection management), `submitter.ts` (proof calldata generation + transaction submission), and `reader.ts` (on-chain status querying). Bundle VK files as static assets in `sdk/public/vk/`. The garaga npm package is already installed (v1.0.1) -- just needs `await garaga.init()` before calldata generation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| starknet | 8.9.2 | Starknet.js SDK -- Provider, WalletAccount, Contract, CallData | Phase requirement specifies "starknet.js v8". Latest v8 is 8.9.2. Provides WalletAccount for wallet-delegated signing. |
| @starknet-io/get-starknet | 4.x | Wallet discovery and connection UI for ArgentX/Braavos | Standard wallet bridge used by all Starknet dApps. Provides `connect()` with built-in modal. |
| garaga | 1.0.1 | Calldata generation for ZK Honk proof on-chain verification | Already installed in SDK. `getZKHonkCallData(proof, publicInputs, vk)` produces the `felt252[]` calldata the Garaga verifier expects. |
| @aztec/bb.js | 3.0.0-nightly.20251104 | Proof byte format utilities (`flattenFieldsAsArray`, `ProofData` type) | Already installed. Provides `flattenFieldsAsArray` to convert `publicInputs: string[]` to `Uint8Array` for garaga. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite | 6.x | Build tool (already configured with COOP/COEP, polyfills) | Already in place from Phase 5 |
| typescript | 5.x | Type safety | Already in place |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| starknet v8.9.2 | starknet v9.x (latest is 9.4.0) | v9.x changes default RPC from 0.9 to 0.10, renames "pending" to "pre-confirmed". The phase requirement says "v8", and starknetkit@3.4.3 depends on v8 types. Stick with v8. |
| @starknet-io/get-starknet v4 | starknetkit@3.4.3 | StarknetKit has React peer dependency and pulls in large dependency tree (@argent/x-ui, react, react-dom, trpc). Overkill for vanilla JS. get-starknet v4 is lighter and React-free. |
| @starknet-io/get-starknet v4 | @starknet-io/get-starknet v5 (discovery) | v5 uses a different API (`createStore`, `WalletAccountV5`). v4 is the standard for starknet.js v8 `WalletAccount`. v5 pairs with starknet.js v9. |
| Bundled VK static assets | `backend.getVerificationKey()` at runtime | VK generation at runtime adds latency and requires keeping the UltraHonkBackend alive. VK files are static (1888 bytes each) and do not change between sessions. Bundle as static assets for instant access. |

**Installation:**
```bash
cd sdk
npm install starknet@8.9.2 @starknet-io/get-starknet@4
```

## Architecture Patterns

### Recommended Project Structure (Phase 6 additions)

```
sdk/
├── src/
│   ├── index.ts                    # Updated: export wallet, submitter, reader modules
│   ├── wallet.ts                   # NEW: Wallet connection (ArgentX/Braavos)
│   ├── submitter.ts                # NEW: Proof calldata generation + transaction submission
│   ├── reader.ts                   # NEW: On-chain verification status querying
│   ├── types.ts                    # Updated: add wallet/submission/query types
│   ├── config.ts                   # NEW: Contract addresses, RPC URLs, circuit mappings
│   ├── init.ts                     # Existing: WASM initialization
│   ├── credentials.ts              # Existing: credential validation
│   ├── prover.ts                   # Existing: proof generation
│   └── circuits/                   # Existing: compiled circuit JSON
├── public/
│   ├── vk/                         # NEW: Verification key binary files
│   │   ├── age_verify.vk           # Copy from circuits/target/age_verify_vk/vk
│   │   └── membership_proof.vk     # Copy from circuits/target/membership_proof_vk/vk
│   └── credentials/                # Existing: demo credential JSON files
├── index.html                      # Updated: add wallet connect + submit buttons
└── package.json                    # Updated: add starknet, get-starknet deps
```

### Pattern 1: Wallet Connection via get-starknet v4 + WalletAccount

**What:** Connect to ArgentX or Braavos wallet using get-starknet's built-in modal, then create a WalletAccount for transaction signing.
**When to use:** Any user-initiated wallet interaction.
**Example:**

```typescript
// Source: starknetjs.com/docs/guides/account/walletAccount/ (v9.2.1 docs, WalletAccount v4 section)
import { connect } from '@starknet-io/get-starknet';
import { WalletAccount } from 'starknet';

const SEPOLIA_RPC = 'https://free-rpc.nethermind.io/sepolia-juno/v0_8';

export async function connectWallet(): Promise<WalletAccount> {
  // Opens built-in modal showing available wallets (ArgentX, Braavos)
  const selectedWallet = await connect({
    modalMode: 'alwaysAsk',
    modalTheme: 'dark',
  });

  if (!selectedWallet) {
    throw new Error('No wallet selected');
  }

  // Create WalletAccount -- private key stays in wallet, signing delegated
  const walletAccount = await WalletAccount.connect(
    { nodeUrl: SEPOLIA_RPC },
    selectedWallet,
  );

  return walletAccount;
}
```

### Pattern 2: Proof-to-Calldata Transformation via garaga

**What:** Convert bb.js `ProofData` (proof bytes + public inputs strings) into garaga calldata (`bigint[]`) for on-chain submission.
**When to use:** After proof generation, before transaction submission.
**Example:**

```typescript
// Source: garaga npm index.d.ts (getZKHonkCallData), bb.js proof/index.js (flattenFieldsAsArray)
import { init as initGaraga, getZKHonkCallData } from 'garaga';
import { flattenFieldsAsArray } from '@aztec/bb.js';
import type { ProofResult } from './types';

let garagaInitialized = false;

async function ensureGaragaInit(): Promise<void> {
  if (garagaInitialized) return;
  await initGaraga();
  garagaInitialized = true;
}

export async function generateCalldata(
  proofResult: ProofResult,
  circuitType: 'age_verify' | 'membership_proof',
): Promise<bigint[]> {
  await ensureGaragaInit();

  // Step 1: proof bytes are already Uint8Array from bb.js
  const proofBytes: Uint8Array = proofResult.proof;

  // Step 2: Convert publicInputs from string[] (hex) to Uint8Array
  const publicInputsBytes: Uint8Array = flattenFieldsAsArray(proofResult.publicInputs);

  // Step 3: Load VK bytes (static asset)
  const vkPath = circuitType === 'age_verify'
    ? '/vk/age_verify.vk'
    : '/vk/membership_proof.vk';
  const vkResponse = await fetch(vkPath);
  const vkBytes = new Uint8Array(await vkResponse.arrayBuffer());

  // Step 4: Generate calldata via garaga WASM
  const calldata: bigint[] = getZKHonkCallData(proofBytes, publicInputsBytes, vkBytes);

  return calldata;
}
```

### Pattern 3: Transaction Submission via WalletAccount.execute

**What:** Submit proof calldata to StarkShieldRegistry's `verify_and_register` function using the connected wallet.
**When to use:** After calldata generation, when user confirms transaction.
**Example:**

```typescript
// Source: starknetjs.com WalletAccount docs + contract ABI from contracts/target/dev/
import type { WalletAccount, InvocationsDetails } from 'starknet';

const REGISTRY_ADDRESS = '0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab';

export async function submitProof(
  walletAccount: WalletAccount,
  circuitId: number,    // 0 = age_verify, 1 = membership_proof
  calldata: bigint[],   // from garaga getZKHonkCallData
): Promise<string> {
  // Format calldata for verify_and_register(circuit_id: u8, full_proof_with_hints: Span<felt252>)
  // Starknet.js auto-handles Span serialization: [array_length, ...elements]
  const txCalldata: string[] = [
    circuitId.toString(),                          // circuit_id: u8
    calldata.length.toString(),                    // Span length prefix
    ...calldata.map(v => '0x' + v.toString(16)),   // Span elements as hex
  ];

  const result = await walletAccount.execute({
    contractAddress: REGISTRY_ADDRESS,
    entrypoint: 'verify_and_register',
    calldata: txCalldata,
  });

  // Wait for transaction acceptance
  await walletAccount.waitForTransaction(result.transaction_hash);

  return result.transaction_hash;
}
```

### Pattern 4: On-Chain Verification Status Querying

**What:** Read verification status from StarkShieldRegistry using a read-only Provider (no wallet needed).
**When to use:** When a dApp wants to check if a user has a valid verification on-chain.
**Example:**

```typescript
// Source: starknet.js Contract class docs + registry ABI
import { Contract, RpcProvider } from 'starknet';

const REGISTRY_ADDRESS = '0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab';
const SEPOLIA_RPC = 'https://free-rpc.nethermind.io/sepolia-juno/v0_8';

// Registry ABI (subset for read functions)
const REGISTRY_ABI = [/* loaded from contract ABI JSON */];

export async function queryVerificationStatus(nullifier: bigint): Promise<{
  exists: boolean;
  attributeKey: bigint;
  thresholdOrSetHash: bigint;
  timestamp: number;
  circuitId: number;
}> {
  const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
  const contract = new Contract(REGISTRY_ABI, REGISTRY_ADDRESS, provider);

  // Check if nullifier has been used
  const isUsed: boolean = await contract.is_nullifier_used(nullifier);

  if (!isUsed) {
    return { exists: false, attributeKey: 0n, thresholdOrSetHash: 0n, timestamp: 0, circuitId: 0 };
  }

  // Get full verification record
  const record = await contract.get_verification_record(nullifier);

  return {
    exists: true,
    attributeKey: record.attribute_key,
    thresholdOrSetHash: record.threshold_or_set_hash,
    timestamp: Number(record.timestamp),
    circuitId: Number(record.circuit_id),
  };
}
```

### Anti-Patterns to Avoid

- **Using starknet.js v9 when the phase specifies v8:** v9 changes default RPC version (0.9 -> 0.10) and renames "pending" to "pre-confirmed". The WalletAccount constructor signature also differs between v8 and v9. Stick with v8.9.2.
- **Using starknetkit for wallet connection in a vanilla JS app:** StarknetKit requires React as a peer dependency. The existing SDK is vanilla TypeScript with Vite. Use `@starknet-io/get-starknet` v4 instead.
- **Manually serializing proof bytes to felt252 array:** garaga's `getZKHonkCallData` handles all proof serialization including MSM hints and pairing data. Manual serialization will produce incompatible calldata.
- **Calling `getZKHonkCallData` without `await garaga.init()` first:** garaga is a WASM module that must be initialized. Calling functions before init causes "wasm not initialized" errors.
- **Re-generating VK at runtime via `backend.getVerificationKey()`:** This requires keeping the `UltraHonkBackend` alive and adds latency. VK files are static (1888 bytes) -- bundle them as static assets.
- **Forgetting Span length prefix in raw calldata:** When using `account.execute` with raw calldata, Cairo `Span<felt252>` serialization requires the array length as the first element before the array contents. If using `Contract.populate()` with ABI, starknet.js handles this automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proof calldata serialization | Manual felt252 encoding of proof bytes + hints | `garaga.getZKHonkCallData(proof, publicInputs, vk)` | Handles proof splitting, MSM hint precomputation, KZG pairing data. Getting this wrong = silent verification failures. Must use same garaga version (1.0.1) that generated the verifier contracts. |
| Wallet discovery and connection | Custom `window.starknet` detection | `@starknet-io/get-starknet` `connect()` | Handles wallet enumeration, UI modal, connection persistence, wallet API differences between ArgentX and Braavos. |
| Transaction signing | Manual signature computation | `WalletAccount.execute()` | Delegates signing to the browser wallet. Private key never leaves the wallet extension. |
| Contract call formatting | Manual ABI encoding for u256, Span | `Contract` class with ABI or `CallData.compile()` | starknet.js handles u256 -> (low, high) serialization, Span -> [length, ...elements] formatting, and all type coercion. |
| Public inputs byte conversion | Manual hex-to-bytes | `flattenFieldsAsArray` from `@aztec/bb.js` | Converts `string[]` (hex field elements) to `Uint8Array` correctly. Each field is 32 bytes big-endian. |

**Key insight:** The entire chain interaction layer is glue code between three existing libraries: bb.js (proof format), garaga (calldata generation), and starknet.js (wallet + transaction). The SDK's value is orchestrating these in the correct order with correct type conversions, NOT reimplementing any of their functionality.

## Common Pitfalls

### Pitfall 1: Proof Byte Format Mismatch Between bb.js and garaga

**What goes wrong:** `garaga.getZKHonkCallData` expects raw proof bytes and raw public inputs bytes, but bb.js `ProofData` has `proof: Uint8Array` (already raw) and `publicInputs: string[]` (hex strings). If you pass `publicInputs` as strings to garaga, it fails.
**Why it happens:** bb.js splits the proof from public inputs and represents public inputs as hex strings. garaga expects everything as `Uint8Array`.
**How to avoid:** Use `flattenFieldsAsArray` from `@aztec/bb.js` to convert `publicInputs: string[]` back to `Uint8Array`. This is a re-export from `@aztec/bb.js` proof utilities. The function maps each hex string to 32 bytes and concatenates them.
**Warning signs:** garaga throws WASM errors, or calldata is generated but on-chain verification fails with "deserialization error".

### Pitfall 2: Missing garaga WASM Initialization

**What goes wrong:** Calling `getZKHonkCallData` before `await garaga.init()` causes a runtime error because the WASM module is not loaded.
**Why it happens:** garaga uses wasm-pack bindings that require explicit initialization. Unlike bb.js which lazy-initializes, garaga's `init()` must be called explicitly.
**How to avoid:** Add garaga initialization to the SDK's WASM init gate. Call `garaga.init()` alongside the existing `initACVM()` and `initNoirC()` calls, or lazily before the first calldata generation.
**Warning signs:** "Cannot read properties of undefined" or "wasm is undefined" errors when calling garaga functions.

### Pitfall 3: Span<felt252> Calldata Serialization

**What goes wrong:** The `verify_and_register` function takes `Span<felt252>` as the second parameter. If the calldata does not include the array length prefix, Starknet deserialization fails and the transaction reverts.
**Why it happens:** Cairo's `Span<T>` (and `Array<T>`) are serialized as `[length, element_0, element_1, ...]`. Developers unfamiliar with Cairo serialization omit the length prefix.
**How to avoid:** Two options: (a) Use `Contract.populate('verify_and_register', { circuit_id, full_proof_with_hints: calldataArray })` which auto-adds the length prefix via ABI awareness, or (b) manually prepend `calldataArray.length.toString()` before the array elements in raw calldata.
**Warning signs:** Transaction fails with "Failed to deserialize param" or "Input too short" errors.

### Pitfall 4: u256 Parameter Handling for Nullifier Queries

**What goes wrong:** The `is_nullifier_used` and `get_verification_record` functions take `u256` parameters. starknet.js serializes `u256` as two `felt252` values: `(low: u128, high: u128)`. If you pass a single value, the call fails.
**Why it happens:** Cairo `u256` is a struct `{ low: u128, high: u128 }`. This is a known gotcha from Phase 4 (decision: "u256 calldata serialization: low 128 bits first, high 128 bits second").
**How to avoid:** Use the `Contract` class with ABI -- it handles `u256` serialization automatically. If using raw calldata, split the `u256` into `(low_128_bits, high_128_bits)`.
**Warning signs:** Read calls return unexpected zero values, or "input too long/short" errors.

### Pitfall 5: Wallet Not Connected to Sepolia

**What goes wrong:** The user has their wallet connected to Starknet mainnet, but the registry is deployed on Sepolia. The transaction is sent to the wrong network and either fails or goes to a non-existent contract.
**Why it happens:** Wallet extensions default to mainnet. Users forget to switch.
**How to avoid:** After wallet connection, check the chain ID and prompt the user to switch. Use `walletAccount.switchStarknetChain(constants.StarknetChainId.SN_SEPOLIA)` if available, or display a clear error message.
**Warning signs:** "Contract not found" errors, transaction hash not visible on Sepolia explorer.

### Pitfall 6: garaga Calldata Version Mismatch

**What goes wrong:** Using a different garaga npm version than the one that generated the verifier contracts. The calldata format may differ between garaga versions, causing on-chain verification to fail even with a valid proof.
**Why it happens:** garaga's calldata includes precomputed hints that depend on the verifier's internal structure. Version mismatches produce incorrect hints.
**How to avoid:** The SDK already has `garaga@1.0.1` installed, which matches the garaga CLI version used in Phase 4 to generate and deploy the verifier contracts. Do NOT upgrade garaga npm unless the verifier contracts are redeployed.
**Warning signs:** On-chain verification fails with "proof verification failed" even though local verification succeeds.

### Pitfall 7: Transaction Gas Estimation for verify_and_register

**What goes wrong:** The transaction fails because the gas estimate is too low for the computationally expensive ZK proof verification on-chain.
**Why it happens:** `verify_and_register` costs ~2.25 STRK (l2_gas: 281M, l1_data_gas: 768). Standard gas estimation may underestimate for complex operations.
**How to avoid:** Do not set manual gas limits -- let the wallet/SDK estimate gas automatically. Both ArgentX and Braavos handle gas estimation for complex transactions. If estimation fails, the wallet will show an error before signing.
**Warning signs:** "Insufficient max fee" or "Transaction execution error" after signing.

## Code Examples

Verified patterns from official sources and installed package type definitions:

### Complete Wallet Connection + Proof Submission Flow

```typescript
// Source: WalletAccount tutorial + garaga npm types + bb.js proof utilities
import { connect } from '@starknet-io/get-starknet';
import { WalletAccount, Contract, RpcProvider } from 'starknet';
import { init as initGaraga, getZKHonkCallData } from 'garaga';
import { flattenFieldsAsArray } from '@aztec/bb.js';
import type { ProofResult } from './types';

// Constants
const SEPOLIA_RPC = 'https://free-rpc.nethermind.io/sepolia-juno/v0_8';
const REGISTRY_ADDRESS = '0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab';

// 1. Connect wallet
const selectedWallet = await connect({ modalMode: 'alwaysAsk', modalTheme: 'dark' });
const walletAccount = await WalletAccount.connect(
  { nodeUrl: SEPOLIA_RPC },
  selectedWallet,
);
console.log('Connected:', walletAccount.address);

// 2. Generate proof (from Phase 5 SDK)
const proofResult: ProofResult = await generateAgeProof(credential, { threshold: 18, dappContextId: 42 });

// 3. Convert proof to garaga calldata
await initGaraga();
const publicInputsBytes = flattenFieldsAsArray(proofResult.publicInputs);
const vkBytes = new Uint8Array(await (await fetch('/vk/age_verify.vk')).arrayBuffer());
const calldata: bigint[] = getZKHonkCallData(proofResult.proof, publicInputsBytes, vkBytes);

// 4. Submit transaction
const circuitId = 0; // age_verify
const txCalldata: string[] = [
  circuitId.toString(),
  calldata.length.toString(),
  ...calldata.map(v => '0x' + v.toString(16)),
];

const result = await walletAccount.execute({
  contractAddress: REGISTRY_ADDRESS,
  entrypoint: 'verify_and_register',
  calldata: txCalldata,
});

console.log('Transaction hash:', result.transaction_hash);
await walletAccount.waitForTransaction(result.transaction_hash);
console.log('Transaction confirmed!');
```

### On-Chain Read: Check Nullifier and Get Verification Record

```typescript
// Source: starknet.js Contract docs + registry ABI
import { Contract, RpcProvider } from 'starknet';

const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
// Load ABI from contracts/target/dev/contracts_StarkShieldRegistry.contract_class.json
const registryABI = [...]; // ABI JSON array

const contract = new Contract(registryABI, REGISTRY_ADDRESS, provider);

// Check if nullifier is used (view function)
const nullifier = 0x1b291cc63a9aa3f4n; // example nullifier
const isUsed = await contract.is_nullifier_used(nullifier);
// starknet.js handles u256 serialization from BigInt automatically with ABI

if (isUsed) {
  // Get full verification record
  const record = await contract.get_verification_record(nullifier);
  console.log('Nullifier:', record.nullifier);
  console.log('Attribute key:', record.attribute_key);
  console.log('Threshold/Set hash:', record.threshold_or_set_hash);
  console.log('Timestamp:', Number(record.timestamp));
  console.log('Circuit ID:', Number(record.circuit_id));
}
```

### garaga WASM Initialization (Browser)

```typescript
// Source: garaga npm dist/index.mjs (WASM is bundled inline in the npm package)
import { init as initGaraga } from 'garaga';

// garaga WASM is embedded inline in the npm package (no external .wasm file needed)
// init() loads and compiles the WASM module
// Safe to call multiple times -- returns immediately if already initialized
await initGaraga();
```

### flattenFieldsAsArray for Public Inputs Conversion

```typescript
// Source: @aztec/bb.js/dest/browser/proof/index.js (verified from installed package)
import { flattenFieldsAsArray } from '@aztec/bb.js';

// ProofData.publicInputs is string[] of hex-encoded 32-byte fields:
// ['0x00000000...001', '0x00000000...002', ...]

// flattenFieldsAsArray converts each hex string to 32 bytes and concatenates:
// Uint8Array [0, 0, ..., 1, 0, 0, ..., 2, ...]
const publicInputsBytes: Uint8Array = flattenFieldsAsArray(proofResult.publicInputs);
// Length = numPublicInputs * 32 bytes
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `get-starknet` v3 + `WalletAccount` constructor | `get-starknet` v4 + `WalletAccount.connect()` | starknet.js v8 | New static factory method `WalletAccount.connect()` replaces constructor pattern |
| `starknetkit` for all wallet connections | `get-starknet` for vanilla JS, `starknetkit` for React apps | 2025 | StarknetKit added React dependency, making it inappropriate for non-React apps |
| Manual RPC calls for contract reads | `Contract` class with ABI-based type inference | starknet.js v6+ | Contract class auto-handles u256 serialization, Span length prefixing, return type parsing |
| garaga Python CLI for calldata | garaga npm `getZKHonkCallData()` in browser | garaga v1.0.0 | Client-side calldata generation eliminates need for backend/CLI in the proof submission flow |

**Deprecated/outdated:**
- `@noir-lang/backend_barretenberg`: Replaced by `@aztec/bb.js`. Do not use.
- Direct `window.starknet` access: Use `get-starknet` library for proper wallet discovery and type safety.
- `WalletAccount` constructor with `new WalletAccount(provider, selectedWallet)`: Use `WalletAccount.connect()` static method in v8+.
- starknet.js v5/v6 APIs: v8 has breaking changes in Contract factory, RPC version defaults, and WalletAccount constructor.

## Open Questions

1. **Whether `flattenFieldsAsArray` is exported from `@aztec/bb.js` top-level**
   - What we know: The function exists in `@aztec/bb.js/dest/browser/proof/index.js` and is listed in the package's top-level `index.d.ts` exports: `export { splitHonkProof, reconstructHonkProof, deflattenFields, type ProofData } from './proof/index.js'`. However, `flattenFieldsAsArray` is NOT listed in the re-exports -- only `deflattenFields`, `splitHonkProof`, `reconstructHonkProof` are exported.
   - What's unclear: Whether `flattenFieldsAsArray` needs to be imported from a deep path or reimplemented.
   - Recommendation: Check if `flattenFieldsAsArray` is available via deep import `@aztec/bb.js/dest/browser/proof/index.js`. If not, it is a trivial function: `fields.map(hexToUint8Array)` then concatenate. The function is 3 lines of code -- safe to hand-roll if not importable.

2. **Whether garaga `init()` works correctly in the same browser context as bb.js and noir_js WASM**
   - What we know: garaga WASM is bundled inline in the npm package (no external .wasm file). It uses standard `WebAssembly.instantiate()`. bb.js and noir_js also use WASM but load from separate files. There should be no conflicts (each is a separate WASM instance).
   - What's unclear: Whether garaga's WASM init causes any issues with COOP/COEP headers or SharedArrayBuffer.
   - Recommendation: Test garaga init early in development. If conflicts arise, garaga calldata can be generated synchronously via `initSync()` (if WASM bytes are available).

3. **Whether get-starknet v4 `connect()` modal UI works in a COOP/COEP isolated context**
   - What we know: The SDK requires `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` for bb.js SharedArrayBuffer. These headers restrict cross-origin resource loading.
   - What's unclear: Whether get-starknet's modal UI loads cross-origin resources (fonts, images) that would be blocked by COEP. Wallet extension injection should be unaffected (same-origin).
   - Recommendation: Test wallet connection early. If the modal breaks under COEP, use `get-starknet-core` to build a custom connection UI that avoids cross-origin resources, or temporarily relax COEP to `credentialless` (less restrictive, still enables SharedArrayBuffer in most browsers).

4. **Whether `{ keccak: true }` or `{ keccakZK: true }` is correct for on-chain verification**
   - What we know: Phase 4 verifiers were generated with `--system ultra_keccak_zk_honk`. Phase 5 SDK uses `{ keccak: true }` for proof generation. The bb.js options show `keccak` sets `disableZk: true` (non-ZK), while `keccakZK` sets `disableZk: false` (ZK). However, the garaga system name includes "zk_honk", suggesting it MAY accept both.
   - What's unclear: The exact mapping between bb.js options and garaga system names. Phase 4 validated with CLI-generated proofs using `bb prove -s ultra_honk --oracle_hash keccak` (which is the non-ZK keccak Honk).
   - Recommendation: Start with `{ keccak: true }` as Phase 5 already uses this. If on-chain verification fails, switch to `{ keccakZK: true }` -- this is a one-line change in `prover.ts`. The garaga verifier name "ultra_keccak_zk_honk" may refer to the Honk variant that supports ZK, not that ZK mode is required.

5. **RPC endpoint reliability for Sepolia**
   - What we know: The examples use `https://free-rpc.nethermind.io/sepolia-juno/v0_8`. Phase 4 used `https://rpc.starknet-testnet.lava.build:443`.
   - What's unclear: Which RPC endpoint is more reliable for browser-based calls.
   - Recommendation: Configure the RPC URL as a constant in `config.ts` so it can be easily changed. Use the same URL that Phase 4 validated with (`https://rpc.starknet-testnet.lava.build:443`) as the default.

## Sources

### Primary (HIGH confidence)

- **garaga npm `index.d.ts`** (installed package, v1.0.1) -- `getZKHonkCallData(proof: Uint8Array, publicInputs: Uint8Array, verifyingKey: Uint8Array): bigint[]` function signature verified
- **@aztec/bb.js `proof/index.d.ts`** (installed package, 3.0.0-nightly) -- `ProofData = { proof: Uint8Array, publicInputs: string[] }`, `flattenFieldsAsArray`, `splitHonkProof`, `reconstructHonkProof` implementations verified in source
- **@aztec/bb.js `backend.d.ts`** (installed package) -- `UltraHonkBackendOptions: { keccak?, keccakZK?, starknet?, starknetZK? }`, `getVerificationKey(): Promise<Uint8Array>` verified
- **contracts/src/registry.cairo** -- Full ABI verified: `verify_and_register(circuit_id: u8, full_proof_with_hints: Span<felt252>)`, `is_nullifier_used(nullifier: u256) -> bool`, `get_verification_record(nullifier: u256) -> VerificationRecord`
- **contracts/target/dev/contracts_StarkShieldRegistry.contract_class.json** -- Complete ABI JSON extracted and verified including `VerificationRecord` struct, event definitions
- **deployments.json** -- Registry address `0x054ca264033ae3b5874574c84de9c6086d94a66fb65445e455a8cef3137b7fab`, VK file paths, trusted issuer keys
- **Phase 4 SUMMARY** -- Gas costs (~2.25 STRK), u256 serialization (low first, high second), successful end-to-end `verify_and_register` on Sepolia
- **Phase 5 SUMMARY** -- SDK structure, garaga npm already installed, `{ keccak: true }` option, proof generation pipeline
- **garaga npm README.md** -- `init()` call required before use, `getZKHonkCallData()` listed as available function

### Secondary (MEDIUM confidence)

- **[starknetjs.com WalletAccount docs](https://starknetjs.com/docs/guides/account/walletAccount/)** -- WalletAccount.connect() pattern for get-starknet v4, execute/switchChain/watchAsset methods (docs show v9.2.1 but include v4 wallet section)
- **[PhilippeR26/Starknet-WalletAccount](https://github.com/PhilippeR26/Starknet-WalletAccount)** -- get-starknet v4 + WalletAccount constructor pattern, provider + wallet separation
- **[garaga Noir docs](https://garaga.gitbook.io/garaga/smart-contract-generators/noir)** -- TypeScript example: `const calldata: bigint[] = garaga.getZKHonkCallData(proof, publicInputs, vk)` with Uint8Array inputs
- **npm view starknet@8.9.2** -- Latest v8 version confirmed (v9.4.0 is latest overall)
- **npm view @starknet-io/get-starknet@4** -- Latest v4 confirmed as available
- **npm view starknetkit@3.4.3** -- Dependencies include React, confirmed inappropriate for vanilla JS

### Tertiary (LOW confidence)

- **Whether `flattenFieldsAsArray` is re-exported from bb.js top-level** -- Inspection of `index.d.ts` shows it is NOT in the re-exports, only `deflattenFields` is. May need deep import or reimplementation. Needs runtime validation.
- **COOP/COEP compatibility with get-starknet modal** -- No documentation found on this specific interaction. Needs runtime testing.
- **garaga WASM init in COOP/COEP context** -- No conflicts expected (inline WASM), but not tested in this specific configuration.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all package versions checked on npm, type definitions inspected from installed packages, starknet.js v8 specified in requirements
- Architecture (wallet connection): MEDIUM -- WalletAccount pattern verified from official docs, but get-starknet v4 modal UI not tested in COOP/COEP context
- Architecture (proof submission): MEDIUM -- garaga `getZKHonkCallData` API verified from types, but bb.js-to-garaga byte format bridging not runtime-tested
- Architecture (verification querying): HIGH -- standard starknet.js Contract.call pattern with verified ABI
- Pitfalls: HIGH -- u256 serialization, Span length prefix, garaga version matching all documented from Phase 4 experience

**Research date:** 2026-02-15
**Valid until:** 2026-02-22 (7 days -- stable dependencies, but runtime integration testing needed)
