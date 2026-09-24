import { inPlanPeriod, isWeeklyPaced, planAllocationMath, planEndDate, type AppData } from "@/lib/finance-data";
import { periodDays } from "@/lib/calendar-budget";

/** Cifrele ciclului de salariu, o singură dată. Ecranele nu-și mai recalculează săptămânile separat. */
export function planCycle(data: AppData) {
  const plan = data.settings.salaryPlan;
  const planEnd = planEndDate(plan);
  const alloc = planAllocationMath(data);
  const selected = data.settings.paymentSources.filter((source) => alloc.sourceIds.includes(source.id));
  const periodExpenses = data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  const days = planEnd ? Math.max(1, periodDays(plan.periodStart, planEnd)) : 7;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weeklyPacedTotal = plan.allocations.filter((item) => isWeeklyPaced(item, plan)).reduce((sum, item) => sum + item.amount, 0);
  const weekly = plan.weeklyLimit || weeklyPacedTotal / weeks;
  return { plan, planEnd, selected, periodExpenses, days, weeks, weekly, weeklyPacedTotal, remaining: alloc.unrepartized, ...alloc };
}

/**
 * Încă nu știm câți bani sunt: nicio sursă cu sold și nicio mișcare. Plicurile nu pot fi
 * „peste limită” față de zero lei pe care omul nici n-a apucat să-i scrie (testare, M1).
 */
export const hasNoMoneyYet = (data: AppData) =>
  data.transactions.length === 0 && data.settings.paymentSources.every((source) => source.openingBalance <= 0);
