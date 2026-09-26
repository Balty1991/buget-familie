/**
 * Câmpurile simple ale planului (data salariului, perioada, marja, reportul) au marcaj propriu.
 * Fără el, un telefon offline care edita un plic ridica `salaryPlan.updatedAt` și, la unire,
 * anula data salariului schimbată între timp pe telefonul partenerului.
 */
import type { AppData, SalaryPlan } from "@/lib/finance-data";

export const PLAN_SCALAR_KEYS = ["periodStart", "nextPayday", "earliestPayday", "paydayFlexDays", "sourceIds", "totalLimit", "weeklyLimit", "joinedMidCycle", "horizonDays", "weekCarryOver", "cycleReportDone"] as const;
type ScalarKey = typeof PLAN_SCALAR_KEYS[number];

const same = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export const planScalarsDiffer = (left: SalaryPlan, right: SalaryPlan) => PLAN_SCALAR_KEYS.some((key) => !same(left[key], right[key]));

/** O editare făcută de om: dacă s-a schimbat un câmp simplu, planul primește marcajul de acum. */
export function stampPlanScalars(previous: AppData, next: AppData, now = new Date().toISOString()): AppData {
  const before = previous.settings.salaryPlan;
  const after = next.settings.salaryPlan;
  if (before === after || !planScalarsDiffer(before, after)) return next;
  return { ...next, settings: { ...next.settings, salaryPlan: { ...after, scalarsUpdatedAt: now } } };
}

const time = (value?: string) => Date.parse(value || "") || 0;

/**
 * La unire, câmpurile simple vin de pe telefonul care le-a schimbat ultimul, nu de pe cel care a editat ultimul plic.
 * Un plan fără marcaj n-a schimbat câmpurile simple de când există marcajul, deci pierde în fața unuia marcat;
 * doar când niciunul nu are marcaj se folosește `updatedAt`, ca înainte.
 */
export function mergePlanScalars(local: SalaryPlan, remote: SalaryPlan): Pick<SalaryPlan, ScalarKey | "scalarsUpdatedAt"> {
  const winner = local.scalarsUpdatedAt || remote.scalarsUpdatedAt
    ? (time(local.scalarsUpdatedAt) >= time(remote.scalarsUpdatedAt) ? local : remote)
    : (time(local.updatedAt) >= time(remote.updatedAt) ? local : remote);
  const picked = Object.fromEntries(PLAN_SCALAR_KEYS.map((key) => [key, winner[key]])) as Pick<SalaryPlan, ScalarKey>;
  const stamps = [local.scalarsUpdatedAt, remote.scalarsUpdatedAt].filter(Boolean).sort();
  return { ...picked, scalarsUpdatedAt: stamps[stamps.length - 1] };
}
