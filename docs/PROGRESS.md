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
