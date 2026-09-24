/**
 * Testarea cu utilizatori, M6: un freelancer fără dată de salariu primește o cifră pe zi.
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppData, rollIncomeHorizon } from "./finance-data";
import { todayBrief } from "./household-insights";

const mihai = () => {
  const data = createEmptyAppData();
  data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 8400 : 0 }));
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-01", nextPayday: "", horizonDays: 30 };
  return data;
};

describe("venit neregulat: „banii să-mi ajungă N zile”", () => {
  it("fără dată de salariu, dar cu 30 de zile, cifra zilei e banii împărțiți pe 30", () => {
    expect(todayBrief(mihai(), "2026-09-24").hasPayday).toBe(false);
    const rolled = rollIncomeHorizon(mihai(), "2026-09-24");
    expect(rolled.settings.salaryPlan.periodStart).toBe("2026-09-24");
    expect(rolled.settings.salaryPlan.nextPayday).toBe("2026-10-23");
    expect(todayBrief(rolled, "2026-09-24").spendable).toBeCloseTo(280, 2);
  });

  it("perioada se mută în fiecare zi, nu expiră", () => {
    const tomorrow = rollIncomeHorizon(rollIncomeHorizon(mihai(), "2026-09-24"), "2026-09-25");
    expect(tomorrow.settings.salaryPlan.periodStart).toBe("2026-09-25");
    expect(tomorrow.settings.salaryPlan.nextPayday).toBe("2026-10-24");
  });

  it("fără modul acesta, planul nu se atinge", () => {
    const data = mihai();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, horizonDays: undefined };
    expect(rollIncomeHorizon(data, "2026-09-24")).toBe(data);
  });
});
