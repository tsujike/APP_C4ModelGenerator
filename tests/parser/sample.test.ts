import { describe, expect, it } from 'vitest';
import { parseC4Block } from '../../src/parser/parseC4Block';
import { splitBlocks } from '../../src/parser/splitBlocks';
import type { C4BlockKind, ParseIssue, SourceBlock } from '../../src/parser/types';

/**
 * 設計書 docs/02_アーキテクチャ設計書.md §5.4 のソース例(そのまま)。
 * classDiagramブロックの中身の解析はT1-2の範囲なので、ここではブロックとして
 * 認識されること・`%% code-of:` 指令が渡ることのみ確認し、中身はparseC4Blockに通さない。
 */
const SAMPLE_SOURCE = `C4Context
  title インターネットバンキング - Context
  Person(customer, "銀行顧客", "口座を持つ個人")
  System(ibs, "インターネットバンキング", "照会と振込を提供")
  System_Ext(email, "メールシステム")
  Rel(customer, ibs, "利用する", "HTTPS")
  Rel(ibs, email, "通知を依頼", "SMTP")

C4Container
  System_Boundary(ibs, "インターネットバンキング") {
    Container(spa, "SPA", "TypeScript", "ブラウザUI")
    Container(api, "API", "Java/Spring", "業務ロジック")
    ContainerDb(db, "DB", "PostgreSQL")
  }
  Rel(customer, spa, "利用する", "HTTPS")
  Rel(spa, api, "呼び出す", "JSON/HTTPS")
  Rel(api, db, "読み書き", "JDBC")
  Rel(api, email, "通知を依頼", "SMTP")

C4Component
  Container_Boundary(api, "API") {
    Component(signin, "サインインCtrl", "Spring MVC")
    Component(accounts, "口座サービス", "Spring Bean")
  }
  Rel(spa, signin, "呼び出す")
  Rel(accounts, db, "読み書き", "JDBC")

%% code-of: accounts
classDiagram
  class AccountService {
    +getAccounts(userId)
  }
  class AccountRepository {
    +findByUserId(userId)
  }
  AccountService --> AccountRepository
`;

describe('設計書§5.4のサンプルソース', () => {
  it('splits into 4 blocks: C4Context, C4Container, C4Component, classDiagram', () => {
    const blocks = splitBlocks(SAMPLE_SOURCE);

    expect(blocks.map((b) => b.kind)).toEqual([
      'C4Context',
      'C4Container',
      'C4Component',
      'classDiagram',
    ]);
  });

  it('attaches the %% code-of: accounts directive to the classDiagram block only', () => {
    const blocks = splitBlocks(SAMPLE_SOURCE);
    const classDiagramBlock = blocks[3];

    expect(classDiagramBlock?.kind).toBe('classDiagram');
    expect(classDiagramBlock?.codeOfAlias).toBe('accounts');
    // 中身(class本体・矢印)はT1-1の対象外。ここでは生の行が保持されていることだけ見る。
    expect(classDiagramBlock?.lines.length).toBeGreaterThan(0);
  });

  it('produces zero errors when the 3 C4 blocks are parsed by parseC4Block', () => {
    const blocks = splitBlocks(SAMPLE_SOURCE);
    const c4Blocks = blocks.filter(
      (b): b is SourceBlock & { kind: C4BlockKind } => b.kind !== 'classDiagram',
    );
    expect(c4Blocks).toHaveLength(3);

    const allIssues: ParseIssue[] = c4Blocks.flatMap((block) => parseC4Block(block).issues);
    const errors = allIssues.filter((issue) => issue.severity === 'error');

    expect(errors).toEqual([]);
  });

  it('parses the expected element/boundary/rel counts per block', () => {
    const blocks = splitBlocks(SAMPLE_SOURCE);
    const [contextBlock, containerBlock, componentBlock] = blocks as [
      SourceBlock,
      SourceBlock,
      SourceBlock,
    ];

    const context = parseC4Block(contextBlock as SourceBlock & { kind: C4BlockKind });
    // Person, System, System_Ext, Rel x2 = 5 top-level statements
    expect(context.ast.statements).toHaveLength(5);

    const container = parseC4Block(containerBlock as SourceBlock & { kind: C4BlockKind });
    // System_Boundary(内部にContainer3つ) + Rel x4 = 5 top-level statements
    expect(container.ast.statements).toHaveLength(5);
    const boundary = container.ast.statements[0];
    expect(boundary?.type).toBe('boundary');
    if (boundary?.type === 'boundary') {
      expect(boundary.children).toHaveLength(3);
    }

    const component = parseC4Block(componentBlock as SourceBlock & { kind: C4BlockKind });
    // Container_Boundary(内部にComponent2つ) + Rel x2 = 3 top-level statements
    expect(component.ast.statements).toHaveLength(3);
  });
});
