import { describe, expect, it } from 'vitest';
import { C4_COLORS } from '../../src/constants';
import { buildNodeElements, type NodeShapeInput } from '../../src/render/shapes';

function baseInput(overrides: Partial<NodeShapeInput> = {}): NodeShapeInput {
  return {
    id: 'api',
    levelPrefix: 'L2',
    kind: 'container',
    variant: 'default',
    external: false,
    label: 'API',
    x: 10,
    y: 20,
    width: 200,
    height: 100,
    isBoundary: false,
    ...overrides,
  };
}

describe('shapes: 決定的id生成とグループ化(設計書§7.2)', () => {
  it('names the box/text elements "{levelPrefix}:{id}:{part}" (§7.2 example: "L2:api:box")', () => {
    const elements = buildNodeElements(baseInput());
    const ids = elements.map((e) => e.id);
    expect(ids).toContain('L2:api:box');
    expect(ids).toContain('L2:api:text');
  });

  it('shares a single groupIds value across every element composing one logical node', () => {
    const elements = buildNodeElements(baseInput({ kind: 'person', isBoundary: false }));
    // Person は head(ellipse)+box(rectangle)+text の3要素からなるグループ(§7.2)。
    expect(elements.length).toBe(3);
    const groupIdSets = elements.map((e) => e.groupIds);
    for (const g of groupIdSets) {
      expect(g).toEqual(['L2:api:group']);
    }
  });
});

describe('shapes: 種別ごとの要素合成(§7.2の対応表)', () => {
  it('composes a Boundary(展開枠) as a dashed, unfilled rectangle plus a top-left label text', () => {
    const elements = buildNodeElements(
      baseInput({ kind: 'system', isBoundary: true, label: 'IBS' }),
    );
    expect(elements).toHaveLength(2);

    const box = elements.find((e) => e.id === 'L2:api:box');
    expect(box?.type).toBe('rectangle');
    if (box?.type === 'rectangle') {
      expect(box.strokeStyle).toBe('dashed');
      expect(box.backgroundColor).toBe('transparent');
    }

    const label = elements.find((e) => e.id === 'L2:api:label');
    expect(label?.type).toBe('text');
    if (label?.type === 'text') {
      expect(label.text).toBe('IBS');
    }
  });

  it('composes a Person as a head ellipse + body rectangle + text, all in #08427B (non-external)', () => {
    const elements = buildNodeElements(baseInput({ kind: 'person', label: 'Customer' }));
    const head = elements.find((e) => e.id === 'L2:api:head');
    const box = elements.find((e) => e.id === 'L2:api:box');
    expect(head?.type).toBe('ellipse');
    expect(box?.type).toBe('rectangle');
    if (head?.type === 'ellipse') expect(head.backgroundColor).toBe(C4_COLORS.person.fill);
    if (box?.type === 'rectangle') expect(box.backgroundColor).toBe(C4_COLORS.person.fill);
  });

  it('uses the extFill color for an external node of the same kind', () => {
    const elements = buildNodeElements(baseInput({ kind: 'system', external: true }));
    const box = elements.find((e) => e.id === 'L2:api:box');
    if (box?.type === 'rectangle') expect(box.backgroundColor).toBe(C4_COLORS.system.extFill);
  });

  it('composes a Db variant as a rectangle plus a top ellipse (cylinder approximation)', () => {
    const elements = buildNodeElements(
      baseInput({ kind: 'container', variant: 'db', label: 'DB' }),
    );
    expect(elements).toHaveLength(3);
    const top = elements.find((e) => e.id === 'L2:api:top');
    const box = elements.find((e) => e.id === 'L2:api:box');
    expect(top?.type).toBe('ellipse');
    expect(box?.type).toBe('rectangle');
  });

  it('composes a Queue variant as a single elongated rounded rectangle (no cylinder caps)', () => {
    const elements = buildNodeElements(baseInput({ kind: 'container', variant: 'queue' }));
    expect(elements).toHaveLength(2);
    expect(elements.map((e) => e.type).sort()).toEqual(['rectangle', 'text']);
  });
});

describe('shapes: ノード内テキスト整形(§7.2: label/[technology]/description最大3行)', () => {
  it('renders label, then "[technology]", then wrapped description within a text element', () => {
    const elements = buildNodeElements(
      baseInput({
        label: 'API',
        technology: 'Java/Spring',
        description: '業務ロジック',
        width: 260, // "[Java/Spring]"(13文字)が折り返されずに1行に収まる幅を確保する。
      }),
    );
    const text = elements.find((e) => e.id === 'L2:api:text');
    expect(text?.type).toBe('text');
    if (text?.type === 'text') {
      const lines = text.text.split('\n');
      expect(lines[0]).toBe('API');
      expect(lines[1]).toBe('[Java/Spring]');
      expect(lines.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('truncates a description longer than 3 wrapped lines with a trailing "…"', () => {
    const longDescription = '説明文'.repeat(80); // 十分に長い説明文で折返し上限を超えさせる。
    const elements = buildNodeElements(baseInput({ description: longDescription }));
    const text = elements.find((e) => e.id === 'L2:api:text');
    expect(text?.type).toBe('text');
    if (text?.type === 'text') {
      const lines = text.text.split('\n');
      // label(1行) + description最大3行 = 最大4行(technology無し)。
      expect(lines.length).toBeLessThanOrEqual(4);
      expect(lines[lines.length - 1]?.endsWith('…')).toBe(true);
    }
  });
});
