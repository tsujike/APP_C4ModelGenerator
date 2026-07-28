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

import {
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createRoot, type Root } from 'react-dom/client';
import { EXPORT } from '../constants';

/**
 * `exportToSvg`/`exportToBlob`の型付け不備への対応(申し送り): これら2つの値は
 * `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/index.d.ts` で
 * `export { exportToBlob, exportToSvg, ... } from "@excalidraw/utils/export";` として
 * 再エクスポートされているが、`@excalidraw/utils` は本プロジェクトに存在しない別パッケージ
 * (`node_modules/@excalidraw/`配下を確認したが `utils` は無い)であり、型解決に失敗して
 * 事実上 `any` になる(`tsc --noEmit`は`skipLibCheck: true`により無言で通すが、
 * `npm run lint`の`@typescript-eslint/no-unsafe-*`が検出する)。実装指示書§4
 * 「`any`禁止(外部ライブラリ境界での`unknown`→絞り込みは可)」の方針に沿い、実際の
 * シグネチャ(`node_modules/@excalidraw/excalidraw/dist/types/utils/export.d.ts`の
 * `ExportOpts`/`exportToSvg`/`exportToBlob`宣言で確認済み。パッケージ自体のバグであり
 * バージョン固定(実装指示書§4)のためexcalidraw側の更新では直さない)を手動で型付けし直す。
 */
interface ExportOpts {
  elements: ReturnType<typeof convertToExcalidrawElements>;
  appState: { exportBackground: boolean; viewBackgroundColor: string };
  /**
   * 実際のExcalidrawの宣言は `BinaryFiles | null`。C4モードでは常にnullだが、Mermaidモードの
   * 画像フォールバック(`excal/mermaid.ts`)ではimage要素が`fileId`で参照するバイナリを
   * ここに渡さないと、書き出したSVG/PNGから図が丸ごと欠ける。
   */
  files: BinaryFiles | null;
}
const typedExportToSvg = exportToSvg as (opts: ExportOpts) => Promise<SVGSVGElement>;
const typedExportToBlob = exportToBlob as (
  opts: ExportOpts & {
    mimeType: string;
    getDimensions: (
      width: number,
      height: number,
    ) => { width: number; height: number; scale: number };
  },
) => Promise<Blob>;

/** Excalidrawのカメラ状態のうち、camera.tsが監視する3値のみを抜き出したスナップショット。 */
export interface ExcalidrawCameraSnapshot {
  scrollX: number;
  scrollY: number;
  /** appState.zoom.value(正規化前の生のズーム倍率)。 */
  zoom: number;
}

/**
 * §8.3手順1「無ければビューポート中心」のフォールバック計算に必要な、appStateのうち
 * ビューポート寸法を含む値。`ExcalidrawCameraSnapshot`(camera.tsの公開契約、既存テストが
 * 厳密一致で検証済み)には含めず、host.tsx内部でのみ保持する。
 */
interface ViewportSnapshot {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** ワールド座標の1点(Excalidrawの規約 `screen = (world + scroll) × zoom` における world側)。 */
export interface WorldPoint {
  x: number;
  y: number;
}

/** mountExcalidraw が返す、呼び出し側から見た最小限の操作口。 */
export interface ExcalidrawHost {
  /**
   * 表示要素を差し替える(T2-2時点ではelements差し替えのみ。カメラ同時適用によるアンカー保存は
   * T3-2で拡張する想定)。ExcalidrawAPIがまだ初期化されていない(マウント直後で
   * `excalidrawAPI` コールバック未発火)場合は何もしない。
   */
  updateElements(elements: readonly ExcalidrawElementSkeleton[], files?: BinaryFiles): void;
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
  /**
   * 設計書§8.3手順1「切替直前、アンカー画面座標p(直近のポインタ位置。無ければビューポート中心)」の
   * ワールド座標版を返す(Excalidrawの `onPointerUpdate` は既にワールド座標=シーン座標で値をくれる
   * ため、ここでは`screen→world`変換を自前で行う必要はない。ポインタが一度も動いていない場合のみ、
   * 直近のappState(width/height/scrollX/scrollY/zoom)からビューポート中心のワールド座標を
   * `world = screen/zoom - scroll` で算出する)。シーンがまだ確定していない(最初のonChange未発火)
   * などでどちらも得られない場合は null(呼び出し側はアンカー補正なしで要素だけ差し替える)。
   */
  getAnchorWorldPoint(): WorldPoint | null;
  /**
   * 設計書§8.3手順3: 新レベルの要素と、アンカー保存のためのscroll補正を1回のupdateSceneで
   * 同時適用する(要素だけ先に変わってカメラが古いままになる中間状態を見せないため)。
   * zoomは指定しない(切替前後で維持する。updateSceneのappStateは指定したキーだけを
   * 部分更新するため、zoomキーを渡さなければ現在のzoomがそのまま保たれる)。
   * `scroll`が未指定(アンカーノードが特定できなかった等)の場合は要素だけを差し替える。
   */
  applyLevelSwitch(
    elements: readonly ExcalidrawElementSkeleton[],
    scroll?: { scrollX: number; scrollY: number },
    files?: BinaryFiles,
  ): void;
  /**
   * T5-1(FR-6.1、受入基準5): `elements`(呼び出し側が渡す、対象レベルの全要素)をSVG文字列として
   * 書き出す。`exportToSvg`/`convertToExcalidrawElements`は`@excalidraw/excalidraw`が提供する
   * 素の関数(要素・appState・filesを受け取りSVGSVGElementを返すだけ)でReactコンテキストを
   * 必要としないが、この二つの値インポートを`excal/host.tsx`にのみ閉じることで、`ui/exporter.ts`
   * (テストで`node`環境からimportされる)が`@excalidraw/excalidraw`本体(ブラウザの`window`前提の
   * 初期化コードを含む)を読み込まずに済むようにする(申し送り: PROGRESS.md参照)。
   * `exportToSvg`が返す`SVGSVGElement`はDOMに未接続のため、`XMLSerializer`で文字列化してから返す
   * (実際のダウンロードトリガーは`ui/exporter.ts`の責務)。
   */
  exportSvgString(
    elements: readonly ExcalidrawElementSkeleton[],
    files?: BinaryFiles,
  ): Promise<string>;
  /** T5-1(FR-6.2): `elements`をPNG(`EXPORT.pngScale`倍解像度)のBlobとして書き出す。 */
  exportPngBlob(elements: readonly ExcalidrawElementSkeleton[], files?: BinaryFiles): Promise<Blob>;
}

interface ApiBox {
  current: ExcalidrawImperativeAPI | null;
}

/**
 * Mermaidモード(post-v1.0)の画像フォールバック対応: image要素は `fileId` でバイナリを参照する
 * だけなので、要素を渡す前にそのバイナリをExcalidrawのファイルストアへ登録しておく必要がある
 * (登録が無いと画像が「読込中」のまま表示されない)。`addFiles`は同じidの再登録に対して冪等で、
 * レベルを行き来するたびに呼ばれても問題ない。C4モードでは`files`がundefinedなので何もしない。
 */
function registerFiles(api: ExcalidrawImperativeAPI, files: BinaryFiles | undefined): void {
  if (files === undefined) return;
  const values = Object.values(files);
  if (values.length === 0) return;
  api.addFiles(values);
}

function toCameraSnapshot(appState: {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
}): ExcalidrawCameraSnapshot {
  return { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom.value };
}

function toViewportSnapshot(appState: {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
}): ViewportSnapshot {
  return {
    width: appState.width,
    height: appState.height,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom.value,
  };
}

function HostApp(props: {
  initialElements: readonly ExcalidrawElementSkeleton[];
  initialFiles: BinaryFiles | undefined;
  apiBox: ApiBox;
  onApiReady: () => void;
  onSceneChange: (camera: ExcalidrawCameraSnapshot, viewport: ViewportSnapshot) => void;
  onPointerWorldUpdate: (world: WorldPoint) => void;
}) {
  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        props.apiBox.current = api;
        props.onApiReady();
      }}
      viewModeEnabled={true}
      onChange={(_elements, appState) => {
        props.onSceneChange(toCameraSnapshot(appState), toViewportSnapshot(appState));
      }}
      onPointerUpdate={(payload) => {
        // Excalidrawの onPointerUpdate は既にワールド座標(シーン座標)でpointer.x/yを渡す
        // (内部でviewportCoordsToSceneCoords相当の変換を行っている)。§8.3手順1のアンカー
        // 画面座標pの直下ノード判定は、この値をそのままLayoutResultの絶対座標と突き合わせて行う。
        props.onPointerWorldUpdate({ x: payload.pointer.x, y: payload.pointer.y });
      }}
      initialData={{
        elements: convertToExcalidrawElements([...props.initialElements]),
        appState: { viewModeEnabled: true },
        // Mermaidモードの画像フォールバック時のみ非undefined(registerFilesのコメント参照)。
        // `exactOptionalPropertyTypes`のため、undefinedの場合はキー自体を渡さない。
        ...(props.initialFiles !== undefined ? { files: props.initialFiles } : {}),
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
  initialFiles?: BinaryFiles,
): ExcalidrawHost {
  const apiBox: ApiBox = { current: null };
  const readyQueue: Array<(api: ExcalidrawImperativeAPI) => void> = [];
  const cameraListeners = new Set<(camera: ExcalidrawCameraSnapshot) => void>();
  // 最初のonChangeが発火する=シーンに初期要素が反映され、ビューポート寸法が確定した合図
  // (host.tsxのExcalidrawHost.fitToContentのコメント参照)。
  let sceneReady = false;
  // §8.3手順1のアンカー画面座標p用の状態。直近のポインタのワールド座標(onPointerUpdateから)と、
  // ポインタが一度も動いていない場合のフォールバック計算に使う直近のappStateスナップショット。
  let lastPointerWorld: WorldPoint | null = null;
  let lastViewport: ViewportSnapshot | null = null;

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
      initialFiles={initialFiles}
      apiBox={apiBox}
      onApiReady={() => {
        tryFlushReadyQueue();
      }}
      onSceneChange={(camera, viewport) => {
        lastViewport = viewport;
        if (!sceneReady) {
          sceneReady = true;
          tryFlushReadyQueue();
        }
        for (const listener of cameraListeners) listener(camera);
      }}
      onPointerWorldUpdate={(world) => {
        lastPointerWorld = world;
      }}
    />,
  );

  return {
    updateElements(elements, files) {
      const api = apiBox.current;
      if (api === null) return;
      registerFiles(api, files);
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
        // 空シーンでのFitは何もしない(Mermaidモードの未登録レベル対策。実測: 要素ゼロの
        // シーンで`scrollToContent`を呼ぶと、合わせる対象のバウンディングボックスが無いため
        // ズームが上限へ張り付く[3000%]。そのままAUTOに戻すとL4に貼り付いて戻れなくなる)。
        // 合わせる対象が無い以上カメラを動かす意味は無いので、`onApplied`も呼ばずに現状維持する
        // (呼び出し側のz0較正も現在値のまま。C4モードは常に要素があるため影響しない)。
        if (api.getSceneElements().length === 0) return;
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
    getAnchorWorldPoint() {
      if (lastPointerWorld !== null) return lastPointerWorld;
      if (lastViewport === null) return null;
      const { width, height, scrollX, scrollY, zoom } = lastViewport;
      // screen中心=(width/2, height/2) を world = screen/zoom - scroll で変換する。
      return { x: width / 2 / zoom - scrollX, y: height / 2 / zoom - scrollY };
    },
    applyLevelSwitch(elements, scroll, files) {
      const api = apiBox.current;
      if (api === null) return;
      registerFiles(api, files);
      const converted = convertToExcalidrawElements([...elements]);
      if (scroll === undefined) {
        api.updateScene({ elements: converted });
      } else {
        api.updateScene({
          elements: converted,
          appState: { scrollX: scroll.scrollX, scrollY: scroll.scrollY },
        });
      }
    },
    async exportSvgString(elements, files) {
      const converted = convertToExcalidrawElements([...elements]);
      const svg = await typedExportToSvg({
        elements: converted,
        appState: { exportBackground: true, viewBackgroundColor: EXPORT.backgroundColor },
        // Mermaidモードの画像フォールバック(`excal/mermaid.ts`)ではimage要素が`fileId`で
        // バイナリを参照するだけなので、ここにfilesを渡さないと書き出したSVG/PNGから画像が
        // 丸ごと欠ける。C4モードでは常にundefined→null(従来どおり)。
        files: files ?? null,
      });
      return new XMLSerializer().serializeToString(svg);
    },
    async exportPngBlob(elements, files) {
      const converted = convertToExcalidrawElements([...elements]);
      // 実機確認による申し送り: 公開APIの`exportToBlob`(内部実装 `../utils/export.ts` の
      // `exportToCanvas2`)は`appState.exportScale`を単独では無視する
      // (`maxWidthOrHeight`未指定時は`getDimensions`のみが解像度を決める。
      // `appState.exportScale`が効くのは`maxWidthOrHeight`指定時のフォールバック分岐のみで、
      // このアプリの用途には不要に複雑)。`getDimensions`で明示的に`EXPORT.pngScale`倍した
      // 幅・高さとscaleを返すことで確実に2x解像度にする。
      return typedExportToBlob({
        elements: converted,
        appState: { exportBackground: true, viewBackgroundColor: EXPORT.backgroundColor },
        files: files ?? null,
        mimeType: 'image/png',
        getDimensions: (width, height) => ({
          width: width * EXPORT.pngScale,
          height: height * EXPORT.pngScale,
          scale: EXPORT.pngScale,
        }),
      });
    },
  };
}
