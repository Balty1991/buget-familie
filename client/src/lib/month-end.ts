/**
 * Asistentul de sfârșit de lună: în ultimele 5 zile înainte de salariu, ce plăți mai vin
 * (plicurile fixe neplătite), cât mai e de cheltuit în plicurile obișnuite și, dacă ritmul
 * de până acum lasă bani la final, unde i-am putea pune: întâi în fondul de urgență, apoi
 * în primul obiectiv neterminat. Jumătate din ce rămâne, ca o zi grea să nu strice planul.
 */
import { addIsoDays, allocationStatus, planEndDate, type AppData, type SavingsGoal } from "./finance-data";
import { findEmergencyGoal } from "./emergency-fund";

export type MonthEnd = {
  payday: string;
  days: number;
  bills: Array<{ id: string; label: string; amount: number }>;
  flexLeft: number;
  perDay: number;
  over: string[];
  projectedLeft: number;
  suggestion?: { goal: SavingsGoal; amount: number };
};

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);

export function monthEnd(data: AppData, today: string): MonthEnd | undefined {
  const plan = data.settings.salaryPlan;
  const payday = planEndDate(plan);
  if (!payday || !plan.allocations.length) return undefined;
  const days = daysBetween(today, payday);
  if (days < 1 || days > 5) return undefined;
  const bills: MonthEnd["bills"] = [];
  const over: string[] = [];
  let flexLeft = 0, flexSpent = 0;
  for (const item of plan.allocations) {
    const status = allocationStatus(data, item);
    if (status.fixed) {
      if (!status.paid && status.remaining >= 1) bills.push({ id: item.id, label: item.label, amount: status.remaining });
      continue;
    }
    if (status.state === "over") over.push(item.label);
    flexLeft += Math.max(0, status.remaining);
    flexSpent += Math.max(0, status.spent);
  }
  const elapsed = plan.periodStart ? Math.max(1, daysBetween(plan.periodStart, today) + 1) : 0;
  // Ritmul obișnuit al ciclului, zi de zi; fără început de ciclu nu ghicim nimic.
  const pace = elapsed ? flexSpent / elapsed : 0;
  const projectedLeft = Math.max(0, Math.round(flexLeft - pace * days));
  const fund = findEmergencyGoal(data.savings);
  const goal = fund && fund.current < fund.target ? fund : data.savings.find((item) => item.current < item.target);
  const amount = Math.floor(projectedLeft / 2 / 10) * 10;
  return {
    payday: addIsoDays(today, days),
    days,
    bills,
    flexLeft: Math.round(flexLeft * 100) / 100,
    perDay: Math.floor((flexLeft / days) * 100) / 100,
    over,
    projectedLeft,
    ...(goal && amount >= 20 ? { suggestion: { goal, amount: Math.min(amount, Math.ceil(goal.target - goal.current)) } } : {}),
  };
}
