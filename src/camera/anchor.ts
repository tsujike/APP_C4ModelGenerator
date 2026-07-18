/**
 * レベル切替時のアンカー保存の座標計算(設計書 docs/02_アーキテクチャ設計書.md §8.3、FR-5.4)。
 *
 * DOM/Excalidrawには一切依存しない純関数群(実装指示書§4: camera/lodと同じ方針)。
 * §8.3手順1〜3のうち、「どのノードがアンカーか」「新レベルでの対応ノードは何か」
 * 「その結果scrollX/scrollYはいくつになるか」という**計算**だけをここに置く。
 * 実際にExcalidrawへ適用する(手順3後半の updateScene 呼び出し)のは
 * `camera/levelController.ts`(host経由)の責務。
 */

import type { LayoutNode, LayoutResult } from '../layout/types';
import type { C4Node } from '../model/types';

export interface WorldPoint {
  x: number;
  y: number;
}

/**
 * ワールド座標 `p` の直下にある最前面のノードを、旧レベルの LayoutResult.nodes から求める
 * (§8.3手順1)。「最前面」の定義: 境界(展開枠)ノードは常にその子ノードを内包する
 * (bboxが子を包含する)ため、`p` を含むノードのうち**面積が最小**のものを選べば、
 * 常に最も内側(=画面上手前)のノードが選ばれる(elements描画順に依存しない幾何学的な定義)。
 *
 * `p` を含むノードが1つも無ければ、矩形境界までのユークリッド距離が最小のノードを返す
 * (§8.3手順1「無ければ最近傍ノード」)。`nodes` が空なら undefined。
 */
export function findAnchorNode(
  nodes: readonly LayoutNode[],
  p: WorldPoint,
): LayoutNode | undefined {
  let containing: LayoutNode | undefined;
  let containingArea = Infinity;
  for (const n of nodes) {
    if (p.x >= n.x && p.x <= n.x + n.width && p.y >= n.y && p.y <= n.y + n.height) {
      const area = n.width * n.height;
      if (area < containingArea) {
        containingArea = area;
        containing = n;
      }
    }
  }
  if (containing !== undefined) return containing;

  let nearest: LayoutNode | undefined;
  let nearestDist = Infinity;
  for (const n of nodes) {
    const dist = distanceToRect(p, n);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = n;
    }
  }
  return nearest;
}

function distanceToRect(p: WorldPoint, n: LayoutNode): number {
  const dx = p.x < n.x ? n.x - p.x : p.x > n.x + n.width ? p.x - (n.x + n.width) : 0;
  const dy = p.y < n.y ? n.y - p.y : p.y > n.y + n.height ? p.y - (n.y + n.height) : 0;
  return Math.hypot(dx, dy);
}

/**
 * 旧レベルのアンカーノード(alias=`anchorAlias`)に対応する新レベルのノードを求める(§8.3手順2)。
 *
 * - `anchorAlias` が新レベルの LayoutResult.nodes に(同じidで)存在すれば、そのノードを返す。
 *   これは「aが新レベルでも存在する」「aが新レベルで展開され境界枠になる」の両方をカバーする
 *   (isBoundaryの真偽が変わるだけで、id=aliasは常に同じであるため。§7.2の決定的id命名)。
 * - 存在しなければ、C4Modelの親チェーンを根方向に辿り、新レベルに存在する最初の祖先を返す
 *   (「aが折りたたまれる場合、a'はaの可視祖先」)。
 * - 祖先チェーンを辿り切っても見つからなければ undefined(構造的にはroot(level=1)は常にどの
 *   表示レベルでも可視なので通常発生しないが、呼び出し側は undefined を「アンカー補正なし」
 *   として扱う)。
 */
export function findCounterpartNode(
  anchorAlias: string,
  newNodes: readonly LayoutNode[],
  byAlias: ReadonlyMap<string, C4Node>,
): LayoutNode | undefined {
  const newById = new Map(newNodes.map((n) => [n.id, n] as const));
  let alias: string | undefined = anchorAlias;
  while (alias !== undefined) {
    const found = newById.get(alias);
    if (found !== undefined) return found;
    alias = byAlias.get(alias)?.parent?.alias;
  }
  return undefined;
}

/** ノードの中心座標(ワールド座標)。 */
export function nodeCenter(n: LayoutNode): WorldPoint {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

/**
 * 「a'の中心が画面座標pに来て、かつ現在のzoomを維持する」scrollX/scrollYを求める(§8.3手順3)。
 *
 * Excalidrawの座標規約 `screen = (world + scroll) × zoom` より、切替前後でzoomが同じ(補正しない)
 * 前提のとき、切替前後で同じ画面位置pを保つ条件は
 * `oldAnchorCenter + oldScroll === newAnchorCenter + newScroll` (zoomは両辺で相殺されるため式に
 * 現れない)。よって `newScroll = oldScroll + (oldAnchorCenter - newAnchorCenter)`。
 */
export function computeScrollCorrection(
  oldScroll: WorldPoint,
  oldAnchorCenter: WorldPoint,
  newAnchorCenter: WorldPoint,
): WorldPoint {
  return {
    x: oldScroll.x + (oldAnchorCenter.x - newAnchorCenter.x),
    y: oldScroll.y + (oldAnchorCenter.y - newAnchorCenter.y),
  };
}

/**
 * §8.3手順1〜3を一括で行うヘルパー: 旧レベルのLayoutResultとアンカーのワールド座標`anchorPoint`、
 * 現在のscroll、新レベルのLayoutResultとC4Modelから、新レベル用のscrollX/scrollYを求める。
 * アンカーノードが特定できない(旧レベルに可視ノードが1つも無い)、または新レベルに対応する
 * ノードが見つからない場合は undefined を返す(呼び出し側は要素だけ差し替え、scrollは現状維持)。
 */
export function computeAnchorPreservingScroll(
  oldLayout: LayoutResult,
  anchorPoint: WorldPoint,
  oldScroll: WorldPoint,
  newLayout: LayoutResult,
  byAlias: ReadonlyMap<string, C4Node>,
): WorldPoint | undefined {
  const anchorNode = findAnchorNode(oldLayout.nodes, anchorPoint);
  if (anchorNode === undefined) return undefined;
  const counterpart = findCounterpartNode(anchorNode.id, newLayout.nodes, byAlias);
  if (counterpart === undefined) return undefined;
  return computeScrollCorrection(oldScroll, nodeCenter(anchorNode), nodeCenter(counterpart));
}
