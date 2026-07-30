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
import type { BinaryFileData, BinaryFiles, DataURL } from '@excalidraw/excalidraw/types';

export interface MermaidConversion {
  elements: readonly ExcalidrawElementSkeleton[];
  /**
   * 画像フォールバック時に生成されるバイナリファイル(要素側は `fileId` で参照するだけなので、
   * これをExcalidrawへ渡さないと画像が表示されない)。ネイティブ変換できた場合は undefined。
   */
  files?: BinaryFiles;
}

/**
 * `<br>` / `<br/>` / `<br />`(大文字小文字・空白・スラッシュの有無は問わない)にマッチする。
 * ネイティブ変換経路のラベル修復(改行文字への置換)専用。`g`付きだが `.replace()` のみで
 * 使う(String.prototype.replaceは呼び出しのたびに内部で lastIndex を0へ戻すため、
 * `.test()`/`.exec()`と混在させない限りモジュールスコープで使い回しても安全)。
 */
const BR_TAG_RE = /<br\s*\/?\s*>/gi;

/**
 * ネイティブ変換経路のラベル修復(実測: 背景1)。
 * mermaid-to-excalidraw@2.2.2 はソース中の `<br/>` を一切解釈せず、変換後の要素の
 * `label.text` に `'一行目<br>二行目'`(flowchartは`<br>`へ正規化)や
 * `'一行目<br/>二行目'`(sequenceDiagramは原文のまま)という文字列をそのまま残す。
 * 本家Mermaidは `<br/>` を改行として描画するため、ここで `\n` に置換して合わせる。
 * なお mermaid 側のレイアウト計算は既に複数行分の高さで箱を確保している
 * (1行なら高さ60、`<br/>`入りなら90を実測済み)ため、`\n`へ置換してもボックスからは
 * はみ出さない。
 *
 * `ExcalidrawElementSkeleton` は要素種別ごとのunionで、`label` を持つのは
 * ValidContainer(矩形等)と ValidLinearElement(矢印/線)だけ。`'label' in el` で
 * それ以外(text/image/frame/line/freedraw等)を弾いてから読む。
 * 元の要素オブジェクトは変更せず、`<br` を含むものだけ `label` を浅くコピーして返す。
 */
function fixBrInLabel(el: ExcalidrawElementSkeleton): ExcalidrawElementSkeleton {
  if (!('label' in el) || el.label === undefined) return el;
  const text = el.label.text;
  if (!text.includes('<br')) return el;
  return { ...el, label: { ...el.label, text: text.replace(BR_TAG_RE, '\n') } };
}

/** SVGのdataURLプレフィックス(ラスタ画像フォールバック時にmermaid-to-excalidrawが生成する形式)。 */
const SVG_DATA_URL_PREFIX = 'data:image/svg+xml;base64,';

/**
 * 閉じていない `<br>`(直後に `/` を伴わないもの)にマッチする。`<br/>` `<br />` は
 * 対象外(二重に壊さないため)。`.replace()` のみで使うので `BR_TAG_RE` と同様に
 * モジュールスコープでの使い回しが安全。
 */
const UNCLOSED_BR_RE = /<br(?!\s*\/)\s*>/gi;

/**
 * base64(SVGのdataURL部分)をUTF-8として安全にデコードする。
 * `atob` は結果をLatin1のバイト列として返すだけなので、SVGに含まれる日本語などの
 * 非ASCII文字をそのまま文字列として扱うと化ける。一旦バイト列に戻し、
 * `TextDecoder` でUTF-8として解釈し直す。
 */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * `decodeBase64Utf8` の逆変換。素朴な `btoa(text)` は非ASCII文字を含む文字列に対して
 * 例外を投げるため、まず `TextEncoder` でUTF-8バイト列へエンコードし、
 * それをLatin1文字列に写してから `btoa` する。
 */
function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * ラスタ画像フォールバック経路のSVG修復(実測: 背景2)。
 * mermaid-to-excalidraw@2.2.2 は複数行ラベルを `<span class="nodeLabel"><p>一行目<br>二行目</p></span>`
 * のように閉じていない `<br>` のまま `<foreignObject>` へ埋め込む。これによりSVG全体が
 * XMLとして不正になり(Chromiumの `DOMParser` は
 * `Opening and ending tag mismatch: br line 1 and p` を返す)、`<img>` での読み込みが失敗して
 * Excalidraw上で「壊れた画像」アイコンになる。ここでは `dataURL` をデコードし、
 * 閉じていない `<br>` だけを自己終了タグ `<br/>` に置換して再エンコードする。
 * `svg+xml` 以外・すでに閉じている・`<br>` を含まないファイルはそのまま通す。
 */
function fixUnclosedBrInFile(file: BinaryFileData): BinaryFileData {
  if (!file.dataURL.startsWith(SVG_DATA_URL_PREFIX)) return file;
  const svg = decodeBase64Utf8(file.dataURL.slice(SVG_DATA_URL_PREFIX.length));
  const fixedSvg = svg.replace(UNCLOSED_BR_RE, '<br/>');
  if (fixedSvg === svg) return file;
  const fixedDataURL = (SVG_DATA_URL_PREFIX + encodeBase64Utf8(fixedSvg)) as DataURL;
  return { ...file, dataURL: fixedDataURL };
}

/** `fixUnclosedBrInFile` を `files`(id→ファイル)の全エントリへ適用する。 */
function fixUnclosedBrInFiles(files: BinaryFiles): BinaryFiles {
  return Object.fromEntries(
    Object.entries(files).map(([id, file]) => [id, fixUnclosedBrInFile(file)]),
  );
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
 *
 * ここで `<br/>` の後処理を行う理由(背景1・2): このライブラリは `<br/>` を一切解釈せず、
 * ネイティブ変換経路では文字列として素通しし、ラスタ画像フォールバック経路では
 * 閉じていないタグとしてSVGへ埋め込んでしまう(後者はSVGがXMLとして不正になり画像自体が
 * 壊れる)。Mermaidソースの前処理ではなく変換結果に対する後処理として直すのは、
 * ユーザーが書いたMermaid記法そのものは変更したくない(ソースは他の描画系にも渡り得る)のと、
 * ライブラリのこの2つの不具合はライブラリ境界(このファイル)で吸収するのが最も局所的だから。
 */
export async function convertMermaidToElements(text: string): Promise<MermaidConversion> {
  const result = await parseMermaidToExcalidraw(text);
  return {
    elements: result.elements.map(fixBrInLabel),
    ...(result.files !== undefined ? { files: fixUnclosedBrInFiles(result.files) } : {}),
  };
}
