import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { envelopeUntilPayday, untilPayday } from "./household-insights";

describe("până la salariu", () => {
  it("numără zilele până la data obișnuită și până la cea mai târzie", () => {
    const plan = { ...createEmptyAppData().settings.salaryPlan, periodStart: "2026-10-10", nextPayday: "2026-11-10", paydayFlexDays: 3 };
    expect(untilPayday(plan, "2026-10-31")).toMatchObject({ days: 10, latestDays: 13, latest: "2026-11-13", earliest: "2026-11-07" });
    expect(untilPayday({ ...plan, nextPayday: "2026-10-20" }, "2026-10-31")).toBeUndefined();
  });
  it("împarte ce a rămas în plic pe zilele rămase, prudent", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-10", nextPayday: "2026-11-10", paydayFlexDays: 0, allocations: [{ id: "m", label: "Mâncare", amount: 1000, category: "Alimente", weeklyPace: true }] };
    const result = envelopeUntilPayday(data, data.settings.salaryPlan.allocations[0], "2026-10-31")!;
    expect(result).toMatchObject({ days: 10, remaining: 1000, perDay: 100, perWeek: 700 });
  });
});
