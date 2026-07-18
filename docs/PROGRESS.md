# PROGRESS

進捗チェックリストと申し送り。各タスク完了時にチェックを更新すること。

## チェックリスト

- [x] T0-1 プロジェクト初期化
- [x] T1-1 C4ブロックパーサ
- [x] T1-2 classDiagramパーサ
- [ ] T1-3 統一モデル構築
- [ ] T2-0 elkjsスパイク
- [ ] T2-1 エッジ射影
- [ ] T2-2 レイアウト+SVG描画(L2固定)
- [ ] T2-3 カメラ(パン/ズーム/Fit)
- [ ] T3-1 レベル判定(lod)
- [ ] T3-2 レベル切替+アンカー保存+遷移
- [ ] T4-1 CodeMirror+ライブ更新
- [ ] T4-2 エラーパネル+永続化+サンプルメニュー
- [ ] T5-1 エクスポート
- [ ] T5-2 性能確認+README+最終検証

## 申し送り

- (2026-07-18) T1-1完了。`src/parser/{types,splitBlocks,parseC4Block}.ts` を実装。設計書§5.2の
  対応表は `Person/System/Container/Component` の基底語 + `_Ext`/`Db`/`Queue` サフィックスの
  組み合わせを一律に分解する実装にし、表に載っていない組み合わせ(`ContainerDb_Ext`等)も
  同じ規則で解釈されるようにした(最も単純で一貫した解釈)。Boundaryは宣言行の時点で開始
  済み扱いとし、`{`単独行・行末どちらでも同じ挙動になるよう簡略化した。
- (2026-07-18) `npm run lint` は `docs/*.md` 4ファイルのPrettier整形警告により exit code 1に
  なるが、これはT1-1で新規作成した `src/parser/**` `tests/parser/**` とは無関係のdocs整形の
  既存事象(T1-1着手前から存在)。docsはスコープ外(§1作業原則「頼まれていないリファクタリング
  はしない」)のため今回は手を付けていない。`npx eslint .` は0件、`npx prettier --check src tests`
  も0件で、T1-1が追加したファイルはlint/format共にクリーンであることを確認済み。
- (2026-07-18) T1-2完了。`src/parser/parseClassBlock.ts` を実装(T1-1と並行実施のため、
  `parser/types.ts` には依存せず必要な型をファイル内にローカル定義。統合時の型整理は
  今後の課題として残る。class本体のfield/method分類、5種の矢印(`-->`/`--|>`/`*--`/`o--`/`..>`)、
  `%% code-of:` 指令値の保持をすべて実装しテストで確認済み)。
- (2026-07-18) T1-1着手前から `docs/*.md` がPrettier未整形のため `npm run lint` がexit 1に
  なる件を修正: `.prettierignore` に `docs` を追加(docsはコード成果物ではなくPrettier対象外
  とする方が実装指示書のスコープに合致するため)。修正後 `npm run lint` は全体で緑。
- (2026-07-18) T1-1・T1-2統合後、`npm test`(5 test files / 44 tests 緑)・`tsc --noEmit`・
  `npm run lint`・`npm run build` を通し検証し、すべて成功を確認。
