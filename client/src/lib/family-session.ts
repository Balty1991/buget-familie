/**
 * Sesiunea familiei păstrată pe acest telefon, ca sincronizarea să se reia după ce
 * Android închide aplicația. Parola nu se salvează: rămâne doar cheia PBKDF2 făcută din
 * ea, neexportabilă (nu poate fi citită înapoi ca text), și ID-ul camerei.
 * Totul stă în IndexedDB, nu în localStorage și nu în pachetul sincronizat.
 */

const DATABASE_NAME = "buget-familie-sync";
const DATABASE_VERSION = 1;
const STORE_NAME = "session";
const SESSION_KEY = "family";

export type FamilySession = { roomId: string; material: CryptoKey; savedAt: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Sesiunea familiei nu a putut fi deschisă."));
  });
}

async function run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const database = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

const isSession = (value: unknown): value is FamilySession => {
  const item = value as Partial<FamilySession> | undefined;
  return Boolean(item && typeof item.roomId === "string" && item.roomId.length === 64 && typeof CryptoKey !== "undefined" && item.material instanceof CryptoKey);
};

/** Fără IndexedDB (fereastră privată, stocare blocată) sesiunea pur și simplu nu se reia. */
export async function loadFamilySession(): Promise<FamilySession | undefined> {
  try {
    const value = await run("readonly", (store) => store.get(SESSION_KEY));
    return isSession(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function saveFamilySession(roomId: string, material: CryptoKey): Promise<boolean> {
  try {
    await run("readwrite", (store) => store.put({ roomId, material, savedAt: new Date().toISOString() } satisfies FamilySession, SESSION_KEY));
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

export async function clearFamilySession(): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(SESSION_KEY));
  } catch {
    // Nimic de șters sau stocare blocată: sesiunea nu se poate relua oricum.
  }
}
