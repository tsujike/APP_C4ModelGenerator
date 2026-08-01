/**
 * ローカルの`.txt`ファイルに「リンク」し、外部エディタ(VSCode等)での保存を自動で画面へ
 * 反映する機能(post-v1.0 FR-8)。
 *
 * 既存の`ui/fileIO.ts`(保存/開くボタン)は「その場限りのファイルI/O」(1回読む/1回書き出す)で、
 * 読んだ後はメモリ上のソースとファイルの関係を一切覚えない。本モジュールはそれとは別系統で、
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
const HANDLE_KEY = 'linkedFile';

/**
 * `mermarium`データベースの`handles`オブジェクトストアを開く。DBのオープン自体が失敗する
 * (プライベートブラウジング等でIndexedDBが使えない)ケースはシステム境界として`null`に正規化し、
 * 呼び出し側(`persistHandle`/`restoreHandle`/`clearPersistedHandle`)が「永続化なし」として
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
 * `FileSystemFileHandle`をIndexedDBへ保存する(次回起動時に`restoreHandle`で読み戻すため)。
 * DBが開けない/書き込みに失敗する場合はすべて「永続化なし」として握りつぶす
 * (実装指示書§4「防御的コードは境界のみ」。IndexedDBはユーザー環境依存のシステム境界であり、
 * 永続化は本機能の主目的〈画面への反映〉に対して補助的なベストエフォート機能のため)。
 */
export async function persistHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  if (db === null) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
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
 * 前回`persistHandle`で保存したハンドルを復元する。未保存、DBが開けない、保存値が
 * `FileSystemFileHandle`らしくない、のいずれも「復元できない」として`null`に正規化する
 * (呼び出し側=main.tsは「未リンク」と同じ扱いにできる)。
 */
export async function restoreHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openDb();
  if (db === null) return null;
  return new Promise<FileSystemFileHandle | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(looksLikeFileHandle(value) ? value : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

/** 永続化済みのハンドルを消す(リンク解除時に「ファイルが見つからない」等で使う)。 */
export async function clearPersistedHandle(): Promise<void> {
  const db = await openDb();
  if (db === null) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
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
