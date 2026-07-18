/**
 * 組込サンプル2「ECサイト」(設計書 docs/02_アーキテクチャ設計書.md §2、実装指示書T4-2)。
 *
 * FR-1.5「最低2件のサンプル」を満たすための2つ目の組込サンプル。internet-bankingサンプルとは
 * 対照的に、意図的に小規模かつ**L1+L2のみ**(C4Component/classDiagramブロックを含まない)に
 * とどめている。これにより「L3/L4のデータが定義されていないモデル」(FR-5.7の極端なケース:
 * 1つのシステム全体がどのレベルまで深掘りしてもコンポーネント展開を持たない)でアプリが
 * クラッシュせず正しく縮退表示できることを、通常の操作(サンプル読込)で確認できるようになる。
 */
export const ecSiteSample: string = `C4Context
  title ECサイト - Context
  Person(customer, "購入者", "商品を検索・購入する一般利用者")
  System(ec, "ECサイト", "商品カタログの閲覧と注文受付を提供")
  System_Ext(payment, "決済代行サービス")
  Rel(customer, ec, "商品を閲覧・購入する", "HTTPS")
  Rel(ec, payment, "決済を依頼", "HTTPS")

C4Container
  System_Boundary(ec, "ECサイト") {
    Container(web, "Webフロントエンド", "React", "商品一覧・カート・注文画面")
    Container(api, "APIサーバー", "Node.js/Express", "商品・注文の業務ロジック")
    ContainerDb(db, "商品/注文DB", "PostgreSQL")
  }
  Rel(customer, web, "利用する", "HTTPS")
  Rel(web, api, "呼び出す", "JSON/HTTPS")
  Rel(api, db, "読み書き", "SQL")
  Rel(api, payment, "決済を依頼", "HTTPS")
`;
