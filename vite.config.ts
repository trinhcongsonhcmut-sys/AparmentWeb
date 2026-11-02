import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5175,
    host: true,
    watch: {
      usePolling: true,
    },
  },
  build: {
    target: 'esnext',
  },
});
 