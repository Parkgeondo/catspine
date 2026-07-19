import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the bundle works wherever the mini-app CDN mounts it.
  base: './',
  server: {
    port: 5173,
  },
});
