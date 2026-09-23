/**
 * Regula „de azi, nu și pe zilele trecute”, într-un singur loc.
 *
 * Perioada unui plic începe luni, dar planul se face de multe ori joi. Împărțirea pe tranșe
 * de șapte zile lasă atunci bani pe zilele care au trecut deja, iar zilele rămase din
 * săptămâna curentă primesc mai puțin decât pot ține. Aici stă corecția: tranșa începută
 * păstrează doar partea zilelor rămase, la ritmul egal al întregii perioade, iar restul
 * pleacă în săptămânile următoare.
 *
 * Modulul este folosit și de ecranul Plan, și de asistent, ca amândouă să spună aceleași
 * cifre despre aceeași săptămână.
 */
import { periodDays, remainingPace, startedWeekShare, totalFromWeeklyPace, type StartedWeekShare } from "./calendar-budget";
import { allocationWeeksStatus, appendAllocationHistory, isoToday, isWeeklyPaced, planEndDate, transferBetweenWeeks, type AppData, type BudgetAllocation } from "./finance-data";
import { t } from "./i18n";

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Ultima tranșă e întinsă peste zilele de flexibilitate ale venitului ca să numere
 * cheltuielile, dar buget primesc doar zilele până la venit — altfel ar trage spre ea mai
 * mult decât i se cuvine.
 */
const budgetDays = (week: { start: string; end: string; days: number }, horizon: string) =>
  (horizon && week.end > horizon ? Math.max(1, periodDays(week.start, horizon)) : week.days);

export type StartedWeekPlan = { weekIndex: number; budget: number; remaining: number; share: StartedWeekShare; movable: number };

/** Câți bani revin zilelor rămase din tranșa curentă a unui plic, la ritmul egal al perioadei. */
export function startedWeekPlan(data: AppData, allocation: BudgetAllocation, today = isoToday()): StartedWeekPlan | undefined {
  if (!isWeeklyPaced(allocation, data.settings.salaryPlan)) return undefined;
  const weeks = allocationWeeksStatus(data, allocation);
  if (weeks.length < 2) return undefined;
  const index = weeks.findIndex((week) => today >= week.start && today <= week.end);
  if (index < 0) return undefined;
  const week = weeks[index];
  const left = weeks.slice(index).reduce((sum, item) => sum + Math.max(0, item.remaining), 0);
  const horizon = planEndDate(data.settings.salaryPlan);
  if (!horizon) return undefined;
  const share = startedWeekShare({ start: week.start, end: week.end, days: week.days, budget: week.budget }, today, remainingPace(left, horizon, today));
  if (!share || share.daysLeft >= share.daysTotal) return undefined;
  return { weekIndex: week.index, budget: week.budget, remaining: week.remaining, share, movable: round(Math.max(0, week.remaining - share.fair)) };
}

/**
 * Mută surplusul tranșei începute în săptămânile care urmează, proporțional cu zilele lor
 * de buget. Pe o sumă împărțită egal, redistribuirea pe zile dă exact ritmul pe săptămână
 * întreagă: ce nu s-a putut cheltui luni–miercuri se împarte peste zilele rămase, nu se pierde.
 */
export function spreadStartedWeekSurplus(data: AppData, allocationId: string, weekIndex: number, amount: number): AppData {
  const allocation = data.settings.salaryPlan.allocations.find((item) => item.id === allocationId);
  if (!allocation || amount <= 0) return data;
  const targets = allocationWeeksStatus(data, allocation).filter((week) => week.index > weekIndex);
  const horizon = planEndDate(data.settings.salaryPlan) || "";
  const totalDays = targets.reduce((sum, week) => sum + budgetDays(week, horizon), 0);
  if (!targets.length || totalDays <= 0) return data;
  let next = data;
  let moved = 0;
  targets.forEach((target, index) => {
    const share = round(index === targets.length - 1 ? amount - moved : round(amount * budgetDays(target, horizon) / totalDays));
    if (share <= 0) return;
    const step = transferBetweenWeeks(next, { allocationId, fromWeekIndex: weekIndex, toWeekIndex: target.index, amount: share, note: t("Echilibrare: săptămâna începută păstrează partea zilelor rămase") });
    if (!step) return;
    const transfer = step.settings.salaryPlan.weekTransfers?.[0];
    next = appendAllocationHistory(step, { kind: "week-transfer", referenceId: transfer?.id, allocationId, allocationLabel: allocation.label, amount: share, fromWeekIndex: weekIndex, toWeekIndex: target.index });
    moved = round(moved + share);
  });
  return moved > 0 ? next : data;
}

/** Echilibrarea gata făcută: se aplică la salvarea unui plic sau la cererea asistentului. */
export function levelStartedWeek(data: AppData, allocationId: string, today = isoToday()): AppData {
  const allocation = data.settings.salaryPlan.allocations.find((item) => item.id === allocationId);
  const shift = allocation ? startedWeekPlan(data, allocation, today) : undefined;
  if (!shift || shift.movable < 0.01) return data;
  return spreadStartedWeekSurplus(data, allocationId, shift.weekIndex, shift.movable);
}

/**
 * Cât cere un ritm pe săptămână întreagă, de azi până la venit. „600 pe săptămână” într-o
 * perioadă începută joi înseamnă banii celor 23 de zile rămase, nu ai celor 26 din calendar.
 */
export function totalForWeeklyPace(data: AppData, weekly: number, today = isoToday()): number | undefined {
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  if (!end || !plan.periodStart || weekly <= 0) return undefined;
  const total = totalFromWeeklyPace(weekly, plan.periodStart, end, today > plan.periodStart ? today : undefined);
  return total > 0 ? Math.round(total) : undefined;
}
