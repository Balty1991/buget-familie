import { describe, expect, it } from "vitest";
import { applySalaryAllocationRules, createEmptyAppData, type AppData } from "@/lib/finance-data";
import { activeAllocationConflicts, mergeFamilyData, syncBaseOf } from "@/lib/family-crypto";

const shared = (): AppData => {
  const data = createEmptyAppData();
  data.settings.members.push({ id: "member-ioana", name: "Ioana", color: "#123456" });
  data.settings.paymentSources.push({ id: "card-ioana", name: "Card Ioana", kind: "card", memberId: "member-ioana", openingBalance: 0 });
  data.settings.salaryPlan = { ...data.settings.salaryPlan,
    allocations: [{ id: "food", label: "Mâncare", amount: 600, alertThreshold: 80, updatedAt: "2026-09-01T10:00:00.000Z" }],
    salaryAllocationRules: [
      { id: "r-ion", label: "Mâncare din salariul lui Ion", allocationId: "food", mode: "fixed", value: 2000, active: true },
    ] };
  data.transactions = [
    { id: "inc-ion", title: "Salariu Ion", amount: 5000, kind: "income", category: "Venit", source: "Card", sourceId: "source-debit", person: "Ion", memberId: "member-me", date: "2026-09-25" },
    { id: "inc-ioana", title: "Salariu Ioana", amount: 4000, kind: "income", category: "Venit", source: "Card Ioana", sourceId: "card-ioana", person: "Ioana", memberId: "member-ioana", date: "2026-09-25" },
  ];
  return data;
};

describe("R3: două salarii repartizate în același plic, pe telefoane diferite, înainte de sync", () => {
  it("plicul primește ambele sume (600 + 2000 + 1500), fără conflict cu variante greșite", () => {
    const base = syncBaseOf(shared());
    const a = applySalaryAllocationRules(shared(), "inc-ion").data; // Ion: +2000 => 2600
    const bStart = shared();
    bStart.settings.salaryPlan.salaryAllocationRules = [{ id: "r-ioana", label: "Mâncare din salariul Ioanei", allocationId: "food", mode: "fixed", value: 1500, active: true }];
    const b = applySalaryAllocationRules(bStart, "inc-ioana").data; // Ioana: +1500 => 2100
    const merged = mergeFamilyData(a, b, base);
    const conflict = activeAllocationConflicts(merged)[0];
    expect({ amount: merged.settings.salaryPlan.allocations[0].amount, options: conflict ? [conflict.localAmount, conflict.remoteAmount] : [] })
      .toEqual({ amount: 4100, options: [] }); // primit: { amount: 2600, options: [2600, 2100] } — nicio variantă nu e 4100
  });
});
