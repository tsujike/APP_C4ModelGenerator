import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import { describe, expect, it, vi } from 'vitest';
import type { CameraController, CameraListener, CameraState } from '../../src/camera/camera';
import { createLevelController } from '../../src/camera/levelController';
import type { LevelData } from '../../src/camera/levelController';
import type { ExcalidrawHost, WorldPoint } from '../../src/excal/host';
import type { LayoutNode, LayoutResult } from '../../src/layout/types';
import type { C4Model, C4Node, Level } from '../../src/model/types';

/** `CameraController` のモック。scale/scrollを外から自由に発火できるようにする。 */
function createMockCamera(initial: CameraState): {
  camera: CameraController;
  emit: (state: CameraState) => void;
} {
  let current = initial;
  const listeners = new Set<CameraListener>();
  const camera: CameraController = {
    getState: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
    fitAndEstablishZ0: () => {
      // このテストでは未使用。
    },
    fit: () => {
      // このテストでは未使用。
    },
  };
  return {
    camera,
    emit(next) {
      current = next;
      for (const listener of listeners) listener(current);
    },
  };
}

/** `ExcalidrawHost` のモック。applyLevelSwitch/updateElementsの呼び出し内容を記録する。 */
function createMockHost(anchorPoint: WorldPoint | null): {
  host: ExcalidrawHost;
  applyCalls: Array<{
    elements: readonly ExcalidrawElementSkeleton[];
    scroll?: { scrollX: number; scrollY: number };
  }>;
  updateElementsCalls: Array<readonly ExcalidrawElementSkeleton[]>;
} {
  const applyCalls: Array<{
    elements: readonly ExcalidrawElementSkeleton[];
    scroll?: { scrollX: number; scrollY: number };
  }> = [];
  const updateElementsCalls: Array<readonly ExcalidrawElementSkeleton[]> = [];
  const host: ExcalidrawHost = {
    updateElements(elements) {
      updateElementsCalls.push(elements);
    },
    unmount: vi.fn(),
    subscribeCamera: () => () => {
      // 未使用。
    },
    fitToContent: () => {
      // 未使用。
    },
    getAnchorWorldPoint: () => anchorPoint,
    applyLevelSwitch(elements, scroll) {
      applyCalls.push({ elements, ...(scroll !== undefined ? { scroll } : {}) });
    },
  };
  return { host, applyCalls, updateElementsCalls };
}

function layoutNode(id: string, x: number, y: number, w: number, h: number): LayoutNode {
  return {
    id,
    kind: 'container',
    variant: 'default',
    external: false,
    label: id,
    x,
    y,
    width: w,
    height: h,
    isBoundary: false,
  };
}

function elementsFor(level: Level): ExcalidrawElementSkeleton[] {
  return [{ id: `L${String(level)}:marker`, type: 'rectangle', x: 0, y: 0, width: 1, height: 1 }];
}

/** L2に"api"が葉(100x100)、L3に"api"が境界枠へ展開(300x300)された最小構成のlevelData。 */
function createLevelData(): { levelData: Map<Level, LevelData>; model: C4Model } {
  const api: C4Node = {
    alias: 'api',
    label: 'API',
    kind: 'container',
    variant: 'default',
    external: false,
    level: 2,
    children: [],
    sourceLine: 1,
  };
  const byAlias = new Map<string, C4Node>([['api', api]]);
  const model: C4Model = { roots: [api], byAlias, edges: [] };

  const l2Layout: LayoutResult = {
    level: 2,
    nodes: [layoutNode('api', 0, 0, 100, 100)],
    edges: [],
    width: 100,
    height: 100,
  };
  const l3Layout: LayoutResult = {
    level: 3,
    nodes: [layoutNode('api', 0, 0, 300, 300)],
    edges: [],
    width: 300,
    height: 300,
  };
  const l1Layout: LayoutResult = { level: 1, nodes: [], edges: [], width: 10, height: 10 };
  const l4Layout: LayoutResult = { level: 4, nodes: [], edges: [], width: 10, height: 10 };

  const levelData = new Map<Level, LevelData>([
    [1, { layout: l1Layout, elements: elementsFor(1) }],
    [2, { layout: l2Layout, elements: elementsFor(2) }],
    [3, { layout: l3Layout, elements: elementsFor(3) }],
    [4, { layout: l4Layout, elements: elementsFor(4) }],
  ]);
  return { levelData, model };
}

describe('createLevelController: AUTOモード(FR-5.1/5.2)', () => {
  it('scaleがしきい値を跨ぐとnextLevelどおりに切り替わり、host.applyLevelSwitchが呼ばれる', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost({ x: 50, y: 50 }); // apiの中心
    const { camera, emit } = createMockCamera({
      scrollX: 0,
      scrollY: 0,
      zoom: 0.6,
      z0: 0.6,
      scale: 1,
    });

    const controller = createLevelController(host, camera, model, levelData, 2);
    expect(controller.getState()).toEqual({ level: 2, levelLock: null });

    // s=1.6 → L2→L3(閾値1.5)。
    emit({ scrollX: 0, scrollY: 0, zoom: 0.96, z0: 0.6, scale: 1.6 });

    expect(controller.getState().level).toBe(3);
    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]?.elements).toEqual(elementsFor(3));
    // apiの中心が旧(50,50)→新(150,150)に動くため、scroll補正が入る。
    expect(applyCalls[0]?.scroll).toEqual({ scrollX: 0 + (50 - 150), scrollY: 0 + (50 - 150) });
  });

  it('scaleが同一レベル範囲内で変化しても切り替わらない', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost({ x: 50, y: 50 });
    const { camera, emit } = createMockCamera({
      scrollX: 0,
      scrollY: 0,
      zoom: 0.6,
      z0: 0.6,
      scale: 1,
    });

    const controller = createLevelController(host, camera, model, levelData, 2);
    emit({ scrollX: 0, scrollY: 0, zoom: 0.72, z0: 0.6, scale: 1.2 }); // まだL2範囲(0.75<=s<1.5)

    expect(controller.getState().level).toBe(2);
    expect(applyCalls).toHaveLength(0);
  });

  it('アンカー点が特定できない場合はscrollX/scrollYを渡さず要素だけ差し替える', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost(null); // ポインタ未取得・シーン未確定
    const { camera, emit } = createMockCamera({
      scrollX: 0,
      scrollY: 0,
      zoom: 0.6,
      z0: 0.6,
      scale: 1,
    });

    createLevelController(host, camera, model, levelData, 2);
    emit({ scrollX: 0, scrollY: 0, zoom: 0.96, z0: 0.6, scale: 1.6 });

    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]?.scroll).toBeUndefined();
  });
});

describe('createLevelController: 手動固定(FR-5.5)', () => {
  it('lockToで即座に切り替わり、以後AUTOのscale変化では切り替わらない', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost({ x: 50, y: 50 });
    const { camera, emit } = createMockCamera({
      scrollX: 0,
      scrollY: 0,
      zoom: 0.6,
      z0: 0.6,
      scale: 1,
    });

    const controller = createLevelController(host, camera, model, levelData, 2);
    controller.lockTo(4);

    expect(controller.getState()).toEqual({ level: 4, levelLock: 4 });
    expect(applyCalls).toHaveLength(1);

    // 固定中にscaleがL1相当まで下がっても切り替わらない。
    emit({ scrollX: 0, scrollY: 0, zoom: 0.1, z0: 0.6, scale: 0.1 });
    expect(controller.getState().level).toBe(4);
    expect(applyCalls).toHaveLength(1);
  });

  it('setAutoでAUTOに戻り、現在のscaleに応じて即座に再判定される', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost({ x: 50, y: 50 });
    const { camera, emit } = createMockCamera({
      scrollX: 0,
      scrollY: 0,
      zoom: 0.6,
      z0: 0.6,
      scale: 1,
    });

    const controller = createLevelController(host, camera, model, levelData, 2);
    controller.lockTo(4);
    // 固定中にscaleがL1相当まで下がる(切り替わらないことは上のテストで確認済み)。
    emit({ scrollX: 0, scrollY: 0, zoom: 0.1, z0: 0.6, scale: 0.1 });
    applyCalls.length = 0;

    controller.setAuto();

    expect(controller.getState()).toEqual({ level: 1, levelLock: null });
    expect(applyCalls).toHaveLength(1);
  });

  it('同じレベルへのlockToはapplyLevelSwitchを呼ばないが、levelLockは更新される', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost({ x: 50, y: 50 });
    const { camera } = createMockCamera({ scrollX: 0, scrollY: 0, zoom: 0.6, z0: 0.6, scale: 1 });

    const controller = createLevelController(host, camera, model, levelData, 2);
    controller.lockTo(2);

    expect(controller.getState()).toEqual({ level: 2, levelLock: 2 });
    expect(applyCalls).toHaveLength(0);
  });
});

describe('createLevelController: subscribe', () => {
  it('登録直後に現在値で1回呼ばれ、切替のたびに呼ばれる', () => {
    const { levelData, model } = createLevelData();
    const { host } = createMockHost({ x: 50, y: 50 });
    const { camera } = createMockCamera({ scrollX: 0, scrollY: 0, zoom: 0.6, z0: 0.6, scale: 1 });

    const controller = createLevelController(host, camera, model, levelData, 2);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({ level: 2, levelLock: null });

    controller.lockTo(3);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    controller.lockTo(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('createLevelController: updateModel(T4-1 ライブ編集)', () => {
  it('現在レベルの新しい要素をhost.updateElementsで反映し、applyLevelSwitch/カメラには触れない', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls, updateElementsCalls } = createMockHost({ x: 50, y: 50 });
    const { camera } = createMockCamera({ scrollX: 0, scrollY: 0, zoom: 0.6, z0: 0.6, scale: 1 });

    const controller = createLevelController(host, camera, model, levelData, 2);

    const newLevelData = new Map<Level, LevelData>(levelData);
    const newL2Elements: ExcalidrawElementSkeleton[] = [
      { id: 'edited', type: 'rectangle', x: 0, y: 0, width: 1, height: 1 },
    ];
    newLevelData.set(2, { layout: levelData.get(2)!.layout, elements: newL2Elements });

    controller.updateModel(model, newLevelData);

    expect(updateElementsCalls).toHaveLength(1);
    expect(updateElementsCalls[0]).toEqual(newL2Elements);
    // レベル/固定状態やapplyLevelSwitch(アンカー保存経路)は一切呼ばれない(FR-1.3: カメラ維持)。
    expect(applyCalls).toHaveLength(0);
    expect(controller.getState()).toEqual({ level: 2, levelLock: null });
  });

  it('古いlevelDataを再利用せず、以後のレベル切替でも新しいlevelDataだけが使われる(レイアウトキャッシュ破棄)', () => {
    const { levelData, model } = createLevelData();
    const { host, applyCalls } = createMockHost({ x: 50, y: 50 });
    const { camera } = createMockCamera({ scrollX: 0, scrollY: 0, zoom: 0.6, z0: 0.6, scale: 1 });

    const controller = createLevelController(host, camera, model, levelData, 2);

    const newLevelData = new Map<Level, LevelData>(levelData);
    const newL3Elements: ExcalidrawElementSkeleton[] = [
      { id: 'edited-l3', type: 'rectangle', x: 0, y: 0, width: 1, height: 1 },
    ];
    newLevelData.set(3, { layout: levelData.get(3)!.layout, elements: newL3Elements });
    controller.updateModel(model, newLevelData);

    controller.lockTo(3);

    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]?.elements).toEqual(newL3Elements);
  });
});
