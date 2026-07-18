import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/model/build';
import { internetBankingSample } from '../../src/samples/internet-banking';
import type { C4Node } from '../../src/model/types';

/**
 * C4Node.parent は循環参照になり、C4Model.byAlias は Map なので、そのままでは
 * `toMatchSnapshot()` に渡せない(JSON化できない/Mapが読みにくい)。スナップショット用に、
 * parent を除いたツリー(roots)と、byAlias のキー一覧(alias→levelの一覧)に変換する。
 * ツリー自体は roots から children を辿れば全ノードに到達できるため、情報は失われない。
 */
function stripParent(node: C4Node): unknown {
  // parent は循環参照になるためJSON化できない。含めたいフィールドだけを列挙して組み立てる
  // (destructuringで parent を捨てると未使用変数扱いでlintに引っかかるため、この形にする)。
  const {
    alias,
    label,
    kind,
    variant,
    external,
    technology,
    description,
    level,
    sourceLine,
    members,
    children,
  } = node;
  return {
    alias,
    label,
    kind,
    variant,
    external,
    technology,
    description,
    level,
    sourceLine,
    members,
    children: children.map(stripParent),
  };
}

function toSnapshotShape(model: ReturnType<typeof buildModel>['model']) {
  return {
    roots: model.roots.map(stripParent),
    edges: model.edges,
    byAliasLevels: Array.from(model.byAlias.entries())
      .map(([alias, node]) => ({ alias, kind: node.kind, level: node.level }))
      .sort((a, b) => a.alias.localeCompare(b.alias)),
  };
}

describe('buildModel: internet-banking サンプルのスナップショット', () => {
  it('produces zero errors and a stable C4Model shape', () => {
    const { model, issues } = buildModel(internetBankingSample);

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);

    expect(toSnapshotShape(model)).toMatchSnapshot();
  });

  it('includes all 4 levels (Person/System, Container, Component, Class)', () => {
    const { model } = buildModel(internetBankingSample);
    const levels = new Set(Array.from(model.byAlias.values()).map((n) => n.level));

    expect(levels).toEqual(new Set([1, 2, 3, 4]));
  });

  it('meets the required element counts (§04実装指示書 T1-3)', () => {
    const { model } = buildModel(internetBankingSample);
    const nodes = Array.from(model.byAlias.values());

    const systems = nodes.filter((n) => n.kind === 'system' && !n.external);
    const externalSystems = nodes.filter((n) => n.kind === 'system' && n.external);
    const containers = nodes.filter((n) => n.kind === 'container');
    const components = nodes.filter((n) => n.kind === 'component');
    const classDiagramClassCount = nodes.filter((n) => n.kind === 'class').length;

    expect(systems).toHaveLength(2);
    expect(externalSystems).toHaveLength(2);
    expect(containers).toHaveLength(3);
    expect(components).toHaveLength(4);
    // 2つのclassDiagramブロック(AccountService/AccountRepository, TransferService/TransferValidator)
    expect(classDiagramClassCount).toBe(4);

    // L3(Component)が未定義のContainerを1つ以上含む(FR-5.7確認用データ)。
    const containersWithoutComponents = containers.filter((c) => c.children.length === 0);
    expect(containersWithoutComponents.length).toBeGreaterThanOrEqual(1);
  });
});
