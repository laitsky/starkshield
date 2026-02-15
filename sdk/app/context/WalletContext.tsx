import { createContext, useState, useCallback, type ReactNode } from 'react';
import {
  connectWallet as sdkConnect,
  disconnectWallet as sdkDisconnect,
  type WalletState,
} from '../../src/index';
import type { WalletAccount } from 'starknet';

export interface WalletContextValue {
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
