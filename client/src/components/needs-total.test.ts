import { describe, expect, it } from "vitest";
import { monthlyNeedsTotal } from "./NeedsQuickStart";

describe("pasul 2 al pornirii", () => {
  it("adună pe lună: săptămânalele × 52/12, doar cele bifate", () => {
    expect(monthlyNeedsTotal([
      { on: true, amount: "900", cadence: "weekly" },
      { on: true, amount: "1.400", cadence: "monthly" },
      { on: false, amount: "500", cadence: "monthly" },
    ])).toBe(5300);
  });
});
