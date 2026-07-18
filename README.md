# APP_C4ModelGenerator — C4 Model Whiteboard Viewer

C4モデル(Context / Containers / Components / Code の4階層でソフトウェアアーキテクチャを表現する手法)をテキスト(Mermaid C4記法のサブセット+拡張)で入力し、ブラウザ上のホワイトボードで閲覧するビューワーです。

## 概要

- **セマンティックズーム**が核機能です。地図アプリで縮尺を上げると国→都市→街区と表示が変わるように、図をズームインすると閾値を跨いだところで **Context図(L1) → Container図(L2) → Component図(L3) → Code図(L4)** へと描画レベルが自動的に切り替わります。ズームアウトすると逆順に戻ります。
- ズーム切替の瞬間、カーソル直下(またはビューポート中心)にあったノードが、切替後も同じ画面位置に来るようカメラを補正します(アンカー保存)。「あるシステムに向かってズームインすると、その中身がその場で展開される」体験を実現します。
- 画面左のエディタ(CodeMirror 6)にテキストを入力すると、約300ms後に自動で再解析・再描画されます。パン/ズーム位置は再描画後も維持されます。
- 解析エラー・警告は行番号付きでエディタ下部のパネルに表示され、クリックすると該当行にジャンプします。
- ソースはブラウザのlocalStorageに自動保存され、次回起動時に復元されます。組込サンプル(「インターネットバンキング」「ECサイト」)をメニューから読み込めます。
- 現在の表示レベルの図をSVG/PNG(2倍解像度)でエクスポートできます。
- 描画キャンバスにはOSSの[Excalidraw](https://excalidraw.com/)を使用し、手描き風ホワイトボードの見た目で表示します(閲覧専用。図の直接編集は不可。編集は常にテキスト経由)。レイアウトは[elkjs](https://github.com/kieler/elkjs)による自動階層レイアウトです。
- サーバー不要。ビルド成果物は静的ファイルのみで、外部CDNにも依存しません(全依存をバンドル)。

詳しい要件・設計は `docs/` 配下を参照してください。

- `docs/01_要件定義書.md` — 何を作るか(要件・受入基準)
- `docs/02_アーキテクチャ設計書.md` — どう作るか(DSL仕様・データモデル・射影/LODアルゴリズム)
- `docs/03_実装フェーズ計画.md` — フェーズ分割と完了条件
- `docs/04_実装指示書.md` — タスク分解と実装エージェント向けの作業原則
- `docs/PROGRESS.md` — 進捗チェックリストと申し送り

## 起動方法

Node.js(npm)が使える環境で、リポジトリのルートディレクトリで以下を実行します。

```bash
npm install     # 依存関係のインストール(初回、およびpackage.json変更後は必ず実行)
npm run dev     # 開発サーバー起動(http://localhost:5173 などで表示される)
npm test        # vitestによるユニットテスト実行
npm run build   # 型チェック(tsc)+ 静的ビルド(dist/ に出力)
npm run lint    # ESLint + Prettierチェック
npm run preview # npm run build 後、成果物(dist/)をローカルで確認
```

`npm run build` の成果物(`dist/`)はサーバー不要の静的ファイル一式です。任意の静的サーバー(例: `npx serve dist`)や `npm run preview` で配信できます。

## 記法リファレンス

入力はMermaid C4記法のサブセット+本アプリの拡張です。ソーステキストは `C4Context` / `C4Container` / `C4Component` / `classDiagram` の4種類のブロックから構成され、ブロックは行頭のキーワードで始まり、次のブロック開始行またはファイル末尾までが本体です(インデント自由、空行と `%%` コメント行は無視。ただし `%% code-of:` は指令として解釈)。未対応の文は「警告」としてその行を無視し、解析できた部分だけで描画を継続します。実装の正は `src/parser/parseC4Block.ts` / `src/parser/parseClassBlock.ts` です。

### C4Context / C4Container / C4Component ブロックの文法

引数は `(` `)` 内のカンマ区切り。各引数は `"..."` 引用符付き文字列または裸の識別子(引用符内のカンマは区切りとみなしません)。`$tag=...` 形式の名前付き引数は無視されます(警告なし)。

| 文                                                                     | 意味                                                                                           | 備考                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Person(alias, label, ?descr)`                                         | 人物ノード                                                                                     |                                                                             |
| `Person_Ext(alias, label, ?descr)`                                     | 外部の人物ノード                                                                               | 塗りが灰色になる                                                            |
| `System(alias, label, ?descr)`                                         | システムノード                                                                                 |                                                                             |
| `System_Ext(...)`                                                      | 外部システム                                                                                   |                                                                             |
| `SystemDb(...)` / `SystemDb_Ext(...)`                                  | DB variantのシステム                                                                           | シリンダー近似で描画                                                        |
| `SystemQueue(...)` / `SystemQueue_Ext(...)`                            | キュー variantのシステム                                                                       |                                                                             |
| `Container(alias, label, ?tech, ?descr)`                               | コンテナノード                                                                                 | tech引数あり(第3引数)                                                       |
| `Container_Ext(...)` / `ContainerDb(...)` / `ContainerQueue(...)` など | External/Db/Queueの組合せ                                                                      | Container/Component系は全組合せ対応                                         |
| `Component(alias, label, ?tech, ?descr)`                               | コンポーネントノード                                                                           |                                                                             |
| `Component_Ext(...)` / `ComponentDb(...)` / `ComponentQueue(...)` など | 同上                                                                                           |                                                                             |
| `System_Boundary(alias, label) { ... }`                                | C4Containerブロック内で使用。`alias`が一致するContextのSystemに、内側のContainer群を結び付ける | `{`は宣言行末尾/単独行どちらも可。閉じ忘れはブロック終端で暗黙クローズ+警告 |
| `Container_Boundary(alias, label) { ... }`                             | C4Componentブロック内で使用。`alias`が一致するContainerにComponent群を結び付ける               | 同上                                                                        |
| `Enterprise_Boundary(alias, label) { ... }`                            | C4Contextブロック内の視覚的グループ化(破線枠)。内側のPerson/Systemを囲む                       | エッジ射影の対象にならない                                                  |
| `Rel(from, to, label, ?tech)`                                          | 有向エッジ                                                                                     | `from`/`to`はグローバルなalias参照(レベルをまたいでも可)                    |
| `BiRel(from, to, label, ?tech)`                                        | 双方向エッジ                                                                                   |                                                                             |
| `Rel_U` / `Rel_D` / `Rel_L` / `Rel_R` / `Rel_Up` などの方向付きRel     | `Rel`と同義                                                                                    | 方向ヒントは無視(警告なし)                                                  |
| `title ...`                                                            | 無視                                                                                           | 警告なし                                                                    |
| `UpdateRelStyle` / `UpdateElementStyle` / `UpdateLayoutConfig`         | 無視                                                                                           | 警告なし                                                                    |
| 上記以外の非空行                                                       | 「未対応の文」として警告し、その行を無視                                                       |                                                                             |

`Person`/`System`/`Container`/`Component` の基底語は `_Ext`(外部)サフィックスと `Db`/`Queue`(variant)サフィックスの組合せを一律に解釈します(例: `ContainerDb_Ext` も解釈可能)。

### classDiagram ブロックの文法(Code層)

Mermaidにはコード階層(L4)の標準記法が無いため、`classDiagram` ブロック+直前行の指令コメント `%% code-of: <componentAlias>` で対応するComponentに結び付けます(指令が無い/参照先が見つからない場合はブロック全体を警告付きで無視)。

| 文                                                                          | 意味                                                                          |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `class Name { ... }`(複数行可)                                              | クラスノード。ボディの各行のうち `(` を含む行はmethod、それ以外はfield        |
| `class Name`                                                                | 空のクラス(ボディ無し)                                                        |
| `A --> B` / `A --\|> B` / `A *-- B` / `A o-- B` / `A ..> B`(`: label` 任意) | クラス間のエッジ。矢印種別は描画上すべて実線矢印(継承 `--\|>` のみ白抜き三角) |
| `<<interface>>` 等の他の記法                                                | 警告なしで無視                                                                |

### 階層の結び付けルール(要約)

- `C4Context` の要素が最上位(roots)になります。ソース中に必ず1つ必要です(0個ならエラー、2個目以降は無視)。
- `C4Container` ブロックの `System_Boundary(alias, ...)` は、`alias` が一致するContextのSystemの子として、内側のContainer群を結び付けます(Boundary外の要素は警告で無視)。
- `C4Component` ブロックの `Container_Boundary(alias, ...)` も同様にContainerへ結び付けます。
- `classDiagram` は直前の `%% code-of: <componentAlias>` でComponentへ結び付けます。
- alias はソース全体でグローバルに一意です(重複はエラー、初出を採用)。
- 深いレベルの定義が無いノードはそのレベルでも箱のまま表示されます(例: L3が未定義のContainerは、L3表示でも展開されず葉ノードのまま)。

サンプルの完全な入力例は `src/samples/internet-banking.ts` / `src/samples/ec-site.ts` を参照してください(アプリの「サンプル」メニューからも読み込めます)。

## 閾値のカスタマイズ

セマンティックズームの閾値・ヒステリシス係数は `src/constants.ts` の `LOD_ZOOM_THRESHOLDS` / `LOD_HYSTERESIS_FACTOR` で一元管理しています。

```ts
// src/constants.ts
export const LOD_ZOOM_THRESHOLDS = [0.75, 1.5, 3.0] as const;
export const LOD_HYSTERESIS_FACTOR = 0.9;
```

- `LOD_ZOOM_THRESHOLDS` は正規化ズーム値 `s`(= 現在のExcalidrawズーム倍率 ÷ 起動直後にL2をFit表示した時点のズーム倍率。`src/camera/camera.ts` が算出)に対する、L1→L2 / L2→L3 / L3→L4 の各境界です。既定値は要件定義書FR-5.1の表(L1: `s < 0.75`、L2: `0.75 ≤ s < 1.5`、L3: `1.5 ≤ s < 3.0`、L4: `3.0 ≤ s`)と一致します。配列の要素数は3固定(4レベル間の3つの境界)で、値を変更すればAUTOモードでの切替タイミングが変わります。
- `LOD_HYSTERESIS_FACTOR` は「ズームアウトで1段階下のレベルへ戻る」際に適用する係数です。上昇方向(ズームイン)は閾値到達で即座に遷移しますが、下降方向(ズームアウト)は「現在レベルの下側閾値 × この係数」を下回るまで遷移しません(境界付近でのちらつき防止。詳細規則は `docs/02_アーキテクチャ設計書.md` §8.2)。値を1に近づけるほどヒステリシス幅は狭くなり、0に近づけるほど広くなります(0.9=下側10%の余裕)。
- 判定ロジック本体は `src/camera/lod.ts` の純関数 `nextLevel(current, s)` です。閾値・係数を変更した場合は `npm test`(`tests/camera/lod.test.ts`)で境界値の挙動を確認できます。

## 技術スタック

Vite / TypeScript(strict) / vitest / ESLint+Prettier / elkjs(レイアウト) / `@excalidraw/excalidraw`(描画。react/react-domはそのホストとしてのみ同梱) / CodeMirror 6(エディタ)。アプリ自体のUI(ツールバー・エディタ周辺・パネル)にはUIフレームワークを使わず、Vanilla TypeScript + DOM操作で構成しています。
