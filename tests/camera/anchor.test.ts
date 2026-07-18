import { describe, expect, it } from 'vitest';
import {
  computeAnchorPreservingScroll,
  computeScrollCorrection,
  findAnchorNode,
  findCounterpartNode,
  nodeCenter,
} from '../../src/camera/anchor';
import type { LayoutNode, LayoutResult } from '../../src/layout/types';
import type { C4Node } from '../../src/model/types';

function node(id: string, x: number, y: number, width: number, height: number): LayoutNode {
  return {
    id,
    kind: 'container',
    variant: 'default',
    external: false,
    label: id,
    x,
    y,
    width,
    height,
    isBoundary: false,
  };
}

function modelNode(alias: string, parent?: C4Node): C4Node {
  return {
    alias,
    label: alias,
    kind: 'container',
    variant: 'default',
    external: false,
    level: 2,
    children: [],
    sourceLine: 1,
    ...(parent !== undefined ? { parent } : {}),
  };
}

describe('findAnchorNode(§8.3手順1)', () => {
  it('点を含むノードのうち面積最小(=最も内側)のものを選ぶ', () => {
    // ibsサンプルを模した2階層: 境界ibs(0,0,300,300)がapi(50,50,100,100)を内包する。
    const boundary = node('ibs', 0, 0, 300, 300);
    const api = node('api', 50, 50, 100, 100);
    const nodes = [boundary, api];

    expect(findAnchorNode(nodes, { x: 100, y: 100 })).toBe(api);
    // 境界内だがapiの外側の点はibs自身が選ばれる。
    expect(findAnchorNode(nodes, { x: 10, y: 10 })).toBe(boundary);
  });

  it('どのノードも点を含まない場合は矩形境界までの距離が最小のノードを返す(最近傍フォールバック)', () => {
    const near = node('near', 0, 0, 10, 10);
    const far = node('far', 1000, 1000, 10, 10);
    const nodes = [far, near];

    // (20,20) はどちらも含まないが、near(右下角(10,10))までの距離の方が近い。
    expect(findAnchorNode(nodes, { x: 20, y: 20 })).toBe(near);
  });

  it('ノードが1つも無ければundefined', () => {
    expect(findAnchorNode([], { x: 0, y: 0 })).toBeUndefined();
  });
});

describe('findCounterpartNode(§8.3手順2)', () => {
  const ibs = modelNode('ibs');
  const api = modelNode('api', ibs);
  const signin = modelNode('signin', api);
  const byAlias = new Map<string, C4Node>([
    ['ibs', ibs],
    ['api', api],
    ['signin', signin],
  ]);

  it('同じaliasのノードが新レベルにも存在すれば、そのノードを直接返す(存在継続/境界展開の両方をカバー)', () => {
    const newNodes = [node('api', 0, 0, 400, 400)]; // L3でapiが境界枠に展開された想定
    expect(findCounterpartNode('api', newNodes, byAlias)).toBe(newNodes[0]);
  });

  it('自身が新レベルに存在しなければ、親を辿って最初に見つかった祖先を返す(折りたたみ)', () => {
    const newNodes = [node('api', 0, 0, 100, 100)]; // L2ではsigninは存在せず、親apiのみ
    expect(findCounterpartNode('signin', newNodes, byAlias)).toBe(newNodes[0]);
  });

  it('複数階層(祖父母)まで遡って見つける', () => {
    const newNodes = [node('ibs', 0, 0, 500, 500)]; // L1ではibsのみ
    expect(findCounterpartNode('signin', newNodes, byAlias)).toBe(newNodes[0]);
  });

  it('祖先チェーンを辿り切っても見つからなければundefined', () => {
    const orphan = modelNode('orphan');
    const byAliasOrphan = new Map<string, C4Node>([['orphan', orphan]]);
    expect(findCounterpartNode('orphan', [], byAliasOrphan)).toBeUndefined();
  });
});

describe('computeScrollCorrection(§8.3手順3)', () => {
  it('newScroll = oldScroll + (oldAnchorCenter - newAnchorCenter)', () => {
    const result = computeScrollCorrection({ x: 10, y: 20 }, { x: 100, y: 100 }, { x: 50, y: 50 });
    expect(result).toEqual({ x: 60, y: 70 });
  });

  it('新旧のアンカー中心が同じならscrollは変化しない', () => {
    const result = computeScrollCorrection({ x: -5, y: 8 }, { x: 30, y: 30 }, { x: 30, y: 30 });
    expect(result).toEqual({ x: -5, y: 8 });
  });
});

describe('nodeCenter', () => {
  it('x+width/2, y+height/2 を返す', () => {
    expect(nodeCenter(node('n', 10, 20, 40, 60))).toEqual({ x: 30, y: 50 });
  });
});

describe('computeAnchorPreservingScroll(§8.3手順1〜3の統合)', () => {
  const ibs = modelNode('ibs');
  const api = modelNode('api', ibs);
  const byAlias = new Map<string, C4Node>([
    ['ibs', ibs],
    ['api', api],
  ]);

  function toLayout(nodes: LayoutNode[]): LayoutResult {
    return { level: 2, nodes, edges: [], width: 1000, height: 1000 };
  }

  it('アンカーノードと対応先が見つかれば、中心を保つscrollを返す', () => {
    const oldLayout = toLayout([node('api', 0, 0, 100, 100)]); // 中心(50,50)
    const newLayout = toLayout([node('api', 200, 200, 300, 300)]); // 中心(350,350)、L3で展開

    const result = computeAnchorPreservingScroll(
      oldLayout,
      { x: 50, y: 50 }, // apiの中心を直接指すアンカー点
      { x: 0, y: 0 },
      newLayout,
      byAlias,
    );

    expect(result).toEqual({ x: 0 + (50 - 350), y: 0 + (50 - 350) });
  });

  it('旧レベルに可視ノードが無ければundefined(呼び出し側はscroll補正なしで要素だけ差し替える)', () => {
    const oldLayout = toLayout([]);
    const newLayout = toLayout([node('api', 0, 0, 100, 100)]);

    expect(
      computeAnchorPreservingScroll(oldLayout, { x: 0, y: 0 }, { x: 0, y: 0 }, newLayout, byAlias),
    ).toBeUndefined();
  });
});
