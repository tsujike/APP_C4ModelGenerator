# PROGRESS

進捗チェックリストと申し送り。各タスク完了時にチェックを更新すること。

## チェックリスト

- [x] T0-1 プロジェクト初期化
- [x] T1-1 C4ブロックパーサ
- [x] T1-2 classDiagramパーサ
- [x] T1-3 統一モデル構築
- [x] T2-0a elkjsスパイク
- [x] T2-0b Excalidrawカメラ制御スパイク
- [x] T2-1 エッジ射影
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
- (2026-07-18) **T2-0b完了。設計の前提は成立** — Excalidrawの `onChange` によるzoom/scroll監視、
  および `updateScene` による要素+カメラの一括プログラム制御の両方が実際に動作することを
  ブラウザ実行で確認した。§12(自作SVGレンダラー)への回帰は不要と判断。
  - 依存追加(バージョン固定、`^`なし): `@excalidraw/excalidraw@0.18.1` / `react@19.2.7` /
    `react-dom@19.2.7`(いずれも本実装 `dependencies`。T2-2以降で実際に使う)。
    devDependenciesに `@vitejs/plugin-react@6.0.3`(ビルドツール)、および型検査用に
    `@types/react@19.2.17` / `@types/react-dom@19.2.3` / `@types/node@26.1.1` を追加。
  - 使い捨てページ `spike-t2-0b/`(`index.html` + `main.tsx` + 専用 `vite.config.ts`/
    `tsconfig.json`)を作成。本実装 `src/` `index.html` には未変更。`eslint.config.js` の
    `ignores` と `.prettierignore` に `spike-t2-0b` を追加してlint/format対象外にした
    (指示書どおり)。tsconfigの `include` は元々 `["src","tests"]` のみのため、
    `spike-t2-0b/` は本実装の `tsc --noEmit`/`npm run build` に一切影響しない。
  - 検証はPlaywright(このクラウド環境の `/opt/pw-browsers/chromium-1194`)でヘッドレス
    Chromiumを起動し、`vite --config spike-t2-0b/vite.config.ts`(port 5183)で実行して確認:
    - (1) 成立。`viewModeEnabled: true` でプログラム生成した矩形2つ(rectangle)+矢印1つ
      (arrow、ラベル付き)が初期表示され、編集モード時に出るツールバー(`.App-toolbar`=
      形状選択パレット等)は存在しない(count 0)ことを確認。スクリーンショット
      `/tmp/t2-0b-01-initial.png` で図形とラベルが正しく表示されているのを目視確認済み
      (エージェントの応答内で提示済み)。
    - (2) 成立。ページ上部のデバッグ表示(`appState.zoom.value`/`scrollX`/`scrollY`)は
      初期値 `zoom=1.0000, scrollX=0.00, scrollY=0.00`。Excalidrawキャンバス上で
      Ctrl+wheelによるズーム操作(Playwrightで実発火)後、`onChange` 経由で
      `zoom=3.4752`(Excalidraw純正のズーム%表示「348%」と一致)、その後の素のwheelパン
      操作でも `scrollX/scrollY` が追従して変化することを確認(スクリーンショット
      `/tmp/t2-0b-02-after-zoom.png`)。
    - (3) 成立。「テスト実行」ボタン押下で `excalidrawAPI.updateScene({ elements, appState:
      { scrollX, scrollY, zoom } })` を1回呼び出し、矩形の位置・色・ラベルの変更(要素側)
      と `zoom=1.8000`(=180%)/`scrollX=-150.00`/`scrollY=-200.00`(カメラ側)が同時に
      画面へ反映されることを確認(スクリーンショット `/tmp/t2-0b-03-after-updatescene.png`)。
      中間状態(要素だけ変わってカメラが古いまま等)は観測されず、設計書§8.3の「1回の
      updateSceneで要素とカメラを同時適用」という前提を裏付けた。
  - 補足: ブラウザコンソールに `esm.sh` からのExcalifontフォント取得失敗ログが出るが、
    これはこのサンドボックス環境のアウトバウンド制限によるCDN到達不可が原因の見た目上の
    フォールバック(デフォルトフォントで代替描画)であり、上記(1)〜(3)の判定・
    `updateScene`/`onChange` の成立性そのものには影響しない。
  - 依存追加後 `npm test`(7 test files / 61 tests 緑)・`npx tsc --noEmit`・`npm run lint`・
    `npm run build`(本実装分)すべて成功を再確認済み。
  - 残課題・申し送り: T2-2実装時、フォントCDN(esm.sh)が到達できない実行環境では
    Excalifont以外へのフォールバックになる点に留意(機能面は無影響、見た目のみ)。
    `spike-t2-0b/` はこのタスクの証跡として残置(本実装に組み込まない指示のとおり)。
- (2026-07-18) **T2-0a完了。入れ子レイアウトは成立。** 使い捨てスクリプト(`/tmp/elkjs-spike.mjs`、
  リポジトリ外・コミット対象外)で、境界ノード1つに子ノード2つ+境界内エッジ1本、境界をまたぐ
  エッジ2本という2階層構成を `elk.hierarchyHandling: 'INCLUDE_CHILDREN'` でレイアウトし、
  全ノード(親・子とも)の座標(x,y,width,height)とエッジのルーティング情報(sections)が
  取得できることを確認した。
  - **重要な仕様確認**: 子ノードの `x,y` は**親のローカル座標系**(親の左上原点からの相対値)
    であり絶対座標ではない。絶対座標を得るには祖先ノードの座標を再帰的に加算する必要がある
    (実測値で検算し一致を確認)。エッジの `sections` も、どのノードの `edges` 配列に属するか
    (`container`フィールド)によって座標系が変わる(境界内エッジ=ローカル、ルート直下エッジ=
    実質グローバル)。**T2-2の`layout.ts`実装時、elkjs結果→LayoutResult変換で祖先オフセットの
    累積加算(ノード・エッジ両方)が必須**(設計書§7.1の「ノードごとの絶対座標」を満たすため)。
  - 依存追加: `elkjs`(`package.json`に`"elkjs": "^0.12.0"`、実解決0.12.0。Excalidraw/react系のみ
    バージョン固定規約のためelkjsはcaret付きのままでよい)。
  - `npm test`(7 files/61 tests 緑)・`tsc --noEmit`・`npm run lint`・`npm run build` すべて
    成功を再確認済み(依存追加による影響なし)。
  - 残課題: 今回は2階層のみ検証。3階層以上のネスト(境界の中に境界。L4クラス図をComponent
    境界内に置く構成)での座標系の挙動はT2-2実装時に改めて確認が必要。ノード寸法は固定値で
    与えたため、実際のテキスト寸法見積り(`ctx.measureText`)との組み合わせも未検証(T2-2の範囲)。
- (2026-07-18) **T2-1完了。** `src/model/project.ts` に純関数 `project(model, level): ProjectedGraph`
  を実装(設計書§6のアルゴリズム)。(1) 各エッジのfrom/toを祖先チェーンに沿って「boundaryノード
  (Enterprise_Boundary、kind='boundary')を読み飛ばしつつ、level<=表示レベルの最初のノード」へ
  射影、(2) 射影後にfrom===toとなったエッジは破棄(自己ループ除去)、(3) 射影後の
  `(from, to, bidirectional)` が同じエッジ群を1本に集約、代表ラベル/technologyは
  `|declaredLevel-表示レベル|`最小(同値なら浅い方)のエッジから採用し、集約数2以上なら
  ラベル末尾に` (+k)`を付与。完了条件のサンプル確認(L1表示で `api→email`/`notification→email`
  が `ibs→email` に集約され`mergedCount:3`)をテストで明示的に確認済み。
  - 仕様上の曖昧点の解釈(申し送り):
    1. 射影先が見つからない場合(Rel端点がboundaryノード自身を直接参照する等の想定外入力)は
       エッジを描画対象から除外する(`build.ts`の未解決alias時の扱いと同じ方針)。
    2. 集約時、代表エッジのlabelが`undefined`の場合の`(+k)`表記は`(+k)`単独とした
       (` (+k)`や`undefined (+k)`ではなく)。
    3. 代表選択で`|declaredLevel-表示レベル|`と`declaredLevel`の両方が同値の完全同点時は、
       `model.edges`内で先に出現した方を採用(alias重複時の「初出優先」と同じ考え方)。
    4. `ProjectedEdge`/`ProjectedGraph`型は`model/types.ts`ではなく`project.ts`内にローカル定義
       (現時点で他に必要とする箇所が無いため、変更を最小限にとどめた)。
  - なお、§6の「射影後の端点が展開中の境界ノード自身になるエッジは境界枠に接続して描画する」は
    kind='boundary'ノードとは無関係(§4よりkind='boundary'はEnterprise_Boundary専用で常に
    射影先にならない)。これは「子を持つSystem/Container/Componentノードを展開枠スタイルで描く」
    というT2-2(render)側の表示上の扱いであり、project.tsの射影先選択には影響しない
    (射影は通常どおりそのノード自身に対して行われる)。
  - テスト: `tests/model/project.test.ts`(単体16件)・`tests/model/project.snapshot.test.ts`
    (internet-bankingサンプルをL1〜L4全レベルで検証、7件)を追加。`npm test`
    (9 test files / 84 tests 緑)・`tsc --noEmit`・`npm run lint`・`npm run build` すべて成功を確認。
