/**
 * Plan de ieșire din datorii cu dobândă (testarea cu utilizatori, M4).
 *
 * Înainte, scadențarul era sold ÷ rată: 18.500 / 620 = 30 de rate, deși un credit de nevoi
 * personale cu 15–20% dobândă are mai multe. Aici fiecare lună adaugă dobânda pe sold,
 * apoi scade plata. „Avalanșă” plătește întâi dobânda cea mai mare (costă cel mai puțin),
 * „minge de zăpadă” întâi soldul cel mai mic (motivează prin datorii închise repede).
 */
import type { Debt } from "./finance-data";

export type DebtKind = "credit" | "card" | "ifn" | "persoane";
export type PayoffStrategy = "avalanche" | "snowball";

const MAX_MONTHS = 600;
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const monthlyRate = (annualRate: number | undefined) => Math.max(0, annualRate || 0) / 100 / 12;

export type Amortization = {
  /** Câte rate mai sunt; `null` când rata nu acoperă nici dobânda (datoria crește). */
  months: number | null;
  totalInterest: number;
  rows: Array<{ index: number; payment: number; interest: number; principal: number; balanceAfter: number }>;
};

/** Rata fixă aplicată pe un sold cu dobândă anuală (procent). */
export function amortize(balance: number, annualRate: number | undefined, monthly: number): Amortization {
  const rate = monthlyRate(annualRate);
  let left = Math.max(0, balance);
  const rows: Amortization["rows"] = [];
  let totalInterest = 0;
  if (left <= 0) return { months: 0, totalInterest: 0, rows };
  if (monthly <= 0 || monthly <= left * rate) return { months: null, totalInterest: 0, rows };
  for (let index = 1; index <= MAX_MONTHS && left > 0.004; index += 1) {
    const interest = cents(left * rate);
    const payment = cents(Math.min(monthly, left + interest));
    const principal = cents(payment - interest);
    left = cents(left - principal);
    totalInterest = cents(totalInterest + interest);
    rows.push({ index, payment, interest, principal, balanceAfter: Math.max(0, left) });
  }
  return { months: left > 0.004 ? null : rows.length, totalInterest, rows };
}

export type PayoffPlan = {
  strategy: PayoffStrategy;
  /** Ordinea în care primesc banii în plus. */
  order: Debt[];
  /** Luni până la ultima datorie închisă; `null` dacă plățile nu acoperă dobânzile. */
  months: number | null;
  totalInterest: number;
  /** Luna (1, 2…) în care se închide fiecare datorie. */
  closedAt: Record<string, number>;
  /** Totalul datoriilor la sfârșitul fiecărei luni, pentru grafic (primul element e azi). */
  totals: number[];
};

export const orderDebts = (debts: Debt[], strategy: PayoffStrategy) =>
  [...debts].sort((a, b) => strategy === "avalanche"
    ? (b.annualRate || 0) - (a.annualRate || 0) || a.remaining - b.remaining || a.name.localeCompare(b.name, "ro-RO")
    : a.remaining - b.remaining || (b.annualRate || 0) - (a.annualRate || 0) || a.name.localeCompare(b.name, "ro-RO"));

/**
 * Simulează toate datoriile deodată: fiecare primește rata ei, iar banii în plus și ratele
 * datoriilor deja închise merg la prima datorie din ordine.
 */
export function payoffPlan(debts: Debt[], extra: number, strategy: PayoffStrategy): PayoffPlan {
  const open = debts.filter((debt) => debt.remaining > 0);
  const order = orderDebts(open, strategy);
  const balance = new Map(open.map((debt) => [debt.id, debt.remaining]));
  const closedAt: Record<string, number> = {};
  const budget = open.reduce((sum, debt) => sum + Math.max(0, debt.monthly), 0) + Math.max(0, extra);
  let totalInterest = 0;
  let month = 0;
  const totals = [cents(open.reduce((sum, debt) => sum + debt.remaining, 0))];
  while (Array.from(balance.values()).some((value) => value > 0.004) && month < MAX_MONTHS) {
    month += 1;
    let available = budget;
    for (const debt of order) {
      const left = balance.get(debt.id) || 0;
      if (left <= 0.004) continue;
      const interest = cents(left * monthlyRate(debt.annualRate));
      totalInterest = cents(totalInterest + interest);
      balance.set(debt.id, cents(left + interest));
    }
    // Întâi ratele obligatorii, apoi restul pe prima datorie deschisă din ordine.
    for (const debt of order) {
      const left = balance.get(debt.id) || 0;
      if (left <= 0.004) continue;
      const pay = Math.min(left, Math.max(0, debt.monthly), available);
      balance.set(debt.id, cents(left - pay));
      available = cents(available - pay);
    }
    for (const debt of order) {
      if (available <= 0.004) break;
      const left = balance.get(debt.id) || 0;
      if (left <= 0.004) continue;
      const pay = Math.min(left, available);
      balance.set(debt.id, cents(left - pay));
      available = cents(available - pay);
    }
    for (const debt of order) {
      if (!(debt.id in closedAt) && (balance.get(debt.id) || 0) <= 0.004) closedAt[debt.id] = month;
    }
    totals.push(cents(Array.from(balance.values()).reduce((sum, value) => sum + Math.max(0, value), 0)));
  }
  const done = Array.from(balance.values()).every((value) => value <= 0.004);
  return { strategy, order, months: done ? month : null, totalInterest, closedAt, totals };
}

/** Avalanșa costă cel mai puțin când știm dobânzile; fără ele, mingea de zăpadă. */
export const recommendedStrategy = (debts: Debt[]): PayoffStrategy =>
  debts.some((debt) => (debt.annualRate || 0) > 0) ? "avalanche" : "snowball";

/** „martie 2029” pentru luna în care se închide ultima datorie. */
export const monthAfter = (months: number, from = new Date()) => new Date(from.getFullYear(), from.getMonth() + months, 1, 12);
