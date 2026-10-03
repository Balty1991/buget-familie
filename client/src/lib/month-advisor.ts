/**
 * Asistentul financiar lunar: la începutul lunii, raportul lunii trecute făcut din date —
 * ce a mers, ce nu și cel mult trei recomandări, fiecare cu o sumă de pus în practică.
 * Comparațiile se fac cu media celor trei luni dinainte, ca o lună ciudată să nu pară regulă.
 */
import { isBalanceAdjustment, type AppData, type Transaction } from "./finance-data";
import { findEmergencyGoal } from "./emergency-fund";
import { netWorth } from "./net-worth";
import { t } from "./i18n";
import { lei } from "./money-format";

export type AdvisorTip = { id: string; text: string; amount?: number };
export type MonthAdvice = {
  month: string;
  income: number;
  expense: number;
  saved: number;
  rate: number;
  categories: Array<{ category: string; amount: number; average: number }>;
  wins: string[];
  issues: string[];
  tips: AdvisorTip[];
  /** Prima zi notată, când luna n-a fost urmărită de la început: comparațiile sunt orientative. */
  partialFrom?: string;
};

const round = (value: number) => Math.round(value * 100) / 100;
const shift = (key: string, offset: number) => { const date = new Date(`${key.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
const counts = (item: Transaction) => !isBalanceAdjustment(item) && !item.transferId;

export function monthAdvice(data: AppData, month: string, today: string): MonthAdvice | undefined {
  const inMonth = (key: string) => data.transactions.filter((item) => counts(item) && item.date.startsWith(key));
  const rows = inMonth(month);
  if (rows.length < 5) return undefined;
  const income = round(rows.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0));
  const expense = round(rows.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0));
  const saved = round(income - expense);
  const rate = income > 0 ? Math.round((saved / income) * 100) : 0;
  const byCategory = (list: Transaction[]) => list.filter((item) => item.kind === "expense" && !item.debtId).reduce((map, item) => map.set(item.category, (map.get(item.category) || 0) + item.amount), new Map<string, number>());
  const now = byCategory(rows);
  const before = [1, 2, 3].map((back) => byCategory(inMonth(shift(month, -back)))).filter((map) => map.size > 0);
  const average = (category: string) => before.length ? before.reduce((sum, map) => sum + (map.get(category) || 0), 0) / before.length : 0;
  const categories = Array.from(new Set([...Array.from(now.keys()), ...before.flatMap((map) => Array.from(map.keys()))]))
    .map((category) => ({ category, amount: round(now.get(category) || 0), average: round(average(category)) }))
    .filter((row) => row.amount > 0 || row.average > 0)
    .sort((a, b) => b.amount - a.amount);
  const firstDate = data.transactions.filter(counts).reduce((first, item) => item.date < first ? item.date : first, "9999-12-31");
  const partial = firstDate > `${month}-03`;
  const wins: string[] = [], issues: string[] = [], tips: AdvisorTip[] = [];
  if (saved > 0) wins.push(t("Ați pus deoparte {amount}, adică {rate}% din venit.", { amount: lei(saved), rate }));
  else if (income > 0) issues.push(t("Cheltuielile au trecut de venit cu {amount}.", { amount: lei(-saved) }));
  const repaid = round(rows.filter((item) => item.debtId && item.kind === "expense").reduce((sum, item) => sum + item.amount, 0));
  if (repaid > 0) wins.push(t("Ați plătit {amount} din datorii.", { amount: lei(repaid) }));
  const worth = netWorth(data, today);
  const point = worth.history.find((entry) => entry.key === month), prior = worth.history.find((entry) => entry.key === shift(month, -1));
  if (point && prior && Math.abs(point.net - prior.net) >= 1) (point.net >= prior.net ? wins : issues).push(point.net >= prior.net ? t("Averea familiei a crescut cu {amount}.", { amount: lei(point.net - prior.net) }) : t("Averea familiei a scăzut cu {amount}.", { amount: lei(prior.net - point.net) }));
  if (before.length) {
    const ups = categories.filter((row) => row.average >= 50 && row.amount - row.average >= Math.max(100, row.average * 0.2)).sort((a, b) => (b.amount - b.average) - (a.amount - a.average));
    const downs = categories.filter((row) => row.average >= 50 && row.average - row.amount >= Math.max(100, row.average * 0.2)).sort((a, b) => (b.average - b.amount) - (a.average - a.amount));
    for (const row of downs.slice(0, 2)) wins.push(t("{category}: {amount} mai puțin decât de obicei.", { category: t(row.category), amount: lei(row.average - row.amount) }));
    for (const row of ups.slice(0, 2)) issues.push(t("{category}: {amount} mai mult decât de obicei ({now} față de ~{avg}).", { category: t(row.category), amount: lei(row.amount - row.average), now: lei(row.amount), avg: lei(row.average) }));
    const top = ups[0];
    if (top) { const limit = Math.round((top.average * 1.1) / 10) * 10; tips.push({ id: "limit", amount: limit, text: t("Puneți o limită de {limit} pentru {category} luna asta; de obicei cheltuiți ~{avg}.", { limit: lei(limit), category: t(top.category), avg: lei(top.average) }) }); }
  }
  const fund = findEmergencyGoal(data.savings);
  if (saved > 0) {
    const put = Math.round((saved * 0.5) / 10) * 10;
    const target = fund && fund.current < fund.target ? fund : data.savings.find((goal) => goal.current < goal.target);
    if (put >= 50) tips.push({ id: "save", amount: put, text: target ? t("Mutați {amount} (jumătate din ce a rămas) în „{goal}”.", { amount: lei(put), goal: target.name }) : t("Puneți deoparte {amount} (jumătate din ce a rămas) într-un fond de urgență.", { amount: lei(put) }) });
  } else if (saved < 0 && categories[0]) {
    const cut = Math.round((-saved) / 10) * 10;
    tips.push({ id: "cut", amount: cut, text: t("Ca luna asta să iasă pe zero, tăiați {amount}; cel mai ușor din {category} ({spent}).", { amount: lei(cut), category: t(categories[0].category), spent: lei(categories[0].amount) }) });
  }
  for (const item of partial ? [] : data.settings.salaryPlan.allocations) {
    if (tips.length >= 3) break;
    const spent = now.get(item.category || "") || 0;
    if (item.amount >= 300 && item.weeklyPace !== false && spent > 0 && spent < item.amount * 0.7) {
      const suggested = Math.ceil((spent * 1.1) / 50) * 50;
      tips.push({ id: `env-${item.id}`, amount: item.amount - suggested, text: t("Plicul „{label}” a folosit {spent} din {budget}. Coborâți-l la {suggested} și eliberați {free}.", { label: item.label, spent: lei(spent), budget: lei(item.amount), suggested: lei(suggested), free: lei(item.amount - suggested) }) });
    }
  }
  const subs = data.recurring.filter((item) => item.active && (item.category === "Abonamente" || /abonament|netflix|spotify|hbo|disney|youtube|icloud|google one/i.test(item.name))).reduce((sum, item) => sum + (item.frequency === "yearly" ? item.amount / 12 : item.frequency === "quarterly" ? item.amount / 3 : item.amount), 0);
  if (tips.length < 3 && income > 0 && subs >= Math.max(50, income * 0.03)) tips.push({ id: "subs", amount: round(subs), text: t("Abonamentele costă {amount} pe lună ({year} pe an). Verificați dacă le folosiți pe toate.", { amount: lei(subs), year: lei(subs * 12) }) });
  return { month, income, expense, saved, rate, categories: categories.slice(0, 6), wins: wins.slice(0, 4), issues: issues.slice(0, 4), tips: tips.slice(0, 3), ...(partial ? { partialFrom: firstDate } : {}) };
}
