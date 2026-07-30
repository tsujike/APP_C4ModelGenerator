/**
 * Mermaidモード(post-v1.0)のレベル分割(純関数)。
 *
 * ユーザー要望:「Mermaid記法も対応したい。レベルによって、登録したMermaidに表示が変わるだけでOK。
 * C4モデルとの連携は不要」。この要望に対する最単純解釈として、1つのソーステキストの中に
 * `%%L1`〜`%%L8` のマーカー行で区切って最大8つのMermaid図を登録し、表示レベルの切替に応じて
 * 「そのレベルに登録された図」へ丸ごと差し替える方式を採る。
 *
 * 設計判断(申し送り):
 * - マーカーはMermaidのコメント記法 `%%` をそのまま使う。こうすることで、分割後の各ブロックを
 *   そのままMermaidへ渡せるだけでなく、区切り行を含んだソース全体を素のMermaidツールに
 *   貼り付けてもコメントとして無視され壊れない(可搬性)。
 * - C4モードとの混在は許さない(ユーザー確認済み: 「Mermaidモードなら4レベル全部Mermaidでよい」)。
 *   マーカーが1つでもあればMermaidモード、1つも無ければ従来のC4モードとして扱う。この判定を
 *   `isMermaidModeSource` に閉じ、`model/build.ts`(C4モード)は一切変更しない。
 * - 未登録レベルは「何も表示しない」(ユーザー確認済み)。よってこの関数は未登録レベルの
 *   エントリを返さず、呼び出し側(main.ts)が空要素として扱う。
 * - L5〜L8はMermaidモード専用(C4モデルは4層で定義されるためC4モードには存在しない)。
 *   `model/types.ts`の`Level`型がpost-v1.0でL1〜L8へ拡張されたことに伴い、Mermaidモードの
 *   マーカーもL8まで受け付ける(C4モードの`Level`の意味論・4層構造は変わらない)。
 *
 * `parser/` はDOM非依存の純関数のみで構成する(実装指示書§4)ため、ここではMermaidの
 * 解析・描画は一切行わない(それは `excal/mermaid.ts` の責務)。
 */

import type { Level } from '../model/types';
import type { ParseIssue } from './types';

/**
 * レベルマーカー行のパターン。行頭・行末の空白は許容し、`%%` と `L1` の間の空白も許容する
 * (`%%L1` / `%% L1` / `%%  l1  ` はすべて同じ意味)。大文字小文字は区別しない。
 * マーカー行は「その行だけ」でレベルを表す必要がある(`%%L1 なにか` はコメント扱いで
 * マーカーにはしない)。誤ってコメント本文をマーカーと解釈しないための制約。
 * L1〜L8(post-v1.0のL5〜L8拡張。Mermaidモード専用)を受け付ける。
 */
const LEVEL_MARKER_PATTERN = /^%%\s*L([1-8])\s*$/i;

/**
 * 「名前付きマーカーもどき」の行のパターン(`findNamedMarkerLikeLines`専用)。
 * `LEVEL_MARKER_PATTERN` とほぼ同じだが、`L1`の直後に単語境界を置いたうえで
 * 「空白ゼロ個以上のあとに非空白文字が続く」ことを要求する。これにより
 * `%%L1: 名前` / `%%L1 名前` / `%% L2 - 詳細` のような「マーカーに見えるがコメント扱いに
 * なる行」を拾う一方、`%%L1x` のように続きが単語文字の行(=そもそも別物)は拾わない。
 */
const NAMED_MARKER_LIKE_PATTERN = /^%%\s*L([1-8])\b\s*\S/i;

/** 1レベル分の登録内容。 */
export interface MermaidLevelEntry {
  /** そのレベルに登録されたMermaidソース(マーカー行自体は含まない)。 */
  text: string;
  /** マーカー行の行番号(1始まり)。issuesパネルからのジャンプ先に使う。 */
  markerLine: number;
}

/**
 * L1〜L8という軸そのものが何を意味するかの宣言。
 * - `zoom`: レベルが上がるほど詳細度が上がる(ズームイン)。
 * - `views`: 各レベルが別々の視点(切り口)を並べたもの。
 * - `reader`: レベルごとに読者(対象者)が変わる。
 *
 * **表示のみで挙動は一切変えない**(Kenny決定: 挙動変更は実際に使ってから)。
 * `%% MODE: <値>` 宣言はUI上のラベル表示などに使われるだけで、レベルの分割・切替・
 * 未登録レベルの扱いといった既存の挙動には一切影響しない。
 */
export type AxisMode = 'zoom' | 'views' | 'reader';

/** `%% MODE:` 宣言が無い場合に使う既定値。 */
export const DEFAULT_AXIS_MODE: AxisMode = 'zoom';

export interface MermaidLevelsResult {
  /** 登録があったレベルのみを含む。未登録レベルはキー自体が存在しない。 */
  levels: Map<Level, MermaidLevelEntry>;
  issues: ParseIssue[];
  /** `%% MODE:` 宣言から解析した軸モード。宣言が無ければ `DEFAULT_AXIS_MODE`。 */
  axisMode: AxisMode;
}

/**
 * 軸モード宣言行のパターン。`%% MODE: <値>` の形。`%%` と `MODE` の間、`MODE` と `:` の間、
 * `:` と値の間の空白はそれぞれ任意。大文字小文字は区別しない
 * (`%% MODE: views` / `%%MODE:reader` / `%% mode: ZOOM` はすべて有効)。
 */
const MODE_LINE_PATTERN = /^%%\s*MODE\s*:\s*(.*)$/i;

/**
 * ソースがMermaidモードかどうかを判定する。レベルマーカー行が1つでもあればMermaidモード。
 * `main.ts` はこの判定だけでC4モードとMermaidモードを排他的に切り替える。
 */
export function isMermaidModeSource(source: string): boolean {
  return source.split(/\r\n|\r|\n/).some((line) => LEVEL_MARKER_PATTERN.test(line.trim()));
}

/**
 * Mermaidの図種を表す先頭キーワード(`detectMarkerlessMermaidLine`専用)。
 *
 * **`classDiagram` は意図的に含めない**。本アプリのC4モードでは `classDiagram` ブロックが
 * L4(コードレベル)の正規の入力だからで(`parser/types.ts` の `BlockKind` 参照)、これを
 * 含めると「C4モードで classDiagram だけ書いて C4Context を書き忘れた」ケースに対して
 * 「Mermaidモードにしては?」という的外れな案内を出してしまう。
 *
 * それ以外はMermaid 11系の図種を素直に列挙しただけで、網羅性は必須ではない。この一覧は
 * 描画の可否には一切関与せず、**案内メッセージを出すかどうかだけ**を決める。載っていない図種は
 * 案内が出ないだけで、マーカーさえ書けば従来どおり描画される(取りこぼしても実害は小さい)。
 */
const MERMAID_DIAGRAM_KEYWORDS: readonly string[] = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'mindmap',
  'timeline',
  'zenuml',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
  'packet-beta',
  'kanban',
  'architecture-beta',
  'radar-beta',
  'treemap-beta',
];

/**
 * 行頭がMermaidの図種キーワードか判定する。キーワードの直後は「行末・空白・`:`」のいずれかで
 * なければならない(`flowchart TD` / `sequenceDiagram` / `gitGraph:` を通し、`graphql...` のような
 * 別語を弾く)。大文字小文字は区別しない(案内を出すか否かの判定なので寛容側に倒す)。
 */
function startsWithMermaidKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return MERMAID_DIAGRAM_KEYWORDS.some((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    if (!lower.startsWith(lowerKeyword)) return false;
    const next = lower.charAt(lowerKeyword.length);
    return next === '' || next === ' ' || next === '\t' || next === ':';
  });
}

/**
 * 「Mermaidの図に見えるのにレベルマーカーが1つも無い」ソースを検出し、図種行の行番号(1始まり)を返す。
 * 該当しなければ `undefined`。
 *
 * 追加の経緯(Kennyの指摘): 素のMermaid(`sequenceDiagram` から始まるテキスト)をそのまま貼ると
 * マーカーが無いためC4モードと判定され、「C4Contextブロックが見つかりません」というC4モードの
 * エラーだけが出る。仕様どおりの挙動ではあるが、原因(マーカーの書き忘れ)にたどり着けない。
 * そこで「マーカーがありません」と案内するための検出をここに置く。
 *
 * 判定は先頭の有効行(空行と `%%` コメント行を読み飛ばした最初の行)1行だけを見る。以降の行まで
 * 見に行かないのは、C4モードの正しいソースの途中に現れる語を拾って誤検出するのを避けるため。
 *
 * この関数は検出だけを行い、issueの生成は呼び出し側(`main.ts`)の責務とする
 * (`parser/`はDOM非依存の純関数、かつ`model/build.ts`のC4解析経路は不変に保つ方針のため)。
 */
export function detectMarkerlessMermaidLine(source: string): number | undefined {
  if (isMermaidModeSource(source)) return undefined;

  const rawLines = source.split(/\r\n|\r|\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const text = (rawLines[i] ?? '').trim();
    if (text === '' || text.startsWith('%%')) continue;
    return startsWithMermaidKeyword(text) ? i + 1 : undefined;
  }
  return undefined;
}

/**
 * `%%L1`〜`%%L8` マーカーでソースを最大8つのMermaidソースへ分割する。
 *
 * - 最初のマーカーより前に書かれた非空行は warning にして無視する(どのレベルにも属さないため)。
 *   ただし `%% MODE:` 宣言行はこの警告の対象から除外する(MODEはソース先頭に書くのが標準的な
 *   置き場所のため)。
 * - 同じレベルのマーカーが複数回現れた場合は初出を採用し、2つ目以降を warning にして無視する
 *   (alias重複時に初出を採用する `model/build.ts` の既存規約に揃える)。
 * - マーカー直後の本文が空(次のマーカーまで非空行が無い)場合は warning にし、そのレベルは
 *   未登録として扱う(=何も表示しない)。
 * - `%% MODE: <値>` 宣言行があれば `axisMode` を解析する。複数ある場合は最初の1つが勝ち、
 *   未知の値は warning にして `DEFAULT_AXIS_MODE` として扱う。レベル本文の中に現れた
 *   MODE行は、これまでどおり本文にそのまま残す(取り除く処理は行わない)。
 */
export function splitMermaidLevels(source: string): MermaidLevelsResult {
  const rawLines = source.split(/\r\n|\r|\n/);
  const levels = new Map<Level, MermaidLevelEntry>();
  const issues: ParseIssue[] = [];
  let axisMode: AxisMode = DEFAULT_AXIS_MODE;
  /** 最初のMODE行にまだ到達していないか。2つ目以降のMODE行を警告するために使う。 */
  let sawModeLine = false;

  /** 現在収集中のレベル。null = まだ最初のマーカーに到達していない。 */
  let currentLevel: Level | null = null;
  let currentMarkerLine = 0;
  let currentLines: string[] = [];
  /** 重複マーカーで無視中(=本文を捨てる)かどうか。 */
  let ignoringDuplicate = false;

  function flush(): void {
    if (currentLevel === null || ignoringDuplicate) return;
    const text = currentLines.join('\n').trim();
    if (text === '') {
      issues.push({
        severity: 'warning',
        line: currentMarkerLine,
        message: `%%L${String(currentLevel)} の下にMermaidの記述がありません。このレベルは何も表示されません。`,
      });
      return;
    }
    levels.set(currentLevel, { text, markerLine: currentMarkerLine });
  }

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const rawLine = rawLines[i] ?? '';
    const trimmedLine = rawLine.trim();

    const modeMatched = MODE_LINE_PATTERN.exec(trimmedLine);
    if (modeMatched !== null) {
      const rawValue = (modeMatched[1] ?? '').trim();
      if (!sawModeLine) {
        sawModeLine = true;
        const normalized = rawValue.toLowerCase();
        if (normalized === 'zoom' || normalized === 'views' || normalized === 'reader') {
          axisMode = normalized;
        } else {
          issues.push({
            severity: 'warning',
            line: lineNumber,
            message: `未知のMODE「${rawValue}」です。zoom / views / reader のいずれかを指定してください(zoomとして扱います)。`,
          });
        }
      } else {
        issues.push({
          severity: 'warning',
          line: lineNumber,
          message: `MODE行が複数あります。最初の1つ(${axisMode})を使います。`,
        });
      }

      if (currentLevel === null) {
        // 最初のレベルマーカーより前のMODE行は「マーカーより前」警告の対象外(標準的な置き場所のため)。
        continue;
      }
      currentLines.push(rawLine);
      continue;
    }

    const matched = LEVEL_MARKER_PATTERN.exec(trimmedLine);

    if (matched === null) {
      if (currentLevel === null) {
        if (trimmedLine !== '') {
          issues.push({
            severity: 'warning',
            line: lineNumber,
            message:
              '最初のレベルマーカー(%%L1 など)より前に書かれた行はどのレベルにも属さないため無視します。',
          });
        }
        continue;
      }
      currentLines.push(rawLine);
      continue;
    }

    // 新しいマーカーに到達 → 直前まで収集していたレベルを確定する。
    flush();

    // 正規表現 /^%%\s*L([1-8])\s*$/ が一致した時点でキャプチャは '1'|'2'|'3'|'4'|'5'|'6'|'7'|'8' のいずれか。
    const parsed = Number(matched[1]) as Level;
    currentMarkerLine = lineNumber;
    currentLines = [];
    if (levels.has(parsed)) {
      issues.push({
        severity: 'warning',
        line: lineNumber,
        message: `%%L${String(parsed)} が複数あります。最初の1つを採用し、こちらは無視します。`,
      });
      currentLevel = parsed;
      ignoringDuplicate = true;
      continue;
    }
    currentLevel = parsed;
    ignoringDuplicate = false;
  }

  flush();
  return { levels, issues, axisMode };
}

/** `findNamedMarkerLikeLines`が返す1件。 */
export interface NamedMarkerLikeLine {
  /** 1始まりの行番号。 */
  line: number;
  /** その行が指しているように見えるレベル。 */
  level: Level;
}

/**
 * 名前付きマーカーもどきの行(`%%L1: 名前` のような、レベルマーカーに見えるが
 * `LEVEL_MARKER_PATTERN` にはマッチしない行)を検出する。
 *
 * FR-7.2 どおりマーカーは単独行のみ。`%%L1: 名前` はコメント扱いになり、そのレベルの図が
 * 丸ごと落ちるという分かりにくい失敗になるため、呼び出し側(main.ts)が警告を出せるように
 * 行を返す。この関数自体は挙動を変えない(`LEVEL_MARKER_PATTERN` を変更せず、
 * `%%L1: 名前` を正規のマーカーとして受理することもしない)。
 */
export function findNamedMarkerLikeLines(source: string): readonly NamedMarkerLikeLine[] {
  const rawLines = source.split(/\r\n|\r|\n/);
  const result: NamedMarkerLikeLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const trimmedLine = (rawLines[i] ?? '').trim();
    if (LEVEL_MARKER_PATTERN.test(trimmedLine)) continue;

    const matched = NAMED_MARKER_LIKE_PATTERN.exec(trimmedLine);
    if (matched === null) continue;

    result.push({ line: i + 1, level: Number(matched[1]) as Level });
  }

  return result;
}

// ---- Issue #3対応: Mermaid本家との解釈差分を埋めるための補助関数 ----
//
// 背景: 本アプリのMermaidモードはMermaid.jsに描画させず、レイアウト結果を
// `@excalidraw/mermaid-to-excalidraw` 経由でExcalidraw要素に変換する(CLAUDE.md)。
// そのため、Mermaid本家では解釈される記法の一部が「解釈はされるが最終的な見た目が
// 本家と異なる」ことがある。以下の2関数は、その差分について呼び出し側(`excal/`側)が
// 案内メッセージを出すための判定材料を提供するだけで、実際の変換・描画は一切行わない
// (`parser/`はDOM非依存の純関数のみで構成する方針を維持)。

/**
 * frontmatterブロックの範囲。`bodyStart`〜`bodyEnd`(exclusive)がYAML本文、
 * `afterEnd`が閉じの`---`の次の行。`extractMermaidTitle`と`findCollapsedShapeTokens`の
 * 両方がこの検出ロジックを必要とするため共通化した(既存関数には手を入れていない)。
 */
interface FrontmatterRange {
  bodyStart: number;
  bodyEnd: number;
  afterEnd: number;
}

/**
 * ソース先頭のfrontmatterブロック(`---`行 〜 `---`行のYAML)を検出する。
 * 前後の空行は許容するが、空行を除いた最初の行が`---`でなければfrontmatter無しとして扱う
 * (先頭以外に現れる`---`は無視する、という仕様のため)。閉じの`---`が見つからない場合も
 * frontmatter無し扱いとする(壊れたブロックを誤って本文と解釈しないため)。
 */
function findFrontmatterRange(lines: readonly string[]): FrontmatterRange | undefined {
  let i = 0;
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++;
  if (i >= lines.length || (lines[i] ?? '').trim() !== '---') return undefined;

  const bodyStart = i + 1;
  for (let j = bodyStart; j < lines.length; j++) {
    if ((lines[j] ?? '').trim() === '---') {
      return { bodyStart, bodyEnd: j, afterEnd: j + 1 };
    }
  }
  return undefined;
}

/**
 * 前後の空白をtrim済みの値から、対応する引用符1組だけを剥がす。`"a"` → `a`、`'a'` → `a`。
 * 引用符が片側だけ・種類が不一致・2文字未満の場合はそのまま返す(壊れたYAMLを誤って
 * 加工しないため)。
 */
function stripMatchingQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value.charAt(0);
  const last = value.charAt(value.length - 1);
  const isDoubleQuoted = first === '"' && last === '"';
  const isSingleQuoted = first === "'" && last === "'";
  return isDoubleQuoted || isSingleQuoted ? value.slice(1, -1) : value;
}

/**
 * Mermaidのfrontmatter(ソース先頭の`---`〜`---`)内の`title:`の値を返す。
 *
 * 追加の経緯(Issue #3): 本家Mermaidはfrontmatterの`title`を図のタイトルとして解釈するが、
 * 本アプリはMermaid.jsに描画させないため、`@excalidraw/mermaid-to-excalidraw`の変換結果には
 * このタイトルが反映されない。呼び出し側(`excal/`)がこれを検出して「タイトルは無視されます」
 * といった案内を出せるように、値の抽出だけをここで行う。
 *
 * - frontmatterはソースの先頭(前後の空行は許容)にある場合のみ有効。閉じられていない
 *   frontmatter・先頭以外に現れる`---`は無視する。
 * - `title:`は**インデントの無い行**のみを対象にする。`config:`配下などネストしたYAMLの
 *   `title:`(インデント付き)は拾わない(最単純解釈: フルYAMLパーサは導入しない)。
 * - 値は前後の空白をtrimし、引用符(`"`または`'`)で囲まれていれば1組だけ剥がす。
 * - 値が空になった場合(`title:`のみ、`title: ""`等)は`undefined`を返す。
 * - 複数の`title:`行がある場合は最初の1つを採用する(壊れたYAMLの救済は範囲外)。
 */
export function extractMermaidTitle(text: string): string | undefined {
  const lines = text.split(/\r\n|\r|\n/);
  const frontmatter = findFrontmatterRange(lines);
  if (frontmatter === undefined) return undefined;

  for (let i = frontmatter.bodyStart; i < frontmatter.bodyEnd; i++) {
    const line = lines[i] ?? '';
    const matched = /^title:\s*(.*)$/.exec(line);
    if (matched === null) continue;

    const rawValue = (matched[1] ?? '').trim();
    const value = stripMatchingQuotes(rawValue);
    return value === '' ? undefined : value;
  }
  return undefined;
}

/** `findCollapsedShapeTokens`が返す文字列(実測にもとづく確定リスト)。この並び順で返す。 */
const SUBROUTINE_TOKEN = 'サブルーチン [[...]]';
const CYLINDER_TOKEN = 'シリンダ [(...)]';
const ASYMMETRIC_TOKEN = '非対称 >...]';
const HEXAGON_TOKEN = '六角形 {{...}}';
const PARALLELOGRAM_TOKEN = '平行四辺形 [/.../]';
const TRAPEZOID_TOKEN = '台形 [/...\\]';

/** `findCollapsedShapeTokens`が返し得る全トークンを、返却時に守るべき固定順で並べたもの。 */
const COLLAPSED_SHAPE_TOKEN_ORDER: readonly string[] = [
  SUBROUTINE_TOKEN,
  CYLINDER_TOKEN,
  ASYMMETRIC_TOKEN,
  HEXAGON_TOKEN,
  PARALLELOGRAM_TOKEN,
  TRAPEZOID_TOKEN,
];

// いずれの文字クラスも改行を明示的に除外している(`[^…\n]`)。除外しないと、ある行の
// 開き記号と別の行にある無関係な閉じ記号が誤って対応付けられ、行をまたいだ誤検出を
// 生みかねないため(1ノード定義は1行に収まる、というflowchartの通常の書き方が前提)。

/** `[[...]]`(サブルーチン)。 */
const SUBROUTINE_PATTERN = /\[\[[^\]\n]*\]\]/;
/** `[(...)]`(シリンダ)。 */
const CYLINDER_PATTERN = /\[\([^)\n]*\)\]/;
/**
 * `>...]`(非対称)。矢印(`-->` `==>` `-.->`等)の`>`を誤検出しないよう、
 * `>`の直前が英数字・アンダースコアであること(=ノードIDの末尾)を要求する。
 * Mermaidの矢印は必ず`-` `=` `.` `~`のいずれかが`>`の直前に来るため、この条件で区別できる。
 */
const ASYMMETRIC_PATTERN = /\w>[^\]\n]*\]/;
/** `{{...}}`(六角形)。 */
const HEXAGON_PATTERN = /\{\{[^}\n]*\}\}/;
/**
 * `[/...\]`系すべて(平行四辺形・台形の両方を拾う)。開き記号(`/`または`\`)と
 * 閉じ記号を別グループに取り、一致すれば平行四辺形、不一致なら台形と判定する
 * (呼び出し側でグループを比較する)。
 */
const SLANTED_BRACKET_PATTERN = /\[([/\\])[^\]\n]*([/\\])\]/g;

/**
 * flowchart記法のうち、Excalidrawが長方形しか表現できず形状情報が失われるノード記法
 * (サブルーチン・シリンダ・非対称・六角形・平行四辺形・台形)が使われていれば、
 * その記法の呼び名を固定順・重複無しで返す。使われていなければ空配列。
 *
 * 追加の経緯(Issue #3): `@excalidraw/mermaid-to-excalidraw`はこれらの形状をすべて
 * 長方形として変換してしまう(Excalidraw自体がこれらの図形をサポートしないため)。
 * 本家Mermaidとの見た目の差分を利用者に案内するため、呼び出し側(`excal/`)がこの関数の
 * 戻り値を使って警告メッセージを組み立てられるようにする(変換処理自体はここでは行わない)。
 *
 * 誤検出対策として以下のみ考慮する(最単純解釈。それ以外の誤検出は許容する):
 * - `%%`で始まるコメント行は無視する。
 * - frontmatterブロック(先頭の`---`〜`---`)の中は無視する。
 * - ノードラベル本文に記号列がそのまま含まれるケース(例: `A[x>1]`)は考慮しない。
 */
export function findCollapsedShapeTokens(text: string): readonly string[] {
  const lines = text.split(/\r\n|\r|\n/);
  const frontmatter = findFrontmatterRange(lines);
  const scanStart = frontmatter === undefined ? 0 : frontmatter.afterEnd;

  const relevant = lines
    .slice(scanStart)
    .filter((line) => !line.trim().startsWith('%%'))
    .join('\n');

  const found = new Set<string>();
  if (SUBROUTINE_PATTERN.test(relevant)) found.add(SUBROUTINE_TOKEN);
  if (CYLINDER_PATTERN.test(relevant)) found.add(CYLINDER_TOKEN);
  if (ASYMMETRIC_PATTERN.test(relevant)) found.add(ASYMMETRIC_TOKEN);
  if (HEXAGON_PATTERN.test(relevant)) found.add(HEXAGON_TOKEN);

  // グローバルフラグのRegExpは内部でlastIndexを持つため使い回さず、都度生成する。
  const slantedBracketPattern = new RegExp(SLANTED_BRACKET_PATTERN);
  let match = slantedBracketPattern.exec(relevant);
  while (match !== null) {
    const open = match[1] ?? '';
    const close = match[2] ?? '';
    found.add(open === close ? PARALLELOGRAM_TOKEN : TRAPEZOID_TOKEN);
    match = slantedBracketPattern.exec(relevant);
  }

  return COLLAPSED_SHAPE_TOKEN_ORDER.filter((token) => found.has(token));
}
