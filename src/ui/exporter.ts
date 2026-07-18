/**
 * SVG/PNGエクスポート(要件定義書 FR-6.1/FR-6.2、受入基準5「SVG/PNGエクスポートが成功し、
 * 内容が画面表示と一致する。」、設計書 docs/02_アーキテクチャ設計書.md §2の `ui/exporter.ts`)。
 *
 * 調査結果(申し送り): `exportToSvg`/`exportToBlob`/`convertToExcalidrawElements`
 * (`@excalidraw/excalidraw`)は素の関数であり(要素配列・appState・filesを受け取って
 * SVG/Blobを返すだけ)、Reactコンポーネントでもフックでもないため呼び出しにReactコンテキストを
 * 一切必要としない(`node_modules/@excalidraw/excalidraw/dist/types/utils/export.d.ts` の
 * 型シグネチャで確認済み)。実装指示書§4「React・JSXはexcal/host.tsxのみに閉じる」は
 * JSX/Reactのimportそのものへの制約であり、この意味では本ファイルから直接呼んでも規約違反では
 * ない。それでも実際の呼び出し(`exportSvgString`/`exportPngBlob`)は`excal/host.tsx`に置いた
 * (`ExcalidrawHost`インターフェースへの追加。実装は`excal/host.tsx`参照): 理由は
 * Reactではなく、`@excalidraw/excalidraw`パッケージ自体の実行時の性質——モジュール評価時に
 * ブラウザの`window`を参照する初期化コードを含む——にある。本ファイルはvitestで
 * (`environment: 'node'`、jsdom等は導入していない既存方針どおり)`exportFileName`のような
 * 純粋関数を単体テストされるため、このファイルが`@excalidraw/excalidraw`を値としてimportすると
 * テスト実行時に`window is not defined`で落ちる(実機確認済み)。既存パターン(host.tsxのみが
 * `@excalidraw/excalidraw`を値インポートする)を保つことで、この問題を回避しつつ
 * `ui/exporter.ts`を素のDOM操作(ダウンロードトリガー)に専念させる。
 *
 * ダウンロードのトリガー(Blob→ObjectURL→<a>クリック)はDOM操作だが、`ui/`配下でのDOM操作は
 * 実装指示書§4で許可されている(issuesPanel.ts/splitter.tsと同じ扱い)。
 *
 * 「対象は現レベルの全要素」(実装指示書T5-1「やること」): 呼び出し側(main.ts)が
 * `levelController`の現在レベルに対応する `LevelData.elements`
 * (`ExcalidrawElementSkeleton[]`、layoutが生成したそのレベルの全要素で、ビューポートに
 * 表示されているかどうかとは無関係)を渡す。Excalidrawのキャンバスをビューポートでクロップした
 * 部分キャプチャではない。
 */

import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawHost } from '../excal/host';
import type { Level } from '../model/types';

/**
 * ダウンロードファイル名を決める純関数(テスト可能)。表示レベルをファイル名に含め、
 * どのレベルを書き出したものか一目でわかるようにする。
 */
export function exportFileName(level: Level, extension: 'svg' | 'png'): string {
  return `c4-model-L${String(level)}.${extension}`;
}

/** Blobをダウンロードさせる標準的なブラウザパターン(`<a download>` + ObjectURL)。 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 現レベルの全要素(`elements`)をSVGとしてダウンロードさせる(FR-6.1)。
 * 実際のSVG生成は`host.exportSvgString`(`excal/host.tsx`)に委譲する(このファイル冒頭の
 * 申し送り参照)。
 */
export async function exportCurrentLevelSvg(
  host: ExcalidrawHost,
  elements: readonly ExcalidrawElementSkeleton[],
  level: Level,
): Promise<void> {
  const svgString = await host.exportSvgString(elements);
  downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), exportFileName(level, 'svg'));
}

/**
 * 現レベルの全要素(`elements`)をPNG(2x解像度)としてダウンロードさせる(FR-6.2)。
 * 実際のPNG生成は`host.exportPngBlob`(`excal/host.tsx`)に委譲する。
 */
export async function exportCurrentLevelPng(
  host: ExcalidrawHost,
  elements: readonly ExcalidrawElementSkeleton[],
  level: Level,
): Promise<void> {
  const blob = await host.exportPngBlob(elements);
  downloadBlob(blob, exportFileName(level, 'png'));
}
