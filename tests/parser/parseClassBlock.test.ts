import { describe, expect, it } from 'vitest';
import { parseClassBlock, type ClassBlockLine } from '../../src/parser/parseClassBlock.ts';

/** テスト記述を簡潔にするための小ヘルパー: 1始まりの行番号を自動採番する。 */
function toLines(texts: string[], startLine = 1): ClassBlockLine[] {
  return texts.map((text, i) => ({ line: startLine + i, text }));
}

describe('parseClassBlock', () => {
  it('classifies field/method members of a single-line class body by presence of "("', () => {
    const ast = parseClassBlock(toLines(['class Name { +field; +method() }']), undefined);

    expect(ast.classes).toHaveLength(1);
    expect(ast.classes[0]).toMatchObject({
      kind: 'class',
      name: 'Name',
      fields: ['+field'],
      methods: ['+method()'],
    });
  });

  it('classifies field/method members of a multi-line class body', () => {
    const ast = parseClassBlock(
      toLines(['class AccountService {', '  +getAccounts(userId)', '  -repository', '}']),
      undefined,
    );

    expect(ast.classes).toHaveLength(1);
    const cls = ast.classes[0];
    expect(cls).toBeDefined();
    expect(cls?.name).toBe('AccountService');
    expect(cls?.methods).toEqual(['+getAccounts(userId)']);
    expect(cls?.fields).toEqual(['-repository']);
    // sourceLine はボディ開始行(`class Name {`)を指す。
    expect(cls?.sourceLine).toBe(1);
  });

  it('parses a body-less "class Name" as an empty class', () => {
    const ast = parseClassBlock(toLines(['class Empty']), undefined);

    expect(ast.classes).toEqual([
      { kind: 'class', name: 'Empty', fields: [], methods: [], sourceLine: 1 },
    ]);
  });

  it.each([
    ['-->', 'A --> B'],
    ['--|>', 'A --|> B'],
    ['*--', 'A *-- B'],
    ['o--', 'A o-- B'],
    ['..>', 'A ..> B'],
  ] as const)('recognizes the "%s" arrow', (arrow, source) => {
    const ast = parseClassBlock(toLines([source]), undefined);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]).toMatchObject({ kind: 'edge', from: 'A', to: 'B', arrow });
  });

  it('parses an edge label when present and omits it when absent', () => {
    const ast = parseClassBlock(toLines(['A --> B : uses', 'C --|> D']), undefined);

    expect(ast.edges).toHaveLength(2);
    expect(ast.edges[0]).toMatchObject({ from: 'A', to: 'B', arrow: '-->', label: 'uses' });
    expect(ast.edges[1]).toMatchObject({ from: 'C', to: 'D', arrow: '--|>' });
    expect(ast.edges[1]?.label).toBeUndefined();
  });

  it('ignores unsupported syntax such as stereotypes without dropping surrounding valid lines', () => {
    const ast = parseClassBlock(
      toLines([
        'class Shape {',
        '  <<interface>>',
        '  +area()',
        '}',
        '<<interface>> Shape',
        'note "some note"',
        'Shape ..> Circle',
      ]),
      undefined,
    );

    expect(ast.classes).toHaveLength(1);
    expect(ast.classes[0]).toMatchObject({
      name: 'Shape',
      fields: [],
      methods: ['+area()'],
    });
    // 未対応の単独行(`<<interface>> Shape`, `note "..."`)は無視されつつ、
    // その後の正しいエッジ行は解析され続ける。
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]).toMatchObject({ from: 'Shape', to: 'Circle', arrow: '..>' });
  });

  it('includes the codeOf directive value in the resulting AST when provided', () => {
    const withDirective = parseClassBlock(toLines(['class A']), 'accounts');
    expect(withDirective.codeOf).toBe('accounts');

    const withoutDirective = parseClassBlock(toLines(['class A']), undefined);
    expect(withoutDirective.codeOf).toBeUndefined();
  });

  it('parses the §5.4 sample (AccountService/AccountRepository) into the expected AST', () => {
    // docs/02_アーキテクチャ設計書.md §5.4 のサンプルより、
    // `%% code-of: accounts` の次行 `classDiagram` から抽出したブロック本文を模す。
    const source = [
      'classDiagram',
      '  class AccountService {',
      '    +getAccounts(userId)',
      '  }',
      '  class AccountRepository {',
      '    +findByUserId(userId)',
      '  }',
      '  AccountService --> AccountRepository',
    ];

    const ast = parseClassBlock(toLines(source, 194), 'accounts');

    expect(ast.codeOf).toBe('accounts');
    expect(ast.classes).toEqual([
      {
        kind: 'class',
        name: 'AccountService',
        fields: [],
        methods: ['+getAccounts(userId)'],
        sourceLine: 195,
      },
      {
        kind: 'class',
        name: 'AccountRepository',
        fields: [],
        methods: ['+findByUserId(userId)'],
        sourceLine: 198,
      },
    ]);
    expect(ast.edges).toEqual([
      {
        kind: 'edge',
        from: 'AccountService',
        to: 'AccountRepository',
        arrow: '-->',
        sourceLine: 201,
      },
    ]);
  });
});
