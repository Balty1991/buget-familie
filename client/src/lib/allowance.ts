/**
 * Buzunarul copilului.
 *
 * Nu introduce o contabilitate paralelă: banii de buzunar sunt un plic obișnuit al
 * familiei, atribuit unui membru marcat drept copil, iar cheltuielile lui sunt
 * cheltuieli obișnuite ale familiei. Modulul doar citește starea acelui plic și o
 * prezintă în termeni pe care un copil îi înțelege — cât mai am, cât am cheltuit,
 * peste câte zile se reumple.
 */
import {
  allocationBudget,
  allocationSpent,
  allocationStatus,
  inPlanPeriod,
  isoToday,
  planEndDate,
  type AppData,
  type BudgetAllocation,
  type FamilyMember,
  type Transaction,
} from "./finance-data";

export type PocketEnvelope = {
  allocation: BudgetAllocation;
  budget: number;
  spent: number;
  remaining: number;
  usage: number;
};

export type ChildPocket = {
  member: FamilyMember;
  envelopes: PocketEnvelope[];
  budget: number;
  spent: number;
  remaining: number;
  usage: number;
  /** Ultima zi a ciclului curent; de la ea încolo plicul primește o sumă nouă. */
  refillsOn: string;
  daysLeft: number;
  /** Cât se poate cheltui pe zi până la reumplere, fără a depăși plicul. */
  perDay: number;
  recent: Transaction[];
};

export const childMembers = (data: AppData) => data.settings.members.filter((member) => member.kind === "child");

const round2 = (value: number) => Math.round(value * 100) / 100;

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00`).valueOf() - new Date(`${from}T12:00:00`).valueOf()) / 86_400_000);

/**
 * Starea buzunarului unui copil. Întoarce `undefined` dacă membrul nu există sau nu
 * are niciun plic pe numele lui — preferăm să nu arătăm un ecran gol care pare o eroare.
 */
export function childPocket(data: AppData, memberId: string, asOf = isoToday()): ChildPocket | undefined {
  const member = data.settings.members.find((item) => item.id === memberId);
  if (!member) return undefined;
  const owned = data.settings.salaryPlan.allocations.filter((item) => item.memberId === memberId);
  if (!owned.length) return undefined;

  const envelopes: PocketEnvelope[] = owned.map((allocation) => {
    const status = allocationStatus(data, allocation);
    return {
      allocation,
      budget: round2(allocationBudget(data, allocation)),
      spent: round2(allocationSpent(data, allocation)),
      remaining: round2(status.remaining),
      usage: status.usage,
    };
  });

  const budget = round2(envelopes.reduce((sum, item) => sum + item.budget, 0));
  const spent = round2(envelopes.reduce((sum, item) => sum + item.spent, 0));
  const remaining = round2(budget - spent);
  const refillsOn = planEndDate(data.settings.salaryPlan) || asOf;
  const daysLeft = Math.max(0, daysBetween(asOf, refillsOn));

  const ownedIds = new Set(owned.map((item) => item.id));
  const recent = data.transactions
    .filter((item) => item.kind === "expense" && item.memberId === memberId && inPlanPeriod(item.date, data.settings.salaryPlan)
      && (item.allocationId ? ownedIds.has(item.allocationId) : owned.some((allocation) => (!allocation.category || allocation.category === item.category) && (!allocation.sourceId || allocation.sourceId === item.sourceId))))
    .sort((left, right) => right.date.localeCompare(left.date) || (right.createdAt || "").localeCompare(left.createdAt || ""))
    .slice(0, 12);

  return {
    member,
    envelopes,
    budget,
    spent,
    remaining,
    usage: budget > 0 ? spent / budget : 0,
    refillsOn,
    daysLeft,
    // Ziua de azi se numără: cu o zi rămasă, tot ce e în plic se poate cheltui azi.
    perDay: remaining > 0 ? round2(remaining / Math.max(1, daysLeft + 1)) : 0,
    recent,
  };
}
