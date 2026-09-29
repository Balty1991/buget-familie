import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { applyPlanRows, parsePlanTable } from "./plan-import";

describe("import de plicuri din tabel", () => {
  it("citește virgulă, tab și punct și virgulă", () => {
    expect(parsePlanTable("Mâncare, 600\nChirie\t1.800\nGaz; 150,5\n\ndoar nume\n")).toEqual([
      { label: "Mâncare", amount: 600 },
      { label: "Chirie", amount: 1800 },
      { label: "Gaz", amount: 150.5 },
    ]);
  });

  it("nu schimbă un plic care există deja", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan.allocations = [{ id: "food", label: "Mâncare", amount: 400, weeklyPace: true }];
    const result = applyPlanRows(data, parsePlanTable("mâncare, 900\nChirie, 1800"));
    expect(result.added).toBe(1);
    expect(result.data.settings.salaryPlan.allocations.find((item) => item.id === "food")).toMatchObject({ amount: 400, weeklyPace: true });
    expect(result.data.settings.salaryPlan.allocations.find((item) => item.label === "Chirie")).toMatchObject({ amount: 1800, weeklyPace: false });
  });
});
