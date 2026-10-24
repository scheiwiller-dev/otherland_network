import { defineConfig } from 'vite';
import environment from 'vite-plugin-environment';
import dotenv from 'dotenv';
import { viteStaticCopy } from 'vite-plugin-static-copy';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Keep three/webgpu prebundled when experimenting with WebGPU; define globals via rolldown.
    include: ['three/webgpu'],
    rolldownOptions: {
      transform: {
        define: {
          global: 'globalThis',
        },
      },
    },
  },
  server: {
    // proxy: {
    //  "/api": {
    //    target: "http://127.0.0.1:8000",
    //    changeOrigin: true,
    //  },
    //},
  },
  publicDir: "assets",
  plugins: [
    environment("all", { prefix: "ICP_" }),
    viteStaticCopy({
      targets: [
        {
          src: '.ic-assets.json5',
          dest: '.'
        }
      ]
    })
  ],
  define: {
    'process.env.ICP_CLI_NETWORK': JSON.stringify(process.env.ICP_CLI_NETWORK || 'local'),
    'process.env.ICP_CLI_CID_USER_NODE': JSON.stringify(process.env.ICP_CLI_CID_USER_NODE || ''),
    'process.env.ICP_CLI_CID_CARDINAL': JSON.stringify(process.env.ICP_CLI_CID_CARDINAL || ''),
    'process.env.ICP_CLI_CID_OTHERLAND_CLIENT': JSON.stringify(process.env.ICP_CLI_CID_OTHERLAND_CLIENT || ''),
  },
  resolve: {
    dedupe: ['@icp-sdk/core'],
  },
});