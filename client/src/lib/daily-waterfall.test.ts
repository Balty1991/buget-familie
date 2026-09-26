import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData } from "./finance-data";
import { safeSpendBreakdown, todayBrief } from "./household-insights";

const ASOF = "2026-09-24";
const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: source.id === "source-debit" ? 2500 : 0 }));
  data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-20", nextPayday: "2026-10-05", earliestPayday: undefined, paydayFlexDays: 0 };
  return data;
};

describe("cascada cifrei zilei", () => {
  it("pornește de la banii zilei și ajunge exact la cifra zilei", () => {
    const data = family();
    const sheet = safeSpendBreakdown(data, ASOF);
    const steps = sheet.waterfall;
    expect(steps[0].kind).toBe("start");
    expect(steps[steps.length - 1]).toMatchObject({ kind: "result", total: todayBrief(data, ASOF).spendable });
    expect(steps.every((step) => step.total >= 0)).toBe(true);
  });
  it("nu are pași fără data salariului", () => {
    const data = family();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, nextPayday: "", earliestPayday: undefined };
    expect(safeSpendBreakdown(data, ASOF).waterfall).toEqual([]);
  });
});
