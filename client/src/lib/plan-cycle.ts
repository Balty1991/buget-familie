import { inPlanPeriod, isWeeklyPaced, planAllocationMath, planEndDate, type AppData } from "@/lib/finance-data";

/** Cifrele ciclului de salariu, o singură dată. Ecranele nu-și mai recalculează săptămânile separat. */
export function planCycle(data: AppData) {
  const plan = data.settings.salaryPlan;
  const planEnd = planEndDate(plan);
  const alloc = planAllocationMath(data);
  const selected = data.settings.paymentSources.filter((source) => alloc.sourceIds.includes(source.id));
  const periodExpenses = data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  const days = planEnd ? Math.max(1, Math.floor((new Date(`${planEnd}T12:00:00`).valueOf() - new Date(`${plan.periodStart}T12:00:00`).valueOf()) / 86400000) + 1) : 7;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weeklyPacedTotal = plan.allocations.filter((item) => isWeeklyPaced(item, plan)).reduce((sum, item) => sum + item.amount, 0);
  const weekly = plan.weeklyLimit || weeklyPacedTotal / weeks;
  return { plan, planEnd, selected, periodExpenses, days, weeks, weekly, weeklyPacedTotal, remaining: alloc.unrepartized, ...alloc };
}
