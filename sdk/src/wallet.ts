/**
 * StarkShield SDK Wallet Connection Module
 *
 * Connects to ArgentX or Braavos wallet via get-starknet v4 modal.
 * Uses WalletAccount for transaction signing (private key stays in wallet).
 */

import { connect, disconnect } from '@starknet-io/get-starknet';
import { WalletAccount } from 'starknet';
import { SEPOLIA_RPC_URL } from './config';
import type { WalletState } from './types';

let currentWalletAccount: WalletAccount | null = null;

/**
 * Connect to a Starknet wallet (ArgentX or Braavos).
 * Opens the get-starknet modal for wallet selection.
 * Returns WalletAccount for transaction signing.
 */
export async function connectWallet(): Promise<{
  walletAccount: WalletAccount;
  state: WalletState;
}> {
  const selectedWallet = await connect({
    modalMode: 'alwaysAsk',
    modalTheme: 'dark',
  });

  if (!selectedWallet) {
    throw new Error(
      'No wallet selected. User cancelled or no wallets installed.',
    );
  }

  // Create WalletAccount -- private key stays in wallet extension.
  // Type assertion needed: get-starknet v4 exports StarknetWindowObject from
  // @starknet-io/types-js while starknet.js v8 uses @starknet-io/starknet-types-09.
  // The interfaces are structurally identical.
  const walletAccount = await WalletAccount.connect(
    { nodeUrl: SEPOLIA_RPC_URL },
    selectedWallet as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  );

  currentWalletAccount = walletAccount;

  const state: WalletState = {
    address: walletAccount.address,
    chainId: await walletAccount.getChainId(),
    connected: true,
  };

  return { walletAccount, state };
}

/**
 * Disconnect the current wallet.
 */
export async function disconnectWallet(): Promise<void> {
  await disconnect();
  currentWalletAccount = null;
}

/**
 * Get the current WalletAccount if connected.
 */
export function getWalletAccount(): WalletAccount | null {
  return currentWalletAccount;
}
