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

export function searchLedgerHits<T extends LedgerSearchItem>(items: T[], query: string, limit = 6): T[] {
  const needle = query.trim();
  if (!needle) return [];
  return items.filter((item) =>
    matchCommandQuery([item.title, item.category, item.person || "", String(item.amount), item.note || ""].join(" "), needle),
  ).slice(0, limit);
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
