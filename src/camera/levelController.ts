/**
 * レベル切替オーケストレーション(設計書 docs/02_アーキテクチャ設計書.md §8.3、§9のlevel/levelLock相当)。
 *
 * 申し送り(T3-2の設計判断): 設計書§9はAppState全体(source/model/issues/layouts/camera/z0/scale/
 * level/levelLock)を1つの `state.ts` にまとめる案を示しているが、T2-3時点でmodel/issues/layouts
 * (エディタ・パーサ連携、T4スコープ)はまだ存在せず、それらを含む汎用 `state.ts` を今作るのは
 * 先回りの抽象化になる。T2-3が確立した「1関心事=1コントローラ」パターン(`camera/camera.ts`の
 * `CameraController`が`CameraState`を自己完結して持つ)をそのまま踏襲し、`level`/`levelLock`は
 * この`LevelController`が自己完結して持つ。ExcalidrawのAPIには直接触れず、`ExcalidrawHost`
 * (excal/host.tsx)経由でのみ操作する(実装指示書§4「Excalidraw APIへのアクセスはcamera/camera.ts
 * 経由に一本化する」の精神を、camera/配下の兄弟モジュールにも適用)。
 *
 * React/JSXは一切importしない。
 */

import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawHost } from '../excal/host';
import type { LayoutResult } from '../layout/types';
import type { C4Model, Level } from '../model/types';
import { computeAnchorPreservingScroll } from './anchor';
import type { CameraController } from './camera';
import { nextLevel } from './lod';

/** レベル1つ分の事前計算済みデータ(§3データフロー: レベル別レイアウトは遅延/事前生成しキャッシュ)。 */
export interface LevelData {
  layout: LayoutResult;
  elements: readonly ExcalidrawElementSkeleton[];
}

export interface LevelControllerState {
  level: Level;
  /** null = AUTO。Level値なら手動固定中のレベル(FR-5.5)。 */
  levelLock: Level | null;
}

export type LevelControllerListener = (state: LevelControllerState) => void;

export interface LevelController {
  /** 現在のレベル/固定状態を同期的に取得する。 */
  getState(): LevelControllerState;
  /** 登録直後に現在値で1回呼ばれ、以後の変化でも呼ばれる(camera.tsのsubscribeと同じ規約)。 */
  subscribe(listener: LevelControllerListener): () => void;
  /** 手動固定(FR-5.5): 指定レベルへ即座に切り替え、以後AUTO判定をバイパスする。 */
  lockTo(level: Level): void;
  /** AUTOモードに戻す(FR-5.5)。現在のズーム値に基づき、必要ならその場で再判定・切替する。 */
  setAuto(): void;
}

/**
 * `levelData` は1〜4の全レベル分が揃っている前提(main.tsが起動時に一括計算する。設計書§3の
 * 「レベル別レイアウトは遅延生成でよい」に対し、本実装ではサンプル規模が小さいため単純さを
 * 優先し起動時に4レベル全て計算する、とPROGRESS.mdに申し送り予定)。
 */
export function createLevelController(
  host: ExcalidrawHost,
  camera: CameraController,
  model: C4Model,
  levelData: ReadonlyMap<Level, LevelData>,
  initialLevel: Level,
): LevelController {
  let state: LevelControllerState = { level: initialLevel, levelLock: null };
  const listeners = new Set<LevelControllerListener>();

  function setState(next: LevelControllerState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }

  /**
   * 設計書§8.3手順1〜3: アンカー保存付きで、現在レベルから`target`へ実際に要素+カメラを
   * updateSceneで切り替える(host呼び出しのみ。state更新は呼び出し側がまとめて行う。
   * 呼び出し側でlevel/levelLockを1回のsetStateにまとめ、subscribeリスナーへの通知が
   * 操作1回につき1回になるようにするため)。手動固定/AUTO自動判定のどちらから呼ばれても
   * 同じ手順を適用する(仕様上、切替のトリガーの違いでアンカー保存の適用有無を分ける記述は
   * 無いため。申し送り)。`target === state.level` の場合は何もしない。
   */
  function applySwitchElements(target: Level): void {
    if (target === state.level) return;
    const oldData = levelData.get(state.level);
    const newData = levelData.get(target);
    // levelDataは1〜4全て事前計算済み(呼び出し前提)のため、到達しない分岐。
    if (oldData === undefined || newData === undefined) return;

    const anchorPoint = host.getAnchorWorldPoint();
    const camState = camera.getState();
    const scroll =
      anchorPoint === null
        ? undefined
        : computeAnchorPreservingScroll(
            oldData.layout,
            anchorPoint,
            { x: camState.scrollX, y: camState.scrollY },
            newData.layout,
            model.byAlias,
          );

    // §8.3手順3・4: 要素とカメラ補正を1回のupdateSceneで同時適用する(中間状態を見せない)。
    const scrollForHost =
      scroll !== undefined ? { scrollX: scroll.x, scrollY: scroll.y } : undefined;
    host.applyLevelSwitch(newData.elements, scrollForHost);
  }

  // AUTOモード: ズーム値(正規化s)の変化を監視し、固定中でなければnextLevelの結果へ切り替える。
  camera.subscribe((camState) => {
    if (state.levelLock !== null) return;
    if (camState.scale === null) return;
    const target = nextLevel(state.level, camState.scale);
    if (target === state.level) return;
    applySwitchElements(target);
    setState({ ...state, level: target });
  });

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    lockTo(level) {
      applySwitchElements(level);
      setState({ level, levelLock: level });
    },
    setAuto() {
      // AUTOに戻した瞬間、現在のズーム値がすでに現在レベルと乖離していれば即座に反映する
      // (固定中にズーム操作されていた場合、ボタンを押すまで反映を待たせないための解釈。申し送り)。
      const camState = camera.getState();
      const target = camState.scale === null ? state.level : nextLevel(state.level, camState.scale);
      if (target !== state.level) applySwitchElements(target);
      setState({ level: target, levelLock: null });
    },
  };
}
