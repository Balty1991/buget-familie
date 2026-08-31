/**
 * Atelierul Financiar — fotografii de bon păstrate doar pe dispozitiv.
 * Registrul păstrează referințe ușoare; bloburile nu intră în localStorage sau în sincronizarea GitHub.
 * Miniaturile stau lângă original în IndexedDB, ca lista de bonuri să nu decodeze JPEG-uri de 1600px.
 */

const DATABASE_NAME = "buget-familie-receipts";
const DATABASE_VERSION = 1;
const STORE_NAME = "receipt-images";
const THUMB_EDGE = 216;

type StoredReceiptImage = { key: string; receiptId: string; slot: number; blob: Blob; updatedAt: string };
type LivingUrl = { url: string; refs: number };

const livingUrls = new Map<string, LivingUrl>();
const inflightUrls = new Map<string, Promise<string | undefined>>();

const imageKey = (receiptId: string, slot: number) => `${receiptId}:image:${slot}`;
const thumbKey = (receiptId: string, slot: number) => `${receiptId}:thumb:${slot}`;

export function receiptThumbKey(imageKeyValue: string): string | undefined {
  const match = /^(.*):image:(\d+)$/.exec(imageKeyValue);
  return match ? `${match[1]}:thumb:${match[2]}` : undefined;
}

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

async function blobToThumbnail(blob: Blob, maxEdge = THUMB_EDGE): Promise<Blob | undefined> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); return undefined; }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const thumb = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((next) => resolve(next || undefined), "image/jpeg", 0.62);
    });
    return thumb;
  } catch {
    return undefined;
  }
}

function forgetLivingUrl(key: string) {
  const living = livingUrls.get(key);
  if (!living) return;
  URL.revokeObjectURL(living.url);
  livingUrls.delete(key);
}

export async function storeReceiptImages(receiptId: string, images: string[]): Promise<string[]> {
  const full: StoredReceiptImage[] = images.filter(Boolean).slice(0, 2).map((image, slot) => ({
    key: imageKey(receiptId, slot),
    receiptId,
    slot,
    blob: dataUrlToBlob(image),
    updatedAt: new Date().toISOString(),
  }));
  if (!full.length) return [];
  const thumbs: StoredReceiptImage[] = [];
  for (const entry of full) {
    const blob = await blobToThumbnail(entry.blob);
    if (!blob) continue;
    thumbs.push({ key: thumbKey(receiptId, entry.slot), receiptId, slot: entry.slot, blob, updatedAt: entry.updatedAt });
  }
  try {
    await runTransaction("readwrite", (store) => {
      full.forEach((entry) => store.put(entry));
      thumbs.forEach((entry) => store.put(entry));
    });
    full.forEach((entry) => {
      forgetLivingUrl(entry.key);
      forgetLivingUrl(thumbKey(receiptId, entry.slot));
    });
    return full.map((entry) => entry.key);
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

export async function acquireReceiptObjectUrl(key?: string): Promise<string | undefined> {
  if (!key) return undefined;
  const living = livingUrls.get(key);
  if (living) {
    living.refs += 1;
    return living.url;
  }
  let pending = inflightUrls.get(key);
  if (!pending) {
    pending = (async () => {
      const entry = await runTransaction<StoredReceiptImage>("readonly", (store) => store.get(key));
      if (!entry?.blob) return undefined;
      const url = URL.createObjectURL(entry.blob);
      livingUrls.set(key, { url, refs: 0 });
      return url;
    })();
    inflightUrls.set(key, pending);
    void pending.finally(() => inflightUrls.delete(key));
  }
  const url = await pending;
  if (!url) return undefined;
  const cached = livingUrls.get(key);
  if (cached) cached.refs += 1;
  return url;
}

export function releaseReceiptObjectUrl(key?: string) {
  if (!key) return;
  const living = livingUrls.get(key);
  if (!living) return;
  living.refs -= 1;
  if (living.refs > 0) return;
  URL.revokeObjectURL(living.url);
  livingUrls.delete(key);
}

export async function acquireReceiptPreviewUrl(imageKeyValue?: string): Promise<{ url: string; cacheKey: string } | undefined> {
  if (!imageKeyValue) return undefined;
  const thumb = receiptThumbKey(imageKeyValue);
  if (thumb) {
    const url = await acquireReceiptObjectUrl(thumb);
    if (url) return { url, cacheKey: thumb };
  }
  const url = await acquireReceiptObjectUrl(imageKeyValue);
  if (url && thumb) void materializeMissingThumb(imageKeyValue, thumb);
  return url ? { url, cacheKey: imageKeyValue } : undefined;
}

async function materializeMissingThumb(imageKeyValue: string, thumb: string) {
  try {
    if (livingUrls.has(thumb)) return;
    const entry = await runTransaction<StoredReceiptImage>("readonly", (store) => store.get(imageKeyValue));
    if (!entry?.blob) return;
    const blob = await blobToThumbnail(entry.blob);
    if (!blob) return;
    const match = /^(.*):image:(\d+)$/.exec(imageKeyValue);
    if (!match) return;
    await runTransaction("readwrite", (store) => {
      store.put({ key: thumb, receiptId: match[1], slot: Number(match[2]), blob, updatedAt: new Date().toISOString() });
    });
  } catch {
    /* Miniatura se reîncearcă la următoarea afișare. Lista rămâne pe fotografia completă. */
  }
}

export async function removeReceiptImages(keys: string[] | undefined) {
  if (!keys?.length) return;
  const extra = keys.map(receiptThumbKey).filter((key): key is string => Boolean(key));
  const all = [...keys, ...extra];
  await runTransaction("readwrite", (store) => { all.forEach((key) => store.delete(key)); });
  all.forEach(forgetLivingUrl);
}

export async function clearReceiptImageStorage() {
  await runTransaction("readwrite", (store) => store.clear());
  Array.from(livingUrls.keys()).forEach(forgetLivingUrl);
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
