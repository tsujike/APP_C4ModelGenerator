/**
 * elkjsを用いたレベル別レイアウト生成(設計書 docs/02_アーキテクチャ設計書.md §7.1)。
 *
 * 重要な前提(T2-0aスパイクで確認済み。docs/PROGRESS.md参照): elkjsのレイアウト結果で、
 * 子ノードの x/y は**親のローカル座標系**(親の左上原点からの相対値)であり絶対座標ではない。
 * 同様に、あるノードの `edges` 配列に属するエッジのルーティング経路(sections)も、その
 * ノードのローカル座標系で返る。そのため本モジュールでは、elkjsの結果ツリーを再帰的に辿り、
 * 祖先ノードの絶対座標を都度加算していくことで LayoutResult の絶対座標を得る(walkNode)。
 *
 * elkjsのインポートについて: `import ELK from 'elkjs'`(メインエントリ)は内部で `lib/main.js` を
 * 経由し、Node向けのワーカーフォールバック処理に `require('web-worker')` を含む。これは
 * `options.workerUrl` を渡さない限り実行時には到達しないコードだが、Viteの本番ビルド
 * (Rolldown)は条件分岐に関わらずrequireを静的に解決しようとして失敗する(実測確認済み:
 * `npm run build` が `Rolldown failed to resolve import "web-worker"` で失敗する)。そのため
 * ここでは `elk-api.js`(ELK本体、requireなし)と `elk-worker.js`(GWTコンパイル済みの同期
 * フェイクワーカー、requireなし)を直接組み合わせ、ブラウザ・Node双方で安全にバンドルできる
 * 構成にする(型は `elkjs-worker.d.ts` で補っている)。
 */

import ElkConstructor from 'elkjs/lib/elk-api.js';
import type { ElkEdgeSection, ElkExtendedEdge, ElkNode, ElkPoint } from 'elkjs/lib/elk-api.js';
import { Worker as ElkFakeWorker } from 'elkjs/lib/elk-worker.js';
import { LAYOUT } from '../constants';
import type { ProjectedEdge, ProjectedGraph } from '../model/project';
import type { C4Model, C4Node, Level } from '../model/types';
import type { LayoutEdge, LayoutNode, LayoutPoint, LayoutResult } from './types';

/** 射影後の (from,to) 共通祖先を持たないエッジ(=ルートグラフ直下に置くエッジ)を表すキー。 */
const ROOT_CONTAINER = '__root__';

const elk = new ElkConstructor({ workerFactory: () => new ElkFakeWorker() });

/**
 * C4Model と、表示レベルへ射影済みの ProjectedGraph から LayoutResult を生成する。
 * elk.layout() が非同期APIのため本関数もPromiseを返す。
 */
export async function layout(model: C4Model, graph: ProjectedGraph): Promise<LayoutResult> {
  const level = graph.level;
  const visibleRoots = model.roots.filter((n) => n.level <= level);

  const pathById = new Map<string, string[]>();
  collectPaths(visibleRoots, level, [], pathById);

  const edgesByContainer = groupEdgesByContainer(graph.edges, pathById);
  const edgeMetaById = new Map<string, ProjectedEdge>();
  let edgeSeq = 0;
  const nextEdgeId = (): string => {
    edgeSeq += 1;
    return `edge-${String(edgeSeq)}`;
  };

  const rootChildren = visibleRoots.map((node) =>
    buildElkNode(node, level, edgesByContainer, edgeMetaById, nextEdgeId),
  );
  const rootEdges = (edgesByContainer.get(ROOT_CONTAINER) ?? []).map((e) =>
    toElkEdge(e, nextEdgeId(), edgeMetaById),
  );

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      // NFR-3対策(申し送り: docs/PROGRESS.md T5-2項目参照)。既定のthoroughness(7)は
      // crossing minimizationの反復回数が多く、200ノード/300エッジ規模の負荷サンプルで
      // elk.layout()単体が1呼び出しあたり数百ms〜900ms超かかる主因になっていた(実測で
      // プロファイリング済み: 律速はノード数よりエッジ密度)。thoroughness=1(最小反復)に
      // 下げることでNFR-3計測の合計時間が平均約2765ms→約1900ms(約21%減)に改善することを
      // 実測確認した。実際に本アプリで使うサンプル規模(数十ノード程度)では交差数自体が
      // 少なく、thoroughness=1でも視覚的な劣化(交差増加)は実機目視で確認できなかった
      // (小規模グラフでは反復してもしなくても最適解に近い結果になりやすいため)。
      'elk.layered.thoroughness': '1',
      'elk.padding': paddingOption(LAYOUT.rootPadding),
      'elk.spacing.nodeNode': String(LAYOUT.elkSpacingNodeNode),
      'elk.spacing.edgeNode': String(LAYOUT.elkSpacingEdgeNode),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYOUT.elkLayerSpacing),
    },
    children: rootChildren,
    edges: rootEdges,
  };

  const result = await elk.layout(elkGraph);

  return convertElkResult(result, level, model.byAlias, edgeMetaById);
}

/**
 * elkjsの結果ツリー(ElkNode)を LayoutResult に変換する純関数部分を `layout()` から切り出したもの。
 * 祖先オフセットの累積加算(T2-0a知見。本ファイル冒頭のコメント参照)がこの関数の核心であり、
 * elk.layout() の呼び出し(非同期・実際のレイアウト計算)を挟まずに直接テストできるよう
 * 独立した関数として公開している(tests/layout/layout.test.ts で手計算した期待値と突き合わせる)。
 */
export function convertElkResult(
  result: ElkNode,
  level: Level,
  byAlias: ReadonlyMap<string, C4Node>,
  edgeMetaById: ReadonlyMap<string, ProjectedEdge>,
): LayoutResult {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  walkNode(result, 0, 0, undefined, true, byAlias, edgeMetaById, nodes, edges);

  const width = result.width ?? boundingWidth(nodes);
  const height = result.height ?? boundingHeight(nodes);

  return { level, nodes, edges, width, height };
}

function paddingOption(p: number): string {
  return `[top=${String(p)},left=${String(p)},bottom=${String(p)},right=${String(p)}]`;
}

/** alias -> ルートからそのノード自身までの祖先chain(alias配列)を再帰的に収集する。 */
function collectPaths(
  nodes: readonly C4Node[],
  level: Level,
  prefix: readonly string[],
  out: Map<string, string[]>,
): void {
  for (const node of nodes) {
    const path = [...prefix, node.alias];
    out.set(node.alias, path);
    const visibleChildren = node.children.filter((c) => c.level <= level);
    collectPaths(visibleChildren, level, path, out);
  }
}

/** 2つの祖先chainの最も深い共通祖先(alias)を返す。共通祖先が無ければundefined。 */
function commonAncestor(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): string | undefined {
  if (a === undefined || b === undefined) return undefined;
  let result: string | undefined;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) break;
    result = a[i];
  }
  return result;
}

/**
 * 各エッジを「from/toの最も深い共通祖先ノード」に割り当てる。これがelkjsにおいて
 * そのエッジを載せるべき `edges` 配列の所在(=ローカル座標系の基準)になる。
 * 共通祖先が無い(異なるルート間)場合は ROOT_CONTAINER(ルートグラフ直下)に割り当てる。
 */
function groupEdgesByContainer(
  edgesIn: readonly ProjectedEdge[],
  pathById: ReadonlyMap<string, string[]>,
): Map<string, ProjectedEdge[]> {
  const map = new Map<string, ProjectedEdge[]>();
  for (const edge of edgesIn) {
    const key = commonAncestor(pathById.get(edge.from), pathById.get(edge.to)) ?? ROOT_CONTAINER;
    const list = map.get(key);
    if (list !== undefined) {
      list.push(edge);
    } else {
      map.set(key, [edge]);
    }
  }
  return map;
}

function toElkEdge(
  edge: ProjectedEdge,
  id: string,
  edgeMetaById: Map<string, ProjectedEdge>,
): ElkExtendedEdge {
  edgeMetaById.set(id, edge);
  return { id, sources: [edge.from], targets: [edge.to] };
}

/**
 * C4Node 1つ分の ElkNode を(可視な子を再帰的に含めて)構築する。
 * 可視な子を持つノードは elk の子付きノード(境界)として、そうでなければ寸法を見積もった
 * 葉ノードとして表現する(設計書§6手順1・§7.1)。
 */
function buildElkNode(
  node: C4Node,
  level: Level,
  edgesByContainer: ReadonlyMap<string, ProjectedEdge[]>,
  edgeMetaById: Map<string, ProjectedEdge>,
  nextEdgeId: () => string,
): ElkNode {
  const visibleChildren = node.children.filter((c) => c.level <= level);
  const ownEdges = (edgesByContainer.get(node.alias) ?? []).map((e) =>
    toElkEdge(e, nextEdgeId(), edgeMetaById),
  );

  if (visibleChildren.length > 0) {
    return {
      id: node.alias,
      layoutOptions: {
        // 境界(展開枠)は左上にラベルを描くため、上部だけ広めの余白を確保する(§7.2)。
        'elk.padding': `[top=${String(LAYOUT.boundaryTopPadding)},left=${String(LAYOUT.boundaryPadding)},bottom=${String(LAYOUT.boundaryPadding)},right=${String(LAYOUT.boundaryPadding)}]`,
        // spacing系オプションはルートに設定するだけでは入れ子グラフ(境界の中身)に継承されない
        // (実機確認: ルートのみ設定した場合、境界内の子ノード間隔が既定値のまま変わらなかった)。
        // ネストしたlayered実行にも同じ間隔を効かせるため、境界ノード自身にも明示的に設定する。
        'elk.spacing.nodeNode': String(LAYOUT.elkSpacingNodeNode),
        'elk.spacing.edgeNode': String(LAYOUT.elkSpacingEdgeNode),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYOUT.elkLayerSpacing),
      },
      children: visibleChildren.map((c) =>
        buildElkNode(c, level, edgesByContainer, edgeMetaById, nextEdgeId),
      ),
      edges: ownEdges,
    };
  }

  const { width, height } = estimateLeafSize(node);
  return { id: node.alias, width, height, edges: ownEdges };
}

/**
 * elkjsの結果ツリーを再帰的に辿り、絶対座標(祖先オフセット累積済み)の LayoutNode/LayoutEdge を
 * 収集する。offsetX/offsetY は「このノードの子および `edges` が使うローカル座標系の原点」を
 * 表す絶対座標であり、呼び出しごとに `offset + 自身のx/y` を次の offset として子に渡す
 * (T2-0a知見: 子ノード座標・そのノードに属するエッジ経路は共に同じローカル座標系を共有する)。
 */
function walkNode(
  elkNode: ElkNode,
  offsetX: number,
  offsetY: number,
  parentId: string | undefined,
  isRoot: boolean,
  byAlias: ReadonlyMap<string, C4Node>,
  edgeMetaById: ReadonlyMap<string, ProjectedEdge>,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): void {
  const absX = offsetX + (elkNode.x ?? 0);
  const absY = offsetY + (elkNode.y ?? 0);

  if (!isRoot) {
    const modelNode = byAlias.get(elkNode.id);
    if (modelNode !== undefined) {
      nodes.push({
        id: elkNode.id,
        kind: modelNode.kind,
        variant: modelNode.variant,
        external: modelNode.external,
        label: modelNode.label,
        x: absX,
        y: absY,
        width: elkNode.width ?? 0,
        height: elkNode.height ?? 0,
        isBoundary: (elkNode.children?.length ?? 0) > 0,
        ...(modelNode.technology !== undefined ? { technology: modelNode.technology } : {}),
        ...(modelNode.description !== undefined ? { description: modelNode.description } : {}),
        ...(parentId !== undefined ? { parentId } : {}),
      });
    }
  }

  for (const elkEdge of elkNode.edges ?? []) {
    const meta = edgeMetaById.get(elkEdge.id);
    if (meta === undefined) continue; // unreachable: 全edgeはtoElkEdgeでedgeMetaByIdに登録済み
    edges.push(convertEdge(meta, elkEdge, absX, absY));
  }

  for (const child of elkNode.children ?? []) {
    walkNode(
      child,
      absX,
      absY,
      isRoot ? undefined : elkNode.id,
      false,
      byAlias,
      edgeMetaById,
      nodes,
      edges,
    );
  }
}

function convertEdge(
  meta: ProjectedEdge,
  elkEdge: ElkExtendedEdge,
  offsetX: number,
  offsetY: number,
): LayoutEdge {
  const points = extractPoints(elkEdge.sections ?? [], offsetX, offsetY);
  const labelPosition = midpointAlongPath(points);
  return {
    from: meta.from,
    to: meta.to,
    bidirectional: meta.bidirectional,
    points,
    labelPosition,
    ...(meta.label !== undefined ? { label: meta.label } : {}),
    ...(meta.technology !== undefined ? { technology: meta.technology } : {}),
  };
}

function extractPoints(
  sections: readonly ElkEdgeSection[],
  offsetX: number,
  offsetY: number,
): LayoutPoint[] {
  const points: LayoutPoint[] = [];
  for (const section of sections) {
    points.push(toAbsolute(section.startPoint, offsetX, offsetY));
    for (const bend of section.bendPoints ?? []) {
      points.push(toAbsolute(bend, offsetX, offsetY));
    }
    points.push(toAbsolute(section.endPoint, offsetX, offsetY));
  }
  return points;
}

function toAbsolute(p: ElkPoint, offsetX: number, offsetY: number): LayoutPoint {
  return { x: offsetX + p.x, y: offsetY + p.y };
}

/** 折れ線経路の弧長中点(ラベル表示位置)を求める。 */
function midpointAlongPath(points: readonly LayoutPoint[]): LayoutPoint {
  const first = points[0];
  if (first === undefined) return { x: 0, y: 0 };
  if (points.length === 1) return first;

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segmentLengths.push(len);
    total += len;
  }

  let remaining = total / 2;
  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    const a = points[i];
    const b = points[i + 1];
    if (len === undefined || a === undefined || b === undefined) continue;
    if (remaining <= len) {
      const t = len === 0 ? 0 : remaining / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= len;
  }
  return points[points.length - 1] ?? first;
}

/**
 * 葉ノード(可視な子を持たないノード)の寸法をテキストから見積もる(設計書§7.1)。
 * ラベル/[技術]の幅からノード幅を決め、その幅で説明文を折り返した行数から高さを決める。
 * 厳密な文字幅測定(ctx.measureText等)は要件上不要なため、フォントサイズ比の近似値を使う。
 */
function estimateLeafSize(node: C4Node): { width: number; height: number } {
  const charWidth = LAYOUT.fontSize * LAYOUT.charWidthFactor;
  const techLine = node.technology !== undefined ? `[${node.technology}]` : undefined;
  const primaryLen = Math.max(node.label.length, techLine?.length ?? 0);
  const width = clamp(
    primaryLen * charWidth + LAYOUT.nodePaddingX * 2,
    LAYOUT.minNodeWidth,
    LAYOUT.maxNodeWidth,
  );

  const charsPerLine = Math.max(1, Math.floor((width - LAYOUT.nodePaddingX * 2) / charWidth));
  const descriptionLineCount =
    node.description !== undefined
      ? wrapCharacters(node.description, charsPerLine, LAYOUT.maxDescriptionLines).length
      : 0;
  const lineCount = 1 + (techLine !== undefined ? 1 : 0) + descriptionLineCount;

  const headExtra = node.kind === 'person' ? LAYOUT.personHeadDiameter : 0;
  const height = Math.max(
    LAYOUT.minNodeHeight,
    lineCount * LAYOUT.lineHeight + LAYOUT.nodePaddingY * 2 + headExtra,
  );
  return { width, height };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 文字数ベースの単純な折返し(§7.1: 厳密測定は不要)。maxLines を超える残りがあれば
 * 最終行を "…" で切り詰める。render/shapes.ts にもテキスト整形用の同種のロジックがあるが、
 * layout/ と render/ は互いにimportしない(実装指示書§4)ため、意図的に軽量に重複させている。
 */
function wrapCharacters(text: string, charsPerLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest.length > 0 && lines.length < maxLines) {
    if (rest.length <= charsPerLine) {
      lines.push(rest);
      rest = '';
      break;
    }
    lines.push(rest.slice(0, charsPerLine));
    rest = rest.slice(charsPerLine);
  }
  if (rest.length > 0) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] =
      last.length > 0 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : '…';
  }
  return lines;
}

function boundingWidth(nodes: readonly LayoutNode[]): number {
  return nodes.reduce((max, n) => Math.max(max, n.x + n.width), 0);
}

function boundingHeight(nodes: readonly LayoutNode[]): number {
  return nodes.reduce((max, n) => Math.max(max, n.y + n.height), 0);
}
