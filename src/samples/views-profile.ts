/**
 * 組込サンプル「採用プロセス(views軸)」(GitHub Issue #1への回答: レベル体系を
 * C4以外にも再利用できることの見本)。
 *
 * Issue #1の要望は「L1〜L4というレベル体系そのものを、C4モデル以外の題材にも
 * 再利用可能な『プロファイル』として示したい」というもの。本アプリで言う
 * プロファイルとは、実装上の新しい仕組みを指すのではなく、
 *   1. 軸そのものが何を意味するか(`%% MODE:` 宣言。`parser/mermaidLevels.ts`の`AxisMode`)
 *   2. 各レベルに何と名前を付けるか(各図のfrontmatter `title:`。`extractMermaidTitle`)
 * の2つの組み合わせのことを言う。C4モードは「`MODE: zoom` かつ各レベルの名前が
 * Context/Containers/Components/Code」という**C4プロファイル**の一種だと捉えられる。
 * このサンプルはC4以外の組み合わせの具体例として、`MODE: views`(各レベルが詳細度ではなく
 * 別々の視点を並べたもの)を宣言し、レベル名をC4用語と無関係な日本語のfrontmatter titleで
 * 与える。仕組み(コード)は一切追加せず、既存のMermaidモードの書き方だけで表現できることを
 * 示すのが狙い。
 *
 * 題材はC4モデルと無関係な「採用プロセス」。同じ採用プロセスを4つの異なる視点から描く
 * (L5以降は無し。views軸に「詳細度」の意味は無いため、4つの視点で打ち止め):
 * - L1: 応募者から見た流れ(`flowchart`、subgraph無し)→ ネイティブ要素変換。
 * - L2: 採用担当から見た流れ(`flowchart`、subgraph無し)→ ネイティブ要素変換。
 * - L3: 一次面接でのやり取り(`sequenceDiagram`)→ ネイティブ要素変換。
 * - L4: 応募者ステータスの遷移(`stateDiagram-v2`)→ ネイティブ要素変換。
 * 4レベルとも`subgraph`・`classDiagram`を使わないため、ラスタ画像フォールバック経路
 * (`excal/mermaid.ts`)を一切通らず、すべてネイティブ変換経路を通る。
 *
 * 各レベルの名前は必ずfrontmatterの`title:`で付けている。`%%L1: 応募者から見た流れ`のような
 * 「マーカー行に名前を付け足す」書き方は正規のマーカーとして認められない(FR-7.2。
 * `parser/mermaidLevels.ts`の`LEVEL_MARKER_PATTERN`はマーカー単独行のみを受理し、
 * `findNamedMarkerLikeLines`が検出対象とする「マーカーもどき」に該当してしまう)ため、
 * このサンプルではマーカー行(`%%L1`等)は単独行のまま保ち、名前は各図の直後に置いた
 * frontmatterで表現する。これが「レベルに名前を付ける、現在サポートされている唯一の方法」
 * であり、本サンプルはその書き方の見本を兼ねる。
 */
export const viewsProfileSample: string = `%% MODE: views
%%L1
---
title: 応募者から見た流れ
---
flowchart LR
  APPLY["応募する"] --> DOC["書類選考を受ける"]
  DOC --> FIRST["一次面接を受ける"]
  FIRST --> FINAL["最終面接を受ける"]
  FINAL --> OFFER["内定を受け取る"]
  OFFER --> JOIN["入社する"]

%%L2
---
title: 採用担当から見た流れ
---
flowchart LR
  POST["求人を掲載する"] --> SCREEN["書類を選考する"]
  SCREEN --> SCHEDULE["面接を設定する"]
  SCHEDULE --> INTERVIEW["面接を実施する"]
  INTERVIEW --> DECIDE["合否を判定する"]
  DECIDE --> NOTIFY["結果を通知する"]

%%L3
---
title: 一次面接でのやり取り
---
sequenceDiagram
  participant A as 応募者
  participant R as 採用担当
  participant I as 面接官
  A->>R: 面接会場に到着する
  R->>I: 応募者を案内する
  I->>A: 経歴について質問する
  A-->>I: 回答する
  I-->>R: 評価シートを渡す
  R-->>A: 結果を後日連絡すると伝える

%%L4
---
title: 応募者ステータスの遷移
---
stateDiagram-v2
  [*] --> 応募済み
  応募済み --> 書類選考中
  書類選考中 --> 一次面接待ち: 書類通過
  書類選考中 --> 不採用: 書類落選
  一次面接待ち --> 最終面接待ち: 一次通過
  一次面接待ち --> 不採用: 一次落選
  最終面接待ち --> 内定: 最終通過
  最終面接待ち --> 不採用: 最終落選
  内定 --> [*]
  不採用 --> [*]
`;
