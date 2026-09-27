import { describe, expect, it } from "vitest";
import { activeSalaryApplications, applySalaryAllocationRules, createEmptyAppData, revertSalaryAllocationApplication, type AppData } from "@/lib/finance-data";
import { mergeFamilyData, syncBaseOf } from "@/lib/family-crypto";

const shared = (): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan,
    allocations: [{ id: "food", label: "Mâncare", amount: 600, alertThreshold: 80, updatedAt: "2026-09-01T10:00:00.000Z" }],
    salaryAllocationRules: [{ id: "r", label: "Mâncare", allocationId: "food", mode: "fixed", value: 2000, active: true }] };
  data.transactions = [{ id: "inc", title: "Salariu", amount: 5000, kind: "income", category: "Venit", source: "Card", sourceId: "source-debit", person: "Eu", memberId: "member-me", date: "2026-09-25" }];
  return data;
};

describe("R2: același salariu repartizat pe ambele telefoane (unul offline)", () => {
  it("după unire rămâne o singură repartizare activă, iar anularea întoarce plicul la 600", () => {
    const base = syncBaseOf(shared());
    const a = applySalaryAllocationRules(shared(), "inc").data;
    const b = applySalaryAllocationRules(shared(), "inc").data;
    const merged = mergeFamilyData(a, b, base);
    expect(merged.settings.salaryPlan.allocations[0].amount).toBe(2600);
    const active = activeSalaryApplications(merged.settings.salaryPlan);
    const duplicate = active.length; // primit: 2 (verificat mai jos)
    const once = revertSalaryAllocationApplication(merged, active[0].id);
    const twice = active[1] ? revertSalaryAllocationApplication(once, active[1].id) : once;
    expect({ duplicate, amount: twice.settings.salaryPlan.allocations[0].amount }).toEqual({ duplicate: 1, amount: 600 }); // primit: { duplicate: 2, amount: 0 }
  });
});
