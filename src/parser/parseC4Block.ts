import type {
  BlockLine,
  BoundaryKind,
  BoundaryStatement,
  C4BlockKind,
  C4Statement,
  ElementKind,
  ElementStatement,
  ElementVariant,
  ParseC4BlockResult,
  ParseIssue,
  RelStatement,
  SourceBlock,
} from './types';

/** title文・スタイル系文は解釈対象外だが、warningも出さずに無視する(設計書§5.2)。 */
const IGNORED_KEYWORDS = new Set([
  'title',
  'UpdateRelStyle',
  'UpdateElementStyle',
  'UpdateLayoutConfig',
]);

/** Person/System/Container/Component の基底語→種別の対応(設計書§5.2)。 */
const ELEMENT_BASE: ReadonlyArray<{ word: string; kind: ElementKind }> = [
  { word: 'Person', kind: 'person' },
  { word: 'System', kind: 'system' },
  { word: 'Container', kind: 'container' },
  { word: 'Component', kind: 'component' },
];

/** Boundary系キーワード→boundaryKindの対応(設計書§5.2)。 */
const BOUNDARY_KEYWORDS: Readonly<Record<string, BoundaryKind>> = {
  System_Boundary: 'system',
  Container_Boundary: 'container',
  Enterprise_Boundary: 'enterprise',
};

/** Rel / Rel_U / Rel_Down 等、方向ヒント付きRelを同一視するためのパターン(設計書§5.2)。 */
const REL_KEYWORD_PATTERN = /^Rel(_[A-Za-z]+)?$/;

interface ElementKeywordInfo {
  kind: ElementKind;
  variant: ElementVariant;
  external: boolean;
}

/**
 * `Person`/`SystemDb_Ext`のようなキーワードを種別・variant・externalに分解する。
 * `_Ext`サフィックスとDb/Queueサフィックスの組み合わせを総当たりで判定することで、
 * 設計書§5.2の対応表(代表例)が示す全パターンを一律に扱う。
 */
function matchElementKeyword(keyword: string): ElementKeywordInfo | null {
  let base = keyword;
  let external = false;
  if (base.endsWith('_Ext')) {
    external = true;
    base = base.slice(0, -'_Ext'.length);
  }
  for (const { word, kind } of ELEMENT_BASE) {
    if (base === word) return { kind, variant: 'default', external };
    if (base === `${word}Db`) return { kind, variant: 'db', external };
    if (base === `${word}Queue`) return { kind, variant: 'queue', external };
  }
  return null;
}

interface ParenSpan {
  argsText: string;
}

/**
 * `keyword(...)` の丸括弧内部を取り出す。引用符内の `(` `)` は深さに数えない。
 * 対応する閉じ括弧が見つからない場合はnull(呼び出し側でerrorにする)。
 */
function findParenSpan(text: string, searchStart: number): ParenSpan | null {
  let i = searchStart;
  while (i < text.length && /\s/.test(text.charAt(i))) i++;
  if (text.charAt(i) !== '(') return null;
  const openIndex = i;
  let depth = 0;
  let inQuotes = false;
  for (; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === '(') {
      depth++;
    } else if (!inQuotes && ch === ')') {
      depth--;
      if (depth === 0) {
        return { argsText: text.slice(openIndex + 1, i) };
      }
    }
  }
  return null;
}

/** `"..."` を剥がす。引用符で囲まれていなければそのまま返す(裸の識別子)。 */
function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * カンマ区切りの引数リストを分割する。引用符内のカンマは区切りとみなさない
 * (設計書§5.2)。`$tag=...` 形式の名前付き引数は読み飛ばす。
 */
function splitArgs(argsText: string): string[] {
  const rawParts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of argsText) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ',' && !inQuotes) {
      rawParts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  rawParts.push(current);

  return rawParts
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('$'))
    .map(stripQuotes);
}

function unsupportedIssue(lineEntry: BlockLine): ParseIssue {
  return {
    severity: 'warning',
    line: lineEntry.line,
    message: `未対応の文です: "${lineEntry.text.trim()}"`,
  };
}

/** キーワードの直後から引数リストを取り出す。括弧が不正ならnull。 */
function parseArgs(trimmedLine: string, keyword: string): string[] | null {
  const span = findParenSpan(trimmedLine, keyword.length);
  if (span === null) return null;
  return splitArgs(span.argsText);
}

function parseElementStatement(
  trimmedLine: string,
  keyword: string,
  info: ElementKeywordInfo,
  lineEntry: BlockLine,
  issues: ParseIssue[],
): ElementStatement | null {
  const args = parseArgs(trimmedLine, keyword);
  if (args === null) {
    issues.push({
      severity: 'error',
      line: lineEntry.line,
      message: `${keyword} の引数の括弧が不正です。`,
    });
    return null;
  }
  const alias = args[0];
  const label = args[1];
  if (alias === undefined || label === undefined) {
    issues.push({
      severity: 'error',
      line: lineEntry.line,
      message: `${keyword} には alias と label が必要です。`,
    });
    return null;
  }
  // Container/Componentのみtech引数を持つ(設計書§5.2の対応表)。
  const hasTech = info.kind === 'container' || info.kind === 'component';
  const technology = hasTech ? args[2] : undefined;
  const description = hasTech ? args[3] : args[2];

  return {
    type: 'element',
    kind: info.kind,
    variant: info.variant,
    external: info.external,
    alias,
    label,
    line: lineEntry.line,
    ...(technology !== undefined ? { technology } : {}),
    ...(description !== undefined ? { description } : {}),
  };
}

function parseBoundaryStatement(
  trimmedLine: string,
  keyword: string,
  boundaryKind: BoundaryKind,
  lineEntry: BlockLine,
  issues: ParseIssue[],
): BoundaryStatement | null {
  const args = parseArgs(trimmedLine, keyword);
  if (args === null) {
    issues.push({
      severity: 'error',
      line: lineEntry.line,
      message: `${keyword} の引数の括弧が不正です。`,
    });
    return null;
  }
  const alias = args[0];
  if (alias === undefined) {
    issues.push({
      severity: 'error',
      line: lineEntry.line,
      message: `${keyword} には alias が必要です。`,
    });
    return null;
  }
  return {
    type: 'boundary',
    boundaryKind,
    alias,
    label: args[1] ?? '',
    children: [],
    line: lineEntry.line,
    closedImplicitly: false,
  };
}

function parseRelStatement(
  trimmedLine: string,
  keyword: string,
  lineEntry: BlockLine,
  issues: ParseIssue[],
): RelStatement | null {
  const args = parseArgs(trimmedLine, keyword);
  if (args === null) {
    issues.push({
      severity: 'error',
      line: lineEntry.line,
      message: `${keyword} の引数の括弧が不正です。`,
    });
    return null;
  }
  const from = args[0];
  const to = args[1];
  if (from === undefined || to === undefined) {
    issues.push({
      severity: 'error',
      line: lineEntry.line,
      message: `${keyword} には from と to が必要です。`,
    });
    return null;
  }
  const label = args[2];
  const technology = args[3];
  return {
    type: 'rel',
    from,
    to,
    bidirectional: keyword === 'BiRel',
    line: lineEntry.line,
    ...(label !== undefined ? { label } : {}),
    ...(technology !== undefined ? { technology } : {}),
  };
}

/**
 * C4Context/C4Container/C4Component ブロックの本文をASTに変換する。
 * エイリアス解決・統一モデル構築は行わない(T1-3の範囲)。ここではBoundaryのネストを
 * 保持しつつ、文単位でエラー/警告を積む。
 */
export function parseC4Block(block: SourceBlock & { kind: C4BlockKind }): ParseC4BlockResult {
  const issues: ParseIssue[] = [];
  const topStatements: C4Statement[] = [];
  const boundaryStack: BoundaryStatement[] = [];

  for (const lineEntry of block.lines) {
    const trimmed = lineEntry.text.trim();

    // Boundaryの `{` は宣言行の解析時点で開始済み扱いにしている(下記参照)ため、
    // 単独行の `{` は読み飛ばすだけでよい。
    if (trimmed === '{') continue;

    if (trimmed === '}') {
      const closed = boundaryStack.pop();
      if (closed === undefined) {
        issues.push(unsupportedIssue(lineEntry));
      }
      continue;
    }

    const keywordMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (keywordMatch === null) {
      issues.push(unsupportedIssue(lineEntry));
      continue;
    }
    const keyword = keywordMatch[1];
    if (keyword === undefined) {
      issues.push(unsupportedIssue(lineEntry));
      continue;
    }

    if (IGNORED_KEYWORDS.has(keyword)) continue;

    const target: C4Statement[] =
      boundaryStack.length > 0 ? boundaryStack[boundaryStack.length - 1]!.children : topStatements;

    const elementInfo = matchElementKeyword(keyword);
    if (elementInfo !== null) {
      const parsed = parseElementStatement(trimmed, keyword, elementInfo, lineEntry, issues);
      if (parsed !== null) target.push(parsed);
      continue;
    }

    const boundaryKind = BOUNDARY_KEYWORDS[keyword];
    if (boundaryKind !== undefined) {
      const parsed = parseBoundaryStatement(trimmed, keyword, boundaryKind, lineEntry, issues);
      if (parsed !== null) {
        // 同一行末尾/単独行いずれの `{` も許容するため、宣言行の時点でBoundaryを開始する
        // (設計書§5.2)。閉じ忘れはブロック終端の暗黙クローズ処理でwarningにする。
        target.push(parsed);
        boundaryStack.push(parsed);
      }
      continue;
    }

    if (keyword === 'BiRel' || REL_KEYWORD_PATTERN.test(keyword)) {
      const parsed = parseRelStatement(trimmed, keyword, lineEntry, issues);
      if (parsed !== null) target.push(parsed);
      continue;
    }

    issues.push(unsupportedIssue(lineEntry));
  }

  for (const unclosed of boundaryStack) {
    unclosed.closedImplicitly = true;
    issues.push({
      severity: 'warning',
      line: unclosed.line,
      message: `Boundary "${unclosed.alias}" が閉じられていません。ブロック終端で暗黙的にクローズしました。`,
    });
  }

  return {
    ast: { kind: block.kind, startLine: block.startLine, statements: topStatements },
    issues,
  };
}
