import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@noir-lang/acvm_js': path.resolve(
        __dirname,
        'node_modules/@noir-lang/acvm_js/web/acvm_js.js',
      ),
      '@noir-lang/noirc_abi': path.resolve(
        __dirname,
        'node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm.js',
      ),
      pino: path.resolve(__dirname, 'src/shims/pino.js'),
    },
  },
  optimizeDeps: {
    exclude: ['@aztec/bb.js'],
  },
  build: {
    target: 'esnext',
  },
  assetsInclude: ['**/*.wasm'],
});
