import { describe, expect, it } from "vitest";
import { calendarBudget } from "./calendar-budget";

describe("tranșele pe săptămâni", () => {
  it("cu sumă pe săptămână: fiecare săptămână întreagă primește exact suma, fără virgulă", () => {
    const calendar = calendarBudget(2743, "2026-10-10", "2026-11-10", 600)!;
    expect(calendar.weeks.map((week) => week.amount)).toEqual([600, 600, 600, 600, 343]);
    expect(calendar.weeklyAmount).toBe(600);
  });
  it("dacă plicul are mai puțin, ultimele săptămâni primesc ce a rămas", () => {
    const calendar = calendarBudget(1500, "2026-10-10", "2026-11-10", 600)!;
    expect(calendar.weeks.map((week) => week.amount)).toEqual([600, 600, 300, 0, 0]);
  });
});
