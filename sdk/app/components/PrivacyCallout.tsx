/**
 * PrivacyCallout -- WEB-04 Privacy Annotation Component
 *
 * Displays context-aware privacy notices at key user touchpoints.
 * Contexts: credential loading, proof generation, and before on-chain submission.
 */

const MESSAGES: Record<PrivacyCalloutProps['context'], string> = {
  credential:
    'Your credential data stays on your device. It is never uploaded to any server.',
  proof:
    'Proof generation happens entirely in your browser. Only the ZK proof (not your data) will be shared.',
  submission:
    'Only the proof and public outputs go on-chain. Your actual age, identity, and credential details remain private.',
};

interface PrivacyCalloutProps {
  context: 'credential' | 'proof' | 'submission';
}

export default function PrivacyCallout({ context }: PrivacyCalloutProps) {
  return (
    <div
      role="note"
      aria-label="Privacy notice"
      className="flex items-start gap-2 rounded-lg border border-green-700/40 bg-green-950/30 px-4 py-3 text-sm text-green-300"
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        &#128274;
      </span>
      <span>{MESSAGES[context]}</span>
    </div>
  );
}
