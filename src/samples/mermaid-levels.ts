/**
 * 組込サンプル3「Mermaid(レベル別)」(post-v1.0のMermaidモード)。
 *
 * `%%L1`〜`%%L4` のマーカーでレベルごとに別々のMermaid図を登録する記法そのものの見本を兼ねる。
 * C4モードの2サンプル(internet-banking / ec-site)とは排他で、このサンプルを読み込むと
 * `parser/mermaidLevels.ts`の`isMermaidModeSource`がtrueになりMermaidモードに切り替わる。
 *
 * 意図的に4レベル全部は埋めず**L4を未登録のまま**にしている。Kennyの仕様確認どおり
 * 「未登録のレベルは何も表示しない」挙動を、通常の操作(サンプル読込+L4ボタン)で
 * そのまま確認できるようにするため(ec-siteサンプルがC4モードで同じ役割を担っているのと同じ考え方)。
 *
 * L1(subgraph無しのflowchart)とL3(sequenceDiagram)はExcalidrawのネイティブ要素へ変換され、
 * L2(subgraph有りのflowchart)は1枚の画像へフォールバックする(`excal/mermaid.ts`の実測メモ参照)。
 * 3レベルで変換経路の両方を踏むため、画像フォールバック配線(host.tsxのregisterFiles)の
 * 動作確認にもこのサンプル1つで足りる。
 */
export const mermaidLevelsSample: string = `%%L1
flowchart TD
  CUSTOMER["購入者"] --> SHOP["オンラインショップ"]
  SHOP --> PAY["決済代行"]
  SHOP --> SHIP["配送業者"]

%%L2
flowchart TD
  CUSTOMER["購入者"] --> WEB["Webフロントエンド"]
  subgraph SHOP["オンラインショップ"]
    WEB --> API["注文API"]
    API --> DB[("注文DB")]
  end
  API --> PAY["決済代行"]

%%L3
sequenceDiagram
  participant C as 購入者
  participant W as Webフロントエンド
  participant A as 注文API
  participant P as 決済代行
  C->>W: 注文する
  W->>A: POST /orders
  A->>P: 決済を依頼
  P-->>A: 決済完了
  A-->>W: 注文番号
  W-->>C: 注文完了画面
`;
