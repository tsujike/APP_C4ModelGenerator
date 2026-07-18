import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/model/build';
import { project } from '../../src/model/project';
import type { Level } from '../../src/model/types';

/** ソースをbuildModelしてからprojectする、このテストファイル共通のヘルパー。 */
function projectSource(source: string, level: Level) {
  const { model, issues } = buildModel(source);
  const errors = issues.filter((i) => i.severity === 'error');
  expect(errors).toEqual([]);
  return project(model, level);
}

describe('project: 基本的な射影(§6-2)', () => {
  it('rolls an L3 edge between two Components up to an L2 edge between their parent Containers', () => {
    const source = [
      'C4Context',
      '  System(sysA, "システムA")',
      '  System(sysB, "システムB")',
      'C4Container',
      '  System_Boundary(sysA, "システムA") {',
      '    Container(contA, "コンテナA")',
      '  }',
      '  System_Boundary(sysB, "システムB") {',
      '    Container(contB, "コンテナB")',
      '  }',
      'C4Component',
      '  Container_Boundary(contA, "コンテナA") {',
      '    Component(compA, "コンポーネントA")',
      '  }',
      '  Container_Boundary(contB, "コンテナB") {',
      '    Component(compB, "コンポーネントB")',
      '  }',
      '  Rel(compA, compB, "呼び出す", "gRPC")',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.level).toBe(2);
    expect(graph.edges).toEqual([
      {
        from: 'contA',
        to: 'contB',
        label: '呼び出す',
        technology: 'gRPC',
        bidirectional: false,
        mergedCount: 1,
      },
    ]);
  });

  it('leaves an edge unprojected when both endpoints are already at or above the target level', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      '  Rel(customer, ibs, "利用する", "HTTPS")',
    ].join('\n');

    const graph = projectSource(source, 4);

    expect(graph.edges).toEqual([
      {
        from: 'customer',
        to: 'ibs',
        label: '利用する',
        technology: 'HTTPS',
        bidirectional: false,
        mergedCount: 1,
      },
    ]);
  });

  it('projects a node deeper than the target level to its ancestor at the target level even when the other endpoint is shallower', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(signin, "サインイン")',
      '  }',
      '  Rel(customer, signin, "サインインする")',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.edges).toEqual([
      {
        from: 'customer',
        to: 'api',
        label: 'サインインする',
        bidirectional: false,
        mergedCount: 1,
      },
    ]);
  });
});

describe('project: 自己ループの除去(§6-3)', () => {
  it('drops an edge whose projected from/to collapse onto the same container', () => {
    const source = [
      'C4Context',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(a, "コンポーネントA")',
      '    Component(b, "コンポーネントB")',
      '  }',
      '  Rel(a, b, "内部呼び出し")',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.edges).toEqual([]);
  });

  it('keeps the edge when projecting at a level fine-grained enough to distinguish both endpoints', () => {
    const source = [
      'C4Context',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(a, "コンポーネントA")',
      '    Component(b, "コンポーネントB")',
      '  }',
      '  Rel(a, b, "内部呼び出し")',
    ].join('\n');

    const graph = projectSource(source, 3);

    expect(graph.edges).toEqual([
      { from: 'a', to: 'b', label: '内部呼び出し', bidirectional: false, mergedCount: 1 },
    ]);
  });
});

describe('project: 集約とラベル選択・(+k)表記(§6-4)', () => {
  it('merges multiple raw edges projecting onto the same (from,to) pair and appends " (+k)" to the representative label', () => {
    const source = [
      'C4Context',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '    ContainerDb(db, "DB")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(x, "X")',
      '    Component(y, "Y")',
      '  }',
      '  Rel(x, db, "読み書き1")',
      '  Rel(y, db, "読み書き2")',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.edges).toEqual([
      {
        from: 'api',
        to: 'db',
        label: '読み書き1 (+1)',
        bidirectional: false,
        mergedCount: 2,
      },
    ]);
  });

  it('picks the edge whose declaredLevel is closest to the target level as the representative', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      '  Rel(customer, api, "declaredLevel=1")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      '  Rel(customer, api, "declaredLevel=2")',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(signin, "サインイン")',
      '  }',
      '  Rel(customer, api, "declaredLevel=3")',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.edges).toEqual([
      {
        from: 'customer',
        to: 'api',
        label: 'declaredLevel=2 (+2)',
        bidirectional: false,
        mergedCount: 3,
      },
    ]);
  });

  it('breaks a tie in |declaredLevel-level| by preferring the shallower (smaller) declaredLevel', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      '  Rel(customer, api, "declaredLevel=1")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(signin, "サインイン")',
      '  }',
      '  Rel(customer, api, "declaredLevel=3")',
    ].join('\n');

    // level=2: declaredLevel=1 (diff=1) と declaredLevel=3 (diff=1) が同値のため、
    // 浅い方(declaredLevel=1)が代表ラベルに選ばれる。
    const graph = projectSource(source, 2);

    expect(graph.edges).toEqual([
      {
        from: 'customer',
        to: 'api',
        label: 'declaredLevel=1 (+1)',
        bidirectional: false,
        mergedCount: 2,
      },
    ]);
  });

  it('appends "(+k)" alone (no leading label) when the representative edge has no label', () => {
    const source = [
      'C4Context',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '    ContainerDb(db, "DB")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(x, "X")',
      '    Component(y, "Y")',
      '  }',
      // classDiagram の矢印はlabel省略可(§5.3)なので、component間のRelでもlabel無しを再現する。
      '  Rel(x, db)',
      '  Rel(y, db)',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.edges).toEqual([
      { from: 'api', to: 'db', label: '(+1)', bidirectional: false, mergedCount: 2 },
    ]);
  });

  it('does not merge edges that project onto the same (from,to) but differ in bidirectional', () => {
    const source = [
      'C4Context',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '    ContainerDb(db, "DB")',
      '  }',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(x, "X")',
      '    Component(y, "Y")',
      '  }',
      '  Rel(x, db, "片方向")',
      '  BiRel(y, db, "双方向")',
    ].join('\n');

    const graph = projectSource(source, 2);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges).toContainEqual({
      from: 'api',
      to: 'db',
      label: '片方向',
      bidirectional: false,
      mergedCount: 1,
    });
    expect(graph.edges).toContainEqual({
      from: 'api',
      to: 'db',
      label: '双方向',
      bidirectional: true,
      mergedCount: 1,
    });
  });

  it('preserves the technology of the representative edge', () => {
    const source = [
      'C4Context',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '    ContainerDb(db, "DB")',
      '  }',
      '  Rel(api, db, "読み書き", "JDBC")',
      'C4Component',
      '  Container_Boundary(api, "API") {',
      '    Component(x, "X")',
      '  }',
      '  Rel(x, db, "読み書き2", "SQL")',
    ].join('\n');

    const graph = projectSource(source, 2);

    // 両方とも api->db に射影される。declaredLevel=2(diff0)の方が代表になるため、
    // technologyも declaredLevel=2 側("JDBC")が採用される。
    expect(graph.edges).toEqual([
      {
        from: 'api',
        to: 'db',
        label: '読み書き (+1)',
        technology: 'JDBC',
        bidirectional: false,
        mergedCount: 2,
      },
    ]);
  });
});

describe('project: 射影先の祖先が無いケース(§6, edge-case)', () => {
  it('drops an edge whose endpoint alias resolves to a boundary node with no non-boundary ancestor', () => {
    const source = [
      'C4Context',
      '  Enterprise_Boundary(bank, "銀行") {',
      '    Person(customer, "顧客")',
      '    System(ibs, "IBS")',
      '  }',
      '  System_Ext(email, "メール")',
      '  Rel(bank, email, "boundary自体を指すRel(想定外入力)")',
      '  Rel(customer, ibs, "通常の関係")',
    ].join('\n');

    for (const level of [1, 2, 3, 4] as const) {
      const graph = projectSource(source, level);
      // bank(boundary)を端点とするエッジは、boundaryが祖先探索で読み飛ばされ、
      // かつboundary自身がrootで親を持たないため射影先が無く、描画対象から除外される。
      expect(graph.edges.some((e) => e.from === 'bank' || e.to === 'bank')).toBe(false);
      // 通常の(boundaryを介さない)エッジは通常どおり射影される。
      expect(graph.edges).toContainEqual({
        from: 'customer',
        to: 'ibs',
        label: '通常の関係',
        bidirectional: false,
        mergedCount: 1,
      });
    }
  });

  it('is unaffected by an Enterprise_Boundary when projecting edges between its (level-1) members and the outside', () => {
    const source = [
      'C4Context',
      '  Enterprise_Boundary(bank, "銀行") {',
      '    Person(customer, "顧客")',
      '    System(ibs, "IBS")',
      '  }',
      '  System_Ext(email, "メール")',
      '  Rel(customer, ibs, "利用する")',
      '  Rel(ibs, email, "通知")',
    ].join('\n');

    const graph = projectSource(source, 1);

    expect(graph.edges).toEqual([
      { from: 'customer', to: 'ibs', label: '利用する', bidirectional: false, mergedCount: 1 },
      { from: 'ibs', to: 'email', label: '通知', bidirectional: false, mergedCount: 1 },
    ]);
  });
});
