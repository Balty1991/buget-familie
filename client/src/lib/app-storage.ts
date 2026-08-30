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

export function downloadBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(makeBackup(data), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `buget-familie-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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
