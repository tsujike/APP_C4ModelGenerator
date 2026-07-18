/**
 * セマンティックズームの定数定義。
 * 出典: docs/02_アーキテクチャ設計書.md §7.2, docs/01_要件定義書.md FR-5.1
 */

/**
 * LODレベル境界(ズーム倍率のしきい値)。
 * L1: zoom < 0.75
 * L2: 0.75 <= zoom < 1.5
 * L3: 1.5 <= zoom < 3.0
 * L4: 3.0 <= zoom
 */
export const LOD_ZOOM_THRESHOLDS = [0.75, 1.5, 3.0] as const;

/**
 * ヒステリシス係数。レベルを下げる(L4→L3等)方向にのみ適用し、
 * 現在レベルの下側しきい値の90%を下回るまでは降格しない。
 * 上げる方向にはヒステリシスを適用しない。
 */
export const LOD_HYSTERESIS_FACTOR = 0.9;

/** C4要素の種別ごとの塗り色(通常/External)。 */
export const C4_COLORS = {
  person: { fill: '#08427B', extFill: '#686868' },
  system: { fill: '#1168BD', extFill: '#999999' },
  container: { fill: '#438DD5', extFill: '#999999' },
  component: { fill: '#85BBF0', extFill: '#999999' },
  class: { fill: '#FFFFFF', stroke: '#333333' },
  boundary: { fill: 'none', text: '#444444' },
  edge: { stroke: '#707070' },
  edgeLabelChip: { text: '#333333' },
} as const;
