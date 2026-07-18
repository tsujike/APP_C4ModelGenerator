import type { BlockKind, BlockLine, SourceBlock } from './types';

/** ブロック開始キーワード(設計書§5.1)。 */
const BLOCK_KEYWORDS: readonly BlockKind[] = [
  'C4Context',
  'C4Container',
  'C4Component',
  'classDiagram',
];

/** `%% code-of: <alias>` 指令の抽出パターン(設計書§5.4, §11)。 */
const CODE_OF_PATTERN = /^%%\s*code-of:\s*(.+?)\s*$/;

/**
 * trimmed済みの行がブロック開始行かどうかを判定する。
 * キーワードの直後が行末か空白であることを要求し、`C4ContextFoo` のような
 * 識別子の一部一致を誤検出しないようにする。
 */
function matchBlockStart(trimmedLine: string): BlockKind | null {
  for (const keyword of BLOCK_KEYWORDS) {
    if (
      trimmedLine === keyword ||
      trimmedLine.startsWith(`${keyword} `) ||
      trimmedLine.startsWith(`${keyword}\t`)
    ) {
      return keyword;
    }
  }
  return null;
}

/**
 * ソーステキストをブロック列に分割する。
 *
 * 行頭(インデント除く)が C4Context/C4Container/C4Component/classDiagram の行が新ブロックの
 * 開始。ブロックはファイル終端または次のブロック開始行まで(設計書§5.1)。インデントは自由
 * なので判定・本文収集ともtrim済みの行/元の行を使う。空行と `%%` コメント行は本文から除外
 * するが、`%% code-of: <alias>` は指令として保持し、直後に開始するブロックへ引き継ぐ
 * (classDiagramブロックの結び付けに使うのはT1-2の範囲)。
 */
export function splitBlocks(source: string): SourceBlock[] {
  const rawLines = source.split(/\r\n|\r|\n/);
  const blocks: SourceBlock[] = [];
  let current: SourceBlock | null = null;
  let pendingCodeOf: string | undefined;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const rawLine = rawLines[i] ?? '';
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) continue;

    const startKind = matchBlockStart(trimmed);
    if (startKind !== null) {
      current = {
        kind: startKind,
        startLine: lineNumber,
        lines: [],
        ...(pendingCodeOf !== undefined ? { codeOfAlias: pendingCodeOf } : {}),
      };
      blocks.push(current);
      pendingCodeOf = undefined;
      continue;
    }

    if (trimmed.startsWith('%%')) {
      const match = CODE_OF_PATTERN.exec(trimmed);
      if (match !== null) {
        pendingCodeOf = match[1];
      }
      continue;
    }

    if (current !== null) {
      const line: BlockLine = { text: rawLine, line: lineNumber };
      current.lines.push(line);
    }
    // ブロック開始前に非空行が現れるのは仕様上想定外だが、境界外の防御的処理はしない方針
    // (実装指示書§1)に従い、単純に無視する(errorにはしない)。
  }

  return blocks;
}
