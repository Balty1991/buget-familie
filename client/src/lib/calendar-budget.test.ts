import { describe, expect, it } from "vitest";
import { calendarBudget } from "./calendar-budget";

describe("tranșele pe săptămâni", () => {
  it("cu sumă pe săptămână: fiecare săptămână întreagă primește exact suma, fără virgulă", () => {
    const calendar = calendarBudget(2743, "2026-10-10", "2026-11-10", 600)!;
    // 10 oct. e sâmbătă: prima săptămână are 2 zile (sâm–dum) și primește partea lor; apoi luni–duminică câte 600.
    expect(calendar.weeks.map((week) => week.amount)).toEqual([171, 600, 600, 600, 600, 172]);
    expect(calendar.weeks.map((week) => week.start)).toEqual(["2026-10-10", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(calendar.weeklyAmount).toBe(600);
  });
  it("dacă plicul are mai puțin, ultimele săptămâni primesc ce a rămas", () => {
    const calendar = calendarBudget(1500, "2026-10-10", "2026-11-10", 600)!;
    expect(calendar.weeks.map((week) => week.amount)).toEqual([171, 600, 600, 129, 0, 0]);
  });
});
