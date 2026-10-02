/**
 * Modul vacanță: o călătorie cu bugetul ei, separat de plicuri. Cât ține, ce notezi se leagă
 * de ea (`tripId`) și nu mai consumă plicurile lunii — banii de vacanță sunt puși deoparte
 * dinainte. Călătoria se sincronizează cu familia; la unire câștigă varianta mai nouă.
 * Moneda (EUR, BGN…) e doar pentru afișare: registrul rămâne în lei.
 */
import { addIsoDays, isBalanceAdjustment, type AppData, type Transaction } from "./finance-data";
import type { Trip } from "./trip-data";

export { mergeTrip, normalizeTrip, type Trip } from "./trip-data";

const DAY = 86_400_000;
const span = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);


/** Călătoria în care notăm acum: între prima și ultima zi și neîncheiată de mână. */
export const activeTrip = (data: AppData, today: string): Trip | undefined => {
  const trip = data.settings.trip;
  return trip && !trip.closedAt && trip.start <= today && today <= trip.end ? trip : undefined;
};

export type TripStats = {
  spent: number;
  left: number;
  days: number;
  /** Ziua călătoriei (1…days); 0 înainte de plecare. */
  dayIndex: number;
  daysLeft: number;
  perDayLeft: number;
  perDaySpent: number;
  byCategory: Array<{ category: string; amount: number }>;
  moves: Transaction[];
  done: boolean;
};

export function tripStats(data: AppData, trip: Trip, today: string): TripStats {
  const moves = data.transactions.filter((item) => item.tripId === trip.id && item.kind === "expense" && !isBalanceAdjustment(item) && item.amount > 0).sort((a, b) => b.date.localeCompare(a.date));
  const spent = Math.round(moves.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const days = span(trip.start, trip.end) + 1;
  const done = Boolean(trip.closedAt) || today > trip.end;
  const dayIndex = today < trip.start ? 0 : Math.min(days, span(trip.start, today) + 1);
  const daysLeft = done ? 0 : today < trip.start ? days : days - dayIndex + 1;
  const left = Math.round((trip.budget - spent) * 100) / 100;
  const totals = new Map<string, number>();
  for (const item of moves) totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  const byCategory = Array.from(totals.entries()).map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  const lived = done ? days : Math.max(1, dayIndex);
  return { spent, left, days, dayIndex, daysLeft, perDayLeft: daysLeft ? Math.floor((Math.max(0, left) / daysLeft) * 100) / 100 : 0, perDaySpent: Math.round((spent / lived) * 100) / 100, byCategory, moves, done };
}

/** O călătorie nouă, de mâine pentru o săptămână, dacă omul nu alege altfel. */
export const draftTrip = (today: string) => ({ start: addIsoDays(today, 1), end: addIsoDays(today, 7) });
