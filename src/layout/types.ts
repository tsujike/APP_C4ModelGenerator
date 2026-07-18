/**
 * layout/ の出力型(設計書 docs/02_アーキテクチャ設計書.md §7.1)。
 * elkjs呼び出し結果を「ノードごとの絶対座標・寸法」「エッジごとの折れ線経路・ラベル位置」に
 * 変換したもの。実装指示書§4のモジュール依存方向により、この型を消費してよい render/ 側の
 * モジュールは toExcalidraw.ts のみ(shapes.ts/theme.ts はこの型に依存しない)。
 */

import type { Level, NodeKind, NodeVariant } from '../model/types';

/** 表示レベルで可視な1ノードの絶対座標・寸法・種別情報。 */
export interface LayoutNode {
  /** C4Node.alias と一致する(§7.2の決定的id生成の基。例: "api")。 */
  id: string;
  kind: NodeKind;
  variant: NodeVariant;
  external: boolean;
  label: string;
  technology?: string;
  description?: string;
  /** 祖先オフセットを累積加算した絶対座標(T2-0a知見。elkjsの子ノード座標は親ローカル)。 */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * true: 可視な子を持つため境界(展開枠)スタイルで描画する(設計書§6手順1)。
   * false: 子を持たない/未定義のため種別色の葉ボックスとして描画する。
   */
  isBoundary: boolean;
  parentId?: string;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

/** 射影・集約済みの1エッジ(model/project.ts の ProjectedEdge)のレイアウト結果。 */
export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  technology?: string;
  bidirectional: boolean;
  /** elkjsのルーティング経路を絶対座標に変換した折れ線(始点→経由点…→終点)。 */
  points: LayoutPoint[];
  /** ラベル表示位置(経路の弧長中点)。 */
  labelPosition: LayoutPoint;
}

export interface LayoutResult {
  level: Level;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** 図全体のバウンディングボックス(elkjsのルートグラフの寸法)。 */
  width: number;
  height: number;
}
