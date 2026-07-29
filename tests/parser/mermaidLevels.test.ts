import { describe, expect, it } from 'vitest';
import {
  detectMarkerlessMermaidLine,
  isMermaidModeSource,
  splitMermaidLevels,
} from '../../src/parser/mermaidLevels';
import { mermaidLevelsSample } from '../../src/samples/mermaid-levels';

describe('isMermaidModeSource', () => {
  it('returns true when at least one level marker exists', () => {
    expect(isMermaidModeSource('%%L1\nflowchart TD\n  A --> B')).toBe(true);
  });

  it('accepts spacing and lower case variants', () => {
    expect(isMermaidModeSource('%% L2\nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('  %%l3  \nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('%%\tL4\nflowchart TD')).toBe(true);
  });

  it('returns false for a C4 source so the existing C4 path stays untouched', () => {
    const source = ['C4Context', '  Person(a, "A")', '  System(b, "B")'].join('\n');
    expect(isMermaidModeSource(source)).toBe(false);
  });

  it('does not treat a comment with trailing text as a marker', () => {
    expect(isMermaidModeSource('%%L1 は概要レベル\nC4Context')).toBe(false);
  });

  // L8拡張(FR-7.9)で `%%L5`〜`%%L8` は正規のマーカーになったため、範囲外の代表を
  // `%%L0` / `%%L9` に差し替えた(このテストの意図は「範囲外の数字はマーカーにしない」で不変)。
  it('does not treat out-of-range level numbers as markers', () => {
    expect(isMermaidModeSource('%%L0\n%%L9\nC4Context')).toBe(false);
  });

  it('returns true for the built-in Mermaid sample', () => {
    expect(isMermaidModeSource(mermaidLevelsSample)).toBe(true);
  });
});

describe('splitMermaidLevels', () => {
  it('splits each level and excludes the marker line from the body', () => {
    const source = [
      '%%L1',
      'flowchart TD',
      '  A --> B',
      '%%L2',
      'sequenceDiagram',
      '  A->>B: hi',
    ].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(issues).toEqual([]);
    expect([...levels.keys()]).toEqual([1, 2]);
    expect(levels.get(1)?.text).toBe('flowchart TD\n  A --> B');
    expect(levels.get(2)?.text).toBe('sequenceDiagram\n  A->>B: hi');
  });

  it('records the 1-based marker line for each level', () => {
    const source = ['%%L1', 'flowchart TD', '', '%%L3', 'flowchart LR'].join('\n');

    const { levels } = splitMermaidLevels(source);

    expect(levels.get(1)?.markerLine).toBe(1);
    expect(levels.get(3)?.markerLine).toBe(4);
  });

  it('leaves unregistered levels absent from the map', () => {
    const { levels } = splitMermaidLevels('%%L2\nflowchart TD\n  A --> B');

    expect([...levels.keys()]).toEqual([2]);
    expect(levels.has(1)).toBe(false);
    expect(levels.has(4)).toBe(false);
  });

  it('accepts marker spacing and case variants', () => {
    const source = ['%% L1', 'flowchart TD', '  %%l2  ', 'flowchart LR'].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(issues).toEqual([]);
    expect(levels.get(1)?.text).toBe('flowchart TD');
    expect(levels.get(2)?.text).toBe('flowchart LR');
  });

  it('warns about non-empty lines before the first marker and ignores them', () => {
    const source = ['stray text', '', '%%L1', 'flowchart TD'].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.line).toBe(1);
    expect(levels.get(1)?.text).toBe('flowchart TD');
  });

  it('keeps the first duplicate marker, warns, and discards the later body', () => {
    const source = [
      '%%L1',
      'flowchart TD',
      '  first --> one',
      '%%L1',
      'flowchart LR',
      '  second --> two',
    ].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(levels.get(1)?.text).toBe('flowchart TD\n  first --> one');
    expect(levels.get(1)?.markerLine).toBe(1);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.line).toBe(4);
  });

  it('resumes normally on the level after an ignored duplicate', () => {
    const source = ['%%L1', 'A', '%%L1', 'B', '%%L2', 'C'].join('\n');

    const { levels } = splitMermaidLevels(source);

    expect(levels.get(1)?.text).toBe('A');
    expect(levels.get(2)?.text).toBe('C');
  });

  it('warns and leaves the level unregistered when the body is empty', () => {
    const source = ['%%L1', '', '   ', '%%L2', 'flowchart TD'].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(levels.has(1)).toBe(false);
    expect(levels.get(2)?.text).toBe('flowchart TD');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.line).toBe(1);
  });

  it('warns when the very last marker has no body', () => {
    const source = ['%%L1', 'flowchart TD', '%%L4'].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(levels.has(4)).toBe(false);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBe(3);
  });

  it('handles CRLF sources', () => {
    const { levels, issues } = splitMermaidLevels('%%L1\r\nflowchart TD\r\n  A --> B\r\n');

    expect(issues).toEqual([]);
    expect(levels.get(1)?.text).toBe('flowchart TD\n  A --> B');
  });

  it('returns nothing for a source without any marker', () => {
    const { levels, issues } = splitMermaidLevels('flowchart TD\n  A --> B');

    expect(levels.size).toBe(0);
    // マーカーが1つも無いソースはそもそもMermaidモードにならない(isMermaidModeSourceがfalse)ため、
    // ここで出る「マーカーより前の行」warningは実運用では表に出ない。
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('splits the built-in sample into L1〜L7 with L8 deliberately unregistered', () => {
    // post-v1.0のL5〜L8拡張(セマンティックズームL1〜L8化)に伴い、サンプルはL1〜L7を実図で埋め、
    // 「未登録レベルは何も表示しない」の確認用としてL8だけを意図的に未登録にしている
    // (`src/samples/mermaid-levels.ts`のJSDoc参照。従来はL4がその役割だった)。
    const { levels, issues } = splitMermaidLevels(mermaidLevelsSample);

    expect(issues).toEqual([]);
    expect([...levels.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(levels.get(1)?.text.startsWith('flowchart TD')).toBe(true);
    expect(levels.get(2)?.text).toContain('subgraph');
    expect(levels.get(3)?.text.startsWith('sequenceDiagram')).toBe(true);
    expect(levels.get(4)?.text.startsWith('stateDiagram-v2')).toBe(true);
    expect(levels.get(5)?.text.startsWith('erDiagram')).toBe(true);
    expect(levels.get(6)?.text.startsWith('flowchart TD')).toBe(true);
    expect(levels.get(7)?.text.startsWith('sequenceDiagram')).toBe(true);
    expect(levels.has(8)).toBe(false);
  });
});

// post-v1.0: セマンティックズームL1〜L8拡張に伴い、Mermaidモード専用マーカーがL8まで
// 受け付けられるようになった(LEVEL_MARKER_PATTERN = /^%%\s*L([1-8])\s*$/i)。
describe('post-v1.0: L5〜L8マーカー拡張(Mermaidモード専用)', () => {
  it('accepts %%L5〜%%L8 as markers (isMermaidModeSource)', () => {
    expect(isMermaidModeSource('%%L5\nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('%%L6\nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('%%L7\nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('%%L8\nflowchart TD')).toBe(true);
  });

  it('splitMermaidLevels registers keys 5〜8 with their bodies', () => {
    const source = [
      '%%L5',
      'erDiagram',
      '  A ||--o{ B : has',
      '%%L6',
      'flowchart TD',
      '  A --> B',
      '%%L7',
      'sequenceDiagram',
      '  A->>B: hi',
      '%%L8',
      'flowchart TD',
      '  X --> Y',
    ].join('\n');

    const { levels, issues } = splitMermaidLevels(source);

    expect(issues).toEqual([]);
    expect([...levels.keys()]).toEqual([5, 6, 7, 8]);
    expect(levels.get(5)?.text).toBe('erDiagram\n  A ||--o{ B : has');
    expect(levels.get(6)?.text).toBe('flowchart TD\n  A --> B');
    expect(levels.get(7)?.text).toBe('sequenceDiagram\n  A->>B: hi');
    expect(levels.get(8)?.text).toBe('flowchart TD\n  X --> Y');
  });

  it('does not accept %%L0 / %%L9 / %%L10 as markers', () => {
    expect(isMermaidModeSource('%%L0\nC4Context')).toBe(false);
    expect(isMermaidModeSource('%%L9\nC4Context')).toBe(false);
    expect(isMermaidModeSource('%%L10\nC4Context')).toBe(false);
  });

  it('is tolerant of spacing and lower case for L5〜L8, same as the existing L1〜L4 rule', () => {
    expect(isMermaidModeSource('%% L8\nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('  %%l5  \nflowchart TD')).toBe(true);
    expect(isMermaidModeSource('%%\tL6\nflowchart TD')).toBe(true);
  });
});

describe('detectMarkerlessMermaidLine', () => {
  it('detects a bare sequenceDiagram pasted without any level marker', () => {
    // Kennyが実際に貼ったのと同じ形(素のMermaidをそのまま貼るとC4モードと判定される)。
    const source = [
      'sequenceDiagram',
      '    autonumber',
      '    actor User as 利用者',
      '    User->>Counter: 借りたい本と利用カードを提示',
    ].join('\n');

    expect(detectMarkerlessMermaidLine(source)).toBe(1);
  });

  it('reports the line number of the first significant line, skipping blanks and comments', () => {
    const source = ['', '  ', '%% これはコメント', '', 'flowchart TD', '  A --> B'].join('\n');

    expect(detectMarkerlessMermaidLine(source)).toBe(5);
  });

  it('detects the common mermaid diagram keywords', () => {
    for (const head of [
      'flowchart TD',
      'graph LR',
      'sequenceDiagram',
      'stateDiagram-v2',
      'erDiagram',
      'gantt',
      'pie title 内訳',
      'mindmap',
      'timeline',
      'gitGraph:',
    ]) {
      expect(detectMarkerlessMermaidLine(`${head}\n  A --> B`)).toBe(1);
    }
  });

  it('is tolerant of casing', () => {
    expect(detectMarkerlessMermaidLine('FlowChart TD\n  A --> B')).toBe(1);
  });

  it('returns undefined when a level marker exists (already in mermaid mode)', () => {
    expect(detectMarkerlessMermaidLine('%%L2\nsequenceDiagram\n  A->>B: x')).toBeUndefined();
  });

  it('returns undefined for the built-in mermaid sample', () => {
    expect(detectMarkerlessMermaidLine(mermaidLevelsSample)).toBeUndefined();
  });

  it('returns undefined for a C4 source', () => {
    const source = ['C4Context', '  Person(a, "A")', '  System(b, "B")'].join('\n');
    expect(detectMarkerlessMermaidLine(source)).toBeUndefined();
  });

  it('returns undefined for a classDiagram-only source (a valid C4 mode block kind)', () => {
    // `classDiagram` はC4モードのL4入力そのものなので、Mermaidモードの案内を出してはいけない。
    const source = ['classDiagram', '  class Order {', '    +id: string', '  }'].join('\n');
    expect(detectMarkerlessMermaidLine(source)).toBeUndefined();
  });

  it('returns undefined for a C4Container-only source', () => {
    const source = ['C4Container', '  Container(web, "Web", "TS")'].join('\n');
    expect(detectMarkerlessMermaidLine(source)).toBeUndefined();
  });

  it('does not match a word that merely starts with a keyword', () => {
    expect(detectMarkerlessMermaidLine('graphql schema {\n  a: B\n}')).toBeUndefined();
  });

  it('returns undefined for an empty or blank source', () => {
    expect(detectMarkerlessMermaidLine('')).toBeUndefined();
    expect(detectMarkerlessMermaidLine('\n\n   \n')).toBeUndefined();
  });

  it('handles CRLF sources', () => {
    expect(detectMarkerlessMermaidLine('\r\nsequenceDiagram\r\n  A->>B: x')).toBe(2);
  });
});
