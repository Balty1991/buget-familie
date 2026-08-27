/**
 * Ledger Flow — planificare locală a unui venit pe intervale calendaristice reale.
 * Nu atinge surse, tranzacții sau sincronizare; oferă doar ritmul și tranșele de limită pentru confirmare.
 */
export type CalendarBudgetWeek = { index: number; start: string; end: string; days: number; amount: number };
export type CalendarBudget = { total: number; start: string; end: string; days: number; exactWeeks: number; weeklyAmount: number; weeks: CalendarBudgetWeek[] };

const dayMs = 86_400_000;
const atNoon = (value: string) => new Date(`${value}T12:00:00`);
const toIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calendarBudget(total: number, start: string, end: string): CalendarBudget | undefined {
  const first = atNoon(start); const last = atNoon(end); const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  if (!start || !end || Number.isNaN(first.valueOf()) || Number.isNaN(last.valueOf()) || last < first || safeTotal <= 0) return undefined;
  const days = Math.floor((last.valueOf() - first.valueOf()) / dayMs) + 1;
  const weeklyAmount = roundMoney(safeTotal * 7 / days);
  const weeks: CalendarBudgetWeek[] = [];
  let cursor = new Date(first);
  let distributed = 0;
  while (cursor <= last) {
    const sliceEnd = new Date(Math.min(cursor.valueOf() + 6 * dayMs, last.valueOf()));
    const sliceDays = Math.floor((sliceEnd.valueOf() - cursor.valueOf()) / dayMs) + 1;
    const amount = sliceEnd.valueOf() === last.valueOf() ? roundMoney(safeTotal - distributed) : roundMoney(safeTotal * sliceDays / days);
    weeks.push({ index: weeks.length + 1, start: toIso(cursor), end: toIso(sliceEnd), days: sliceDays, amount });
    distributed = roundMoney(distributed + amount); cursor = new Date(sliceEnd.valueOf() + dayMs);
  }
  return { total: roundMoney(safeTotal), start, end, days, exactWeeks: days / 7, weeklyAmount, weeks };
}
