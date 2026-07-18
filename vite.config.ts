import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// src/excal/host.tsx がJSXを使う(ExcalidrawのReactホスト、CLAUDE.md参照)ため、
// プロジェクト全体の.tsx変換用に @vitejs/plugin-react を有効化する。
// アプリ本体のUI(ツールバー・エディタ・パネル)はReactを使わずVanilla TSのままにする
// (この設定はhost.tsx以外のファイルの挙動には影響しない)。
export default defineConfig({
  plugins: [react()],
});
