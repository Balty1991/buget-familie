import type { AppData } from "./finance-data";
import { freeHeavyLocalCache, isQuotaExceededError, safeSetItem } from "./safe-storage";

const DB_NAME = "buget-familie";
const DB_VERSION = 1;
const STORE_NAME = "app";
const DATA_KEY = "data";
const BACKUP_VERSION = 1;
export const SYNC_JOURNAL_KEY = "buget-familie:sync-journal-v1";
export const APP_STORAGE_KEY = "buget-familie:app-data-v6";
export const LEGACY_STORAGE_KEY = "buget-familie:app-data-v3";

export type AppBackup = {
  kind: "buget-familie-backup";
  version: number;
  exportedAt: string;
  data: AppData;
};

export type SyncJournalEntry = {
  id: string;
  conflictId?: string;
  createdAt: string;
  status: "detected" | "resolved" | "failed";
  message: string;
  action: string;
};

export function readSyncJournal(): SyncJournalEntry[] {
  try {
    const raw = window.localStorage.getItem(SYNC_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is SyncJournalEntry => Boolean(item && typeof item === "object" && "id" in item && "createdAt" in item && "status" in item && "message" in item && "action" in item)).slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function writeSyncJournal(entries: SyncJournalEntry[]): void {
  // Jurnal diagnostic — pe quota plină nu blocăm datele financiare.
  safeSetItem(window.localStorage, SYNC_JOURNAL_KEY, JSON.stringify(entries.slice(0, 40)));
}

export const APP_STORAGE_META_KEY = "buget-familie:app-data-meta-v1";

export type AppStorageMeta = { savedAt: string; hash: string };

type StoredEnvelope = { __bf: 1; savedAt: string; hash: string; data: AppData };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nu este disponibil pe acest dispozitiv."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Nu am putut deschide stocarea locală."));
    };
  });
  return dbPromise;
}

/** Hash scurt, stabil, pentru a compara LS și IDB fără a ține tot JSON-ul. */
export function hashAppPayload(serialized: string): string {
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  return Boolean(value && typeof value === "object" && (value as StoredEnvelope).__bf === 1 && (value as StoredEnvelope).data);
}

function unwrapStored(raw: unknown): { data: AppData | null; savedAt: string | null; hash: string | null } {
  if (!raw) return { data: null, savedAt: null, hash: null };
  if (isEnvelope(raw)) return { data: raw.data, savedAt: raw.savedAt || null, hash: raw.hash || null };
  if (typeof raw === "object" && raw !== null && "version" in (raw as object)) {
    return { data: raw as AppData, savedAt: null, hash: null };
  }
  return { data: null, savedAt: null, hash: null };
}

export function readLocalStorageSnapshot(): { data: AppData | null; savedAt: string | null; hash: string | null; raw: string | null } {
  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { data: null, savedAt: null, hash: null, raw: null };
    let meta: AppStorageMeta | null = null;
    try {
      meta = JSON.parse(window.localStorage.getItem(APP_STORAGE_META_KEY) || "null") as AppStorageMeta | null;
    } catch {
      meta = null;
    }
    const parsed = JSON.parse(raw) as unknown;
    const data = parsed && typeof parsed === "object" ? (parsed as AppData) : null;
    return {
      data,
      savedAt: meta?.savedAt || null,
      hash: meta?.hash || (raw ? hashAppPayload(raw) : null),
      raw,
    };
  } catch {
    return { data: null, savedAt: null, hash: null, raw: null };
  }
}

export type WriteLocalSnapshotResult = {
  meta: AppStorageMeta;
  /** true dacă payload-ul complet a încăput în localStorage */
  wroteFull: boolean;
  quotaExceeded: boolean;
};

/**
 * Cache/meta în LS (hydrate rapid). IDB rămâne sursa primară.
 * La QuotaExceeded nu aruncă: eliberează snapshot-ul greu și păstrează doar meta.
 */
export function writeLocalStorageSnapshot(serialized: string, savedAt = new Date().toISOString()): WriteLocalSnapshotResult {
  const meta: AppStorageMeta = { savedAt, hash: hashAppPayload(serialized) };
  try {
    window.localStorage.setItem(APP_STORAGE_KEY, serialized);
    safeSetItem(window.localStorage, APP_STORAGE_META_KEY, JSON.stringify(meta));
    return { meta, wroteFull: true, quotaExceeded: false };
  } catch (error) {
    const quotaExceeded = isQuotaExceededError(error);
    if (quotaExceeded) {
      // Nu dual-write pe quota plină — IDB ține datele; LS doar meta mică.
      freeHeavyLocalCache(window.localStorage);
      safeSetItem(window.localStorage, APP_STORAGE_META_KEY, JSON.stringify(meta));
    }
    return { meta, wroteFull: false, quotaExceeded };
  }
}

/** Normalizează stampile ISO; valori invalide / goale → null. */
export function normalizeSavedAt(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * Alege copia mai nouă între LS (sau memorie) și IndexedDB.
 * Reguli, în ordine:
 * 1. o singură parte are date → aceea;
 * 2. hash egal → IDB (sursă primară stabilă);
 * 3. stampă mai nouă câștigă;
 * 4. stampă egală dar hash diferit → LS (taste recente înainte de debounce IDB ~280ms);
 * 5. fără stampă → LS (migrare / debounce).
 */
export function chooseFresherAppData(
  local: { data: AppData | null; savedAt: string | null; hash: string | null },
  indexed: { data: AppData | null; savedAt: string | null; hash: string | null },
): AppData | null {
  if (!local.data && !indexed.data) return null;
  if (!local.data) return indexed.data;
  if (!indexed.data) return local.data;
  if (local.hash && indexed.hash && local.hash === indexed.hash) return indexed.data;
  const localAt = normalizeSavedAt(local.savedAt);
  const indexedAt = normalizeSavedAt(indexed.savedAt);
  if (localAt && indexedAt) {
    if (localAt > indexedAt) return local.data;
    if (indexedAt > localAt) return indexed.data;
    // Același milisecund: preferăm LS — poate conține taste după ultimul put IDB.
    return local.data;
  }
  if (localAt && !indexedAt) return local.data;
  if (indexedAt && !localAt) return indexed.data;
  // Migrare: fără meta, LS e mai aproape de ultimele taste (IDB e întârziat ~280ms).
  return local.data;
}

/**
 * Rezolvă hydrate-ul de start: dacă utilizatorul a editat înainte ca IDB să răspundă,
 * memoria/LS cu stampă „acum” câștigă; altfel comparăm LS ↔ IDB clasic.
 */
export function resolveHydrateMerge(options: {
  local: { data: AppData | null; savedAt: string | null; hash: string | null };
  indexed: { data: AppData | null; savedAt: string | null; hash: string | null };
  memory: AppData;
  editedBeforeHydrate: boolean;
}): AppData | null {
  const memoryHash = hashAppPayload(JSON.stringify(options.memory));
  if (options.editedBeforeHydrate) {
    const stamped = {
      data: options.memory,
      savedAt: new Date().toISOString(),
      hash: memoryHash,
    };
    return chooseFresherAppData(stamped, options.indexed) || options.memory;
  }
  const localSide = options.local.data
    ? options.local
    : { data: options.memory, savedAt: options.local.savedAt, hash: options.local.hash || memoryHash };
  return chooseFresherAppData(localSide, options.indexed);
}

export async function readAppData(): Promise<AppData | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve(unwrapStored(request.result).data);
    request.onerror = () => reject(request.error || new Error("Nu am putut citi datele locale."));
  });
}

export async function readAppDataRecord(): Promise<{ data: AppData | null; savedAt: string | null; hash: string | null }> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve(unwrapStored(request.result));
    request.onerror = () => reject(request.error || new Error("Nu am putut citi datele locale."));
  });
}

export async function writeAppData(data: AppData, savedAt = new Date().toISOString()): Promise<AppStorageMeta> {
  const db = await openDatabase();
  const hash = hashAppPayload(JSON.stringify(data));
  const envelope: StoredEnvelope = { __bf: 1, savedAt, hash, data };
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(envelope, DATA_KEY);
    request.onsuccess = () => resolve({ savedAt, hash });
    request.onerror = () => reject(request.error || new Error("Nu am putut salva datele locale."));
  });
}

export function makeBackup(data: AppData): AppBackup {
  return { kind: "buget-familie-backup", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function parseBackup(raw: string): AppBackup {
  const parsed = JSON.parse(raw) as Partial<AppBackup>;
  if (parsed.kind !== "buget-familie-backup" || parsed.version !== BACKUP_VERSION || !parsed.data) {
    throw new Error("Fișierul nu este un backup Buget Familie valid.");
  }
  return parsed as AppBackup;
}

/**
 * Pe Android, în WebView-ul aplicației, nici `<a download>`, nici `navigator.share`
 * nu există: ancora nu declanșează nimic, iar Web Share API este o funcție de Chrome,
 * nu de WebView. Butonul „mergea”, dar nu producea niciun fișier. Pe telefon scriem
 * deci fișierul cu plugin-ul nativ de fișiere și abia apoi îl oferim prin foaia de
 * partajare a sistemului. Pe web rămân calea de partajare și descărcarea clasică.
 *
 * Întoarce felul în care s-a terminat, ca interfața să spună adevărul în loc să
 * presupună; „cancelled” înseamnă că utilizatorul a închis foaia de partajare — nu
 * este o eroare.
 */
export type BackupOutcome =
  | { how: "shared" }
  | { how: "saved"; path: string }
  | { how: "downloaded" }
  | { how: "cancelled" }
  | { how: "failed"; reason?: string };

const backupFileName = (stamp = new Date()) =>
  `buget-familie-backup-${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}.json`;

export const isNativeApp = () => {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
};

const isAbort = (error: unknown) =>
  error instanceof Error && (error.name === "AbortError" || /abort|cancel|dismiss/i.test(error.message));

/**
 * Calea nativă. Două lucruri trebuie să meargă și niciunul nu e garantat pe toate
 * telefoanele: scrierea în folderul public Documente (pe Android 10+ accesul direct
 * este restrâns) și foaia de partajare. Așa că încercăm întâi Documente și verificăm
 * prin `stat` că fișierul chiar există, iar dacă nu, scriem în cache — care merge
 * întotdeauna și este expus de FileProvider. Abia apoi deschidem foaia de partajare.
 *
 * Dacă utilizatorul închide foaia, spunem „salvat” doar când fișierul a ajuns undeva
 * unde chiar îl poate găsi; un fișier rămas în cache nu îi folosește la nimic.
 */
async function saveNatively(text: string, name: string): Promise<BackupOutcome> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  const writeTo = async (directory: (typeof Directory)[keyof typeof Directory]) => {
    const written = await Filesystem.writeFile({ path: name, data: text, directory, encoding: Encoding.UTF8, recursive: true });
    // Scrierea poate „reuși” fără ca fișierul să existe pe stocarea restrânsă.
    const info = await Filesystem.stat({ path: name, directory });
    if (!info.size) throw new Error("Fișierul a rămas gol.");
    return written.uri || info.uri;
  };

  let uri = "";
  let visiblePath = "";
  try {
    uri = await writeTo(Directory.Documents);
    visiblePath = `Documente/${name}`;
  } catch {
    uri = await writeTo(Directory.Cache);
  }

  try {
    await Share.share({ title: name, text: name, url: uri, dialogTitle: "Salvează backupul" });
    return { how: "shared" };
  } catch (error) {
    if (visiblePath) return { how: "saved", path: visiblePath };
    if (isAbort(error)) return { how: "cancelled" };
    return { how: "failed", reason: error instanceof Error ? error.message : undefined };
  }
}

export async function downloadBackup(data: AppData): Promise<BackupOutcome> {
  const name = backupFileName();
  const text = JSON.stringify(makeBackup(data), null, 2);

  if (isNativeApp()) {
    try {
      return await saveNatively(text, name);
    } catch (error) {
      return { how: "failed", reason: error instanceof Error ? error.message : undefined };
    }
  }

  const blob = new Blob([text], { type: "application/json" });

  try {
    const file = new File([blob], name, { type: "application/json" });
    const shareApi = navigator as Navigator & { canShare?: (value: { files: File[] }) => boolean };
    if (typeof navigator.share === "function" && shareApi.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return { how: "shared" };
    }
  } catch (error) {
    if (isAbort(error)) return { how: "cancelled" };
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revocarea imediată taie descărcarea pe unele browsere; îi lăsăm un moment.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { how: "downloaded" };
  } catch (error) {
    return { how: "failed", reason: error instanceof Error ? error.message : undefined };
  }
}


export async function clearAppStorage(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Nu am putut goli stocarea locală."));
  });
}


