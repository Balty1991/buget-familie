/**
 * Monitorizare rate: cât s-a plătit pe lună, cât mai rămâne, câte luni la ritmul actual.
 */
import { isoToday, type AppData } from "./finance-data";

export type DebtMonthBucket = { key: string; paid: number };
export type DebtTrack = {
  id: string;
  name: string;
  remaining: number;
  monthly: number;
  paid: number;
  monthsLeft: number | null;
};

export type DebtMonitor = {
  remaining: number;
  paidTotal: number;
  monthly: number;
  thisMonthPaid: number;
  activeCount: number;
  series: DebtMonthBucket[];
  byDebt: DebtTrack[];
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function debtMonitor(data: AppData, months = 6, today = isoToday()): DebtMonitor {
  const payments = data.transactions.filter((item) => item.debtId && item.kind === "expense");
  const paidTotal = Math.round(payments.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const remaining = Math.round(data.debts.reduce((sum, item) => sum + Math.max(0, item.remaining), 0) * 100) / 100;
  const monthly = Math.round(data.debts.reduce((sum, item) => sum + Math.max(0, item.monthly), 0) * 100) / 100;
  const byMonth = new Map<string, number>();
  for (const payment of payments) {
    const key = payment.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) || 0) + payment.amount);
  }
  const now = new Date(`${today}T12:00:00`);
  const series: DebtMonthBucket[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1, 12);
    const key = monthKey(date);
    series.push({ key, paid: Math.round((byMonth.get(key) || 0) * 100) / 100 });
  }
  const paidByDebt = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.debtId) continue;
    paidByDebt.set(payment.debtId, (paidByDebt.get(payment.debtId) || 0) + payment.amount);
  }
  const byDebt: DebtTrack[] = data.debts
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      remaining: debt.remaining,
      monthly: debt.monthly,
      paid: Math.round((paidByDebt.get(debt.id) || 0) * 100) / 100,
      monthsLeft: debt.monthly > 0 && debt.remaining > 0 ? Math.ceil(debt.remaining / debt.monthly) : debt.remaining > 0 ? null : 0,
    }))
    .sort((left, right) => right.remaining - left.remaining || left.name.localeCompare(right.name, "ro-RO"));
  return {
    remaining,
    paidTotal,
    monthly,
    thisMonthPaid: Math.round((byMonth.get(today.slice(0, 7)) || 0) * 100) / 100,
    activeCount: data.debts.filter((item) => item.remaining > 0).length,
    series,
    byDebt,
  };
}
