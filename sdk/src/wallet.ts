/**
 * StarkShield SDK Wallet Connection Module
 *
 * Connects to ArgentX or Braavos wallet via get-starknet v4 modal.
 * Uses WalletAccount for transaction signing (private key stays in wallet).
 */

import { connect, disconnect } from '@starknet-io/get-starknet';
import { WalletAccount } from 'starknet';
import { SEPOLIA_CHAIN_ID, SEPOLIA_RPC_URL, isSepoliaChainId } from './config';
import type { WalletState } from './types';

let currentWalletAccount: WalletAccount | null = null;
const SUPPORTED_WALLET_IDS = ['argentX', 'braavos'] as const;
const SUPPORTED_WALLET_ID_SET = new Set<string>(SUPPORTED_WALLET_IDS);
type WalletChainRequest = {
  request: (params: { type: string; params?: unknown }) => Promise<unknown>;
};

async function readWalletChainId(
  wallet: WalletChainRequest,
): Promise<string | null> {
  try {
    const chainId = await wallet.request({ type: 'wallet_requestChainId' });
    return typeof chainId === 'string' ? chainId : null;
  } catch {
    return null;
  }
}

export async function getWalletExtensionChainId(
  walletAccount: WalletAccount,
): Promise<string | null> {
  return readWalletChainId(walletAccount.walletProvider as WalletChainRequest);
}

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
    include: [...SUPPORTED_WALLET_IDS],
    sort: [...SUPPORTED_WALLET_IDS],
    modalMode: 'alwaysAsk',
    modalTheme: 'dark',
  });

  if (!selectedWallet) {
    throw new Error(
      'No wallet selected. User cancelled or no wallets installed.',
    );
  }

  if (!SUPPORTED_WALLET_ID_SET.has(selectedWallet.id)) {
    await disconnect({ clearLastWallet: true });
    throw new Error(
      `Unsupported wallet selected: ${selectedWallet.id}. Please use ArgentX or Braavos.`,
    );
  }

  const walletChainId = await readWalletChainId(
    selectedWallet as unknown as WalletChainRequest,
  );
  if (walletChainId && !isSepoliaChainId(walletChainId)) {
    await disconnect({ clearLastWallet: true });
    throw new Error(
      `Wrong wallet network: extension is on ${walletChainId}. Please switch ArgentX/Braavos to Starknet Sepolia (${SEPOLIA_CHAIN_ID}) and try again.`,
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
  const chainId = await walletAccount.getChainId();

  if (!isSepoliaChainId(chainId)) {
    currentWalletAccount = null;
    await disconnect();
    throw new Error(
      `Wrong network: connected to ${chainId}. Please switch wallet to Starknet Sepolia (${SEPOLIA_CHAIN_ID}) and try again.`,
    );
  }

  const state: WalletState = {
    address: walletAccount.address,
    chainId,
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
