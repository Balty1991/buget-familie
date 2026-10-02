import { describe, expect, it } from "vitest";
import { moneyFuture } from "./money-future";

const goal = (id: string, current: number, target: number, dueDate?: string) => ({ id, name: id, current, target, due: "", tone: "forest" as const, ...(dueDate ? { dueDate } : {}) });

describe("viitorul banilor", () => {
  it("umple obiectivele pe rând, întâi cele cu termen", () => {
    const future = moneyFuture([goal("masina", 0, 1000), goal("vacanta", 500, 1500, "2027-06-01")], 500, 6);
    expect(future.goals.map((item) => [item.id, item.month])).toEqual([["vacanta", 2], ["masina", 4]]);
    expect(future.doneMonth).toBe(4);
    expect(future.points).toEqual([500, 1000, 1500, 2000, 2500, 3000, 3500]);
  });

  it("ce e deja atins are luna 0; fără bani lunar, nu se mai atinge nimic", () => {
    const future = moneyFuture([goal("gata", 200, 200), goal("nou", 0, 100)], 0, 3);
    expect(future.goals.map((item) => item.month)).toEqual([0, undefined]);
    expect(future.doneMonth).toBeUndefined();
  });
});
