import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/model/build';
import type { ParseIssue } from '../../src/parser/types';

/**
 * `expect.objectContaining`/`expect.stringContaining` はvitestの型定義上 `any` を返すため、
 * strictな `@typescript-eslint/no-unsafe-assignment` に引っかかる。型安全な代替として、
 * 該当する issue が存在するかどうかを素朴な述語で確認するヘルパーを使う。
 */
function hasIssue(
  issues: ParseIssue[],
  severity: ParseIssue['severity'],
  messageIncludes: string,
): boolean {
  return issues.some((i) => i.severity === severity && i.message.includes(messageIncludes));
}

describe('buildModel: C4Contextの個数(§4)', () => {
  it('errors when there is no C4Context block', () => {
    const { model, issues } = buildModel('C4Container\n  System_Boundary(x, "X") {\n  }\n');

    expect(model.roots).toEqual([]);
    expect(hasIssue(issues, 'error', 'C4Context')).toBe(true);
  });

  it('uses only the first C4Context block and warns on extras', () => {
    const source = ['C4Context', '  Person(a, "A")', 'C4Context', '  Person(b, "B")'].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.roots.map((n) => n.alias)).toEqual(['a']);
    expect(model.byAlias.has('b')).toBe(false);
    expect(issues.some((i) => i.severity === 'warning' && i.line === 3)).toBe(true);
  });
});

describe('buildModel: alias重複(§4)', () => {
  it('errors on duplicate alias and keeps the first declaration', () => {
    const source = ['C4Context', '  Person(a, "最初")', '  System(a, "2つ目")'].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.roots).toHaveLength(1);
    expect(model.byAlias.get('a')?.label).toBe('最初');
    expect(hasIssue(issues, 'error', '"a"')).toBe(true);
  });

  it('errors on duplicate alias across levels (class name colliding with an existing alias)', () => {
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
      '    Component(accounts, "Accounts")',
      '  }',
      '%% code-of: accounts',
      'classDiagram',
      '  class api',
    ].join('\n');

    const { model, issues } = buildModel(source);

    // "api" は既にContainerのaliasとして使われているため、classとしての再宣言はerror。
    expect(model.byAlias.get('api')?.kind).toBe('container');
    expect(hasIssue(issues, 'error', '"api"')).toBe(true);
  });
});

describe('buildModel: Boundary解決(§4)', () => {
  it('warns and ignores a C4Container block whose System_Boundary alias is unresolved', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      'C4Container',
      '  System_Boundary(unknown, "不明") {',
      '    Container(spa, "SPA")',
      '  }',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.byAlias.has('spa')).toBe(false);
    expect(hasIssue(issues, 'warning', 'unknown')).toBe(true);
  });

  it('warns and ignores a C4Component block whose Container_Boundary alias is unresolved', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      'C4Component',
      '  Container_Boundary(unknown, "不明") {',
      '    Component(signin, "Signin")',
      '  }',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.byAlias.has('signin')).toBe(false);
    const api = model.byAlias.get('api');
    expect(api?.children).toEqual([]);
    expect(hasIssue(issues, 'warning', 'unknown')).toBe(true);
  });

  it('warns and ignores elements written outside a System_Boundary in a C4Container block', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(api, "API")',
      '  }',
      '  Container(orphan, "浮いた要素")',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.byAlias.has('orphan')).toBe(false);
    expect(hasIssue(issues, 'warning', 'orphan')).toBe(true);
  });
});

describe('buildModel: orphan classDiagram(§4)', () => {
  it('warns and ignores a classDiagram block with no %% code-of: directive', () => {
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
      '    Component(accounts, "Accounts")',
      '  }',
      'classDiagram',
      '  class Orphan',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.byAlias.has('Orphan')).toBe(false);
    expect(hasIssue(issues, 'warning', 'code-of')).toBe(true);
  });

  it('warns and ignores a classDiagram block whose %% code-of: alias is unresolved', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '%% code-of: unknown',
      'classDiagram',
      '  class Orphan',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.byAlias.has('Orphan')).toBe(false);
    expect(hasIssue(issues, 'warning', 'unknown')).toBe(true);
  });

  it('warns and ignores a classDiagram block whose %% code-of: alias resolves to a non-component node', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '%% code-of: customer',
      'classDiagram',
      '  class Orphan',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.byAlias.has('Orphan')).toBe(false);
    expect(hasIssue(issues, 'warning', 'customer')).toBe(true);
  });
});

describe('buildModel: Rel解決(§5.2/§4)', () => {
  it('errors on a Rel whose from/to alias is unresolved and drops only that edge', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      '  Rel(customer, ibs, "利用する")',
      '  Rel(customer, unknown, "存在しない先")',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ from: 'customer', to: 'ibs' });
    expect(hasIssue(issues, 'error', 'unknown')).toBe(true);
  });
});

describe('buildModel: 階層構築の正常系(§4)', () => {
  it('links System_Boundary/Container_Boundary and builds a 4-level tree with classDiagram edges', () => {
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
      '    Component(accounts, "Accounts")',
      '  }',
      '%% code-of: accounts',
      'classDiagram',
      '  class AccountService {',
      '    +getAccounts(userId)',
      '  }',
      '  class AccountRepository',
      '  AccountService --> AccountRepository',
    ].join('\n');

    const { model, issues } = buildModel(source);

    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);

    const ibs = model.byAlias.get('ibs');
    expect(ibs?.level).toBe(1);
    const api = ibs?.children.find((n) => n.alias === 'api');
    expect(api?.level).toBe(2);
    const accounts = api?.children.find((n) => n.alias === 'accounts');
    expect(accounts?.level).toBe(3);
    const accountService = accounts?.children.find((n) => n.alias === 'AccountService');
    expect(accountService?.level).toBe(4);
    expect(accountService?.kind).toBe('class');
    expect(accountService?.members).toEqual({ fields: [], methods: ['+getAccounts(userId)'] });

    const classEdge = model.edges.find(
      (e) => e.from === 'AccountService' && e.to === 'AccountRepository',
    );
    expect(classEdge).toMatchObject({ declaredLevel: 4 });
  });

  it('groups Enterprise_Boundary members as children of a boundary root node', () => {
    const source = [
      'C4Context',
      '  Enterprise_Boundary(bank, "銀行") {',
      '    Person(customer, "顧客")',
      '    System(ibs, "IBS")',
      '  }',
      '  System_Ext(email, "メール")',
    ].join('\n');

    const { model } = buildModel(source);

    const boundary = model.roots.find((n) => n.alias === 'bank');
    expect(boundary?.kind).toBe('boundary');
    expect(boundary?.level).toBe(1);
    expect(boundary?.children.map((n) => n.alias).sort()).toEqual(['customer', 'ibs']);

    // 囲まれていない要素は従来通りroots直下。
    expect(model.roots.map((n) => n.alias)).toContain('email');
  });

  it('leaves a Container with no matching C4Component block as a childless leaf', () => {
    const source = [
      'C4Context',
      '  Person(customer, "顧客")',
      '  System(ibs, "IBS")',
      'C4Container',
      '  System_Boundary(ibs, "IBS") {',
      '    Container(spa, "SPA")',
      '  }',
    ].join('\n');

    const { model } = buildModel(source);

    const spa = model.byAlias.get('spa');
    expect(spa?.kind).toBe('container');
    expect(spa?.children).toEqual([]);
  });
});
