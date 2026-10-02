import { describe, expect, it } from "vitest";
import { buildDemoData, isDemoMode } from "./demo-data";
import { normalizeAppData } from "./finance-data";

describe("familia exemplu", () => {
  const data = buildDemoData("2026-10-15");

  it("e relativă la azi: salariul a intrat, următorul vine", () => {
    expect(data.settings.salaryPlan.periodStart).toBe("2026-10-01");
    expect(data.settings.salaryPlan.nextPayday).toBe("2026-10-31");
    expect(data.transactions.every((item) => item.date <= "2026-10-15" && item.date >= "2026-10-01")).toBe(true);
  });

  it("trece prin normalizare fără să piardă nimic", () => {
    const normal = normalizeAppData(JSON.parse(JSON.stringify(data)));
    expect(normal.transactions).toHaveLength(data.transactions.length);
    expect(normal.settings.salaryPlan.allocations).toHaveLength(data.settings.salaryPlan.allocations.length);
    expect(normal.settings.members.map((item) => item.name)).toEqual(["Andrei", "Maria"]);
  });

  it("fiecare cheltuială pusă în plic are plicul ei", () => {
    const ids = new Set(data.settings.salaryPlan.allocations.map((item) => item.id));
    expect(data.transactions.filter((item) => item.allocationId).every((item) => ids.has(item.allocationId!))).toBe(true);
  });

  it("modul exemplu se citește din stocare", () => {
    expect(isDemoMode({ getItem: () => "1" })).toBe(true);
    expect(isDemoMode({ getItem: () => null })).toBe(false);
  });
});
