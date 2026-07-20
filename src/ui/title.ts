/**
 * ドキュメントタイトル(ツールバーのタイトル入力欄)。post-v1.0の新機能要望。
 *
 * L1〜L4のレベルバッジ(FR-5.6)は「今どのズームレベルを見ているか」を表すもので、
 * 「今どのドキュメントを編集しているか」というドキュメント識別とは別の関心事である。
 * 本モジュールはその後者(タイトル)だけを扱う、`ui/editor.ts`(ソース本文の永続化)の
 * 兄弟モジュール。
 *
 * 永続化キーの設計判断: `STORAGE_KEY`(ソース本文、バージョン付き封筒 `{v, source}`)とは
 * 完全に独立した`STORAGE_TITLE_KEY`(素の文字列)を使う(`constants.ts`のコメント参照)。
 * タイトルには「バージョン不一致」のような壊れ方が無い(非空文字列かどうかだけが意味を持つ)
 * ため、`loadPersistedSource`のようなバージョン封筒機構は導入しない。
 *
 * `createTitleField`のsubscribe契約は`camera/camera.ts`・`camera/levelController.ts`と揃える
 * (登録直後に現在値で1回呼ばれ、以後の変化でも呼ばれる)。呼び出し側(main.ts)は
 * `editor.subscribe`→`savePersistedSource`と同じ配線パターンで
 * `titleField.subscribe`→`savePersistedTitle`を1行で済ませられる。
 *
 * DOM操作は`ui/`配下で許可されている(実装指示書§4)。
 */

import { DEFAULT_TITLE, STORAGE_TITLE_KEY } from '../constants';

/**
 * localStorageからタイトルを復元する。以下はすべて「未設定」と同じ扱いでnullを返す
 * (呼び出し側=main.tsが既定値`DEFAULT_TITLE`へフォールバックする):
 * 未保存(キーが無い)、読み出し自体が例外、空文字列(意味のあるタイトルではないため)。
 * `Pick<Storage, 'getItem'>`を受け取ることで、テストでは最小限のフェイクオブジェクトを渡せる
 * (`ui/editor.ts`の`loadPersistedSource`と同じパターン)。
 */
export function loadPersistedTitle(storage: Pick<Storage, 'getItem'>): string | null {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_TITLE_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw.trim() === '') return null;
  return raw;
}

/**
 * タイトルをlocalStorageへ保存する。書き込み失敗(容量超過等)はベストエフォートでよく、
 * 例外を握りつぶす(`savePersistedSource`と同じ理由。実装指示書§4「防御的コードは境界のみ」)。
 */
export function savePersistedTitle(storage: Pick<Storage, 'setItem'>, title: string): void {
  try {
    storage.setItem(STORAGE_TITLE_KEY, title);
  } catch {
    // 容量超過等は無視する(自動保存はベストエフォート。ユーザーへの通知は要件外)。
  }
}

export interface TitleController {
  /** 現在のタイトルを同期的に取得する。 */
  getTitle(): string;
  /** タイトルをプログラム的に差し替える(サンプル読込・ファイル読込から使う)。入力欄にも反映する。 */
  setTitle(title: string): void;
  /** 登録直後に現在値で1回呼ばれ、以後の変化でも呼ばれる(camera.ts/levelControllerと同じ規約)。 */
  subscribe(listener: (title: string) => void): () => void;
}

/**
 * `input`にタイトルフィールドのふるまいを配線する。
 *
 * 空文字列へのフォールバック: ユーザーが入力欄を全消去して確定(change/blur)した場合、
 * 空文字列のままにはせず文字どおりの既定値`DEFAULT_TITLE`('Untitled')へ戻す
 * (要件「何も設定されていない場合は既定でUntitledと表示する」をそのまま適用。
 * 「フィールド作成時の初期値」ではなく常に固定の既定値へ戻す方が、ユーザーが値を消した意図
 * 「タイトルを未設定に戻したい」と素直に一致する)。
 */
export function createTitleField(input: HTMLInputElement, initialTitle: string): TitleController {
  let title = initialTitle;
  input.value = title;
  const listeners = new Set<(title: string) => void>();

  function setState(next: string): void {
    const normalized = next.trim() === '' ? DEFAULT_TITLE : next;
    title = normalized;
    input.value = normalized;
    for (const listener of listeners) listener(title);
  }

  input.addEventListener('change', () => {
    setState(input.value);
  });

  return {
    getTitle() {
      return title;
    },
    setTitle(next) {
      setState(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(title);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
