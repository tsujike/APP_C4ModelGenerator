/**
 * エディタ列とビューワー列の境界をドラッグでリサイズするスプリッター(要件定義書§4
 * 「エディタとビューワーの境界はドラッグでリサイズ可能」、設計書 §2 の `ui/splitter.ts`)。
 *
 * スコープ判断(申し送り): 指示書は「スプリッター」と単数形で、要件定義書§4の画面図でも
 * 境界線は「エディタペイン(editor-pane+issues-panel)」と「ビューワーペイン」の間の1本のみ
 * 描かれている。よって縦方向の分割線1本(CSS Gridの列幅を変える)のみを実装し、
 * editor-paneとissues-panelの間(横方向)の分割は実装しない(そちらは要件・指示書のどちらにも
 * 記述が無い)。
 *
 * 実装方式: `#app` のCSS変数 `--editor-col-width` を、ハンドル(`#splitter`)のポインタドラッグ量
 * に応じて書き換える(`style.css`側で `grid-template-columns: var(--editor-col-width, 320px) ...`
 * を参照する)。ドラッグ量→新しい幅の計算は純関数 `computeColumnWidth` に切り出し、
 * DOM非依存でユニットテスト可能にする。
 *
 * DOM操作は `excal/` と `ui/` のみに許される(実装指示書§4)。本ファイルはその `ui/` 側。
 */

import { SPLITTER } from '../constants';

/**
 * ドラッグ開始時の列幅 `startWidth` に移動量 `deltaX` を加え、`containerWidth` に対する
 * 上下限(`SPLITTER.minColumnWidth` 〜 `containerWidth * SPLITTER.maxColumnRatio`)でクランプする
 * (純関数、テスト可能)。`containerWidth` が極端に小さく上限が下限を下回る場合でも
 * `minColumnWidth` を優先する(狭いウィンドウでスプリッターが操作不能な負の範囲にならないため)。
 */
export function computeColumnWidth(
  startWidth: number,
  deltaX: number,
  containerWidth: number,
): number {
  const min = SPLITTER.minColumnWidth;
  const max = Math.max(min, containerWidth * SPLITTER.maxColumnRatio);
  const raw = startWidth + deltaX;
  return Math.min(Math.max(raw, min), max);
}

export interface SplitterController {
  /** イベントリスナーを解除する(後始末用)。 */
  destroy(): void;
}

/**
 * `handle` のドラッグで `container`(`#app`)のCSS変数 `--editor-col-width` を書き換える
 * スプリッターをセットアップする。`handle` のDOM上の直前の兄弟要素(editor-pane)の実測幅を
 * ドラッグ開始時の基準幅として使う。
 */
export function createSplitter(handle: HTMLElement, container: HTMLElement): SplitterController {
  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  function currentColumnWidth(): number {
    const editorPane = handle.previousElementSibling;
    if (editorPane === null) return SPLITTER.defaultColumnWidth;
    return editorPane.getBoundingClientRect().width;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    const containerWidth = container.getBoundingClientRect().width;
    const width = computeColumnWidth(startWidth, event.clientX - startX, containerWidth);
    container.style.setProperty('--editor-col-width', `${String(width)}px`);
  }

  function onPointerUp(): void {
    dragging = false;
  }

  function onPointerDown(event: PointerEvent): void {
    dragging = true;
    startX = event.clientX;
    startWidth = currentColumnWidth();
    event.preventDefault();
  }

  handle.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    destroy() {
      handle.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}
