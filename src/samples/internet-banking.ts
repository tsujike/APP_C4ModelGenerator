/**
 * 組込サンプル「インターネットバンキング」(設計書 docs/02_アーキテクチャ設計書.md §5.4 のフル版)。
 *
 * §5.4 の縮約版に対し、以下を拡張して4レベル全てを網羅する構成にした(T1-3):
 *   - System をもう1つ追加(backoffice。L2/L3の展開は持たない、通常の実システム)
 *   - 外部システムをもう1つ追加(creditBureau。email と合わせて外部システム2つ)
 *   - Component をもう1つの機能に分けて2つ追加(transferSvc/notification。signin/accountsと
 *     合わせてComponent4つ)
 *   - classDiagram をもう1つ追加(code-of: transferSvc)
 *   - spa/db は元の§5.4サンプルの時点で C4Component ブロックが定義されていない
 *     (Container_Boundary は api のみ)ため、そのままで「L3未定義のContainer」の要件を満たす
 *     (FR-5.7: データ未定義ノードは箱のまま描画、を後続タスクで確認するためのテストデータ)。
 */
export const internetBankingSample: string = `C4Context
  title インターネットバンキング - Context
  Person(customer, "銀行顧客", "口座を持つ個人")
  System(ibs, "インターネットバンキング", "照会と振込を提供")
  System(backoffice, "バックオフィス管理システム", "行内業務の管理と与信審査")
  System_Ext(email, "メールシステム")
  System_Ext(creditBureau, "信用情報機関", "外部の与信情報サービス")
  Rel(customer, ibs, "利用する", "HTTPS")
  Rel(ibs, email, "通知を依頼", "SMTP")
  Rel(backoffice, ibs, "口座情報を照会", "内部API")
  Rel(backoffice, creditBureau, "信用照会", "HTTPS")

C4Container
  System_Boundary(ibs, "インターネットバンキング") {
    Container(spa, "SPA", "TypeScript", "ブラウザUI")
    Container(api, "API", "Java/Spring", "業務ロジック")
    ContainerDb(db, "DB", "PostgreSQL")
  }
  Rel(customer, spa, "利用する", "HTTPS")
  Rel(spa, api, "呼び出す", "JSON/HTTPS")
  Rel(api, db, "読み書き", "JDBC")
  Rel(api, email, "通知を依頼", "SMTP")

C4Component
  Container_Boundary(api, "API") {
    Component(signin, "サインインCtrl", "Spring MVC")
    Component(accounts, "口座サービス", "Spring Bean")
    Component(transferSvc, "振込サービス", "Spring Bean")
    Component(notification, "通知サービス", "Spring Bean")
  }
  Rel(spa, signin, "呼び出す")
  Rel(spa, transferSvc, "呼び出す")
  Rel(accounts, db, "読み書き", "JDBC")
  Rel(transferSvc, db, "読み書き", "JDBC")
  Rel(transferSvc, notification, "通知を依頼")
  Rel(notification, email, "メール送信", "SMTP")

%% code-of: accounts
classDiagram
  class AccountService {
    +getAccounts(userId)
  }
  class AccountRepository {
    +findByUserId(userId)
  }
  AccountService --> AccountRepository

%% code-of: transferSvc
classDiagram
  class TransferService {
    +transfer(fromId, toId, amount)
  }
  class TransferValidator {
    +validate(fromId, toId, amount)
  }
  TransferService --> TransferValidator : uses
`;
