/**
 * Simulatorul de investiții și pensie. Dobândă compusă lună de lună, cu comisionul anual scăzut
 * din randament și cu depunerea care poate crește în fiecare an. Totul se poate arăta „în bani
 * de azi” (împărțit la inflație), pentru că 500.000 de lei peste 30 de ani nu cumpără cât azi.
 * Pentru pensie: cât capital trebuie la vârsta de pensie ca să completeze pensia de stat până la
 * venitul dorit, cât de pus deoparte lunar până atunci și până la ce vârstă ajung banii.
 * E o simulare educativă, nu o recomandare de investiții.
 */

export type ScenarioId = "prudent" | "medium" | "optimist";
/** Randamente anuale nominale, orientative: depozite/titluri de stat, mixt, acțiuni pe termen lung. */
export const RETURNS: Record<ScenarioId, number> = { prudent: 4, medium: 6.5, optimist: 9 };

export type GrowthInput = {
  /** Suma de la care pornești. */
  start: number;
  monthly: number;
  years: number;
  /** Randament anual, procent. */
  annualReturn: number;
  /** Comision anual, procent (se scade din randament). */
  fee?: number;
  /** Cu cât crește depunerea lunară în fiecare an, procent. */
  raise?: number;
  /** Inflația anuală, procent (pentru „în bani de azi”). */
  inflation?: number;
};

export type GrowthPoint = { year: number; contributed: number; value: number; real: number };

const round = (value: number) => Math.round(value);
const monthlyRate = (annual: number) => Math.pow(1 + Math.max(-99, annual) / 100, 1 / 12) - 1;

/** Valoarea la sfârșitul fiecărui an (primul punct e azi). */
export function growth(input: GrowthInput): GrowthPoint[] {
  const rate = monthlyRate(input.annualReturn - (input.fee || 0));
  const inflation = (input.inflation || 0) / 100;
  let value = Math.max(0, input.start);
  let contributed = value;
  let monthly = Math.max(0, input.monthly);
  const points: GrowthPoint[] = [{ year: 0, contributed: round(contributed), value: round(value), real: round(value) }];
  const years = Math.max(0, Math.min(60, Math.round(input.years)));
  for (let year = 1; year <= years; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      value = value * (1 + rate) + monthly;
      contributed += monthly;
    }
    points.push({ year, contributed: round(contributed), value: round(value), real: round(value / Math.pow(1 + inflation, year)) });
    monthly *= 1 + (input.raise || 0) / 100;
  }
  return points;
}

/** Depunerea lunară (fixă) care duce la `target` în `years` ani. */
export function monthlyFor(target: number, input: Omit<GrowthInput, "monthly" | "raise">): number {
  const end = (monthly: number) => growth({ ...input, monthly, raise: 0 }).slice(-1)[0].value;
  if (end(0) >= target) return 0;
  let low = 0;
  let high = Math.max(100, target);
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2;
    if (end(mid) >= target) high = mid; else low = mid;
  }
  return Math.ceil(high);
}

export type RetirementInput = {
  age: number;
  retireAge: number;
  /** Până la ce vârstă să ajungă banii. */
  untilAge: number;
  /** Venitul dorit pe lună la pensie, în bani de azi. */
  desired: number;
  /** Pensia de stat estimată, în bani de azi. */
  pension: number;
  /** Ce aveți deja pus deoparte pentru pensie. */
  saved: number;
  /** Cât puneți deoparte lunar (bani de azi; crește cu inflația). */
  monthly: number;
  annualReturn: number;
  fee: number;
  inflation: number;
};

export type Retirement = {
  /** Cât lipsește pe lună (bani de azi). */
  gap: number;
  /** Capitalul necesar la pensie, în bani de azi și în lei de atunci. */
  needed: number;
  neededNominal: number;
  /** Cât se strânge cu depunerea aleasă, bani de azi. */
  projected: number;
  /** Depunerea lunară (bani de azi) care acoperă golul. */
  monthlyNeeded: number;
  /** Vârsta până la care ajung banii cu depunerea aleasă; `untilAge` sau mai mult = ajung. */
  lastsUntil: number;
  /** Capitalul pe ani de vârstă (bani de azi), pentru grafic. */
  path: Array<{ age: number; value: number }>;
};

/** Totul în bani de azi: randamentul real = (1 + randament − comision) / (1 + inflație) − 1. */
export function retirement(input: RetirementInput): Retirement {
  const real = ((1 + (input.annualReturn - input.fee) / 100) / (1 + input.inflation / 100) - 1) * 100;
  const rate = monthlyRate(real);
  const yearsToGo = Math.max(0, input.retireAge - input.age);
  const yearsPaid = Math.max(1, input.untilAge - input.retireAge);
  const gap = Math.max(0, input.desired - input.pension);
  const n = yearsPaid * 12;
  const needed = rate > 0 ? gap * (1 - Math.pow(1 + rate, -n)) / rate : gap * n;
  const accumulate = (monthly: number) => growth({ start: input.saved, monthly, years: yearsToGo, annualReturn: real }).slice(-1)[0].value;
  const projected = accumulate(input.monthly);
  let monthlyNeeded = 0;
  if (accumulate(0) < needed) {
    let low = 0; let high = Math.max(100, needed);
    for (let step = 0; step < 60; step += 1) { const mid = (low + high) / 2; if (accumulate(mid) >= needed) high = mid; else low = mid; }
    monthlyNeeded = Math.ceil(high);
  }
  // Drumul banilor: strângeți până la pensie, apoi retrageți golul lună de lună.
  const path: Retirement["path"] = [];
  let value = Math.max(0, input.saved);
  let lastsUntil = input.retireAge;
  for (let age = input.age; age <= 100; age += 1) {
    path.push({ age, value: round(Math.max(0, value)) });
    for (let month = 0; month < 12; month += 1) {
      if (age < input.retireAge) value = value * (1 + rate) + input.monthly;
      else if (value > 0) { value = value * (1 + rate) - gap; if (value > 0 || gap === 0) lastsUntil = age + (month + 1) / 12; }
    }
    if (age >= input.retireAge && value <= 0 && gap > 0) { path.push({ age: age + 1, value: 0 }); break; }
    if (age >= input.retireAge && gap === 0) lastsUntil = 100;
  }
  if (value > 0) lastsUntil = Math.max(lastsUntil, 100);
  return {
    gap: round(gap),
    needed: round(needed),
    neededNominal: round(needed * Math.pow(1 + input.inflation / 100, yearsToGo)),
    projected: round(projected),
    monthlyNeeded,
    lastsUntil: Math.floor(lastsUntil),
    path,
  };
}
