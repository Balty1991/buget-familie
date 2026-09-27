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

describe("sync: ce notezi cât se decriptează pachetul partenerului nu se pierde", () => {
  it("farmacia notată în timpul decriptării rămâne lângă kaufland și lidl", async () => {
    const { mergeFamilyData, syncBaseOf } = await import("./family-crypto");
    const { keepConcurrentEdits } = await import("./sync-engine");
    const shared = createEmptyAppData();
    const snapshot: AppData = { ...shared, transactions: [tx({ id: "lidl", amount: 40 })] };
    const partner: AppData = { ...shared, transactions: [tx({ id: "kaufland", amount: 111 })] };
    const merged = mergeFamilyData(snapshot, partner, syncBaseOf(shared));
    const current: AppData = { ...snapshot, transactions: [...snapshot.transactions, tx({ id: "farmacie", amount: 25 })] };
    const shown = keepConcurrentEdits(current, snapshot, merged, (now, unit, snap) => mergeFamilyData(now, unit, syncBaseOf(snap)));
    expect(shown.transactions.map((item) => item.id).sort()).toEqual(["farmacie", "kaufland", "lidl"]);
    expect(keepConcurrentEdits(snapshot, snapshot, merged, () => { throw new Error("nu trebuie unit"); })).toBe(merged);
  });
});

describe("ziua salariului nu alunecă la închiderea ciclului", () => {
  it("31 rămâne 31 după februarie, iar o închidere întârziată nu mută salariul de pe 10", async () => {
    const { cycleClose } = await import("./cycle-close");
    const feb = house();
    feb.settings.salaryPlan.periodStart = "2027-01-31";
    feb.settings.salaryPlan.nextPayday = "2027-02-28";
    feb.settings.salaryPlan.incomes = [{ id: "i", memberId: me, label: "Salariu", amount: 5000, day: 31 }];
    expect(cycleClose(feb, "2027-03-01")?.nextPayday).toBe("2027-03-31");
    const late = house();
    late.settings.salaryPlan.periodStart = "2026-09-10";
    late.settings.salaryPlan.nextPayday = "2026-10-10";
    late.settings.salaryPlan.incomes = [{ id: "i", memberId: me, label: "Salariu", amount: 5000, day: 10 }];
    expect(cycleClose(late, "2026-10-30")?.nextPayday).toBe("2026-11-10");
  });
});

describe("prima zi: cifra zilei nu promite banii chiriei și ai ratei", () => {
  it("4.100 pe card, chirie 1.800 pe 1 și rată 1.100 pe 5, salariul pe 10", () => {
    const data = house();
    data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me, openingBalance: 4100 }];
    const plan = data.settings.salaryPlan;
    plan.periodStart = "2026-09-28";
    plan.nextPayday = "2026-10-10";
    plan.needs = [
      { id: "rent", label: "Chirie", category: "Casă & facturi", cadence: "monthly", min: 1800, max: 1800, priority: "fixed", dueDay: 1 },
      { id: "loan", label: "Rată bancă", category: "Credite", cadence: "monthly", min: 1100, max: 1100, priority: "fixed", dueDay: 5 },
      { id: "food", label: "Mâncare", category: "Alimente", cadence: "weekly", min: 500, max: 500, priority: "flex" },
    ] as AppData["settings"]["salaryPlan"]["needs"];
    const brief = todayBrief(data, "2026-09-28");
    // 4.100 − 2.900 = 1.200 pentru 12 zile, nu 4.100 / 12.
    expect(brief.spendable).toBeLessThanOrEqual(1200 / 12 + 0.01);
    expect(brief.spendable).toBeGreaterThan(50);
    expect(brief.reason).toContain("Chirie");
  });
});

describe("două salarii: salariul principal deschide ciclul nou", () => {
  it("pe 10 nu mai socotește „deja acoperiți” banii Ioanei din 25, iar ciclul trece pe 10.10–10.11", async () => {
    const { applyIncomeSplit, proposeIncomeSplit } = await import("./monthly-needs");
    const { planAllocationMath } = await import("./finance-data");
    const data = house();
    data.settings.members = [{ id: me, name: "Eu", color: "#000" }, { id: "ioana", name: "Ioana", color: "#111" }] as AppData["settings"]["members"];
    const plan = data.settings.salaryPlan;
    plan.periodStart = "2026-09-10";
    plan.nextPayday = "2026-10-10";
    plan.paydayFlexDays = 3;
    plan.incomes = [
      { id: "mine", memberId: me, label: "Salariul meu", amount: 5200, day: 10 },
      { id: "hers", memberId: "ioana", label: "Salariul Ioanei", amount: 4300, day: 25 },
    ];
    plan.needs = [
      { id: "rent", label: "Chirie", category: "Casă & facturi", cadence: "monthly", min: 2000, max: 2000, priority: "fixed", dueDay: 1 },
      { id: "loan", label: "Rată bancă", category: "Credite", cadence: "monthly", min: 1100, max: 1100, priority: "fixed", dueDay: 5 },
      { id: "food", label: "Mâncare", category: "Alimente", cadence: "weekly", min: 600, max: 600, priority: "flex" },
    ] as AppData["settings"]["salaryPlan"]["needs"];
    data.transactions.push(tx({ id: "s-ioana", kind: "income", category: "Venit", amount: 4300, memberId: "ioana", date: "2026-09-25" }));
    const afterIoana = applyIncomeSplit(data, "s-ioana").data;
    afterIoana.transactions.push(tx({ id: "s-me", kind: "income", category: "Venit", amount: 5200, date: "2026-10-10" }));
    const split = proposeIncomeSplit(afterIoana, "s-me");
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    expect(split.cycleStart).toBe("2026-10-10");
    expect(split.lines.every((line) => line.fundedBefore === 0)).toBe(true);
    const applied = applyIncomeSplit(afterIoana, "s-me").data;
    expect(applied.settings.salaryPlan.periodStart).toBe("2026-10-10");
    expect(applied.settings.salaryPlan.nextPayday).toBe("2026-11-10");
    expect(planAllocationMath(applied).unrepartized).toBeGreaterThan(-0.01);
  });
});
