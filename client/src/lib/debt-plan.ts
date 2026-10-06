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

export type DebtScheduleStatus = "unpaid" | "partial" | "paid" | "overpaid";
export type DebtScheduleRow = {
  index: number;
  date: string;
  planned: number;
  paidAmount: number;
  remainingAmount: number;
  status: DebtScheduleStatus;
  interest?: number;
  paidOn?: string;
};

const isoDay = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Plățile aceleiași luni stau pe o rată. 300 din 700 rămâne parțial, nu bifat. */
export function buildDebtSchedule(input: {
  monthly: number;
  remaining: number;
  annualRate?: number;
  dueDate?: string;
  payments: Array<{ amount: number; date: string; debtRemainingAfter?: number }>;
  futureLimit?: number;
}): { rows: DebtScheduleRow[]; plan: Amortization; futureCapped: boolean } {
  const monthly = Math.max(0, input.monthly);
  const plan = amortize(input.remaining, input.annualRate, monthly);
  const payments = input.payments.filter((item) => item.amount > 0).slice().sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, typeof payments>();
  for (const payment of payments) {
    const key = payment.date.slice(0, 7);
    const list = byMonth.get(key) || [];
    list.push(payment);
    byMonth.set(key, list);
  }
  const rows: DebtScheduleRow[] = [];
  for (const [key, list] of byMonth) {
    const paidAmount = cents(list.reduce((sum, item) => sum + item.amount, 0));
    const closed = list.some((item) => item.debtRemainingAfter === 0);
    const planned = closed && paidAmount + 0.009 < monthly ? paidAmount : monthly;
    const remainingAmount = cents(Math.max(0, planned - paidAmount));
    const status: DebtScheduleStatus = remainingAmount <= 0.009 ? (paidAmount > planned + 0.009 ? "overpaid" : "paid") : "partial";
    rows.push({ index: rows.length + 1, date: `${key}-01`, planned, paidAmount, remainingAmount, status, paidOn: list[list.length - 1]?.date });
  }
  const lastPaidMonth = payments.length ? payments[payments.length - 1].date.slice(0, 7) : "";
  const first = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? new Date(`${input.dueDate}T12:00:00`) : new Date();
  let cursor = new Date(first.getFullYear(), first.getMonth(), 1, 12);
  while (lastPaidMonth && isoDay(cursor).slice(0, 7) <= lastPaidMonth) cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
  const limit = input.futureLimit ?? 120;
  for (const [offset, row] of plan.rows.slice(0, limit).entries()) {
    const month = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1, 12);
    const day = Math.min(first.getDate(), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
    rows.push({ index: rows.length + 1, date: isoDay(new Date(month.getFullYear(), month.getMonth(), day, 12)), planned: row.payment, paidAmount: 0, remainingAmount: row.payment, status: "unpaid", interest: row.interest });
  }
  return { rows, plan, futureCapped: plan.rows.length > limit };
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
  /** Calendarul plăților: pentru fiecare lună (primele 36), cât merge la fiecare datorie. */
  schedule: Array<Record<string, number>>;
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
  const schedule: Array<Record<string, number>> = [];
  while (Array.from(balance.values()).some((value) => value > 0.004) && month < MAX_MONTHS) {
    month += 1;
    let available = budget;
    const paid: Record<string, number> = {};
    const pay = (id: string, amount: number) => { paid[id] = cents((paid[id] || 0) + amount); };
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
      const due = Math.min(left, Math.max(0, debt.monthly), available);
      balance.set(debt.id, cents(left - due));
      available = cents(available - due);
      pay(debt.id, due);
    }
    for (const debt of order) {
      if (available <= 0.004) break;
      const left = balance.get(debt.id) || 0;
      if (left <= 0.004) continue;
      const more = Math.min(left, available);
      balance.set(debt.id, cents(left - more));
      available = cents(available - more);
      pay(debt.id, more);
    }
    for (const debt of order) {
      if (!(debt.id in closedAt) && (balance.get(debt.id) || 0) <= 0.004) closedAt[debt.id] = month;
    }
    totals.push(cents(Array.from(balance.values()).reduce((sum, value) => sum + Math.max(0, value), 0)));
    if (schedule.length < 36) schedule.push(paid);
  }
  const done = Array.from(balance.values()).every((value) => value <= 0.004);
  return { strategy, order, months: done ? month : null, totalInterest, closedAt, totals, schedule };
}

/** Avalanșa costă cel mai puțin când știm dobânzile; fără ele, mingea de zăpadă. */
export const recommendedStrategy = (debts: Debt[]): PayoffStrategy =>
  debts.some((debt) => (debt.annualRate || 0) > 0) ? "avalanche" : "snowball";

/** „martie 2029” pentru luna în care se închide ultima datorie. */
export const monthAfter = (months: number, from = new Date()) => new Date(from.getFullYear(), from.getMonth() + months, 1, 12);
