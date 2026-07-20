import { describe, expect, it } from 'vitest';
import { sanitizeFilename, stripFileExtension } from '../../src/ui/fileIO';

describe('sanitizeFilename', () => {
  it('禁止文字を含まないタイトルはそのまま返す', () => {
    expect(sanitizeFilename('Untitled')).toBe('Untitled');
    expect(sanitizeFilename('銀行システム')).toBe('銀行システム');
  });

  it('Windows/macOS/Linuxで禁止される文字(\\ / : * ? " < > |)を除去する', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('前後の空白を除去する', () => {
    expect(sanitizeFilename('  タイトル  ')).toBe('タイトル');
  });

  it('除去後に空文字列になる場合はUntitledにフォールバックする', () => {
    expect(sanitizeFilename('///')).toBe('Untitled');
    expect(sanitizeFilename('')).toBe('Untitled');
    expect(sanitizeFilename('   ')).toBe('Untitled');
  });
});

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
