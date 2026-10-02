/**
 * Fondul de urgență: câte luni ar trăi familia din banii puși deoparte, dacă nu mai intră
 * niciun venit. Luna obișnuită vine din cheltuielile ultimelor 90 de zile; până se strâng
 * trei săptămâni de mișcări, folosim totalul plicurilor din plan. Fondul e obiectivul de
 * economisire care se cheamă „fond de urgență / siguranță” (sau „emergency”).
 */
import { addIsoDays, foldRomanian, isBalanceAdjustment, type AppData, type SavingsGoal } from "./finance-data";

export type EmergencyFund = { monthly: number; basis: "spending" | "plan"; goal?: SavingsGoal; saved: number; months: number; target: number; step: number };

const DAY = 86_400_000;
const isFundName = (name: string) => /\b(urgent|sigurant|rezerv|emergency|safety)/.test(foldRomanian(name));
export const findEmergencyGoal = (savings: ReadonlyArray<SavingsGoal>) => savings.find((goal) => isFundName(goal.name));

export function emergencyFund(data: AppData, today: string): EmergencyFund | undefined {
  const since = addIsoDays(today, -89);
  let total = 0, first = today;
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.transferId || isBalanceAdjustment(item) || !(item.amount > 0) || item.date < since || item.date > today) continue;
    total += item.amount;
    if (item.date < first) first = item.date;
  }
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / DAY) + 1;
  const planned = data.settings.salaryPlan.allocations.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
  const fromSpending = days >= 21 ? (total * 30.44) / days : 0;
  const basis = fromSpending > 0 ? "spending" : "plan";
  const monthly = Math.round(basis === "spending" ? fromSpending : planned);
  if (monthly <= 0) return undefined;
  const goal = findEmergencyGoal(data.savings);
  const saved = Math.max(0, goal?.current || 0);
  // Trei luni e pragul de la care o pierdere de venit nu mai e o criză; șase e liniștea.
  const target = goal && goal.target > 0 ? goal.target : Math.ceil((monthly * 3) / 100) * 100;
  const step = Math.max(0, Math.ceil(Math.max(0, target - saved) / 12 / 10) * 10);
  return { monthly, basis, ...(goal ? { goal } : {}), saved, months: Math.floor((saved / monthly) * 10) / 10, target, step };
}
