# PROGRESS

進捗チェックリストと申し送り。各タスク完了時にチェックを更新すること。

## チェックリスト

- [x] T0-1 プロジェクト初期化
- [x] T1-1 C4ブロックパーサ
- [x] T1-2 classDiagramパーサ
- [x] T1-3 統一モデル構築
- [ ] T2-0a elkjsスパイク
- [ ] T2-0b Excalidrawカメラ制御スパイク
- [ ] T2-1 エッジ射影
- [ ] T2-2 レイアウト+Excalidraw描画(L2固定)
- [ ] T2-3 カメラ(監視/Fit/正規化)
- [ ] T3-1 レベル判定(lod)
- [ ] T3-2 レベル切替+アンカー保存
- [ ] T4-1 CodeMirror+ライブ更新
- [ ] T4-2 エラーパネル+永続化+サンプルメニュー
- [ ] T5-1 エクスポート(exportToSvg/exportToBlob)
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
- (2026-07-18) **指揮者より: docs を v1.1(Excalidraw採用)に改訂済み。** 描画は自作SVGではなく
  Excalidraw(`@excalidraw/excalidraw` + Reactホスト)を使用する。上記チェックリストを v1.1 の
  タスク構成(T2-0a/T2-0b 分割、T2-2/T2-3/T3-2/T5-1 の内容変更)に更新した。実装セッションは
  着手前に必ず docs/01〜04 と CLAUDE.md を**再読込**すること(古いスナップショットを参照しない)。
  T1-1/T1-2 の成果はレンダラー非依存のため v1.1 でもそのまま有効。docs/01〜04 と CLAUDE.md が
  git 未追跡(untracked)のままなので、次のタスク着手時にまとめてコミットすること。
- (2026-07-18) docs/01〜04・CLAUDE.mdをコミット(`docs: v1.1(Excalidraw採用)設計ドキュメント一式`)。
- (2026-07-18) T1-3完了。`src/model/{types,build}.ts` を実装。設計書§4の階層構築規則
  (Context必須1件・Container/ComponentのBoundary結合・Enterprise_Boundary・classDiagramの
  code-of結合・alias重複は初出優先でerror・Boundary未解決はwarningで無視・Rel未解決aliasは
  その行のみerrorで無視)をすべて実装。T1-2申し送りどおり、`parseClassBlock.ts`のローカル型
  (`ClassBlockLine`等)を`parser/types.ts`へ統合し、`parseClassBlock.ts`からはre-exportする
  形にした(既存インポート経路を壊さないため)。`samples/internet-banking.ts`をSystem2・
  外部System2・Container3(うちspa/dbはL3未定義)・Component4・classDiagram2のフル版に拡張。
  ブロック処理順序はソース出現順ではなく「レベル順(Context→Container→Component→
  classDiagram)」に固定(前方参照のalias解決を単純化するための最単純解釈。仕様に順序の
  明記はなし)。`npm test`(7 test files / 61 tests 緑)・`tsc --noEmit`・`npm run lint`・
  `npm run build` すべて成功を確認。
