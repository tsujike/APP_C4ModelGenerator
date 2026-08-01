/**
 * CodeMirror 6 エディタ(設計書 docs/02_アーキテクチャ設計書.md §2の `ui/editor.ts`)。
 *
 * T4-1のスコープ: 行番号・等幅・StreamLanguageによる最小限のシンタックスハイライト・
 * 300msデバウンスでのテキスト変更通知(FR-1.2)。
 * T4-2で追加: 該当行へのジャンプ(`jumpToLine`。issuesPanelのクリックから使う)、
 * 内容の丸ごと差し替え(`setValue`。サンプル読込から使う)、localStorage永続化(FR-1.4)の
 * 読み書き関数。
 *
 * デバウンスをここ(ui/editor.ts)に置いた理由: 設計書§2のディレクトリ構成表が
 * `ui/editor.ts` の役割を「エディタ、デバウンス、localStorage」と明記しており、
 * 「テキスト変更の生成源」と「変更通知の間引き」は同じ関心事(エディタの入力体験)である。
 * main.ts側にデバウンスを置くと、main.tsが「エディタの入力タイミング」という実装詳細まで
 * 知る必要が生じ、camera.ts/levelControllerが確立した「1関心事=1コントローラ」パターン
 * (呼び出し側は完成した状態変化だけを受け取る)から外れる。同じ理由で、localStorageへの
 * 自動保存もmain.ts側で新しいデバウンスを作らず、`editor.subscribe`(既存の300msデバウンス済み
 * 通知)にリスナーを1つ追加するだけにする(main.ts参照)。
 *
 * DOM操作は `excal/` と `ui/` のみに許される(実装指示書§4)。本ファイルはその `ui/` 側。
 * localStorageの読み書きはDOM操作ではないが、設計書§2の役割表どおりここに置く。読み出しは
 * ユーザー環境由来の値(システム境界)のため、破損時はnullを返し例外を投げない(呼び出し側=
 * main.tsが初期サンプルへフォールバックする。実装指示書§4「防御的コードは境界のみ」)。
 */

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EDITOR_DEBOUNCE_MS, STORAGE_KEY, STORAGE_VERSION } from '../constants';

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
  /**
   * T4-2: 該当行にカーソルを移動しスクロールして表示する(issuesPanelのクリックジャンプで使う)。
   * `line` はソース上の1始まりの行番号。ドキュメントの行数を超える/0以下の場合は範囲内に
   * クランプする(古いissuesのクリック等、行番号が現在の内容とずれるケースへの単純な防御)。
   */
  jumpToLine(line: number): void;
  /**
   * T4-2: エディタ内容を丸ごと差し替える(サンプル読込で使う)。通常の編集と同じ経路
   * (`docChanged`)で300msデバウンス済み通知が飛ぶため、呼び出し側は「通常の編集パイプライン」
   * にそのまま乗る(再解析・localStorage保存とも同じ経路。main.ts参照)。
   */
  setValue(source: string): void;
  /**
   * post-v1.0(FR-8): 読み取り専用状態を切り替える(ファイルリンク中は編集を外部エディタ側に
   * 譲る。`ui/fileLink.ts`のウォッチャーが検知した変更で`setValue`を呼ぶ間、ユーザーの手入力が
   * 競合して上書きし合うのを防ぐ)。
   * `EditorState.readOnly`だけを切り替えるとカーソルは表示されるが編集不可という中途半端な
   * 見た目になる(CodeMirrorの既知の仕様: `readOnly`はディスパッチを拒否するだけで、
   * `contenteditable`自体は`editable`コンパートメントが制御する)ため、`EditorView.editable`も
   * 同時に切り替える。
   */
  setReadOnly(readOnly: boolean): void;
  /** CodeMirrorビューを破棄し、保留中のデバウンスも取り消す(後始末用)。 */
  destroy(): void;
}

/**
 * localStorageペイロードの形式(FR-1.4)。バージョンを持たせ、形式不一致を「破損」と同列に
 * 扱えるようにする(生の文字列をそのまま保存する案もあったが、「破損時は無視」という要件の
 * 意味をより素直に表現できるこちらを採用)。
 */
interface PersistedSourcePayload {
  v: number;
  source: string;
}

/**
 * localStorageからソースを復元する(FR-1.4)。以下はすべて「破損」と同じ扱いでnullを返す
 * (呼び出し側=main.tsが初期サンプルへフォールバックする):
 * 未保存(キーが無い)、読み出し自体が例外(プライベートブラウジング等でのアクセス拒否)、
 * JSON構文エラー、期待する形(`{v, source}`)と不一致、バージョン不一致。
 * `Pick<Storage, 'getItem'>` を受け取ることで、テストでは `window.localStorage` 全体ではなく
 * 最小限のフェイクオブジェクトを渡せる。
 */
export function loadPersistedSource(storage: Pick<Storage, 'getItem'>): string | null {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const payload = parsed as Partial<PersistedSourcePayload>;
  if (payload.v !== STORAGE_VERSION || typeof payload.source !== 'string') return null;
  return payload.source;
}

/**
 * ソースをlocalStorageへ保存する(FR-1.4)。書き込み失敗(容量超過等)は自動保存という機能の
 * 性質上ベストエフォートでよく、致命的でないため例外を握りつぶす(実装指示書§4「防御的コードは
 * 境界のみ」— localStorageはユーザー環境依存のシステム境界)。
 */
export function savePersistedSource(storage: Pick<Storage, 'setItem'>, source: string): void {
  try {
    const payload: PersistedSourcePayload = { v: STORAGE_VERSION, source };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 容量超過等は無視する(FR-1.4はベストエフォートの自動保存であり、ユーザーへの通知は要件外)。
  }
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

  // post-v1.0(FR-8): 読み取り専用の切り替え用コンパートメント。`setReadOnly`はこの2つの
  // コンパートメントの中身だけを差し替える(他の拡張には触れない)。
  const readOnlyCompartment = new Compartment();
  const editableCompartment = new Compartment();

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
        readOnlyCompartment.of(EditorState.readOnly.of(false)),
        editableCompartment.of(EditorView.editable.of(true)),
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
    jumpToLine(line) {
      const doc = view.state.doc;
      const clamped = Math.min(Math.max(Math.trunc(line), 1), doc.lines);
      const lineInfo = doc.line(clamped);
      view.dispatch({
        selection: EditorSelection.cursor(lineInfo.from),
        effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
      });
      view.focus();
    },
    setValue(source) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: source },
      });
    },
    setReadOnly(readOnly) {
      view.dispatch({
        effects: [
          readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
          editableCompartment.reconfigure(EditorView.editable.of(!readOnly)),
        ],
      });
    },
    destroy() {
      notify.cancel();
      view.destroy();
    },
  };
}
