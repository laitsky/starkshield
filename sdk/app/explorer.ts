const VOYAGER_SEPOLIA_BASE_URL = 'https://sepolia.voyager.online';

function normalizeTxHash(txHash: string): string {
  const trimmed = txHash.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    return `0x${trimmed.slice(2)}`;
  }
  return `0x${trimmed}`;
}

export function buildVoyagerTxUrl(txHash: string): string {
  return `${VOYAGER_SEPOLIA_BASE_URL}/tx/${normalizeTxHash(txHash)}`;
}
