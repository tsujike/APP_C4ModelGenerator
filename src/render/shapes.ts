/**
 * 1つの論理C4ノードをExcalidraw要素群(同一groupIdsで束ねたグループ)に合成する
 * (設計書 docs/02_アーキテクチャ設計書.md §7.2)。
 *
 * `render/` は `layout/` の型に依存しない(実装指示書§4: layout/とrender/は互いにimportしない。
 * 例外は toExcalidraw.ts が layout の出力型を消費すること)。そのため呼び出し側(toExcalidraw.ts)が
 * LayoutNode をここで定義する NodeShapeInput に変換して渡す。
 *
 * `@excalidraw/excalidraw` からは型のみ(`ExcalidrawElementSkeleton`)をimportする。
 * React/JSXはimportしない(CLAUDE.md: Reactは src/excal/host.tsx に閉じる)。
 * このファイルが返す ExcalidrawElementSkeleton[] は、host.tsx側で
 * `convertToExcalidrawElements` に渡されて初めて実際のExcalidraw要素になる。
 */

import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import { LAYOUT } from '../constants';
import type { NodeKind, NodeVariant } from '../model/types';
import {
  BOUNDARY_STROKE_COLOR,
  BOUNDARY_TEXT_COLOR,
  ROUGHNESS,
  STROKE_WIDTH,
  nodeColors,
} from './theme';

/** buildNodeElements の入力。1論理ノード分(toExcalidraw.tsがLayoutNodeから変換して渡す)。 */
export interface NodeShapeInput {
  /** 決定的id生成に使うalias(§7.2の例: "api")。 */
  id: string;
  /** id接頭辞(表示レベル。例: "L2")。 */
  levelPrefix: string;
  kind: NodeKind;
  variant: NodeVariant;
  external: boolean;
  label: string;
  technology?: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** true: 子を持つ展開枠(境界)スタイル。false: 種別色の葉ボックス(§6手順1)。 */
  isBoundary: boolean;
}

/** ノード1つ分のExcalidraw要素群(グループ化済み)を返す。 */
export function buildNodeElements(input: NodeShapeInput): ExcalidrawElementSkeleton[] {
  if (input.isBoundary) return buildBoundaryElements(input);
  if (input.kind === 'person') return buildPersonElements(input);
  if (input.variant === 'db') return buildDbElements(input);
  if (input.variant === 'queue') return buildQueueElements(input);
  return buildBoxElements(input);
}

function elementId(input: Pick<NodeShapeInput, 'levelPrefix' | 'id'>, part: string): string {
  return `${input.levelPrefix}:${input.id}:${part}`;
}

/** Boundary(展開枠): strokeStyle dashed の矩形+左上ラベル、塗りなし(§7.2)。 */
function buildBoundaryElements(input: NodeShapeInput): ExcalidrawElementSkeleton[] {
  const groupId = elementId(input, 'group');
  const box: ExcalidrawElementSkeleton = {
    id: elementId(input, 'box'),
    type: 'rectangle',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    backgroundColor: 'transparent',
    strokeColor: BOUNDARY_STROKE_COLOR,
    fillStyle: 'solid',
    strokeStyle: 'dashed',
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    groupIds: [groupId],
  };
  const label: ExcalidrawElementSkeleton = {
    id: elementId(input, 'label'),
    type: 'text',
    x: input.x + LAYOUT.boundaryPadding,
    y: input.y + LAYOUT.boundaryPadding / 2,
    width: input.width - LAYOUT.boundaryPadding * 2,
    text: truncateSingleLine(
      input.label,
      estimateCharsPerLine(input.width - LAYOUT.boundaryPadding * 2),
    ),
    fontSize: LAYOUT.fontSize,
    textAlign: 'left',
    strokeColor: BOUNDARY_TEXT_COLOR,
    groupIds: [groupId],
    autoResize: false,
  };
  return [box, label];
}

/** System/Container/Component等の通常の葉ボックス: 角丸rectangle+テキスト。 */
function buildBoxElements(input: NodeShapeInput): ExcalidrawElementSkeleton[] {
  const groupId = elementId(input, 'group');
  const colors = nodeColors(input.kind, input.external);
  const box: ExcalidrawElementSkeleton = {
    id: elementId(input, 'box'),
    type: 'rectangle',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    backgroundColor: colors.background,
    strokeColor: colors.background,
    fillStyle: 'solid',
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    roundness: { type: 3 },
    groupIds: [groupId],
  };
  const text = buildTextElement(
    input,
    colors.text,
    groupId,
    'text',
    input.x,
    input.y,
    input.width,
    input.height,
  );
  return [box, text];
}

/** Queue variant: 横長の角丸rectangle(両端ellipseは§7.2の指示どおり省略)。 */
function buildQueueElements(input: NodeShapeInput): ExcalidrawElementSkeleton[] {
  return buildBoxElements(input);
}

/** Person: 角丸rectangle(胴体)+頭部ellipseのグループ(§7.2)。 */
function buildPersonElements(input: NodeShapeInput): ExcalidrawElementSkeleton[] {
  const groupId = elementId(input, 'group');
  const colors = nodeColors('person', input.external);
  const headDiameter = Math.min(LAYOUT.personHeadDiameter, input.width, input.height / 2);
  const headOverlap = 4; // 頭部と胴体をわずかに重ねて1つの人型に見せる。
  const headX = input.x + input.width / 2 - headDiameter / 2;
  const headY = input.y;
  const bodyY = input.y + headDiameter - headOverlap;
  const bodyHeight = Math.max(1, input.height - (headDiameter - headOverlap));

  const head: ExcalidrawElementSkeleton = {
    id: elementId(input, 'head'),
    type: 'ellipse',
    x: headX,
    y: headY,
    width: headDiameter,
    height: headDiameter,
    backgroundColor: colors.background,
    strokeColor: colors.background,
    fillStyle: 'solid',
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    groupIds: [groupId],
  };
  const body: ExcalidrawElementSkeleton = {
    id: elementId(input, 'box'),
    type: 'rectangle',
    x: input.x,
    y: bodyY,
    width: input.width,
    height: bodyHeight,
    backgroundColor: colors.background,
    strokeColor: colors.background,
    fillStyle: 'solid',
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    roundness: { type: 3 },
    groupIds: [groupId],
  };
  const text = buildTextElement(
    input,
    colors.text,
    groupId,
    'text',
    input.x,
    bodyY,
    input.width,
    bodyHeight,
  );
  return [head, body, text];
}

/** Db variant: rectangle+上部ellipseによるシリンダー近似(§7.2)。 */
function buildDbElements(input: NodeShapeInput): ExcalidrawElementSkeleton[] {
  const groupId = elementId(input, 'group');
  const colors = nodeColors(input.kind, input.external);
  const capHeight = Math.min(20, input.height / 4);

  const box: ExcalidrawElementSkeleton = {
    id: elementId(input, 'box'),
    type: 'rectangle',
    x: input.x,
    y: input.y + capHeight / 2,
    width: input.width,
    height: input.height - capHeight / 2,
    backgroundColor: colors.background,
    strokeColor: colors.background,
    fillStyle: 'solid',
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    groupIds: [groupId],
  };
  const top: ExcalidrawElementSkeleton = {
    id: elementId(input, 'top'),
    type: 'ellipse',
    x: input.x,
    y: input.y,
    width: input.width,
    height: capHeight,
    backgroundColor: colors.background,
    strokeColor: colors.background,
    fillStyle: 'solid',
    roughness: ROUGHNESS,
    strokeWidth: STROKE_WIDTH,
    groupIds: [groupId],
  };
  const text = buildTextElement(
    input,
    colors.text,
    groupId,
    'text',
    input.x,
    input.y + capHeight,
    input.width,
    input.height - capHeight,
  );
  return [box, top, text];
}

/** ノード内テキスト(1行目label、2行目[technology]、3行目以降description折返し最大3行、§7.2)。 */
function buildTextElement(
  input: Pick<NodeShapeInput, 'levelPrefix' | 'id' | 'label' | 'technology' | 'description'>,
  color: string,
  groupId: string,
  part: string,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
): ExcalidrawElementSkeleton {
  const lines = buildTextLines(input, boxWidth);
  return {
    id: elementId(input, part),
    type: 'text',
    // 重要: Excalidrawの `newTextElement` は textAlign:'center' + verticalAlign:'middle' の
    // とき、渡された x/y を「左上」ではなく実測テキストサイズに基づく「中心点」として扱う
    // (`x: opts.x - metrics.width/2, y: opts.y - metrics.height/2` という実装。ブラウザで
    // 実際に生成された要素を検証して判明した)。左上を渡すと実測幅の半分だけ左に、実測高さの
    // 半分だけ上にずれ、見積り幅とのズレが大きい語(日本語混じり等)では隣接ノードにまで
    // はみ出す。そのためここでは常にボックス中心を渡し、実測サイズによらず正しく中心に
    // 描画されるようにする(width/heightは指定しても実測値で上書きされるため渡さない)。
    x: boxX + boxWidth / 2,
    y: boxY + boxHeight / 2,
    text: lines.join('\n'),
    fontSize: LAYOUT.fontSize,
    textAlign: 'center',
    verticalAlign: 'middle',
    strokeColor: color,
    groupIds: [groupId],
    autoResize: false,
  };
}

function buildTextLines(
  input: Pick<NodeShapeInput, 'label' | 'technology' | 'description'>,
  boxWidth: number,
): string[] {
  const charsPerLine = estimateCharsPerLine(boxWidth - LAYOUT.nodePaddingX * 2);
  const lines: string[] = [truncateSingleLine(input.label, charsPerLine)];
  if (input.technology !== undefined) {
    lines.push(truncateSingleLine(`[${input.technology}]`, charsPerLine));
  }
  if (input.description !== undefined) {
    lines.push(...wrapCharacters(input.description, charsPerLine, LAYOUT.maxDescriptionLines));
  }
  return lines;
}

function estimateCharsPerLine(availableWidth: number): number {
  const charWidth = LAYOUT.fontSize * LAYOUT.charWidthFactor;
  return Math.max(1, Math.floor(availableWidth / charWidth));
}

function truncateSingleLine(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * 文字数ベースの単純な折返し(§7.1/§7.2: 厳密測定は不要)。maxLinesを超える残りがあれば
 * 最終行を "…" で切り詰める。layout/layout.ts にも寸法見積り用の同種のロジックがあるが、
 * layout/ と render/ は互いにimportしない(実装指示書§4)ため、意図的に軽量に重複させている。
 */
function wrapCharacters(text: string, charsPerLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest.length > 0 && lines.length < maxLines) {
    if (rest.length <= charsPerLine) {
      lines.push(rest);
      rest = '';
      break;
    }
    lines.push(rest.slice(0, charsPerLine));
    rest = rest.slice(charsPerLine);
  }
  if (rest.length > 0) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] =
      last.length > 0 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : '…';
  }
  return lines;
}
