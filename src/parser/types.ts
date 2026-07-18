/**
 * パーサ全体(splitBlocks / parseC4Block / parseClassBlock)で共有する型定義。
 * parser/ はDOM非依存の純関数のみで構成する(実装指示書§4)。
 */

/** 解析中に見つかった問題。error はその文/行を無視して処理を継続し、warning は情報提供のみ。 */
export interface ParseIssue {
  severity: 'error' | 'warning';
  line: number;
  message: string;
}

/** ソースを分割した際のブロック種別。classDiagramの中身の解析はT1-2(parseClassBlock)の範囲。 */
export type BlockKind = 'C4Context' | 'C4Container' | 'C4Component' | 'classDiagram';

/** C4系(Context/Container/Component)ブロックのみを指す部分集合。parseC4Blockの入力を型で絞る。 */
export type C4BlockKind = Exclude<BlockKind, 'classDiagram'>;

/** ブロック本文の1行。空行・`%%`コメント行はsplitBlocksの時点で除去済み。 */
export interface BlockLine {
  text: string;
  line: number;
}

/** splitBlocksの出力単位。 */
export interface SourceBlock {
  kind: BlockKind;
  startLine: number;
  lines: BlockLine[];
  /**
   * 直前に現れた `%% code-of: <alias>` 指令の値。classDiagramブロックのみが意味を持ち、
   * T1-2でComponentへの結び付けに使う。C4系ブロックでは無視してよい。
   */
  codeOfAlias?: string;
}

// ---- C4系(Context/Container/Component)ブロックのAST ----

export type ElementKind = 'person' | 'system' | 'container' | 'component';
export type ElementVariant = 'default' | 'db' | 'queue';

export interface ElementStatement {
  type: 'element';
  kind: ElementKind;
  variant: ElementVariant;
  external: boolean;
  alias: string;
  label: string;
  technology?: string;
  description?: string;
  line: number;
}

export type BoundaryKind = 'system' | 'container' | 'enterprise';

export interface BoundaryStatement {
  type: 'boundary';
  boundaryKind: BoundaryKind;
  alias: string;
  label: string;
  /** Boundary内に現れた文(要素・入れ子Boundary・Rel等)。統一モデル構築(T1-3)はこれを辿る。 */
  children: C4Statement[];
  line: number;
  /** 対応する `}` が無くブロック終端で暗黙的にクローズされた場合true。 */
  closedImplicitly: boolean;
}

export interface RelStatement {
  type: 'rel';
  from: string;
  to: string;
  label?: string;
  technology?: string;
  bidirectional: boolean;
  line: number;
}

export type C4Statement = ElementStatement | BoundaryStatement | RelStatement;

export interface C4BlockAst {
  kind: C4BlockKind;
  startLine: number;
  statements: C4Statement[];
}

export interface ParseC4BlockResult {
  ast: C4BlockAst;
  issues: ParseIssue[];
}

// ---- classDiagram ブロックのAST(T1-2で定義、T1-3で本ファイルに統合) ----

/** classDiagram ブロック本文の1行。行番号はエディタでのジャンプ・エラー表示に使う。 */
export interface ClassBlockLine {
  readonly line: number;
  readonly text: string;
}

/** サポートする矢印種別。継承(`--|>`)のみ描画時に白抜き三角として区別される。 */
export type ClassEdgeArrow = '-->' | '--|>' | '*--' | 'o--' | '..>';

/** `class Name { ... }` から得られるクラスノード。 */
export interface ClassDeclNode {
  readonly kind: 'class';
  readonly name: string;
  readonly fields: string[];
  readonly methods: string[];
  readonly sourceLine: number;
}

/** クラス間の関係を表すエッジノード。declaredLevel=4 は呼び出し側(model層)の責務。 */
export interface ClassEdgeNode {
  readonly kind: 'edge';
  readonly from: string;
  readonly to: string;
  readonly arrow: ClassEdgeArrow;
  readonly label?: string;
  readonly sourceLine: number;
}

/**
 * classDiagram ブロック1つ分のAST。
 * codeOf は `%% code-of: <componentAlias>` 指令の値。指令行の抽出自体は
 * splitBlocks(T1-1)の担当のため、ここでは呼び出し側から渡された値をそのまま保持するだけでよい。
 */
export interface ClassBlockAst {
  readonly codeOf: string | undefined;
  readonly classes: ClassDeclNode[];
  readonly edges: ClassEdgeNode[];
}
