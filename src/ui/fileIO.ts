/**
 * エディタのソーステキストをファイルとして保存/読込する(post-v1.0の新機能要望)。
 *
 * これまでのファイル出力(`ui/exporter.ts`)はレンダリング結果(SVG/PNG、FR-6.1/6.2)のみで、
 * 「入力そのもの」(Mermaid-C4 DSLテキスト)をディスクへ書き出す/読み戻す手段が無かった。
 * 本モジュールはその2操作(`.txt`保存・`.txt`読込)を担う。ソース永続化としては
 * localStorage自動保存(FR-1.4、`ui/editor.ts`)と補完関係にある(こちらは明示的なユーザー操作
 * によるファイルI/O、あちらは暗黙の自動保存)。
 *
 * ダウンロードのトリガーは`ui/download.ts`の`downloadBlob`(`ui/exporter.ts`と共有)を使う。
 * DOM操作は`ui/`配下で許可されている(実装指示書§4)。
 */

import { downloadBlob } from './download';

/**
 * Windows/macOS/Linuxでファイル名に使えない文字を除去し、前後の空白を除いた
 * ダウンロードファイル名(拡張子抜き)を決める純関数(テスト可能)。
 * 除去対象は最低限required(`\ / : * ? " < > |`。主にWindowsの禁止文字集合。
 * macOS/Linuxは`/`のみが実質的な禁止文字だが、3OS共通で安全な名前にするため合わせて除去する)。
 * 除去後に空文字列になった場合(例: 入力が禁止文字だけ、または元々空)は`'Untitled'`にフォールバックする。
 */
const INVALID_FILENAME_CHARS_RE = /[\\/:*?"<>|]/g;

export function sanitizeFilename(title: string): string {
  const cleaned = title.replace(INVALID_FILENAME_CHARS_RE, '').trim();
  return cleaned === '' ? 'Untitled' : cleaned;
}

/**
 * ファイル名から最後の拡張子を取り除く(開いたファイルの名前をタイトルへ流用する用途)。
 * ドットが無い、または先頭ドットのみ(隠しファイル`.gitignore`等)の場合はそのまま返す
 * (先頭ドットを拡張子区切りとして扱うと空文字列になり、タイトルとして無意味になるため)。
 */
export function stripFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return filename;
  return filename.slice(0, dotIndex);
}

/** 現在のエディタソースを`<sanitizeFilenameしたタイトル>.txt`としてダウンロードさせる。 */
export function saveSourceAsFile(source: string, title: string): void {
  const filename = `${sanitizeFilename(title)}.txt`;
  downloadBlob(new Blob([source], { type: 'text/plain' }), filename);
}

/**
 * `File`の内容をテキストとして読む(`FileReader`をPromiseでラップする)。
 * 読込失敗(バイナリファイルの誤選択等、稀なケース)はPromise rejectとして呼び出し側へ伝える。
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('ファイルの読込に失敗しました。'));
    };
    reader.readAsText(file);
  });
}
