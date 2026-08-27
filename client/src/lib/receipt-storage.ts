/**
 * Atelierul Financiar — fotografii de bon păstrate doar pe dispozitiv.
 * Registrul păstrează referințe ușoare; bloburile nu intră în localStorage sau în sincronizarea GitHub.
 */

const DATABASE_NAME = "buget-familie-receipts";
const DATABASE_VERSION = 1;
const STORE_NAME = "receipt-images";

type StoredReceiptImage = { key: string; receiptId: string; slot: number; blob: Blob; updatedAt: string };

const imageKey = (receiptId: string, slot: number) => `${receiptId}:image:${slot}`;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Acest browser nu oferă stocare locală pentru fotografii.");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Stocarea locală a bonului nu a putut fi deschisă."));
  });
}

function dataUrlToBlob(value: string): Blob {
  const [header, encoded] = value.split(",", 2);
  if (!header || !encoded) throw new Error("Imaginea bonului are un format invalid.");
  const type = header.match(/^data:(.*?);base64$/)?.[1] || "image/jpeg";
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type });
}

function runTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T> | void) {
  return openDatabase().then((database) => new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => { database.close(); resolve(request?.result); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error("Fotografia bonului nu a putut fi salvată local.")); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("Fotografia bonului nu a putut fi salvată local.")); };
  }));
}

export async function storeReceiptImages(receiptId: string, images: string[]): Promise<string[]> {
  const entries: StoredReceiptImage[] = images.filter(Boolean).slice(0, 2).map((image, slot) => ({ key: imageKey(receiptId, slot), receiptId, slot, blob: dataUrlToBlob(image), updatedAt: new Date().toISOString() }));
  if (!entries.length) return [];
  try {
    await runTransaction("readwrite", (store) => { entries.forEach((entry) => store.put(entry)); });
    return entries.map((entry) => entry.key);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Fotografiile bonului nu au putut fi păstrate pe telefon.";
    if (/quota|space|storage/i.test(message)) throw new Error("Telefonul nu mai are spațiu local pentru fotografii. Eliberează spațiu sau salvează bonul fără poze.");
    throw new Error(message);
  }
}

export async function receiptImageUrl(key?: string): Promise<string | undefined> {
  if (!key) return undefined;
  const entry = await runTransaction<StoredReceiptImage>("readonly", (store) => store.get(key));
  return entry?.blob ? URL.createObjectURL(entry.blob) : undefined;
}

export async function removeReceiptImages(keys: string[] | undefined) {
  if (!keys?.length) return;
  await runTransaction("readwrite", (store) => { keys.forEach((key) => store.delete(key)); });
}

export async function clearReceiptImageStorage() {
  await runTransaction("readwrite", (store) => store.clear());
}

export async function migrateLegacyReceiptImages(receipts: Array<{ id: string; imageData?: string; imageData2?: string; imageKeys?: string[] }>) {
  const migrated = new Map<string, string[]>();
  for (const receipt of receipts) {
    if (receipt.imageKeys?.length) continue;
    const images = [receipt.imageData, receipt.imageData2].filter((image): image is string => Boolean(image));
    if (!images.length) continue;
    migrated.set(receipt.id, await storeReceiptImages(receipt.id, images));
  }
  return migrated;
}
