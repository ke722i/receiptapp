import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ビルドの番号（ビルドした時刻）。公開した版を見分けるのに使う（src/utils/appUpdate.js）
const BUILD_ID = new Date().toISOString();

// ビルドのたびに dist/version.json を書き出す。開いたままのタブが、これを読んで、新しい版に気づく
const versionFilePlugin = () => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    // cloudflare tunnel のサブドメイン全般を許可
    allowedHosts: ['.trycloudflare.com'],

    // または全ホストを許可したい場合はこちら:
    // allowedHosts: true,
  },
});
