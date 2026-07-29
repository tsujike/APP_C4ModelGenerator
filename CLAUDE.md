# Mermarium(マーマリウム)

図をテキストで入力し、ブラウザ上のホワイトボードで閲覧するアプリ。**ズームイン/アウトすると閾値で描画レベルが切り替わるセマンティックズーム**が核機能。サーバー不要、Vite + Vanilla TypeScript。

- **Mermaidモード**(FR-7): 任意のMermaid記法の図を `%%L1`〜`%%L8` マーカーでレベル別に登録して切り替える(L1〜L8)。
- **C4モード**: C4モデル(Context/Containers/Components/Code)をMermaid C4記法サブセット+拡張で書くと L1〜L4 を自動生成する(C4は4階層しか定義しないため L5 以降は無い / FR-7.9)。

アプリ名は post-v1.0 に「C4 Model Whiteboard Viewer」から **Mermarium**(Mermaid + aquarium の造語)へ変更した。
**リポジトリ名・フォルダ名・localStorageキーは変更していない**(`APP_C4ModelGenerator` / `c4-model-whiteboard-viewer:*`)。
localStorageキーを変えるとユーザーの保存済みソースとタイトルが失われるため、改名しないこと。

## ドキュメント(実装前に必読)

1. `docs/01_要件定義書.md` — 何を作るか。受入基準はここ(§7)
2. `docs/02_アーキテクチャ設計書.md` — どう作るか。DSL仕様・データモデル・射影/LODアルゴリズム
3. `docs/03_実装フェーズ計画.md` — Phase 0〜5 と各完了条件
4. `docs/04_実装指示書.md` — **実装エージェントはまずこれ**。タスク分解(T0-1〜T5-2)と作業原則
5. `docs/PROGRESS.md` — 進捗チェックリストと申し送り(T0-1で作成)

## 実装エージェントへのルール(要約)

- タスク番号順に実施。1タスクのスコープ外のことをしない(リファクタ・機能追加・先回り抽象化の禁止)。
- 完了条件は客観的証拠(テスト・実表示)で確認してから完了とする。
- 各タスク完了で PROGRESS.md のチェックを更新。仕様の曖昧さは最単純解釈で実装し「申し送り」に記録。
- 仕様の正: 要件定義書 > 設計書 > 指示書。矛盾を見つけたら申し送りに記録。

## コマンド(Phase 0 完了後)

```bash
npm run dev    # 開発サーバー
npm test       # vitest
npm run build  # 静的ビルド
npm run lint
```

## 技術スタック固定事項

- Vite / TypeScript strict / vitest / ESLint+Prettier
- レイアウト: elkjs、描画キャンバス: Excalidraw(`@excalidraw/excalidraw`。Mermaid.jsに描画させない)
  - post-v1.0の**Mermaidモード**(FR-7 / 設計書§13)でもこの原則は不変: Mermaidにはレイアウト計算のみをさせ、
    その結果を `@excalidraw/mermaid-to-excalidraw` でExcalidraw要素へ変換し、描くのは従来どおりExcalidraw。
    唯一の例外は同ライブラリがネイティブ変換に対応しない図(`subgraph`付き`flowchart`・`classDiagram`)で、
    この場合のみ1枚のラスタ画像として貼られる(Kenny承認済み。C4モードの描画経路は不変)
- react/react-dom は Excalidraw のホストとしてのみ同梱し、`src/excal/host.tsx` に閉じる
- Excalidrawカメラ制御の成立は T2-0b スパイクで最初に検証する。不成立なら実装を止めて指揮者に報告(設計書§12の自作SVG案へ回帰判断)
- エディタ: CodeMirror 6(Phase 4から。それまでtextarea)
- アプリUIへのUIフレームワーク・状態管理ライブラリは導入しない
