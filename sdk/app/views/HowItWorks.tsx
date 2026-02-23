import { NavLink } from 'react-router-dom';

export default function HowItWorks() {
  return (
    <div className="space-y-10 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-2">
        <span className="section-label">// How It Works</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">
          Privacy-Preserving Identity Verification
        </h1>
        <p className="text-sm text-[var(--color-text-2)] max-w-2xl leading-relaxed">
          StarkShield lets you prove identity attributes — like being over 18 or belonging to a group —
          without revealing the underlying data. Here's how the three-phase workflow operates.
        </p>
      </div>

      {/* Overview Callout */}
      <div className="warning-callout">
        <p className="text-xs font-bold uppercase tracking-wider mb-2">Three-Phase Overview</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-[var(--color-text-2)] leading-relaxed">
          <li><strong>Credential Issuance</strong> — A trusted issuer signs your attributes off-chain</li>
          <li><strong>Proof Generation</strong> — You generate a zero-knowledge proof locally in the browser</li>
          <li><strong>On-Chain Verification</strong> — The proof is verified by a Starknet smart contract</li>
        </ol>
      </div>

      {/* Phase 1 — Credential Issuance */}
      <div className="brutal-card-static space-y-4">
        <div className="space-y-1">
          <span className="section-label">// Phase 1</span>
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            Credential Issuance
          </h2>
        </div>
        <div className="space-y-3">
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">01</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              A trusted issuer verifies your real-world identity attributes (age, membership, etc.) off-chain.
            </span>
          </div>
          <div className="separator" />
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">02</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              The issuer creates a credential containing your attribute hash, salted for privacy, and signs it
              using <strong>Poseidon-Schnorr</strong> — a ZK-friendly signature scheme.
            </span>
          </div>
          <div className="separator" />
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">03</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              The signed credential JSON is stored <strong>locally on your device</strong>. The issuer never
              sees when or where you use it. No data leaves your machine until you choose to prove something.
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2 — Proof Generation */}
      <div className="brutal-card-static space-y-4">
        <div className="space-y-1">
          <span className="section-label">// Phase 2</span>
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            Proof Generation
          </h2>
        </div>
        <div className="space-y-3">
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">01</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              You select a credential and choose what to prove — e.g., "I am over 18" or "I belong to group X."
              The private attribute value <strong>never leaves the browser</strong>.
            </span>
          </div>
          <div className="separator" />
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">02</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              The Noir circuit is executed locally via a <strong>WASM-compiled Barretenberg prover</strong>,
              generating a zero-knowledge proof entirely in your browser.
            </span>
          </div>
          <div className="separator" />
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">03</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              The proof output includes only <strong>public signals</strong> — nullifier, threshold, issuer ID,
              and expiration — but never the underlying private data.
            </span>
          </div>
        </div>

        {/* Proof type comparison */}
        <div className="separator" />
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-3)]">Proof Types</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 p-3 border-2 border-[var(--color-border)] bg-[var(--color-bg)]">
            <span className="badge badge-age">Age</span>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Proves your age exceeds a given threshold (e.g., &ge; 18) without revealing exact age.
              Uses a <strong>comparison circuit</strong> with the threshold as a public input.
            </p>
          </div>
          <div className="space-y-2 p-3 border-2 border-[var(--color-border)] bg-[var(--color-bg)]">
            <span className="badge badge-membership">Membership</span>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Proves you belong to an authorized group via a <strong>set-hash check</strong>.
              The group set hash is public; your specific membership ID stays private.
            </p>
          </div>
        </div>
      </div>

      {/* Phase 3 — On-Chain Verification */}
      <div className="brutal-card-static space-y-4">
        <div className="space-y-1">
          <span className="section-label">// Phase 3</span>
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            On-Chain Verification
          </h2>
        </div>
        <div className="space-y-3">
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">01</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              You submit the proof to Starknet via your connected wallet. Only the proof and public inputs
              are sent — your private attributes are <strong>never transmitted</strong>.
            </span>
          </div>
          <div className="separator" />
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">02</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              The <strong>StarkShield smart contract</strong> verifies the proof on-chain using the embedded
              verification key. Invalid proofs are rejected at the contract level.
            </span>
          </div>
          <div className="separator" />
          <div className="data-row">
            <span className="text-[var(--color-text-3)] font-mono text-xs">03</span>
            <span className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Verified results are stored in an <strong>on-chain registry</strong>. Any dApp can query the
              registry to confirm a user's verified status without re-verification.
            </span>
          </div>
        </div>

        {/* Nullifier callout */}
        <div className="warning-callout">
          <p className="text-xs font-bold uppercase tracking-wider mb-1">Nullifier Explained</p>
          <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
            Each proof produces a <strong>deterministic nullifier</strong> derived from your credential and a
            secret salt. This prevents double-proving with the same credential while preserving your anonymity —
            verifiers see the nullifier but cannot link it back to your identity.
          </p>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="space-y-3">
        <span className="section-label">// Tech Stack</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="brutal-card-static space-y-2">
            <p className="text-sm font-extrabold text-[var(--color-text)]">Noir</p>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Domain-specific language for writing zero-knowledge circuits. StarkShield's age and membership
              circuits are written in Noir.
            </p>
          </div>
          <div className="brutal-card-static space-y-2">
            <p className="text-sm font-extrabold text-[var(--color-text)]">Barretenberg</p>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Aztec's proving backend compiled to WASM. Generates UltraPlonk proofs directly in the browser
              with no server round-trip.
            </p>
          </div>
          <div className="brutal-card-static space-y-2">
            <p className="text-sm font-extrabold text-[var(--color-text)]">Starknet</p>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              L2 blockchain used for on-chain proof verification and registry storage. Provides low-cost
              transactions with Ethereum-level security.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 pb-8">
        <NavLink to="/" className="btn-primary text-center">
          Try It Out
        </NavLink>
        <a
          href="https://github.com/laitsky/starkshield"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-center"
        >
          View Source on GitHub
        </a>
      </div>
    </div>
  );
}
