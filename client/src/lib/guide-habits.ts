/**
 * Ce faci de obicei, citit din registrul tău.
 *
 * „Cafea”, fără sumă, înseamnă cafeaua obișnuită: suma pe care o dai de regulă, în plicul
 * din care o plătești de regulă. „La fel ca ieri” sau „ca data trecută la Lidl” înseamnă
 * aceeași mișcare, cu suma și plicul de atunci. Nimic nu se salvează singur: e o propunere,
 * pe care o confirmi sau o corectezi.
 */
import { foldRomanian, isoDate, type AppData, type Transaction } from "./finance-data";

const STOP = new Set([
  "am", "ai", "a", "au", "luat", "dat", "cumparat", "platit", "baut", "mancat", "un", "o", "niste", "de", "pe", "la", "in", "din",
  "azi", "ieri", "iar", "inca", "si", "mai", "acum", "astazi", "dimineata", "seara", "obicei", "ca", "cu", "pentru", "fel", "data",
  "trecuta", "ultima", "aceeasi", "acelasi", "tot", "lei", "ron", "leu", "te", "rog", "noteaza", "adauga", "treci",
]);

/** Cuvintele care spun ce s-a cumpărat, fără verbe, legături și timp. */
export function habitWords(raw: string): string[] {
  return foldRomanian(raw).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((word) => word.length >= 3 && !STOP.has(word));
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
};

const mostCommon = <T>(values: T[]): T | undefined => {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
};

/** „Cafeaua”, „benzina”, „pâinea” → rădăcina, ca să se potrivească „Cafea”, „Benzină”. */
const stem = (word: string) => (word.length >= 5 ? word.replace(/(ului|elor|ilor|ele|lor|ul|ua|le|a|i)$/, "") : word);

const matches = (transaction: Transaction, words: string[]) => {
  const title = foldRomanian(transaction.title);
  return words.every((word) => title.includes(word) || title.includes(stem(word)));
};

export type UsualSpend = { amount: number; title: string; category: string; allocationId?: string; sourceId?: string; count: number };

/**
 * „Cafea” → suma obișnuită pentru cafea, din ultimele 120 de zile. Cere cel puțin două
 * cheltuieli asemănătoare: una singură nu e încă un obicei.
 */
export function usualSpend(data: AppData, raw: string, asOf: string): UsualSpend | undefined {
  if (/\d/.test(raw)) return undefined;
  const words = habitWords(raw);
  if (!words.length || words.length > 3) return undefined;
  const since = new Date(`${asOf}T12:00:00`);
  since.setDate(since.getDate() - 120);
  const floor = isoDate(since);
  const similar = data.transactions.filter((item) => item.kind === "expense" && item.date >= floor && item.date <= asOf && matches(item, words));
  if (similar.length < 2) return undefined;
  return {
    amount: median(similar.map((item) => item.amount)),
    title: mostCommon(similar.map((item) => item.title)) || similar[0].title,
    category: mostCommon(similar.map((item) => item.category)) || similar[0].category,
    allocationId: mostCommon(similar.map((item) => item.allocationId).filter((id): id is string => Boolean(id))),
    sourceId: mostCommon(similar.map((item) => item.sourceId).filter((id): id is string => Boolean(id))),
    count: similar.length,
  };
}

const REPEAT = /\b(la fel ca|ca (si )?(ieri|alaltaieri|data trecuta|ultima data|de obicei)|aceeasi (cheltuiala|suma)|acelasi lucru|repeta)\b/;

/**
 * „La fel ca ieri”, „ca data trecută la Lidl”: ultima cheltuială potrivită. Cu „ieri” caută
 * doar în ziua de ieri; cu un nume de magazin, doar la magazinul acela.
 */
export function repeatedSpend(data: AppData, raw: string, asOf: string): Transaction | undefined {
  const folded = foldRomanian(raw);
  if (!REPEAT.test(folded)) return undefined;
  const words = habitWords(folded.replace(REPEAT, " ").replace(/\b(repeta|lucru|cheltuiala|suma)\b/g, " "));
  const yesterday = new Date(`${asOf}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const onlyDay = /\bieri\b/.test(folded) ? isoDate(yesterday) : undefined;
  // La aceeași dată câștigă cea trecută mai târziu în registru.
  return data.transactions
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === "expense" && item.date <= asOf && (!onlyDay || item.date === onlyDay) && (!words.length || matches(item, words)))
    .sort((a, b) => (a.item.date === b.item.date ? b.index - a.index : a.item.date < b.item.date ? 1 : -1))[0]?.item;
}
