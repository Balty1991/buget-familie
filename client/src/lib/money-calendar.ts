/**
 * Calendarul banilor: luna ca o hartă. Zilele trecute au culoarea după cât s-a cheltuit (pragurile
 * vin din ultimele 90 de zile ale familiei, nu din cifre fixe: 200 de lei e mult pentru unii,
 * puțin pentru alții). Zilele care vin arată facturile, ratele, salariile și soldul estimat,
 * cu traiul obișnuit inclus (cumpărăturile zilnice scad și ele banii, nu doar facturile).
 */
import { addIsoDays, isBalanceAdjustment, type AppData } from "./finance-data";
import { projectCashflow, type CashflowItem } from "./cashflow-projection";
import { monthlyLiving } from "./year-plan";

export type CalendarDay = {
  date: string;
  spent: number;
  income: number;
  count: number;
  /** 0 = nimic cheltuit, 1–4 = de la puțin la mult. */
  heat: 0 | 1 | 2 | 3 | 4;
  future: boolean;
  /** Ce urmează în ziua asta (facturi, rate, venituri, evenimente). */
  upcoming: CashflowItem[];
  /** Soldul estimat la final de zi, doar pentru azi și zilele care vin. */
  balance?: number;
};

export type MoneyCalendar = {
  month: string;
  days: CalendarDay[];
  /** Luni = 0: câte celule goale înainte de ziua 1. */
  offset: number;
  spent: number;
  income: number;
  noSpendDays: number;
  /** Media pe zi în zilele trecute ale lunii. */
  perDay: number;
  priciest?: { date: string; spent: number };
  weeks: Array<{ label: string; spent: number; /** Săptămâna n-a început încă: arătăm ce e de plătit în ea. */ future: boolean; due: number }>;
  thresholds: number[];
  /** Cât am pus pe zi pentru traiul obișnuit în soldul estimat. */
  dailyLiving: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Pragurile hărții: sfertul, mijlocul și trei sferturi din zilele cu cheltuieli din ultimele 90 de zile. */
export function heatThresholds(data: AppData, today: string): number[] {
  const since = addIsoDays(today, -90);
  const byDay = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.transferId || isBalanceAdjustment(item) || item.date < since || item.date > today) continue;
    byDay.set(item.date, (byDay.get(item.date) || 0) + item.amount);
  }
  const values = Array.from(byDay.values()).sort((a, b) => a - b);
  if (values.length < 8) return [50, 150, 400];
  const at = (share: number) => values[Math.min(values.length - 1, Math.floor(share * values.length))];
  return [at(0.25), at(0.5), at(0.8)].map(round);
}

export const heatOf = (spent: number, thresholds: number[]): CalendarDay["heat"] =>
  !(spent > 0) ? 0 : spent <= thresholds[0] ? 1 : spent <= thresholds[1] ? 2 : spent <= thresholds[2] ? 3 : 4;

export function moneyCalendar(data: AppData, month: string, today: string): MoneyCalendar {
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1];
  const length = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const thresholds = heatThresholds(data, today);
  const spentBy = new Map<string, { spent: number; income: number; count: number }>();
  for (const item of data.transactions) {
    if (!item.date.startsWith(month) || item.transferId || isBalanceAdjustment(item) || item.date > today) continue;
    const row = spentBy.get(item.date) || { spent: 0, income: 0, count: 0 };
    if (item.kind === "expense") row.spent += item.amount;
    if (item.kind === "income") row.income += item.amount;
    row.count += 1;
    spentBy.set(item.date, row);
  }
  // Zilele care vin: din proiecția soldului, cu traiul obișnuit scăzut zi de zi.
  const lastDay = `${month}-${String(length).padStart(2, "0")}`;
  const horizon = lastDay >= today ? Math.min(75, Math.round((Date.parse(`${lastDay}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) + 1) : 0;
  const projection = horizon > 0 ? projectCashflow(data, today, horizon) : undefined;
  const dailyLiving = round(monthlyLiving(data, today).amount / 30);
  const ahead = new Map((projection?.days || []).map((day, n) => [day.date, { items: day.items, balance: round(day.balance - dailyLiving * n) }]));

  const days: CalendarDay[] = [];
  for (let day = 1; day <= length; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const row = spentBy.get(date) || { spent: 0, income: 0, count: 0 };
    const future = date > today;
    const next = ahead.get(date);
    days.push({
      date, spent: round(row.spent), income: round(row.income), count: row.count,
      heat: future ? 0 : heatOf(row.spent, thresholds), future,
      upcoming: next ? next.items : [],
      ...(next ? { balance: next.balance } : {}),
    });
  }
  const past = days.filter((day) => !day.future);
  const spent = round(past.reduce((sum, day) => sum + day.spent, 0));
  const priciest = past.reduce<CalendarDay | undefined>((best, day) => (day.spent > (best?.spent || 0) ? day : best), undefined);
  // Săptămânile lunii (luni–duminică), cât s-a cheltuit în fiecare.
  const weeks: MoneyCalendar["weeks"] = [];
  for (let start = 0; start < length; ) {
    const end = Math.min(length, start + (start === 0 ? 7 - offset : 7));
    const span = days.slice(start, end);
    weeks.push({ label: `${start + 1}–${end}`, spent: round(span.reduce((sum, day) => sum + day.spent, 0)), future: span[0].future, due: round(span.reduce((sum, day) => sum + day.upcoming.filter((item) => item.kind !== "income").reduce((acc, item) => acc + item.amount, 0), 0)) });
    start = end;
  }
  return {
    month, days, offset, spent,
    income: round(past.reduce((sum, day) => sum + day.income, 0)),
    noSpendDays: past.filter((day) => day.spent <= 0).length,
    perDay: past.length ? round(spent / past.length) : 0,
    ...(priciest ? { priciest: { date: priciest.date, spent: priciest.spent } } : {}),
    weeks, thresholds, dailyLiving,
  };
}
