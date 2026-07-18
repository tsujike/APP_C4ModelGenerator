/**
 * classDiagram サブセットのパーサ(T1-2)。
 *
 * 設計書 docs/02_アーキテクチャ設計書.md §5.3 のサブセットのみを解釈する:
 *   - `class Name { ... }` (複数行/単一行ボディ) → field/method 分類
 *   - `class Name` (ボディなし) → 空クラス
 *   - `A --> B`, `A --|> B`, `A *-- B`, `A o-- B`, `A ..> B` (`: label` 任意)
 *   - それ以外の行(`<<interface>>` 等)は warning 無しで無視する。
 *
 * `parser/` は純関数のみ(DOM操作禁止)というコーディング規約に従う。
 *
 * NOTE: `src/parser/types.ts` は T1-1 が新規作成する可能性があるため、本ファイルは
 * それに依存せず、必要な型をすべてローカルに定義する。T1-3 統合時に指揮者側で整理する。
 */

/** classDiagram ブロック本文の1行。行番号はエディタでのジャンプ・エラー表示に使う。 */
export interface ClassBlockLine {
  readonly line: number;
  readonly text: string;
}

/** サポートする矢印種別。継承(`--|>`)のみ描画時に白抜き三角として区別される。 */
export type ClassEdgeArrow = '-->' | '--|>' | '*--' | 'o--' | '..>';

/** `class Name { ... }` から得られるクラスノード。 */
export interface ClassDeclNode {
  readonly kind: 'class';
  readonly name: string;
  readonly fields: string[];
  readonly methods: string[];
  readonly sourceLine: number;
}

/** クラス間の関係を表すエッジノード。declaredLevel=4 は呼び出し側(model層)の責務。 */
export interface ClassEdgeNode {
  readonly kind: 'edge';
  readonly from: string;
  readonly to: string;
  readonly arrow: ClassEdgeArrow;
  readonly label?: string;
  readonly sourceLine: number;
}

/**
 * classDiagram ブロック1つ分のAST。
 * codeOf は `%% code-of: <componentAlias>` 指令の値。指令行の抽出自体は
 * splitBlocks(T1-1)の担当のため、ここでは呼び出し側から渡された値をそのまま保持するだけでよい。
 */
export interface ClassBlockAst {
  readonly codeOf: string | undefined;
  readonly classes: ClassDeclNode[];
  readonly edges: ClassEdgeNode[];
}

// `class Name { <inline body> }` が1行に収まっているケース。
const INLINE_CLASS_RE = /^class\s+(\w+)\s*\{(.*)\}\s*$/;
// `class Name {` で始まり、後続行がボディになる複数行ケース。
const CLASS_BODY_START_RE = /^class\s+(\w+)\s*\{\s*$/;
// ボディを持たない単独の `class Name`。
const CLASS_NO_BODY_RE = /^class\s+(\w+)\s*$/;
// ボディの終端。
const CLASS_BODY_END_RE = /^\}\s*$/;
// エッジ。矢印種別ごとに分岐せず1本の正規表現でまとめて拾う。
const EDGE_RE = /^(\w+)\s*(-->|--\|>|\*--|o--|\.\.>)\s*(\w+)\s*(?::\s*(.*))?$/;
// クラスボディ内のステレオタイプ行(`<<interface>>` 等)。field/methodどちらでもないので無視する。
const STEREOTYPE_RE = /^<<.*>>$/;

/** ボディ中の1論理行(`;` 区切りで複数メンバーが並ぶ場合がある)を field/method に振り分ける。 */
function addMembers(target: { fields: string[]; methods: string[] }, bodyText: string): void {
  for (const rawSegment of bodyText.split(';')) {
    const member = rawSegment.trim();
    if (member === '' || STEREOTYPE_RE.test(member)) {
      continue;
    }
    // 設計書§5.3: `(` を含む行は method、それ以外は field。
    if (member.includes('(')) {
      target.methods.push(member);
    } else {
      target.fields.push(member);
    }
  }
}

/**
 * classDiagram ブロックの本文行を解析してASTを返す。
 *
 * @param lines ブロック本文の行(`classDiagram` 見出し行を含んでいても含んでいなくてもよい。
 *              含まれる場合はコメント同様に読み飛ばす)。
 * @param codeOf `%% code-of:` 指令の値。指令が無ければ undefined。
 */
export function parseClassBlock(
  lines: readonly ClassBlockLine[],
  codeOf: string | undefined,
): ClassBlockAst {
  const classes: ClassDeclNode[] = [];
  const edges: ClassEdgeNode[] = [];

  // 複数行ボディを解析中のクラス。null なら「ボディ外」を意味する。
  let openClass: { name: string; sourceLine: number; fields: string[]; methods: string[] } | null =
    null;

  for (const { line, text } of lines) {
    const trimmed = text.trim();

    if (trimmed === '' || trimmed.startsWith('%%') || trimmed === 'classDiagram') {
      continue;
    }

    if (openClass !== null) {
      if (CLASS_BODY_END_RE.test(trimmed)) {
        classes.push({
          kind: 'class',
          name: openClass.name,
          fields: openClass.fields,
          methods: openClass.methods,
          sourceLine: openClass.sourceLine,
        });
        openClass = null;
      } else {
        addMembers(openClass, trimmed);
      }
      continue;
    }

    const inlineMatch = INLINE_CLASS_RE.exec(trimmed);
    if (inlineMatch) {
      const name = inlineMatch[1];
      const body = inlineMatch[2];
      if (name !== undefined && body !== undefined) {
        const members = { fields: [] as string[], methods: [] as string[] };
        addMembers(members, body);
        classes.push({
          kind: 'class',
          name,
          fields: members.fields,
          methods: members.methods,
          sourceLine: line,
        });
      }
      continue;
    }

    const bodyStartMatch = CLASS_BODY_START_RE.exec(trimmed);
    if (bodyStartMatch) {
      const name = bodyStartMatch[1];
      if (name !== undefined) {
        openClass = { name, sourceLine: line, fields: [], methods: [] };
      }
      continue;
    }

    const noBodyMatch = CLASS_NO_BODY_RE.exec(trimmed);
    if (noBodyMatch) {
      const name = noBodyMatch[1];
      if (name !== undefined) {
        classes.push({ kind: 'class', name, fields: [], methods: [], sourceLine: line });
      }
      continue;
    }

    const edgeMatch = EDGE_RE.exec(trimmed);
    if (edgeMatch) {
      const from = edgeMatch[1];
      const arrow = edgeMatch[2];
      const to = edgeMatch[3];
      const rawLabel = edgeMatch[4];
      if (
        from !== undefined &&
        to !== undefined &&
        arrow !== undefined &&
        isClassEdgeArrow(arrow)
      ) {
        const label = rawLabel?.trim();
        edges.push({
          kind: 'edge',
          from,
          to,
          arrow,
          sourceLine: line,
          ...(label !== undefined && label !== '' ? { label } : {}),
        });
      }
      continue;
    }

    // 未対応の記法(ステレオタイプ宣言単独行、note等)は設計書§5.3の規定どおり warning 無しで無視する。
  }

  // ファイル終端まで `}` が来ずボディが閉じられなかった場合も、集めたメンバーはそのまま採用する
  // (classDiagramサブセットでは閉じ忘れに対するエラー規定が無いため、寛容に扱う)。
  if (openClass !== null) {
    classes.push({
      kind: 'class',
      name: openClass.name,
      fields: openClass.fields,
      methods: openClass.methods,
      sourceLine: openClass.sourceLine,
    });
  }

  return { codeOf, classes, edges };
}

function isClassEdgeArrow(value: string): value is ClassEdgeArrow {
  return (
    value === '-->' || value === '--|>' || value === '*--' || value === 'o--' || value === '..>'
  );
}
