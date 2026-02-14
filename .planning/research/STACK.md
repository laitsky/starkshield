# Technology Stack

**Project:** StarkShield -- Privacy-Preserving Credential Verification on Starknet
**Researched:** 2026-02-14
**Overall Confidence:** MEDIUM (critical version compatibility concerns flagged)

---

## Critical Version Compatibility Warning

The most important finding in this research is that **several version choices in the project context have compatibility tensions that must be resolved before development begins**. These are detailed below and in the Version Compatibility Matrix section.

---

## Recommended Stack

### ZK Circuit Layer (Noir + Barretenberg)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Noir (nargo) | 1.0.0-beta.18 | ZK circuit language and compiler | Latest stable beta. Domain-specific language purpose-built for ZK circuits with clean syntax. Actively maintained by Aztec Labs. Used by zkPassport, zkLogin, and other production projects. | HIGH |
| Barretenberg (bb CLI) | **Match via bbup** | Proving backend (CLI for proof/VK generation) | bbup auto-resolves the compatible bb version for your installed nargo. Do NOT manually pin -- run `bbup` after `noirup --version 1.0.0-beta.18` and let it resolve. | HIGH |
| @noir-lang/noir_js | **1.0.0-beta.15** | In-browser witness generation | **WARNING:** This is the latest npm release as of 2026-02-14. There is NO beta.18 of noir_js on npm. The noir_js package lags behind nargo releases. Use beta.15 for the frontend. | HIGH |
| @aztec/bb.js | 3.0.0-nightly.20251104 | In-browser WASM proving backend | Official Barretenberg TypeScript/WASM interface. Provides `UltraHonkBackend` for browser-side proof generation. This specific nightly is documented as compatible with noir_js beta.15. | HIGH |
| @noir-lang/backend_barretenberg | **DO NOT USE** | Deprecated proving wrapper | **Deprecated** in favor of @aztec/bb.js. The project context lists v0.36.0 -- this is an old package that should NOT be used. Replace with @aztec/bb.js. | HIGH |

**Critical Compatibility Note:**
- nargo 1.0.0-beta.18 is the CLI compiler (used at build time to compile circuits)
- @noir-lang/noir_js 1.0.0-beta.15 is the latest JS package (used at runtime in browser)
- Circuits compiled with nargo beta.18 should produce artifacts compatible with noir_js beta.15 for witness execution, but **this must be tested early**
- @aztec/bb.js 3.0.0-nightly.20251104 is pinned by the official Noir tutorial as the compatible WASM proving backend
- The `@noir-lang/backend_barretenberg` v0.36.0 listed in the project context is **deprecated and must be replaced** with `@aztec/bb.js`

### Noir Cryptographic Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| noir-lang/poseidon | v0.2.3 (latest) / v0.1.1 (pinned in context) | Poseidon hashing for ZK circuits | Official Noir library, formerly in stdlib. Poseidon2 is available via `std::hash::poseidon2_permutation` in the Noir stdlib directly. The external library adds the Poseidon interface. Tested with Noir 1.0.0+. | MEDIUM |
| noir-lang/schnorr | v0.1.3 (latest) | Schnorr signature verification in circuits | Official Noir library. Tested with Noir 1.0.0-beta.0+. For Poseidon2-Schnorr signatures, use this with the stdlib Poseidon2 permutation. | MEDIUM |
| @zkpassport/poseidon2 | latest | TypeScript Poseidon2 hashing (frontend-side) | Pure TypeScript implementation matching the BN254 field used by Noir. Needed for the frontend to hash credential data before passing to the circuit as witness input. Async API recommended for performance. | LOW |

**Note on "Poseidon2-Schnorr signatures (external lib v0.1.1)":** The project context references a single library at v0.1.1. The official Noir ecosystem has these as **two separate libraries** (noir-lang/poseidon and noir-lang/schnorr). If v0.1.1 refers to a custom combined library, verify its Noir compatibility. The latest official poseidon is v0.2.3 and schnorr is v0.1.3. Consider using the latest official versions unless a specific combined library has been identified.

### Garaga SDK (Cairo Verifier Generation)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Garaga (Python CLI) | 1.0.1 | Generate Cairo verifier contracts from Noir VKs | The only production tool for generating Starknet-native ZK verifier contracts from Noir proofs. Supports UltraKeccakZK Honk flavor. Install via `pip install garaga==1.0.1`. | HIGH |
| Garaga (Scarb dependency) | 1.0.1 | Cairo library for verifier contracts | Add `garaga = "1.0.1"` to Scarb.toml. Published on scarbs.xyz registry. | HIGH |
| Python | 3.10 (mandatory) | Garaga SDK runtime | Garaga explicitly requires Python 3.10. Versions 3.11/3.12 may work for development but 3.10 is the documented requirement. Use a venv. | HIGH |

**Critical Garaga Version Warnings:**

1. **Garaga v1.0.0 specifies Noir 1.0.0-beta.16.** The project uses nargo 1.0.0-beta.18. Garaga v1.0.1 is a bugfix release on top of v1.0.0, so it likely still expects beta.16. **There is a 2-version gap between Garaga's expected Noir and the project's Noir.** This may or may not cause issues -- the Honk proof format may be stable across these betas, but this MUST be validated in a spike.

2. **Garaga v1.0.0 states Cairo code uses `2.12` and `2024_07` Edition.** The project context specifies Scarb 2.15.x with Cairo 2.15.0. The generated verifier contracts were written for Cairo 2.12 edition semantics. Scarb 2.15 should be backward-compatible, but **test that `garaga gen` output compiles under Scarb 2.15** immediately.

3. **Garaga v1.0.0 disables all Honk flavors except UltraKeccakZK.** This aligns with the project's stated proof system. Only `--system ultra_keccak_zk_honk` is available.

4. **SDK version matching is critical:** "Use the same Garaga SDK version that generated your verifier contract. Mismatched versions produce incompatible calldata." Pin garaga==1.0.1 everywhere.

### Garaga Workflow Commands

```bash
# 1. Compile Noir circuit
nargo build  # produces target/<circuit_name>.json

# 2. Generate verification key with Barretenberg
bb write_vk -s ultra_honk --oracle_hash keccak -b target/<circuit>.json -o target/vk

# 3. Generate Cairo verifier contract with Garaga
garaga gen --system ultra_keccak_zk_honk --vk target/vk

# 4. Generate witness and proof
nargo execute witness
bb prove -s ultra_honk --oracle_hash keccak -b target/<circuit>.json -w target/witness.gz -o target/

# 5. Generate calldata for on-chain submission
garaga calldata --system ultra_keccak_zk_honk --proof target/proof --vk target/vk --public-inputs target/public_inputs
```

### Smart Contract Layer (Cairo + Starknet)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Scarb | 2.15.2 | Cairo package manager and build tool | Latest stable. Bundles Cairo 2.15.0 compiler. Install via `starkup`. | HIGH |
| Cairo | 2.15.0 (bundled with Scarb) | Smart contract language for Starknet | Starknet's native language. No alternative exists. v2.15.0 is latest stable with proc macro fixes. | HIGH |
| Starknet Foundry (snforge/sncast) | 0.56.0 | Testing framework and deployment tool | Latest stable release (Feb 4, 2025). Supports Scarb 2.12.0+. Enhanced gas reporting and constructor error handling. | HIGH |
| OpenZeppelin Cairo Contracts | latest | Standard contract patterns (Ownable, access control) | Battle-tested implementations of common patterns. Use for access control on the verifier registry contract. | MEDIUM |

**Note on Scarb/Cairo vs Garaga compatibility:**
- Garaga README states Scarb 2.14.0 as a prerequisite
- Project uses Scarb 2.15.2 (Cairo 2.15.0)
- Scarb 2.15 should be backward-compatible with Garaga's generated Cairo 2.12-edition code
- The generated verifier is standalone Cairo -- it does not dynamically link against Garaga's internals at compile time (it uses `garaga = "1.0.1"` as a Scarb dependency)
- **Test early:** Run `garaga gen` and confirm the output compiles under Scarb 2.15.2

### Frontend Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | 19.x (latest 19.2.4) | UI framework | Industry standard. React 19 is stable with improved Suspense and Server Components (though Server Components are not relevant for a client-side ZK dApp). | HIGH |
| Vite | 6.x | Build tool and dev server | Fast HMR, native ESM, top-level await support (required for bb.js). Vite 6 is the current stable. | HIGH |
| TailwindCSS | 4.x | Utility-first CSS | CSS-first configuration (no tailwind.config.js). Up to 5x faster builds. Use `@import "tailwindcss"` and `@theme` directives. | HIGH |
| vite-plugin-node-polyfills | 0.17.0 | Node.js polyfills for browser | Required for Buffer, global, and process polyfills that bb.js WASM modules need in the browser. | HIGH |
| starknet.js | **8.9.0** (latest v8 stable on npm) | Starknet blockchain interaction | The npm `starknet` package latest is 8.9.0 (published Feb 7, 2026). v9 exists on GitHub releases but v8 is the npm "latest" tag. Use v8 for stability. Supports Starknet protocol 0.14.x and RPC 0.9. | HIGH |
| @starknet-react/core | 5.0.3 | React hooks for Starknet | Provides useConnect, useAccount, useInjectedConnectors hooks. Built on TanStack Query + starknet.js. Supports ArgentX, Braavos, Cartridge wallets out of the box. | HIGH |
| buffer | latest | Buffer polyfill | Required by bb.js in browser environments. | HIGH |

### Wallet Integration

| Technology | Purpose | Notes | Confidence |
|------------|---------|-------|------------|
| ArgentX | Primary wallet | Most popular Starknet wallet. Supported by @starknet-react/core via InjectedConnector. | HIGH |
| Braavos | Secondary wallet | Second most popular. Also supported by @starknet-react/core. | HIGH |
| get-starknet | Wallet discovery | Low-level library for wallet detection. @starknet-react/core wraps this -- use starknet-react instead of get-starknet directly. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Starknet Sepolia | -- | Testnet deployment target | Starknet's active testnet. Use Starknet Sepolia faucet for test STRK. | HIGH |
| noirup | latest | Noir version manager | Install and switch Noir versions. `noirup --version 1.0.0-beta.18`. | HIGH |
| bbup | latest | Barretenberg version manager | Auto-resolves compatible bb version for installed nargo. Run after noirup. | HIGH |
| starkup | latest | Starknet toolchain installer | Installs Scarb, snforge, sncast in one step. | HIGH |

---

## Version Compatibility Matrix

This is the most critical section. Version mismatches between Noir, Garaga, and Cairo are the primary risk.

| Component | Project Context Version | Verified Latest | Status | Risk |
|-----------|------------------------|-----------------|--------|------|
| Noir (nargo) | 1.0.0-beta.18 | 1.0.0-beta.18 | CORRECT | LOW -- this is latest |
| @noir-lang/noir_js | 1.0.0-beta.15 | 1.0.0-beta.15 | CORRECT | MEDIUM -- lags behind nargo |
| @noir-lang/backend_barretenberg | 0.36.0 | 0.36.0 (deprecated) | **WRONG CHOICE** | **HIGH -- deprecated, replace with @aztec/bb.js** |
| @aztec/bb.js | not listed | 3.0.0-nightly.20251104 (for noir_js beta.15) | **MISSING** | **HIGH -- must add this** |
| Garaga SDK | 1.0.1 | 1.0.1 | CORRECT | MEDIUM -- expects Noir beta.16, not beta.18 |
| Scarb | 2.15.x | 2.15.2 | CORRECT | LOW -- latest stable |
| Starknet Foundry | 0.56.0 | 0.56.0 | CORRECT | LOW -- latest stable |
| starknet.js | v8 | 8.9.0 (latest on npm) | CORRECT | LOW |
| React | 19 | 19.2.4 | CORRECT | LOW |
| Vite | 6 | 6.x | CORRECT | LOW |
| TailwindCSS | 4 | 4.x | CORRECT | LOW |
| Python | 3.10 | 3.10 required by Garaga | CORRECT | LOW |

### Version Chains That Must Work Together

**Chain 1: Circuit Compile -> Prove -> Verify On-Chain**
```
nargo 1.0.0-beta.18 (compile)
  -> bb CLI (matched via bbup) (generate VK + proof)
    -> garaga 1.0.1 (generate Cairo verifier from VK)
      -> Scarb 2.15.2 / Cairo 2.15.0 (compile verifier)
        -> Starknet Sepolia (deploy + verify)
```
**Risk:** Garaga v1.0.0 pinned to Noir beta.16 and Cairo 2.12. Two version gaps to bridge.

**Chain 2: In-Browser Prove -> Submit Calldata**
```
@noir-lang/noir_js 1.0.0-beta.15 (execute circuit / generate witness)
  -> @aztec/bb.js 3.0.0-nightly.20251104 (generate proof in WASM)
    -> garaga calldata (format for on-chain submission)
      -> starknet.js 8.9.0 (submit transaction)
```
**Risk:** noir_js beta.15 processing circuits compiled by nargo beta.18. Format likely stable but needs testing.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ZK Language | Noir | Circom | Noir has native Barretenberg integration, cleaner syntax, better browser proving story. Circom requires snarkjs which is heavier. Garaga has first-class Noir support. |
| ZK Language | Noir | Cairo-native ZK | No mature ZK circuit DSL in Cairo. Noir + Garaga is the documented path. |
| Proving Backend | @aztec/bb.js | @noir-lang/backend_barretenberg | backend_barretenberg is deprecated. bb.js is the official replacement with UltraHonk support. |
| Verifier Generation | Garaga | Manual Cairo verifier | Garaga automates the entire verifier contract generation. Writing a custom verifier is error-prone and unnecessary. |
| Frontend Framework | React 19 + Vite 6 | Next.js | Next.js adds server complexity unnecessary for a client-side ZK proving dApp. Vite's top-level await support and fast HMR are better suited. |
| CSS Framework | TailwindCSS 4 | styled-components | Tailwind 4's CSS-first config is simpler. No runtime JS. Faster builds. Hackathon speed. |
| Wallet Integration | @starknet-react/core | Direct starknet.js | starknet-react provides React hooks, auto-discovery of wallets, and TanStack Query caching. Much less boilerplate. |
| starknet.js | v8 (8.9.0) | v9 (pre-release) | v9 drops RPC 0.8 support and is still in pre-release on npm. v8 is the stable npm "latest". Use v8 for hackathon reliability. |
| Contract Testing | Starknet Foundry | Hardhat-Starknet | Starknet Foundry is the standard. Native Cairo testing, gas reporting, deployment tools. |

---

## Installation

### Prerequisites

```bash
# 1. Install Noir
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
noirup --version 1.0.0-beta.18

# 2. Install Barretenberg (auto-matches nargo version)
curl -L https://raw.githubusercontent.com/AztecProtocol/barretenberg/refs/heads/master/bbup/install | bash
bbup

# 3. Install Starknet toolchain (Scarb + Starknet Foundry)
curl -L https://raw.githubusercontent.com/software-mansion/starkup/refs/heads/main/install.sh | bash
# Then use starkup to install specific versions if needed

# 4. Install Garaga (Python 3.10 required)
python3.10 -m venv .venv
source .venv/bin/activate
pip install garaga==1.0.1
```

### Frontend Dependencies

```bash
# Core
npm install @noir-lang/noir_js@1.0.0-beta.15 @aztec/bb.js@3.0.0-nightly.20251104 starknet@8.9.0 @starknet-react/core@5.0.3

# Polyfills and build tools
npm install buffer vite-plugin-node-polyfills@0.17.0

# Dev dependencies
npm install -D vite@latest @vitejs/plugin-react@latest tailwindcss@latest
```

### Vite Configuration (Critical for WASM Proving)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  build: {
    target: 'esnext', // Required: bb.js uses top-level await
  },
  optimizeDeps: {
    exclude: ['@aztec/bb.js'], // Required: prevent Vite from pre-bundling WASM
  },
  resolve: {
    alias: {
      pino: 'pino/browser.js', // Required: bb.js logging compatibility
    },
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer used by WASM proving
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

**Note on Cross-Origin Isolation:** Barretenberg's WASM proving uses `SharedArrayBuffer` for multi-threaded proving via Web Workers. This requires COOP/COEP headers. The Vite dev server config above handles this. For production deployment, ensure your hosting sets these headers. Alternatively, use the `vite-plugin-cross-origin-isolation` plugin for dev.

### Scarb.toml (Cairo Contracts)

```toml
[package]
name = "starkshield"
version = "0.1.0"
edition = "2024_07"

[dependencies]
starknet = "2.15.0"
garaga = "1.0.1"

[dev-dependencies]
snforge_std = { git = "https://github.com/foundry-rs/starknet-foundry", tag = "v0.56.0" }

[[target.starknet-contract]]
sierra = true
```

---

## What NOT to Use

| Technology | Reason |
|------------|--------|
| @noir-lang/backend_barretenberg | **Deprecated.** Replaced by @aztec/bb.js. Will not receive updates. |
| Circom + snarkjs | Garaga's Noir support is first-class. Circom would require a different verifier generation path. |
| starknet.js v9 | Pre-release. npm "latest" is v8. v9 drops RPC 0.8 support. Unnecessary risk for a hackathon. |
| noir_js 1.0.0-beta.18 | **Does not exist on npm.** noir_js is at beta.15. Don't try to force a version that isn't published. |
| Next.js / Remix | Server-side rendering adds complexity. ZK proving is client-side. Vite is simpler and faster. |
| Manual WASM loading | Use @aztec/bb.js which handles WASM initialization internally. Don't manually fetch/instantiate WASM. |
| Hardhat | Not the standard for Starknet. Use Starknet Foundry (snforge/sncast). |

---

## Hackathon-Specific Recommendations

1. **Day 1 Spike: Version Compatibility.** Before building anything, validate Chain 1 and Chain 2 version compatibility (see matrix above). Compile a trivial Noir circuit with nargo beta.18, generate VK with bb, run garaga gen, and verify the output compiles under Scarb 2.15.2. Then test in-browser proving with noir_js beta.15 + bb.js.

2. **Pin ALL versions.** Use exact versions in package.json, Nargo.toml, and Scarb.toml. Do not use ranges (`^` or `~`). ZK toolchain versions are brittle.

3. **Use the Garaga CLI workflow.** Do not try to programmatically call Garaga from Node.js. The CLI is the supported path: `garaga gen` for verifier generation, `garaga calldata` for proof formatting.

4. **Offline proof generation fallback.** If in-browser WASM proving is too slow or unstable, have a fallback plan: generate proofs with the `bb` CLI on the user's machine (or a simple backend) and submit calldata via the frontend. Browser proving is a nice-to-have, not a hard requirement for a hackathon demo.

---

## Sources

### HIGH Confidence (Official Docs / GitHub Releases)
- [Noir Official Documentation](https://noir-lang.org/docs/) -- NoirJS tutorial, installation, stdlib
- [Noir GitHub Releases](https://github.com/noir-lang/noir/releases) -- v1.0.0-beta.18 release notes (Jan 6, 2026)
- [Garaga GitHub Releases](https://github.com/keep-starknet-strange/garaga/releases) -- v1.0.0 (Dec 2, 2024) and v1.0.1 (Dec 3, 2024)
- [Garaga Documentation](https://garaga.gitbook.io/garaga/) -- Installation, workflow, Noir verifier generation
- [Garaga Noir Verifier Docs](https://garaga.gitbook.io/garaga/smart-contract-generators/noir) -- UltraKeccakZK Honk workflow
- [Scarb GitHub Releases](https://github.com/software-mansion/scarb/releases) -- v2.15.2 (Feb 12, 2025) with Cairo 2.15.0
- [Starknet Foundry Releases](https://github.com/foundry-rs/starknet-foundry/releases) -- v0.56.0 (Feb 4, 2025)
- [starknet.js GitHub Releases](https://github.com/starknet-io/starknet.js/releases) -- v8.9.0 (latest npm stable)
- [starknet.js npm](https://www.npmjs.com/package/starknet) -- v8.9.0 confirmed
- [@noir-lang/noir_js npm](https://www.npmjs.com/package/@noir-lang/noir_js) -- v1.0.0-beta.15 (latest)
- [@aztec/bb.js npm](https://www.npmjs.com/package/@aztec/bb.js) -- 2.1.9 (latest) / 3.0.0-nightly.20251104 (documented compatible)
- [@noir-lang/backend_barretenberg npm](https://www.npmjs.com/package/@noir-lang/backend_barretenberg) -- v0.36.0 (deprecated)

### MEDIUM Confidence (Verified with Multiple Sources)
- [noir-lang/poseidon GitHub](https://github.com/noir-lang/poseidon) -- v0.2.3 (Jan 22, 2026)
- [noir-lang/schnorr GitHub](https://github.com/noir-lang/schnorr) -- v0.1.3 (Jun 3, 2025)
- [@starknet-react/core npm](https://www.npmjs.com/package/@starknet-react/core) -- v5.0.3
- [Starknet Noir Blog Post](https://www.starknet.io/blog/noir-on-starknet/) -- Garaga SDK workflow overview
- [scaffold-garaga](https://github.com/KevinSheeranxyj/scaffold-garaga) -- Reference architecture for Noir+Garaga+Starknet
- [sn-noir-quickstart](https://github.com/m-kus/sn-noir-quickstart) -- Starknet x Noir workshop repo

### LOW Confidence (WebSearch Only / Needs Validation)
- @zkpassport/poseidon2 TypeScript library -- found via search, not verified against official Noir docs for BN254 field compatibility
- Poseidon2 stdlib availability (`std::hash::poseidon2_permutation`) -- mentioned in TACEO blog post, verify in Noir 1.0.0-beta.18 stdlib
- Cross-origin isolation requirements for production WASM proving -- known pattern but deployment-specific
