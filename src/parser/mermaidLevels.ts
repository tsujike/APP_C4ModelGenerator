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

/** 1レベル分の登録内容。 */
export interface MermaidLevelEntry {
  /** そのレベルに登録されたMermaidソース(マーカー行自体は含まない)。 */
  text: string;
  /** マーカー行の行番号(1始まり)。issuesパネルからのジャンプ先に使う。 */
  markerLine: number;
}

export interface MermaidLevelsResult {
  /** 登録があったレベルのみを含む。未登録レベルはキー自体が存在しない。 */
  levels: Map<Level, MermaidLevelEntry>;
  issues: ParseIssue[];
}

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
 * - 同じレベルのマーカーが複数回現れた場合は初出を採用し、2つ目以降を warning にして無視する
 *   (alias重複時に初出を採用する `model/build.ts` の既存規約に揃える)。
 * - マーカー直後の本文が空(次のマーカーまで非空行が無い)場合は warning にし、そのレベルは
 *   未登録として扱う(=何も表示しない)。
 */
export function splitMermaidLevels(source: string): MermaidLevelsResult {
  const rawLines = source.split(/\r\n|\r|\n/);
  const levels = new Map<Level, MermaidLevelEntry>();
  const issues: ParseIssue[] = [];

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
    const matched = LEVEL_MARKER_PATTERN.exec(rawLine.trim());

    if (matched === null) {
      if (currentLevel === null) {
        if (rawLine.trim() !== '') {
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
  return { levels, issues };
}
