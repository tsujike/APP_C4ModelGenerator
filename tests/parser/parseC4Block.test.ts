import { describe, expect, it } from 'vitest';
import { parseC4Block } from '../../src/parser/parseC4Block';
import { splitBlocks } from '../../src/parser/splitBlocks';
import type {
  BoundaryStatement,
  C4BlockKind,
  ElementStatement,
  RelStatement,
  SourceBlock,
} from '../../src/parser/types';

/** テスト用ヘルパー: C4系ブロックのソース断片1個をASTにする。 */
function parseSingleBlock(source: string) {
  const blocks = splitBlocks(source);
  expect(blocks).toHaveLength(1);
  const block = blocks[0] as SourceBlock & { kind: C4BlockKind };
  return parseC4Block(block);
}

describe('parseC4Block: 正常系(要素文)', () => {
  it('parses Person/Person_Ext with optional description', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Context',
        'Person(customer, "銀行顧客", "口座を持つ個人")',
        'Person_Ext(auditor, "監査人")',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    expect(ast.statements).toHaveLength(2);

    const [customer, auditor] = ast.statements as [ElementStatement, ElementStatement];
    expect(customer).toMatchObject({
      type: 'element',
      kind: 'person',
      variant: 'default',
      external: false,
      alias: 'customer',
      label: '銀行顧客',
      description: '口座を持つ個人',
    });
    expect(auditor).toMatchObject({
      type: 'element',
      kind: 'person',
      external: true,
      alias: 'auditor',
      label: '監査人',
    });
    expect(auditor.description).toBeUndefined();
  });

  it('parses System/System_Ext/SystemDb/SystemQueue_Ext variants', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Context',
        'System(ibs, "インターネットバンキング", "照会と振込を提供")',
        'System_Ext(email, "メールシステム")',
        'SystemDb(ledger, "台帳")',
        'SystemQueue_Ext(bus, "外部キュー")',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    const [ibs, email, ledger, bus] = ast.statements as ElementStatement[];
    expect(ibs).toMatchObject({ kind: 'system', variant: 'default', external: false });
    expect(email).toMatchObject({ kind: 'system', variant: 'default', external: true });
    expect(ledger).toMatchObject({ kind: 'system', variant: 'db', external: false });
    expect(bus).toMatchObject({ kind: 'system', variant: 'queue', external: true });
  });

  it('parses Container/Component with tech and description positions', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Container',
        'Container(spa, "SPA", "TypeScript", "ブラウザUI")',
        'ContainerDb(db, "DB", "PostgreSQL")',
        'Container_Ext(legacy, "レガシー")',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    const [spa, db, legacy] = ast.statements as [
      ElementStatement,
      ElementStatement,
      ElementStatement,
    ];
    expect(spa).toMatchObject({
      kind: 'container',
      alias: 'spa',
      label: 'SPA',
      technology: 'TypeScript',
      description: 'ブラウザUI',
    });
    expect(db).toMatchObject({ kind: 'container', variant: 'db', technology: 'PostgreSQL' });
    expect(db.description).toBeUndefined();
    expect(legacy).toMatchObject({ kind: 'container', external: true });
    expect(legacy.technology).toBeUndefined();
  });

  it('parses ComponentDb/ComponentQueue', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Component',
        'ComponentDb(cache, "キャッシュ", "Redis")',
        'ComponentQueue(mq, "キュー", "SQS")',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    const [cache, mq] = ast.statements as ElementStatement[];
    expect(cache).toMatchObject({ kind: 'component', variant: 'db', technology: 'Redis' });
    expect(mq).toMatchObject({ kind: 'component', variant: 'queue', technology: 'SQS' });
  });
});

describe('parseC4Block: 引数解析', () => {
  it('does not split on commas inside quoted arguments', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Person(customer, "顧客, VIP", "説明, 補足")'].join('\n'),
    );

    expect(issues).toEqual([]);
    const [customer] = ast.statements as [ElementStatement];
    expect(customer.label).toBe('顧客, VIP');
    expect(customer.description).toBe('説明, 補足');
  });

  it('ignores $tag=... named arguments without a warning', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Person(customer, "顧客", $tags="v1,v2")'].join('\n'),
    );

    expect(issues).toEqual([]);
    const [customer] = ast.statements as [ElementStatement];
    expect(customer.alias).toBe('customer');
    expect(customer.label).toBe('顧客');
    expect(customer.description).toBeUndefined();
  });

  it('accepts bare identifiers as arguments (not only quoted strings)', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Rel(customer, ibs, label_without_quotes)'].join('\n'),
    );

    expect(issues).toEqual([]);
    const [rel] = ast.statements as [RelStatement];
    expect(rel).toMatchObject({ from: 'customer', to: 'ibs', label: 'label_without_quotes' });
  });
});

describe('parseC4Block: Rel系', () => {
  it('parses Rel with label and technology', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Rel(customer, ibs, "利用する", "HTTPS")'].join('\n'),
    );

    expect(issues).toEqual([]);
    const [rel] = ast.statements as [RelStatement];
    expect(rel).toMatchObject({
      type: 'rel',
      from: 'customer',
      to: 'ibs',
      label: '利用する',
      technology: 'HTTPS',
      bidirectional: false,
    });
  });

  it('marks BiRel as bidirectional', () => {
    const { ast, issues } = parseSingleBlock(['C4Context', 'BiRel(a, b, "sync")'].join('\n'));

    expect(issues).toEqual([]);
    const [rel] = ast.statements as [RelStatement];
    expect(rel.bidirectional).toBe(true);
  });

  it('treats directional Rel_U/Rel_Down as plain Rel without any warning', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Rel_U(a, b, "up")', 'Rel_Down(b, c, "down")'].join('\n'),
    );

    expect(issues).toEqual([]);
    const [up, down] = ast.statements as RelStatement[];
    expect(up).toMatchObject({ from: 'a', to: 'b', bidirectional: false });
    expect(down).toMatchObject({ from: 'b', to: 'c', bidirectional: false });
  });

  it('errors when Rel is missing to, and skips the statement', () => {
    const { ast, issues } = parseSingleBlock(['C4Context', 'Rel(onlyFrom)'].join('\n'));

    expect(ast.statements).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', line: 2 });
  });
});

describe('parseC4Block: 無視される文', () => {
  it('ignores title and Update* statements without any issue', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Context',
        'title インターネットバンキング - Context',
        'UpdateRelStyle(a, b, $textColor="red")',
        'UpdateElementStyle(a, $bgColor="blue")',
        'UpdateLayoutConfig($c4ShapeInRow="4")',
        'Person(a, "A")',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    expect(ast.statements).toHaveLength(1);
  });
});

describe('parseC4Block: 未対応の文', () => {
  it('warns on an unsupported statement and continues parsing subsequent lines', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Foo(bar, "baz")', 'Person(a, "A")'].join('\n'),
    );

    expect(ast.statements).toHaveLength(1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', line: 2 });
    expect(issues[0]?.message).toContain('未対応の文');
  });
});

describe('parseC4Block: Boundary', () => {
  it('nests children between System_Boundary(...) { and } with no issues', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Container',
        'System_Boundary(ibs, "インターネットバンキング") {',
        '  Container(spa, "SPA")',
        '  Container(api, "API")',
        '}',
        'Rel(spa, api, "call")',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    expect(ast.statements).toHaveLength(2); // boundary + Rel
    const boundary = ast.statements[0] as BoundaryStatement;
    expect(boundary).toMatchObject({
      type: 'boundary',
      boundaryKind: 'system',
      alias: 'ibs',
      label: 'インターネットバンキング',
      closedImplicitly: false,
    });
    expect(boundary.children).toHaveLength(2);
    expect(boundary.children.map((c) => (c as ElementStatement).alias)).toEqual(['spa', 'api']);
  });

  it('allows the opening brace on its own line', () => {
    const { ast, issues } = parseSingleBlock(
      [
        'C4Component',
        'Container_Boundary(api, "API")',
        '{',
        '  Component(signin, "サインイン")',
        '}',
      ].join('\n'),
    );

    expect(issues).toEqual([]);
    const boundary = ast.statements[0] as BoundaryStatement;
    expect(boundary.children).toHaveLength(1);
  });

  it('implicitly closes an unclosed Boundary at block end and warns', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Container', 'System_Boundary(ibs, "IBS") {', '  Container(spa, "SPA")'].join('\n'),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', line: 2 });
    const boundary = ast.statements[0] as BoundaryStatement;
    expect(boundary.closedImplicitly).toBe(true);
    expect(boundary.children).toHaveLength(1);
  });

  it('records Enterprise_Boundary as boundaryKind enterprise', () => {
    const { ast, issues } = parseSingleBlock(
      ['C4Context', 'Enterprise_Boundary(bank, "銀行") {', '  Person(a, "A")', '}'].join('\n'),
    );

    expect(issues).toEqual([]);
    const boundary = ast.statements[0] as BoundaryStatement;
    expect(boundary.boundaryKind).toBe('enterprise');
  });
});

describe('parseC4Block: エラーケース', () => {
  it('errors when an element statement is missing alias/label', () => {
    const { ast, issues } = parseSingleBlock(['C4Context', 'Person()'].join('\n'));

    expect(ast.statements).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
  });

  it('errors on unbalanced parentheses', () => {
    const { ast, issues } = parseSingleBlock(['C4Context', 'Person(a, "A"'].join('\n'));

    expect(ast.statements).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
  });
});
