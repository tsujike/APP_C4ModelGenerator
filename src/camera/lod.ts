/**
 * レベル判定(設計書 docs/02_アーキテクチャ設計書.md §8.2)。
 *
 * AUTOモードにおける「連続ズーム値 s → 描画レベル」の非対称ヒステリシス判定を行う純関数。
 * DOM/Excalidrawには一切依存しない(実装指示書§4: parser/model/layout同様、camera/lodも
 * テスト可能な純関数として保つ)。手動固定モード(levelLock)は本モジュールの関知するところ
 * ではない — 呼び出し側(T3-2)が「固定中はnextLevelを呼ばない」という形でバイパスする。
 *
 * 非対称ヒステリシス(§8.2、FR-5.2の「±10%」はこの意味に読み替える):
 * - 上昇方向(ズームイン): s が上側閾値(LOD_ZOOM_THRESHOLDS[level-1])に達したら即遷移。
 *   ヒステリシスなし。
 * - 下降方向(ズームアウト): 「現在レベルの下側(進入)閾値 × LOD_HYSTERESIS_FACTOR」を
 *   下回ったときのみ遷移する。現在レベルの下側閾値とは、そのレベルへ進入する際に上昇方向で
 *   跨いだ閾値(例: L3の下側閾値はL2→L3の閾値=1.5)。
 *   例: L3滞在中、s=1.4は維持(1.4 >= 1.5*0.9=1.35)。s<1.35でL2へ降格。
 */

import { LOD_HYSTERESIS_FACTOR, LOD_ZOOM_THRESHOLDS } from '../constants';
import type { Level } from '../model/types';

/**
 * 現在レベルと現在の正規化ズーム値 s から、次に適用すべきレベルを1ステップで決定する。
 *
 * s が1回の呼び出しで大きく変化した場合(例: プログラム的なジャンプや、テスト上の極端な
 * 入力)は、複数レベルをまたいで連鎖的に遷移させる(例: current=L1, s=5.0 → L4を返す。
 * L2止まりにはしない)。§8.2はこのケースを明示していないが、「sに対して一意に定まるべき
 * レベル」という閾値表(FR-5.1)の意味論と矛盾しない最単純な解釈として、上昇側・下降側それぞれの
 * 閾値判定を該当方向へ連鎖的に(閾値を1段ずつ跨ぎながら)適用する。s は単一の値なので、
 * 上昇側ループと下降側ループは互いに排他的にしか作用しない(閾値が単調増加かつヒステリシス
 * 係数<1のため、両方が同時に条件を満たすことはない)。
 */
export function nextLevel(current: Level, s: number): Level {
  let level = current;

  // 上昇方向: 上側閾値に達したら即遷移(ヒステリシスなし)。複数閾値を跨ぐ場合は連鎖する。
  // 添字 level-1 は while条件の level<4(=level は 1..3)によりつねに 0..2 の範囲に収まり、
  // LOD_ZOOM_THRESHOLDS(3要素)の範囲内であることが構造的に保証されるため `!` で安全に参照する
  // (tsconfigのnoUncheckedIndexedAccess対応。src/parser/parseC4Block.tsの既存箇所と同じ考え方)。
  while (level < 4 && s >= LOD_ZOOM_THRESHOLDS[level - 1]!) {
    level = (level + 1) as Level;
  }

  // 下降方向: 現在レベルの下側(進入)閾値×ヒステリシス係数を下回ったら遷移。連鎖する。
  // 添字 level-2 は while条件の level>1(=level は 2..4)によりつねに 0..2 の範囲に収まる。
  while (level > 1 && s < LOD_ZOOM_THRESHOLDS[level - 2]! * LOD_HYSTERESIS_FACTOR) {
    level = (level - 1) as Level;
  }

  return level;
}
