/**
 * „Anul vostru”: retrospectiva unui an din registru, pe telefon. Câte zile ați notat, unde
 * s-au dus banii, magazinul de bază, cea mai bună lună, zilele fără cheltuieli. Totul se
 * calculează local; imaginea de trimis arată implicit doar procente și numărări.
 */
import { addIsoDays, isBalanceAdjustment, type Transaction } from "@/lib/finance-data";

type Move = Pick<Transaction, "id" | "date" | "kind" | "category" | "amount" | "title" | "adjustment" | "transferId">;

export type YearRecap = {
  year: number;
  moves: number;
  loggedDays: number;
  longestStreak: number;
  noSpendDays: number;
  spent: number;
  income: number;
  /** Cât a rămas din ce a intrat (0–1), doar când au fost venituri notate. */
  keptShare?: number;
  categories: Array<{ name: string; amount: number; share: number }>;
  topPlace?: { name: string; visits: number };
  /** Luna cu cea mai mare parte rămasă din venit; fără venituri, luna cu cele mai mici cheltuieli. */
  bestMonth?: { month: string; keptShare?: number; spent: number };
  monthly: Array<{ month: string; spent: number; income: number }>;
};

/** Anul de arătat: în ianuarie, anul care tocmai s-a încheiat; altfel anul curent. */
export const recapYearFor = (today: string) => (today.slice(5, 7) === "01" ? Number(today.slice(0, 4)) - 1 : Number(today.slice(0, 4)));

/** Retrospectiva are sens după măcar o lună de notat: 20 de zile cu mișcări în an. */
export const recapReady = (recap: YearRecap) => recap.loggedDays >= 20 && recap.spent > 0;

const round = (value: number) => Math.round(value * 100) / 100;
/** „Lidl Discount 0123” și „lidl” sunt același loc. */
const placeKey = (title: string) => title.trim().toLocaleLowerCase("ro-RO").replace(/\b(discount|srl|s\.?a\.?|romania|ro|magazin|supermarket|hypermarket)\b/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
const GENERIC = /^(cheltuial[ăa] rapid[ăa]|venit rapid|salariu|chirie|rat[ăa]|transfer)/i;

export function yearRecap(items: ReadonlyArray<Move>, year: number, today: string): YearRecap {
  const prefix = `${year}-`;
  const lastDay = today.startsWith(prefix) ? today : `${year}-12-31`;
  const days = new Set<string>();
  const spendDays = new Set<string>();
  const categories = new Map<string, number>();
  const places = new Map<string, { name: string; visits: number }>();
  const months = new Map<string, { spent: number; income: number }>();
  let moves = 0, spent = 0, income = 0, first = "";
  for (const item of items) {
    if (!item.date.startsWith(prefix) || item.date > lastDay || isBalanceAdjustment(item) || !(item.amount > 0)) continue;
    moves += 1;
    days.add(item.date);
    if (!first || item.date < first) first = item.date;
    const month = item.date.slice(0, 7);
    const bucket = months.get(month) || { spent: 0, income: 0 };
    if (item.kind === "income") { income += item.amount; bucket.income += item.amount; months.set(month, bucket); continue; }
    if (item.kind !== "expense") continue;
    spent += item.amount;
    bucket.spent += item.amount;
    months.set(month, bucket);
    spendDays.add(item.date);
    categories.set(item.category, (categories.get(item.category) || 0) + item.amount);
    const title = (item.title || "").trim();
    if (title && !GENERIC.test(title)) {
      const key = placeKey(title);
      const place = places.get(key) || { name: title, visits: 0 };
      place.visits += 1;
      places.set(key, place);
    }
  }

  // Cea mai lungă serie de zile la rând cu ceva notat.
  let longestStreak = 0, run = 0, previous = "";
  for (const day of Array.from(days).sort()) {
    run = previous && addIsoDays(previous, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }
  // Zile fără cheltuieli: de la prima zi notată până azi (sau finalul anului).
  let noSpendDays = 0;
  if (first) for (let day = first; day <= lastDay; day = addIsoDays(day, 1)) if (!spendDays.has(day)) noSpendDays += 1;

  const ranked = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  const monthly = Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, spent: round(value.spent), income: round(value.income) }));
  const withIncome = monthly.filter((item) => item.income > 0 && item.spent > 0);
  const best = withIncome.length >= 2
    ? withIncome.map((item) => ({ month: item.month, spent: item.spent, keptShare: (item.income - item.spent) / item.income })).sort((a, b) => b.keptShare - a.keptShare)[0]
    : monthly.filter((item) => item.spent > 0 && item.month < lastDay.slice(0, 7)).sort((a, b) => a.spent - b.spent).map((item) => ({ month: item.month, spent: item.spent, keptShare: undefined as number | undefined }))[0];
  const topPlace = Array.from(places.values()).sort((a, b) => b.visits - a.visits)[0];

  return {
    year,
    moves,
    loggedDays: days.size,
    longestStreak,
    noSpendDays,
    spent: round(spent),
    income: round(income),
    keptShare: income > 0 ? Math.max(0, (income - spent) / income) : undefined,
    categories: ranked.slice(0, 5).map(([name, amount]) => ({ name, amount: round(amount), share: spent > 0 ? amount / spent : 0 })),
    topPlace: topPlace && topPlace.visits >= 3 ? topPlace : undefined,
    bestMonth: best && (best.keptShare === undefined || best.keptShare > 0) ? best : undefined,
    monthly,
  };
}
