import { describe, expect, it } from 'vitest';
import { stripFileExtension } from '../../src/ui/fileIO';

describe('stripFileExtension', () => {
  it('最後の拡張子を取り除く', () => {
    expect(stripFileExtension('Untitled.txt')).toBe('Untitled');
    expect(stripFileExtension('銀行システム.txt')).toBe('銀行システム');
  });

  it('複数のドットがある場合は最後のドットで区切る', () => {
    expect(stripFileExtension('a.b.txt')).toBe('a.b');
  });

  it('拡張子が無い場合はそのまま返す', () => {
    expect(stripFileExtension('README')).toBe('README');
  });

  it('先頭ドットのみ(隠しファイル)の場合はそのまま返す', () => {
    expect(stripFileExtension('.gitignore')).toBe('.gitignore');
  });
});
