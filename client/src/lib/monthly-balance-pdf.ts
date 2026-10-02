/* Buget Familie — cifrele unei luni (pentru raportul PDF din monthly-report-pdf.ts), din datele din browser. */
import { financialBalance, type AppData } from "@/lib/finance-data";

const monthRange = (month: string) => { const [year, index] = month.split("-").map(Number); return { start: `${month}-01`, end: `${month}-${String(new Date(year, index, 0).getDate()).padStart(2, "0")}` }; };

export type MonthlyBalanceSnapshot = ReturnType<typeof monthlyBalanceSnapshot>;

export const monthlyBalanceSnapshot = (data: AppData, month: string, memberId?: string) => {
  const { start, end } = monthRange(month); const balance = financialBalance(data, start, end, memberId); const selectedMember = data.settings.members.find((member) => member.id === memberId); const perspective = selectedMember?.name || (data.settings.members.length > 1 ? "Familie" : "Personal");
  const transactions = data.transactions.filter((item) => item.date >= start && item.date <= end && (!memberId || item.memberId === memberId)).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const debts = data.debts.filter((item) => !memberId || !item.memberId || item.memberId === memberId); const savings = data.savings.filter((item) => !memberId || !item.memberId || item.memberId === memberId);
  return { month, start, end, perspective, balance, transactions, debts, savings };
};
