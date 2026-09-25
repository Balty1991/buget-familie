import { describe, expect, it } from "vitest";
import { allocationStatus, createEmptyAppData } from "./finance-data";
import { buildUndo } from "./undo-delete";

describe("bani la ban", () => {
  it("un plic cheltuit exact până la ultimul ban nu e „depășit”", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-01", nextPayday: "2026-10-31", allocations: [{ id: "a", label: "Casă", amount: 365.28, category: "Casă & facturi" }] };
    data.transactions = [126.33, 155.77, 83.18].map((amount, index) => ({ id: `t${index}`, title: "x", amount, kind: "expense" as const, category: "Casă & facturi", source: "", person: "", date: "2026-10-05", allocationId: "a" }));
    const status = allocationStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(status.remaining).toBe(0);
    expect(status.state).not.toBe("over");
  });
  it("rândul readus prin „Anulează” e mai nou decât ștergerea, ca sincronizarea să nu-l scoată iar", () => {
    const data = createEmptyAppData();
    const tx = { id: "t", title: "Lidl", amount: 10, kind: "expense" as const, category: "Alimente", source: "", person: "", date: "2026-10-05", updatedAt: "2026-01-05T10:00:00.000Z" };
    const undo = buildUndo("x", { transactions: [tx] })!;
    const restored = undo.apply({ ...data, deleted: [{ entity: "transactions", id: "t", deletedAt: "2026-01-05T11:00:00.000Z" }] });
    expect(Date.parse(restored.transactions[0].updatedAt!)).toBeGreaterThan(Date.parse("2026-01-05T11:00:00.000Z"));
  });
});
