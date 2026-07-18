import './style.css';
import { createCameraController, type CameraController } from './camera/camera';
import {
  createLevelController,
  type LevelController,
  type LevelData,
} from './camera/levelController';
import { mountExcalidraw, type ExcalidrawHost } from './excal/host';
import { layout } from './layout/layout';
import { buildModel } from './model/build';
import { project } from './model/project';
import type { C4Model, Level } from './model/types';
import type { ParseIssue } from './parser/types';
import { toExcalidraw } from './render/toExcalidraw';
import { internetBankingSample } from './samples/internet-banking';
import { createEditor, type EditorController } from './ui/editor';

const ALL_LEVELS: readonly Level[] = [1, 2, 3, 4];
/** 起動直後に表示する初期レベル(設計書§8.1: z0はL2 Fit直後のzoomで確定する)。 */
const INITIAL_LEVEL: Level = 2;

// サンプル→統一モデル→(全レベル分の)射影→レイアウト→Excalidraw要素、の配線。
// マウント後にカメラ監視/Fit/正規化(T2-3)、レベル判定+切替+アンカー保存(T3-2)、
// エディタ+ライブ再解析(T4-1)を配線する。
async function bootstrap(): Promise<void> {
  const excalidrawContainer = document.getElementById('excalidraw-container');
  if (excalidrawContainer === null) throw new Error('#excalidraw-container が見つかりません。');
  const editorContainer = document.getElementById('editor-mount');
  if (editorContainer === null) throw new Error('#editor-mount が見つかりません。');

  const editor = createEditor(editorContainer, internetBankingSample);

  const { model, issues } = buildModel(editor.getValue());
  reportIssues(issues);
  const levelData = await buildLevelData(model);

  const initialData = levelData.get(INITIAL_LEVEL);
  // ALL_LEVELSの全レベルをbuildLevelDataで計算済みのため到達しない分岐。
  if (initialData === undefined)
    throw new Error('unreachable: 初期レベルのlevelDataが見つかりません。');

  const host = mountExcalidraw(excalidrawContainer, initialData.elements);
  const camera = setupCamera(host);
  const levelController = createLevelController(host, camera, model, levelData, INITIAL_LEVEL);
  setupLevelControls(levelController);
  setupLiveEditing(editor, levelController);
}

/**
 * T4-1: エディタの変更(300msデバウンス済み、FR-1.2)のたびに再解析→4レベル分の
 * 射影/レイアウト/Excalidraw要素変換をやり直し、levelControllerへ丸ごと差し替える。
 * これが「レイアウトキャッシュ破棄」の実体(古いlevelDataを一切再利用せず、毎回
 * buildLevelDataで新規に作り直したMapに完全入れ替えする)。
 *
 * カメラ(scroll/zoom)には一切触れない(levelController.updateModelがhost.updateElementsのみを
 * 呼ぶため。FR-1.3)。
 */
function setupLiveEditing(editor: EditorController, levelController: LevelController): void {
  editor.subscribe((source) => {
    void reparseAndRerender(source, levelController);
  });
}

async function reparseAndRerender(source: string, levelController: LevelController): Promise<void> {
  const { model, issues } = buildModel(source);
  reportIssues(issues);
  const levelData = await buildLevelData(model);
  levelController.updateModel(model, levelData);
}

/**
 * 解析/整合性エラー・警告の報告先(T4-1時点ではUIパネル未実装。issuesPanelはT4-2のスコープ)。
 * FR-2.2のパネル表示は行わないが、issuesそのものを握りつぶさずコンソールに出す(申し送り:
 * 完全な無視ではなく開発者が確認できる最小限の経路を残した)。
 */
function reportIssues(issues: readonly ParseIssue[]): void {
  if (issues.length === 0) return;
  console.log(`[C4] 解析issues: ${String(issues.length)}件`, issues);
}

/**
 * 表示レベル1〜4すべての LayoutResult+Excalidraw要素を計算する(設計書§3「レベル別レイアウトは
 * 遅延生成でよい。テキスト変更で全キャッシュ破棄」に対する判断: 本サンプルはノード十数個規模で
 * 4レベル合計の計算も軽量なため、遅延生成の複雑さ(初回訪問時計算+キャッシュ管理)を導入せず、
 * 起動時に一括計算する方を単純さ優先で選んだ。NFR-3の負荷規模(200ノード/300エッジ)でも
 * 「解析+全レベルレイアウト再計算が1秒以内」が要件であり、起動時一括計算はこの要件そのものと
 * 整合する。テキスト編集によるキャッシュ破棄(T4スコープ)は本タスクの対象外)。
 */
async function buildLevelData(model: C4Model): Promise<Map<Level, LevelData>> {
  const entries = await Promise.all(
    ALL_LEVELS.map(async (level): Promise<readonly [Level, LevelData]> => {
      const projected = project(model, level);
      const layoutResult = await layout(model, projected);
      const elements = toExcalidraw(layoutResult);
      return [level, { layout: layoutResult, elements }];
    }),
  );
  return new Map(entries);
}

/**
 * T2-3: ツールバーのFitボタン/ズーム%表示を `camera/camera.ts` 経由で配線する。
 * ExcalidrawのAPI(updateScene/scrollToContent等)へは直接触れず、必ずcamera.ts越しに操作する
 * (実装指示書§4)。
 */
function setupCamera(host: ExcalidrawHost): CameraController {
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
  return camera;
}

/**
 * T3-2: レベル手動固定(L1〜L4)/AUTOのツールバーボタンを配線し、現在レベルをツールバー文言と
 * ビューワー内バッジの両方に表示する(FR-5.6: 「ツールバーとビューワー内バッジに常時表示」を
 * 文字どおり両方実装する解釈。申し送り)。
 */
function setupLevelControls(levelController: LevelController): void {
  const levelButtons = new Map(
    ALL_LEVELS.map(
      (level) => [level, document.getElementById(`level-button-${String(level)}`)] as const,
    ),
  );
  const autoButton = document.getElementById('level-auto-button');
  const statusEl = document.getElementById('level-status');
  const badgeEl = document.getElementById('level-badge');

  for (const [level, button] of levelButtons) {
    button?.addEventListener('click', () => {
      levelController.lockTo(level);
    });
  }
  autoButton?.addEventListener('click', () => {
    levelController.setAuto();
  });

  levelController.subscribe((state) => {
    for (const [level, button] of levelButtons) {
      button?.classList.toggle('active', level === state.level);
    }
    autoButton?.classList.toggle('active', state.levelLock === null);

    const modeLabel = state.levelLock === null ? 'AUTO' : '固定';
    if (statusEl !== null) statusEl.textContent = `現在: L${String(state.level)} (${modeLabel})`;
    if (badgeEl !== null) badgeEl.textContent = `L${String(state.level)}`;
  });
}

void bootstrap();
