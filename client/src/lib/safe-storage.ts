/**
 * Scrieri localStorage care nu trebuie să doboare aplicația când quota e plină
 * (tipic pe Safari / Chrome Pages mobile după dual-write LS + IDB).
 */

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

/** Snapshot-uri mari — pe quota le scoatem ca să rămână loc pentru flag-uri mici. */
export const HEAVY_LOCAL_STORAGE_KEYS = [
  "buget-familie:app-data-v6",
  "buget-familie:app-data-v3",
] as const;

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: number | string; message?: string };
  if (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (err.code === 22 || err.code === 1014) return true;
  return typeof err.message === "string" && /quota/i.test(err.message);
}

export function freeHeavyLocalCache(storage: StorageLike = typeof window !== "undefined" ? window.localStorage : (null as unknown as StorageLike)): void {
  if (!storage?.removeItem) return;
  for (const key of HEAVY_LOCAL_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * setItem care nu aruncă. La QuotaExceeded încearcă o dată să elibereze
 * snapshot-urile grele, apoi reîncearcă. Întoarce false dacă tot nu încape.
 */
export function safeSetItem(storage: StorageLike, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) return false;
    freeHeavyLocalCache(storage);
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

export function safeRemoveItem(storage: StorageLike, key: string): void {
  try {
    storage.removeItem?.(key);
  } catch {
    /* ignore */
  }
}
