/**
 * Obiceiuri mici care țin omul aproape de aplicație, fără puncte și fără medalii:
 * câte zile la rând a notat și câte zile din lună au trecut fără nicio cheltuială.
 */
import { addIsoDays } from "@/lib/finance-data";

type Move = { date: string; kind: string; adjustment?: boolean; transferId?: string };

const real = (item: Move) => !item.adjustment && !item.transferId;

/** Zile la rând cu măcar o mișcare notată, până azi (sau până ieri, dacă azi încă nu e nimic). */
export function loggingStreak(items: ReadonlyArray<Move>, today: string): number {
  const days = new Set(items.filter(real).map((item) => item.date));
  let day = days.has(today) ? today : addIsoDays(today, -1);
  let count = 0;
  while (days.has(day) && count < 400) {
    count++;
    day = addIsoDays(day, -1);
  }
  return count;
}

/**
 * Zile fără cheltuieli în luna curentă, până ieri inclusiv (azi încă nu s-a terminat).
 * Contează doar dacă omul notează: o lună fără nicio mișcare nu e „fără cheltuieli”, e necompletată.
 */
export function noSpendDays(items: ReadonlyArray<Move>, today: string): number {
  const monthStart = `${today.slice(0, 7)}-01`;
  const logged = items.filter(real);
  if (!logged.some((item) => item.date >= monthStart && item.date <= today)) return 0;
  const spent = new Set(logged.filter((item) => item.kind === "expense").map((item) => item.date));
  let count = 0;
  for (let day = monthStart; day < today; day = addIsoDays(day, 1)) if (!spent.has(day)) count++;
  return count;
}
