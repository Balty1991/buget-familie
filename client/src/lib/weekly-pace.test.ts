/**
 * Ritmul săptămânal, pe scenariul real al unei familii: perioada începe luni 14 septembrie,
 * salariul vine pe 9 octombrie, iar planul se face joi 17 — cu trei zile deja consumate din
 * prima tranșă. Cifrele de aici sunt cele afișate în Plan, deci se verifică o singură dată.
 */
import { describe, expect, it } from "vitest";
import { calendarBudget, periodDays, recommendedWeeklyPace, remainingPace, startedWeekShare, totalFromWeeklyPace, weeklyPaceFromTotal } from "./calendar-budget";

const START = "2026-09-14";
const END = "2026-10-09";
const TODAY = "2026-09-17";

describe("ritmul pe săptămână întreagă", () => {
  it("numără zilele perioadei inclusiv capetele", () => {
    expect(periodDays(START, END)).toBe(26);
    expect(periodDays(TODAY, END)).toBe(23);
    expect(periodDays(END, START)).toBe(0);
  });

  it("traduce totalul în ritm săptămânal și înapoi", () => {
    expect(weeklyPaceFromTotal(1800, START, END)).toBeCloseTo(484.62, 1);
    // 500 pe săptămână întreagă înseamnă 26 de zile × (500 / 7).
    expect(totalFromWeeklyPace(500, START, END)).toBeCloseTo(1857.14, 1);
    // Dus-întors: ce intră iese.
    expect(weeklyPaceFromTotal(totalFromWeeklyPace(500, START, END), START, END)).toBeCloseTo(500, 2);
  });

  it("socotește doar zilele rămase când perioada a început", () => {
    // Joi 17: 500 pe săptămână întreagă cer bani pentru 23 de zile, nu pentru 26.
    expect(totalFromWeeklyPace(500, START, END, TODAY)).toBeCloseTo(1642.86, 1);
    expect(weeklyPaceFromTotal(1200, START, END, TODAY)).toBeCloseTo(365.22, 1);
    // Înainte de începerea perioadei nu se taie nimic.
    expect(totalFromWeeklyPace(500, START, END, "2026-09-10")).toBeCloseTo(1857.14, 1);
  });

  it("recomandă ritmul doar pe zilele rămase, nu pe cele consumate", () => {
    // 1.800 pe 23 de zile rămase, nu pe 26: 548, nu 485.
    expect(recommendedWeeklyPace(1800, START, END, TODAY)).toBeCloseTo(547.83, 1);
    // Înainte de începerea perioadei se numără perioada întreagă.
    expect(recommendedWeeklyPace(1800, START, END, "2026-09-10")).toBeCloseTo(484.62, 1);
  });

  it("împarte banii rămași egal pe zilele rămase", () => {
    const pace = remainingPace(1200, END, TODAY)!;
    expect(pace.daysLeft).toBe(23);
    expect(pace.perDay).toBeCloseTo(52.17, 1);
    expect(pace.weekly).toBeCloseTo(365.22, 1);
    expect(remainingPace(0, END, TODAY)).toBeUndefined();
    expect(remainingPace(1200, END, "2026-10-10")).toBeUndefined();
  });

  it("dă tranșei începute partea zilelor rămase, la ritmul întregii perioade", () => {
    const cycle = calendarBudget(1200, START, END)!;
    const first = cycle.weeks[0];
    expect(first).toMatchObject({ index: 1, start: "2026-09-14", end: "2026-09-20", days: 7 });
    const share = startedWeekShare(first, TODAY, remainingPace(1200, END, TODAY))!;
    expect(share.daysLeft).toBe(4);
    // 52,17 pe zi × 4 zile = 209, nu cei 323 ai unei săptămâni întregi.
    expect(share.fair).toBeCloseTo(208.7, 1);
    expect(share.perDay).toBeCloseTo(52.17, 1);
    // Prisosul pleacă spre săptămânile următoare: 323 − 209.
    expect(share.surplus).toBeCloseTo(114.38, 1);
  });

  it("după mutarea prisosului, fiecare săptămână întreagă primește ritmul recomandat", () => {
    const cycle = calendarBudget(1200, START, END)!;
    const share = startedWeekShare(cycle.weeks[0], TODAY, remainingPace(1200, END, TODAY))!;
    const targets = cycle.weeks.slice(1);
    const days = targets.reduce((sum, week) => sum + week.days, 0);
    const after = targets.map((week) => week.amount + share.surplus * week.days / days);
    // S2 și S3 au 7 zile: exact ritmul din recomandare. S4 are 5, deci partea ei.
    expect(after[0]).toBeCloseTo(365.22, 0);
    expect(after[1]).toBeCloseTo(365.22, 0);
    expect(after[2]).toBeCloseTo(260.87, 0);
    // Nimic nu se pierde pe drum.
    expect(share.fair + after.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1200, 1);
  });

  it("nu dă parte pentru o tranșă care nu conține ziua de azi", () => {
    const cycle = calendarBudget(1800, START, END)!;
    expect(startedWeekShare(cycle.weeks[1], TODAY, remainingPace(1800, END, TODAY))).toBeUndefined();
  });

  it("într-o tranșă abia începută nu rămâne surplus", () => {
    const cycle = calendarBudget(1800, START, END)!;
    const share = startedWeekShare(cycle.weeks[0], START, remainingPace(1800, END, START))!;
    expect(share.daysLeft).toBe(7);
    expect(share.surplus).toBe(0);
  });
});
