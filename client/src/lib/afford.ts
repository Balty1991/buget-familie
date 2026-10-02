/**
 * „Îmi permit?”: răspuns pe loc, cât scrii suma. Cu plic ales, întâi plicul (tranșa săptămânii,
 * dacă are ritm), apoi banii nerepartizați. Fără plic, banii nerepartizați până la salariu,
 * cu grija ca după cumpărătură să rămână de trăit pe zi. Și, ca să se vadă prețul real,
 * cât din drumul spre primul obiectiv ar însemna suma (în săptămâni de economisit).
 */
import { envelopeDecisionStatus, planAllocationMath, planForecast, type AppData } from "./finance-data";
import { savingsSuggestion } from "./household-insights";

export type AffordTone = "yes" | "tight" | "no";
export type Afford = {
  tone: AffordTone;
  amount: number;
  free: number;
  freeAfter: number;
  daysLeft: number;
  perDayAfter: number;
  envelope?: { label: string; before: number; after: number; week?: number };
  goal?: { name: string; weeks: number };
};

const round = (value: number) => Math.round(value * 100) / 100;

export function affordCheck(data: AppData, amount: number, allocationId: string | undefined, today: string): Afford | undefined {
  if (!(amount > 0)) return undefined;
  const math = planAllocationMath(data);
  const free = round(Math.max(0, math.unrepartized));
  const forecast = planForecast(data, today);
  const daysLeft = Math.max(1, forecast.remainingDays);
  const goalRow = data.savings.find((item) => item.current < item.target);
  const plan = goalRow ? savingsSuggestion(data, goalRow, today) : undefined;
  const goal = goalRow && plan && plan.monthly > 0 ? { name: goalRow.name, weeks: Math.max(1, Math.round((amount / plan.monthly) * 4.345)) } : undefined;
  const allocation = allocationId ? data.settings.salaryPlan.allocations.find((item) => item.id === allocationId) : undefined;
  if (allocation) {
    const status = envelopeDecisionStatus(data, allocation, today);
    const before = round(Math.max(0, status.remaining));
    const after = round(before - amount);
    const freeAfter = after >= 0 ? free : round(free + after);
    const tone: AffordTone = after >= 0 ? (after < status.budget * 0.1 ? "tight" : "yes") : freeAfter >= 0 ? "tight" : "no";
    return { tone, amount, free, freeAfter, daysLeft, perDayAfter: round(Math.max(0, freeAfter) / daysLeft), envelope: { label: allocation.label, before, after, ...(status.scope === "week" && status.weekIndex ? { week: status.weekIndex } : {}) }, ...(goal ? { goal } : {}) };
  }
  const freeAfter = round(free - amount);
  const perDayAfter = round(Math.max(0, freeAfter) / daysLeft);
  // Fără plicuri de zi cu zi, banii liberi sunt chiar banii de mâncare: sub ~80% din ritmul obișnuit pe zi e strâmt.
  const floor = Math.max(30, round(forecast.paceDaily * 0.8));
  const tight = math.reservedInEnvelopes < 1 && daysLeft > 1 && perDayAfter < floor;
  const tone: AffordTone = freeAfter < 0 ? "no" : tight ? "tight" : "yes";
  return { tone, amount, free, freeAfter, daysLeft, perDayAfter, ...(goal ? { goal } : {}) };
}
