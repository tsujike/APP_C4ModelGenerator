/**
 * Mermaidモード(post-v1.0)のレベル分割(純関数)。
 *
 * ユーザー要望:「Mermaid記法も対応したい。レベルによって、登録したMermaidに表示が変わるだけでOK。
 * C4モデルとの連携は不要」。この要望に対する最単純解釈として、1つのソーステキストの中に
 * `%%L1`〜`%%L4` のマーカー行で区切って最大4つのMermaid図を登録し、表示レベルの切替に応じて
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
 */
const LEVEL_MARKER_PATTERN = /^%%\s*L([1-4])\s*$/i;

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
 * `%%L1`〜`%%L4` マーカーでソースを最大4つのMermaidソースへ分割する。
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

    // 正規表現 /^%%\s*L([1-4])\s*$/ が一致した時点でキャプチャは '1'|'2'|'3'|'4' のいずれか。
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
