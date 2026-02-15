# Phase 7: Web Application - Research

**Researched:** 2026-02-15
**Domain:** React SPA with WASM proof generation, wallet connection, and on-chain verification -- consuming the existing StarkShield SDK
**Confidence:** HIGH (SDK API surface fully audited from source; Vite+React+Tailwind stack verified from official docs; COOP/COEP browser compat verified from MDN; prior phase decisions documented in summaries)

## Summary

Phase 7 builds the user-facing React SPA with three views (Credential Wallet, Proof Generator, Verification Dashboard) plus privacy callout annotations and comprehensive error handling. The critical constraint is that the SDK (`sdk/`) already has a fully configured Vite setup -- COOP/COEP headers for SharedArrayBuffer, bb.js exclusion from optimizeDeps, pino ESM shim, WASM resolve aliases, node polyfills -- all of which are required for proof generation. Rather than duplicating this complex configuration in a separate package, the React app should be built directly inside the existing `sdk/` directory, replacing the current `index.html` E2E test page with a proper React SPA entry point.

The SDK exports a clean, well-defined API: `initWasm()`, `connectWallet()`, `generateAgeProof()`, `generateCalldata()`, `submitProof()`, `getVerificationRecord()`, and typed interfaces (`CredentialJSON`, `ProofResult`, `WalletState`, `SubmitResult`, `VerificationRecord`). The React views are thin wrappers around these SDK functions, managing UI state (loading spinners, error messages, step progress) while the SDK handles all cryptographic, wallet, and chain operations.

A critical browser compatibility issue shapes the COEP strategy: the SDK already uses `credentialless` (not `require-corp`) for COEP because `require-corp` blocks the get-starknet wallet modal's cross-origin resources. However, Safari does NOT support `credentialless` -- only Chrome (96+) and partial Firefox support. This means Safari users will NOT have SharedArrayBuffer (proof generation will be slower, single-threaded), while Chrome/Firefox users get full multithreaded performance. This is an acceptable tradeoff for a hackathon demo where Chrome is the primary target. The success criterion says "works in Chrome, Firefox, and Safari" -- proof generation will work in all three (bb.js falls back to single-threaded mode without SharedArrayBuffer), but will be slower in Safari.

**Primary recommendation:** Add React 19, @vitejs/plugin-react, react-router-dom v7 (library mode with createBrowserRouter), and @tailwindcss/vite to the existing `sdk/` package. Use three route-based views with React.lazy for code splitting. Keep state management simple with useState/useReducer (no Redux/Zustand needed for 3 views with shared wallet state via React Context). Prioritize Chrome for the hackathon demo, document Safari's single-threaded fallback behavior.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.0.0 | UI component framework | Latest stable. Architecture doc specifies React 19. |
| react-dom | ^19.0.0 | React DOM rendering | Paired with React 19. |
| react-router-dom | ^7.0.0 | Client-side routing (library mode) | v7 supports `createBrowserRouter` for SPA routing without SSR. Library mode avoids framework complexity. |
| @vitejs/plugin-react | ^5.1.0 | Vite React integration (JSX, Fast Refresh) | Official Vite plugin for React. v5.1.x supports React 19 and Vite 6. |
| tailwindcss | ^4.0.0 | Utility-first CSS framework | v4 with Vite plugin -- zero-config, no PostCSS setup, no content globs needed. |
| @tailwindcss/vite | ^4.0.0 | Tailwind CSS Vite integration | Official Vite plugin for Tailwind v4. Single `@import "tailwindcss"` in CSS. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| coi-serviceworker | latest | COOP/COEP header injection via service worker for static hosting (e.g., GitHub Pages) | Only if deploying to static hosting where server headers cannot be configured. Not needed for Vite dev server (middleware handles it). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-router-dom v7 (library mode) | React Router v7 framework mode with Vite plugin | Framework mode adds file-based routing, loaders, and SSR complexity. For a 3-view SPA consuming an existing SDK, library mode with `createBrowserRouter` is simpler and sufficient. |
| @tailwindcss/vite | Tailwind v3 with PostCSS | v3 requires postcss.config.js, tailwind.config.js, and content glob configuration. v4 with the Vite plugin eliminates all config files -- just `@import "tailwindcss"`. |
| useState/useReducer + Context | Zustand or Redux Toolkit | Overkill for 3 views. The shared state is wallet connection (1 object) and loaded credentials (1 array). A single WalletContext provider suffices. |
| starknet-react hooks | Direct SDK function calls | starknet-react adds a dependency on @starknet-react/core with its own wallet management. The SDK already has wallet connection via get-starknet v4. Using starknet-react would duplicate wallet management and add complexity. Direct SDK calls through thin React hooks are cleaner. |
| New `web/` directory | Build inside existing `sdk/` | Creating a separate `web/` package would require duplicating the entire Vite config (COOP/COEP headers, bb.js exclusion, pino shim, WASM aliases, node polyfills). Building inside `sdk/` reuses all of this. The cost is that `sdk/` becomes both the SDK and the app, but for a hackathon this is the pragmatic choice. |

**Installation:**
```bash
cd sdk
npm install react@19 react-dom@19 react-router-dom@7
npm install -D @vitejs/plugin-react@5 tailwindcss@4 @tailwindcss/vite@4
```

## Architecture Patterns

### Recommended Project Structure
```
sdk/
├── package.json                    # Updated: add React, react-router-dom, Tailwind
├── vite.config.ts                  # Updated: add @vitejs/plugin-react, @tailwindcss/vite
├── tsconfig.json                   # Updated: add "jsx": "react-jsx", include "app/**/*"
├── index.html                      # Updated: React SPA entry point (replaces E2E test page)
├── src/                            # SDK modules (UNCHANGED from Phase 5/6)
│   ├── index.ts                    # SDK public API barrel export
│   ├── init.ts                     # WASM initialization gate
│   ├── credentials.ts              # Credential validation and transformation
│   ├── prover.ts                   # Proof generation engine
│   ├── wallet.ts                   # Wallet connection (get-starknet v4)
│   ├── submitter.ts                # Proof-to-calldata + transaction submission
│   ├── reader.ts                   # On-chain verification queries
│   ├── config.ts                   # Contract addresses, RPC URL, circuit IDs
│   ├── types.ts                    # SDK type definitions
│   ├── shims/pino.js               # ESM shim for pino (bb.js dependency)
│   └── circuits/                   # Compiled circuit JSON artifacts
├── app/                            # NEW: React application
│   ├── main.tsx                    # React entry point (createRoot, router)
│   ├── App.tsx                     # Root component with RouterProvider
│   ├── index.css                   # @import "tailwindcss" + custom theme
│   ├── context/
│   │   └── WalletContext.tsx        # Wallet connection state (React Context)
│   ├── views/
│   │   ├── CredentialWallet.tsx     # WEB-01: Credential display + "Generate Proof" action
│   │   ├── ProofGenerator.tsx       # WEB-02: Attribute selector, threshold, progress, preview
│   │   └── VerificationDashboard.tsx # WEB-03: Past verifications + Starkscan links
│   ├── components/
│   │   ├── Layout.tsx               # Shell with nav, wallet connect button, privacy banner
│   │   ├── PrivacyCallout.tsx       # WEB-04: "This data stays on your device" annotation
│   │   ├── ErrorBanner.tsx          # WEB-06: Actionable error messages
│   │   ├── ProofProgress.tsx        # Progress indicator for proof generation steps
│   │   └── WalletButton.tsx         # Connect/disconnect wallet button with status
│   └── hooks/
│       ├── useWallet.ts             # Hook wrapping WalletContext for easy access
│       ├── useProofGeneration.ts    # Hook managing proof generation lifecycle
│       └── useVerifications.ts      # Hook for fetching and caching verification records
├── public/
│   ├── credentials/                # Demo credential JSON files
│   ├── vk/                         # Verification key binary files
│   └── wasm/                       # WASM binary files (acvm_js, noirc_abi)
└── e2e-test.html                   # RENAMED: Original E2E test page (preserved for testing)
```

### Pattern 1: SDK-as-Service via Custom React Hooks
**What:** Wrap SDK function calls in custom React hooks that manage loading state, errors, and results. The hook handles async lifecycle; the component renders based on hook state.
**When to use:** Every view that calls SDK functions.
**Example:**
```typescript
// app/hooks/useProofGeneration.ts
import { useState, useCallback } from 'react';
import {
  initWasm,
  generateAgeProof,
  generateCalldata,
  submitProof,
  type ProofResult,
  type CalldataResult,
  type SubmitResult,
  type CredentialJSON,
} from '../../src/index';

type ProofStep = 'idle' | 'initializing' | 'generating' | 'calldata' | 'submitting' | 'complete' | 'error';

interface ProofState {
  step: ProofStep;
  proofResult: ProofResult | null;
  calldataResult: CalldataResult | null;
  submitResult: SubmitResult | null;
  error: string | null;
}

export function useProofGeneration() {
  const [state, setState] = useState<ProofState>({
    step: 'idle',
    proofResult: null,
    calldataResult: null,
    submitResult: null,
    error: null,
  });

  const generateProof = useCallback(async (
    credential: CredentialJSON,
    threshold: number,
    dappContextId: number,
  ) => {
    try {
      setState(s => ({ ...s, step: 'initializing', error: null }));
      await initWasm();

      setState(s => ({ ...s, step: 'generating' }));
      const proofResult = await generateAgeProof(credential, { threshold, dappContextId });

      setState(s => ({ ...s, step: 'idle', proofResult }));
      return proofResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, step: 'error', error: message }));
      return null;
    }
  }, []);

  return { ...state, generateProof };
}
```

### Pattern 2: Wallet State via React Context
**What:** Share wallet connection state across all views using a single React Context. The context wraps the SDK's `connectWallet()`, `disconnectWallet()`, and `getWalletAccount()` functions.
**When to use:** App-level state that multiple views need (wallet address, connection status).
**Example:**
```typescript
// app/context/WalletContext.tsx
import { createContext, useState, useCallback, type ReactNode } from 'react';
import {
  connectWallet as sdkConnect,
  disconnectWallet as sdkDisconnect,
  type WalletState,
} from '../../src/index';
import type { WalletAccount } from 'starknet';

interface WalletContextValue {
  walletAccount: WalletAccount | null;
  walletState: WalletState | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setError(null);
      const result = await sdkConnect();
      setWalletAccount(result.walletAccount);
      setWalletState(result.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await sdkDisconnect();
    setWalletAccount(null);
    setWalletState(null);
  }, []);

  return (
    <WalletContext value={{ walletAccount, walletState, connecting, error, connect, disconnect }}>
      {children}
    </WalletContext>
  );
}
```

### Pattern 3: Route-Based Code Splitting with React.lazy
**What:** Lazy-load each view so the initial bundle only includes the shell (nav, wallet button). WASM-heavy proof generation code loads only when the user navigates to ProofGenerator.
**When to use:** Always. The proof engine imports (noir_js, bb.js) are large -- do not load them on the Credential Wallet view.
**Example:**
```typescript
// app/App.tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';

const CredentialWallet = lazy(() => import('./views/CredentialWallet'));
const ProofGenerator = lazy(() => import('./views/ProofGenerator'));
const VerificationDashboard = lazy(() => import('./views/VerificationDashboard'));

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Suspense fallback={<div>Loading...</div>}><CredentialWallet /></Suspense> },
      { path: 'prove', element: <Suspense fallback={<div>Loading...</div>}><ProofGenerator /></Suspense> },
      { path: 'dashboard', element: <Suspense fallback={<div>Loading...</div>}><VerificationDashboard /></Suspense> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

### Pattern 4: Privacy Callout as Reusable Component
**What:** A visual annotation component that appears at credential loading, proof generation, and before submission to inform users that private data never leaves their device.
**When to use:** WEB-04 requires privacy callouts at three key points.
**Example:**
```typescript
// app/components/PrivacyCallout.tsx
interface PrivacyCalloutProps {
  context: 'credential' | 'proof' | 'submission';
}

const messages = {
  credential: 'Your credential data stays on your device. It is never uploaded to any server.',
  proof: 'Proof generation happens entirely in your browser. Only the ZK proof (not your data) will be shared.',
  submission: 'Only the proof and public outputs go on-chain. Your actual age, identity, and credential details remain private.',
};

export default function PrivacyCallout({ context }: PrivacyCalloutProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-green-700/40 bg-green-950/30 px-4 py-3 text-sm text-green-300">
      <span className="mt-0.5 shrink-0" aria-hidden="true">&#128274;</span>
      <span>{messages[context]}</span>
    </div>
  );
}
```

### Pattern 5: Starkscan Transaction Links
**What:** Clickable links to the Starkscan Sepolia block explorer for transaction verification.
**When to use:** Verification Dashboard (WEB-03) for past verifications.
**Example:**
```typescript
const STARKSCAN_SEPOLIA_BASE = 'https://sepolia.starkscan.co';

function starkscanTxUrl(txHash: string): string {
  return `${STARKSCAN_SEPOLIA_BASE}/tx/${txHash}`;
}

function starkscanContractUrl(address: string): string {
  return `${STARKSCAN_SEPOLIA_BASE}/contract/${address}`;
}
```

### Pattern 6: Error Classification and Actionable Messages (WEB-06)
**What:** Classify errors by type and show user-actionable messages instead of raw error strings.
**When to use:** Every error boundary and catch block.
**Example:**
```typescript
// app/components/ErrorBanner.tsx
interface ErrorInfo {
  title: string;
  message: string;
  action: string;
}

function classifyError(error: string): ErrorInfo {
  if (error.includes('expired') || error.includes('expir')) {
    return {
      title: 'Credential Expired',
      message: 'This credential has passed its expiration date.',
      action: 'Request a new credential from the issuer.',
    };
  }
  if (error.includes('network') || error.includes('chain') || error.includes('SN_SEPOLIA')) {
    return {
      title: 'Wrong Network',
      message: 'Your wallet is connected to the wrong network.',
      action: 'Switch your wallet to Starknet Sepolia in your wallet settings.',
    };
  }
  if (error.includes('gas') || error.includes('fee') || error.includes('insufficient')) {
    return {
      title: 'Insufficient Gas',
      message: 'Your account does not have enough STRK/ETH for this transaction.',
      action: 'Add funds to your Sepolia wallet via a faucet.',
    };
  }
  if (error.includes('rejected') || error.includes('User abort') || error.includes('cancel')) {
    return {
      title: 'Transaction Rejected',
      message: 'You declined the transaction in your wallet.',
      action: 'Try again and approve the transaction when prompted.',
    };
  }
  if (error.includes('wasm') || error.includes('WASM') || error.includes('WebAssembly')) {
    return {
      title: 'WASM Load Failure',
      message: 'The proof engine failed to initialize.',
      action: 'Try refreshing the page. Ensure you are using a modern browser (Chrome, Firefox, Safari).',
    };
  }
  if (error.includes('wallet') || error.includes('No wallet') || error.includes('not installed')) {
    return {
      title: 'Wallet Not Found',
      message: 'No compatible wallet extension was detected.',
      action: 'Install ArgentX or Braavos wallet extension and refresh the page.',
    };
  }
  return {
    title: 'Error',
    message: error,
    action: 'Try again. If the problem persists, refresh the page.',
  };
}
```

### Anti-Patterns to Avoid
- **Creating a separate `web/` package:** Duplicates the entire Vite WASM/COOP/COEP config. Build inside `sdk/` instead.
- **Using starknet-react for wallet management:** The SDK already handles wallet connection via get-starknet v4. starknet-react would add a second wallet management layer and conflicting state.
- **Initializing WASM on page load:** Gate WASM init behind the ProofGenerator view. The Credential Wallet and Verification Dashboard do not need WASM.
- **Using `require-corp` for COEP:** Breaks the get-starknet wallet modal's cross-origin resources. The SDK already switched to `credentialless` in Phase 6. Keep it.
- **Hardcoding contract addresses in React components:** All addresses are already in `sdk/src/config.ts`. Import from there.
- **Storing verification history in localStorage without structure:** Use a simple array-of-objects schema with a known key. The Verification Dashboard needs to persist proof submission results (tx hash, nullifier, timestamp, circuit type) across page refreshes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS utility classes | Custom CSS-in-JS or manual stylesheets | Tailwind CSS v4 | Zero config with Vite plugin. Utility classes produce consistent, readable UI code. |
| Client-side routing | Hash-based or manual location.pathname routing | react-router-dom v7 `createBrowserRouter` | Handles nested layouts, code splitting, browser history, and navigation guards. |
| Wallet connection UI | Custom modal for wallet selection | SDK's `connectWallet()` which uses get-starknet v4 built-in modal | get-starknet's modal handles wallet detection, display, and connection UX. |
| Proof progress indicator | Custom timer-based progress bar | Step-based progress derived from SDK callback phases | Proof generation has discrete steps (init, witness, prove, done) -- not a continuous progress bar. Show which step is active. |
| Error message formatting | Displaying raw Error.message to users | Error classifier function (see Pattern 6) | Raw errors from bb.js, starknet.js, and garaga are developer-facing, not user-facing. Classify and translate. |
| Nullifier truncation | Ad-hoc string slicing | Consistent utility function `truncateHex(value, startChars, endChars)` | Nullifiers are 66-char hex strings. Truncate consistently: `0x1b29...982d`. |
| Credential expiration check | Manual timestamp comparison in React | SDK's `validateAgeCredential()` / `validateMembershipCredential()` | SDK already validates expiration via circuit timestamp check. In the UI, compare `expires_at` hex to current time for display. |

**Key insight:** The React app is a UI layer over the SDK. Every cryptographic, chain, and wallet operation is delegated to `sdk/src/`. The React code's responsibility is orchestrating user interactions, managing UI state, and presenting results clearly -- nothing more.

## Common Pitfalls

### Pitfall 1: COEP `credentialless` Not Supported in Safari
**What goes wrong:** Safari users cannot access SharedArrayBuffer because Safari only supports COEP `require-corp`, not `credentialless`. Proof generation falls back to single-threaded WASM, taking 2-5x longer.
**Why it happens:** The SDK uses `credentialless` (not `require-corp`) because `require-corp` blocks the get-starknet wallet modal's cross-origin resources.
**How to avoid:** Accept this as a known limitation for the hackathon. Document it. bb.js falls back gracefully to single-threaded mode -- proofs still generate, just slower. Chrome is the primary demo target. The success criterion says "works in Chrome, Firefox, and Safari" -- it will work, just slower in Safari.
**Warning signs:** Safari console shows no SharedArrayBuffer warning; proof generation takes 30-60+ seconds instead of 10-15 seconds.

### Pitfall 2: Vite Plugin Ordering -- React Before Tailwind
**What goes wrong:** If `@tailwindcss/vite` is added before `@vitejs/plugin-react` in the plugins array, CSS processing may interfere with JSX transformation.
**Why it happens:** Vite processes plugins in order. The React plugin must transform JSX before Tailwind processes CSS.
**How to avoid:** Order plugins: `[react(), tailwindcss(), nodePolyfills(), coopCoepHeaders]`.
**Warning signs:** Build errors about JSX syntax or CSS not applying.

### Pitfall 3: Importing SDK Modules with Wrong Relative Paths
**What goes wrong:** React components in `app/` import from `../../src/index` but the path is wrong or TypeScript cannot resolve it.
**Why it happens:** The `app/` directory is a sibling of `src/`. Relative imports must go up two levels.
**How to avoid:** Use a TypeScript path alias: `"@sdk": ["./src"]` in tsconfig.json, or consistently use `../../src/index` from `app/` modules. Keep imports from the SDK barrel (`src/index.ts`) only -- never import internal SDK modules directly.
**Warning signs:** "Cannot find module" TypeScript errors, or Vite build failures.

### Pitfall 4: Missing `jsx: "react-jsx"` in tsconfig.json
**What goes wrong:** TypeScript does not understand JSX syntax in `.tsx` files.
**Why it happens:** The existing `tsconfig.json` was created for the SDK (TypeScript only, no React). It does not have `"jsx": "react-jsx"`.
**How to avoid:** Add `"jsx": "react-jsx"` to `compilerOptions` and add `"app/**/*"` to the `include` array.
**Warning signs:** "Cannot use JSX unless the '--jsx' flag is provided" TypeScript error.

### Pitfall 5: Proof Generation Blocking the React UI Thread
**What goes wrong:** When proof generation runs (10-30 seconds), the entire React UI freezes -- no button clicks, no spinner animation, nothing.
**Why it happens:** bb.js proof generation runs on the main thread if SharedArrayBuffer is unavailable (Safari) or if the proving operation blocks the event loop.
**How to avoid:** bb.js uses Web Workers internally when SharedArrayBuffer is available. In Chrome/Firefox with COEP credentialless, the UI should remain responsive during proving. In Safari (no SharedArrayBuffer), expect some UI jank. Show the progress step indicator BEFORE starting the prove call so the user sees feedback before the potential freeze.
**Warning signs:** Spinner freezes during proof generation; React state updates not reflecting.

### Pitfall 6: Losing Verification History on Page Refresh
**What goes wrong:** After submitting a proof on-chain and seeing it in the Verification Dashboard, a page refresh loses all records.
**Why it happens:** Verification records from `submitProof()` return values are only in React state. On-chain records exist but require knowing the nullifier to query.
**How to avoid:** Persist verification history to localStorage after each successful submission. Store: `{ txHash, nullifier, circuitType, timestamp, attributeKey, threshold }`. Load on dashboard mount. Enrich with on-chain data via `getVerificationRecord()` for confirmation.
**Warning signs:** Empty dashboard after page refresh despite having submitted proofs.

### Pitfall 7: Credential Expiration Display Confusion
**What goes wrong:** The credential JSON has `expires_at` as a hex-encoded Unix timestamp (e.g., `0x6b7190fb`). If displayed raw, users see meaningless hex.
**Why it happens:** The credential format uses hex for all fields (circuit compatibility). The UI must convert to human-readable dates.
**How to avoid:** Convert hex to decimal, then to Date: `new Date(Number(BigInt(credential.expires_at)) * 1000).toLocaleDateString()`. Also compare to `Date.now()` for expired/active status.
**Warning signs:** Users see raw hex timestamps or incorrect dates.

## Code Examples

Verified patterns based on existing SDK source and official documentation:

### Vite Config Update for React + Tailwind
```typescript
// sdk/vite.config.ts -- updated for Phase 7
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),              // React JSX + Fast Refresh
    tailwindcss(),        // Tailwind CSS v4
    nodePolyfills({       // Existing: Buffer/global/process for bb.js
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          // credentialless (not require-corp) for wallet modal compatibility
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      // Existing WASM aliases from Phase 5
      '@noir-lang/acvm_js': path.resolve(
        __dirname, 'node_modules/@noir-lang/acvm_js/web/acvm_js.js',
      ),
      '@noir-lang/noirc_abi': path.resolve(
        __dirname, 'node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm.js',
      ),
      pino: path.resolve(__dirname, 'src/shims/pino.js'),
    },
  },
  optimizeDeps: {
    exclude: ['@aztec/bb.js'],  // Existing: prevent WASM loading breakage
  },
  build: {
    target: 'esnext',           // Existing: required for bb.js top-level await
  },
  assetsInclude: ['**/*.wasm'], // Existing: WASM binary handling
});
```

### Credential Wallet View -- Display and Actions
```typescript
// app/views/CredentialWallet.tsx
// Source: SDK types from sdk/src/types.ts, demo credentials from sdk/public/credentials/
import { useState, useEffect } from 'react';
import { validateAgeCredential, validateMembershipCredential } from '../../src/index';
import type { CredentialJSON, ValidationResult } from '../../src/index';
import PrivacyCallout from '../components/PrivacyCallout';

interface LoadedCredential {
  credential: CredentialJSON;
  validation: ValidationResult;
  displayName: string;
  attributeType: string;
  expirationStatus: 'active' | 'expired';
  expiresAt: Date;
}

function parseCredential(cred: CredentialJSON): LoadedCredential {
  const credType = BigInt(cred.credential_type);
  const isAge = credType === 0n;

  const validation = isAge
    ? validateAgeCredential(cred)
    : validateMembershipCredential(cred);

  const expiresAtUnix = Number(BigInt(cred.expires_at));
  const expiresAt = new Date(expiresAtUnix * 1000);
  const expirationStatus = expiresAtUnix > Math.floor(Date.now() / 1000) ? 'active' : 'expired';

  return {
    credential: cred,
    validation,
    displayName: isAge ? 'Age Verification' : 'Membership Verification',
    attributeType: isAge ? 'Age' : 'Membership',
    expirationStatus,
    expiresAt,
  };
}
```

### Proof Progress Indicator
```typescript
// app/components/ProofProgress.tsx
type ProofStep = 'idle' | 'initializing' | 'generating' | 'calldata' | 'submitting' | 'complete' | 'error';

const STEPS: { key: ProofStep; label: string }[] = [
  { key: 'initializing', label: 'Initializing proof engine' },
  { key: 'generating', label: 'Generating ZK proof' },
  { key: 'calldata', label: 'Preparing transaction data' },
  { key: 'submitting', label: 'Submitting to Starknet' },
  { key: 'complete', label: 'Verification complete' },
];

export default function ProofProgress({ currentStep }: { currentStep: ProofStep }) {
  if (currentStep === 'idle') return null;

  const activeIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="space-y-2">
      {STEPS.map((step, i) => (
        <div key={step.key} className={`flex items-center gap-3 text-sm ${
          i < activeIndex ? 'text-green-400' :
          i === activeIndex ? 'text-blue-400 font-medium' :
          'text-gray-600'
        }`}>
          <span>{i < activeIndex ? '\u2713' : i === activeIndex ? '\u25CF' : '\u25CB'}</span>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
```

### Verification Dashboard with Starkscan Links
```typescript
// app/views/VerificationDashboard.tsx -- localStorage-backed verification history
const STORAGE_KEY = 'starkshield_verifications';
const STARKSCAN_SEPOLIA = 'https://sepolia.starkscan.co';

interface StoredVerification {
  txHash: string;
  nullifier: string;
  circuitType: 'age_verify' | 'membership_proof';
  timestamp: number;
  attributeKey: string;
  threshold: string;
}

function loadVerifications(): StoredVerification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVerification(v: StoredVerification): void {
  const existing = loadVerifications();
  existing.unshift(v); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

function truncateHex(hex: string, start = 6, end = 4): string {
  if (hex.length <= start + end + 2) return hex;
  return `${hex.slice(0, start + 2)}...${hex.slice(-end)}`;
}
```

### index.html Update for React SPA
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StarkShield</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/app/main.tsx"></script>
</body>
</html>
```

### SDK API Surface Reference (Phase 7 Consumes These)
```typescript
// Complete list of SDK exports consumed by the React app
// Source: sdk/src/index.ts (verified from codebase)

// WASM
initWasm(): Promise<void>

// Credentials
validateAgeCredential(cred: CredentialJSON): ValidationResult
validateMembershipCredential(cred: CredentialJSON): ValidationResult
credentialToAgeInputs(cred: CredentialJSON, params: AgeProofParams): InputMap
credentialToMembershipInputs(cred: CredentialJSON, params: MembershipProofParams): InputMap

// Proof Generation
generateAgeProof(cred: CredentialJSON, params: AgeProofParams): Promise<ProofResult>
generateMembershipProof(cred: CredentialJSON, params: MembershipProofParams): Promise<ProofResult>
verifyProofLocally(circuitType: CircuitType, proofData: ProofResult): Promise<boolean>

// Wallet
connectWallet(): Promise<{ walletAccount: WalletAccount; state: WalletState }>
disconnectWallet(): Promise<void>
getWalletAccount(): WalletAccount | null

// Chain Submission
generateCalldata(proofResult: ProofResult, circuitType: CircuitType): Promise<CalldataResult>
submitProof(walletAccount: WalletAccount, calldataResult: CalldataResult): Promise<SubmitResult>

// On-Chain Reading
isNullifierUsed(nullifier: bigint | string): Promise<boolean>
getVerificationRecord(nullifier: bigint | string): Promise<VerificationRecord>

// Config
REGISTRY_ADDRESS: string
SEPOLIA_RPC_URL: string
CIRCUIT_IDS: { age_verify: 0; membership_proof: 1 }
VK_PATHS: { age_verify: string; membership_proof: string }

// Types
CredentialJSON, CircuitType, ProofResult, AgeProofParams, MembershipProofParams,
ValidationResult, WalletState, SubmitResult, CalldataResult, VerificationRecord
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 with PostCSS config + tailwind.config.js + content globs | Tailwind v4 with `@tailwindcss/vite` plugin -- zero config, just `@import "tailwindcss"` | Tailwind v4.0 (Jan 2025) | Eliminates 2 config files and content scanning. Use v4 for new projects. |
| react-router-dom v6 `<BrowserRouter>` JSX routing | react-router-dom v7 `createBrowserRouter` (data mode) | React Router v7 (late 2025) | `createBrowserRouter` enables data loading APIs and better code splitting. For a pure SPA, library/data mode is simpler than framework mode. |
| Create React App (CRA) | Vite + @vitejs/plugin-react | CRA deprecated (2023+) | CRA is unmaintained. Vite is the standard for new React projects. Already using Vite 6 from Phase 5. |
| COEP `require-corp` for SharedArrayBuffer | COEP `credentialless` for cross-origin resource compatibility | Phase 6 decision | `require-corp` blocks wallet modal assets. `credentialless` enables SharedArrayBuffer in Chrome/Firefox while allowing cross-origin wallet resources. Safari still only supports `require-corp` (no `credentialless`). |

**Deprecated/outdated:**
- Create React App: Deprecated. Do not use. Vite is the standard.
- Tailwind v3 setup with PostCSS: Works but requires more config. Use v4 + Vite plugin for new projects.
- `react-router-dom` v5 `<Switch>`/`<Route>` patterns: Replaced by v6+ `<Routes>`/`<Route>` or v7 `createBrowserRouter`.
- starknet-react for wallet management in this project: The SDK already handles wallet connection. Do not add a second wallet management layer.

## Open Questions

1. **Whether bb.js proof generation blocks the React UI thread in practice**
   - What we know: bb.js uses Web Workers internally when SharedArrayBuffer is available. In Chrome/Firefox with `credentialless` COEP, Workers should have SharedArrayBuffer. The UI should remain responsive during proving.
   - What's unclear: Whether the witness computation step (noir.execute) also runs in a Worker, or if it blocks the main thread.
   - Recommendation: Test in Chrome. If the UI freezes during proof generation, consider wrapping the entire proof pipeline in a dedicated Web Worker using `comlink` (already available as a bb.js dependency). For the hackathon, showing a "Generating proof..." message before the call is likely sufficient.

2. **Whether Tailwind v4 CSS works correctly with the existing resolve aliases and node polyfills**
   - What we know: The existing Vite config has `resolve.alias` entries for noir_js/acvm_js and a pino shim. Tailwind v4 uses its own Vite plugin for CSS processing.
   - What's unclear: Whether the alias configuration or node polyfills interfere with Tailwind's CSS processing pipeline.
   - Recommendation: Test early -- install Tailwind, add `@import "tailwindcss"` to CSS, verify that utility classes work. If conflicts arise, Tailwind v4 also supports a PostCSS fallback (`@tailwindcss/postcss`).

3. **Whether `react-router-dom` v7 `createBrowserRouter` works with the COOP `same-origin` header**
   - What we know: COOP `same-origin` prevents the page from sharing a browsing context group with cross-origin documents. React Router's client-side routing uses `history.pushState()` which is same-origin by definition.
   - What's unclear: Whether any React Router feature relies on cross-origin communication.
   - Recommendation: This should be a non-issue since React Router is purely client-side. Test early to confirm.

4. **Credential loading UX for the demo**
   - What we know: The demo has two pre-generated credential JSON files in `sdk/public/credentials/`. The SDK loads them via `fetch()`.
   - What's unclear: Whether to show a file picker (user uploads credential) or auto-load the demo credentials.
   - Recommendation: For the hackathon demo, auto-load the demo credentials from `public/credentials/` and show them in the Credential Wallet view. Add a "Load Credential" button that opens a file picker for custom credential JSON files. This gives the best demo experience (pre-loaded credentials) while showing extensibility.

## Sources

### Primary (HIGH confidence)
- **SDK source code** (audited in full): `sdk/src/index.ts`, `sdk/src/types.ts`, `sdk/src/config.ts`, `sdk/src/wallet.ts`, `sdk/src/submitter.ts`, `sdk/src/reader.ts`, `sdk/src/prover.ts`, `sdk/src/init.ts`, `sdk/src/credentials.ts`, `sdk/vite.config.ts`, `sdk/package.json` -- complete API surface and configuration verified
- **Phase 5 SUMMARY** (`05-01-SUMMARY.md`) -- SDK architecture decisions: vite-plugin-node-polyfills 0.25.0, bb.js excluded from optimizeDeps, WASM served from public/, pino ESM shim
- **Phase 6 SUMMARY** (`06-01-SUMMARY.md`, `06-02-SUMMARY.md`) -- COEP changed to credentialless, inline flattenPublicInputs, Contract constructor v8 options object, minimal inlined ABI with u256 struct
- **[Tailwind CSS v4 Vite installation](https://tailwindcss.com/docs)** -- `@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS, zero config
- **[React Router v7 modes](https://reactrouter.com/start/modes)** -- Library mode with `createBrowserRouter` for SPAs
- **[MDN: Cross-Origin-Embedder-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)** -- `credentialless` browser support: Chrome 96+, no Safari, partial Firefox
- **[Can I Use: COEP credentialless](https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy_credentialless)** -- Browser compatibility data
- **Starkscan Sepolia** -- Transaction URL format: `https://sepolia.starkscan.co/tx/{txHash}`
- **[Vite Getting Started](https://vite.dev/guide/)** -- Vite 6 requires Node.js 20.19+, 22.12+; `@vitejs/plugin-react` v5.1.x
- **[@vitejs/plugin-react npm](https://www.npmjs.com/package/@vitejs/plugin-react)** -- v5.1.4 latest, supports React 19 and Vite 6

### Secondary (MEDIUM confidence)
- **[web.dev: COOP/COEP cross-origin isolation](https://web.dev/articles/coop-coep)** -- SharedArrayBuffer requires cross-origin isolation; COEP `credentialless` enables it without `require-corp` constraints on cross-origin resources
- **[Chrome Blog: COEP credentialless](https://developer.chrome.com/blog/coep-credentialless-origin-trial)** -- Explanation of `credentialless` mode for easier cross-origin isolation adoption
- **[coi-serviceworker GitHub](https://github.com/gzuidhof/coi-serviceworker)** -- Service worker approach for COOP/COEP on static hosting (GitHub Pages fallback)
- **[React useReducer docs](https://react.dev/reference/react/useReducer)** -- useReducer for complex related state in React 19
- **[React Managing State guide](https://react.dev/learn/managing-state)** -- Official guide on state management patterns

### Tertiary (LOW confidence)
- Safari `credentialless` COEP timeline -- Apple has not announced plans to implement this. Assumption that Safari users will have degraded (single-threaded) proof performance is based on current browser support status.
- bb.js Web Worker behavior -- training data suggests bb.js uses Workers for multi-threaded proving when SharedArrayBuffer is available, but specific Worker architecture details are not documented.
- React Router v7 + COOP interaction -- no documentation or reports of conflicts found, assumed safe based on client-side-only routing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified from npm, official docs, and compatibility with existing SDK Vite 6 setup
- Architecture: HIGH -- SDK API surface fully audited from source code; React patterns are standard useState/useContext/lazy loading
- COOP/COEP browser compat: HIGH -- MDN and Can I Use provide authoritative browser support data
- Pitfalls: HIGH -- Most pitfalls derive from documented Phase 5/6 decisions (COEP credentialless, pino shim, bb.js exclusion) and verified browser compatibility data
- Open questions: MEDIUM -- UI thread blocking and Tailwind/alias interactions need runtime testing

**Research date:** 2026-02-15
**Valid until:** 2026-02-22 (7 days -- stable dependencies; React 19 and Tailwind v4 are mature releases)
