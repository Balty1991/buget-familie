/**
 * Banii mărunți: sumele mici care se repetă (cafeaua, covrigul, taxiul scurt) nu se văd în
 * nicio categorie mare, dar adunate pe un an sunt o vacanță. Grupăm cheltuielile din ultimele
 * 30 de zile după nume; un grup intră dacă a apărut de cel puțin 4 ori și media e sub 60 de lei.
 * Plățile de vacanță, ajustările și mutările între surse nu intră.
 */
import { addIsoDays, foldRomanian, isBalanceAdjustment, type Transaction } from "./finance-data";

export type SmallSpend = { key: string; label: string; count: number; total: number; average: number; yearly: number };

const keyOf = (title: string) => foldRomanian(title).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

export function smallSpends(transactions: ReadonlyArray<Transaction>, today: string, limit = 4): { rows: SmallSpend[]; total: number; yearly: number } {
  const since = addIsoDays(today, -29);
  const groups = new Map<string, { label: string; date: string; amounts: number[] }>();
  for (const item of transactions) {
    if (item.kind !== "expense" || item.transferId || item.tripId || isBalanceAdjustment(item) || !(item.amount > 0) || item.amount > 60 || item.date < since || item.date > today) continue;
    const key = keyOf(item.title || "");
    if (key.length < 3) continue;
    const group = groups.get(key) || { label: item.title.trim(), date: item.date, amounts: [] };
    group.amounts.push(item.amount);
    if (item.date >= group.date) { group.label = item.title.trim(); group.date = item.date; }
    groups.set(key, group);
  }
  const rows: SmallSpend[] = [];
  groups.forEach((group, key) => {
    const total = group.amounts.reduce((sum, value) => sum + value, 0);
    const average = total / group.amounts.length;
    if (group.amounts.length < 4 || average > 60) return;
    rows.push({ key, label: group.label, count: group.amounts.length, total: Math.round(total * 100) / 100, average: Math.round(average * 100) / 100, yearly: Math.round((total * 365) / 30) });
  });
  rows.sort((a, b) => b.total - a.total);
  const top = rows.slice(0, limit);
  const total = Math.round(top.reduce((sum, row) => sum + row.total, 0) * 100) / 100;
  return { rows: top, total, yearly: top.reduce((sum, row) => sum + row.yearly, 0) };
}
