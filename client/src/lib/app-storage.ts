import type { AppData } from "./finance-data";

const DB_NAME = "buget-familie";
const DB_VERSION = 1;
const STORE_NAME = "app";
const DATA_KEY = "data";
const BACKUP_VERSION = 1;
export const SYNC_JOURNAL_KEY = "buget-familie:sync-journal-v1";

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
  try {
    window.localStorage.setItem(SYNC_JOURNAL_KEY, JSON.stringify(entries.slice(0, 40)));
  } catch {
    // The journal is diagnostic metadata; a full browser quota must not block finance data.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Nu am putut deschide stocarea locală."));
  });
}

export async function readAppData(): Promise<AppData | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve((request.result as AppData | undefined) || null);
    request.onerror = () => reject(request.error || new Error("Nu am putut citi datele locale."));
  });
}

export async function writeAppData(data: AppData): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(data, DATA_KEY);
    request.onsuccess = () => resolve();
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

export const APP_STORAGE_KEY = "buget-familie:app-data-v6";
export const LEGACY_STORAGE_KEY = "buget-familie:app-data-v3";
