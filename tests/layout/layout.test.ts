import type { ElkNode } from 'elkjs/lib/elk-api.js';
import { describe, expect, it } from 'vitest';
import { convertElkResult, layout } from '../../src/layout/layout';
import { buildModel } from '../../src/model/build';
import { project } from '../../src/model/project';
import type { ProjectedEdge } from '../../src/model/project';
import type { C4Node } from '../../src/model/types';
import { internetBankingSample } from '../../src/samples/internet-banking';

function personNode(alias: string, label: string): C4Node {
  return {
    alias,
    label,
    kind: 'person',
    variant: 'default',
    external: false,
    level: 1,
    children: [],
    sourceLine: 1,
  };
}

function systemNode(alias: string, label: string): C4Node {
  return {
    alias,
    label,
    kind: 'system',
    variant: 'default',
    external: false,
    level: 1,
    children: [],
    sourceLine: 1,
  };
}

function containerNode(alias: string, label: string): C4Node {
  return {
    alias,
    label,
    kind: 'container',
    variant: 'default',
    external: false,
    level: 2,
    children: [],
    sourceLine: 1,
  };
}

describe('layout: 祖先オフセットの累積加算(T2-0a知見, convertElkResult)', () => {
  it('adds each ancestor absolute origin to a nested node/edge-point local x/y to produce absolute coordinates', () => {
    const byAlias = new Map<string, C4Node>([
      ['user', personNode('user', 'User')],
      ['sysA', systemNode('sysA', 'SysA')],
      ['contA', containerNode('contA', 'ContA')],
      ['contB', containerNode('contB', 'ContB')],
    ]);
    const edgeMetaById = new Map<string, ProjectedEdge>([
      [
        'edge-root-1',
        { from: 'user', to: 'sysA', bidirectional: false, mergedCount: 1, label: 'uses' },
      ],
      [
        'edge-1',
        { from: 'contA', to: 'contB', bidirectional: false, mergedCount: 1, label: 'calls' },
      ],
    ]);

    // T2-0aスパイクが確認した elkjs の実出力の形を手で再現したもの:
    // sysA の子(contA/contB)の x/y は sysA のローカル座標系(sysAの左上原点からの相対値)。
    // sysA.edges に属する edge-1 の sections も同じくsysAのローカル座標系。
    // root.edges に属する edge-root-1 は root(オフセット0,0)のローカル座標系=実質グローバル。
    const elkResult: ElkNode = {
      id: 'root',
      x: 0,
      y: 0,
      children: [
        { id: 'user', x: 20, y: 5, width: 150, height: 90 },
        {
          id: 'sysA',
          x: 100,
          y: 50,
          width: 300,
          height: 200,
          children: [
            { id: 'contA', x: 10, y: 20, width: 80, height: 40 },
            { id: 'contB', x: 120, y: 20, width: 80, height: 40 },
          ],
          edges: [
            {
              id: 'edge-1',
              sources: ['contA'],
              targets: ['contB'],
              sections: [
                { id: 'edge-1_s0', startPoint: { x: 90, y: 40 }, endPoint: { x: 120, y: 40 } },
              ],
            },
          ],
        },
      ],
      edges: [
        {
          id: 'edge-root-1',
          sources: ['user'],
          targets: ['sysA'],
          sections: [
            { id: 'edge-root-1_s0', startPoint: { x: 95, y: 95 }, endPoint: { x: 105, y: 150 } },
          ],
        },
      ],
    };

    const result = convertElkResult(elkResult, 2, byAlias, edgeMetaById);

    // ノードの絶対座標 = 祖先の絶対原点 + elkjsが返すローカルx/y(手計算した期待値)。
    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        id: 'user',
        x: 20,
        y: 5,
        width: 150,
        height: 90,
        isBoundary: false,
      }),
    );
    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        id: 'sysA',
        x: 100,
        y: 50,
        width: 300,
        height: 200,
        isBoundary: true,
      }),
    );
    // sysAの絶対原点は(100,50)。containerのローカル座標(10,20)/(120,20)を加算した値と一致するはず。
    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        id: 'contA',
        x: 110,
        y: 70,
        width: 80,
        height: 40,
        isBoundary: false,
        parentId: 'sysA',
      }),
    );
    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        id: 'contB',
        x: 220,
        y: 70,
        width: 80,
        height: 40,
        parentId: 'sysA',
      }),
    );

    // エッジ: sysAの `edges` に属する edge-1 はsysAの絶対原点(100,50)を加算した座標になる。
    const innerEdge = result.edges.find((e) => e.from === 'contA' && e.to === 'contB');
    expect(innerEdge?.points).toEqual([
      { x: 190, y: 90 },
      { x: 220, y: 90 },
    ]);
    // ルート直下(root.edges)の edge-root-1 はオフセット(0,0)のまま(実質グローバル、T2-0a知見)。
    const outerEdge = result.edges.find((e) => e.from === 'user' && e.to === 'sysA');
    expect(outerEdge?.points).toEqual([
      { x: 95, y: 95 },
      { x: 105, y: 150 },
    ]);
  });
});

describe('layout: 実際のelkjsレイアウトでも境界(展開枠)ノードが子を包含する', () => {
  it('keeps every visible container fully inside its expanded System boundary box', async () => {
    const source = [
      'C4Context',
      '  Person(user, "利用者")',
      '  System(sysA, "システムA")',
      'C4Container',
      '  System_Boundary(sysA, "システムA") {',
      '    Container(contA, "コンテナA")',
      '    Container(contB, "コンテナB")',
      '  }',
      '  Rel(user, contA, "利用する")',
      '  Rel(contA, contB, "呼び出す")',
    ].join('\n');
    const { model, issues } = buildModel(source);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);

    const result = await layout(model, project(model, 2));

    const sysA = result.nodes.find((n) => n.id === 'sysA');
    const contA = result.nodes.find((n) => n.id === 'contA');
    const contB = result.nodes.find((n) => n.id === 'contB');
    expect(sysA?.isBoundary).toBe(true);
    expect(contA?.isBoundary).toBe(false);
    expect(contB?.isBoundary).toBe(false);

    for (const child of [contA, contB]) {
      expect(child).toBeDefined();
      if (child === undefined || sysA === undefined) continue;
      // 子の絶対座標は親(sysA)の絶対範囲に完全に収まっているはず。祖先オフセットの累積が
      // 行われず「elkjsが返す子のローカル座標」をそのまま絶対座標として扱ってしまうバグ
      // (T2-0aが注意喚起した誤り)があれば、sysAの配置場所によらずこの包含関係は一般に崩れる。
      expect(child.x).toBeGreaterThanOrEqual(sysA.x);
      expect(child.y).toBeGreaterThanOrEqual(sysA.y);
      expect(child.x + child.width).toBeLessThanOrEqual(sysA.x + sysA.width);
      expect(child.y + child.height).toBeLessThanOrEqual(sysA.y + sysA.height);
    }
  });
});

describe('layout: internetBankingサンプルのL2可視ノード集合(設計書§6手順1)', () => {
  it('renders ibs as an expanded boundary containing spa/api/db, and everything else as leaf boxes', async () => {
    const { model } = buildModel(internetBankingSample);
    const result = await layout(model, project(model, 2));
    const byId = new Map(result.nodes.map((n) => [n.id, n]));

    expect(byId.get('ibs')?.isBoundary).toBe(true);
    for (const containerId of ['spa', 'api', 'db']) {
      expect(byId.get(containerId)?.isBoundary).toBe(false);
      expect(byId.get(containerId)?.parentId).toBe('ibs');
    }
    for (const leafId of ['customer', 'backoffice', 'email', 'creditBureau']) {
      expect(byId.get(leafId)?.isBoundary).toBe(false);
      expect(byId.get(leafId)?.parentId).toBeUndefined();
    }
    // Component(signin等)はlevel=3のためL2では不可視(§6手順1: 深さ<=表示レベルのみ可視)。
    expect(byId.has('signin')).toBe(false);
    expect(byId.has('accounts')).toBe(false);

    // 可視ノードは全て正の寸法を持つ(§7.1: 葉ノードはテキスト見積り、境界はelkjsが子から算出)。
    for (const node of result.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
    // エッジは1本以上あり、各エッジは経路点(始点・終点以上)を持つ。
    expect(result.edges.length).toBeGreaterThan(0);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });
});
