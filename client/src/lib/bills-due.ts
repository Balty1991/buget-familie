/**
 * Facturile bifate la pornire, din banii deja în casă. Fiecare își ia plicul ei,
 * în ordinea listei, până se termină suma scrisă. Soldul de pornire nu se micșorează:
 * plicul fix e cel care oprește „Poți folosi azi” să promită banii ratei.
 */
import { newId, type BudgetAllocation } from "./finance-data";

export function billsDueEnvelopes(
  bills: Array<{ label: string; category: string; amount: number }>,
  sourceId: string,
  cash: number,
  now = new Date().toISOString(),
): BudgetAllocation[] {
  let left = Math.round(Math.max(0, cash) * 100) / 100;
  const envelopes: BudgetAllocation[] = [];
  for (const bill of bills) {
    const asked = Math.round(Math.max(0, bill.amount) * 100) / 100;
    if (!bill.label.trim() || asked < 1 || left < 1) continue;
    const amount = Math.round(Math.min(asked, left) * 100) / 100;
    envelopes.push({
      id: newId("allocation"),
      label: bill.label.trim(),
      amount,
      category: bill.category,
      sourceId,
      weeklyPace: false,
      updatedAt: now,
    });
    left = Math.round((left - amount) * 100) / 100;
  }
  return envelopes;
}
