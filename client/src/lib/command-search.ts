/**
 * Căutarea din bara de sus: acțiuni + mișcări din registrul local.
 * Fără server; rezultatul se poate deschide în Mișcări printr-o cheie de sesiune.
 */
export const JOURNAL_QUERY_KEY = "buget-familie:journal-query";

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

export const foldRo = (value: string) =>
  value.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const matchCommandQuery = (haystack: string, query: string) => {
  const needle = foldRo(query.trim());
  if (!needle) return true;
  return foldRo(haystack).includes(needle);
};

export type LedgerSearchItem = {
  id: string;
  title: string;
  category: string;
  person?: string;
  amount: number;
  note?: string;
  date?: string;
};

/**
 * Caută în registru și după plic (`extra`, de exemplu „Mâncare”), fără diacritice. Se oprește la
 * primele rezultate, cele mai noi întâi: normalizarea întregului registru la fiecare tastă costa
 * ~0,6 s pe un telefon slab.
 */
/** Registrul sortat o dată pe listă (nu la fiecare tastă), cu comparație simplă de șiruri ISO. */
const sortedCache = new WeakMap<object, unknown[]>();
const byDateDesc = <T extends LedgerSearchItem>(items: T[]): T[] => {
  let sorted = sortedCache.get(items) as T[] | undefined;
  if (!sorted) { sorted = items.slice().sort((a, b) => ((b.date || "") > (a.date || "") ? 1 : (b.date || "") < (a.date || "") ? -1 : 0)); sortedCache.set(items, sorted); }
  return sorted;
};

/** Primele mișcări, cele mai noi, fără a sorta din nou la fiecare deschidere a căutării. */
export function recentLedger<T extends LedgerSearchItem>(items: T[], limit = 5): T[] {
  return byDateDesc(items).slice(0, limit);
}

const foldedCache = new WeakMap<object, string>();

export function searchLedgerHits<T extends LedgerSearchItem>(items: T[], query: string, limit = 6, extra?: (item: T) => string): T[] {
  const needle = foldRo(query.trim());
  if (!needle) return [];
  const hits: T[] = [];
  for (const item of byDateDesc(items)) {
    // Textul fiecărei mișcări se face o dată (mișcările nu se modifică pe loc; o corectură e alt obiect).
    let text = foldedCache.get(item);
    if (text === undefined) { text = foldRo([item.title, item.category, item.person || "", String(item.amount), item.note || "", extra?.(item) || ""].join(" ")); foldedCache.set(item, text); }
    if (text.includes(needle)) hits.push(item);
    if (hits.length >= limit) break;
  }
  return hits;
}

export function writeJournalQuery(storage: StorageLike, query: string) {
  try {
    storage.setItem(JOURNAL_QUERY_KEY, query);
  } catch {
    /* preferința de căutare nu trebuie să blocheze aplicația */
  }
}

export function takeJournalQuery(storage: StorageLike): string {
  try {
    const value = storage.getItem(JOURNAL_QUERY_KEY) || "";
    storage.removeItem?.(JOURNAL_QUERY_KEY);
    return value;
  } catch {
    return "";
  }
}
