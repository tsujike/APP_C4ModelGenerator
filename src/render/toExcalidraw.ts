/**
 * LayoutResult → ExcalidrawElementSkeleton[] 変換(設計書 docs/02_アーキテクチャ設計書.md §7.1/§7.2)。
 *
 * 実装指示書§4のモジュール依存方向により、`layout/` の出力型(LayoutResult等)を消費してよい
 * `render/` 側のモジュールはこのファイルのみ(shapes.ts/theme.ts は layout/ に依存しない)。
 * host.tsx側で `convertToExcalidrawElements` に渡されて初めて実際のExcalidraw要素になる
 * (Reactを直接importしないため、ここでは型のみを扱う)。
 */

import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import { LAYOUT } from '../constants';
import type { LayoutEdge, LayoutNode, LayoutResult } from '../layout/types';
import { buildNodeElements, type NodeShapeInput } from './shapes';
import {
  EDGE_LABEL_TEXT_COLOR,
  EDGE_STROKE_COLOR,
  ROUGHNESS,
  STROKE_WIDTH,
  endArrowheadFor,
} from './theme';

/** LayoutResult(あるレベルの可視ノード・射影済みエッジ)を1レベル分のExcalidraw要素群に変換する。 */
export function toExcalidraw(result: LayoutResult): ExcalidrawElementSkeleton[] {
  const levelPrefix = `L${String(result.level)}`;
  const elements: ExcalidrawElementSkeleton[] = [];

  for (const node of result.nodes) {
    elements.push(...buildNodeElements(toShapeInput(node, levelPrefix)));
  }
  for (const edge of result.edges) {
    elements.push(buildEdgeElement(edge, levelPrefix));
  }
  return elements;
}

function toShapeInput(node: LayoutNode, levelPrefix: string): NodeShapeInput {
  return {
    id: node.id,
    levelPrefix,
    kind: node.kind,
    variant: node.variant,
    external: node.external,
    label: node.label,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    isBoundary: node.isBoundary,
    ...(node.technology !== undefined ? { technology: node.technology } : {}),
    ...(node.description !== undefined ? { description: node.description } : {}),
  };
}

/** エッジ1本をarrow要素(+boundElementのラベル)に変換する。経路はelkjsのルーティングをそのまま使う(§7.2)。 */
function buildEdgeElement(edge: LayoutEdge, levelPrefix: string): ExcalidrawElementSkeleton {
  const points = edge.points.length >= 2 ? edge.points : [edge.labelPosition, edge.labelPosition];
  const origin = points[0] ?? { x: 0, y: 0 };
  const relativePoints = points.map((p): [number, number] => [p.x - origin.x, p.y - origin.y]);

  const labelText = buildLabelText(edge);

  return {
    id: `${levelPrefix}:edge:${edge.from}->${edge.to}`,
    type: 'arrow',
    x: origin.x,
    y: origin.y,
    points: relativePoints,
    strokeColor: EDGE_STROKE_COLOR,
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    startArrowhead: edge.bidirectional ? 'arrow' : null,
    endArrowhead: endArrowheadFor('association'),
    ...(labelText !== undefined
      ? {
          label: { text: labelText, fontSize: LAYOUT.fontSize, strokeColor: EDGE_LABEL_TEXT_COLOR },
        }
      : {}),
  };
}

function buildLabelText(edge: Pick<LayoutEdge, 'label' | 'technology'>): string | undefined {
  const parts: string[] = [];
  if (edge.label !== undefined) parts.push(edge.label);
  if (edge.technology !== undefined) parts.push(`[${edge.technology}]`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}
