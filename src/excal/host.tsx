/**
 * ExcalidrawのReactマウント(設計書 docs/02_アーキテクチャ設計書.md §2)。
 *
 * CLAUDE.md/実装指示書§4のルールにより、react/react-dom のimportとJSXは本ファイルに閉じる。
 * 他モジュール(layout/, render/, model/等)はReactを一切importしない。ExcalidrawのAPI
 * (updateScene等)へのアクセスは将来的に `camera/camera.ts` 経由に一本化する予定だが
 * (T2-3以降)、T2-2時点では「初期要素をviewMode(閲覧専用)でマウントする」最小限のAPIのみ
 * 提供する(カメラのプログラム制御・onChange監視はT2-3のスコープ)。
 *
 * 実装パターンはT2-0bスパイク(spike-t2-0b/main.tsx、動作確認済み)を踏襲する。
 */

import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createRoot, type Root } from 'react-dom/client';

/** mountExcalidraw が返す、呼び出し側から見た最小限の操作口。 */
export interface ExcalidrawHost {
  /**
   * 表示要素を差し替える(T2-2時点ではelements差し替えのみ。カメラ同時適用によるアンカー保存は
   * T2-3で `camera/camera.ts` から呼ばれる形で拡張する想定)。ExcalidrawAPIがまだ初期化されて
   * いない(マウント直後で `excalidrawAPI` コールバック未発火)場合は何もしない。
   */
  updateElements(elements: readonly ExcalidrawElementSkeleton[]): void;
  /** Reactルートを破棄する(テスト・ページ遷移時の後始末用)。 */
  unmount(): void;
}

interface ApiBox {
  current: ExcalidrawImperativeAPI | null;
}

function HostApp(props: { initialElements: readonly ExcalidrawElementSkeleton[]; apiBox: ApiBox }) {
  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        props.apiBox.current = api;
      }}
      viewModeEnabled={true}
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
  const root: Root = createRoot(container);
  root.render(<HostApp initialElements={initialElements} apiBox={apiBox} />);

  return {
    updateElements(elements) {
      const api = apiBox.current;
      if (api === null) return;
      api.updateScene({ elements: convertToExcalidrawElements([...elements]) });
    },
    unmount() {
      root.unmount();
    },
  };
}
