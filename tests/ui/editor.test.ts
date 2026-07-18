import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyKeyword,
  debounce,
  loadPersistedSource,
  savePersistedSource,
} from '../../src/ui/editor';
import { STORAGE_KEY, STORAGE_VERSION } from '../../src/constants';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ms経過前は実行されない', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
  });

  it('ms経過後に最後の引数で1回だけ実行される', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('ms内の連続呼び出しはタイマーを再スタートし、最後の1回分だけ実行される(FR-1.2)', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(200);
    debounced('b');
    vi.advanceTimersByTime(200);
    // 最初の呼び出しから400ms経過しているが、2回目の呼び出しから200msしか経っていないため未発火。
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('cancel()で保留中の実行を取り消せる', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('複数回発火した場合、それぞれ独立して1回ずつ実行される', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(300);
    debounced('b');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
  });
});

describe('classifyKeyword', () => {
  it('ブロックキーワードをkeywordに分類する', () => {
    expect(classifyKeyword('C4Context')).toBe('keyword');
    expect(classifyKeyword('C4Container')).toBe('keyword');
    expect(classifyKeyword('C4Component')).toBe('keyword');
    expect(classifyKeyword('classDiagram')).toBe('keyword');
  });

  it('Boundary系キーワードをkeywordに分類する', () => {
    expect(classifyKeyword('System_Boundary')).toBe('keyword');
    expect(classifyKeyword('Container_Boundary')).toBe('keyword');
    expect(classifyKeyword('Enterprise_Boundary')).toBe('keyword');
  });

  it('Rel系(方向付き・BiRel含む)をkeywordに分類する', () => {
    expect(classifyKeyword('Rel')).toBe('keyword');
    expect(classifyKeyword('Rel_U')).toBe('keyword');
    expect(classifyKeyword('Rel_Down')).toBe('keyword');
    expect(classifyKeyword('BiRel')).toBe('keyword');
  });

  it('title/classをkeywordに分類する', () => {
    expect(classifyKeyword('title')).toBe('keyword');
    expect(classifyKeyword('class')).toBe('keyword');
  });

  it('Person/System/Container/Component基底語(Db/Queue/_Extの組合せ含む)をtypeNameに分類する', () => {
    expect(classifyKeyword('Person')).toBe('typeName');
    expect(classifyKeyword('Person_Ext')).toBe('typeName');
    expect(classifyKeyword('System')).toBe('typeName');
    expect(classifyKeyword('SystemDb')).toBe('typeName');
    expect(classifyKeyword('SystemDb_Ext')).toBe('typeName');
    expect(classifyKeyword('Container')).toBe('typeName');
    expect(classifyKeyword('ContainerQueue')).toBe('typeName');
    expect(classifyKeyword('ContainerQueue_Ext')).toBe('typeName');
    expect(classifyKeyword('Component')).toBe('typeName');
    expect(classifyKeyword('ComponentDb')).toBe('typeName');
  });

  it('未知の識別子(alias等)はnullを返す', () => {
    expect(classifyKeyword('customer')).toBeNull();
    expect(classifyKeyword('ibs')).toBeNull();
    expect(classifyKeyword('AccountService')).toBeNull();
    expect(classifyKeyword('SystemXyz')).toBeNull();
  });
});

/**
 * `window.localStorage`全体をvitest(environment: 'node')でモックする代わりに、
 * `loadPersistedSource`/`savePersistedSource`が要求する最小限のインターフェース
 * (`Pick<Storage, 'getItem'|'setItem'>`)だけを持つフェイクを使う(実装側の設計意図どおり)。
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

describe('loadPersistedSource / savePersistedSource (FR-1.4)', () => {
  it('未保存(キーが無い)場合はnullを返す', () => {
    const storage = createFakeStorage();
    expect(loadPersistedSource(storage)).toBeNull();
  });

  it('保存した値をそのまま復元できる', () => {
    const storage = createFakeStorage();
    savePersistedSource(storage, 'C4Context\n  title x\n');
    expect(loadPersistedSource(storage)).toBe('C4Context\n  title x\n');
  });

  it('JSON構文として壊れている場合はnullを返す(初期サンプルへのフォールバックを許す)', () => {
    const storage = createFakeStorage({ [STORAGE_KEY]: '{not valid json' });
    expect(loadPersistedSource(storage)).toBeNull();
  });

  it('形が期待どおりでない場合はnullを返す', () => {
    const storage = createFakeStorage({ [STORAGE_KEY]: JSON.stringify({ foo: 'bar' }) });
    expect(loadPersistedSource(storage)).toBeNull();
  });

  it('バージョン不一致の場合はnullを返す', () => {
    const storage = createFakeStorage({
      [STORAGE_KEY]: JSON.stringify({ v: STORAGE_VERSION + 1, source: 'x' }),
    });
    expect(loadPersistedSource(storage)).toBeNull();
  });

  it('getItemが例外を投げる場合はnullを返す(例: プライベートブラウジングでのアクセス拒否)', () => {
    const storage = {
      getItem(): string {
        throw new Error('access denied');
      },
    };
    expect(loadPersistedSource(storage)).toBeNull();
  });

  it('setItemが例外を投げても(容量超過等)呼び出し側に伝播しない', () => {
    const storage = {
      setItem(): void {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => {
      savePersistedSource(storage, 'x');
    }).not.toThrow();
  });

  it('空文字列も正当な復元値として扱う(全文削除して保存した状態)', () => {
    const storage = createFakeStorage();
    savePersistedSource(storage, '');
    expect(loadPersistedSource(storage)).toBe('');
  });
});
