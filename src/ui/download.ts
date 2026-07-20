/**
 * Blobダウンロードの共有ヘルパー(`<a download>` + ObjectURL の標準パターン)。
 *
 * 元々は `ui/exporter.ts`(FR-6.1/6.2のSVG/PNGエクスポート)専用に実装されていたが、
 * ソーステキストの保存(`.txt`出力)でも全く同じ「Blob→ダウンロード」操作が必要になったため、
 * `ui/`直下の小さな共有モジュールとして切り出した(`exporter.ts`/`fileIO.ts`の両方から使う)。
 * DOM操作は`ui/`配下で許可されている(実装指示書§4。exporter.ts冒頭の申し送り参照)。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
