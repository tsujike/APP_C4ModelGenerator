import './style.css';
import { mountExcalidraw } from './excal/host';
import { layout } from './layout/layout';
import { buildModel } from './model/build';
import { project } from './model/project';
import { toExcalidraw } from './render/toExcalidraw';
import { internetBankingSample } from './samples/internet-banking';

// T2-2: サンプル→統一モデル→射影→レイアウト→Excalidraw要素、の配線のみ(§3データフロー)。
// レベル切替・カメラ制御(T2-3/T3-2)はここでは行わず、L2固定で表示する。
async function bootstrap(): Promise<void> {
  const viewerPane = document.getElementById('viewer-pane');
  if (viewerPane === null) throw new Error('#viewer-pane が見つかりません。');
  viewerPane.replaceChildren(); // index.htmlの骨格表示用プレースホルダを除去する。

  const { model } = buildModel(internetBankingSample);
  const projected = project(model, 2);
  const layoutResult = await layout(model, projected);
  const elements = toExcalidraw(layoutResult);
  mountExcalidraw(viewerPane, elements);
}

void bootstrap();
