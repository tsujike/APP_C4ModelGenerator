import { describe, expect, it } from 'vitest';
import { loadPersistedTitle, savePersistedTitle } from '../../src/ui/title';
import { STORAGE_TITLE_KEY } from '../../src/constants';

/**
 * `window.localStorage`全体をモックする代わりに、`loadPersistedTitle`/`savePersistedTitle`が
 * 要求する最小限のインターフェース(`Pick<Storage, 'getItem'|'setItem'>`)だけを持つフェイクを使う
 * (`tests/ui/editor.test.ts`の`createFakeStorage`と同じパターン)。
 */
function createFakeStorage(initial: Record<string, string> = {}): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key) {
      return key in data ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe('loadPersistedTitle / savePersistedTitle', () => {
  it('未保存(キーが無い)場合はnullを返す', () => {
    const storage = createFakeStorage();
    expect(loadPersistedTitle(storage)).toBeNull();
  });

  it('保存した値をそのまま復元できる', () => {
    const storage = createFakeStorage();
    savePersistedTitle(storage, '銀行システム');
    expect(loadPersistedTitle(storage)).toBe('銀行システム');
  });

  it('保存済みの値がSTORAGE_KEY(ソース本文)とは独立したキーに書かれる', () => {
    const storage = createFakeStorage();
    savePersistedTitle(storage, 'ECサイト');
    expect(storage.data[STORAGE_TITLE_KEY]).toBe('ECサイト');
  });

  it('空文字列はnull扱い(未設定と同じ)にする', () => {
    const storage = createFakeStorage({ [STORAGE_TITLE_KEY]: '' });
    expect(loadPersistedTitle(storage)).toBeNull();
  });

  it('空白のみの文字列もnull扱いにする', () => {
    const storage = createFakeStorage({ [STORAGE_TITLE_KEY]: '   ' });
    expect(loadPersistedTitle(storage)).toBeNull();
  });

  it('getItemが例外を投げる場合はnullを返す(例: プライベートブラウジングでのアクセス拒否)', () => {
    const storage = {
      getItem(): string {
        throw new Error('access denied');
      },
    };
    expect(loadPersistedTitle(storage)).toBeNull();
  });

  it('setItemが例外を投げても(容量超過等)呼び出し側に伝播しない', () => {
    const storage = {
      setItem(): void {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => {
      savePersistedTitle(storage, 'x');
    }).not.toThrow();
  });
});
