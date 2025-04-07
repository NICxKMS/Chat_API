import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 3003,          // Dev server port
    host: 'localhost',   // Use '0.0.0.0' to expose on LAN
    strictPort: true,
    fs: {
      allow: ['..']      // Allows access outside root if needed
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3003,        // Must match `server.port` for WebSocket to work correctly
      clientPort: 3003   // Client also connects to this port
    }
  }
});
