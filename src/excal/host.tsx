/**
 * ExcalidrawのReactマウント(設計書 docs/02_アーキテクチャ設計書.md §2)。
 *
 * CLAUDE.md/実装指示書§4のルールにより、react/react-dom のimportとJSXは本ファイルに閉じる。
 * 他モジュール(layout/, render/, model/等)はReactを一切importしない。ExcalidrawのAPI
 * (updateScene/scrollToContent/onChange等)へのアクセスは `camera/camera.ts` 経由に一本化する
 * (実装指示書§4)。本ファイルはExcalidraw APIの薄い翻訳層のみを提供し、z0確定・正規化ズーム(s)
 * ・監視状態の解釈は一切行わない(camera/camera.tsの責務。T2-3スコープ)。
 *
 * 実装パターンはT2-0bスパイク(spike-t2-0b/main.tsx、動作確認済み)を踏襲する。
 */

import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createRoot, type Root } from 'react-dom/client';

/** Excalidrawのカメラ状態のうち、camera.tsが監視する3値のみを抜き出したスナップショット。 */
export interface ExcalidrawCameraSnapshot {
  scrollX: number;
  scrollY: number;
  /** appState.zoom.value(正規化前の生のズーム倍率)。 */
  zoom: number;
}

/** mountExcalidraw が返す、呼び出し側から見た最小限の操作口。 */
export interface ExcalidrawHost {
  /**
   * 表示要素を差し替える(T2-2時点ではelements差し替えのみ。カメラ同時適用によるアンカー保存は
   * T3-2で拡張する想定)。ExcalidrawAPIがまだ初期化されていない(マウント直後で
   * `excalidrawAPI` コールバック未発火)場合は何もしない。
   */
  updateElements(elements: readonly ExcalidrawElementSkeleton[]): void;
  /** Reactルートを破棄する(テスト・ページ遷移時の後始末用)。 */
  unmount(): void;
  /**
   * ExcalidrawのonChangeで得られるzoom/scrollの変化を購読する(設計書§8.1「onChangeで監視」)。
   * ExcalidrawAPIの初期化タイミングに関わらずいつでも呼べる(登録のみで、実際のイベント発火は
   * Excalidrawのマウント完了後になる)。戻り値の関数で解除する。
   */
  subscribeCamera(listener: (camera: ExcalidrawCameraSnapshot) => void): () => void;
  /**
   * 現在のシーン全体をビューポートに収める(設計書§8.1: `scrollToContent(..., { fitToViewport: true })`)。
   * Fitボタン、および起動直後のz0確定の両方で使う。
   *
   * 実行タイミングは「ExcalidrawAPIが初期化済み」だけでなく「シーンに初期要素が反映され、
   * ビューポート寸法が確定した後(=最初のonChangeが発火した後)」まで遅延する。
   * 実機検証で判明: `excalidrawAPI` コールバック発火直後はまだ内部シーンが空
   * (`getSceneElements().length === 0`)かつ `appState.width/height` がコンテナの最終寸法
   * (CSS Gridレイアウト確定後の値)ではなく仮の値であり、この時点でFitすると
   * 「収める対象が無い」に近い状態でズームが変化せず、z0が不安定になる
   * (実測: 早すぎるFitはzoom=1.0で確定してしまい、シーン確定後の正しいFit結果と食い違う)。
   * 実測では最初のonChangeで既にシーン・寸法とも確定済みだったため、それを待てば十分。
   *
   * `onApplied` を渡すと、この呼び出しによって確定した直後のカメラ値を1回だけ受け取れる
   * (z0確定のように「このFit呼び出し自身の結果」を他のonChangeノイズと混同せず取得したい場合に使う)。
   */
  fitToContent(onApplied?: (camera: ExcalidrawCameraSnapshot) => void): void;
}

interface ApiBox {
  current: ExcalidrawImperativeAPI | null;
}

function toCameraSnapshot(appState: {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
}): ExcalidrawCameraSnapshot {
  return { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom.value };
}

function HostApp(props: {
  initialElements: readonly ExcalidrawElementSkeleton[];
  apiBox: ApiBox;
  onApiReady: () => void;
  onSceneChange: (camera: ExcalidrawCameraSnapshot) => void;
}) {
  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        props.apiBox.current = api;
        props.onApiReady();
      }}
      viewModeEnabled={true}
      onChange={(_elements, appState) => {
        props.onSceneChange(toCameraSnapshot(appState));
      }}
      initialData={{
        elements: convertToExcalidrawElements([...props.initialElements]),
        appState: { viewModeEnabled: true },
      }}
    />
  );
}

/**
 * `container` に閲覧専用(viewModeEnabled)のExcalidrawをマウントし、`initialElements` を
 * 初期表示する。設計書§8.1「図の編集を防ぐため viewModeEnabled: true で運用する」を満たす。
 */
export function mountExcalidraw(
  container: HTMLElement,
  initialElements: readonly ExcalidrawElementSkeleton[],
): ExcalidrawHost {
  const apiBox: ApiBox = { current: null };
  const readyQueue: Array<(api: ExcalidrawImperativeAPI) => void> = [];
  const cameraListeners = new Set<(camera: ExcalidrawCameraSnapshot) => void>();
  // 最初のonChangeが発火する=シーンに初期要素が反映され、ビューポート寸法が確定した合図
  // (host.tsxのExcalidrawHost.fitToContentのコメント参照)。
  let sceneReady = false;

  function tryFlushReadyQueue(): void {
    const api = apiBox.current;
    if (api === null || !sceneReady) return;
    const queued = readyQueue.splice(0);
    for (const fn of queued) fn(api);
  }

  /** APIが初期化済み、かつシーンが確定済み(最初のonChange発火後)になるまで`fn`の実行を遅延する。 */
  function runWhenSceneReady(fn: (api: ExcalidrawImperativeAPI) => void): void {
    const api = apiBox.current;
    if (api !== null && sceneReady) {
      fn(api);
      return;
    }
    readyQueue.push(fn);
  }

  const root: Root = createRoot(container);
  root.render(
    <HostApp
      initialElements={initialElements}
      apiBox={apiBox}
      onApiReady={() => {
        tryFlushReadyQueue();
      }}
      onSceneChange={(camera) => {
        if (!sceneReady) {
          sceneReady = true;
          tryFlushReadyQueue();
        }
        for (const listener of cameraListeners) listener(camera);
      }}
    />,
  );

  return {
    updateElements(elements) {
      const api = apiBox.current;
      if (api === null) return;
      api.updateScene({ elements: convertToExcalidrawElements([...elements]) });
    },
    unmount() {
      root.unmount();
    },
    subscribeCamera(listener) {
      cameraListeners.add(listener);
      return () => {
        cameraListeners.delete(listener);
      };
    },
    fitToContent(onApplied) {
      runWhenSceneReady((api) => {
        if (onApplied !== undefined) {
          // このscrollToContent呼び出し自身がもたらす直後のonChangeだけを1回だけ拾う
          // (subscribeCameraの永続リスナーとは別系統。api.onChangeは1回発火ごとに手動で
          // 解除する必要がある一時購読)。
          const unsubscribe = api.onChange((_elements, appState) => {
            unsubscribe();
            onApplied(toCameraSnapshot(appState));
          });
        }
        api.scrollToContent(api.getSceneElements(), { fitToViewport: true, animate: false });
      });
    },
  };
}
