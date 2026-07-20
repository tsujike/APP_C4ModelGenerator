/**
 * セマンティックズームの定数定義。
 * 出典: docs/02_アーキテクチャ設計書.md §7.2, docs/01_要件定義書.md FR-5.1
 */

/**
 * LODレベル境界(ズーム倍率のしきい値)。
 * L1: zoom < 0.75
 * L2: 0.75 <= zoom < 1.5
 * L3: 1.5 <= zoom < 3.0
 * L4: 3.0 <= zoom
 */
export const LOD_ZOOM_THRESHOLDS = [0.75, 1.5, 3.0] as const;

/**
 * ヒステリシス係数。レベルを下げる(L4→L3等)方向にのみ適用し、
 * 現在レベルの下側しきい値の90%を下回るまでは降格しない。
 * 上げる方向にはヒステリシスを適用しない。
 */
export const LOD_HYSTERESIS_FACTOR = 0.9;

/**
 * エディタのライブ更新デバウンス(FR-1.2: 入力後300msで自動的に再解析・再描画する)。
 * 出典: docs/01_要件定義書.md FR-1.2, docs/04_実装指示書.md T4-1完了条件。
 */
export const EDITOR_DEBOUNCE_MS = 300;

/**
 * localStorage永続化(FR-1.4)関連の定数。
 * `STORAGE_VERSION` はペイロード形式のバージョン。将来形式を変える場合はこれを上げ、
 * 旧バージョンのペイロードは(形式不一致として)破損時と同じ扱いで無視する。
 */
export const STORAGE_KEY = 'c4-model-whiteboard-viewer:source';
export const STORAGE_VERSION = 1;

/**
 * ドキュメントタイトル(ツールバーのタイトル入力欄)のlocalStorage永続化キー。
 * `STORAGE_KEY`(ソース本文、バージョン付き封筒形式)とは意図的に完全に独立したキー・
 * 素の文字列形式にする。タイトルを`STORAGE_KEY`のペイロードに同居させると、封筒の形が変わって
 * `STORAGE_VERSION`を上げる必要が生じ、`loadPersistedSource`の「バージョン不一致は破損と同列に
 * 扱いnullを返す」ロジックにより、タイトル機能を追加しただけで既存ユーザーの保存済みソースが
 * 一律で読めなくなってしまう(サイレントにデータが消えたのと同義)。この副作用を避けるため、
 * タイトルは別キー・別形式(バージョン封筒なし。値は「非空文字列かどうか」以外に壊れ得る
 * 「形」が無いため、封筒機構は過剰)で読み書きする(`ui/title.ts`参照)。
 */
export const STORAGE_TITLE_KEY = 'c4-model-whiteboard-viewer:title';

/** タイトル未設定時の既定表示(`ui/title.ts`・`main.ts`共通)。 */
export const DEFAULT_TITLE = 'Untitled';

/**
 * スプリッター(`ui/splitter.ts`)がエディタ列(editor-pane+issues-panel)の幅をドラッグで
 * 変更する際のクランプ値・既定値。出典: docs/01_要件定義書.md §4「エディタとビューワーの境界は
 * ドラッグでリサイズ可能」。狭すぎ/広すぎを防ぐための上下限のみ定義し、厳密な操作性の作り込みは
 * しない(T4-2「スプリッター…キープシンプルに」)。
 */
export const SPLITTER = {
  minColumnWidth: 200,
  maxColumnRatio: 0.7,
  defaultColumnWidth: 320,
} as const;

/**
 * SVG/PNGエクスポート(要件定義書FR-6.1/FR-6.2、実装指示書T5-1)の既定値。
 * `backgroundColor`はExcalidrawの既定背景色(白)を明示する値。本アプリは
 * `excal/host.tsx`のinitialDataで`viewBackgroundColor`を一度もカスタマイズしていないため、
 * この値がそのまま画面表示と一致する(受入基準5「内容が画面表示と一致する」の根拠)。
 * `pngScale`は指示書T5-1「exportToBlob(scale: 2)」の解像度倍率(`excal/host.tsx`の
 * `exportPngBlob`が`getDimensions`コールバックで適用する。実機確認: 公開APIの`exportToBlob`は
 * `appState.exportScale`単独では解像度に反映されないため)。
 */
export const EXPORT = {
  backgroundColor: '#ffffff',
  pngScale: 2,
} as const;

/** C4要素の種別ごとの塗り色(通常/External)。 */
export const C4_COLORS = {
  person: { fill: '#08427B', extFill: '#686868' },
  system: { fill: '#1168BD', extFill: '#999999' },
  container: { fill: '#438DD5', extFill: '#999999' },
  component: { fill: '#85BBF0', extFill: '#999999' },
  class: { fill: '#FFFFFF', stroke: '#333333' },
  boundary: { fill: 'none', text: '#444444' },
  edge: { stroke: '#707070' },
  edgeLabelChip: { text: '#333333' },
} as const;

/**
 * レイアウト(elkjs)・描画(Excalidraw要素)で共通に使う寸法定数。
 * 出典: docs/02_アーキテクチャ設計書.md §7.1(葉ノード寸法の見積り・elkjs spacing)、§7.2(ノード内テキスト)。
 * 厳密な文字幅測定(ctx.measureText等)は要件上不要なため、フォントサイズ比の近似値で見積もる。
 */
export const LAYOUT = {
  fontSize: 16,
  lineHeight: 22,
  /**
   * 等幅換算のおおよその1文字あたりの幅(fontSize比)。日本語・英字混在を単純な近似で扱う。
   * ブラウザでの実測(canvas.measureText, fontSize16px)では全角文字が約16.1〜16.3px/文字
   * (≒1.0×fontSize)、半角英数字は約7〜8.7px/文字だった。半角側を過大に見積もっても
   * (余白が増えるだけで)問題ないが、全角側を過小に見積もるとテキストが箱からはみ出し
   * 隣接ノードと重なって視認できなくなる(実機確認で発見)ため、全角文字を基準に安全側の値とする。
   */
  charWidthFactor: 1.05,
  nodePaddingX: 16,
  nodePaddingY: 12,
  minNodeWidth: 140,
  maxNodeWidth: 260,
  minNodeHeight: 70,
  /** ノード内説明文の最大折返し行数(§7.2: 超過は…)。 */
  maxDescriptionLines: 3,
  /** Personノードの頭部ellipseの直径。 */
  personHeadDiameter: 32,
  /** 境界(展開枠)ノードの上部余白(左上ラベル分)。 */
  boundaryTopPadding: 40,
  boundaryPadding: 16,
  /** elkjsレイアウトの余白・間隔設定(px)。 */
  rootPadding: 24,
  elkSpacingNodeNode: 40,
  elkSpacingEdgeNode: 32,
  /** レイヤー間隔。エッジラベル([技術]込みで2行になりがち)がノード境界と重ならないよう、
   *  ラベル2行分(lineHeight*2)+余白を見込んだ値にする(実機確認: 既定80だとラベルが箱の
   *  上下端と軽く重なった)。 */
  elkLayerSpacing: 110,
} as const;
