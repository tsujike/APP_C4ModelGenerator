/**
 * カメラ監視・Fit・ズーム正規化(設計書 docs/02_アーキテクチャ設計書.md §8.1)。
 *
 * ExcalidrawのAPI(updateScene/scrollToContent/onChange等)への直接アクセスは `excal/host.tsx`
 * (React/JSXが閉じているファイル)に閉じており、本ファイルはその非React最小インターフェース
 * `ExcalidrawHost` 経由でのみ操作する。本ファイル自体はReact/JSXを一切importしない。
 *
 * T2-3のスコープはあくまで「監視・Fit・正規化」のみ。レベル判定(`nextLevel`、camera/lod.ts)・
 * レベル切替・アンカー保存(§8.3)はT3-1/T3-2で実装する(ここでは行わない)。
 */

import type { ExcalidrawCameraSnapshot, ExcalidrawHost } from '../excal/host';

/** camera.tsが保持・公開するカメラ状態(設計書§9 AppStateのcamera/z0/scale相当)。 */
export interface CameraState {
  scrollX: number;
  scrollY: number;
  /** appState.zoom.value(正規化前)。 */
  zoom: number;
  /**
   * ズーム正規化係数。§8.1: 起動時にL2レイアウトをFit表示した直後のzoom.valueで一度だけ確定し、
   * 以後(テキスト変更があっても)再計算しない。未確定の間はnull。
   */
  z0: number | null;
  /** 正規化ズーム値 s = zoom / z0。z0が未確定の間はnull。 */
  scale: number | null;
}

export type CameraListener = (state: CameraState) => void;

export interface CameraController {
  /** 現在のカメラ状態を同期的に取得する。 */
  getState(): CameraState;
  /**
   * 状態変化(Excalidraw上のズーム/パン操作、Fit、z0確定)を購読する。
   * 登録直後に現在値で1回呼ばれる(購読側が初期表示のために待つ必要をなくすため)。
   * 戻り値の関数で解除する。
   */
  subscribe(listener: CameraListener): () => void;
  /**
   * 起動直後に一度だけ呼ぶ: 現在のシーン(L2レイアウト)をFit表示し、その直後のzoom.valueを
   * z0として確定する。z0が既に確定済みなら何もしない(§8.1: 再計算しない=閾値の体感を安定させる)。
   */
  fitAndEstablishZ0(): void;
  /** Fitボタン(FR-4.3): 現在のシーンをビューポートに収める。z0には影響しない。 */
  fit(): void;
}

const INITIAL_STATE: CameraState = { scrollX: 0, scrollY: 0, zoom: 1, z0: null, scale: null };

/** snapshotとz0からCameraStateを組み立てる(s = zoom / z0、z0未確定ならscaleもnull)。 */
function toState(snapshot: ExcalidrawCameraSnapshot, z0: number | null): CameraState {
  return {
    scrollX: snapshot.scrollX,
    scrollY: snapshot.scrollY,
    zoom: snapshot.zoom,
    z0,
    scale: z0 === null ? null : snapshot.zoom / z0,
  };
}

/** `host` を介してExcalidrawのカメラを監視・制御する `CameraController` を作る。 */
export function createCameraController(host: ExcalidrawHost): CameraController {
  let state: CameraState = INITIAL_STATE;
  const listeners = new Set<CameraListener>();

  function setState(next: CameraState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }

  host.subscribeCamera((snapshot) => {
    setState(toState(snapshot, state.z0));
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
    fitAndEstablishZ0() {
      if (state.z0 !== null) return;
      host.fitToContent((snapshot) => {
        setState(toState(snapshot, snapshot.zoom));
      });
    },
    fit() {
      host.fitToContent();
    },
  };
}
