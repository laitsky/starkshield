/**
 * WASM Initialization Gate
 *
 * Initializes noir_js ACVM and noirc_abi WASM modules.
 * Must be called before any circuit execution or proof generation.
 */

import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';
import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';

let initialized = false;

/**
 * Initialize WASM modules for noir_js circuit execution.
 * Safe to call multiple times -- subsequent calls are no-ops.
 */
export async function initWasm(): Promise<void> {
  if (initialized) return;
  await Promise.all([initACVM(fetch(acvm)), initNoirC(fetch(noirc))]);
  initialized = true;
}
