import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
    chunkSizeWarningLimit: 9000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@aztec/bb.js')) return 'zk-bbjs';
          if (id.includes('node_modules/@noir-lang/')) return 'zk-noir';
          if (id.includes('node_modules/garaga')) return 'zk-garaga';
          if (id.includes('node_modules/starknet')) return 'starknet-core';
          return undefined;
        },
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
});
