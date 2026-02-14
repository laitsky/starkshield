# Feature Research

**Domain:** ZK Credential Verification Protocol on Starknet (Hackathon Submission)
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH

## Context

StarkShield is competing in the **Re{define} Hackathon** Privacy Track (Feb 1-28, 2026; $9,675 STRK prize pool). Submissions require: GitHub repo, demo video (max 3 min), Starknet deployment link. Judges evaluate based on **impact and technical depth**. The hackathon explicitly lists "Prove attributes (age, membership) without revealing identity" as a curated idea -- StarkShield is a direct hit on this prompt.

No existing Starknet projects do credential verification. Competitors (Mist.cash, Tongo, 0xbow) focus on private transfers, confidential tokens, and privacy pools. StarkShield fills an unoccupied niche.

---

## Feature Landscape

### Table Stakes (Users/Judges Expect These)

Features that judges assume exist. Missing any of these = project feels incomplete or unserious.

#### Protocol Level (Circuits + Contracts)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Age threshold circuit** | Core use case. Hackathon curated idea says "prove age." A credential protocol without at least one working predicate circuit is a non-starter. | MEDIUM | Noir circuit: takes birthdate + threshold, proves age >= threshold without revealing birthdate. Pedersen hash commitment to credential data signed by issuer. |
| **On-chain proof verification** | Without on-chain verification, it is just a local computation -- not a protocol. Judges will check the deployed contract. | MEDIUM | Use Garaga SDK to auto-generate Cairo verifier from Noir circuit. UltraHonk with Keccak ZK mode. Deploy to Starknet Sepolia. |
| **Credential issuer signature scheme** | Credentials must come from a trusted source. Without issuer signatures, anyone can fabricate credentials. | MEDIUM | Issuer signs credential data hash (Pedersen). Circuit verifies signature matches known issuer public key. Demo script issues test credentials. |
| **Verification result registry** | Judges need to see the on-chain artifact. A contract that records "address X proved attribute Y" without storing the raw data. | LOW | Simple Cairo mapping: address -> verification_status. No raw data stored. Emits events for dashboard consumption. |
| **Public inputs / private inputs separation** | Fundamental ZK pattern. Public: threshold, issuer pubkey, result. Private: actual birthdate, credential data. Getting this wrong = privacy failure. | LOW | Noir enforces this at the language level. But the circuit design must be intentional about what leaks. |

#### User-Facing Level (Web App + UX)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Wallet connection (Starknet)** | Every Starknet dApp requires wallet connect. Without it, no on-chain interaction possible. | LOW | Use starknet-react with ArgentX / Braavos. Standard pattern, well-documented. |
| **Proof generation UI** | Users must be able to generate a proof from the browser. A CLI-only tool will not impress judges. | MEDIUM | Client-side Noir proof generation via @noir-lang/noir_js and @noir-lang/backend_barretenberg. User selects credential, clicks "Generate Proof," sees loading state, gets result. |
| **Verification submission flow** | Users need a clear path: select credential -> generate proof -> submit to chain -> see result. | MEDIUM | Multi-step wizard: (1) pick credential, (2) set parameters, (3) generate proof locally, (4) submit tx, (5) confirmation. |
| **Verification status display** | After submitting, users must see that verification succeeded on-chain. | LOW | Read from registry contract. Show badge/status indicator. Query events. |
| **Demo credential issuance** | Judges need to test the flow end-to-end. They will not have real credentials. A built-in way to get test credentials is essential. | LOW | "Get Demo Credential" button or script that issues a pre-signed credential to the connected wallet address. |
| **Demo video (max 3 min)** | Explicit submission requirement. Not optional. | LOW | Screen recording walking through: (1) get credential, (2) generate proof, (3) submit verification, (4) see on-chain result. Narrate clearly. |

### Differentiators (Competitive Advantage for Hackathon)

Features that separate winners from participants. Not required, but these are what make judges say "this is impressive."

#### High-Impact Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multiple credential types** (age + membership) | Shows the protocol is general-purpose, not a one-trick demo. Two circuits prove extensibility. The hackathon idea says "age, membership" -- doing both covers the full prompt. | MEDIUM | Second Noir circuit: membership proof via Merkle tree inclusion. User proves "I am in group X" without revealing which member. Reuses same verifier pattern. |
| **Selective disclosure** | Core privacy innovation. User proves "age >= 18" without revealing they are 25. Prove "Gold tier member" without revealing name. This is what ZK is FOR -- judges in a Privacy track will specifically look for this. | LOW (built into circuit design) | Not a separate feature -- it is the correct way to design the circuits. But must be explicitly called out in the demo. "Notice: the contract never learns Alice's actual birthday." |
| **Issuer registry contract** | Moves beyond "single hardcoded issuer" to a registry of trusted issuers. Shows protocol thinking, not just demo thinking. | LOW | Cairo contract with admin-managed list of approved issuer public keys. Verifier checks proof against registered issuers. Simple but architecturally significant. |
| **Visual proof flow with privacy callouts** | UX that explicitly highlights what data stays private at each step. Privacy track judges want to SEE the privacy, not just trust it exists. | MEDIUM | Annotated UI: "This data stays on your device" / "Only this boolean reaches the chain" / "The contract sees: VERIFIED, not your birthdate." Side-by-side: what the user sees vs. what the chain sees. |
| **Clean architecture + README** | Judges look at repos. Clean code with comments, clear project structure, well-formatted README with architecture diagram = stands out from rushed hackathon code. | LOW | Not a "feature" but a differentiator. Spend time on README, inline comments, and project organization. |

#### Medium-Impact Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Proof verification dashboard** | A public-facing page where anyone can see verification results (without private data). Shows the "verifier" side of the protocol, not just the "prover" side. | LOW | Read-only page listing on-chain verification events. Shows: address (truncated), credential type, verification result, timestamp. No private data exposed. |
| **Credential wallet view** | Users see their credentials as cards with clear metadata: issuer, type, expiry, attributes. Feels like a real product, not a tech demo. | MEDIUM | Card layout for each credential. Show issuer name, credential type, issuance date. "Generate Proof" button on each card. |
| **Multi-step UX with progress indicators** | Proof generation takes seconds. Users need feedback: "Compiling circuit... Generating proof... Submitting to Starknet... Verified!" Without this, the app feels broken during proof generation. | LOW | Loading states, progress bar or step indicator. Toast notifications on success/failure. Critical for demo video quality. |
| **Error handling for proof failures** | Graceful handling when proof generation fails (e.g., age < threshold). Shows robustness. | LOW | "Proof generation failed: you do not meet the age requirement" vs. a cryptic error. Judges will try edge cases. |

### Anti-Features (Deliberately NOT Building)

Features that seem appealing but are traps for a 2-week hackathon. Building these will consume time without proportional impact.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real KYC/identity provider integration** | "Connect to a real government ID system for authentic credentials" | Requires API partnerships, legal agreements, compliance review. Impossible in 2 weeks. Distracts from the ZK protocol, which is the actual innovation. | Demo credential issuer script that simulates a trusted authority. Judges understand this is a hackathon. |
| **Cross-chain credential portability** | "Verify credentials across Ethereum, Starknet, and other chains" | Requires bridge infrastructure, multiple contract deployments, cross-chain message passing. Massive scope increase for minimal demo value. | Focus on Starknet-native verification. Mention cross-chain as future work in README. |
| **Credential revocation system** | "Issuers should be able to revoke credentials" | Requires revocation registry (on-chain Merkle tree of revoked credentials), circuit modifications to check non-revocation, additional contract complexity. Important for production but overkill for hackathon. | Document as "future work." Credentials in demo are valid by default. |
| **Encrypted credential storage (on-chain)** | "Store encrypted credentials on IPFS/chain for user recovery" | Storage layer complexity, encryption key management, recovery flows. None of this showcases ZK innovation. | Credentials live in browser localStorage for the demo. Adequate for a prototype. |
| **Mobile app / React Native** | "Users should verify credentials on mobile" | Separate build target, mobile-specific proof generation challenges (WASM performance on mobile Safari), doubled QA surface. | Responsive web app that works on mobile browsers. Demo on desktop for video. |
| **Custom proving backend** | "Build our own STARK prover for credentials" | Garaga + Barretenberg already solve this. Building a custom prover is months of work with no hackathon value. | Use Garaga SDK for Cairo verifier generation. Use Barretenberg for client-side proving. This IS the recommended path. |
| **Governance / DAO for issuer management** | "Decentralized governance for who can issue credentials" | Token design, voting mechanisms, timelock contracts. Massive scope for a governance feature nobody will test in a demo. | Admin-managed issuer registry. Single admin key for the hackathon. |
| **Privacy pools / mixer integration** | "Combine credential verification with private transfers" | Different problem domain (Mist.cash, 0xbow territory). Muddies the credential verification narrative. | Stay focused: StarkShield does credential verification. Privacy pools are a different project. |
| **Recursive proof composition** | "Compose multiple credential proofs into one" | Recursive proofs in Noir/Barretenberg are bleeding-edge. High risk of toolchain bugs. Circuit complexity explodes. | Verify each credential type independently. Two separate proofs is fine for a demo. |

---

## Feature Dependencies

```
[Credential Issuer Signature Scheme]
    |
    +--requires--> [Age Threshold Circuit]
    |                   |
    |                   +--requires--> [On-Chain Proof Verification (Garaga)]
    |                                       |
    |                                       +--requires--> [Verification Result Registry]
    |                                                           |
    |                                                           +--enables--> [Verification Dashboard]
    |
    +--requires--> [Membership Circuit (Merkle Proof)]
                        |
                        +--requires--> [On-Chain Proof Verification (Garaga)]

[Wallet Connection]
    |
    +--enables--> [Proof Generation UI]
    |                 |
    |                 +--requires--> [Verification Submission Flow]
    |                                     |
    |                                     +--enables--> [Verification Status Display]
    |
    +--enables--> [Demo Credential Issuance]

[Issuer Registry Contract]
    +--enhances--> [Credential Issuer Signature Scheme]
    +--enhances--> [On-Chain Proof Verification]

[Credential Wallet View]
    +--enhances--> [Proof Generation UI]
    +--enhances--> [Demo Credential Issuance]

[Visual Privacy Callouts]
    +--enhances--> [Proof Generation UI]
    +--enhances--> [Demo Video Quality]
```

### Dependency Notes

- **Issuer Signature Scheme must exist before circuits:** Circuits verify issuer signatures over credential hashes. Without a signing scheme, circuits have nothing to verify against a trusted authority.
- **Garaga verifier generation depends on compiled Noir circuits:** Must have working Noir circuits before generating Cairo verifiers. Version compatibility between Garaga, Noir, and Barretenberg is critical (mismatched versions = verification failures).
- **Registry depends on verifier:** The registry records results from the verifier contract. Build verifier first, registry second.
- **All UI features depend on wallet connection:** Standard web3 pattern. Wallet connection is the first thing to implement on the frontend.
- **Membership circuit is independent of age circuit:** Can be built in parallel. Both share the same Garaga verifier generation pattern.
- **Demo credential issuance is a UX dependency for judges:** Without demo credentials, judges cannot test the flow. Must be trivially easy to get test credentials.

---

## MVP Definition

### Launch With (Hackathon Submission)

Minimum viable submission that demonstrates the protocol concept end-to-end.

- [x] **Age threshold circuit in Noir** -- Core credential verification primitive. Proves age >= threshold without revealing birthdate.
- [x] **Issuer signature verification in circuit** -- Credentials are signed by a trusted issuer; circuit verifies signature.
- [x] **Cairo verifier via Garaga SDK** -- On-chain proof verification on Starknet Sepolia.
- [x] **Verification result registry contract** -- Stores verification results on-chain without private data.
- [x] **React SPA with wallet connect** -- Frontend for the demo flow.
- [x] **Client-side proof generation** -- Generate Noir proofs in the browser via Barretenberg WASM.
- [x] **Proof submission + on-chain verification flow** -- End-to-end: generate proof -> submit tx -> see result.
- [x] **Demo credential issuer script** -- Judges can get test credentials to try the flow.
- [x] **Demo video (max 3 min)** -- Explicit submission requirement.
- [x] **README with architecture overview** -- First thing judges see in the repo.

### Add After Core Works (Stretch Goals, Same Hackathon)

Features to add if core is solid and time remains. Ordered by impact-per-hour.

- [ ] **Membership circuit (Merkle proof)** -- Second credential type. Proves group membership. Shows protocol generality. Trigger: add when age circuit + verifier are deployed and working.
- [ ] **Issuer registry contract** -- Multi-issuer support. Trigger: add when single-issuer flow works end-to-end.
- [ ] **Credential wallet card UI** -- Visual credential management. Trigger: add when proof generation flow is working.
- [ ] **Privacy callout annotations** -- "What stays private" visual indicators. Trigger: add during demo video preparation phase.
- [ ] **Verification dashboard (public view)** -- Shows on-chain verification events. Trigger: add when at least one successful verification is on Sepolia.

### Future Consideration (Post-Hackathon)

Features to mention in README as "future work" but not build.

- [ ] **Credential revocation** -- Requires revocation registry and circuit modifications.
- [ ] **Cross-chain verification** -- Verify Starknet proofs on Ethereum or other chains.
- [ ] **Real identity provider integration** -- Connect to government ID or KYC providers.
- [ ] **Recursive proof composition** -- Combine multiple credential proofs into one.
- [ ] **Credential refresh / expiry** -- Dynamic credentials per W3C spec (as Privado ID implemented).
- [ ] **Soulbound verification tokens** -- Mint non-transferable NFTs as proof of verification.

---

## Feature Prioritization Matrix

| Feature | User/Judge Value | Implementation Cost | Priority |
|---------|-----------------|---------------------|----------|
| Age threshold circuit | HIGH | MEDIUM | **P1** |
| Issuer signature in circuit | HIGH | MEDIUM | **P1** |
| Cairo verifier (Garaga) | HIGH | MEDIUM | **P1** |
| Verification registry contract | HIGH | LOW | **P1** |
| Wallet connection | HIGH | LOW | **P1** |
| Client-side proof generation | HIGH | MEDIUM | **P1** |
| Proof submission flow | HIGH | MEDIUM | **P1** |
| Demo credential issuer | HIGH | LOW | **P1** |
| Demo video | HIGH | LOW | **P1** |
| README + docs | HIGH | LOW | **P1** |
| Membership circuit | HIGH | MEDIUM | **P2** |
| Issuer registry contract | MEDIUM | LOW | **P2** |
| Credential wallet card UI | MEDIUM | MEDIUM | **P2** |
| Privacy callout annotations | HIGH | LOW | **P2** |
| Verification dashboard | MEDIUM | LOW | **P2** |
| Error handling / edge cases | MEDIUM | LOW | **P2** |
| Credential revocation | LOW (hackathon) | HIGH | **P3** |
| Cross-chain verification | LOW (hackathon) | HIGH | **P3** |
| Real KYC integration | LOW (hackathon) | HIGH | **P3** |
| Soulbound verification tokens | LOW | MEDIUM | **P3** |

**Priority key:**
- **P1:** Must have for submission. Without these, the project is incomplete.
- **P2:** Should have. Each one meaningfully improves judge impression. Add in order of impact-per-hour.
- **P3:** Do not build. Mention in README as future work.

---

## Competitor Feature Analysis

| Feature | Privado ID (Polygon) | zkPass | zkMe | Semaphore | **StarkShield (Ours)** |
|---------|---------------------|--------|------|-----------|----------------------|
| **Chain** | Polygon/multi-chain | Multi-chain | Multi-chain | Ethereum | **Starknet (only one here)** |
| **Age verification** | Yes (predicate proofs) | Yes (via TransGate) | Yes (zkKYC) | No (group membership only) | **Yes (Noir circuit)** |
| **Membership proof** | Yes (group credentials) | No | No | **Yes (core feature)** | **Yes (Merkle proof circuit)** |
| **Selective disclosure** | Yes (private proof + SD modes) | Yes (field-level) | Yes | No (binary membership) | **Yes (circuit-level)** |
| **On-chain verification** | Yes (EVM contracts) | Yes (EVM contracts) | Yes (EVM contracts) | Yes (EVM contracts) | **Yes (Cairo contracts via Garaga)** |
| **Browser proof generation** | Yes (wallet SDK) | Yes (TransGate extension) | Yes | Yes (JS SDK) | **Yes (Barretenberg WASM)** |
| **Real identity sources** | Yes (W3C VCs from issuers) | Yes (any HTTPS site via MPC) | Yes (KYC providers) | No | **No (demo issuer only -- hackathon scope)** |
| **Credential wallet** | Yes (mobile app) | Yes (browser extension) | Yes | No | **Yes (web-based, simplified)** |
| **Dynamic credentials** | Yes (first implementation) | No | No | No | **No (future work)** |
| **STARK-based verification** | No (SNARKs) | No (SNARKs) | No (SNARKs) | No (SNARKs) | **Yes (SNARKs verified inside STARKs via Garaga -- unique)** |

### StarkShield's Unique Position

StarkShield is the **only credential verification protocol on Starknet**. While competitors operate on EVM chains, StarkShield brings this capability to the STARK ecosystem. The use of Garaga SDK creates a novel architecture: Noir ZK proofs (SNARKs) verified inside Cairo contracts (which themselves benefit from STARK-based L2 verification). This "SNARKs-in-STARKs" approach is technically interesting and directly relevant to the Privacy track narrative.

---

## Hackathon-Specific Judging Insights

Based on research into hackathon judging criteria (Midnight Summit 2025, Solana Privacy Hack 2026, Berkeley ZK Application Track, Chainlink hackathon guidance):

### What Privacy Track Judges Specifically Evaluate

1. **Real problem definition** -- "Can you explain in simple terms what problem you solve and why it matters?" StarkShield: "Prove you are 18+ to a smart contract without showing your ID."
2. **Meaningful use of privacy technology** -- Not just using ZK as a buzzword. The ZK must be essential to the solution, not bolted on. StarkShield: ZK IS the product.
3. **Technical depth** -- Working circuits, deployed contracts, real proofs. Not slides. Not mockups.
4. **End-to-end experience** -- From credential acquisition to on-chain verification. Judges will try the demo.
5. **Code quality and documentation** -- Clean repo, commented code, clear README with architecture diagram.
6. **Demo video quality** -- Clear narration, shows the working product, explains privacy guarantees. Max 3 minutes forces conciseness.
7. **Deployed on Starknet** -- Submission requires a deployment link. Must be on Sepolia.

### What Wins vs. What Loses

| Winners Do | Losers Do |
|-----------|-----------|
| Working end-to-end demo | Impressive slides, broken code |
| Explain privacy in simple terms | Assume judges understand ZK math |
| Show what data stays private | Claim "privacy" without demonstrating it |
| Clean, commented code | Spaghetti code with no README |
| Two working circuits > one over-engineered circuit | One ambitious circuit that does not compile |
| Deployed on Sepolia with link | "We ran out of time to deploy" |
| Concise 3-min video | 3 minutes of explaining architecture, 0 minutes of demo |

---

## Sources

- [Starknet Re{define} Hackathon](https://hackathon.starknet.org/) -- Privacy track details, curated ideas, prize pool, submission requirements (MEDIUM confidence, official source)
- [DoraHacks Re{define}](https://dorahacks.io/hackathon/redefine/detail) -- Submission platform, deadline Feb 28 (MEDIUM confidence)
- [Garaga Noir Verifier Docs](https://garaga.gitbook.io/garaga/smart-contract-generators/noir) -- Verifier generation workflow, UltraHonk ZK mode (HIGH confidence, official docs)
- [Starknet Blog: Noir on Starknet](https://www.starknet.io/blog/noir-on-starknet/) -- Garaga + Noir integration workflow (HIGH confidence, official)
- [Privado ID Features](https://docs.privado.id/docs/verifier/features/) -- Private proof vs. selective disclosure modes (MEDIUM confidence, official docs)
- [zkPass Documentation](https://docs.zkpass.org/overview/introduction) -- TransGate, browser proof generation, MPC architecture (MEDIUM confidence, official docs)
- [zkMe](https://www.zk.me/) -- zkKYC, compliance features, identity oracles (MEDIUM confidence, official site)
- [Semaphore Protocol](https://semaphore.pse.dev/) -- Anonymous group membership, signal protocol (HIGH confidence, official)
- [Zypherpunk Hackathon Review](https://hackernoon.com/zypherpunk-hackathon-2025-review-top-5-privacy-projects-that-will-disrupt-defi) -- Winning project patterns (LOW confidence, third-party)
- [Chainlink Hackathon Tips](https://blog.chain.link/blockchain-hackathon-tips/) -- Judging criteria, demo video guidance (MEDIUM confidence)
- [Midnight Summit Hackathon Criteria](https://midnight.network/blog/everything-you-need-to-know-for-the-2025-midnight-summit-hackathon) -- Privacy-specific judging rubric (MEDIUM confidence)
- [Berkeley ZK Application Track](https://rdi.berkeley.edu/zkp-web3-hackathon/tracks/zk_application_track/) -- ZK-specific evaluation criteria (MEDIUM confidence)
- [Noir by Example: ZK Age Verification](https://noir-by-example.org/gadgets/zk-age-verification/) -- Circuit implementation pattern (LOW confidence, domain unreachable at time of research)
- [OpenZeppelin: Building Safe Noir Circuits](https://www.openzeppelin.com/news/developer-guide-to-building-safe-noir-circuits) -- Circuit safety patterns (MEDIUM confidence)
- [EIP-5851: On-Chain Verifiable Credentials](https://eips.ethereum.org/EIPS/eip-5851) -- Standard for on-chain credential verification (HIGH confidence, EIP)

---
*Feature research for: ZK Credential Verification on Starknet (Hackathon)*
*Researched: 2026-02-14*
