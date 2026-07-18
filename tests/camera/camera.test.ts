import { describe, expect, it, vi } from 'vitest';
import { createCameraController } from '../../src/camera/camera';
import type { ExcalidrawCameraSnapshot, ExcalidrawHost } from '../../src/excal/host';

/**
 * `ExcalidrawHost` のモック。実DOM/実Excalidrawには依存せず、camera.tsが「hostのインター
 * フェースをどう使うか」だけをテストする(host.tsx自体のDOM/canvas依存部分はPlaywrightで検証)。
 */
function createMockHost(): {
  host: ExcalidrawHost;
  emitCamera: (snapshot: ExcalidrawCameraSnapshot) => void;
  /** fitToContentへの各呼び出しに対して、テスト側が結果スナップショットを注入するための関数群。 */
  resolveFit: (index: number, snapshot: ExcalidrawCameraSnapshot) => void;
  fitCallCount: () => number;
} {
  const cameraListeners = new Set<(snapshot: ExcalidrawCameraSnapshot) => void>();
  const fitCallbacks: Array<((snapshot: ExcalidrawCameraSnapshot) => void) | undefined> = [];

  const host: ExcalidrawHost = {
    updateElements: vi.fn(),
    unmount: vi.fn(),
    subscribeCamera(listener) {
      cameraListeners.add(listener);
      return () => {
        cameraListeners.delete(listener);
      };
    },
    fitToContent(onApplied) {
      fitCallbacks.push(onApplied);
    },
    // T3-2で追加されたメソッド(camera.tsは使わないため、このテストでは未使用)。
    getAnchorWorldPoint: () => null,
    applyLevelSwitch: vi.fn(),
  };

  return {
    host,
    emitCamera(snapshot) {
      for (const listener of cameraListeners) listener(snapshot);
    },
    resolveFit(index, snapshot) {
      fitCallbacks[index]?.(snapshot);
    },
    fitCallCount: () => fitCallbacks.length,
  };
}

describe('createCameraController', () => {
  it('初期状態はzoom=1・z0=null・scale=nullである', () => {
    const { host } = createMockHost();
    const camera = createCameraController(host);
    expect(camera.getState()).toEqual({ scrollX: 0, scrollY: 0, zoom: 1, z0: null, scale: null });
  });

  it('subscribeCamera経由のonChangeでzoom/scrollをミラーする(z0確定前はscaleがnull)', () => {
    const { host, emitCamera } = createMockHost();
    const camera = createCameraController(host);

    emitCamera({ scrollX: 12, scrollY: -34, zoom: 2.5 });

    expect(camera.getState()).toEqual({
      scrollX: 12,
      scrollY: -34,
      zoom: 2.5,
      z0: null,
      scale: null,
    });
  });

  it('fitAndEstablishZ0はfitToContentを呼び、その結果のzoomをz0として確定する(s=1になる)', () => {
    const { host, resolveFit, fitCallCount } = createMockHost();
    const camera = createCameraController(host);

    camera.fitAndEstablishZ0();
    expect(fitCallCount()).toBe(1);

    resolveFit(0, { scrollX: -100, scrollY: -50, zoom: 0.6 });

    expect(camera.getState()).toEqual({
      scrollX: -100,
      scrollY: -50,
      zoom: 0.6,
      z0: 0.6,
      scale: 1,
    });
  });

  it('z0確定後は通常のonChangeでs = zoom / z0が正しく算出される', () => {
    const { host, resolveFit, emitCamera } = createMockHost();
    const camera = createCameraController(host);

    camera.fitAndEstablishZ0();
    resolveFit(0, { scrollX: 0, scrollY: 0, zoom: 0.6 });

    emitCamera({ scrollX: 5, scrollY: 5, zoom: 0.9 });
    expect(camera.getState().scale).toBeCloseTo(1.5);

    emitCamera({ scrollX: 5, scrollY: 5, zoom: 1.8 });
    expect(camera.getState().scale).toBeCloseTo(3);
  });

  it('z0確定後にfitAndEstablishZ0を再度呼んでもfitToContentは呼ばれない(z0は再計算されない=リロード以外での安定性)', () => {
    const { host, resolveFit, fitCallCount } = createMockHost();
    const camera = createCameraController(host);

    camera.fitAndEstablishZ0();
    resolveFit(0, { scrollX: 0, scrollY: 0, zoom: 0.6 });
    expect(camera.getState().z0).toBe(0.6);

    camera.fitAndEstablishZ0();
    expect(fitCallCount()).toBe(1); // 2回目は呼ばれない

    expect(camera.getState().z0).toBe(0.6); // z0は不変のまま
  });

  it('fit()(Fitボタン)はfitToContentを呼ぶが、z0は変更しない', () => {
    const { host, resolveFit, emitCamera, fitCallCount } = createMockHost();
    const camera = createCameraController(host);

    camera.fitAndEstablishZ0();
    resolveFit(0, { scrollX: 0, scrollY: 0, zoom: 0.6 });
    expect(camera.getState().z0).toBe(0.6);

    // ユーザーがズーム操作した後にFitボタンを押すケース。
    emitCamera({ scrollX: 200, scrollY: 200, zoom: 2.4 });
    expect(camera.getState().scale).toBeCloseTo(4);

    camera.fit();
    expect(fitCallCount()).toBe(2);

    // fit()自身はonApplied相当のコールバックを渡さないので、Fit結果の反映は通常のonChange経由になる。
    emitCamera({ scrollX: 0, scrollY: 0, zoom: 0.6 });
    expect(camera.getState()).toEqual({ scrollX: 0, scrollY: 0, zoom: 0.6, z0: 0.6, scale: 1 });
  });

  it('subscribeは登録直後に現在値で1回呼ばれ、以後の変化でも呼ばれる。解除後は呼ばれない', () => {
    const { host, emitCamera } = createMockHost();
    const camera = createCameraController(host);
    const listener = vi.fn();

    const unsubscribe = camera.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(camera.getState());

    emitCamera({ scrollX: 1, scrollY: 1, zoom: 1.2 });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    emitCamera({ scrollX: 2, scrollY: 2, zoom: 1.3 });
    expect(listener).toHaveBeenCalledTimes(2); // 解除後は増えない
  });
});
