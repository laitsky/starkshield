/**
 * PrivacyCallout -- WEB-04 Privacy Annotation Component
 *
 * Displays context-aware privacy notices at key user touchpoints.
 * Contexts: credential loading, proof generation, and before on-chain submission.
 */

const MESSAGES: Record<PrivacyCalloutProps['context'], { text: string; detail: string }> = {
  credential: {
    text: 'Data stays on your device',
    detail: 'Your credential data is never uploaded to any server.',
  },
  proof: {
    text: 'Browser-local computation',
    detail: 'Proof generation happens entirely in your browser. Only the ZK proof is shared.',
  },
  submission: {
    text: 'Privacy preserved on-chain',
    detail: 'Only the proof and public outputs go on-chain. Your identity remains private.',
  },
};

interface PrivacyCalloutProps {
  context: 'credential' | 'proof' | 'submission';
}

export default function PrivacyCallout({ context }: PrivacyCalloutProps) {
  const msg = MESSAGES[context];

  return (
    <div
      role="note"
      aria-label="Privacy notice"
      className="brutal-card-static animate-fade-in p-4"
      style={{ borderLeftWidth: '4px', borderLeftColor: 'var(--color-green)' }}
    >
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-green)]">
          {msg.text}
        </p>
        <p className="text-xs text-[var(--color-text-3)] leading-relaxed font-mono">
          {msg.detail}
        </p>
      </div>
    </div>
  );
}
