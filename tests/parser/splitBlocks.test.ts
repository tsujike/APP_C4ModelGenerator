import { describe, expect, it } from 'vitest';
import { splitBlocks } from '../../src/parser/splitBlocks';

describe('splitBlocks', () => {
  it('splits a single C4Context block and keeps line numbers', () => {
    const source = ['C4Context', '  Person(a, "A")', '  System(b, "B")'].join('\n');

    const blocks = splitBlocks(source);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('C4Context');
    expect(blocks[0]?.startLine).toBe(1);
    expect(blocks[0]?.lines.map((l) => l.line)).toEqual([2, 3]);
    expect(blocks[0]?.lines.map((l) => l.text.trim())).toEqual([
      'Person(a, "A")',
      'System(b, "B")',
    ]);
  });

  it('splits Context/Container/Component/classDiagram into separate blocks', () => {
    const source = [
      'C4Context',
      '  Person(a, "A")',
      'C4Container',
      '  Container(c, "C")',
      'C4Component',
      '  Component(d, "D")',
      'classDiagram',
      '  class Foo',
    ].join('\n');

    const blocks = splitBlocks(source);

    expect(blocks.map((b) => b.kind)).toEqual([
      'C4Context',
      'C4Container',
      'C4Component',
      'classDiagram',
    ]);
    expect(blocks.map((b) => b.startLine)).toEqual([1, 3, 5, 7]);
  });

  it('drops blank lines and plain %% comments from block bodies', () => {
    const source = ['C4Context', '', '  %% just a comment', '  Person(a, "A")', ''].join('\n');

    const blocks = splitBlocks(source);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.lines).toHaveLength(1);
    expect(blocks[0]?.lines[0]?.text.trim()).toBe('Person(a, "A")');
  });

  it('captures a %% code-of: directive and attaches it to the next classDiagram block', () => {
    const source = [
      'C4Component',
      '  Component(accounts, "Accounts")',
      '',
      '%% code-of: accounts',
      'classDiagram',
      '  class AccountService',
    ].join('\n');

    const blocks = splitBlocks(source);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.codeOfAlias).toBeUndefined();
    expect(blocks[1]?.kind).toBe('classDiagram');
    expect(blocks[1]?.codeOfAlias).toBe('accounts');
  });

  it('does not leak a code-of directive to a block it does not immediately precede', () => {
    const source = ['%% code-of: accounts', 'C4Context', '  Person(a, "A")'].join('\n');

    const blocks = splitBlocks(source);

    // 指令の直後のブロックはC4Contextであり、その値は保持されるが意味を持つのはT1-2のみ。
    // ここではsplitBlocksが機械的に直後ブロックへ渡すことだけを確認する。
    expect(blocks[0]?.codeOfAlias).toBe('accounts');
  });

  it('treats block-start indentation as free (lenient, trimmed match)', () => {
    const source = ['   C4Context', '  Person(a, "A")'].join('\n');

    const blocks = splitBlocks(source);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('C4Context');
  });

  it('does not false-positive on identifiers that merely start with a block keyword', () => {
    const source = ['C4Context', '  C4ContextFoo(x, "y")'].join('\n');

    const blocks = splitBlocks(source);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.lines).toHaveLength(1);
    expect(blocks[0]?.lines[0]?.text.trim()).toBe('C4ContextFoo(x, "y")');
  });

  it('returns an empty array for a source with no blocks', () => {
    expect(splitBlocks('')).toEqual([]);
    expect(splitBlocks('%% just a comment\n\n')).toEqual([]);
  });
});
