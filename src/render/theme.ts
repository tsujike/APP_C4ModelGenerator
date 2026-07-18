/**
 * C4スタイル定数とExcalidraw要素へのマッピング(設計書 docs/02_アーキテクチャ設計書.md §7.2)。
 * 色の実値は src/constants.ts の C4_COLORS を再利用し、ここでは重複定義しない。
 * `render/` はDOM非依存の純関数のみで構成する(実装指示書§4)。
 */

import { C4_COLORS } from '../constants';
import type { NodeKind } from '../model/types';

/** 手描き風パラメータ(§7.2)。Excalidrawの既定値をそのまま採用する。 */
export const ROUGHNESS = 1;
export const STROKE_WIDTH = 1;

export interface NodeColors {
  background: string;
  text: string;
}

/** ノード種別+external有無から塗り色・文字色を決める(§7.2の対応表)。 */
export function nodeColors(kind: NodeKind, external: boolean): NodeColors {
  switch (kind) {
    case 'person':
      return {
        background: external ? C4_COLORS.person.extFill : C4_COLORS.person.fill,
        text: '#ffffff',
      };
    case 'system':
      return {
        background: external ? C4_COLORS.system.extFill : C4_COLORS.system.fill,
        text: '#ffffff',
      };
    case 'container':
      return {
        background: external ? C4_COLORS.container.extFill : C4_COLORS.container.fill,
        text: '#ffffff',
      };
    case 'component':
      return {
        background: external ? C4_COLORS.component.extFill : C4_COLORS.component.fill,
        text: '#000000',
      };
    case 'class':
      return { background: C4_COLORS.class.fill, text: '#000000' };
    case 'boundary':
      return { background: 'transparent', text: C4_COLORS.boundary.text };
  }
}

/** 展開枠(境界)スタイルの枠線色・文字色(§7.2「Boundary(展開枠)」行)。 */
export const BOUNDARY_STROKE_COLOR = C4_COLORS.boundary.text;
export const BOUNDARY_TEXT_COLOR = C4_COLORS.boundary.text;

export const CLASS_STROKE_COLOR = C4_COLORS.class.stroke;

export const EDGE_STROKE_COLOR = C4_COLORS.edge.stroke;
export const EDGE_LABEL_TEXT_COLOR = C4_COLORS.edgeLabelChip.text;

/**
 * 矢印終端の種別(§7.2: 通常は "arrow"、L4クラス図の継承(`--|>`)のみ "triangle")。
 * L2ではassociation固定になるが、L4実装(スコープ外)に備えて型だけ用意しておく。
 */
export type ArrowKind = 'association' | 'inheritance';

export function endArrowheadFor(kind: ArrowKind): 'arrow' | 'triangle' {
  return kind === 'inheritance' ? 'triangle' : 'arrow';
}
