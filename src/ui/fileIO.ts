/**
 * エディタのソーステキストに関わる、ファイル名・ファイル読込まわりの小さなヘルパー群。
 *
 * post-v1.0のファイルI/Oは「その場限りの保存/開く」ではなく`ui/fileLink.ts`の
 * `FileSystemFileHandle`ベースのファイルリンク機能(`main.ts`の`setupFileLink`)に一本化されている
 * (ダウンロード保存による旧経路は廃止済み)。本モジュールに残る`stripFileExtension`
 * (リンク/読込したファイル名からタイトルを作る)と`readFileAsText`(File System Access API
 * 非対応ブラウザ向けの一回読み込みフォールバック)は、その`setupFileLink`から使われる。
 */

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
