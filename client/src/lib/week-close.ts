/**
 * Închiderea săptămânii, duminica (sau luni dimineață): cât a rămas în fiecare plic pe săptămâni
 * și unde merge, plus o privire la sold. Diferențele se prind în aceeași săptămână, nu după o lună.
 *
 * Restul trece în săptămâna următoare printr-o mutare între săptămâni, aceeași ca din Plan;
 * depășirea se acoperă tot așa, din săptămâna următoare. Nimic nu se schimbă fără apăsare.
 */
import { addIsoDays, allocationWeeksStatus, isWeeklyPaced, transferBetweenWeeks, type AppData } from "./finance-data";
import { t } from "./i18n";

export type WeekCloseEnvelope = {
  allocationId: string;
  label: string;
  weekIndex: number;
  /** Săptămâna care primește restul sau acoperă depășirea; lipsește la ultima săptămână dinaintea salariului. */
  nextIndex?: number;
  budget: number;
  spent: number;
  remaining: number;
  nextRemaining: number;
};

export type WeekClose = { start: string; end: string; budget: number; spent: number; envelopes: WeekCloseEnvelope[] };

/**
 * Ziua după care se închide: luni, duminica de ieri; duminică doar seara. Dimineața, restul
 * săptămânii e chiar partea zilei de azi: mutat în săptămâna viitoare, Astăzi ar arăta 0.
 */
const closingSunday = (asOf: string, evening: boolean) => {
  const weekday = new Date(`${asOf}T12:00:00`).getDay();
  return weekday === 0 && evening ? asOf : weekday === 1 ? addIsoDays(asOf, -1) : undefined;
};

export function weekToClose(data: AppData, asOf: string, evening = false): WeekClose | undefined {
  const sunday = closingSunday(asOf, evening);
  const plan = data.settings.salaryPlan;
  if (!sunday || !plan.periodStart || sunday < plan.periodStart) return undefined;
  const envelopes: WeekCloseEnvelope[] = [];
  let start: string = sunday;
  for (const allocation of plan.allocations) {
    if (!isWeeklyPaced(allocation, plan)) continue;
    const weeks: ReturnType<typeof allocationWeeksStatus> = allocationWeeksStatus(data, allocation);
    const week: (typeof weeks)[number] | undefined = weeks.find((item) => item.start <= sunday && sunday <= item.end);
    // Săptămâna care se termină în ziua salariului nu se „închide”: o închide ziua salariului.
    if (!week || week.end !== sunday) continue;
    const next = weeks.find((item) => item.index === week.index + 1);
    if (week.start < start) start = week.start;
    envelopes.push({
      allocationId: allocation.id,
      label: allocation.label,
      weekIndex: week.index,
      ...(next ? { nextIndex: next.index } : {}),
      budget: week.budget,
      spent: week.spent,
      remaining: week.remaining,
      nextRemaining: next ? next.remaining : 0,
    });
  }
  if (!envelopes.length) return undefined;
  const round = (value: number) => Math.round(value * 100) / 100;
  return { start, end: sunday, budget: round(envelopes.reduce((sum, item) => sum + item.budget, 0)), spent: round(envelopes.reduce((sum, item) => sum + item.spent, 0)), envelopes };
}

export type WeekCloseChoice = "carry" | "keep";

/**
 * „carry”: restul trece în săptămâna următoare; depășirea se acoperă din ea, cât are.
 * „keep”: rămâne cum e (restul stă în plic până la salariu, depășirea rămâne a săptămânii închise).
 */
export function applyWeekClose(data: AppData, close: WeekClose, choices: Record<string, WeekCloseChoice>): AppData {
  let next = data;
  for (const item of close.envelopes) {
    if ((choices[item.allocationId] ?? "carry") !== "carry" || item.nextIndex == null) continue;
    const moved = item.remaining > 0.009
      ? transferBetweenWeeks(next, { allocationId: item.allocationId, fromWeekIndex: item.weekIndex, toWeekIndex: item.nextIndex, amount: item.remaining, note: t("Închiderea săptămânii: restul trece mai departe") })
      : item.remaining < -0.009 && item.nextRemaining > 0
        ? transferBetweenWeeks(next, { allocationId: item.allocationId, fromWeekIndex: item.nextIndex, toWeekIndex: item.weekIndex, amount: Math.min(-item.remaining, item.nextRemaining), note: t("Închiderea săptămânii: depășirea se acoperă din săptămâna următoare") })
        : undefined;
    if (moved) next = moved;
  }
  return next;
}

const KEY = "buget-familie:week-closed";
export const readWeekClosed = () => { try { return window.localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const markWeekClosed = (sunday: string) => { try { window.localStorage.setItem(KEY, sunday); } catch { /* doar pe sesiunea asta */ } };

/** Cu reportul automat pornit, săptămânile se leagă singure: rămâne doar privirea la sold, fără întrebare. */
export const weekCloseDue = (data: AppData, asOf: string, evening = false, closed = readWeekClosed()) => {
  if (data.settings.salaryPlan.weekCarryOver) return false;
  const close = weekToClose(data, asOf, evening);
  return Boolean(close && closed !== close.end);
};
