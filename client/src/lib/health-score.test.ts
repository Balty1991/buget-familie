import { describe, expect, it } from "vitest";
import { calculateHealthScore, createEmptyAppData, newId, type AppData } from "./finance-data";

const ASOF = "2026-09-11";

const base = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources[0].openingBalance = 0;
  return data;
};

const withMoney = (): AppData => {
  const data = base();
  const source = data.settings.paymentSources[0];
  data.transactions = [{
    id: newId("tx"), title: "Salariu", amount: 5000, kind: "income", category: "Venit",
    source: source.name, sourceId: source.id, person: data.settings.members[0].name,
    memberId: data.settings.members[0].id, date: "2026-09-01",
  }];
  return data;
};

/** Plicurile numără doar cheltuielile din ciclul curent de salariu; fără ciclu, nimic nu intră. */
const withCycle = (): AppData => {
  const data = withMoney();
  data.settings.salaryPlan.periodStart = "2026-08-25";
  data.settings.salaryPlan.nextPayday = "2026-09-25";
  return data;
};

describe("scorul de sănătate nu inventează o notă", () => {
  it("un registru gol nu primește niciun scor", () => {
    const health = calculateHealthScore(base(), ASOF);
    expect(health.score).toBeNull();
    expect(health.tone).toBe("unknown");
  });

  it("spune limpede ce lipsește, în loc să tacă", () => {
    const health = calculateHealthScore(base(), ASOF);
    expect(health.missing).toEqual([
      "Adaugă o mișcare sau soldul unei surse",
      "Creează primul plic în Plan",
      "Treci scadențele lunare sau o datorie",
      "Stabilește data următorului venit",
    ]);
  });

  it("nu premiază lipsa plicurilor și a scadențelor", () => {
    const health = calculateHealthScore(base(), ASOF);
    const byId = Object.fromEntries(health.factors.map((item) => [item.id, item]));
    expect(byId.envelopes.known).toBe(false);
    expect(byId.dues.known).toBe(false);
    expect(byId.margin.known).toBe(false);
    expect(byId.pace.known).toBe(false);
  });

  it("doar banii, fără plan, sunt încă prea puțin", () => {
    // 0,35 din pondere cunoscută — sub jumătate, deci tot nu dăm notă.
    const health = calculateHealthScore(withMoney(), ASOF);
    expect(health.score).toBeNull();
    expect(health.factors.find((item) => item.id === "margin")?.known).toBe(true);
  });

  it("bani plus data salariului ajung pentru o notă", () => {
    const data = withCycle();
    const health = calculateHealthScore(data, ASOF);
    expect(health.score).not.toBeNull();
    // Plicurile și scadențele lipsesc încă; scorul o spune, nu o ascunde.
    expect(health.missing).toContain("Creează primul plic în Plan");
  });

  it("bani plus plicuri dau un scor real", () => {
    const data = withCycle();
    data.settings.salaryPlan.allocations = [
      { id: newId("alloc"), label: "Alimente", category: "Alimente", amount: 1500, sourceId: data.settings.paymentSources[0].id },
    ];
    const health = calculateHealthScore(data, ASOF);
    expect(health.score).not.toBeNull();
    expect(health.score).toBeGreaterThan(0);
    expect(health.tone).not.toBe("unknown");
  });

  it("un plic depășit trage scorul în jos, nu îl lasă „calm”", () => {
    const data = withCycle();
    const source = data.settings.paymentSources[0];
    data.settings.salaryPlan.allocations = [
      { id: "alloc-1", label: "Alimente", category: "Alimente", amount: 300, sourceId: source.id, weeklyPace: false },
    ];
    data.transactions.push({
      id: newId("tx"), title: "Kaufland", amount: 900, kind: "expense", category: "Alimente",
      source: source.name, sourceId: source.id, person: data.settings.members[0].name,
      memberId: data.settings.members[0].id, date: "2026-09-05", allocationId: "alloc-1",
    });
    const healthy = calculateHealthScore(withCycle(), ASOF);
    const strained = calculateHealthScore(data, ASOF);
    expect(strained.score).not.toBeNull();
    expect(strained.factors.find((item) => item.id === "envelopes")!.value).toBeLessThan(0.5);
    expect(healthy.score === null || strained.score! < healthy.score).toBe(true);
  });

  it("ponderile se împart doar între factorii cunoscuți", () => {
    const data = withCycle();
    data.settings.salaryPlan.allocations = [
      { id: newId("alloc"), label: "Alimente", category: "Alimente", amount: 1000, sourceId: data.settings.paymentSources[0].id },
    ];
    const health = calculateHealthScore(data, ASOF);
    const known = health.factors.filter((item) => item.known);
    const weight = known.reduce((sum, item) => sum + item.weight, 0);
    const expected = Math.round((known.reduce((sum, item) => sum + item.value * item.weight, 0) / weight) * 100);
    expect(health.score).toBe(expected);
  });
});
