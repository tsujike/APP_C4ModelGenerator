/**
 * elkjs の `elk-worker.js` サブパス用アンビエント型宣言。
 *
 * elkjs 同梱の `elk-worker.d.ts` は `export type Worker = Worker;` という型のみの宣言で、
 * 実際の値(層生成に使うFakeWorkerコンストラクタ)を宣言していない。elkjsのメインエントリ
 * (`import ELK from 'elkjs'`)は `lib/main.js` を経由し、そこに含まれる `require('web-worker')`
 * が(実行時には到達しないコードでも)Viteの本番ビルド(Rolldown)で解決エラーになるため、
 * layout.ts では `elk-api.js` + `elk-worker.js` を直接組み合わせてブラウザ安全に構成する
 * (layout.ts 冒頭のコメント参照)。この宣言はその際に必要な値エクスポートの型を補う。
 */
declare module 'elkjs/lib/elk-worker.js' {
  const Worker: new () => globalThis.Worker;
  export { Worker };
}
