/**
 * CodeMirror 6 エディタ(設計書 docs/02_アーキテクチャ設計書.md §2の `ui/editor.ts`)。
 *
 * T4-1のスコープ: 行番号・等幅・StreamLanguageによる最小限のシンタックスハイライト・
 * 300msデバウンスでのテキスト変更通知(FR-1.2)。localStorage永続化(FR-1.4)・サンプル読込
 * (FR-1.5)はT4-2のスコープであり、ここでは扱わない。
 *
 * デバウンスをここ(ui/editor.ts)に置いた理由: 設計書§2のディレクトリ構成表が
 * `ui/editor.ts` の役割を「エディタ、デバウンス、localStorage」と明記しており、
 * 「テキスト変更の生成源」と「変更通知の間引き」は同じ関心事(エディタの入力体験)である。
 * main.ts側にデバウンスを置くと、main.tsが「エディタの入力タイミング」という実装詳細まで
 * 知る必要が生じ、camera.ts/levelControllerが確立した「1関心事=1コントローラ」パターン
 * (呼び出し側は完成した状態変化だけを受け取る)から外れる。
 *
 * DOM操作は `excal/` と `ui/` のみに許される(実装指示書§4)。本ファイルはその `ui/` 側。
 */

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EDITOR_DEBOUNCE_MS } from '../constants';

/** 呼び出しから`ms`経過後まで実行を遅延し、その間の再呼び出しはタイマーを再スタートする(FR-1.2)。 */
export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  /** 保留中の実行を破棄する(destroy時の後始末用)。 */
  cancel(): void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = ((...args: Args) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  }) as Debounced<Args>;
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}

/** ブロックキーワード(設計書§5.1のブロック種別)。 */
const BLOCK_KEYWORDS = new Set(['C4Context', 'C4Container', 'C4Component', 'classDiagram']);
/** Boundary系キーワード(parser/parseC4Block.tsのBOUNDARY_KEYWORDSに対応)。 */
const BOUNDARY_KEYWORDS = new Set(['System_Boundary', 'Container_Boundary', 'Enterprise_Boundary']);
/** Person/System/Container/Component の基底語+Db/Queue+_Extサフィックス(parseC4Block.tsのmatchElementKeywordに対応)。 */
const ELEMENT_KEYWORD_RE = /^(Person|System|Container|Component)(Db|Queue)?(_Ext)?$/;
/** Rel/Rel_U等の方向付きRel、BiRel(parseC4Block.tsのREL_KEYWORD_PATTERNに対応)。 */
const REL_KEYWORD_RE = /^(Rel(_[A-Za-z]+)?|BiRel)$/;
/** classDiagram本体・無視される装飾文(parseC4Block.tsのIGNORED_KEYWORDSの一部)。 */
const OTHER_KEYWORDS = new Set(['class', 'title']);

/**
 * 識別子1語をハイライト用のタグ名に分類する(純関数。テスト可能)。
 * DSLの正確な文法判定はparser/が担うため、ここでは表示上の強調だけを目的にした簡易分類でよい
 * (指示書「簡易ハイライトはStreamLanguageで最小限」「補完・lintは やらないこと」)。
 * 戻り値は `@lezer/highlight` の標準タグ名(`token()`の契約どおり)。
 */
export function classifyKeyword(word: string): 'keyword' | 'typeName' | null {
  if (BLOCK_KEYWORDS.has(word)) return 'keyword';
  if (BOUNDARY_KEYWORDS.has(word)) return 'keyword';
  if (REL_KEYWORD_RE.test(word)) return 'keyword';
  if (OTHER_KEYWORDS.has(word)) return 'keyword';
  if (ELEMENT_KEYWORD_RE.test(word)) return 'typeName';
  return null;
}

/** DSL全体に対する最小限のStreamLanguage(コメント`%%`・文字列・キーワードのみを区別する)。 */
const c4Language = StreamLanguage.define({
  token(stream) {
    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"?/)) {
      return 'string';
    }
    const word = stream.match(/[A-Za-z_][A-Za-z0-9_]*/, true);
    if (word) {
      return classifyKeyword(stream.current());
    }
    stream.next();
    return null;
  },
});

export interface EditorController {
  /** 現在のエディタ内容を同期的に取得する。 */
  getValue(): string;
  /**
   * テキスト変更を300msデバウンスして通知する(FR-1.2)。登録直後には呼ばれない
   * (camera.ts/levelControllerのsubscribeとは異なり、初期値は`getValue()`で取得する規約。
   * 初期表示は既にmain.tsがcreateEditor呼び出し直後の`getValue()`で行うため、購読側へ
   * 「変更が無いのに1回目が飛んでくる」ことを避けるための単純化)。
   */
  subscribe(listener: (source: string) => void): () => void;
  /** CodeMirrorビューを破棄し、保留中のデバウンスも取り消す(後始末用)。 */
  destroy(): void;
}

/**
 * `container` にCodeMirror 6エディタをマウントする。行番号・等幅フォント・簡易ハイライトのみ。
 * 補完・lint gutterは実装しない(指示書「やらないこと」)。
 */
export function createEditor(container: HTMLElement, initialValue: string): EditorController {
  const listeners = new Set<(source: string) => void>();

  const notify = debounce((source: string) => {
    for (const listener of listeners) listener(source);
  }, EDITOR_DEBOUNCE_MS);

  const view = new EditorView({
    parent: container,
    state: EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        c4Language,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) notify(update.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    getValue() {
      return view.state.doc.toString();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      notify.cancel();
      view.destroy();
    },
  };
}
