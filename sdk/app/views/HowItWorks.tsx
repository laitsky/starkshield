import { NavLink } from 'react-router-dom';

export default function HowItWorks() {
  return (
    <div className="space-y-12 animate-fade-in-up max-w-3xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <span className="section-label">// How It Works</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">
          Privacy-Preserving Identity Verification
        </h1>
        <p className="text-sm text-[var(--color-text-2)] leading-relaxed">
          StarkShield lets you prove identity attributes — like being over 18 or belonging to a group —
          without revealing the underlying data. Here's how the three-phase workflow operates.
        </p>
      </div>

      {/* Overview Callout */}
      <div className="warning-callout">
        <p className="text-xs font-bold uppercase tracking-wider mb-3">Three-Phase Overview</p>
        <ol className="list-decimal list-inside space-y-1.5 text-xs text-[var(--color-text-2)] leading-relaxed">
          <li><strong>Credential Issuance</strong> — A trusted issuer signs your attributes off-chain</li>
          <li><strong>Proof Generation</strong> — You generate a zero-knowledge proof locally in the browser</li>
          <li><strong>On-Chain Verification</strong> — The proof is verified by a Starknet smart contract</li>
        </ol>
      </div>

      {/* Phase 1 — Credential Issuance */}
      <div className="brutal-card-static p-6 space-y-5">
        <div className="space-y-1">
          <span className="section-label">// Phase 1</span>
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            Credential Issuance
          </h2>
        </div>
        <div className="space-y-0">
          <StepRow number="01">
            A trusted issuer verifies your real-world identity attributes (age, membership, etc.) off-chain.
          </StepRow>
          <StepRow number="02">
            The issuer creates a credential containing your attribute hash, salted for privacy, and signs it
            using <strong>Poseidon-Schnorr</strong> — a ZK-friendly signature scheme.
          </StepRow>
          <StepRow number="03" last>
            The signed credential JSON is stored <strong>locally on your device</strong>. The issuer never
            sees when or where you use it. No data leaves your machine until you choose to prove something.
          </StepRow>
        </div>
      </div>

      {/* Phase 2 — Proof Generation */}
      <div className="brutal-card-static p-6 space-y-5">
        <div className="space-y-1">
          <span className="section-label">// Phase 2</span>
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            Proof Generation
          </h2>
        </div>
        <div className="space-y-0">
          <StepRow number="01">
            You select a credential and choose what to prove — e.g., "I am over 18" or "I belong to group X."
            The private attribute value <strong>never leaves the browser</strong>.
          </StepRow>
          <StepRow number="02">
            The Noir circuit is executed locally via a <strong>WASM-compiled Barretenberg prover</strong>,
            generating a zero-knowledge proof entirely in your browser.
          </StepRow>
          <StepRow number="03" last>
            The proof output includes only <strong>public signals</strong> — nullifier, threshold, issuer ID,
            and expiration — but never the underlying private data.
          </StepRow>
        </div>

        {/* Proof type comparison */}
        <div className="border-t-2 border-[var(--color-border)] pt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-3)] mb-4">Proof Types</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 p-4 border-2 border-[var(--color-border)] bg-[var(--color-bg)]">
              <span className="badge badge-age">Age</span>
              <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
                Proves your age exceeds a given threshold (e.g., &ge; 18) without revealing exact age.
                Uses a <strong>comparison circuit</strong> with the threshold as a public input.
              </p>
            </div>
            <div className="space-y-2 p-4 border-2 border-[var(--color-border)] bg-[var(--color-bg)]">
              <span className="badge badge-membership">Membership</span>
              <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
                Proves you belong to an authorized group via a <strong>set-hash check</strong>.
                The group set hash is public; your specific membership ID stays private.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 3 — On-Chain Verification */}
      <div className="brutal-card-static p-6 space-y-5">
        <div className="space-y-1">
          <span className="section-label">// Phase 3</span>
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            On-Chain Verification
          </h2>
        </div>
        <div className="space-y-0">
          <StepRow number="01">
            You submit the proof to Starknet via your connected wallet. Only the proof and public inputs
            are sent — your private attributes are <strong>never transmitted</strong>.
          </StepRow>
          <StepRow number="02">
            The <strong>StarkShield smart contract</strong> verifies the proof on-chain using the embedded
            verification key. Invalid proofs are rejected at the contract level.
          </StepRow>
          <StepRow number="03" last>
            Verified results are stored in an <strong>on-chain registry</strong>. Any dApp can query the
            registry to confirm a user's verified status without re-verification.
          </StepRow>
        </div>

        {/* Nullifier callout */}
        <div className="warning-callout">
          <p className="text-xs font-bold uppercase tracking-wider mb-2">Nullifier Explained</p>
          <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
            Each proof produces a <strong>deterministic nullifier</strong> derived from your credential and a
            secret salt. This prevents double-proving with the same credential while preserving your anonymity —
            verifiers see the nullifier but cannot link it back to your identity.
          </p>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="space-y-4">
        <span className="section-label">// Tech Stack</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="brutal-card-static p-5 space-y-2">
            <p className="text-sm font-extrabold text-[var(--color-text)]">Noir</p>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Domain-specific language for writing zero-knowledge circuits. StarkShield's age and membership
              circuits are written in Noir.
            </p>
          </div>
          <div className="brutal-card-static p-5 space-y-2">
            <p className="text-sm font-extrabold text-[var(--color-text)]">Barretenberg</p>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              Aztec's proving backend compiled to WASM. Generates UltraPlonk proofs directly in the browser
              with no server round-trip.
            </p>
          </div>
          <div className="brutal-card-static p-5 space-y-2">
            <p className="text-sm font-extrabold text-[var(--color-text)]">Starknet</p>
            <p className="text-xs text-[var(--color-text-2)] leading-relaxed">
              L2 blockchain used for on-chain proof verification and registry storage. Provides low-cost
              transactions with Ethereum-level security.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-10">
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

function StepRow({
  number,
  children,
  last = false,
}: {
  number: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 py-4 ${
        !last ? 'border-b border-[var(--color-border)]' : ''
      }`}
    >
      <span className="text-[var(--color-text-3)] font-mono text-xs font-bold shrink-0 pt-0.5 w-6">
        {number}
      </span>
      <span className="text-sm text-[var(--color-text-2)] leading-relaxed">
        {children}
      </span>
    </div>
  );
}
