import './style.css';
import { createCameraController } from './camera/camera';
import { mountExcalidraw, type ExcalidrawHost } from './excal/host';
import { layout } from './layout/layout';
import { buildModel } from './model/build';
import { project } from './model/project';
import { toExcalidraw } from './render/toExcalidraw';
import { internetBankingSample } from './samples/internet-banking';

// T2-2: サンプル→統一モデル→射影→レイアウト→Excalidraw要素、の配線。
// T2-3: マウント後にカメラ監視/Fit/正規化(camera/camera.ts)を配線する。
// レベル切替・アンカー保存(T3-2)はここでは行わず、L2固定で表示する。
async function bootstrap(): Promise<void> {
  const viewerPane = document.getElementById('viewer-pane');
  if (viewerPane === null) throw new Error('#viewer-pane が見つかりません。');
  viewerPane.replaceChildren(); // index.htmlの骨格表示用プレースホルダを除去する。

  const { model } = buildModel(internetBankingSample);
  const projected = project(model, 2);
  const layoutResult = await layout(model, projected);
  const elements = toExcalidraw(layoutResult);
  const host = mountExcalidraw(viewerPane, elements);

  setupCamera(host);
}

/**
 * T2-3: ツールバーのFitボタン/ズーム%表示を `camera/camera.ts` 経由で配線する。
 * ExcalidrawのAPI(updateScene/scrollToContent等)へは直接触れず、必ずcamera.ts越しに操作する
 * (実装指示書§4)。
 */
function setupCamera(host: ExcalidrawHost): void {
  const camera = createCameraController(host);
  const fitButton = document.getElementById('fit-button');
  const zoomReadout = document.getElementById('zoom-readout');

  camera.subscribe((state) => {
    if (zoomReadout === null) return;
    // FR-4.4: ツールバーへのズーム%表示は、Excalidraw自身のズーム表示と同じ意味(生のzoom.value)
    // を採用する。正規化ズーム値s(state.scale)はLODしきい値判定(T3-1のlod.ts)専用の内部値であり、
    // ツールバー表示とは別概念として扱う(申し送り: PROGRESS.md参照)。
    zoomReadout.textContent = `ズーム率 ${Math.round(state.zoom * 100)}%`;
  });

  fitButton?.addEventListener('click', () => {
    camera.fit();
  });

  // 起動直後に一度だけFitし、その直後のzoom.valueをz0として確定する(設計書§8.1)。
  camera.fitAndEstablishZ0();
}

void bootstrap();
