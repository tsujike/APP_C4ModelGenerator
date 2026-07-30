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
- [x] T2-2 レイアウト+Excalidraw描画(L2固定)
- [x] T2-3 カメラ(監視/Fit/正規化)
- [x] T3-1 レベル判定(lod)
- [x] T3-2 レベル切替+アンカー保存
- [x] T4-1 CodeMirror+ライブ更新
- [x] T4-2 エラーパネル+永続化+サンプルメニュー
- [x] T5-1 エクスポート(exportToSvg/exportToBlob)
- [x] T5-2 性能確認+README+最終検証

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
- (2026-07-18) **T2-2完了。** `layout/layout.ts`(elkjs)・`render/theme.ts`・`render/shapes.ts`・
  `render/toExcalidraw.ts`・`excal/host.tsx`を実装し、`main.ts`をサンプル→`buildModel`→
  `project(model,2)`→`layout`→`toExcalidraw`→`mountExcalidraw`の配線に書き換えた。ブラウザで
  internet-bankingサンプルのL2図(System_Boundary「ibs」の点線展開枠内にSPA/API/DB、外部の
  System「バックオフィス管理システム」「信用情報機関」「メールシステム」、Person「銀行顧客」)が
  C4配色・`[技術]`表記付きで表示されることをPlaywrightスクリーンショットで確認(完了条件どおり)。
  T2-1の集約結果(`呼び出す (+2)`等)もラベルに反映されていることを確認。
  - **T2-0aの知見(elkjs局所座標)を`layout.ts`の`walkNode`で実装**: elkjsは子ノードのx/y・
    エッジの`sections`座標を親のローカル座標系で返すため、結果ツリーを再帰的に辿りながら
    祖先オフセットを`offsetX/offsetY`として累積加算し絶対座標に変換する。エッジは
    from/toの最も深い共通祖先(LCA)ノードの`edges`配列に割り当てる方式にした
    (`groupEdgesByContainer`/`commonAncestor`)。
  - **elkjsのインポート方法に関する重要な知見(以後elkjsを使う実装は必ず踏襲すること)**:
    `import ELK from 'elkjs'`(メインエントリ)は内部でNode向けworkerフォールバックに
    `require('web-worker')`を含み、Viteの本番ビルド(Rolldown)がこの分岐を静的解決しようと
    して`npm run build`が失敗する(実測確認済み)。回避策として`elkjs/lib/elk-api.js`
    (ELK本体)と`elkjs/lib/elk-worker.js`(GWTコンパイル済み同期フェイクワーカー)を直接
    importし`workerFactory`で渡す構成にした。型定義が無いため`layout/elkjs-worker.d.ts`で
    ambient宣言を追加している。
  - **仕様上の曖昧点の解釈・実装上の判断(申し送り)**:
    1. Excalidrawのtextスケルトンは`textAlign:'center'+verticalAlign:'middle'`のとき、
       指定x/yを「左上」ではなく実測テキストサイズに基づく「中心点」として扱う(内部
       `newTextElement`の挙動。設計書に明記が無く実機検証で判明)。`shapes.ts`の
       `buildTextElement`は常にボックス中心座標を渡す実装にしている。
    2. 文字幅見積り(`charWidthFactor`)は「厳密測定は不要」との指示どおり近似値
       (全角文字基準で1.05)を`constants.ts`の`LAYOUT`に追加した。
    3. Queue variantは§7.2の記述どおり両端ellipseを省略し角丸rectangleのみとした。
    4. elkのspacing系オプションはルートに設定するだけでは入れ子(境界内)グラフに継承されない
       ことを実機確認したため、`buildElkNode`で境界ノード自身にも明示的に再指定している。
  - **既知の軽微な見た目の課題(次タスク以降で気になれば対応)**: L1(Context)近辺で複数の
    エッジラベルが密集する場合、単純な文字数ベースの寸法見積りでは隣接ラベル同士がわずかに
    重なることがある(サンプルの「利用する[HTTPS]」と「口座情報を照会[内部API]」がPerson直下で
    近接するケースで実機確認)。機能上の不具合ではなく、厳密な文字幅測定を導入する場合の
    改善余地として記録のみしておく。
  - スコープ境界: レベル切替・カメラ制御/Fit・`lod.ts`は未実装(T2-3/T3-1/T3-2)。
    クロスフェードは実装しない(既定方針どおり)。`excal/host.tsx`の`ExcalidrawHost`は
    `updateElements`/`unmount`のみの最小限。
  - JSX対応のためのインフラ変更(T2-2の成果物を成立させるために不可避): リポジトリルートに
    `vite.config.ts`(`@vitejs/plugin-react`追加)を新規作成、`tsconfig.json`に
    `"jsx": "react-jsx"`、`eslint.config.js`の型付きlint対象globに`src/**/*.tsx`を追加、
    `index.html`のビューワーペインのプレースホルダ文言を実際の表示内容に合わせて微修正した。
    これらはReact/JSXを`excal/host.tsx`に閉じ込める前提を成立させるための最小限の設定変更で
    あり、`model/`・`parser/`・`spike-t2-0b/`には一切手を入れていない。
  - テスト: `tests/layout/layout.test.ts`(elkjs結果からの座標変換をElkNodeの手計算値で検証+
    実elkjs実行での包含不変条件確認)・`tests/render/theme.test.ts`・`tests/render/shapes.test.ts`
    を追加。`npm test`(12 test files / 100 tests 緑)・`tsc --noEmit`・`npm run lint`・
    `npm run build`すべて成功を確認。Playwright(Chromium)で`vite build`後の`vite preview`に
    対しスクリーンショット確認済み(コンソールエラーはT2-0bと同様のExcalifontフォントCDN
    到達不可のみで、機能上の問題なし)。
  - **重要な申し送り**: 実機(Kennyさんのマシン)の`node_modules`はT0-1時点の`npm install`から
    更新されておらず、T2-0a/T2-0bで`package.json`に追加されたelkjs/@excalidraw/excalidraw/
    react/react-domが未インストールだった。デバイスブリッジのシェル(device_bash)はネット
    ワークアクセスが無い設計のため、実装セッション側からは`npm install`を実行できない。
    このコミット取り込み後、実機で`npm install`の再実行をKennyさんに依頼した。
    (以後、`package.json`の依存関係を変更するタスクの後は同様の申し送りが必要)。
- (2026-07-18) **T2-3完了。** `camera/camera.ts`(カメラ監視/Fit/正規化。設計書§8.1)を実装。
  `excal/host.tsx`の`ExcalidrawHost`に`subscribeCamera`(onChangeのzoom/scroll購読)と
  `fitToContent`(`scrollToContent(..., {fitToViewport:true})`のラップ、任意の一回限りコール
  バックで「このFit呼び出し自身の結果」を取得可能)を追加。`camera.ts`はReact/JSXを一切
  importせず、host.tsxが提供する非React最小インターフェース越しにのみ操作する
  (実装指示書§4「camera.ts経由に一本化」)。z0(正規化基準)は起動直後の1回限りの
  `fitAndEstablishZ0()`で確定し、以後再計算しない。ツールバーの`[Fit]`ボタン(実DOM化)と
  ズーム%表示(`#zoom-readout`)を`main.ts`から`camera.ts`経由で配線した。
  - **実機検証で発見・修正したバグ**: `excalidrawAPI`コールバックが発火した直後はまだ
    Excalidrawの内部シーンが空(`getSceneElements().length===0`)かつ`appState.width/height`が
    CSS Grid確定前の仮寸法のため、その時点で`fitToContent`を呼ぶと「収める対象が無い」状態で
    ズームが変化せずz0がzoom=1.0(=100%)のまま誤確定してしまう不具合があった。修正として、
    `fitToContent`の実行を「APIの初期化」だけでなく「最初の`onChange`発火(=シーン・寸法とも
    確定した合図)」まで遅延させるようにした(`host.tsx`の`runWhenSceneReady`)。修正後は
    起動直後のズーム%が90%(=Excalidraw純正のズームバッジと一致)で安定し、3回のリロードで
    いずれも90%を再現することを確認した(z0の安定性という完了条件を直接裏付ける)。
  - 完了条件の確認(独立検証済み): Playwright実機操作で、Ctrl+wheelズーム操作後にツールバーの
    `ズーム率`表示が90%→100%へ追従して更新されること、Fitボタン押下で90%(全体表示)に戻る
    こと、ページを3回リロードしてもいずれも起動直後90%で安定することを確認した。
  - 仕様上の判断・申し送り:
    1. FR-4.4のツールバー`ズーム率%`表示は、正規化後のs(`state.scale`、しきい値判定用の
       内部値。T3-1のlod.ts専用)ではなく、Excalidraw自身のズームバッジと同じ意味の**生の**
       `zoom.value×100`を採用した(実機でExcalidraw純正のズームバッジと完全一致することを
       確認)。sは`CameraState.scale`として内部的に計算済みで、T3-1のlod.ts実装時にそのまま
       利用できる。
    2. 設計書§9の完全な`AppState`/`state.ts`(model/issues/layouts/level/levelLock等)はまだ
       作成していない。level/levelLockはT3-1/T3-2のスコープであり、今の時点で導入すると
       先回りの抽象化になるため、`camera.ts`は自己完結した最小限の`CameraState`のみを持つ。
       `state.ts`の導入はT3-1/T3-2で実際に必要になった時点で行う。
  - スコープ境界: `lod.ts`(`nextLevel`)・レベル切替・アンカー保存(§8.3)・AUTO/手動レベル
    ロックUIは未実装(T3-1/T3-2)。クロスフェードは実装しない。サンプル選択・レベルボタン
    (L1〜L4/AUTO)・SVG/PNG出力ボタンは引き続きプレースホルダのまま(他タスクの担当範囲)。
  - テスト: `tests/camera/camera.test.ts`(モックした`ExcalidrawHost`に対する単体テスト7件:
    初期状態・z0確定前のonChangeミラーリング・`fitAndEstablishZ0`によるz0確定・
    s=zoom/z0の算出・z0確定後の再Fitでの非変化(冪等性)・Fitボタンがz0に影響しないこと・
    subscribe/unsubscribe)を追加。`npm test`(13 test files / 107 tests 緑)・`tsc --noEmit`・
    `npm run lint`・`npm run build`すべて成功を確認。
- (2026-07-18) **T3-1完了。** `camera/lod.ts`に純関数`nextLevel(current: Level, s: number): Level`
  を実装(設計書§8.2の非対称ヒステリシス)。DOM/Excalidrawに一切依存しない純関数として
  `parser`/`model`/`layout`と同じ方針で実装している。手動固定モード(levelLock)はこの
  モジュールの関知するところではなく、呼び出し側(T3-2)が「固定中は呼ばない」形で
  バイパスする設計(実装指示書の「やらないこと」どおり)。
  - 閾値↔レベル対応は要件定義書FR-5.1の表で確認: L1: s<0.75 / L2: 0.75≤s<1.5 /
    L3: 1.5≤s<3.0 / L4: 3.0≤s。`LOD_ZOOM_THRESHOLDS=[0.75,1.5,3.0]`がL1→L2/L2→L3/L3→L4の
    各境界に対応する(`constants.ts`のコメントどおり)。
  - 上昇方向(閾値到達で即遷移)・下降方向(現在レベルの進入閾値×0.9を下回ったら遷移)を
    それぞれ独立したwhileループで実装。§8.2の具体例(L3滞在中、s=1.4は維持・s=1.35ちょうども
    維持・s<1.35でL2へ降格)をテストでそのまま再現し確認済み。
  - 仕様上の判断(申し送り): §8.2は「1回の呼び出しでsが複数レベル分ジャンプした場合」を
    明示していない。sに対して一意に定まるべきレベルという閾値表の意味論と矛盾しない最単純
    解釈として、上昇側・下降側それぞれの閾値を1段ずつ跨ぎながら連鎖的に適用する方式にした
    (例: current=L1, s=5.0 → L4を返す。L2止まりにはしない)。sは単一値のため上昇・下降
    両ループが同時に作用することはない(閾値が単調増加かつヒステリシス係数<1のため)。
  - テスト: `tests/camera/lod.test.ts`(36件。3つの閾値境界それぞれの上昇/下降両方向・
    §8.2の具体例そのもの・多段ジャンプ・s=0や極端に大きいsでのL1/L4への飽和を網羅)を追加。
    `npm test`(14 test files / 143 tests 緑)・`tsc --noEmit`・`npm run lint`・
    `npm run build`すべて成功を確認。
  - スコープ境界: `camera.ts`・`main.ts`・レベル切替UI・アンカー保存(§8.3)は未着手(T3-2)。
    このタスクは`lod.ts`とそのテストのみに限定した。
- (2026-07-18) **T3-2完了。** `camera/anchor.ts`(§8.3の純粋な座標計算)・
  `camera/levelController.ts`(AUTO/手動固定のオーケストレーション)を新規実装し、
  `excal/host.tsx`に`getAnchorWorldPoint`/`applyLevelSwitch`を追加、`main.ts`を4レベル分の
  レイアウト事前計算+レベル切替配線に書き換えた。`index.html`のレベルボタン(L1〜L4/AUTO)・
  現在レベル表示(ツールバー文言+ビューワー内バッジ`#level-badge`)を実DOM化した。
  - **状態管理の設計判断**: 設計書§9は`state.ts`にAppState全体をまとめる案を示すが、
    T2-3時点でmodel/issues/layouts(T4スコープ)がまだ存在しないため、汎用`state.ts`を今
    導入するのは先回りの抽象化と判断。T2-3の`CameraController`と同じ「1関心事=1コントローラ」
    パターンを踏襲し、`level`/`levelLock`は`LevelController`が自己完結して持つ形にした。
  - **アンカー保存アルゴリズム(§8.3)**: Excalidrawの`onPointerUpdate`が既にワールド座標
    (シーン座標)でポインタ位置を返すため、screen→world変換は不要(ポインタが未取得の場合のみ
    `world = screen/zoom - scroll`でビューポート中心を算出)。アンカーノードの特定は、
    ワールド座標点を含む最小面積のノード(境界枠は子を内包するため、面積最小=最前面という
    幾何学的な定義)。新レベルでの対応ノードは同じid(=alias)を新レベルのnodesから検索し、
    無ければC4Modelの親チェーンを辿って最初に見つかる可視祖先(「展開される」「折りたたまれる」
    の両方をこの1つのロジックで統一的にカバー)。スクロール補正は
    `newScroll = oldScroll + (oldAnchorCenter - newAnchorCenter)`(zoomは維持するため式に
    現れず相殺される)。要素とスクロール補正は`applyLevelSwitch`内の1回の`updateScene`呼び出しで
    同時適用し、中間状態を見せない(§8.3手順3・4)。
  - **独立検証(実機Playwright、指揮者自身が追加実施)**: カーソルをL2の「API」箱の中心
    (画面座標)に正確に合わせた状態でCtrl+wheelズームインしL2→L3へ切り替えたところ、
    切替後は「API」が展開された境界枠(Container_Boundary)の中心が同じ画面座標に来ることを
    十字カーソルのオーバーレイ画像で確認した(申し送り: サブエージェントの報告どおりの結果を
    再現)。手動固定(L4ボタン→ズーム率10%まで強制ズームアウトしてもL4のまま維持)、
    AUTOボタン押下での即時再評価(ズーム率10%相当のL1へ即座に反映)も確認。FR-5.7(L3未定義の
    Container)については、L3表示で`spa`/`db`が引き続き葉ボックスのまま、`api`のみが
    展開境界枠になることをスクリーンショットで確認した。
  - 仕様上の判断・申し送り:
    1. 手動固定・AUTO自動判定のどちらから発火した切替でも同じ§8.3アンカー保存アルゴリズムを
       適用する(仕様がトリガーの種類でアンカー保存の適用有無を分けて記述していないため)。
    2. AUTOボタン押下時は、次のズームイベントを待たず現在のズーム値に基づいて即座に
       再判定・反映する(固定中にズーム操作されていた場合、ボタンを押すまで反映を待たせない
       解釈)。
    3. FR-5.6「ツールバーとビューワー内バッジに常時表示」を文字どおりツールバー文言(`#level-status`)
       とビューワー内バッジ(`#level-badge`)の両方として実装した。
    4. レベル別レイアウトは設計書§3が「遅延生成でよい」とする一方、本サンプルの規模(十数
       ノード)では4レベル合計の計算コストも軽微なため、単純さを優先して起動時に4レベル
       すべてを一括計算する方式にした(NFR-3「200ノード/300エッジで1秒以内」の要件とも
       整合する規模)。テキスト編集によるキャッシュ破棄はT4スコープ。
  - テスト: `tests/camera/anchor.test.ts`・`tests/camera/levelController.test.ts`(モック化した
    `ExcalidrawHost`/`CameraController`に対する単体テスト)を追加。`npm test`
    (16 test files / 162 tests 緑)・`tsc --noEmit`・`npm run lint`・`npm run build`すべて
    成功を確認(指揮者による独立再検証込み)。
  - スコープ境界: T4(CodeMirroエディタ・エラーパネル・サンプルメニュー)・T5(エクスポート)は
    未着手。エディタペイン・issues-panel・サンプル選択・SVG/PNG出力ボタンは引き続き
    プレースホルダのまま。クロスフェードは実装しない(既定方針どおり)。
- (2026-07-18) **T4-1完了。** `ui/editor.ts`にCodeMirror 6エディタ(行番号・等幅・
  StreamLanguageによる最小限のハイライト・300msデバウンス)を実装し、`index.html`の
  `#editor-mount`にマウント。`main.ts`をエディタの変更(デバウンス済み)のたびに
  `buildModel`→4レベル分の`project`/`layout`/`toExcalidraw`を再実行し、
  `levelController.updateModel`経由で現在表示中のレベルの要素だけを`host.updateElements`で
  差し替える配線に拡張した(カメラ/scroll/zoomには一切触れない。FR-1.3)。
  - **依存追加**: `@codemirror/state`・`@codemirror/view`・`@codemirror/commands`・
    `@codemirror/language`(StreamLanguage用)。バッテリー同梱の`codemirror`パッケージでは
    なく最小構成を個別導入。バージョンは`^`付き(実装指示書§4のバージョン固定規約は
    `@excalidraw/excalidraw`/`react`/`react-dom`のみに明記されており、elkjs追加時の解釈を
    踏襲)。**申し送り**: 実機(Kennyさんのマシン)側で`package.json`が更新されたため、
    T2-0a/T2-0b時と同様に実機での`npm install`再実行が必要(device_bashはネットワーク
    アクセス不可のため、実装セッション側からはインストールできない)。
  - **デバウンスの配置**: `main.ts`ではなく`ui/editor.ts`内に置いた。設計書§2のディレクトリ
    構成表が`ui/editor.ts`の役割を「エディタ、デバウンス、localStorage」と明記しており、
    「テキスト変更の生成源」と「変更通知の間引き」は同じ関心事と判断。`camera.ts`/
    `levelController`が確立した「1関心事=1コントローラ」パターンを踏襲。
  - **レイアウトキャッシュ破棄の実体**: 編集のたびに`buildLevelData`で4レベル分の
    `LayoutResult`+Excalidraw要素を新規のMapとして作り直し、`levelController.updateModel`で
    古い参照を丸ごと置き換える(部分更新・差分適用はしない、最単純な「全破棄・再構築」)。
  - **`levelController`の拡張**: `updateModel(model, levelData)`を追加。内部の`model`/
    `levelData`参照を差し替え、現在表示中レベルの要素のみ`host.updateElements`で反映する。
    アンカー保存付きの`applySwitchElements`(レベル切替専用、scroll補正あり)とは意図的に
    別経路にし、「ライブ編集」と「レベル切替」でカメラへの影響有無を明確に分離した。
  - **独立検証(指揮者自身が追加実施)**: 実機Playwrightで、手動でズーム124%・パンした状態から
    エディタでPersonのlabelテキストを編集し300ms超待った後、ズーム%表示が編集前後で
    完全に同一(124%)であること、diagramの表示位置(スクロール枠)も見た目上変化していない
    ことをスクリーンショット比較で確認した(FR-1.3を直接裏付け)。CodeMirrorの行番号ガター
    (51行)・初期サンプル文言の表示も確認済み。
  - 仕様上の判断・申し送り:
    1. `buildModel`が返す`issues`(parse error/warning)は、T4-1時点ではUIパネル未実装
       (issuesPanelはT4-2のスコープ)のため、握りつぶさずconsole.logのみに出力する
       最小限の経路を残した。
    2. 「表示中レベルのノードが編集で消えた」場合の挙動は特別扱いせず、4レベル全てを
       毎回フルに作り直す設計により自然に安全(存在しないノードは単に要素配列に含まれない
       だけで、クラッシュや不整合は生じない)。L4固定中に`Component(notification, ...)`行を
       削除して実機確認済み(該当ボックスが消えるだけでクラッシュなし)。
  - テスト: `tests/ui/editor.test.ts`(デバウンスのfake timerテスト+`classifyKeyword`の
    分類テスト、計11件)、`tests/camera/levelController.test.ts`に`updateModel`関連2件を追加。
    `npm test`(17 test files / 175 tests 緑)・`tsc --noEmit`・`npm run lint`・
    `npm run build`すべて成功を確認(指揮者による独立再検証込み)。
  - スコープ境界: localStorage永続化(FR-1.4)・サンプル読込メニュー(FR-1.5)・issuesPanel UI・
    スプリッターは未着手(T4-2)。補完・lint gutterは実装しない(指示書「やらないこと」)。
- (2026-07-18) **T4-2完了。** `ui/issuesPanel.ts`(FR-2.2のエラー/警告パネル)・`ui/splitter.ts`
  (ペイン幅のドラッグリサイズ)・`samples/ec-site.ts`(2件目の組込サンプル、FR-1.5の
  「最低2件」充足)を新規実装。`ui/editor.ts`に`jumpToLine`(行クリックジャンプ)・
  `setValue`(サンプル読込での丸ごと差し替え)・`loadPersistedSource`/`savePersistedSource`
  (FR-1.4のlocalStorage永続化)を追加。`index.html`のサンプルプレースホルダを実`<select>`に、
  issues-panelを実DOM描画に置き換えた。
  - **issuesPanel設計**: `formatIssue`(severity→日本語ラベル/CSSクラス+`L<行>: <message>`の
    純粋整形関数、DOM非依存でテスト可能)+`createIssuesPanel`(クリック可能な`<button>`一覧を
    描画、クリックで`onJumpToLine`経由``editor.jumpToLine`を呼ぶ)。`EditorController.jumpToLine`
    はCodeMirrorの`EditorSelection.cursor`+`scrollIntoView`でカーソル移動・スクロール・
    フォーカスを行う。0件時は「問題なし」の1行のみ描画し、`#issues-panel`の`grid-template-rows`
    が`auto`のため専用の開閉UIなしで自然に折りたたまれる(最単純解釈)。
  - **localStorage設計**: キー`c4-model-whiteboard-viewer:source`、ペイロードは
    `{v: 1, source: string}`のJSON(生の文字列ではなくバージョン付き封筒形式にし、「破損」の
    意味をより厳密に表現する判断)。`getItem`失敗・JSON parse失敗・形状不一致・バージョン
    不一致はすべて「破損」として同列にnullを返し、呼び出し側(main.ts)が初期サンプルへ
    フォールバックする。保存は`editor.subscribe`の**既存の300msデバウンス済み通知**に
    リスナーを追加するだけで、新規のデバウンスタイマーは作らない(T4-1が確立した
    「1関心事=1コントローラ」パターンの継続)。
  - **サンプル読込**: `<select id="sample-select">`の`change`で即座に選択値をプレースホルダへ
    戻し(同じサンプルの再選択でも`change`が再発火するように)、`window.confirm(...)`で
    現ソース破棄の確認を取る。承諾時のみ`editor.setValue(source)`(通常の編集パイプラインに
    そのまま乗る=再解析・localStorage保存も自動で走る)。キャンセル時は無変化。カスタム
    モーダルではなくネイティブ`confirm()`を採用(UIフレームワーク不使用の方針、単純な
    同期yes/noゲートには十分)。
  - **`samples/ec-site.ts`**: L1(`Person(customer)`・`System(ec)`・`System_Ext(payment)`)+
    L2(`System_Boundary(ec)`内にContainer 3つ: web/React、api/Node.js-Express、db/PostgreSQL)
    のみ。C4Component/classDiagramブロックは意図的に無し(FR-5.7の「L3以降未定義」の
    実機テストケースを兼ねる)。
  - **スプリッター**: 純粋関数`computeColumnWidth(startWidth, deltaX, containerWidth)`
    (`constants.ts`の`SPLITTER`定数でクランプ)+`createSplitter`(pointerdown/move/upで
    `#app`の`--editor-col-width`カスタムプロパティを更新)。CSS Gridを
    `var(--editor-col-width) 6px 1fr`の3列構成に変更。「スプリッター」という単数形の表現と
    §4の画面図に合わせ、エディタ列とビューワー列の間の縦方向1本のみ実装(エディタペインと
    issues-panelの間には設けない)。
  - **独立検証(指揮者自身が追加実施、実機Playwright)**: 受入基準3を明示的に確認 —
    正常なサンプルは「問題なし」、`Rel(customer, doesNotExistAlias, ...)`を追加すると
    `[エラー] L9: ...`が表示され、該当行を削除して修復すると「問題なし」に戻ることを確認。
    受入基準4を明示的に確認 — Personのlabelに一意なマーカー文字列を追記して800ms待った後
    ページをリロードし、マーカーがエディタに残っていること(初期サンプルに戻らないこと)を
    確認。サンプルメニューでは`window.confirm`のダイアログテキスト
    (「現在のソースを破棄して「ECサイト」サンプルを読み込みます。よろしいですか?」)を
    実際に受信し、承諾後にエディタ内容がECサイトサンプルへ切り替わることを確認。
    スプリッターは150pxドラッグでeditor-paneの幅が320px→470pxへ(ドラッグ量と正確に一致)
    変化することを確認。
  - 仕様上の判断・申し送り:
    1. 「破損時は無視」をバージョン付きJSON封筒形式で実装(「破損」の意味論をより厳密にする
       ための判断。生文字列保存でも要件は満たせたが、形式不一致を検出できる利点を優先)。
    2. issues 0件時の「折りたたみ」は、専用の開閉ウィジェットではなく最小コンテンツによる
       グリッド行の自然な縮小で表現(要件・設計書のどちらにも専用UIの指定が無いため)。
    3. サンプル切替も通常の300msデバウンス編集パイプラインを経由させる(「サンプル読込→
       即座に反映」ではなく、他の編集操作と同じ経路に統一。仕様が「現ソースを破棄する旨を
       確認する」としか言っておらず、反映タイミングまでは指定していないための最単純解釈)。
  - テスト: `tests/ui/issuesPanel.test.ts`・`tests/ui/splitter.test.ts`を新規追加、
    `tests/ui/editor.test.ts`にlocalStorage関連ケースを追加。`npm test`
    (19 test files / 189 tests 緑)・`tsc --noEmit`・`npm run lint`・`npm run build`すべて
    成功を確認(指揮者による独立再検証込み)。新規npm依存は無し(既存のCodeMirror 6/DOM API/
    localStorageのみで実装)。
  - スコープ境界: T5(SVG/PNGエクスポート)は未着手、エクスポートボタンは引き続き
    プレースホルダのまま。`parser/`・`model/`・`layout/`・`render/`には一切手を入れていない。
- (2026-07-18) **T5-1完了。** `ui/exporter.ts`(FR-6.1/FR-6.2、ダウンロードトリガーの
  純粋関数群)を新規実装し、`excal/host.tsx`の`ExcalidrawHost`に`exportSvgString`/
  `exportPngBlob`を追加。`index.html`のプレースホルダを実`<button id="export-svg-button">`/
  `<button id="export-png-button">`に置換、`main.ts`で現在表示中レベル(`levelController`の
  `getState().level`)の全要素(`levelData`)をエクスポート対象として配線した。
  - **`exportToSvg`/`exportToBlob`の呼び出し場所の判断**: 型定義上はReactコンテキスト不要
    (素の関数)だが、実際の呼び出しは`excal/host.tsx`に置いた。理由はReactではなく
    `@excalidraw/excalidraw`パッケージ自体がモジュール評価時にブラウザの`window`を参照する
    初期化コードを含むため(vitestで`ui/exporter.ts`が同パッケージを値importすると
    `window is not defined`で落ちることを実機確認)。既存パターン(host.tsxのみが
    `@excalidraw/excalidraw`を値importする)を維持し、`ui/exporter.ts`はダウンロード
    トリガー(DOM操作)に専念させた。
  - **画面表示との一致**: `appState: { exportBackground: true, viewBackgroundColor: '#ffffff'
    (constants.tsのEXPORT.backgroundColor) }`。PNGの2倍解像度化で`appState.exportScale`が
    単独では効かない(`maxWidthOrHeight`未指定時は無視される)ことを実機確認し、
    `exportToBlob`の`getDimensions`コールバックで幅・高さ・scaleを明示的に2倍にして解決した
    (パッケージの実装上の癖への対処。申し送り)。
  - **独立検証(指揮者自身が追加実施)**: 実機Playwrightで、L2表示中にSVG/PNGボタンを押下し
    ダウンロードされたファイル(`c4-model-L2.svg`/`.png`)を検証 — SVGは`<svg`で始まり
    「SPA」「API」「銀行顧客」等の画面表示どおりのテキストを含む、PNGはファイル署名
    (`89 50 4E 47 0D 0A 1A 0A`)が有効。L3へ切り替えて再エクスポートすると
    `c4-model-L3.svg`となり、L3固有のラベル(「サインインCtrl」)を含み「対象は現レベルの
    全要素」であることを確認。エクスポートしたSVGを`file://`で単独に開いてスクリーンショットし、
    C4配色・境界枠・集約エッジラベルまで画面表示と完全に一致することを目視確認した。
  - 仕様上の判断・申し送り:
    1. `@excalidraw/excalidraw`パッケージの型定義が実際には存在しない`@excalidraw/utils`を
       参照しており、`exportToSvg`/`exportToBlob`の型が実質`any`になる問題があったため、
       `host.tsx`内で手動の型注釈(関数シグネチャの明示)を1箇所に閉じて対処した。
    2. ダウンロードファイル名は仕様に明記が無いため`c4-model-L{level}.{ext}`とした
       (最単純解釈。どのレベルの書き出しか一目でわかる)。
  - テスト: `tests/ui/exporter.test.ts`(`exportFileName`のユニットテスト)を追加、
    モックhostに新メソッドを追加して`tests/camera/{camera,levelController}.test.ts`を更新。
    `npm test`(20 test files / 190 tests 緑)・`tsc --noEmit`・`npm run lint`・
    `npm run build`すべて成功を確認(指揮者による独立再検証込み)。新規npm依存は無し。
  - スコープ境界: T5-2(性能確認・README・最終検証)は未着手。`parser/`・`model/`・`layout/`・
    `render/`には一切手を入れていない。
- (2026-07-18) **T5-2完了(本タスクが最終タスク)。** `tests/perf/generateLoadSample.ts`(負荷サンプル
  生成スクリプト)・`tests/perf/perf.test.ts`(NFR-3計測テスト)を新規実装し、`README.md`を
  (概要・起動方法・記法リファレンス表・閾値のカスタマイズを含む内容に)新規作成した。
  `parser/`・`model/`・`layout/`・`render/`・`camera/`・`ui/`・`excal/`のソースコードは一切
  変更していない(測定+ドキュメントのみのタスクという指示どおり)。

  - **NFR-3計測(実装指示書T5-2「L1〜L4の4レイアウトを明示的に強制計算して合計時間を測ること」)**:
    `tests/perf/generateLoadSample.ts`は`buildModel`が読める本物のMermaid C4サブセットDSLテキストを
    組み立てる(モデルオブジェクトを直接構築するのではなく、実際のパーサ経路を通す)。
    Person5・内部System15・外部System5(L1=25ノード)、各内部Systemに3 Containerずつ(L2=45)、
    全Containerに2 Componentずつ(L3=90)、先頭20コンポーネントにclassDiagram2クラスずつ(L4=40)で
    合計200ノード。エッジはL1=30・L2=160(チェーン+person→先頭+末尾→外部+メッシュ埋め合わせ)・
    L3=90・L4=20の合計300本(すべて`Rel`/classDiagram矢印として宣言。`tests/perf/perf.test.ts`の
    1件目のテストで`buildModel`後の`model.byAlias.size===200`・`model.edges.length===300`・
    エラー0件を確認し、生成ロジックが意図どおりの規模を実際に生成できていることを担保している)。
    2件目のテストで`performance.now()`により (1) `buildModel`(解析)、(2) L1→L2→L3→L4の順に
    `project`→`layout`(elkjs)→`toExcalidraw`を毎回明示的に呼び出す合計(遅延生成・キャッシュ一切
    無し)、の時間を計測し`console.info`へ出力する。
    - **実測値(このクラウドサンドボックス環境、`npx vitest run tests/perf`を4回実行した値)**:
      `parse(buildModel)`は4.1〜8.3ms(無視できる水準)。`L1〜L4のproject+layout+toExcalidraw合計`は
      2633.7ms/2763.9ms/2746.7ms/2895.1msで、合計(total)は2637.8ms/2768.1ms/2755.0ms/2899.7ms
      (平均約2765ms)。**NFR-3の基準(1000ms以内)は達成できていない(約2.6〜2.9倍)**。
    - **原因(1行)**: レベル別に`elk.layout()`を個別診断したところ、L1(25ノード/87射影エッジ)が
      593ms、L2(70ノード/150エッジ)が726ms、L3(160ノード/225エッジ)が732ms、L4(200ノード/245エッジ)が
      692msと、**グラフ規模(ノード数8倍・エッジ数3倍弱)にほぼ比例せず4呼び出しとも一律600〜730ms
      程度**であることから、律速要因はレイアウトアルゴリズム自体の計算量ではなく、`layout/layout.ts`
      が(T2-2の申し送りどおりVite本番ビルド互換のため)採用している`elkjs/lib/elk-worker.js`
      (GWTコンパイル済みの同期フェイクワーカー)を介した`elk.layout()`呼び出し1回あたりの
      固定オーバーヘッド(メッセージ受け渡し・GWT VM側の初期化)だと判断する。このフェイクワーカーは
      ブラウザ本番ビルドでも同じコードパスが使われるため(T2-2申し送り参照)、本番ブラウザでも
      同種の固定コストが乗る可能性が高い。
    - **対策提案(実装はしない。指示書「未達なら…勝手に大改造しない」に従い記録のみ)**:
      (a) `elk.layout()`の呼び出し回数そのものを減らす(例: 4レベル分を1回のELK呼び出しに
      まとめられないか、または初回訪問時のみ計算する遅延生成に戻し「起動時に4回」という
      同時発生コストを避ける)、(b) 本当にWeb Worker(`workerUrl`、真の非同期・別スレッド)に
      切り替えられないか改めて検証する(T2-2時点でNode/Viteビルド両立のためフェイクワーカーを
      選んだ経緯があるため、ビルド互換性の再検証込みで慎重な判断が要る)、(c) ブラウザの実機
      (Kennyさんのマシン)で同じ`tests/perf`を実行し、この計測がサンドボックス環境固有のCPU
      性能起因なのか、フェイクワーカーの固定コスト起因なのかを切り分ける、の3点を次のタスクの
      候補として提案する。いずれも本タスクの指示範囲(測定+記録のみ)を超えるため実施していない。
    - このテスト自体(`tests/perf/perf.test.ts`)は`npm test`を赤くしない設計にしてある:
      NFR-3の1000ms基準そのものをassertするのではなく、「本物のパーサ→モデル→レイアウトの
      パイプラインが200ノード/300エッジ規模でクラッシュせず完走すること」を担保する緩い回帰防止
      上限(10秒。実測の約3〜4倍の安全マージン)のみをassertしている(理由はテストファイル冒頭の
      コメントに明記)。実測値そのものはこのPROGRESS.mdへの人手記録が一次情報である
      (指示書T5-2「未達なら原因1行と対策提案のみ」に従い、テストを失敗させて`npm test`を
      赤くする設計は完了条件「全テスト緑」と矛盾するため採らなかった)。

  - **README.md**: リポジトリ直下に存在しなかった(過去タスクの申し送りは「2行の最小README」を
    前提にしていたが、本タスク着手時点で`README.md`自体が無い状態だった)ため新規作成した。
    概要(セマンティックズームの説明・主要機能一覧)・起動方法(`npm install`/`dev`/`test`/
    `build`/`lint`/`preview`)・記法リファレンス表(C4系ブロックの全文法+classDiagramサブセット+
    階層結び付けルールの要約。`src/parser/parseC4Block.ts`・`parseClassBlock.ts`・設計書§5を
    突き合わせて記述し、実装が対応していない構文を書かないよう注意した)・閾値のカスタマイズ
    (`src/constants.ts`の`LOD_ZOOM_THRESHOLDS`/`LOD_HYSTERESIS_FACTOR`の意味と変更方法、
    `camera/lod.ts`の`nextLevel`への言及)を含む。Prettier整形対象(`.prettierignore`は`docs`のみを
    除外しており`README.md`はルート直下のため対象)のため`npx prettier --write README.md`で
    表を整形し、`npm run lint`が緑であることを確認済み。

  - **受入基準(要件定義書§7)1〜6の通し検証記録**:
    1. 「L1→L4までズームインで順に切り替わり、ズームアウトで逆順に戻る」: **本タスクではブラウザ
       による実機の連続スイープ(L1→L2→L3→L4→L3→L2→L1を1セッションで通しで確認する操作)は
       実施していない**(このセッションにはブラウザ操作ツールが無いため)。根拠はコードレビュー:
       `src/camera/lod.ts`の`nextLevel(current, s)`は上昇側・下降側それぞれ`while`ループで閾値を
       1段ずつ跨ぎながら連鎖適用する実装であり、`s`が1回のズーム操作で複数閾値を跨いでも
       正しく多段遷移する(例: current=L1, s=5.0→L4を1回で返す。テスト`tests/camera/lod.test.ts`の
       多段ジャンプケースで確認済み)。`src/camera/levelController.ts`の`camera.subscribe`は
       `state.levelLock===null`の間、`camState.scale`が変化するたびに`nextLevel`を呼び、結果が
       現在レベルと異なれば`applySwitchElements`で即座に切り替える(隣接レベルへの遷移に限定
       されない汎用実装)。個別のレベル遷移(L1↔L2, L2↔L3, L3↔L4)はT3-2で指揮者自身がPlaywright
       実機操作により個々に確認済み(本ファイルT3-2の項目参照。L2→L3のアンカー保存、L4固定、
       AUTO即時反映等)だが、「1セッションでL1〜L4を連続して往復する」という受入基準1の文言
       そのものをそのまま再現した実機検証はまだ無い。**指揮者による最終ライブ確認を推奨する**
       (指示された申し送りどおり、実施していないことを実施したと偽らない)。

       **【指揮者による追加の独立検証、本タスク内で実施】** 上記の未検証を解消するため、指揮者自身が
       `npm run build`成果物を`vite preview`で配信し、実機Chromium(Playwright)で組込サンプル
       「インターネットバンキング」を読み込んだ状態から、キャンバス中心でCtrl+wheelのズーム操作を
       1セッション内で連続実行して検証した。結果: 初期表示(L2、Fit直後の`z0`)から**ズームアウト**
       を続けたところ`L2→L3方向`ではなく正しく`L2→L1`へ切替(`現在: L1 (AUTO)`、ズーム率10%)、
       続けて**ズームイン**を再開すると`L1→L2→L3→L4`の順で1段ずつ、逆順に切り替えたときに跨いだのと
       同じ境界を飛ばさず全4レベルを通過することを`#level-badge`/`#level-status`の値を毎ステップ
       サンプリングして確認した(観測順序: `[1, 2, 3, 4]`)。さらに独立したセッションで初期表示から
       ズームイン→ズームアウトの往復も実施し、観測順序`[2, 3, 4, 3, 2, 1]`(L2始まりでL4まで上昇後、
       L1まで下降)を確認、いずれも要件定義書§7・受入基準1が要求する「ズームインで順に切り替わり、
       ズームアウトで逆順に戻る」という単調な多段遷移と一致した。各レベル到達時のスクリーンショットも
       取得し、L1は極小アイコン群、L4は`Component(accounts, "口座サービス", "Spring Bean")`の
       白抜き箱に「通知を依頼」ラベル付き矢印という、コード層(L4)相当の内容が表示されていることを
       目視確認した。以上により受入基準1は**指揮者自身の実機検証で確認済み**とする(上記のコード
       レビューのみの記述は、検証プロセスの透明性のため取り消さずそのまま残す)。
    2. 「FR-5.4のアンカー保存が体感できる」: **T3-2で指揮者自身が実機Playwrightで検証済み**
       (本ファイルT3-2の項目: カーソルをL2「API」箱の中心に合わせた状態でズームインしL2→L3へ
       切替、切替後の展開境界枠の中心が同じ画面座標に来ることを十字カーソルのオーバーレイ画像で
       確認)。実装(`src/camera/anchor.ts`の`computeAnchorPreservingScroll`、`levelController.ts`の
       `applySwitchElements`)もT5-2時点で再読し、T3-2以降に変更が入っていないことを確認した。
    3. 「ソースの1行を壊すと行番号付きエラーが出て、直すと復帰する」: **T4-2で指揮者自身が実機
       Playwrightで検証済み**(本ファイルT4-2の項目: `Rel(customer, doesNotExistAlias, ...)`追加で
       `[エラー] L9: ...`表示、削除で「問題なし」に復帰)。`src/ui/issuesPanel.ts`・
       `src/model/build.ts`の`resolveEdges`(未解決alias→error)もT4-2以降変更なし。
    4. 「リロード後も編集内容が復元される」: **T4-2で指揮者自身が実機Playwrightで検証済み**
       (本ファイルT4-2の項目: labelに一意マーカーを追記し800ms待ってリロード、マーカーが
       エディタに残ることを確認)。`src/ui/editor.ts`の`loadPersistedSource`/`savePersistedSource`
       もT4-2以降変更なし。
    5. 「SVG/PNGエクスポートが成功し、内容が画面表示と一致する」: **T5-1で指揮者自身が実機
       Playwrightで検証済み**(本ファイルT5-1の項目: L2表示中にダウンロードした`c4-model-L2.svg`/
       `.png`がPNG署名有効・SVGが画面表示どおりのテキストを含む、SVGを`file://`で単独に開いて
       C4配色・境界枠・集約エッジラベルまで画面表示と一致することを目視確認、L3切替後の再
       エクスポートも確認)。`src/ui/exporter.ts`・`src/excal/host.tsx`の`exportSvgString`/
       `exportPngBlob`もT5-1以降変更なし。
    6. 「`npm test`が全緑、`npm run build`が成功する」: **本タスクで直接実行し確認**。
       `npm test`: 21 test files / 192 tests すべて緑(内訳: 既存190テスト+本タスクで追加した
       `tests/perf/perf.test.ts`の2テスト)。`npx tsc --noEmit`: エラー0件。`npm run lint`
       (`eslint . && prettier --check .`): エラー0件・警告0件(README.md追加に伴いPrettier整形も
       通過)。`npm run build`: exit code 0で`dist/`一式を生成(既存のバンドルサイズ警告
       [500KB超のチャンクあり]はmermaid/excalidraw等の依存由来でT5-2以前から存在する既知の
       事象であり、ビルド自体は成功している。本タスクのスコープ外のため対応していない)。

  - 仕様上の判断・申し送り:
    1. 負荷サンプルの規模は「200ノード級」「300エッジ規模」という指示の趣旨(厳密に200/300で
       なくてよい)に対し、生成ロジックから機械的に導出した値がちょうど200ノード/300エッジに
       一致するよう定数を選んだ(`generateLoadSample`が返す`expectedNodeCount`/
       `expectedEdgeCount`と実測値が一致することをテストで担保、恣意的な数値のハードコードでは
       ない)。
    2. NFR-3計測テストは「NFR-3の1000ms基準に対するpass/fail」をvitestのassertionで表現しない
       設計にした(未達の場合`npm test`が赤くなり、完了条件「全テスト緑」と直接矛盾するため)。
       実測値と1000ms基準との比較は、この申し送りとテスト出力ログ(`console.info`)を人間/指揮者が
       読んで判断する運用とした。
    3. README.mdの記法リファレンス表は「実装が実際にサポートする文法」のみを記載し(要件・設計書の
       記述と実装[`parseC4Block.ts`/`parseClassBlock.ts`]を突き合わせ済み)、Mermaid本家のC4記法に
       ある未対応機能(例: `Boundary`の汎用形、レイアウト方向指定等)は記載していない
       (指示書「アスピレーショナルでなく実装どおりに」)。

  - テスト: `tests/perf/generateLoadSample.ts`(負荷サンプル生成、テストファイルではなくヘルパー)・
    `tests/perf/perf.test.ts`(2件: 生成規模の検証+NFR-3計測)を追加。`npm test`(21 test files /
    192 tests 緑)・`npx tsc --noEmit`・`npm run lint`・`npm run build`すべて成功を確認。
  - スコープ境界: 本タスクはT5-2(最終タスク)であり、これで実装指示書のタスク分解(T0-1〜T5-2)を
    すべて完了した。NFR-3が未達のままである点は上記のとおり指揮者への申し送り事項として残る
    (指示書の指示どおり、独断でのレイアウト再設計・elkjs呼び出し方式の変更は行っていない)。

- (2026-07-19) **タスク分解外のフォローアップ(指揮者=Kennyさんからの直接依頼「ついでにそれも
  やっておいてください」に対応)。** T5-2で申し送った2件のうち、リスクの低い順に対応した。

  1. **NFR-3対策の試行**: T5-2で提案した3対策候補のうち、(b)真のWeb Worker化・(c)実機切り分けは
     いずれもビルド互換性の再検証(T2-0b相当のスパイク)や実機アクセスが要る大掛かりな話のため
     今回は見送り、まず(a)寄りの安全な選択肢として`elk.layout()`呼び出し自体のオプション調整を
     試した。指揮者自身が`src/layout/layout.ts`に一時的なプロファイル計測(`performance.now()`+
     ノード/エッジ総数のカウント)を仕込んで実測したところ、律速要因はT5-2時点の申し送り
     (「グラフ規模に依らずほぼ一定」)よりも精緻には**エッジ密度に強く相関**していた
     (L1: 26ノード/87エッジ→406ms、L2: 71/150→566ms、L3: 161/225→776ms、L4: 201/245→630ms。
     ノード数最大のL4よりエッジ密度が高いL3の方が遅い)。elkjsの`layered`アルゴリズムの
     既定`elk.layered.thoroughness`(交差最小化の反復回数、既定7)がこの規模のグラフでは
     支配的コストになっていると判断し、`thoroughness=1`(最小反復)に変更して再計測したところ、
     NFR-3計測の合計(3回平均)が約2765ms→**約1940ms(約30%減)**に改善した。`elk.edgeRouting`
     (POLYLINE)や`crossingMinimization.strategy`/`cycleBreaking.strategy`の変更も試したが
     有意な追加効果は無かったため採用していない(申し送り: 試行のみで不採用)。
     - **視覚的な劣化の有無**: `thoroughness=1`は交差最小化の反復を減らすため理論上は
       エッジ交差が増え得るが、実際にアプリが使うサンプル規模(インターネットバンキング
       サンプルで数十ノード程度)ではそもそも交差数が少なく、指揮者が実機Playwrightで
       L2/L3/L4の実際の描画をthoroughness変更の前後で目視比較したところ、レイアウトの
       見た目に有意な差は確認できなかった(既存の`tests/layout/layout.test.ts`の手計算
       期待値との突き合わせテストも全て緑のまま)。負荷サンプル(200ノード/300エッジ)側の
       視覚品質は本アプリの実運用シナリオではないため未確認(そもそも表示用ではなく
       NFR-3計測専用のテストデータ)。
     - **それでもNFR-3の1000ms基準は依然未達(約1.9倍)**。残りのコストは`elkjs`の
       GWTコンパイル済み同期フェイクワーカー経由での`elk.layout()`呼び出し自体に内在する
       ものと判断しており、これ以上の短期的で低リスクな追加チューニングの余地は
       (少なくとも指揮者が試した範囲では)見つからなかった。真の改善には(b)真のWeb Worker化
       (ビルド互換性の再検証が必要)や、そもそも4レベル分を都度フルスクラッチで計算し直さない
       設計変更(例: L4の結果からL1〜L3を導出する等、設計書§3の想定を超える再設計)が要ると
       考えられ、これらは「ついでに」の範囲を超える規模のため今回は着手していない。
     - 変更箇所は`src/layout/layout.ts`の`elkGraph.layoutOptions`に`'elk.layered.thoroughness': '1'`
       を1行追加したのみ(理由をコメントで明記)。`src/layout/layout.ts`以外は無変更。
     - 検証: `npm test`(21 files/192 tests緑、既存の座標期待値テスト含め全て変更なしで通過)・
       `tsc --noEmit`・`lint`・`build`すべて成功。`tests/perf/perf.test.ts`を3回再実行し
       1923ms/1961ms/1928ms(平均約1937ms)であることを確認(指揮者による独立実測)。

  2. **誤コミット`010301b "T3－2"`の整理**: そちらの環境(Kennyさんのマシン)で
     `git add -A`相当の操作により、指揮者⇄デバイス間の同期用スクラッチファイル
     (`_to_delete/`配下のgit内部stale lock/tmpファイル退避先、および各タスクの
     同期用tarball)221件が誤ってコミットされていた件。実害(ソースコードへの影響)は
     無いが履歴を汚すため、`.gitignore`に`_to_delete/`・`_*-sync.tar.gz`を追加した上で
     `git rm --cached -r _to_delete`(インデックスからの除外のみ。device_bashが
     ファイル削除[unlink]をサポートしないため、ワーキングツリー上の実ファイルは
     `_to_delete/`に残したまま=無害)でクリーンアップコミットを別途作成する
     (このPROGRESS.md自体の変更とは別コミットとする。理由: 「1タスク=1コミット」の
     慣習に倣い、性能対策とリポジトリ衛生の2つの別関心事を1コミットに混ぜないため)。

- (2026-07-28) **post-v1.0の機能追加「Mermaidモード」(FR-7 / 設計書§13)。** タスク分解(T0-1〜T5-2)の
  完了後、指揮者=Kennyさんからの追加要望「Mermaid記法も対応したい。レベルによって、登録したMermaidに
  表示が変わるだけでOK。C4モデルとの連携は不要」に対応した。仕様は事前に3点確認済み:
  (1) `%%L1`〜`%%L4` のマーカー方式でよい → 承認、(2) C4とMermaidの**混在は許さない**(Mermaidモードなら
  4レベル全部Mermaid)→ 承認、(3) 未登録レベルは何も表示しない → 承認。

  - **実現可能性の裏取り(実装前)**: 推測で「できます」と答えず3方向で確認した。
    ① 依存関係: `@excalidraw/mermaid-to-excalidraw@2.2.2` は `@excalidraw/excalidraw@0.18.1` が既に
    直接依存しており、依存ツリーは増えない(ただし当該パッケージの`exports`から再エクスポートされて
    いないため`package.json`への明示宣言は必要 → `npm install --save-exact`で追加済み。**そちらの環境では
    `npm install` の実行が必要**)。② 型: `parseMermaidToExcalidraw` の戻り値 `elements` は
    `ExcalidrawElementSkeleton[]` で、`render/toExcalidraw.ts` の出力=`LevelData.elements` と同一型。
    ③ 実挙動: 使い捨てのスパイクページ(`spike-mermaid/`、確認後削除済み)を立てて実ブラウザで4種類の図を
    変換させ、下記の表の挙動を実測した。
  - **設計**: 既存パイプライン(`parser → model → layout → render`)には一切手を入れず、`main.ts` の
    `buildFromSource` 1箇所で `isMermaidModeSource(source)` により経路ごと分岐する。両経路の出力は
    同じ `Map<Level, LevelData>` に収束するため、レベル切替機構(LevelController)はそのまま再利用できる。
    C4モードのコードパスは無変更(既存テスト225件が全て無修正で通過することで担保)。
  - **新規ファイル**: `src/parser/mermaidLevels.ts`(マーカー分割の純関数。DOM非依存)・
    `src/excal/mermaid.ts`(変換ラッパ。Mermaidは一時DOMを作るためブラウザ専用依存として`excal/`に閉じる。
    node環境のvitestがmermaid本体を読み込まないようにするため)・`src/samples/mermaid-levels.ts`
    (組込サンプル3。**L4を意図的に未登録**にして「未登録レベルは空表示」を通常操作で確認できるようにした)・
    `tests/parser/mermaidLevels.test.ts`(18件)。
  - **既存ファイルへの変更(最小)**:
    - `LevelData.layout` を必須→任意にした。Mermaidモードは統一モデルを持たず対応ノード表(`model.byAlias`)を
      作れないため、§8.3のアンカー保存は原理的に成立しない。`applySwitchElements` は切替前後の両方に
      `layout` がある時だけアンカー補正を行い、無い場合は要素だけ差し替える(カメラは据え置き。
      Excalidrawのおまかせ再配置より「見ている位置が飛ばない」方が体験として近いと判断。申し送り)。
    - `LevelData.files`(`BinaryFiles`)を追加し、`ExcalidrawHost.updateElements`/`applyLevelSwitch`/
      `mountExcalidraw` が受け取るようにした。画像フォールバック時のimage要素は`fileId`で参照するだけなので、
      `api.addFiles()` を呼ばないと**何も表示されない**(実装前に気付けた落とし穴)。
    - `main.ts` に `pickInitialLevel` を追加。Mermaidモードでは既定初期レベル(L2)が空になり得るため、
      要素を持つ最初のレベルから開始する。
    - `excal/host.tsx` の `fitToContent` に空シーンガードを追加。実測で、要素ゼロのシーンに対して
      `scrollToContent` を呼ぶとズームが上限(3000%)へ張り付き、その状態でAUTOに戻すとL4に貼り付いて
      戻れなくなることが分かったため(未登録レベルでFitを押すと踏む)。C4モードは常に要素があるため影響なし。
  - **変換の実測結果**(@excalidraw/mermaid-to-excalidraw@2.2.2 + mermaid@11):
    `flowchart`(subgraph無し)・`sequenceDiagram` → ネイティブ要素へ変換。
    `flowchart`(subgraph有り)・`classDiagram` → image要素1個+filesへフォールバック
    (ライブラリが`SubGraph element not found`をconsoleに出す)。**これはライブラリ側の制約で本アプリでは
    回避できない**ため、FR-7.7で許容と明記し、CLAUDE.md「Mermaid.jsに描画させない」の唯一の例外として
    記録した(Mermaidにさせているのはレイアウト計算のみで、描くのは従来どおりExcalidraw、という原則自体は不変)。
  - **検証**: `npm test`(24 files / 225 tests 緑)・`tsc --noEmit`・`lint`・`build` すべて成功。加えて
    Playwrightの実ブラウザで組込サンプル3を読み込み、L1(ネイティブ変換のflowchart)・L2(subgraphの
    画像フォールバックが**実際に表示されること**)・L3(sequenceDiagram)・L4(空表示)を目視確認。
    Mermaid文法エラーを仕込んだソースでも、該当レベルだけが空表示になりIssuesパネルにマーカー行を指す
    エラーが出て、他レベルの表示は継続することを確認。C4モード(組込サンプル1)のL1〜L4も従来どおりで
    あることを併せて確認した。
  - **検証中に見つけて直した件(エクスポート)**: `excal/host.tsx` の `exportSvgString`/`exportPngBlob` は
    `files: null` をハードコードしていた(v1.0時点ではC4モードしか無くfilesが常に不要だったため)。
    このままではMermaidモードの画像フォールバック時に、書き出したSVG/PNGから図が丸ごと欠ける。
    `ExcalidrawHost`の両メソッド・`ui/exporter.ts`・`main.ts`の呼び出しに`files`を通すよう修正し、
    実ブラウザで実際にダウンロードして確認した(L1[ネイティブ変換]=従来どおり、
    L2[画像フォールバック]=SVGに`<image ... base64>`が含まれ、PNGも図が正しく描かれている)。
    受入基準5「エクスポートの内容が画面表示と一致する」はMermaidモードでも満たしている。
  - **未対応・申し送り**: Mermaidモードでは要素の意味的な対応付けが無いため、レベル切替時の
    アンカー保存(FR-5.4)は行わない(仕様。FR-7.3)。またAUTOモードのレベル判定は従来どおり
    ズーム率のみで行うため、「未登録レベルまでズームすると空表示になる」ことは仕様どおりの挙動である
    (組込サンプル3のL4で確認できる)。

### 2026-07-28(追記2) Mermaidモード: マーカー書き忘れの案内(FR-7.8)

- **きっかけ**: Kennyが素のMermaid(`sequenceDiagram` から始まるテキスト)をそのままエディタに貼った
  ところ、Issuesパネルに「C4Contextブロックが見つかりません」だけが出て図が表示されなかった、という報告。
  仕様(FR-7.1: マーカーが1つも無ければC4モード)どおりの挙動だが、**原因がマーカーの書き忘れである
  ことにユーザーが到達できない**のが問題。Kennyの要望は「『マーカーがありません』とか表示してくれたら
  いいですね」。
- **対応**: `parser/mermaidLevels.ts` に純関数 `detectMarkerlessMermaidLine(source): number | undefined`
  を追加。マーカーが1つも無く、かつ**先頭の有効行**(空行と`%%`コメント行を読み飛ばした最初の1行)が
  Mermaidの図種キーワードで始まる場合に、その行番号を返す。`main.ts` の `buildFromSource` のC4モード側で
  これを呼び、検出時にIssuesパネルへ案内エラーを1件追加する。
- **設計判断(申し送り)**:
  - モード判定(`isMermaidModeSource`)は**変えていない**。自動でMermaidモードへ切り替えるのではなく
    案内を出すだけに留めた。マーカー方式はKenny承認済みの仕様であり、判定に推測を混ぜると
    「なぜかC4モードにならない」という逆向きの分かりにくさを生むため。
  - キーワード一覧に **`classDiagram` は意図的に含めない**。本アプリのC4モードでは `classDiagram` が
    L4(コードレベル)の正規の入力ブロックであり、含めると「C4モードでclassDiagramだけ書いて
    C4Contextを書き忘れた」ケースに的外れな案内を出してしまう。同様に `C4Context`/`C4Container`/
    `C4Component` も対象外。
  - 判定に使うのは**先頭の有効行1行だけ**。以降の行まで走査すると、正しいC4ソースの途中に現れた語を
    拾って誤検出する。
  - キーワード一覧の網羅性は必須ではない。この一覧は描画可否には一切関与せず**案内を出すか否かだけ**を
    決めるため、取りこぼしても「案内が出ないだけ」で、マーカーさえ書けば従来どおり描画される。
  - `model/build.ts`(C4解析本体)は**引き続き無変更**。C4モードの解析結果は変わらず、issuesに1件
    追記するだけに留めている。
- **検証**: `npm test`(24 files / **237 tests** 緑。`detectMarkerlessMermaidLine` のテスト12件を追加)・
  `tsc --noEmit`・`lint`・`build` すべて成功。加えてPlaywrightの実ブラウザで、Kennyが実際に貼ったのと
  同じ素のsequenceDiagramを入力し、案内エラーが表示されることを目視確認
  (`[エラー] L1: Mermaidの図のようですが、レベルマーカーがありません。…`)。先頭に `%%L2` を1行足すと
  Issuesパネルが「問題なし」になりシーケンス図が描画されること、C4モードのソースでは案内が出ないこと
  (回帰なし、`PAGE_ERRORS=[]`)も併せて確認した。

### 2026-07-29 セマンティックズームのL8拡張(FR-7.9)

- **経緯**: Kennyから「L8までお願いします。L5〜L8はMermaid記法のみ対応してるという認識でOK」という追加要望。
  これに合わせ要件定義書・アーキテクチャ設計書を更新した(本項目はdocs反映担当によるもの)。
- **実装概要(実装担当の確定済み設計を反映)**: `model/types.ts` の `Level` 型を `1|2|3|4` から
  `1|2|3|4|5|6|7|8` に拡張。`constants.ts` の `LOD_ZOOM_THRESHOLDS` に `[0.75, 1.5, 3.0]`(先頭3値は不変)
  の後ろへ `[4.5, 6.75, 10.0, 15.0]` を追加した7値構成にした。`camera/lod.ts` の `nextLevel` に第3引数
  `maxLevel` を追加し、呼び出し側がC4モードは`maxLevel=4`、Mermaidモードは`maxLevel=8`を渡す。
  `camera/levelController.ts` の `LevelControllerState` に `maxLevel` を追加し、`updateModel` で更新を受け、
  モード切替で現在レベルが上限を超えたときはカメラに触れず上限レベルへ丸める。Mermaidモードのレベル
  マーカーは `%%L1`〜`%%L8` に拡張。ツールバーのレベルボタンをL1〜L8の8個にし、C4モード中はL5〜L8ボタンを
  disabledにする。要件定義書FR-7.8の案内メッセージ文面を `%%L1 (〜%%L4)` から `%%L1 (〜%%L8)` に更新。
  `main.ts` はC4モードではL1〜L4のみ射影/レイアウト計算し、L5〜L8には空の`LevelData`を入れて
  `Map<Level, LevelData>` を8レベル分揃える。組込サンプル「Mermaid(レベル別)」をL1〜L7登録・L8未登録に
  変更。あわせて `index.html` のサンプル選択肢からMermaidサンプルが漏れていたバグを修正した。
- **設計判断(申し送り)**:
  1. 既存の3つのしきい値([0.75, 1.5, 3.0])を変更せずそのまま残し、新しい4値を末尾に追加する形にした。
     これによりFR-5.1の既存受入基準(L1: s<0.75 / L2: 0.75≤s<1.5 / L3: 1.5≤s<3.0)と既存の`lod.ts`テストが
     無効化されない。
  2. C4モードは`nextLevel`に`maxLevel=4`を渡し、AUTO判定を頭打ちにした。これにより3.0倍を超えるズームでも
     C4モードがL5(空データ)へ落ちる回帰を防いでいる。
  3. C4モード中のL5〜L8ボタンは非表示ではなく**disabled表示**にした。ボタン数が(モードにより)動的に
     増減して見えるとツールバーの幅が変動してしまうため、常に8個表示した上で押せないようにする方を
     選んだ。
  4. C4モードのL5〜L8は射影/レイアウトを計算せず空データで埋める。C4モデルにはL5以降の意味論が無く
     計算対象が存在しないため、無駄なelkjs呼び出しを避けつつLevelControllerの「全レベル分そろっている」
     という契約は保つ。
  5. 新しいしきい値の最大値15.0倍は、Excalidrawのズーム上限(3000%=30.0倍)の範囲内であり到達可能。
- **検証結果**: `npm test` 262件すべてpass(既存237件+今回追加25件)。`tsc --noEmit`・`npm run lint`・
  `npm run build` すべて成功。加えてPlaywrightの実ブラウザで次を目視・プログラム確認した(`PAGE_ERRORS=[]`)。
  (a) C4モード(インターネットバンキング)起動直後、L1〜L4がenabled・L5〜L8がdisabled。
  (b) C4モードでズーム率3000%(=しきい値15.0倍相当を大きく超える)まで拡大しても表示は「現在: L4 (AUTO)」の
  ままで頭打ちになり、空のL5へ落ちる回帰は起きない。
  (c) サンプル「Mermaid(レベル別)」読込後はL1〜L8すべてenabledになり、L5・L6・L7・L8の各ボタンで手動固定でき
  バッジ表示も追従する。Fit後の実画面でL4(stateDiagram-v2)・L5(erDiagram)・L6(flowchart)・L7(sequenceDiagram)
  が描画され、未登録のL8のみ空表示になること、Issuesパネルが全レベルで「問題なし」であることを確認。
  (d) MermaidモードのL7表示中にエディタの内容をC4ソースへ全置換すると、表示が「現在: L4 (固定)」へ丸められ、
  L5〜L8ボタンがdisabledに戻る。
- **既知の未対応(申し送り)**: 上記(c)の8レベルはサンプルとテストで検証済みだが、`%%L5`以降を使うと
  ズームだけでL5〜L8へ到達するにはズーム率が概ね450%〜1500%相当まで必要になる。AUTOでの到達自体は
  Excalidrawのズーム上限(3000%)内で可能だが、実運用では手動固定ボタンの方が現実的な操作になると思われる。
  しきい値の再調整が必要になった場合は `constants.ts` の `LOD_ZOOM_THRESHOLDS` 末尾4値のみを変えれば足りる
  (先頭3値はFR-5.1の受入基準に紐づくため据え置くこと)。

## 2026-07-29 アプリ名を「Mermarium(マーマリウム)」に改称

- **経緯**: Kennyの決定。「C4モデルの使い方より、Mermaidの横縦展開の方が需要がありそう」との判断から、
  アプリ名を旧称「C4 Model Whiteboard Viewer」(および検討段階で挙がっていた「ZoomBoard」)ではなく
  **Mermarium(マーマリウム)** とした。Mermaid + aquarium の造語で「人魚(Mermaid)が泳ぐ水槽」の意。
- **変更範囲**: `index.html`の`<title>`とツールバーのブランド表示(`#app-brand`)、`src/style.css`の
  `#app-brand`スタイル、`package.json`の`name`(`app-c4modelgenerator`→`mermarium`)、`README.md`と
  `CLAUDE.md`のH1およびリード文、`docs/01`〜`docs/03`のH1(および要件定義書のプロジェクト名欄)、
  `flyer.html`の`<title>`・`<h1>`・フッタータグ。
- **設計判断(申し送り)**:
  1. **localStorageキーは改名しない**。`STORAGE_KEY = 'c4-model-whiteboard-viewer:source'` と
     `STORAGE_TITLE_KEY = 'c4-model-whiteboard-viewer:title'` を`mermarium:*`に変えると、既存利用者の
     保存済みソースとタイトルが読めなくなり黙って失われる。改名の価値より損失が大きいため据え置いた。
     移行が必要になった場合は「旧キーを読んで新キーへ書き戻す」ワンショット移行を別途設計すること。
  2. **リポジトリ名・フォルダ名は変更しない**(`APP_C4ModelGenerator` /
     `APP_C4-Model-Whiteboard-Viewer`)。GitHubのリポジトリ名変更とローカルclone先の移動はKennyの
     操作領域であり、コード側から行える変更ではない。設計書§2のディレクトリツリーも実体に合わせて
     `APP_C4ModelGenerator/` のままにしてある。
  3. ツールバー先頭に**アプリ名の固定表示**(`#app-brand`)を追加した。改名が実行中の画面のどこにも
     現れないのは不自然なため。既存の`#title-input`(ドキュメントタイトル)と紛らわしくならないよう、
     入力欄ではないことが分かる色(#2a6f97)と字形にしている。
  4. README/CLAUDE.mdのリード文は、Kennyの「Mermaidの方が需要がある」という判断に合わせ、
     Mermaidモードを先・C4モードを後の順に書き換えた。機能そのものの優劣・削除は行っていない。
- **検証結果**: `npm test` 262件すべてpass、`tsc --noEmit`・`npm run lint`・`npm run build` すべて成功。
  Playwrightの実ブラウザでツールバーに「Mermarium」が表示されること、`document.title`が
  「Mermarium(マーマリウム)」であること、localStorage移行の回帰が無い(旧キーで保存したソースが
  リロード後も復元される)ことを確認(`PAGE_ERRORS=[]`)。

## 2026-07-30 Issue #3 Mermaidモードの記法対応差分(`<br/>` / title / 形状 / classDef)

- **経緯**: GitHub Issue #3「Mermaidモードで解釈される記法の範囲が本家Mermaidと異なる
  (title / 形状 / classDef が反映されない)」。Kennyの「Mermariumの強みは素のMermaid記法をそのまま
  書けること」という価値判断に基づく報告。
- **調査結果: Issueの前提は3点のうち2点が誤りで、真の原因は`<br/>`だった**(指揮者がライブラリ境界の
  プローブとPlaywrightの実表示で実測)。
  1. **`classDef` / `class` / `style` は両経路で正しく効いている**(Issueの指摘は誤り)。ライブラリ返却値で
     `backgroundColor: "#EDE7F6"` / `strokeColor: "#5E35B1"` を確認し、実画面でも着色を目視確認した。
  2. **`title:`が消えるのはネイティブ変換経路だけ**。ラスタ画像フォールバック経路はmermaid自身が
     SVG内にタイトルを描くため元から表示されている(実測: title有りでSVG高さ119.3→159.4)。
  3. **真の原因は`<br/>`で、経路ごとに別の壊れ方をしていた**。
     - ネイティブ変換経路: ラベルが `一行目<br>二行目` という**文字列のまま**表示される
       (flowchartは`<br>`へ正規化、sequenceDiagramは`<br/>`のまま。エッジラベルも同様)。
     - ラスタ画像フォールバック経路: mermaidが`<foreignObject>`内へ**閉じていない`<br>`**を出力するため
       SVGがXMLとして不正になり、Chromiumの`<img>`が読み込みを拒否して**図全体が「壊れた画像」アイコン**に
       なっていた(下部パネルは「問題なし」のままなので原因に気づけない)。DOMParserのエラーは
       `Opening and ending tag mismatch: br line 1 and p`。`<img>`読み込みプローブで`<br>`を含む場合のみ
       ERRORになることを切り分け済み。
  4. **形状が長方形へ丸められるのはExcalidrawの原理的限界**。Excalidrawが持つ閉じた図形は
     rectangle / ellipse / diamond の3種類だけ。実測した全対応: rect→rectangle、round `()`→rectangle+
     roundness{type:3}、stadium `([])`→同(近似)、subroutine `[[]]` / cylinder `[()]` / asym `>]` /
     hexagon `{{}}` / parallelogram `[//]`・`[\\]` / trapezoid `[/\]`・`[\/]`→素のrectangle、
     circle `(())`→ellipse、doublecircle→ellipse2枚、rhombus `{}`→diamond。
- **実装した対応(4件)**:
  1. `src/excal/mermaid.ts` — ライブラリ境界で`<br>`を後処理で修復。ネイティブ変換経路は`label.text`の
     `<br>`類を`\n`へ置換(`fixBrInLabel`)、ラスタ画像経路はSVGのdataURLをUTF-8のまま復号して
     閉じていない`<br>`を`<br/>`へ直し再エンコードする(`fixUnclosedBrInFiles`)。
  2. `src/parser/mermaidLevels.ts` — DOM非依存の純関数を2つ追加。`extractMermaidTitle`(frontmatterの
     `title:`を取り出す)と`findCollapsedShapeTokens`(長方形へ丸められる記法を検出する)。テスト24件追加。
  3. `src/main.ts` — ネイティブ変換経路のときだけ、タイトルのtext要素を図の左上に足し
     (`appendMermaidTitleElement`)、丸められた形状を下部パネルへ警告として出す。
  4. `README.md` — 新節「Mermaidモードの記法対応状況」に2経路の説明と12行の形状対応表を追加。
- **設計判断(申し送り)**:
  1. **`<br>`はソースの前処理ではなく変換結果の後処理で直す**。ソース側で置換するとmermaidの
     レイアウト計算そのものが変わって行の高さが狂う。実測でmermaidは`<br/>`込みで既に2行分の箱を
     確保している(h=90 vs 無しでh=60)ため、後処理で`\n`にしても文字がはみ出さない。
  2. **「ネイティブ変換経路か」の判定は`files === undefined`で行う**。`excal/mermaid.ts`のJSDocどおり、
     `files`が定義されるのはラスタ画像フォールバックのときだけ。この判定でtitle補完と形状警告の
     両方をネイティブ経路に限定している(ラスタ経路はmermaid本家が忠実に描くので補完も警告も不要かつ有害)。
  3. **形状の丸めは直さない**(直せない)。Excalidrawに図形が無いため、警告で知らせて`subgraph`による
     ラスタ経路への回避策をREADMEに書くのが最単純解。図形の自作(線の組み合わせでの近似)は
     スコープ外とした。
  4. **READMEの「外部CDNにも依存しません」という記述は誤りだったので削除した**。Excalifontは実行時に
     `https://esm.sh/@excalidraw/excalidraw@0.18.1/dist/prod/fonts/...` から取得される
     (ネットワークの無い環境では`ERR_TUNNEL_CONNECTION_FAILED`になり手描き風フォントだけが落ちる)。
     真にCDN非依存にするならフォントのローカル同梱が別途必要で、これは未対応(申し送り)。
- **検証結果**: `npm test` 287件すべてpass(24ファイル)、`tsc --noEmit`・`npm run lint`・`npm run build`
  すべて成功。Playwrightの実ブラウザで次を確認(`PAGE_ERRORS=[]`)。
  (a) ネイティブ変換経路(`%%L7`のflowchart)でラベルの`<br/>`が実際の改行として2行で表示され、
     frontmatterの`title:`が図の上に表示され、classDefの紫の塗りも効いている。
  (b) 修正前は「壊れた画像」アイコンだったラスタ画像フォールバック(`subgraph`+`<br/>`+`classDef`)が、
     frontmatter有り・無しの両方で図として正しく描画される(平行四辺形・シリンダの形状も忠実)。
  (c) 形状警告が下部パネルへ出る(`%%L6 の シリンダ [(...)]、平行四辺形 [/.../] はExcalidrawに無い
     図形のため長方形で描画しました…`)。
  (d) 回帰なし: C4モードのL1〜L4、サンプル「Mermaid(レベル別)」のL1〜L8すべてが従来どおり描画され、
     Issuesパネルは全レベルで「問題なし」(ラスタ経路にあたる`%%L2`のcylinderへ誤って警告が出ない
     ことも確認)、localStorageキーも変わらずリロード復元が効く。

## 2026-07-30 Issue #1/#2/#5 レベル名・軸の意味・プロファイル

### 3件の関係(調査で分かったこと)

3つのIssueは**同じ問いを3つのスケールで言い換えたもの**だった。#5は「このレベルは何か」(個々の名前)、
#2は「L1→L8という軸そのものが何を意味するのか」(軸の意味)、#1は「その組み合わせを他の人が
再利用できる形にしたい」(プロファイル)。つまり **プロファイル(#1) = 軸の意味(#2) + レベル名の集合(#5)**
であり、#1は他の2つの合成にすぎない。よって #5 → #2 → #1 の順に積み、#1のための新しい仕組みは作らない。

また、Issue #5のOption C(図の中にタイトルを描く)は 2026-07-30 のIssue #3対応で**既に実装済み**だった
(`extractMermaidTitle` + `appendMermaidTitleElement`)。#5で残っていたのはツールバー側の表示だけ。

### Kennyの決定

- **`%%L1: 理想の姿` 記法は不採用**。「これはただのユースケースだから。READMEとかに参考例を記入するのは
  いいけど。」→ FR-7.2(マーカーは単独行のみ)は**改訂しない**。レベル名はfrontmatterの`title:`で付ける。
- **MODEは3値**(`zoom` / `views` / `reader`)でよい。
- **`views`でオートズームを止める挙動は入れない**(実際に使ってから判断する)。

### 実測した「今日の壊れ方」(Option A不採用の判断材料として先に取った証拠)

`%%L1: 理想の姿` を書いた場合の当時の挙動をブラウザで実測した。

- 名前付きマーカーだけの文書 → マーカーが1つも無いためC4モードに落ち、
  「C4Contextブロックが見つかりません」+ FR-7.8の案内が出る。**なぜ落ちたのか分からない。**
- 2つ目に素の`%%L2`がある文書 → L1の図まるごとが「最初のマーカーより前の行」として警告付きで捨てられ、
  **L1に何も表示されない**。警告文は「どのレベルにも属さないため無視します」だけで原因を指していない。

記法を採らない以上この分かりにくさは残るため、**検出して警告を出すだけ**の対応(FR-7.11)を入れた。
FR-7.2の挙動そのものは1ミリも変えていない。

### 実装した4点

1. `parser/mermaidLevels.ts`: `AxisMode`(`'zoom'|'views'|'reader'`)/ `DEFAULT_AXIS_MODE` /
   `MermaidLevelsResult.axisMode` を追加。`MODE_LINE_PATTERN = /^%%\s*MODE\s*:\s*(.*)$/i`。
   未知値は警告+`zoom`フォールバック、複数行は先勝ち+警告(`%%Ln`重複と同じ方針)。
   最初のマーカーより前の`%% MODE:`行はFR-7.5の「マーカーより前の非空行」警告の対象外にした
   (ソース先頭が標準的な置き場所のため)。レベル本文中の`MODE`行は本文に残す(正当なMermaidコメント)。
2. `parser/mermaidLevels.ts`: `findNamedMarkerLikeLines`(`NAMED_MARKER_LIKE_PATTERN =
   /^%%\s*L([1-8])\b\s*\S/i`)。検出のみを行い警告は作らない純関数。
3. `main.ts` / `index.html` / `style.css`: `BuildResult.axisMode?: AxisMode`(C4モードはキーごと省略)、
   ツールバーの`#axis-mode`に`renderAxisMode`が文言を書くだけ。`buildFromSource`を
   `buildFromSourceInner`のラッパーにして、名前付きマーカー警告をモード分岐の**外側**で足した
   (名前付きマーカーだけの文書はC4モードに落ちるため、内側だと拾えない)。
4. `src/samples/views-profile.ts`(組込サンプル「プロファイル例(採用プロセス/ビュー軸)」)を追加。
   `%% MODE: views` + 各レベルのfrontmatter `title:`。題材はC4と無関係な採用プロセス。
   `subgraph`/`classDiagram`を使わず全レベルがネイティブ変換経路を通る。

### 設計判断(申し送り)

- **`axisMode`を`LevelData`/`LevelControllerState`に持たせなかった。** 表示専用でレベル切替にもLOD判定にも
  影響しないため、状態機械に混ぜると無関係な値が状態遷移の対象になる。`main.ts`が直接DOMへ書くだけにした。
- **`#level-badge`(ビューワー内バッジ)の文言は変えていない。** 軸モードはツールバーのみ。
- **プロファイル(#1)に仕組みを作らなかった。** テンプレートエンジンや定義ファイルを先に作ると、使われ方が
  分かる前に形が固まる。#2と#5が揃えばプロファイルは書き方の規約で表現でき、C4モードは事実上
  「C4プロファイル」である。見本サンプル1本 + READMEの節で示すに留めた。
- **`isMermaidModeSource`の判定条件は変えていない。** `%% MODE:`行だけの文書はMermaidモードにならない。

### 検証結果(客観)

- `tsc=0 test=0 lint=0 build=0`、prettier全通過、変更9ファイルのNULバイト0(クラウド側・端末側とも)。
- ブラウザ実測(`/tmp/verify_issue125.js`):
  `%% MODE: views`→`軸: ビュー(視点)` / `reader`→`軸: 読者(対象者)` / 無指定→`軸: ズーム(詳細度)` /
  未知値`hoge`→`軸: ズーム(詳細度)`+警告1件 / MODE2行→先勝ち`views`+警告1件。
- `%%L1: 理想の姿` → FR-7.11の警告が出るようになった(「…この行はレベルマーカーとして扱いません。
  マーカーは %%L1 だけの行にしてください。レベルに名前を付けたいときは、その図の先頭に
  --- / title: 名前 / --- を書きます。」)。
- サンプル「プロファイル例」→ `軸: ビュー(視点)`、L1〜L4すべて描画、Issues「問題なし」
  (`/tmp/i125_vp_L1..L4.png`)。C4サンプル「インターネットバンキング」→ 軸表示は空、回帰なし。
- READMEに載せたコピペ例2つを実際に貼って動作確認(`/tmp/rm_minimal.png` / `/tmp/rm_titled.png`)。
  どちらもIssues「問題なし」、frontmatterの`title:`がキャンバス上に見出しとして描かれる。
- `PAGE_ERRORS=[]`。

### 検証時の注意(次に同じ検証をする人向け)

Playwrightで`.cm-content`にpasteを流し込む検証スクリプトは、**ページ読み込み直後の1回目だけ
`selectAll`+`delete`が効かず、既存ソース(localStorage復元分)に追記されてしまう**。1回目の結果を
バグと誤読しないこと。実際にこれで`%% MODE: views`だけが壊れて見える偽陽性を1度出した。
先頭にダミーの1件(warmup)を入れて回避する。
