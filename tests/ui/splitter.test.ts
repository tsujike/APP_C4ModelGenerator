import { describe, expect, it } from 'vitest';
import { computeColumnWidth } from '../../src/ui/splitter';
import { SPLITTER } from '../../src/constants';

describe('computeColumnWidth', () => {
  it('ドラッグ量をそのまま反映する(範囲内)', () => {
    expect(computeColumnWidth(320, 40, 1200)).toBe(360);
    expect(computeColumnWidth(320, -40, 1200)).toBe(280);
  });

  it('最小幅を下回らない', () => {
    expect(computeColumnWidth(320, -1000, 1200)).toBe(SPLITTER.minColumnWidth);
  });

  it('コンテナ幅に対する上限比率を上回らない', () => {
    const containerWidth = 1000;
    const expectedMax = containerWidth * SPLITTER.maxColumnRatio;
    expect(computeColumnWidth(320, 100000, containerWidth)).toBe(expectedMax);
  });

  it('コンテナが極端に狭く上限が下限を下回る場合でも最小幅を優先する', () => {
    const containerWidth = 100; // maxColumnRatio(0.7)を掛けても70 < minColumnWidth(200)
    expect(computeColumnWidth(320, -1000, containerWidth)).toBe(SPLITTER.minColumnWidth);
  });
});
