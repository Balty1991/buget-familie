/**
 * Bonurile se scriu doar de mână: aplicația nu mai face și nu mai citește fotografii.
 * Ce a rămas din versiunile vechi (baza IndexedDB cu poze) se șterge de tot de pe telefon.
 */
const DATABASE_NAME = "buget-familie-receipts";

export function clearReceiptImageStorage(): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
