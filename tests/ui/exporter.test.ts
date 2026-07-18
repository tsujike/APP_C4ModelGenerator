import { describe, expect, it } from 'vitest';
import { exportFileName } from '../../src/ui/exporter';

describe('exportFileName', () => {
  it('レベルと拡張子からファイル名を組み立てる', () => {
    expect(exportFileName(1, 'svg')).toBe('c4-model-L1.svg');
    expect(exportFileName(2, 'png')).toBe('c4-model-L2.png');
    expect(exportFileName(3, 'svg')).toBe('c4-model-L3.svg');
    expect(exportFileName(4, 'png')).toBe('c4-model-L4.png');
  });
});
