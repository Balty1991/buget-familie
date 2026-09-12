import { describe, expect, it } from "vitest";
import { createEmptyAppData, newId } from "./finance-data";
import { weeklyDigestPdfSnapshot } from "./weekly-digest-pdf";

describe("weekly digest PDF", () => {
  it("include headline, flux și plicuri din check-in", () => {
    const data = createEmptyAppData();
    data.settings.familyName = "Casa Test";
    const source = data.settings.paymentSources[0];
    const member = data.settings.members[0];
    data.settings.salaryPlan.periodStart = "2026-09-08";
    data.settings.salaryPlan.allocations = [
      { id: "al-1", label: "Alimente", category: "Alimente", amount: 700, weeklyPace: true },
    ];
    data.transactions = [
      { id: newId("tx"), title: "Salariu", amount: 5000, kind: "income", category: "Venit", source: source.name, sourceId: source.id, person: member.name, memberId: member.id, date: "2026-09-09" },
      { id: newId("tx"), title: "Lidl", amount: 220, kind: "expense", category: "Alimente", source: source.name, sourceId: source.id, person: member.name, memberId: member.id, date: "2026-09-10", allocationId: "al-1" },
    ];
    const snap = weeklyDigestPdfSnapshot(data, "2026-09-10");
    expect(snap.familyName).toBe("Casa Test");
    expect(snap.income).toBe(5000);
    expect(snap.expense).toBe(220);
    expect(snap.headline.length).toBeGreaterThan(0);
    expect(snap.shareText).toContain("Casa Test");
  });
});
