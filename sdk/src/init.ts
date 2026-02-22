/**
 * WASM Initialization Gate
 *
 * Initializes noir_js ACVM and noirc_abi WASM modules.
 * Must be called before any circuit execution or proof generation.
 */

import initACVM from '@noir-lang/acvm_js';
import initNoirC from '@noir-lang/noirc_abi';
import { resolvePublicAsset } from './config';

let initialized = false;

/**
 * Initialize WASM modules for noir_js circuit execution.
 * Safe to call multiple times -- subsequent calls are no-ops.
 */
export async function initWasm(): Promise<void> {
  if (initialized) return;
  const acvmWasmUrl = resolvePublicAsset('wasm/acvm_js_bg.wasm');
  const noircAbiWasmUrl = resolvePublicAsset('wasm/noirc_abi_wasm_bg.wasm');
  await Promise.all([
    initACVM(fetch(acvmWasmUrl)),
    initNoirC(fetch(noircAbiWasmUrl)),
  ]);
  initialized = true;
}
