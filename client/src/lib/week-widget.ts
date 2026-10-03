/**
 * Datele widgetului „Săptămâna banilor”: ultimele 7 zile (azi la dreapta), fiecare cu suma,
 * forma scurtă de deasupra barei și culoarea (aceleași praguri ca în Calendarul banilor),
 * plus totalul și comparația cu cele 7 zile dinainte.
 */
import { addIsoDays, isBalanceAdjustment, type AppData } from "./finance-data";
import { heatOf, heatThresholds } from "./money-calendar";

const INITIALS = ["L", "Ma", "Mi", "J", "V", "S", "D"];
export type WeekDay = { label: string; amount: number; short: string; heat: number; today: boolean };

const short = (value: number) => (value <= 0 ? "" : value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".0", "")}k` : String(Math.round(value)));

export function weekWidgetData(data: AppData, today: string): { days: WeekDay[]; total: number; previous: number; change?: number } {
  const spent = new Map<string, number>();
  const from = addIsoDays(today, -13);
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.transferId || isBalanceAdjustment(item) || item.date < from || item.date > today) continue;
    spent.set(item.date, (spent.get(item.date) || 0) + item.amount);
  }
  const thresholds = heatThresholds(data, today);
  const days: WeekDay[] = [];
  let total = 0, previous = 0;
  for (let k = 6; k >= 0; k -= 1) {
    const date = addIsoDays(today, -k);
    const amount = Math.round((spent.get(date) || 0) * 100) / 100;
    total += amount;
    previous += spent.get(addIsoDays(date, -7)) || 0;
    days.push({ label: INITIALS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7], amount, short: short(amount), heat: heatOf(amount, thresholds), today: k === 0 });
  }
  const change = previous > 0 ? Math.round(((total - previous) / previous) * 100) : undefined;
  return { days, total: Math.round(total * 100) / 100, previous: Math.round(previous * 100) / 100, ...(change !== undefined ? { change } : {}) };
}
