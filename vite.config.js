import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // cloudflare tunnel のサブドメイン全般を許可
    allowedHosts: ['.trycloudflare.com'],
    
    // または全ホストを許可したい場合はこちら:
    // allowedHosts: true,
  },
});