import { useWallet } from '../hooks/useWallet';

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export default function WalletButton() {
  const { walletAccount, walletState, connecting, connect, disconnect } = useWallet();

  if (connecting) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-400"
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
        Connecting...
      </button>
    );
  }

  if (walletAccount && walletState) {
    return (
      <button
        onClick={disconnect}
        className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 transition hover:border-red-500/50 hover:text-red-300"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
        {truncateAddress(walletState.address)}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      className="rounded-lg border border-violet-600 bg-violet-600/20 px-4 py-2 text-sm text-violet-300 transition hover:bg-violet-600/30"
    >
      Connect Wallet
    </button>
  );
}
