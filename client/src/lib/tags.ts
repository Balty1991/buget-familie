/**
 * Etichetele: unde sau pentru cine e o cheltuială, separat de categorie. Un sandviș la birou
 * e tot Alimente, dar cu eticheta Serviciu se vede în Analiză cât costă serviciul pe lună,
 * fără să amestece cumpărăturile casei.
 */
import { foldRomanian, isBalanceAdjustment, type AppData } from "./finance-data";

export const DEFAULT_TAGS = ["Serviciu", "Casă", "Copil", "Mașină"];

/** Etichetele de propus: cele folosite (cele mai dese întâi), apoi cele obișnuite. */
export const knownTags = (data: AppData) => {
  const counts = new Map<string, number>();
  for (const item of data.transactions) if (item.tag) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  const used = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).map(([tag]) => tag);
  const seen = new Set(used.map((tag) => foldRomanian(tag)));
  return [...used, ...DEFAULT_TAGS.filter((tag) => !seen.has(foldRomanian(tag)))].slice(0, 10);
};

/** Aceeași denumire, aceeași etichetă: „Shaorma birou” notată o dată cu Serviciu o primește singură data viitoare. */
export const suggestTag = (data: AppData, title: string) => {
  const key = foldRomanian(title.trim());
  if (key.length < 3) return undefined;
  const last = data.transactions.filter((item) => item.kind === "expense" && foldRomanian(item.title.trim()) === key).sort((left, right) => (right.date + (right.createdAt || "")).localeCompare(left.date + (left.createdAt || "")))[0];
  return last?.tag;
};

export type TagTotal = { tag: string; total: number; count: number; categories: Array<[string, number]> };

/** Cât s-a cheltuit pe fiecare etichetă între două date (inclusiv), fără corecțiile de sold și mutările între surse. */
export const tagTotals = (data: AppData, start: string, end: string): TagTotal[] => {
  const byTag = new Map<string, TagTotal>();
  for (const item of data.transactions) {
    if (!item.tag || item.kind !== "expense" || isBalanceAdjustment(item) || item.date < start || item.date > end) continue;
    const row = byTag.get(item.tag) || { tag: item.tag, total: 0, count: 0, categories: [] };
    row.total = Math.round((row.total + item.amount) * 100) / 100;
    row.count += 1;
    const category = row.categories.find((entry) => entry[0] === item.category);
    if (category) category[1] = Math.round((category[1] + item.amount) * 100) / 100;
    else row.categories.push([item.category, item.amount]);
    byTag.set(item.tag, row);
  }
  return Array.from(byTag.values()).map((row) => ({ ...row, categories: row.categories.sort((left, right) => right[1] - left[1]) })).sort((left, right) => right.total - left.total);
};
