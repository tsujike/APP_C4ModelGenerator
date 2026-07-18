import { describe, expect, it } from 'vitest';
import { C4_COLORS } from '../../src/constants';
import { endArrowheadFor, nodeColors } from '../../src/render/theme';

describe('theme: nodeColors(設計書§7.2の対応表)', () => {
  it('maps each non-external kind to its C4_COLORS fill and the table-specified text color', () => {
    expect(nodeColors('person', false)).toEqual({
      background: C4_COLORS.person.fill,
      text: '#ffffff',
    });
    expect(nodeColors('system', false)).toEqual({
      background: C4_COLORS.system.fill,
      text: '#ffffff',
    });
    expect(nodeColors('container', false)).toEqual({
      background: C4_COLORS.container.fill,
      text: '#ffffff',
    });
    expect(nodeColors('component', false)).toEqual({
      background: C4_COLORS.component.fill,
      text: '#000000',
    });
    expect(nodeColors('class', false)).toEqual({
      background: C4_COLORS.class.fill,
      text: '#000000',
    });
    expect(nodeColors('boundary', false)).toEqual({
      background: 'transparent',
      text: C4_COLORS.boundary.text,
    });
  });

  it('switches to the extFill color for external variants while keeping the same text color', () => {
    expect(nodeColors('person', true)).toEqual({
      background: C4_COLORS.person.extFill,
      text: '#ffffff',
    });
    expect(nodeColors('system', true)).toEqual({
      background: C4_COLORS.system.extFill,
      text: '#ffffff',
    });
    expect(nodeColors('container', true)).toEqual({
      background: C4_COLORS.container.extFill,
      text: '#ffffff',
    });
    expect(nodeColors('component', true)).toEqual({
      background: C4_COLORS.component.extFill,
      text: '#000000',
    });
  });
});

describe('theme: endArrowheadFor(§7.2: 通常はarrow、L4継承のみtriangle)', () => {
  it('returns "arrow" for a normal association', () => {
    expect(endArrowheadFor('association')).toBe('arrow');
  });

  it('returns "triangle" only for inheritance', () => {
    expect(endArrowheadFor('inheritance')).toBe('triangle');
  });
});
