/**
 * 統一モデル(C4Model)の型定義(設計書 docs/02_アーキテクチャ設計書.md §4)。
 * `model/` はDOM非依存の純関数のみで構成する(実装指示書§4)。
 *
 * 注: ParseIssue は独自定義せず parser/types.ts のものをそのまま使う(設計書§4の注記どおり)。
 */

export type NodeKind = 'person' | 'system' | 'container' | 'component' | 'class' | 'boundary'; // Enterprise_Boundary等の純粋なグループ
export type NodeVariant = 'default' | 'db' | 'queue';
export type Level = 1 | 2 | 3 | 4; // Context/Containers/Components/Code

export interface C4Node {
  alias: string; // ソース内で一意。グローバル名前空間
  label: string;
  kind: NodeKind;
  variant: NodeVariant;
  external: boolean; // *_Ext
  technology?: string;
  description?: string;
  level: Level; // この要素が「登場する」レベル
  children: C4Node[]; // 下位レベル要素(System→Container→Component→Class)
  parent?: C4Node;
  members?: { fields: string[]; methods: string[] }; // kind==='class' のみ
  sourceLine: number;
}

export interface C4Edge {
  from: string; // alias参照
  to: string;
  label?: string;
  technology?: string;
  bidirectional: boolean;
  declaredLevel: Level; // 宣言されたブロックのレベル
  sourceLine: number;
}

export interface C4Model {
  roots: C4Node[]; // L1要素(Person/System/外部システム)
  byAlias: Map<string, C4Node>;
  edges: C4Edge[];
}
