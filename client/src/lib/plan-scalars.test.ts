import { describe, expect, it } from "vitest";
import { mergeFamilyData } from "./family-crypto";
import { createEmptyAppData, type AppData } from "./finance-data";
import { stampPlanScalars } from "./plan-scalars";

const base = (): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-10", nextPayday: "2026-10-10", allocations: [{ id: "food", label: "Mâncare", amount: 1000, category: "Alimente", updatedAt: "2026-09-10T08:00:00.000Z" }], updatedAt: "2026-09-10T08:00:00.000Z" };
  return data;
};

describe("data salariului la unire (#8)", () => {
  it("marchează doar schimbările câmpurilor simple", () => {
    const before = base();
    const envelopeEdit: AppData = { ...before, settings: { ...before.settings, salaryPlan: { ...before.settings.salaryPlan, allocations: [{ ...before.settings.salaryPlan.allocations[0], amount: 1200 }] } } };
    expect(stampPlanScalars(before, envelopeEdit, "2026-09-20T10:00:00.000Z").settings.salaryPlan.scalarsUpdatedAt).toBeUndefined();
    const paydayEdit: AppData = { ...before, settings: { ...before.settings, salaryPlan: { ...before.settings.salaryPlan, nextPayday: "2026-10-08" } } };
    expect(stampPlanScalars(before, paydayEdit, "2026-09-20T10:00:00.000Z").settings.salaryPlan.scalarsUpdatedAt).toBe("2026-09-20T10:00:00.000Z");
  });

  it("editarea unui plic offline, mai târziu, nu anulează data schimbată de partener", () => {
    const start = base();
    // Partenerul mută salariul pe 8 octombrie la 10:00.
    const partner = stampPlanScalars(start, { ...start, settings: { ...start.settings, salaryPlan: { ...start.settings.salaryPlan, nextPayday: "2026-10-08", updatedAt: "2026-09-20T10:00:00.000Z" } } }, "2026-09-20T10:00:00.000Z");
    // Telefonul offline mărește plicul la 12:00 (planul primește updatedAt mai nou).
    const offline: AppData = { ...start, settings: { ...start.settings, salaryPlan: { ...start.settings.salaryPlan, allocations: [{ ...start.settings.salaryPlan.allocations[0], amount: 1200, updatedAt: "2026-09-20T12:00:00.000Z" }], updatedAt: "2026-09-20T12:00:00.000Z" } } };
    for (const merged of [mergeFamilyData(offline, partner), mergeFamilyData(partner, offline)]) {
      expect(merged.settings.salaryPlan.nextPayday).toBe("2026-10-08");
    }
  });
});
