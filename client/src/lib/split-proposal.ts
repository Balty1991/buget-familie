/**
 * Cum se împart banii în plicuri, când omul cere „fă-mi un plan”.
 *
 * Întrebarea „am 1800, cum îi împart?” este cea mai grea din aplicație, fiindcă răspunsul
 * corect nu se poate ghici din nimic: depinde de ce cheltuiește familia asta, nu de un
 * procentaj din cărți. De aceea propunerea se calculează în trei trepte, în ordinea
 * încrederii:
 *
 *   1. plicurile pe care le are deja — dacă a ales cândva Alimente/Transport/Casă, aceeași
 *      împărțire, scalată la suma nouă, e cea mai bună presupunere;
 *   2. cheltuielile ultimelor 90 de zile, pe categorii — ce a făcut, nu ce ar trebui;
 *   3. nimic. Fără istoric și fără plicuri nu inventăm procente: mai bine întrebăm.
 *
 * Scadențele rezervate (chirie, abonamente) se scot din suma de împărțit înainte de orice:
 * banii aceia sunt deja promiși, iar un plan care îi reîmparte minte.
 */
import { pendingRecurringInPlan, type AppData } from "./finance-data";

export type SplitLine = { label: string; category: string; amount: number; share: number };
export type SplitProposal = {
  total: number;
  /** Ce rămâne de împărțit după scadențele deja rezervate. */
  spendable: number;
  reserved: number;
  lines: SplitLine[];
  /** Din ce a ieșit propunerea, ca omul să știe cât să se încreadă în ea. */
  basis: "envelopes" | "history" | "none";
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Rotunjire la 10 lei: un plic de 437,52 nu ajută pe nimeni. Ultimul rând ia restul. */
const tidy = (lines: SplitLine[], total: number): SplitLine[] => {
  if (!lines.length) return lines;
  const rounded = lines.map((line) => ({ ...line, amount: Math.max(10, Math.round(line.amount / 10) * 10) }));
  const drift = round(total - rounded.reduce((sum, line) => sum + line.amount, 0));
  const last = rounded[rounded.length - 1];
  last.amount = Math.max(10, round(last.amount + drift));
  return rounded.map((line) => ({ ...line, share: total > 0 ? round(line.amount / total * 100) : 0 }));
};

const fromWeights = (weights: Array<{ label: string; category: string; weight: number }>, spendable: number): SplitLine[] => {
  const sum = weights.reduce((total, item) => total + item.weight, 0);
  if (sum <= 0) return [];
  return tidy(
    weights
      .filter((item) => item.weight > 0)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 6)
      .map((item) => ({ label: item.label, category: item.category, amount: round(spendable * item.weight / sum), share: 0 })),
    spendable,
  );
};

/**
 * Cheltuielile pe categorii din ultimele `days` zile. Nu se numără plățile recurente:
 * chiria apare oricum separat, iar dublarea ei ar strica toate procentele.
 */
const historyWeights = (data: AppData, today: string, days = 90) => {
  const from = new Date(`${today}T12:00:00`);
  from.setDate(from.getDate() - days);
  const start = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const byCategory = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.date < start || item.recurringId) continue;
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + item.amount);
  }
  return Array.from(byCategory.entries()).map(([category, weight]) => ({ label: category, category, weight }));
};

export function proposeSplit(data: AppData, total: number, today: string): SplitProposal {
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const reserved = round(pendingRecurringInPlan(data).reduce((sum, item) => sum + item.amount, 0));
  const spendable = round(Math.max(0, safeTotal - reserved));
  const envelopes = data.settings.salaryPlan.allocations.filter((item) => item.amount > 0);
  if (spendable <= 0) return { total: safeTotal, spendable, reserved, lines: [], basis: "none" };

  if (envelopes.length) {
    const lines = fromWeights(envelopes.map((item) => ({ label: item.label, category: item.category || item.label, weight: item.amount })), spendable);
    if (lines.length) return { total: safeTotal, spendable, reserved, lines, basis: "envelopes" };
  }
  const history = historyWeights(data, today);
  if (history.length) {
    const lines = fromWeights(history, spendable);
    if (lines.length) return { total: safeTotal, spendable, reserved, lines, basis: "history" };
  }
  return { total: safeTotal, spendable, reserved, lines: [], basis: "none" };
}
