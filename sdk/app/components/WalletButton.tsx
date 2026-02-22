import { useWallet } from '../hooks/useWallet';

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + '\u2026' + addr.slice(-4);
}

export default function WalletButton() {
  const { walletAccount, walletState, connecting, connect, disconnect } = useWallet();

  if (connecting) {
    return (
      <button
        disabled
        className="btn-secondary flex items-center gap-2.5 !py-2 !px-4 !text-xs"
      >
        <span className="inline-block h-2.5 w-2.5 bg-[var(--color-accent)]" />
        <span className="text-[var(--color-text-2)]">Connecting...</span>
      </button>
    );
  }

  if (walletAccount && walletState) {
    return (
      <button
        onClick={disconnect}
        className="group btn-secondary flex items-center gap-2.5 !py-2 !px-4 !text-xs"
      >
        <span className="inline-block h-2.5 w-2.5 bg-[var(--color-green)] group-hover:bg-[var(--color-red)] transition-colors duration-150" />
        <span className="font-mono text-[var(--color-text)] group-hover:text-[var(--color-red)] transition-colors duration-150">
          {truncateAddress(walletState.address)}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      className="btn-primary !py-2 !px-5 !text-xs flex items-center gap-2"
    >
      Connect Wallet
    </button>
  );
}
