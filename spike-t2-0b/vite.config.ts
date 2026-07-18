import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

// T2-0bスパイク専用のVite設定。本実装のvite.config(存在しない=デフォルト設定)とは無関係。
// 別ポートで起動し、本実装のindex.html/src/main.tsには一切触れない。
export default defineConfig({
  root: dir,
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: true,
  },
});
