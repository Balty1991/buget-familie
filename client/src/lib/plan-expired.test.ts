/**
 * Ciclul care a expirat — starea prin care trece fiecare familie în fiecare lună, între
 * ziua salariului și clipa în care cineva deschide Planul ca să-l reînnoiască.
 *
 * Până acum aplicația spunea două lucruri deodată, amândouă greșite: „poți cheltui 1.900
 * pe zi până pe 14 sept.” (un ritm uriaș, calculat pe zile care trecuseră) și, pe ecranul
 * Astăzi, „ritmul sigur e 0 — verifică plicurile”. Acum spune ce s-a întâmplat și ce
 * urmează de făcut.
 */
import { describe, expect, it } from "vitest";
import {
  allocationWeeksStatus,
  envelopeDecisionStatus,
  createEmptyAppData,
  planAllocationMath,
  planForecast,
  planEndDate,
  planExpired,
  inPlanPeriod,
  type AppData,
} from "./finance-data";
import { analyze, answerToText } from "./analyst";
import { todayBrief } from "./household-insights";

/** Ciclul s-a încheiat acum o săptămână, iar omul nu a apucat să-l reînnoiască. */
const expirat = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: "member-me", openingBalance: 2000 }];
  data.settings.salaryPlan.periodStart = "2026-08-14";
  data.settings.salaryPlan.nextPayday = "2026-09-14"; // a trecut de o săptămână
  data.settings.salaryPlan.sourceIds = ["card"];
  data.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", category: "Alimente", amount: 900, sourceId: "card", weeklyPace: true }];
  data.transactions = [
    { id: "t1", title: "Lidl", amount: 100, kind: "expense", category: "Alimente", source: "Card", sourceId: "card", person: "Eu", memberId: "member-me", date: "2026-09-18", allocationId: "a1" },
  ];
  return data;
};

const AZI = "2026-09-21";

describe("ciclul care a expirat", () => {
  it("cifrele rămân finite, nu negative fără sens", () => {
    const data = expirat();
    const math = planAllocationMath(data);
    for (const [nume, value] of Object.entries(math)) {
      if (typeof value === "number") expect(Number.isFinite(value), nume).toBe(true);
    }
    const forecast = planForecast(data, AZI);
    expect(Number.isFinite(forecast.projectedRemaining)).toBe(true);
    expect(Number.isFinite(forecast.safeDaily)).toBe(true);
    expect(forecast.safeDaily).toBeGreaterThanOrEqual(0);
  });

  /**
   * Cheltuielile de după sfârșitul ciclului nu intră în plicurile lui — asta e regula
   * plicurilor, nu un bug. Dar înseamnă că plicul arată plin, deci cifra zilei nu are voie
   * să se sprijine pe el: de aceea fișa zilei trece pe zero și spune de ce.
   */
  it("plicul vechi nu mai ține loc de ritm după încheiere", () => {
    const data = expirat();
    expect(inPlanPeriod("2026-09-18", data.settings.salaryPlan)).toBe(false);
    const status = envelopeDecisionStatus(data, data.settings.salaryPlan.allocations[0], AZI);
    expect(status.spent).toBe(0);
    expect(todayBrief(data, AZI).spendable).toBe(0);
  });

  it("fișa zilei spune că ciclul s-a încheiat, nu că „ritmul sigur e 0”", () => {
    const brief = todayBrief(expirat(), AZI);
    expect(brief.expired).toBe(true);
    expect(brief.spendable).toBe(0);
    expect(brief.reason).toContain("Ciclul s-a încheiat");
    expect(brief.reason).not.toContain("verifică plicurile");
  });

  it("nu mai dă un ritm uriaș calculat pe zile trecute", () => {
    const data = expirat();
    for (const intrebare of ["cat mai pot cheltui azi?", "cate zile mai am pana la salariu?", "imi permit 400 de lei?"]) {
      const raspuns = analyze(intrebare, data, AZI);
      expect(raspuns, intrebare).toBeTruthy();
      expect(answerToText(raspuns!), intrebare).toContain("Ciclul s-a încheiat");
      expect(answerToText(raspuns!), intrebare).toMatch(/salariul vine pe|Plan/);
    }
  });

  it("dar un ciclu în curs răspunde ca înainte, cu cifre", () => {
    const data = expirat();
    data.settings.salaryPlan.periodStart = "2026-09-14";
    data.settings.salaryPlan.nextPayday = "2026-10-14";
    const raspuns = analyze("cat mai pot cheltui azi?", data, AZI);
    expect(answerToText(raspuns!)).not.toContain("Ciclul s-a încheiat");
    expect(todayBrief(data, AZI).expired).toBe(false);
  });

  it("salariul întârziat în fereastră nu închide cifra zilei", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: "member-me", openingBalance: 4000 }];
    data.settings.salaryPlan.periodStart = "2026-09-15";
    data.settings.salaryPlan.nextPayday = "2026-10-15";
    data.settings.salaryPlan.paydayFlexDays = 3;
    data.settings.salaryPlan.sourceIds = ["card"];
    data.settings.salaryPlan.allocations = [
      { id: "food", label: "Alimente", category: "Alimente", amount: 2100, sourceId: "card", weeklyPace: true },
      { id: "house", label: "Casă", category: "Casă & facturi", amount: 1200, sourceId: "card", weeklyPace: false },
    ];
    expect(inPlanPeriod("2026-10-16", data.settings.salaryPlan)).toBe(true);
    expect(planExpired(data.settings.salaryPlan, "2026-10-16")).toBe(false);
    expect(planExpired(data.settings.salaryPlan, "2026-10-19")).toBe(true);
    const brief = todayBrief(data, "2026-10-16");
    expect(brief.expired).toBe(false);
    expect(brief.spendable).toBeGreaterThan(0);
    expect(brief.reason).not.toContain("Ciclul s-a încheiat");
  });
});
