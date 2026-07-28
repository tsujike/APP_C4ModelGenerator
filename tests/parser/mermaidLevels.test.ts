import { describe, expect, it } from 'vitest';
import { isMermaidModeSource, splitMermaidLevels } from '../../src/parser/mermaidLevels';
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

  it('does not treat out-of-range level numbers as markers', () => {
    expect(isMermaidModeSource('%%L0\n%%L5\nC4Context')).toBe(false);
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

  it('splits the built-in sample into L1/L2/L3 with L4 deliberately unregistered', () => {
    const { levels, issues } = splitMermaidLevels(mermaidLevelsSample);

    expect(issues).toEqual([]);
    expect([...levels.keys()]).toEqual([1, 2, 3]);
    expect(levels.get(1)?.text.startsWith('flowchart TD')).toBe(true);
    expect(levels.get(2)?.text).toContain('subgraph');
    expect(levels.get(3)?.text.startsWith('sequenceDiagram')).toBe(true);
    expect(levels.has(4)).toBe(false);
  });
});
