import { describe, expect, it } from "vitest";
import { buildDemoData } from "./demo-data";
import { monthEnd } from "./month-end";

describe("asistentul de sfârșit de lună", () => {
  const data = buildDemoData("2026-10-02");

  it("apare doar în ultimele 5 zile dinainte de salariu", () => {
    expect(monthEnd(data, "2026-10-02")).toBeUndefined();
    expect(monthEnd(data, "2026-10-13")?.days).toBe(5);
    expect(monthEnd(data, "2026-10-18")).toBeUndefined();
  });

  it("arată plățile rămase, cât mai e și propune jumătate din ce rămâne spre un obiectiv", () => {
    const end = monthEnd(data, "2026-10-14")!;
    expect(end.days).toBe(4);
    expect(end.bills.map((bill) => bill.label)).toContain("Utilități");
    expect(end.bills.find((bill) => bill.label === "Chirie")).toBeUndefined();
    expect(end.flexLeft).toBeGreaterThan(0);
    expect(end.perDay).toBe(Math.floor((end.flexLeft / 4) * 100) / 100);
    expect(end.suggestion?.goal.id).toBe("demo-saving");
    expect(end.suggestion!.amount % 10).toBe(0);
    expect(end.suggestion!.amount).toBeLessThanOrEqual(end.projectedLeft / 2);
  });

  it("fondul de urgență are întâietate", () => {
    const withFund = { ...data, savings: [...data.savings, { id: "f", name: "Fond de urgență", current: 0, target: 9000, due: "", tone: "forest" as const }] };
    expect(monthEnd(withFund, "2026-10-14")?.suggestion?.goal.id).toBe("f");
  });
});
