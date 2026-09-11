import { describe, expect, it } from "vitest";
import { planSpend, planIncome } from "./suggest-source";
import { createEmptyAppData, newId, type AppData } from "./finance-data";

const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m2", name: "Soția" });
  data.settings.paymentSources = [
    { id: "card", name: "Card debit", kind: "card", memberId: me.id, openingBalance: 1200 },
    { id: "cash", name: "Numerar", kind: "cash", memberId: me.id, openingBalance: 150 },
    { id: "tichete", name: "Tichete", kind: "meal", memberId: me.id, openingBalance: 300 },
    { id: "card2", name: "Card soție", kind: "card", memberId: "m2", openingBalance: 900 },
  ];
  const card = data.settings.paymentSources[0];
  data.settings.salaryPlan.periodStart = "2026-08-25";
  data.settings.salaryPlan.nextPayday = "2026-09-25";
  data.settings.salaryPlan.allocations = [
    { id: "env-food", label: "Alimente", category: "Alimente", amount: 1000, sourceId: card.id, weeklyPace: false },
    { id: "env-fun", label: "Timp liber", category: "Timp liber", amount: 200, sourceId: "cash", weeklyPace: false },
  ];
  return data;
};

describe("de unde iau banii", () => {
  it("propune sursa plicului potrivit, nu prima sursă din listă", () => {
    const plan = planSpend(house(), { amount: 40, category: "Timp liber", date: "2026-09-05" });
    expect(plan.envelope?.allocation.label).toBe("Timp liber");
    expect(plan.source?.source.name).toBe("Numerar");
  });

  it("arată toate sursele cu soldul lor, ca alegerea să fie o atingere", () => {
    const plan = planSpend(house(), { amount: 40, category: "Alimente", date: "2026-09-05" });
    expect(plan.sources.map((item) => item.source.name)).toEqual(["Card debit", "Numerar", "Tichete", "Card soție"]);
    expect(plan.sources.find((item) => item.source.name === "Tichete")?.balance).toBe(300);
  });

  it("spune care surse acoperă suma și care nu", () => {
    const plan = planSpend(house(), { amount: 500, category: "Alimente", date: "2026-09-05" });
    const byName = Object.fromEntries(plan.sources.map((item) => [item.source.name, item.covers]));
    expect(byName["Card debit"]).toBe(true);
    expect(byName["Numerar"]).toBe(false);
    expect(byName["Card soție"]).toBe(true);
  });

  it("scrie propunerea în cuvinte, cu sumele la vedere", () => {
    const plan = planSpend(house(), { amount: 40, category: "Alimente", date: "2026-09-05" });
    expect(plan.summary).toContain("Card debit");
    expect(plan.summary).toContain("1.200 RON");
    expect(plan.summary).toContain("Alimente");
  });

  it("avertizează când plicul nu acoperă suma", () => {
    const plan = planSpend(house(), { amount: 1100, category: "Alimente", date: "2026-09-05" });
    // cardul are 1.200, deci acoperă; plicul are 1.000, deci nu
    expect(plan.warnings.join(" ")).toMatch(/peste/);
    expect(plan.warnings.join(" ")).not.toMatch(/nu acoperă suma/);
  });

  it("avertizează când soldul sursei nu acoperă suma", () => {
    const data = house();
    data.settings.paymentSources.forEach((item) => { item.openingBalance = 10; });
    const plan = planSpend(data, { amount: 500, category: "Alimente", date: "2026-09-05" });
    expect(plan.warnings.join(" ")).toMatch(/nu acoperă/);
  });

  it("le spune pe amândouă când și sursa, și plicul sunt scurte", () => {
    const plan = planSpend(house(), { amount: 5000, category: "Alimente", date: "2026-09-05" });
    expect(plan.warnings).toHaveLength(2);
  });

  it("spune pe față când cheltuiala e în afara plicurilor", () => {
    const plan = planSpend(house(), { amount: 40, category: "Sănătate", date: "2026-09-05" });
    expect(plan.envelope).toBeUndefined();
    expect(plan.summary).toContain("în afara plicurilor");
  });

  it("scade din plic ce s-a cheltuit deja", () => {
    const data = house();
    const card = data.settings.paymentSources[0];
    data.transactions = [{
      id: newId("tx"), title: "Lidl", amount: 700, kind: "expense", category: "Alimente",
      source: card.name, sourceId: card.id, person: data.settings.members[0].name,
      memberId: data.settings.members[0].id, date: "2026-09-02",
    }];
    const plan = planSpend(data, { amount: 40, category: "Alimente", date: "2026-09-05" });
    expect(plan.envelope?.remaining).toBe(300);
  });

  it("un registru fără surse nu aruncă", () => {
    const bare = createEmptyAppData();
    bare.settings.paymentSources = [];
    expect(() => planSpend(bare, { amount: 40, category: "Alimente" })).not.toThrow();
  });

  it("pentru venit, sursa membrului vine prima", () => {
    const data = house();
    const list = planIncome(data, { memberId: "m2" });
    expect(list[0].source.name).toBe("Card soție");
    expect(list.every((item) => typeof item.balance === "number")).toBe(true);
  });
});

describe("plicurile oferite când categoria exactă lipsește", () => {
  it("propune un plic înrudit care are bani, în loc să iasă din plicuri", () => {
    // Dulciurile se iau din alimente: fără asta, cheltuiala pleca „în afara
    // plicurilor” deși bugetul de mâncare era plin.
    const plan = planSpend(house(), { amount: 50, category: "Dulciuri", date: "2026-09-05" });
    expect(plan.envelope?.allocation.label).toBe("Alimente");
    expect(plan.envelope?.match).toBe("related");
    expect(plan.summary).not.toContain("în afara plicurilor");
  });

  it("nu propune un plic doar fiindcă are bani în el", () => {
    // Sănătatea nu are plic și nu seamănă cu niciunul: mai bine în afara lor
    // decât să mănânce tăcut din alimente.
    const plan = planSpend(house(), { amount: 40, category: "Sănătate", date: "2026-09-05" });
    expect(plan.envelope).toBeUndefined();
    expect(plan.envelopes.every((item) => item.match === "other")).toBe(true);
  });

  it("arată totuși toate plicurile membrului, ca alegerea să fie o atingere", () => {
    const plan = planSpend(house(), { amount: 40, category: "Sănătate", date: "2026-09-05" });
    expect(plan.envelopes.map((item) => item.allocation.label).sort()).toEqual(["Alimente", "Timp liber"]);
  });

  it("pune plicul potrivit înaintea celor care doar au bani", () => {
    const plan = planSpend(house(), { amount: 40, category: "Alimente", date: "2026-09-05" });
    expect(plan.envelopes[0].allocation.label).toBe("Alimente");
    expect(plan.envelopes[0].match).toBe("exact");
  });

  it("nu oferă plicurile altui membru", () => {
    const data = house();
    data.settings.salaryPlan.allocations.push({ id: "env-sotie", label: "Taxi soție", category: "Transport", amount: 300, sourceId: "card2", memberId: "m2", weeklyPace: false });
    const plan = planSpend(data, { amount: 40, category: "Transport", date: "2026-09-05" });
    expect(plan.envelopes.map((item) => item.allocation.id)).not.toContain("env-sotie");
  });

  it("un plic înrudit gol nu devine propunere", () => {
    const data = house();
    data.settings.salaryPlan.allocations[0].amount = 0;
    const plan = planSpend(data, { amount: 50, category: "Dulciuri", date: "2026-09-05" });
    expect(plan.envelope).toBeUndefined();
    expect(plan.summary).toContain("în afara plicurilor");
  });
});

describe("plicul învățat din alegerile tale", () => {
  it("bate categoria, fiindcă tu ai ales altfel data trecută", () => {
    const plan = planSpend(house(), { amount: 40, category: "Alimente", date: "2026-09-05", preferAllocationId: "env-fun" });
    expect(plan.envelope?.allocation.id).toBe("env-fun");
    expect(plan.envelope?.match).toBe("habit");
  });

  it("nu îl propune dacă s-a golit între timp", () => {
    const data = house();
    data.settings.salaryPlan.allocations[1].amount = 0;
    const plan = planSpend(data, { amount: 40, category: "Alimente", date: "2026-09-05", preferAllocationId: "env-fun" });
    expect(plan.envelope?.allocation.id).toBe("env-food");
  });

  it("fără obicei, rămâne alegerea după categorie", () => {
    const plan = planSpend(house(), { amount: 40, category: "Alimente", date: "2026-09-05" });
    expect(plan.envelope?.allocation.id).toBe("env-food");
    expect(plan.envelope?.match).toBe("exact");
  });
});
