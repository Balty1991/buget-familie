/**
 * „Închide anul” (produs #8): istoricul rămâne, pachetul de sync nu crește la nesfârșit.
 *
 * Mișcările până la 31 decembrie ale anului ales ies din registru și din sincronizare:
 * - se descarcă înainte ca fișier (arhiva anului), ca nimic să nu se piardă;
 * - rămân rezumatele pe luni și categorii (settings.yearSummaries);
 * - suma lor pe fiecare sursă trece în settings.archivedNet, deci soldurile rămân aceleași;
 * - data-limită (settings.archivedThrough) se sincronizează: celelalte telefoane scot și ele
 *   aceleași mișcări, fără mii de „pietre de mormânt”.
 * Corecțiile de sold și mutările între surse intră la sold, nu la venituri/cheltuieli.
 */
import { archivedIdHash, exchangeRateFor, isBalanceAdjustment, isoToday, type AppData, type Transaction, type YearSummary } from "@/lib/finance-data";

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Anii care se pot închide: încheiați, cu mișcări, după ultima arhivă, și nu în mijlocul
 * ciclului de salariu curent. Ciclul 25.12–25.01 are cheltuieli în decembrie: arhivate,
 * plicul ar fi arătat 1.900 rămași în loc de 1.000.
 */
export function closableYears(data: AppData, today = isoToday()): string[] {
  const current = today.slice(0, 4);
  const cut = data.settings.archivedThrough || "";
  const cycleStart = data.settings.salaryPlan.periodStart || "";
  return Array.from(new Set(data.transactions.map((item) => item.date.slice(0, 4))))
    .filter((year) => /^\d{4}$/.test(year) && year < current && `${year}-12-31` > cut && !(cycleStart && cycleStart <= `${year}-12-31`))
    .sort();
}

/** Anul trecut nu se poate închide încă pentru că ciclul curent a început în el. */
export function yearBlockedByCycle(data: AppData, today = isoToday()): string | undefined {
  const last = String(Number(today.slice(0, 4)) - 1);
  const cycleStart = data.settings.salaryPlan.periodStart || "";
  const hasMoves = data.transactions.some((item) => item.date.startsWith(last));
  return hasMoves && cycleStart && cycleStart <= `${last}-12-31` && `${last}-12-31` > (data.settings.archivedThrough || "") ? last : undefined;
}

function summarize(year: string, items: Transaction[], closedAt: string): YearSummary {
  const months = new Map<string, { month: string; income: number; expense: number; categories: Record<string, number> }>();
  let income = 0;
  let expense = 0;
  for (const item of items) {
    if (isBalanceAdjustment(item)) continue;
    const key = item.date.slice(0, 7);
    const month = months.get(key) || { month: key, income: 0, expense: 0, categories: {} };
    if (item.kind === "income") { month.income += item.amount; income += item.amount; }
    else { month.expense += item.amount; expense += item.amount; month.categories[item.category] = round((month.categories[item.category] || 0) + item.amount); }
    months.set(key, month);
  }
  return {
    year,
    closedAt,
    count: items.length,
    income: round(income),
    expense: round(expense),
    months: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map((month) => ({ ...month, income: round(month.income), expense: round(month.expense) })),
  };
}

/** Închide anul ales (și pe cei dinaintea lui, rămași deschiși). Întoarce registrul nou și arhiva de salvat. */
export function closeYear(data: AppData, year: string, today = isoToday()): { data: AppData; archive: Transaction[] } {
  if (!closableYears(data, today).includes(year)) return { data, archive: [] };
  const cut = `${year}-12-31`;
  const archive = data.transactions.filter((item) => item.date <= cut);
  const archivedNet = { ...(data.settings.archivedNet || {}) };
  for (const item of archive) {
    if (!item.sourceId) continue;
    archivedNet[item.sourceId] = round((archivedNet[item.sourceId] || 0) + (item.kind === "income" ? item.amount : -item.amount));
  }
  const archivedNetCurrency = { ...(data.settings.archivedNetCurrency || {}) };
  for (const source of data.settings.paymentSources) {
    if (!source.currency) continue;
    const rate = exchangeRateFor(data, source.currency);
    const own = archive.filter((item) => item.sourceId === source.id).reduce((sum, item) => {
      const value = item.originalCurrency === source.currency && item.originalAmount ? item.originalAmount : rate && rate > 0 ? item.amount / rate : 0;
      return sum + (item.kind === "income" ? value : -value);
    }, 0);
    if (own) archivedNetCurrency[source.id] = round((archivedNetCurrency[source.id] || 0) + own);
  }
  const archivedIds = (data.settings.archivedIds || "") + archive.map((item) => archivedIdHash(item.id)).join("");
  const closedAt = new Date().toISOString();
  const years = Array.from(new Set(archive.map((item) => item.date.slice(0, 4)))).sort();
  const summaries = years.map((each) => summarize(each, archive.filter((item) => item.date.startsWith(each)), closedAt));
  const kept = (data.settings.yearSummaries || []).filter((item) => !years.includes(item.year));
  return {
    archive,
    data: {
      ...data,
      transactions: data.transactions.filter((item) => item.date > cut),
      settings: { ...data.settings, archivedThrough: cut, archivedNet, archivedIds, ...(Object.keys(archivedNetCurrency).length ? { archivedNetCurrency } : {}), yearSummaries: [...kept, ...summaries].sort((a, b) => a.year.localeCompare(b.year)) },
    },
  };
}

/** Arhiva descărcată: un JSON cu mișcările anului, citibil și importabil. */
export const yearArchiveBlob = (year: string, archive: Transaction[]) =>
  new Blob([JSON.stringify({ kind: "buget-familie-arhiva-an", year, exportedAt: new Date().toISOString(), transactions: archive }, null, 2)], { type: "application/json" });
