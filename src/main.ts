import './style.css';
import { createCameraController, type CameraController } from './camera/camera';
import {
  createLevelController,
  type LevelController,
  type LevelData,
} from './camera/levelController';
import { DEFAULT_TITLE } from './constants';
import { mountExcalidraw, type ExcalidrawHost } from './excal/host';
import { convertMermaidToElements } from './excal/mermaid';
import { layout } from './layout/layout';
import { buildModel } from './model/build';
import { project } from './model/project';
import type { C4Model, Level } from './model/types';
import {
  detectMarkerlessMermaidLine,
  isMermaidModeSource,
  splitMermaidLevels,
} from './parser/mermaidLevels';
import type { ParseIssue } from './parser/types';
import { toExcalidraw } from './render/toExcalidraw';
import { ecSiteSample } from './samples/ec-site';
import { internetBankingSample } from './samples/internet-banking';
import { mermaidLevelsSample } from './samples/mermaid-levels';
import {
  createEditor,
  loadPersistedSource,
  savePersistedSource,
  type EditorController,
} from './ui/editor';
import { exportCurrentLevelPng, exportCurrentLevelSvg } from './ui/exporter';
import { readFileAsText, saveSourceAsFile, stripFileExtension } from './ui/fileIO';
import { createIssuesPanel, type IssuesPanelController } from './ui/issuesPanel';
import { createSplitter } from './ui/splitter';
import {
  createTitleField,
  loadPersistedTitle,
  savePersistedTitle,
  type TitleController,
} from './ui/title';

const ALL_LEVELS: readonly Level[] = [1, 2, 3, 4, 5, 6, 7, 8];
/**
 * C4モードが実際に持つレベル(C4モデル自体が4層で定義されるため)。`buildLevelData`の
 * 射影/レイアウト計算はこの4レベルのみで行い、L5〜L8は空の`LevelData`で埋める
 * (`project(model, 5)`のような無意味な呼び出しをしないため。かつlevelControllerの
 * 「全レベル揃っている」契約=ALL_LEVELS全キーの存在は保つ)。
 */
const C4_LEVELS: readonly Level[] = [1, 2, 3, 4];
/** 起動直後に表示する初期レベル(設計書§8.1: z0はL2 Fit直後のzoomで確定する)。 */
const INITIAL_LEVEL: Level = 2;

/** サンプルメニュー(FR-1.5)に列挙する組込サンプル。「最低2件」をこのタスクで充足する。 */
const SAMPLES: ReadonlyArray<{ id: string; label: string; source: string }> = [
  { id: 'internet-banking', label: 'インターネットバンキング', source: internetBankingSample },
  { id: 'ec-site', label: 'ECサイト', source: ecSiteSample },
  { id: 'mermaid-levels', label: 'Mermaid(レベル別)', source: mermaidLevelsSample },
];

/** C4モードでモデルを持たないMermaidモード用の空モデル(levelController.updateModelの引数用)。 */
const EMPTY_MODEL: C4Model = { roots: [], byAlias: new Map(), edges: [] };

// サンプル(またはlocalStorageからの復元、FR-1.4)→統一モデル→(全レベル分の)射影→レイアウト→
// Excalidraw要素、の配線。マウント後にカメラ監視/Fit/正規化(T2-3)、レベル判定+切替+
// アンカー保存(T3-2)、エディタ+ライブ再解析(T4-1)、issuesパネル/永続化/サンプルメニュー/
// スプリッター(T4-2)を配線する。
async function bootstrap(): Promise<void> {
  const excalidrawContainer = document.getElementById('excalidraw-container');
  if (excalidrawContainer === null) throw new Error('#excalidraw-container が見つかりません。');
  const editorContainer = document.getElementById('editor-mount');
  if (editorContainer === null) throw new Error('#editor-mount が見つかりません。');
  const issuesMount = document.getElementById('issues-panel-mount');
  if (issuesMount === null) throw new Error('#issues-panel-mount が見つかりません。');
  const titleInput = document.getElementById('title-input');
  if (!(titleInput instanceof HTMLInputElement)) throw new Error('#title-input が見つかりません。');

  // FR-1.4: 起動時にlocalStorageからの復元を試みる。無い/壊れている場合は初期サンプルへ
  // 静かにフォールバックする(loadPersistedSourceがその判定を内包する。ui/editor.ts参照)。
  const initialSource = loadPersistedSource(window.localStorage) ?? internetBankingSample;
  const editor = createEditor(editorContainer, initialSource);
  const issuesPanel = createIssuesPanel(issuesMount, (line) => {
    editor.jumpToLine(line);
  });

  // タイトルも同じ「無い/壊れている場合は既定値へフォールバック」パターン(loadPersistedTitle
  // が判定を内包する。ui/title.ts参照)。ソース本文とは独立したキーで永続化する(constants.ts参照)。
  const initialTitle = loadPersistedTitle(window.localStorage) ?? DEFAULT_TITLE;
  const titleField = createTitleField(titleInput, initialTitle);
  setupTitlePersistence(titleField);

  const built = await buildFromSource(editor.getValue());
  issuesPanel.update(built.issues);
  // T5-1: エクスポートボタンは「クリック時点で表示中のレベルの全要素」を必要とするため、
  // 編集のたびに再構築される最新のlevelDataを常に読めるよう`let`にする(このファイル冒頭の
  // 申し送りどおり、以前は`const`でbootstrap内に閉じていたが、それだと再解析後の最新版を
  // 参照する手段が無かった)。再解析時の差し替えは`setupLiveEditing`に渡す
  // `onLevelDataUpdated`コールバックで行う。
  let levelData = built.levelData;

  const startLevel = pickInitialLevel(levelData);
  const initialData = levelData.get(startLevel);
  // ALL_LEVELSの全レベルをbuildLevelDataで計算済みのため到達しない分岐。
  if (initialData === undefined)
    throw new Error('unreachable: 初期レベルのlevelDataが見つかりません。');

  const host = mountExcalidraw(excalidrawContainer, initialData.elements, initialData.files);
  const camera = setupCamera(host);
  const levelController = createLevelController(
    host,
    camera,
    built.model,
    levelData,
    startLevel,
    built.maxLevel,
  );
  setupLevelControls(levelController);
  setupLiveEditing(editor, levelController, issuesPanel, (newLevelData) => {
    levelData = newLevelData;
  });
  setupPersistence(editor);
  setupSampleMenu(editor, titleField);
  setupSplitter();
  setupExporter(host, levelController, () => levelData);
  setupFileIO(editor, titleField);
}

/**
 * T4-1: エディタの変更(300msデバウンス済み、FR-1.2)のたびに再解析→4レベル分の
 * 射影/レイアウト/Excalidraw要素変換をやり直し、levelControllerへ丸ごと差し替える。
 * これが「レイアウトキャッシュ破棄」の実体(古いlevelDataを一切再利用せず、毎回
 * buildLevelDataで新規に作り直したMapに完全入れ替えする)。
 * T4-2で追加: 同じ再解析結果のissuesをissuesPanelにも反映する(FR-2.2)。
 *
 * カメラ(scroll/zoom)には一切触れない(levelController.updateModelがhost.updateElementsのみを
 * 呼ぶため。FR-1.3)。
 */
function setupLiveEditing(
  editor: EditorController,
  levelController: LevelController,
  issuesPanel: IssuesPanelController,
  onLevelDataUpdated: (levelData: Map<Level, LevelData>) => void,
): void {
  editor.subscribe((source) => {
    void reparseAndRerender(source, levelController, issuesPanel, onLevelDataUpdated);
  });
}

async function reparseAndRerender(
  source: string,
  levelController: LevelController,
  issuesPanel: IssuesPanelController,
  onLevelDataUpdated: (levelData: Map<Level, LevelData>) => void,
): Promise<void> {
  const built = await buildFromSource(source);
  issuesPanel.update(built.issues);
  const levelData = built.levelData;
  levelController.updateModel(built.model, levelData, built.maxLevel);
  // T5-1: エクスポートボタンが常に最新のlevelDataを読めるよう、bootstrap側の`let levelData`を
  // 差し替える(このコールバックの実体はbootstrap内のクロージャ)。
  onLevelDataUpdated(levelData);
}

/**
 * T4-2: FR-1.4のlocalStorage自動保存。`editor.subscribe`は既に300msデバウンス済みの通知
 * (ui/editor.ts参照)であり、ここで新しいデバウンスタイマーは作らない
 * (setupLiveEditingの再解析用リスナーと同じ1つの通知に相乗りする)。
 */
function setupPersistence(editor: EditorController): void {
  editor.subscribe((source) => {
    savePersistedSource(window.localStorage, source);
  });
}

/**
 * ドキュメントタイトルのlocalStorage自動保存。`titleField.subscribe`は登録直後に現在値で
 * 1回呼ばれ(camera.ts/levelControllerと同じ規約)、以後は値が変わるたび(ユーザーの手入力
 * change/blur、またはサンプル読込・ファイル読込による`setTitle`呼び出し)に呼ばれる。
 * `setupPersistence`(ソース本文)と同じ「subscribeへ保存処理を1つ足すだけ」のパターン。
 */
function setupTitlePersistence(titleField: TitleController): void {
  titleField.subscribe((title) => {
    savePersistedTitle(window.localStorage, title);
  });
}

/**
 * T4-2: サンプル読込メニュー(FR-1.5)。選択時、現ソースを破棄する旨を`confirm()`で確認してから
 * `editor.setValue`で差し替える。キャンセル時は何もしない。
 * post-v1.0で追加: 読込と同時にタイトルをそのサンプルの表示ラベル(例:「ECサイト」)に
 * 差し替える(「今どのモデルを見ているか」をタイトルに反映させ、サンプル切替後に古いタイトルが
 * 残り続けるのを防ぐ)。
 *
 * 実装判断(申し送り): 確認ダイアログはブラウザ標準の`window.confirm`を採用した。本アプリは
 * UIフレームワーク・状態管理ライブラリを導入しない方針(CLAUDE.md)であり、独自モーダルを
 * 実装するとDOM状態管理・フォーカストラップ等の作り込みが必要になり「やること」の範囲を
 * 超える。`confirm()`はブロッキングだが、破棄確認という単発の同期的な意思確認に対しては
 * 副作用が無く最も単純な実装である。
 *
 * `<select>`は選択のたびに空(プレースホルダ)へ戻す。そうしないと同じサンプルを続けて
 * 選び直した場合に値が変化せず`change`イベントが発火しない(再読込したいケースを阻害する)。
 */
function setupSampleMenu(editor: EditorController, titleField: TitleController): void {
  const select = document.getElementById('sample-select');
  if (!(select instanceof HTMLSelectElement)) return;

  select.addEventListener('change', () => {
    const chosenId = select.value;
    select.value = '';
    const chosen = SAMPLES.find((s) => s.id === chosenId);
    if (chosen === undefined) return;

    const discard = window.confirm(
      `現在のソースを破棄して「${chosen.label}」サンプルを読み込みます。よろしいですか?`,
    );
    if (!discard) return;

    editor.setValue(chosen.source);
    titleField.setTitle(chosen.label);
  });
}

/**
 * post-v1.0で追加: ソーステキストのファイル保存/読込。
 * 保存: 現在のタイトル(`sanitizeFilename`で禁止文字除去)を`.txt`ファイル名にしてダウンロードする
 * (`ui/fileIO.ts`の`saveSourceAsFile`)。
 * 読込: 「開く」ボタンで隠し`<input type="file">`をクリックさせ、選択された`.txt`ファイルを
 * `FileReader`で読む。サンプル読込(`setupSampleMenu`)と同じ「現在のソースを破棄してよいか」の
 * `confirm()`確認を経てから`editor.setValue`し、タイトルも読み込んだファイル名(拡張子除く)に
 * 差し替える。`<input type="file">`は選択のたびに`value = ''`へ戻す(同じファイルを連続で
 * 選び直しても`change`イベントが発火するようにするため。`<select>`側で既に解決済みの
 * 同種の問題と同じ対処。このファイル冒頭のsetupSampleMenuの申し送り参照)。
 */
function setupFileIO(editor: EditorController, titleField: TitleController): void {
  const saveButton = document.getElementById('save-file-button');
  const openButton = document.getElementById('open-file-button');
  const fileInput = document.getElementById('file-input');
  if (!(fileInput instanceof HTMLInputElement)) return;

  saveButton?.addEventListener('click', () => {
    saveSourceAsFile(editor.getValue(), titleField.getTitle());
  });

  openButton?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file === undefined) return;

    const discard = window.confirm(
      `現在のソースを破棄してファイル「${file.name}」を読み込みます。よろしいですか?`,
    );
    if (!discard) return;

    void readFileAsText(file)
      .then((text) => {
        editor.setValue(text);
        titleField.setTitle(stripFileExtension(file.name));
      })
      .catch(() => {
        // ファイル読込はユーザー環境(ディスク)依存の境界のため、失敗時は通知のみでアプリを止めない
        // (実装指示書§4「防御的コードは境界のみ」。confirm()と対称に window.alert を使う)。
        window.alert('ファイルの読込に失敗しました。');
      });
  });
}

/** T4-2: エディタ列/ビューワー列のスプリッター(要件定義書§4)を配線する。 */
function setupSplitter(): void {
  const handle = document.getElementById('splitter');
  const appEl = document.getElementById('app');
  if (handle === null || appEl === null) return;
  createSplitter(handle, appEl);
}

/**
 * T5-1: ツールバーのSVG/PNG出力ボタン(FR-6.1/FR-6.2)を配線する。
 * 実装指示書T5-1「対象は現レベルの全要素」: クリック時点で`levelController.getState().level`が
 * 指す表示中レベルの`LevelData.elements`を`getLevelData()`から取得して渡す。
 * `getLevelData`はbootstrap内の`let levelData`を読む関数(クロージャ)で、テキスト編集による
 * 再解析のたびに`setupLiveEditing`の`onLevelDataUpdated`経由で差し替わった最新版を指す
 * (このファイル冒頭の申し送り: 以前は`const`のためbootstrap内の初期値しか参照できなかった)。
 */
function setupExporter(
  host: ExcalidrawHost,
  levelController: LevelController,
  getLevelData: () => ReadonlyMap<Level, LevelData>,
): void {
  const svgButton = document.getElementById('export-svg-button');
  const pngButton = document.getElementById('export-png-button');

  svgButton?.addEventListener('click', () => {
    const { level } = levelController.getState();
    const data = getLevelData().get(level);
    // levelDataは1〜8全て事前計算済み(buildLevelDataの契約)のため到達しない分岐。
    if (data === undefined) return;
    void exportCurrentLevelSvg(host, data.elements, level, data.files);
  });

  pngButton?.addEventListener('click', () => {
    const { level } = levelController.getState();
    const data = getLevelData().get(level);
    if (data === undefined) return;
    void exportCurrentLevelPng(host, data.elements, level, data.files);
  });
}

/**
 * C4モード(L1〜L4)すべての LayoutResult+Excalidraw要素を計算する(設計書§3「レベル別レイアウトは
 * 遅延生成でよい。テキスト変更で全キャッシュ破棄」に対する判断: 本サンプルはノード十数個規模で
 * 4レベル合計の計算も軽量なため、遅延生成の複雑さ(初回訪問時計算+キャッシュ管理)を導入せず、
 * 起動時に一括計算する方を単純さ優先で選んだ。NFR-3の負荷規模(200ノード/300エッジ)でも
 * 「解析+全レベルレイアウト再計算が1秒以内」が要件であり、起動時一括計算はこの要件そのものと
 * 整合する。テキスト編集によるキャッシュ破棄(T4スコープ)は本タスクの対象外)。
 * C4モデル自体は4層でしか定義されないため、L5〜L8は`project`/`layout`を呼ばず空データで埋める
 * (C4_LEVELS参照)。
 */
/** 1回の解析で得られる、画面更新に必要な一式(モード非依存の共通の形)。 */
interface BuildResult {
  /** Mermaidモードでは統一モデルを持たないため EMPTY_MODEL。 */
  model: C4Model;
  issues: ParseIssue[];
  levelData: Map<Level, LevelData>;
  /** そのモードで到達可能な最大レベル。C4モードは4、Mermaidモードは8(levelController.ts参照)。 */
  maxLevel: Level;
}

/**
 * post-v1.0(Mermaidモード): ソーステキストからモードを判定し、対応する経路で表示データを作る。
 * 2つのモードは排他(Kenny確認済み: 「Mermaidモードなら4レベル全部Mermaidでよい」「C4との混在は
 * ない」。post-v1.0のL5〜L8拡張でもこの排他性は変わらず、Mermaidモードは8レベル全部を使う)ので、
 * 判定は`isMermaidModeSource`の一箇所だけで済む。
 *
 * 設計判断(申し送り): モード分岐をこの1関数に閉じることで、C4モードの経路
 * (buildModel → project → layout → toExcalidraw)には一切手を入れていない。既存の全テスト・
 * 全受入基準はC4モードの経路をそのまま検証し続ける。
 */
async function buildFromSource(source: string): Promise<BuildResult> {
  if (isMermaidModeSource(source)) {
    return buildMermaidLevelData(source);
  }
  const { model, issues } = buildModel(source);

  // 素のMermaidをそのまま貼った場合(マーカー行が無いのでC4モードと判定される)の救済。
  // C4モード側は「C4Contextブロックが見つかりません」としか言えず、原因(マーカーの書き忘れ)に
  // たどり着けないため、ここで案内を1件足す(Kennyの指摘に対する対応)。
  // C4モードの解析そのもの(model/build.ts)は変更しない。あくまでissuesへの追記だけに留める。
  const markerlessLine = detectMarkerlessMermaidLine(source);
  if (markerlessLine !== undefined) {
    issues.push({
      severity: 'error',
      line: markerlessLine,
      message:
        'Mermaidの図のようですが、レベルマーカーがありません。図の先頭に %%L1 (〜%%L8)の行を追加すると、そのレベルにこの図を表示します。',
    });
  }

  return { model, issues, levelData: await buildLevelData(model), maxLevel: 4 };
}

/**
 * Mermaidモード: `%%L1`〜`%%L8` で登録された各図を Excalidraw要素へ変換する。
 *
 * - 未登録レベルは空の`LevelData`(elements: [])にする。Kenny確認済みの「未登録のレベルは
 *   何も表示しない」の実装であり、同時に「levelDataは1〜8全て揃っている」という
 *   `camera/levelController.ts`の既存契約も保てる(欠けたキーを許すと切替が無反応になる)。
 * - Mermaidの文法エラーはそのレベルだけを空にし、issuesパネルにerrorとして出す。他のレベルは
 *   そのまま表示できる(1つのタイポで8レベル全部が消えるのを避ける)。
 * - `layout`は付けない(アンカー保存は行わない。`LevelData.layout`のJSDoc参照)。
 *
 * 8レベル分の変換は`Promise.all`で並行に走らせる(C4モードの`buildLevelData`と同じ形)。
 */
async function buildMermaidLevelData(source: string): Promise<BuildResult> {
  const { levels, issues } = splitMermaidLevels(source);

  const entries = await Promise.all(
    ALL_LEVELS.map(async (level): Promise<readonly [Level, LevelData]> => {
      const entry = levels.get(level);
      if (entry === undefined) return [level, { elements: [] }];
      try {
        const { elements, files } = await convertMermaidToElements(entry.text);
        return [level, { elements, ...(files !== undefined ? { files } : {}) }];
      } catch (error) {
        issues.push({
          severity: 'error',
          line: entry.markerLine,
          // マーカー表記(`%%L2`)をそのまま使う。issuesPanelは行番号を`L4:`の形で前置するため、
          // ここで素の`L2`と書くと行番号と紛らわしくなる(mermaidLevels.tsの警告文と表記を揃える)。
          message: `%%L${String(level)} のMermaidを解析できませんでした: ${toErrorMessage(error)}`,
        });
        return [level, { elements: [] }];
      }
    }),
  );

  return { model: EMPTY_MODEL, issues, levelData: new Map(entries), maxLevel: 8 };
}

/** 外部ライブラリ境界のcatch節(`unknown`)から表示用メッセージを取り出す(実装指示書§4: any禁止)。 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * 起動時に最初に表示するレベルを決める。
 *
 * 通常は`INITIAL_LEVEL`(L2。設計書§8.1「z0はL2 Fit直後のzoomで確定する」)だが、Mermaidモードで
 * L2が未登録だと画面が空のままFitすることになり、収める対象が無いためz0が不安定になる
 * (`excal/host.tsx`の`fitToContent`の実測メモと同じ問題)。そのため、L2が空の場合に限り
 * 「要素を持つ最小のレベル」へフォールバックする。C4モードではL2が空になることは無いため
 * 従来どおりL2が選ばれ、既存挙動は変わらない。
 */
function pickInitialLevel(levelData: ReadonlyMap<Level, LevelData>): Level {
  const preferred = levelData.get(INITIAL_LEVEL);
  if (preferred !== undefined && preferred.elements.length > 0) return INITIAL_LEVEL;
  for (const level of ALL_LEVELS) {
    const data = levelData.get(level);
    if (data !== undefined && data.elements.length > 0) return level;
  }
  return INITIAL_LEVEL;
}

async function buildLevelData(model: C4Model): Promise<Map<Level, LevelData>> {
  const entries = await Promise.all(
    C4_LEVELS.map(async (level): Promise<readonly [Level, LevelData]> => {
      const projected = project(model, level);
      const layoutResult = await layout(model, projected);
      const elements = toExcalidraw(layoutResult);
      return [level, { layout: layoutResult, elements }];
    }),
  );
  // levelControllerは「ALL_LEVELS(1〜8)全キーが揃っている」ことを前提とするため、C4モードには
  // 存在しないL5〜L8を空の`LevelData`で埋める(main.ts冒頭のC4_LEVELSのJSDoc参照)。
  for (const level of ALL_LEVELS) {
    if (!C4_LEVELS.includes(level)) entries.push([level, { elements: [] }]);
  }
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
 * T3-2: レベル手動固定(L1〜L8)/AUTOのツールバーボタンを配線し、現在レベルをツールバー文言と
 * ビューワー内バッジの両方に表示する(FR-5.6: 「ツールバーとビューワー内バッジに常時表示」を
 * 文字どおり両方実装する解釈。申し送り)。
 * post-v1.0で追加: L5〜L8はMermaidモード専用のため、`state.maxLevel`(levelController.ts参照)を
 * 超えるレベルのボタンは`disabled`にする。モードは編集のたびに切り替わり得るので、subscribeの
 * コールバック内で毎回再評価する(固定値でキャッシュしない)。
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
      if (button instanceof HTMLButtonElement) {
        button.disabled = level > state.maxLevel;
      }
    }
    autoButton?.classList.toggle('active', state.levelLock === null);

    const modeLabel = state.levelLock === null ? 'AUTO' : '固定';
    if (statusEl !== null) statusEl.textContent = `現在: L${String(state.level)} (${modeLabel})`;
    if (badgeEl !== null) badgeEl.textContent = `L${String(state.level)}`;
  });
}

void bootstrap();
