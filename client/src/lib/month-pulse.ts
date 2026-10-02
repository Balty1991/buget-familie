/**
 * Pulsul lunii din Mișcări: cât a ieșit luna asta, pe ce, și cum stă față de luna trecută
 * până în aceeași zi. Ajustările de sold și mutările între surse nu sunt cheltuieli.
 */
import { addIsoDays, formatDate, isBalanceAdjustment, type Transaction } from "@/lib/finance-data";

type Move = Pick<Transaction, "id" | "date" | "kind" | "category" | "amount" | "adjustment" | "transferId">;
export type PulseSlice = { category: string; amount: number };
export type MonthPulse = { month: string; spent: number; income: number; lastToDate: number; slices: PulseSlice[]; rest: number };

const monthOf = (iso: string) => iso.slice(0, 7);

/** Primele `top` categorii după sumă; restul se adună în `rest`. */
export function monthPulse(items: ReadonlyArray<Move>, today: string, top = 5): MonthPulse {
  const month = monthOf(today);
  const lastMonth = monthOf(addIsoDays(`${month}-01`, -1));
  // Aceeași zi luna trecută; 31 martie se compară cu 28/29 februarie, nu cu 3 martie.
  const lastDays = Number(addIsoDays(`${month}-01`, -1).slice(8, 10));
  const lastCut = `${lastMonth}-${String(Math.min(Number(today.slice(8, 10)), lastDays)).padStart(2, "0")}`;
  const totals = new Map<string, number>();
  let spent = 0, income = 0, lastToDate = 0;
  for (const item of items) {
    if (isBalanceAdjustment(item) || !(item.amount > 0)) continue;
    const itemMonth = monthOf(item.date);
    if (itemMonth === month && item.date <= today) {
      if (item.kind === "income") { income += item.amount; continue; }
      if (item.kind !== "expense") continue;
      spent += item.amount;
      totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
    } else if (item.kind === "expense" && itemMonth === lastMonth && item.date <= lastCut) {
      lastToDate += item.amount;
    }
  }
  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const slices = ranked.slice(0, top).map(([category, amount]) => ({ category, amount: round(amount) }));
  const rest = round(ranked.slice(top).reduce((sum, [, amount]) => sum + amount, 0));
  return { month, spent: round(spent), income: round(income), lastToDate: round(lastToDate), slices, rest };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** „Astăzi”, „Ieri”, „Miercuri, 30 septembrie”; anul apare doar pentru alt an. */
export function dayLabel(date: string, today: string, translate: (text: string) => string = (text) => text): string {
  if (date === today) return translate("Astăzi");
  if (date === addIsoDays(today, -1)) return translate("Ieri");
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  const text = formatDate(date, sameYear ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export type HeatDay = { date: string; amount: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };

/**
 * Harta lunii: fiecare zi cu cât s-a cheltuit și o treaptă de culoare (0 = nimic, 4 = cea mai
 * scumpă zi). Treptele sunt față de cea mai mare zi a lunii, ca o chirie să nu le „spele” pe
 * toate: peste de trei ori ziua obișnuită (mediana), ziua e oricum în treapta de sus.
 */
export function monthHeat(items: ReadonlyArray<Move>, today: string): HeatDay[] {
  const month = monthOf(today);
  const lastDay = Number(addIsoDays(`${addIsoDays(`${month}-01`, 32).slice(0, 7)}-01`, -1).slice(8, 10));
  const byDay = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "expense" || isBalanceAdjustment(item) || !(item.amount > 0) || monthOf(item.date) !== month) continue;
    byDay.set(item.date, (byDay.get(item.date) || 0) + item.amount);
  }
  const spent = Array.from(byDay.values()).sort((a, b) => a - b);
  const median = spent.length ? spent[Math.floor(spent.length / 2)] : 0;
  const cap = Math.max(1, Math.min(spent[spent.length - 1] || 0, median * 3 || Infinity));
  return Array.from({ length: lastDay }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const amount = round(byDay.get(date) || 0);
    const level = (amount <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((amount / cap) * 4)))) as HeatDay["level"];
    return { date, amount, level, future: date > today };
  });
}
