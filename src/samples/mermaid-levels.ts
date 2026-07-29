/**
 * 組込サンプル3「Mermaid(レベル別)」(post-v1.0のMermaidモード)。
 *
 * `%%L1`〜`%%L8` のマーカーでレベルごとに別々のMermaid図を登録する記法そのものの見本を兼ねる。
 * C4モードの2サンプル(internet-banking / ec-site)とは排他で、このサンプルを読み込むと
 * `parser/mermaidLevels.ts`の`isMermaidModeSource`がtrueになりMermaidモードに切り替わる。
 *
 * post-v1.0のL5〜L8拡張(セマンティックズームL1〜L8化)に伴い、EC注文フローの続きとして
 * L1〜L7を段階的に細かい粒度で埋め、**L8を意図的に未登録のまま**にしている。Kennyの仕様確認どおり
 * 「未登録のレベルは何も表示しない」挙動を、通常の操作(サンプル読込+L8ボタン)でそのまま
 * 確認できるようにするため(ec-siteサンプルがC4モードで同じ役割を担っているのと同じ考え方。
 * 従来はL4が未登録の代表だったが、L4を実図で埋めたためL8へ役割を移した)。
 *
 * 各レベルの図種と変換経路(`excal/mermaid.ts`の実測メモ参照):
 * - L1: flowchart(subgraph無し)→ ネイティブ要素変換。全体像(登場人物)。
 * - L2: flowchart(subgraph有り)→ 1枚の画像へフォールバック。システム内部構成。
 * - L3: sequenceDiagram → ネイティブ要素変換。注文時のやり取り。
 * - L4: stateDiagram-v2 → ネイティブ要素変換。注文ステータスの遷移。
 * - L5: erDiagram → ネイティブ要素変換。注文まわりのデータモデル。
 * - L6: flowchart(subgraph無し)→ ネイティブ要素変換。倉庫出荷フローの詳細。
 * - L7: sequenceDiagram → ネイティブ要素変換。返品申請時のやり取り。
 * - L8: 未登録(「未登録のレベルは何も表示しない」の確認用)。
 *
 * 画像フォールバック(L2、host.tsxのregisterFiles)とネイティブ変換(その他)の両方の経路を
 * このサンプル1つで踏めるため、動作確認にはこのサンプルで足りる。
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

%%L4
stateDiagram-v2
  [*] --> 注文受付
  注文受付 --> 決済待ち
  決済待ち --> 決済完了: 決済成功
  決済待ち --> 注文キャンセル: 決済失敗
  決済完了 --> 出荷準備
  出荷準備 --> 出荷済み
  出荷済み --> 配送完了
  配送完了 --> [*]
  注文キャンセル --> [*]

%%L5
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  ORDER_ITEM }o--|| PRODUCT : references
  ORDER ||--o| PAYMENT : has
  ORDER ||--o| SHIPMENT : has

%%L6
flowchart TD
  WH["倉庫"] --> PICK["ピッキング"]
  PICK --> PACK["梱包"]
  PACK --> LABEL["送り状発行"]
  LABEL --> CARRIER["配送業者へ引き渡し"]
  CARRIER --> TRACK["追跡番号を通知"]

%%L7
sequenceDiagram
  participant C as 購入者
  participant W as Webフロントエンド
  participant A as 注文API
  participant R as 返品受付システム
  C->>W: 返品を申請する
  W->>A: POST /orders/{id}/return
  A->>R: 返品受付を登録
  R-->>A: 返品受付番号
  A-->>W: 返品受付完了
  W-->>C: 返品受付完了画面
`;
