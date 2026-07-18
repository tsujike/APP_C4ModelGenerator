/**
 * AST群(splitBlocks/parseC4Block/parseClassBlock の出力)を統一モデル C4Model に統合する(T1-3)。
 * 設計書 docs/02_アーキテクチャ設計書.md §4「階層の構築規則」を実装する。
 * `model/` はDOM非依存の純関数のみで構成する(実装指示書§4)。
 */

import { parseC4Block } from '../parser/parseC4Block';
import { parseClassBlock } from '../parser/parseClassBlock';
import { splitBlocks } from '../parser/splitBlocks';
import type {
  BoundaryKind,
  BoundaryStatement,
  C4BlockKind,
  C4Statement,
  ElementStatement,
  ParseIssue,
  RelStatement,
  SourceBlock,
} from '../parser/types';
import type { C4Edge, C4Model, C4Node, Level, NodeKind } from './types';

export interface BuildModelResult {
  model: C4Model;
  issues: ParseIssue[];
}

/**
 * ソーステキストを解析し、統一モデル C4Model を構築する。
 *
 * 構築順序は「ソース上の出現順」ではなく「レベル順(Context→Container→Component→
 * classDiagram)」で行う。これは §4 の結び付け規則(alias参照による解決)が、参照先が
 * ソース上で後方に書かれていても解決できるべきだからで、最も単純にそれを満たす実装が
 * レベル順の複数パスである(仕様に順序の明記は無いため、最単純解釈として採用)。
 */
export function buildModel(source: string): BuildModelResult {
  const issues: ParseIssue[] = [];
  const byAlias = new Map<string, C4Node>();
  const rawEdges: C4Edge[] = [];

  const blocks = splitBlocks(source);
  const contextBlocks = blocks.filter(isC4BlockOfKind('C4Context'));
  const containerBlocks = blocks.filter(isC4BlockOfKind('C4Container'));
  const componentBlocks = blocks.filter(isC4BlockOfKind('C4Component'));
  const classDiagramBlocks = blocks.filter((b) => b.kind === 'classDiagram');

  const roots = buildRoots(contextBlocks, byAlias, rawEdges, issues);
  buildBoundaryLevel(containerBlocks, 2, 'system', 'system', byAlias, rawEdges, issues);
  buildBoundaryLevel(componentBlocks, 3, 'container', 'container', byAlias, rawEdges, issues);
  buildClassDiagrams(classDiagramBlocks, byAlias, rawEdges, issues);

  const edges = resolveEdges(rawEdges, byAlias, issues);

  return { model: { roots, byAlias, edges }, issues };
}

/** `blocks.filter` 用の型ガード生成。フィルタ後の要素型を `parseC4Block` が要求する形に絞る。 */
function isC4BlockOfKind<K extends C4BlockKind>(kind: K) {
  return (block: SourceBlock): block is SourceBlock & { kind: K } => block.kind === kind;
}

/** alias をグローバルに登録する。重複時は初出を採用し、後続の宣言は error にして無視する(§4)。 */
function registerAlias(node: C4Node, byAlias: Map<string, C4Node>, issues: ParseIssue[]): boolean {
  if (byAlias.has(node.alias)) {
    issues.push({
      severity: 'error',
      line: node.sourceLine,
      message: `alias "${node.alias}" は既に使用されています。初出を採用し、この宣言は無視します。`,
    });
    return false;
  }
  byAlias.set(node.alias, node);
  return true;
}

function elementToNode(stmt: ElementStatement, level: Level): C4Node {
  return {
    alias: stmt.alias,
    label: stmt.label,
    kind: stmt.kind,
    variant: stmt.variant,
    external: stmt.external,
    level,
    children: [],
    sourceLine: stmt.line,
    ...(stmt.technology !== undefined ? { technology: stmt.technology } : {}),
    ...(stmt.description !== undefined ? { description: stmt.description } : {}),
  };
}

function boundaryToNode(stmt: BoundaryStatement, level: Level): C4Node {
  return {
    alias: stmt.alias,
    label: stmt.label,
    kind: 'boundary',
    variant: 'default',
    external: false,
    level,
    children: [],
    sourceLine: stmt.line,
  };
}

function relToEdge(stmt: RelStatement, declaredLevel: Level): C4Edge {
  return {
    from: stmt.from,
    to: stmt.to,
    bidirectional: stmt.bidirectional,
    declaredLevel,
    sourceLine: stmt.line,
    ...(stmt.label !== undefined ? { label: stmt.label } : {}),
    ...(stmt.technology !== undefined ? { technology: stmt.technology } : {}),
  };
}

/**
 * 文の配列を再帰的に処理し、要素は `target` に、Boundary(Enterprise_Boundary等の
 * グループ化ノード)はさらにその children に、Rel は `rawEdges` に積む。
 * Context ブロックの roots 構築と、System_Boundary/Container_Boundary の中身の構築の
 * 両方で使う共通処理(§4の階層構築規則)。
 */
function processStatementsInto(
  statements: readonly C4Statement[],
  level: Level,
  target: C4Node[],
  parent: C4Node | undefined,
  byAlias: Map<string, C4Node>,
  rawEdges: C4Edge[],
  issues: ParseIssue[],
): void {
  for (const stmt of statements) {
    if (stmt.type === 'rel') {
      rawEdges.push(relToEdge(stmt, level));
      continue;
    }
    if (stmt.type === 'element') {
      const node = elementToNode(stmt, level);
      if (parent !== undefined) node.parent = parent;
      if (registerAlias(node, byAlias, issues)) {
        target.push(node);
      }
      continue;
    }
    // boundary: Contextブロック内では Enterprise_Boundary のみが想定される文法だが(§5.2)、
    // ここでは boundaryKind を問わず一律に「視覚グループノードを作る」処理として扱う
    // (最単純解釈。System_Boundary/Container_Boundary は buildBoundaryLevel 側で別途、
    // 「既存ノードへの結び付け」として専用処理する)。
    const boundaryNode = boundaryToNode(stmt, level);
    if (parent !== undefined) boundaryNode.parent = parent;
    if (registerAlias(boundaryNode, byAlias, issues)) {
      target.push(boundaryNode);
      processStatementsInto(
        stmt.children,
        level,
        boundaryNode.children,
        boundaryNode,
        byAlias,
        rawEdges,
        issues,
      );
    }
  }
}

/** C4Context ブロックから roots を構築する(§4: 必ず1つ。0個ならerror、2個目以降はwarningで無視)。 */
function buildRoots(
  contextBlocks: ReadonlyArray<SourceBlock & { kind: C4BlockKind }>,
  byAlias: Map<string, C4Node>,
  rawEdges: C4Edge[],
  issues: ParseIssue[],
): C4Node[] {
  if (contextBlocks.length === 0) {
    issues.push({
      severity: 'error',
      line: 1,
      message: 'C4Contextブロックが見つかりません。少なくとも1つ必要です。',
    });
    return [];
  }

  for (let i = 1; i < contextBlocks.length; i++) {
    const extra = contextBlocks[i];
    if (extra === undefined) continue;
    issues.push({
      severity: 'warning',
      line: extra.startLine,
      message: '2つ目以降のC4Contextブロックは無視します(C4Contextはソース中に1つのみ有効)。',
    });
  }

  const first = contextBlocks[0];
  if (first === undefined) return [];

  const { ast, issues: blockIssues } = parseC4Block(first);
  issues.push(...blockIssues);

  const roots: C4Node[] = [];
  processStatementsInto(ast.statements, 1, roots, undefined, byAlias, rawEdges, issues);
  return roots;
}

/**
 * C4Container/C4Component ブロック群を処理する。
 * ブロック直下の System_Boundary/Container_Boundary の alias が、既に登録済みの
 * (Context/Containerで作られた) 親ノードの alias と一致する場合のみ結び付ける。
 * Boundary外の要素文はwarningで無視し、Boundaryのaliasが未解決の場合もwarningで無視する(§4)。
 */
function buildBoundaryLevel(
  blocks: ReadonlyArray<SourceBlock & { kind: C4BlockKind }>,
  declaredLevel: Level,
  expectedBoundaryKind: BoundaryKind,
  expectedParentKind: NodeKind,
  byAlias: Map<string, C4Node>,
  rawEdges: C4Edge[],
  issues: ParseIssue[],
): void {
  for (const block of blocks) {
    const { ast, issues: blockIssues } = parseC4Block(block);
    issues.push(...blockIssues);

    for (const stmt of ast.statements) {
      if (stmt.type === 'rel') {
        rawEdges.push(relToEdge(stmt, declaredLevel));
        continue;
      }
      if (stmt.type === 'element') {
        issues.push({
          severity: 'warning',
          line: stmt.line,
          message: `Boundaryの外に書かれた要素 "${stmt.alias}" は無視します。`,
        });
        continue;
      }
      // boundary
      if (stmt.boundaryKind !== expectedBoundaryKind) {
        issues.push({
          severity: 'warning',
          line: stmt.line,
          message: `このブロックでは想定されないBoundary種別 "${stmt.alias}" は無視します。`,
        });
        continue;
      }
      const parentNode = byAlias.get(stmt.alias);
      if (parentNode === undefined || parentNode.kind !== expectedParentKind) {
        issues.push({
          severity: 'warning',
          line: stmt.line,
          message: `Boundary "${stmt.alias}" の参照先が見つからないため、このBoundaryを無視します。`,
        });
        continue;
      }
      processStatementsInto(
        stmt.children,
        declaredLevel,
        parentNode.children,
        parentNode,
        byAlias,
        rawEdges,
        issues,
      );
    }
  }
}

/**
 * classDiagram ブロック群を処理する。直前の `%% code-of: <alias>` 指令でComponentに結び付け、
 * 指令が無い/未解決ならブロック全体をwarningで無視する(§4)。
 */
function buildClassDiagrams(
  blocks: readonly SourceBlock[],
  byAlias: Map<string, C4Node>,
  rawEdges: C4Edge[],
  issues: ParseIssue[],
): void {
  for (const block of blocks) {
    if (block.codeOfAlias === undefined) {
      issues.push({
        severity: 'warning',
        line: block.startLine,
        message: 'classDiagramブロックに `%% code-of:` 指令が無いため無視します。',
      });
      continue;
    }
    const target = byAlias.get(block.codeOfAlias);
    if (target === undefined || target.kind !== 'component') {
      issues.push({
        severity: 'warning',
        line: block.startLine,
        message: `code-of指令の参照先 "${block.codeOfAlias}" が見つからないため、このclassDiagramを無視します。`,
      });
      continue;
    }

    const ast = parseClassBlock(block.lines, block.codeOfAlias);

    for (const cls of ast.classes) {
      const node: C4Node = {
        alias: cls.name,
        label: cls.name,
        kind: 'class',
        variant: 'default',
        external: false,
        level: 4,
        children: [],
        sourceLine: cls.sourceLine,
        members: { fields: cls.fields, methods: cls.methods },
        parent: target,
      };
      if (registerAlias(node, byAlias, issues)) {
        target.children.push(node);
      }
    }

    for (const edge of ast.edges) {
      rawEdges.push({
        from: edge.from,
        to: edge.to,
        bidirectional: false,
        declaredLevel: 4,
        sourceLine: edge.sourceLine,
        ...(edge.label !== undefined ? { label: edge.label } : {}),
      });
    }
  }
}

/** Rel/classDiagramエッジのfrom/toをグローバルaliasとして解決する。未解決はerrorでその行のみ無視(§4, §5.2)。 */
function resolveEdges(
  rawEdges: readonly C4Edge[],
  byAlias: Map<string, C4Node>,
  issues: ParseIssue[],
): C4Edge[] {
  const edges: C4Edge[] = [];
  for (const raw of rawEdges) {
    if (!byAlias.has(raw.from) || !byAlias.has(raw.to)) {
      issues.push({
        severity: 'error',
        line: raw.sourceLine,
        message: `Rel の参照先alias("${raw.from}" または "${raw.to}")が見つからないため、この行を無視します。`,
      });
      continue;
    }
    edges.push(raw);
  }
  return edges;
}
