/**
 * Runda a treia de audit (27.09.2026): scenariile care au dat cifre greșite
 * unui părinte care folosea aplicația o lună. Fiecare test reproduce pașii din raport.
 */
import { describe, expect, it } from "vitest";
import {
  adoptOutsideExpenses,
  allocationFromText,
  allocationStatus,
  guessAllocationFromText,
  learnMerchantRule,
  createEmptyAppData,
  type AppData,
  type Transaction,
} from "./finance-data";
import { todayBrief } from "./household-insights";

const me = "member-me";

const house = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me, openingBalance: 0 }];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-10";
  data.settings.salaryPlan.sourceIds = ["card"];
  return data;
};

const tx = (extra: Partial<Transaction> & Pick<Transaction, "id" | "amount">): Transaction => ({
  title: "Mișcare", kind: "expense", category: "Altele", source: "Card debit", sourceId: "card",
  person: "Eu", memberId: me, date: "2026-09-28", ...extra,
});

describe("corecția de sold nu e cheltuială din plic", () => {
  const withBuffer = () => {
    const data = house();
    data.transactions.push(tx({ id: "in", kind: "income", category: "Venit", amount: 8000, date: "2026-09-14" }));
    data.settings.salaryPlan.allocations = [
      { id: "env-buffer", label: "Neprevăzute", category: "Altele", amount: 300, sourceId: "card", memberId: me },
    ];
    // Ce creează „Cât ai de fapt pe card?” → „Salvez diferența”.
    data.transactions.push(tx({ id: "balance-check-1", title: "Corecție de sold", amount: 4300, allocationId: "outside", adjustment: true }));
    return data;
  };

  it("nu e adoptată în plicul cu aceeași categorie", () => {
    const next = adoptOutsideExpenses(withBuffer());
    expect(next.transactions.find((item) => item.id === "balance-check-1")?.allocationId).toBe("outside");
  });

  it("nu consumă din plic nici dacă datele vechi o legaseră de el", () => {
    const data = withBuffer();
    data.transactions = data.transactions.map((item) => item.id === "balance-check-1" ? { ...item, allocationId: "env-buffer" } : item);
    expect(allocationStatus(data, data.settings.salaryPlan.allocations[0])).toMatchObject({ spent: 0, remaining: 300 });
  });
});

describe("facturile ajung în plicul lor, nu în Chirie", () => {
  const bills = () => {
    const data = house();
    data.settings.salaryPlan.allocations = [
      { id: "rent", label: "Chirie", category: "Casă & facturi", amount: 2000, sourceId: "card", memberId: me },
      { id: "gas", label: "Gaz", category: "Casă & facturi", amount: 200, sourceId: "card", memberId: me },
      { id: "water", label: "Apă", category: "Casă & facturi", amount: 120, sourceId: "card", memberId: me },
      { id: "power", label: "Lumină", category: "Casă & facturi", amount: 250, sourceId: "card", memberId: me },
    ];
    return data;
  };

  it("Engie → Gaz, Apa Nova → Apă, Enel → Lumină", () => {
    const data = bills();
    expect(allocationFromText(data, "Engie", { memberId: me, sourceId: "card" })?.id).toBe("gas");
    expect(allocationFromText(data, "Apa Nova", { memberId: me, sourceId: "card" })?.id).toBe("water");
    expect(allocationFromText(data, "Enel", { memberId: me, sourceId: "card" })?.id).toBe("power");
  });

  it("corectura de mână se învață pentru data viitoare", () => {
    const data = learnMerchantRule(bills(), { match: "Digi", category: "Casă & facturi", allocationId: "power" });
    expect(guessAllocationFromText(data, "digi")).toBe("power");
    // A doua corectură pentru același text o înlocuiește pe prima, nu se adună.
    const again = learnMerchantRule(data, { match: "DIGI", category: "Casă & facturi", allocationId: "gas" });
    expect(again.settings.merchantRules).toHaveLength(1);
    expect(guessAllocationFromText(again, "Digi")).toBe("gas");
  });
});

describe("o factură plătită din plicul ei nu mănâncă cifra zilei", () => {
  it("365 rămâne 365 după Enel și grădiniță", () => {
    const data = house();
    const plan = data.settings.salaryPlan;
    plan.periodStart = "2026-10-10";
    plan.nextPayday = "2026-11-10";
    data.transactions.push(tx({ id: "salary", kind: "income", category: "Venit", amount: 5200, date: "2026-10-10" }));
    plan.allocations = [
      { id: "food", label: "Mâncare", category: "Alimente", amount: 2400, sourceId: "card", memberId: me, weeklyPace: true },
      { id: "power", label: "Lumină", category: "Casă & facturi", amount: 250, sourceId: "card", memberId: me, weeklyPace: false },
      { id: "kinder", label: "Grădiniță", category: "Educație", amount: 750, sourceId: "card", memberId: me, weeklyPace: false },
    ];
    plan.needs = [
      { id: "n-power", label: "Lumină", category: "Casă & facturi", cadence: "monthly", min: 250, max: 250, priority: "fixed", allocationId: "power" },
      { id: "n-kinder", label: "Grădiniță", category: "Educație", cadence: "monthly", min: 750, max: 750, priority: "fixed", allocationId: "kinder" },
    ] as AppData["settings"]["salaryPlan"]["needs"];
    const before = todayBrief(data, "2026-10-11").spendable;
    expect(before).toBeGreaterThan(0);
    const paid = structuredClone(data);
    paid.transactions.push(
      tx({ id: "enel", title: "Enel", amount: 230, category: "Casă & facturi", allocationId: "power", date: "2026-10-11" }),
      tx({ id: "gradi", title: "Grădinița", amount: 750, category: "Educație", allocationId: "kinder", date: "2026-10-11" }),
    );
    expect(todayBrief(paid, "2026-10-11").spendable).toBeCloseTo(before, 2);
  });
});
