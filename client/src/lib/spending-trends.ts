/**
 * Tendințe și obiceiuri pe ultimul an: ce categorii cresc și ce scad (ultimele 3 luni față de
 * cele 3 dinainte), cum arată săptămâna (ziua cea mai scumpă, cât merge pe weekend), magazinele
 * de bază (vizite, bonul mediu) și abonamentele care se repetă fără să fie urmărite.
 * Se uită doar la lunile întregi de la prima notare încoace: o lună fără nimic notat nu e o lună ieftină.
 */
import { isBalanceAdjustment, type AppData } from "./finance-data";
import { detectSubscriptions, type SubscriptionDetection } from "./household-insights";
import { GENERIC, placeKey } from "./year-recap";

export type CategoryTrend = {
  name: string;
  total: number;
  /** Suma pe fiecare lună din fereastră, în ordine. */
  monthly: number[];
  /** Media pe lună: ultimele 3 luni și cele 3 dinainte. */
  recent: number;
  before: number;
  /** recent / before − 1; undefined fără bază de comparat. */
  change?: number;
  trend: "up" | "down" | "flat";
};

export type SpendingTrends = {
  months: Array<{ key: string; total: number }>;
  categories: CategoryTrend[];
  rising: CategoryTrend[];
  falling: CategoryTrend[];
  /** Media cheltuită într-o zi de luni, marți… duminică (0 = luni). */
  weekdays: number[];
  priciestDay: number;
  /** Partea din cheltuieli făcută sâmbăta și duminica (0–1). */
  weekendShare: number;
  places: Array<{ name: string; visits: number; total: number; average: number; last: string }>;
  forgotten: Array<{ name: string; amount: number; yearly: number; lastDate: string; detection: SubscriptionDetection }>;
  /** Cât costă pe an abonamentele (urmărite + găsite). */
  subscriptionsYearly: number;
  largest: Array<{ title: string; amount: number; date: string; category: string }>;
};

const round = (value: number) => Math.round(value * 100) / 100;
const shiftMonth = (key: string, offset: number) => { const date = new Date(`${key.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
/** 0 = luni … 6 = duminică. */
const weekday = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
const daysIn = (key: string) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();

export function spendingTrends(data: AppData, today: string): SpendingTrends | undefined {
  const thisMonth = today.slice(0, 7);
  const expenses = data.transactions.filter((item) => item.kind === "expense" && item.amount > 0 && !item.transferId && !item.debtId && !isBalanceAdjustment(item) && item.date.slice(0, 7) < thisMonth);
  if (!expenses.length) return undefined;
  const first = expenses.reduce((min, item) => (item.date < min ? item.date : min), expenses[0].date).slice(0, 7);
  const from = [shiftMonth(thisMonth, -12), first].sort()[1];
  const keys: string[] = [];
  for (let key = from; key < thisMonth; key = shiftMonth(key, 1)) keys.push(key);
  if (keys.length < 2) return undefined;
  const index = new Map(keys.map((key, n) => [key, n]));
  const inWindow = expenses.filter((item) => index.has(item.date.slice(0, 7)));
  if (inWindow.length < 10) return undefined;

  const totals = keys.map(() => 0);
  const byCategory = new Map<string, number[]>();
  const weekdaySums = [0, 0, 0, 0, 0, 0, 0];
  const places = new Map<string, { name: string; visits: number; total: number; last: string; days: Set<string> }>();
  for (const item of inWindow) {
    const n = index.get(item.date.slice(0, 7))!;
    totals[n] += item.amount;
    const row = byCategory.get(item.category) || keys.map(() => 0);
    row[n] += item.amount;
    byCategory.set(item.category, row);
    weekdaySums[weekday(item.date)] += item.amount;
    const title = (item.title || "").trim();
    if (title && !GENERIC.test(title) && !item.recurringId) {
      const key = placeKey(title);
      if (key.length >= 2) {
        const place = places.get(key) || { name: title, visits: 0, total: 0, last: "", days: new Set<string>() };
        place.total += item.amount;
        place.days.add(item.date);
        place.visits = place.days.size;
        if (item.date > place.last) { place.last = item.date; place.name = title; }
        places.set(key, place);
      }
    }
  }

  // Câte zile de luni, marți… au fost în fereastră, ca media să fie pe zi, nu pe total.
  const weekdayCount = [0, 0, 0, 0, 0, 0, 0];
  for (const key of keys) for (let day = 1; day <= daysIn(key); day += 1) weekdayCount[weekday(`${key}-${String(day).padStart(2, "0")}`)] += 1;
  const weekdays = weekdaySums.map((sum, n) => round(weekdayCount[n] ? sum / weekdayCount[n] : 0));
  const spent = weekdaySums.reduce((a, b) => a + b, 0);

  const last3 = keys.slice(-3);
  const prior3 = keys.slice(-6, -3);
  const avg = (row: number[], list: string[]) => (list.length ? list.reduce((sum, key) => sum + row[index.get(key)!], 0) / list.length : 0);
  const categories: CategoryTrend[] = Array.from(byCategory.entries()).map(([name, row]) => {
    const recent = round(avg(row, last3));
    const before = round(avg(row, prior3));
    const change = before > 0 ? recent / before - 1 : undefined;
    // O schimbare contează doar dacă e și mare (20%) și simțită în lei (50 pe lună).
    const trend = change !== undefined && Math.abs(recent - before) >= 50 && Math.abs(change) >= 0.2 ? (change > 0 ? "up" : "down") : "flat";
    return { name, total: round(row.reduce((a, b) => a + b, 0)), monthly: row.map(round), recent, before, change, trend } as CategoryTrend;
  }).sort((a, b) => b.total - a.total);

  const forgotten = detectSubscriptions(data, today).map((item) => {
    const perYear = item.intervalDays > 0 ? 365 / item.intervalDays : 12;
    return { name: item.name, amount: item.amount, yearly: round(item.amount * perYear), lastDate: item.lastDate, detection: item };
  });
  const tracked = data.recurring.filter((item) => item.active && item.category === "Abonamente").reduce((sum, item) => sum + (item.frequency === "yearly" ? item.amount : item.frequency === "quarterly" ? item.amount * 4 : item.amount * 12), 0);

  return {
    months: keys.map((key, n) => ({ key, total: round(totals[n]) })),
    categories: categories.slice(0, 8),
    rising: prior3.length ? categories.filter((row) => row.trend === "up").sort((a, b) => (b.recent - b.before) - (a.recent - a.before)).slice(0, 3) : [],
    falling: prior3.length ? categories.filter((row) => row.trend === "down").sort((a, b) => (a.recent - a.before) - (b.recent - b.before)).slice(0, 3) : [],
    weekdays,
    priciestDay: weekdays.indexOf(Math.max(...weekdays)),
    weekendShare: spent > 0 ? (weekdaySums[5] + weekdaySums[6]) / spent : 0,
    places: Array.from(places.values()).filter((place) => place.visits >= 3).sort((a, b) => b.total - a.total).slice(0, 5)
      .map((place) => ({ name: place.name, visits: place.visits, total: round(place.total), average: round(place.total / place.visits), last: place.last })),
    forgotten,
    subscriptionsYearly: round(tracked + forgotten.reduce((sum, item) => sum + item.yearly, 0)),
    largest: [...inWindow].sort((a, b) => b.amount - a.amount).slice(0, 3).map((item) => ({ title: item.title, amount: item.amount, date: item.date, category: item.category })),
  };
}
