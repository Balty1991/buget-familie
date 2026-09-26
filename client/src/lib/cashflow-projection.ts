/**
 * Soldul estimat zi de zi: banii de acum, plus veniturile declarate, minus facturile,
 * ratele și evenimentele care vin. Nu include cumpărăturile zilnice; calendarul spune asta.
 */
import { addIsoDays, isoDate, recurringOccursInMonth, sourceBalance, type AppData } from "@/lib/finance-data";
import { occurrenceInMonth } from "@/lib/planned-events";

export type CashflowItem = { title: string; amount: number; kind: "income" | "due" | "event" };
export type CashflowDay = { date: string; balance: number; items: CashflowItem[] };
export type CashflowProjection = { start: number; days: CashflowDay[]; lowest: { date: string; balance: number } };

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dayIn = (year: number, month: number, day: number) => isoDate(new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12));
const dayGap = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

/** Un venit declarat e deja intrat dacă a venit unul de la același membru la cel mult 10 zile de ziua lui. */
const INCOME_WINDOW = 10;

export function projectCashflow(data: AppData, asOf: string, horizonDays = 45): CashflowProjection {
  const end = addIsoDays(asOf, horizonDays - 1);
  const start = round2(data.settings.paymentSources.filter((source) => source.kind !== "meal").reduce((sum, source) => sum + Math.max(0, sourceBalance(data, source.id)), 0));
  const byDate = new Map<string, CashflowItem[]>();
  const add = (date: string, item: CashflowItem) => { if (date < asOf || date > end || !(item.amount > 0)) return; byDate.set(date, [...(byDate.get(date) || []), item]); };
  const first = new Date(`${asOf}T12:00:00`);
  const months = Array.from({ length: Math.ceil(horizonDays / 28) + 1 }, (_, index) => new Date(first.getFullYear(), first.getMonth() + index, 1, 12));
  const monthKey = (iso: string) => iso.slice(0, 7);

  for (const item of data.recurring) {
    if (!item.active) continue;
    for (const month of months) {
      if (!recurringOccursInMonth(item, month.getMonth() + 1)) continue;
      const due = dayIn(month.getFullYear(), month.getMonth(), item.dueDay);
      const paid = data.transactions.some((tx) => tx.recurringId === item.id && monthKey(tx.date) === monthKey(due));
      if (!paid) add(due, { title: item.name, amount: item.amount, kind: "due" });
    }
  }

  for (const debt of data.debts) {
    if (!debt.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(debt.dueDate)) continue;
    let left = debt.remaining;
    for (const month of months) {
      const due = dayIn(month.getFullYear(), month.getMonth(), Number(debt.dueDate.slice(8)));
      if (monthKey(due) < monthKey(debt.dueDate)) continue;
      const amount = round2(Math.min(debt.monthly, left));
      if (amount <= 0) break;
      const paid = data.transactions.some((tx) => tx.debtId === debt.id && monthKey(tx.date) === monthKey(due));
      if (!paid) { add(due, { title: debt.name, amount, kind: "due" }); if (due >= asOf) left -= amount; }
    }
  }

  for (const income of data.settings.salaryPlan.incomes || []) {
    if (income.archived) continue;
    for (const month of months) {
      const due = dayIn(month.getFullYear(), month.getMonth(), income.day);
      const received = data.transactions.some((tx) => tx.kind === "income" && (!income.memberId || tx.memberId === income.memberId) && dayGap(tx.date, due) <= INCOME_WINDOW);
      if (!received) add(due, { title: income.label, amount: income.amount, kind: "income" });
    }
  }

  for (const event of data.settings.plannedEvents) {
    for (const month of months) {
      const date = occurrenceInMonth(event, month.getFullYear(), month.getMonth());
      if (date) add(date, { title: event.name, amount: event.estimate, kind: "event" });
    }
  }

  let balance = start;
  let lowest = { date: asOf, balance: start };
  const days: CashflowDay[] = [];
  for (let date = asOf; date <= end; date = addIsoDays(date, 1)) {
    const items = byDate.get(date) || [];
    balance = round2(items.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), balance));
    days.push({ date, balance, items });
    if (balance < lowest.balance) lowest = { date, balance };
  }
  return { start, days, lowest };
}
