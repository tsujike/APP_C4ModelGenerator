/**
 * ローカルの`.txt`ファイルに「リンク」し、外部エディタ(VSCode等)での保存を自動で画面へ
 * 反映する機能(post-v1.0 FR-8)。
 *
 * 旧来の「保存/開く」ボタン(`ui/fileIO.ts`)は「その場限りのファイルI/O」(1回読む/1回書き出す)で、
 * 読んだ後はメモリ上のソースとファイルの関係を一切覚えなかった。本モジュールはファイルへの参照を
 * 覚え続ける方式でそれを置き換えたもので(旧ボタンはKennyの指示により廃止済み)、
 * `FileSystemFileHandle`(File System Access API)を介してファイルへの参照を保持し続け、
 * ポーリングで外部からの変更(mtime/サイズ)を検知して`onChange`で通知する「片方向の監視」を担う。
 * 書き戻し(`createWritable`)は行わない(やらないこと。リンク中は読み取り専用に倒す設計は
 * `ui/editor.ts`の`setReadOnly`側で行う)。
 *
 * File System Access APIはChrome/Edge系のみの対応(Firefox/Safari非対応)であり、TypeScriptの
 * 標準lib.dom.d.tsにも`showOpenFilePicker`や`FileSystemFileHandle.queryPermission`/
 * `requestPermission`の型が無い(`FileSystemFileHandle`自体は`FileSystemDirectoryHandle.
 * getFileHandle`等の戻り値として既に定義されているが、Permission API相当のメソッドが無い)。
 * `any`は禁止(実装指示書§4)なので、既存グローバル型へのインターフェースマージで最小限だけ補う。
 */

import { FILE_HISTORY_MAX } from '../constants';

declare global {
  interface Window {
    /** File System Access API(Chrome/Edge限定)。非対応ブラウザでは`undefined`。 */
    showOpenFilePicker?: (options?: {
      types?: ReadonlyArray<{ description?: string; accept: Record<string, string[]> }>;
      excludeAcceptAllOption?: boolean;
      multiple?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemFileHandle {
    queryPermission?: (
      descriptor?: FileSystemHandlePermissionDescriptor,
    ) => Promise<PermissionState>;
    requestPermission?: (
      descriptor?: FileSystemHandlePermissionDescriptor,
    ) => Promise<PermissionState>;
  }
}

/** File System Access API(`showOpenFilePicker`)がこの環境で使えるかどうか。 */
export function isFileLinkSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

/**
 * ネイティブのファイル選択ダイアログでテキストファイルを1つ選ばせる。
 * ユーザーがダイアログをキャンセルすると`showOpenFilePicker`は`AbortError`でrejectするため、
 * それだけは「未選択」として`null`に正規化する(呼び出し側が「キャンセル」と「予期しない失敗」を
 * 区別する必要が無いようにする)。それ以外のエラー(まず起こらないが、権限ポリシー等)はそのまま
 * 呼び出し側へ伝播させる(本関数はシステム境界の入口だが、キャンセル以外を握りつぶすと
 * 呼び出し側が失敗に気付けなくなるため)。
 */
export async function pickTextFile(): Promise<FileSystemFileHandle | null> {
  const picker = window.showOpenFilePicker;
  if (picker === undefined) return null;
  try {
    const [handle] = await picker({
      // `.txt`以外にMarkdown/Mermaidの拡張子も受ける(ソースは素のテキストであり、
      // VSCode側でシンタックスハイライトを得るために`.md`/`.mmd`で持つ運用が普通にあるため)。
      // `excludeAcceptAllOption: false`なので、ここに無い拡張子も「すべてのファイル」から選べる。
      types: [
        {
          description: 'テキストファイル',
          accept: { 'text/plain': ['.txt', '.md', '.mmd', '.mermaid'] },
        },
      ],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    return handle ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

/**
 * ハンドルの読み取り権限が既に許可されているか確認し、無ければユーザー操作の文脈で
 * `requestPermission`を呼んで許可を求める。`queryPermission`/`requestPermission`自体が
 * 存在しない古い実装(仕様上は`isFileLinkSupported`がtrueなら通常存在するが、念のため)では
 * 「確認できない」を「不許可」として扱う(安全側)。
 */
export async function ensureReadPermission(handle: FileSystemFileHandle): Promise<boolean> {
  if (handle.queryPermission === undefined || handle.requestPermission === undefined) return false;
  const current = await handle.queryPermission({ mode: 'read' });
  if (current === 'granted') return true;
  const requested = await handle.requestPermission({ mode: 'read' });
  return requested === 'granted';
}

const DB_NAME = 'mermarium';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
/** 履歴配列(`FileHistoryEntry[]`)を1件で丸ごと保持するキー。キーバリューストアなので
 *  DBのバージョン・ストア構成は変えずキーを増やすだけで済む。 */
const HISTORY_KEY = 'fileHistory';

/**
 * `mermarium`データベースの`handles`オブジェクトストアを開く。DBのオープン自体が失敗する
 * (プライベートブラウジング等でIndexedDBが使えない)ケースはシステム境界として`null`に正規化し、
 * 呼び出し側(`loadHistory`/`recordHistory`/`removeFromHistory`)が「永続化なし」として
 * 静かにフォールバックできるようにする。
 */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * `FileSystemFileHandle`らしい値かどうかを最小限だけ確認する(`getFile`が関数であること)。
 * IndexedDBに保存された値の形が壊れている(異なるバージョンのブラウザ実装差・手動でのDB改変等)
 * 場合に、呼び出し側が実体の無いハンドルを掴んで後続処理でクラッシュしないようにするための
 * システム境界の型ガード。
 */
function looksLikeFileHandle(value: unknown): value is FileSystemFileHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { getFile?: unknown }).getFile === 'function'
  );
}

/**
 * ファイルリンク履歴の1件。ユーザーがリンクしたことのあるファイルを「もう一度開く」ための
 * 手がかりだけを持つ。
 *
 * `name`(ファイル名)しか保存できない理由: File System Access APIは`FileSystemFileHandle`から
 * 絶対パス・フォルダ構成を一切開示しない(ブラウザのセキュリティ設計上の制約)ため、
 * 「どのフォルダのファイルか」を履歴の表示や検索の手がかりに使うことはできない。
 */
export interface FileHistoryEntry {
  readonly handle: FileSystemFileHandle;
  readonly name: string;
  /** 最終利用時刻(epoch ms)。新しい順に並べる基準、かつ`formatHistoryTimestamp`の入力。 */
  readonly lastUsedAt: number;
}

/**
 * IndexedDBに保存された値が`FileHistoryEntry`らしいかどうかを最小限だけ確認する。
 * `looksLikeFileHandle`と同じ理由(保存値の形が壊れている場合に後続処理をクラッシュさせない)の
 * システム境界の型ガード。
 */
function looksLikeHistoryEntry(value: unknown): value is FileHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { handle?: unknown; name?: unknown; lastUsedAt?: unknown };
  return (
    looksLikeFileHandle(candidate.handle) &&
    typeof candidate.name === 'string' &&
    typeof candidate.lastUsedAt === 'number'
  );
}

/**
 * 履歴配列をIndexedDBへ丸ごと書き込む(`recordHistory`/`removeFromHistory`の内部実装)。
 * DBが開けない/書き込みに失敗する場合はすべて「永続化なし」として握りつぶす
 * (実装指示書§4「防御的コードは境界のみ」。IndexedDBはユーザー環境依存のシステム境界であり、
 * 永続化は本機能の主目的〈画面への反映〉に対して補助的なベストエフォート機能のため)。
 */
async function writeHistory(entries: readonly FileHistoryEntry[]): Promise<void> {
  const db = await openDb();
  if (db === null) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entries, HISTORY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

/**
 * これまでにリンクした履歴を「最終利用が新しい順」で返す。未保存、DBが開けない、いずれも
 * 空配列に正規化する(呼び出し側=main.tsは「履歴なし」と同じ扱いにできる)。保存値が壊れている
 * 要素(`looksLikeHistoryEntry`を満たさない)は読み飛ばす(1件の破損で履歴全体を失わせないため)。
 * 並び順は`upsertHistoryEntry`が常に「新しい順」で保存する不変条件に依っており、ここでの
 * 読み出し時には並べ替えを行わない。
 */
export async function loadHistory(): Promise<FileHistoryEntry[]> {
  const db = await openDb();
  if (db === null) return [];
  return new Promise<FileHistoryEntry[]>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(HISTORY_KEY);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(Array.isArray(value) ? value.filter(looksLikeHistoryEntry) : []);
      };
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    } finally {
      db.close();
    }
  });
}

/**
 * `a`と`b`が同一ファイルかどうかを`FileSystemHandle.isSameEntry`で判定する安全版。
 * `isSameEntry`自体が存在しない(古い実装)、または呼び出しが失敗する(権限失効等)場合は、
 * 判定不能を「別ファイル」側に倒す(安全側。誤って別ファイルを重複と見なして履歴から
 * 消してしまうより、履歴に同名の2件が残る方が実害が小さいため)。
 */
async function isSameEntrySafe(a: FileSystemFileHandle, b: FileSystemFileHandle): Promise<boolean> {
  if (typeof a.isSameEntry !== 'function') return false;
  try {
    return await a.isSameEntry(b);
  } catch {
    return false;
  }
}

/**
 * `entries`の中から`handle`と同一ファイルの要素のインデックスを探す。`isSameEntry`は非同期の
 * ため配列を順番に(並行にではなく)確認する。見つからなければ`-1`。
 */
async function findDuplicateIndex(
  entries: readonly FileHistoryEntry[],
  handle: FileSystemFileHandle,
): Promise<number> {
  for (let i = 0; i < entries.length; i++) {
    const candidate = entries[i];
    if (candidate === undefined) continue;
    // isSameEntryは非同期のため、並行にではなく1件ずつ順に確認する(先に見つかった方を優先)。
    if (await isSameEntrySafe(candidate.handle, handle)) return i;
  }
  return -1;
}

/**
 * 履歴配列へ1件を追加/更新した新しい配列を返す純関数。重複の有無は呼び出し側(`recordHistory`)が
 * `isSameEntry`で非同期に判定し、`duplicateIndex`(重複なしなら`-1`)として渡す。配列の組み立て
 * 自体は純粋にしておくことで、IndexedDB・`isSameEntry`を一切使わずにテストできるようにする。
 *
 * 挙動: 重複していた要素は取り除いた上で、新しい`entry`を先頭に積む(=最終利用が最新のものが
 * 常に先頭)。結果は`max`件を超えない(超えた分は末尾=最も古いものから溢れる)。
 */
export function upsertHistoryEntry(
  entries: readonly FileHistoryEntry[],
  entry: FileHistoryEntry,
  duplicateIndex: number,
  max: number,
): FileHistoryEntry[] {
  const withoutDuplicate = entries.filter((_, i) => i !== duplicateIndex);
  return [entry, ...withoutDuplicate].slice(0, max);
}

/**
 * `handle`を履歴の先頭へ記録する。同一ファイル(`isSameEntry`)が既に履歴にあれば、それを
 * 取り除いた上で`lastUsedAt`を更新して先頭に入れ直す(重複させない)。件数は`FILE_HISTORY_MAX`まで
 * (超過分は最も古いものから自動的に溢れる。`upsertHistoryEntry`参照)。
 * DBが開けない/書き込みに失敗する場合はすべて「永続化なし」として黙って何もしない
 * (`writeHistory`と同じ方針。ベストエフォート機能のため)。
 */
export async function recordHistory(handle: FileSystemFileHandle, now: number): Promise<void> {
  const existing = await loadHistory();
  const duplicateIndex = await findDuplicateIndex(existing, handle);
  const entry: FileHistoryEntry = { handle, name: handle.name, lastUsedAt: now };
  const updated = upsertHistoryEntry(existing, entry, duplicateIndex, FILE_HISTORY_MAX);
  await writeHistory(updated);
}

/**
 * 履歴から`handle`と同一のファイルを取り除く(ハンドルの権限が失効した・ファイルが見つからない
 * 等で「もう復元できない」と分かった時に呼ぶ)。該当が無ければ何もしない。DBが開けない/
 * 書き込みに失敗する場合はすべて「永続化なし」として黙って何もしない(`writeHistory`と同じ方針)。
 */
export async function removeFromHistory(handle: FileSystemFileHandle): Promise<void> {
  const existing = await loadHistory();
  const index = await findDuplicateIndex(existing, handle);
  if (index === -1) return;
  const updated = existing.filter((_, i) => i !== index);
  await writeHistory(updated);
}

/**
 * epoch ms(`FileHistoryEntry.lastUsedAt`)を履歴表示用のラベル`YYYY-MM-DD HH:mm`(ローカル時刻)に
 * 整形する。秒以下は履歴の識別には不要なため切り捨てる。
 */
export function formatHistoryTimestamp(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const year = String(date.getFullYear());
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * `createFileWatcher`がウォッチ対象に要求する最小インターフェース。`FileSystemFileHandle`は
 * これを満たすが、テストではフェイク実装(`getFile`がPromiseを返すだけの単純なオブジェクト)を
 * 直接渡せるようにするため、構造的型として切り出す(vitestはnode環境でIndexedDB/File System
 * Access APIを持たないため、`createFileWatcher`自体はDOM非依存の純粋なポーリングロジックとして
 * テストする)。
 */
export interface WatchableFileHandle {
  readonly name: string;
  getFile(): Promise<{ lastModified: number; size: number; text(): Promise<string> }>;
}

export interface FileWatcher {
  /** 監視を止める。冪等(複数回呼んでも安全)で、以後はコールバックを一切呼ばない。 */
  stop(): void;
}

/** `setInterval`/`clearInterval`相当の既定スケジューラ(テストでは差し替え可能)。 */
function defaultSchedule(fn: () => void, ms: number): { cancel(): void } {
  const id = setInterval(fn, ms);
  return { cancel: () => clearInterval(id) };
}

/** 既定の可視性判定(タブが裏に回っている間はポーリングをスキップする)。 */
function defaultIsVisible(): boolean {
  return document.visibilityState === 'visible';
}

/**
 * `handle`を`intervalMs`ごとにポーリングし、外部エディタ(VSCode等)による保存を検知する。
 *
 * 変更検知は`lastModified`**または**`size`のいずれかが前回値と異なることで判定する
 * (VSCodeの保存挙動は環境によって、mtimeだけが変わり内容長は変わらない上書き保存も、
 * 逆に内容長だけが実質的な差分の目印になるケースもあり得るため、どちらか一方だけを見ると
 * 検知漏れが起こり得る)。
 *
 * `getFile()`の失敗(ファイル削除・移動・権限失効)はウォッチを止めて`onLost`を1回だけ呼ぶ。
 * `onChange`が例外を投げてもポーリング自体は継続する(1回のコールバック実装ミスで監視全体が
 * 死ぬのを避ける。呼び出し側=main.tsの`editor.setValue`はまず例外を投げない想定だが、
 * ここは「ウォッチャーの動作原則」としてonChangeの中身を信用しない)。
 */
export function createFileWatcher(
  handle: WatchableFileHandle,
  options: {
    intervalMs: number;
    initialLastModified: number;
    initialSize: number;
    onChange: (text: string) => void;
    onLost: (error: unknown) => void;
    schedule?: (fn: () => void, ms: number) => { cancel(): void };
    isVisible?: () => boolean;
  },
): FileWatcher {
  const schedule = options.schedule ?? defaultSchedule;
  const isVisible = options.isVisible ?? defaultIsVisible;

  let stopped = false;
  let lastModified = options.initialLastModified;
  let size = options.initialSize;
  // ポーリング中の重複起動を避ける(前回のgetFile()がまだ解決していない間は次のtickを
  // スキップする。intervalMsに対してgetFile()が遅い場合の多重実行防止)。
  let inFlight = false;
  // `schedule()`の戻り値の`cancel`をtick内(非同期コールバック)から参照するため、変数自体の
  // 再代入ではなく、ミュータブルなコンテナのプロパティを差し替える形にする(`schedule()`呼び出しが
  // 完了する前は、フェイクschedulerが`schedule()`内で同期的にtickを1回発火させたとしても
  // no-opの`cancel`が入っているため安全に呼べる。`prefer-const`とTDZ両方を避けるための単純な形)。
  const scheduledHandle: { cancel(): void } = { cancel: () => {} };

  const tick = (): void => {
    if (stopped || inFlight || !isVisible()) return;
    inFlight = true;
    void handle
      .getFile()
      .then(async (file) => {
        if (stopped) return;
        if (file.lastModified === lastModified && file.size === size) return;
        const text = await file.text();
        if (stopped) return;
        lastModified = file.lastModified;
        size = file.size;
        try {
          options.onChange(text);
        } catch {
          // onChangeの実装ミスでポーリング自体を止めない(このモジュールの責務は監視の継続)。
        }
      })
      .catch((error: unknown) => {
        if (stopped) return;
        stopped = true;
        scheduledHandle.cancel();
        options.onLost(error);
      })
      .finally(() => {
        inFlight = false;
      });
  };

  const scheduled = schedule(tick, options.intervalMs);
  scheduledHandle.cancel = () => {
    scheduled.cancel();
  };

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      scheduledHandle.cancel();
    },
  };
}
