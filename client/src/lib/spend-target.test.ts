import { describe, expect, it } from "vitest";
import { createEmptyAppData, learnMerchantRule, spendTargetFromText } from "./finance-data";

const casa = () => {
  const data = createEmptyAppData();
  data.settings.salaryPlan.allocations = [
    { id: "food", label: "Mâncare", category: "Alimente", amount: 600, weeklyPace: true },
    { id: "rent", label: "Chirie", category: "Casă & facturi", amount: 1800, weeklyPace: false },
    { id: "gas", label: "Gaz", category: "Casă & facturi", amount: 200, weeklyPace: false },
    { id: "play", label: "Timp liber", category: "Timp liber", amount: 200, weeklyPace: true },
  ];
  return data;
};

describe("magazinul necunoscut nu mănâncă plicul de mâncare", () => {
  it("Lidl și Decathlon își găsesc categoria, florăria rămâne pe dinafară", () => {
    const data = casa();
    expect(spendTargetFromText(data, "Lidl").kind).not.toBe("outside");
    expect(spendTargetFromText(data, "Decathlon")).toMatchObject({ kind: "category", category: "Timp liber" });
    expect(spendTargetFromText(data, "Florăria Iris")).toEqual({ kind: "outside" });
    expect(spendTargetFromText(data, "Li")).toEqual({ kind: "keep" });
  });

  it("regula învățată Engie → Gaz bate plicul de chirie", () => {
    const data = learnMerchantRule(casa(), { match: "Engie", category: "Casă & facturi", allocationId: "gas" });
    expect(spendTargetFromText(data, "Engie factura")).toMatchObject({ kind: "envelope", allocationId: "gas" });
  });
});
