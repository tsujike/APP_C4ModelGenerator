import { describe, expect, it, vi } from 'vitest';
import {
  createFileWatcher,
  isFileLinkSupported,
  type WatchableFileHandle,
} from '../../src/ui/fileLink';

/**
 * `createFileWatcher`は`WatchableFileHandle`(構造的型)+テスト用の`schedule`/`isVisible`差し替え口
 * だけで完結する純粋なポーリングロジックのため、DOM・IndexedDB・File System Access APIを一切
 * 使わずにテストできる(vitestはnode環境。vitest.config.ts参照)。
 *
 * `schedule`のフェイクは実際の`setInterval`を使わず、`tick()`で手動発火できるものにする
 * (実時間に依存させず、非同期の`getFile().then(...)`チェーンの完了を`await Promise.resolve()`を
 * 複数回挟んで待つ)。
 */
function createFakeSchedule(): {
  schedule: (fn: () => void, ms: number) => { cancel(): void };
  tick: () => void;
  cancelCallCount: () => number;
} {
  let fn: (() => void) | null = null;
  let cancelCount = 0;
  return {
    schedule: (f) => {
      fn = f;
      return {
        cancel: () => {
          cancelCount += 1;
        },
      };
    },
    tick: () => {
      fn?.();
    },
    cancelCallCount: () => cancelCount,
  };
}

/** マイクロタスクキューを数ターン分flushする(`getFile().then(async file => ... await file.text() ...)`を待つ)。 */
async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

function createFakeHandle(
  getFileImpl: () => Promise<{ lastModified: number; size: number; text(): Promise<string> }>,
): WatchableFileHandle {
  return {
    name: 'fake.txt',
    getFile: getFileImpl,
  };
}

describe('createFileWatcher', () => {
  it('変化が無ければonChangeは呼ばれない', async () => {
    const onChange = vi.fn();
    const onLost = vi.fn();
    const { schedule, tick } = createFakeSchedule();
    const handle = createFakeHandle(() =>
      Promise.resolve({ lastModified: 100, size: 10, text: () => Promise.resolve('same') }),
    );

    createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost,
      schedule,
      isVisible: () => true,
    });

    tick();
    await flushMicrotasks();

    expect(onChange).not.toHaveBeenCalled();
    expect(onLost).not.toHaveBeenCalled();
  });

  it('lastModifiedが変われば新しいテキストでonChangeが呼ばれる', async () => {
    const onChange = vi.fn();
    const { schedule, tick } = createFakeSchedule();
    const handle = createFakeHandle(() =>
      Promise.resolve({ lastModified: 200, size: 10, text: () => Promise.resolve('updated') }),
    );

    createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost: vi.fn(),
      schedule,
      isVisible: () => true,
    });

    tick();
    await flushMicrotasks();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('updated');
  });

  it('lastModifiedは同じでsizeだけ変わってもonChangeが呼ばれる', async () => {
    const onChange = vi.fn();
    const { schedule, tick } = createFakeSchedule();
    const handle = createFakeHandle(() =>
      Promise.resolve({ lastModified: 100, size: 99, text: () => Promise.resolve('resized') }),
    );

    createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost: vi.fn(),
      schedule,
      isVisible: () => true,
    });

    tick();
    await flushMicrotasks();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('resized');
  });

  it('isVisible()がfalseの間はgetFile()が呼ばれない', async () => {
    const getFile = vi.fn(() =>
      Promise.resolve({ lastModified: 200, size: 10, text: () => Promise.resolve('x') }),
    );
    const onChange = vi.fn();
    const { schedule, tick } = createFakeSchedule();
    const handle: WatchableFileHandle = { name: 'fake.txt', getFile };

    createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost: vi.fn(),
      schedule,
      isVisible: () => false,
    });

    tick();
    tick();
    await flushMicrotasks();

    expect(getFile).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('getFile()がrejectしたらonLostが1回だけ呼ばれ、以後ポーリングしない', async () => {
    const getFile = vi.fn(() => Promise.reject(new Error('NotFoundError')));
    const onLost = vi.fn();
    const onChange = vi.fn();
    const { schedule, tick } = createFakeSchedule();
    const handle: WatchableFileHandle = { name: 'fake.txt', getFile };

    createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost,
      schedule,
      isVisible: () => true,
    });

    tick();
    await flushMicrotasks();
    tick();
    tick();
    await flushMicrotasks();

    expect(onLost).toHaveBeenCalledTimes(1);
    expect(getFile).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stop()後はコールバックが呼ばれない(in-flightの解決後も)', async () => {
    let resolveGetFile:
      ((file: { lastModified: number; size: number; text(): Promise<string> }) => void) | undefined;
    const getFile = vi.fn(
      () =>
        new Promise<{ lastModified: number; size: number; text(): Promise<string> }>((resolve) => {
          resolveGetFile = resolve;
        }),
    );
    const onChange = vi.fn();
    const onLost = vi.fn();
    const { schedule, tick } = createFakeSchedule();
    const handle: WatchableFileHandle = { name: 'fake.txt', getFile };

    const watcher = createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost,
      schedule,
      isVisible: () => true,
    });

    tick(); // getFile()を発火させ、in-flightのPromiseを作る
    watcher.stop();
    resolveGetFile?.({ lastModified: 999, size: 999, text: () => Promise.resolve('late') });
    await flushMicrotasks();

    expect(onChange).not.toHaveBeenCalled();
    expect(onLost).not.toHaveBeenCalled();
  });

  it('stop()は冪等(複数回呼んでも安全)', () => {
    const { schedule } = createFakeSchedule();
    const handle = createFakeHandle(() =>
      Promise.resolve({ lastModified: 100, size: 10, text: () => Promise.resolve('x') }),
    );

    const watcher = createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange: vi.fn(),
      onLost: vi.fn(),
      schedule,
      isVisible: () => true,
    });

    expect(() => {
      watcher.stop();
      watcher.stop();
    }).not.toThrow();
  });

  it('onChangeが例外を投げても次のポーリングは走る', async () => {
    let call = 0;
    const onChange = vi.fn(() => {
      throw new Error('boom');
    });
    const { schedule, tick } = createFakeSchedule();
    const handle = createFakeHandle(() => {
      call += 1;
      return Promise.resolve({
        lastModified: 100 + call,
        size: 10,
        text: () => Promise.resolve(`text-${String(call)}`),
      });
    });

    createFileWatcher(handle, {
      intervalMs: 1000,
      initialLastModified: 100,
      initialSize: 10,
      onChange,
      onLost: vi.fn(),
      schedule,
      isVisible: () => true,
    });

    tick();
    await flushMicrotasks();
    expect(onChange).toHaveBeenCalledTimes(1);

    tick();
    await flushMicrotasks();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(2, 'text-2');
  });
});

describe('isFileLinkSupported', () => {
  it('windowにshowOpenFilePickerが無い場合はfalse', () => {
    expect(isFileLinkSupported()).toBe(false);
  });

  it('windowにshowOpenFilePickerが関数として存在する場合はtrue', () => {
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window: { showOpenFilePicker: () => void } }).window = {
      showOpenFilePicker: () => {
        /* テスト用スタブ */
      },
    };
    try {
      expect(isFileLinkSupported()).toBe(true);
    } finally {
      if (original === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = original;
      }
    }
  });
});
