/**
 * Mermaidモード(post-v1.0): Mermaidソース1つ分を Excalidraw要素へ変換する薄いラッパ。
 *
 * なぜ `excal/` に置くか(申し送り):
 * - `@excalidraw/mermaid-to-excalidraw` は内部で mermaid 本体を読み込み、レイアウト計算のために
 *   一時的なDOM要素を生成する。DOM操作は `excal/` と `ui/` に閉じる(実装指示書§4)という
 *   ルールに従い、この境界より内側(parser/model/layout/render)からは一切importしない。
 * - `excal/host.tsx`の`exportSvgString`と同じ理由でもある: node環境から走る vitest が
 *   mermaid/Excalidraw本体(`window`前提の初期化コードを含む)を読み込まずに済むよう、
 *   ブラウザ専用の依存はこのディレクトリの外へ漏らさない。
 * - React/JSXは使わないため `.tsx` ではなく `.ts`(host.tsx とは別ファイルに分ける)。
 *
 * CLAUDE.md「描画キャンバス: Excalidraw(Mermaid.jsに描画させない)」との関係(重要、申し送り):
 * 本モジュールはMermaid.jsに**レイアウトを計算させ、その結果をExcalidraw要素へ変換する**だけで、
 * 画面に描くのは従来どおりExcalidrawである。ただし後述のとおり、mermaid-to-excalidrawが
 * ネイティブ変換に対応していない図(classDiagram等)では1枚のラスタ画像へフォールバックするため、
 * その場合に限り「Mermaid.jsが描いた絵をExcalidraw上の画像要素として貼る」形になる。
 * この例外はKennyの承認済み(Mermaidモードは任意機能であり、C4モードの描画経路は不変)。
 */

import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';

export interface MermaidConversion {
  elements: readonly ExcalidrawElementSkeleton[];
  /**
   * 画像フォールバック時に生成されるバイナリファイル(要素側は `fileId` で参照するだけなので、
   * これをExcalidrawへ渡さないと画像が表示されない)。ネイティブ変換できた場合は undefined。
   */
  files?: BinaryFiles;
}

/**
 * Mermaidソースを Excalidraw要素へ変換する。
 *
 * 実測(このリポジトリの依存構成 @excalidraw/mermaid-to-excalidraw@2.2.2 + mermaid@11 で確認):
 * - `flowchart`(subgraph無し)・`sequenceDiagram` → rectangle/arrow等のネイティブ要素へ変換される。
 * - `flowchart`(subgraph有り)・`classDiagram` → 1枚の image 要素 + files へフォールバックする。
 * どちらの場合も戻り値の `elements` は `render/toExcalidraw.ts` の出力と同じ
 * `ExcalidrawElementSkeleton[]` 型なので、`LevelData.elements` にそのまま入る
 * (=既存のレベル切替機構をそのまま使える)。
 *
 * 変換失敗(Mermaidの文法エラー等)は例外として投げられるため、呼び出し側(main.ts)が
 * issuesパネル向けのメッセージへ変換する。ここでは握り潰さない(実装指示書§4
 * 「防御的コードは境界のみ」: どのレベルのどの行で失敗したかを知っているのは呼び出し側)。
 */
export async function convertMermaidToElements(text: string): Promise<MermaidConversion> {
  const result = await parseMermaidToExcalidraw(text);
  return {
    elements: result.elements,
    ...(result.files !== undefined ? { files: result.files } : {}),
  };
}
