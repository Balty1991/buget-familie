/**
 * Marginile registrului: perioade de o zi, salariu înaintea începutului, o sută de
 * cheltuieli de zece bani, backup stricat, unire repetată.
 *
 * Cazul care a justificat fișierul: un backup cu un rând gol în plan arunca la import.
 * Recuperarea e singura funcție care se folosește când totul e deja stricat, deci nu are
 * voie să refuze fișierul — sare rândul și merge mai departe.
 */
import { describe, expect, it } from "vitest";
import {
  allocationWeeksStatus,
  commitLedgerEntry,
  createEmptyAppData,
  normalizeAppData,
  planAllocationMath,
  planForecast,
  transferBetweenEnvelopes,
  type AppData,
} from "./finance-data";
import { makeBackup, parseBackup } from "./app-storage";
import { mergeFamilyData } from "./family-crypto";

const base = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card", kind: "card", memberId: "member-me", openingBalance: 1000 }];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  data.settings.salaryPlan.sourceIds = ["card"];
  return data;
};

describe("marginile", () => {
  it("o perioadă de o singură zi nu strică tranșele", () => {
    const data = base();
    data.settings.salaryPlan.nextPayday = data.settings.salaryPlan.periodStart;
    data.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", amount: 700 }];
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.reduce((sum, week) => sum + week.budget, 0)).toBeCloseTo(700, 2);
  });

  it("o dată de salariu dinaintea începutului nu produce cifre imposibile", () => {
    const data = base();
    data.settings.salaryPlan.nextPayday = "2026-09-01";
    data.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", amount: 700 }];
    const math = planAllocationMath(data);
    for (const value of Object.values(math)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
    expect(Number.isFinite(planForecast(data).projectedRemaining)).toBe(true);
  });

  it("zecimalele nu se adună în derivă după o sută de cheltuieli", () => {
    let data = base();
    data.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", amount: 100 }];
    for (let index = 0; index < 100; index += 1) {
      data = commitLedgerEntry(data, {
        id: `t${index}`, title: "Cafea", amount: 0.1, kind: "expense", category: "Alimente",
        source: "Card", sourceId: "card", person: "Eu", memberId: "member-me", date: "2026-09-20", allocationId: "a1",
      });
    }
    const spent = data.transactions.reduce((sum, item) => sum + item.amount, 0);
    expect(spent).toBeCloseTo(10, 6);
  });

  it("o mutare mai mare decât plicul nu trece", () => {
    const data = base();
    data.settings.salaryPlan.allocations = [
      { id: "a1", label: "Alimente", amount: 100 },
      { id: "a2", label: "Transport", amount: 100 },
    ];
    expect(transferBetweenEnvelopes(data, { fromAllocationId: "a1", toAllocationId: "a2", amount: 500 })).toBeUndefined();
  });

  it("registrul stricat nu aruncă și nu inventează", () => {
    const gunoi = [
      null, undefined, 42, "text", [], {},
      { version: 9, transactions: [null, { amount: "abc" }, 7], settings: null },
      { settings: { salaryPlan: { allocations: [null, { amount: -5 }] } } },
      { transactions: [{ amount: Number.POSITIVE_INFINITY, date: "2026-13-45" }] },
    ];
    for (const item of gunoi) {
      const data = normalizeAppData(item);
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data.transactions.every((tx) => Number.isFinite(tx.amount) && tx.amount >= 0)).toBe(true);
      expect(Array.isArray(data.settings.plannedEvents)).toBe(true);
    }
  });

  it("backupul duce cu el și evenimentele viitoare", () => {
    const data = base();
    data.settings.plannedEvents = [
      { id: "e1", name: "Crăciun", date: "2026-12-25", estimate: 1200, kind: "holiday", repeat: "yearly", contributions: [{ id: "p1", amount: 300, date: "2026-10-01" }] },
    ];
    const restored = parseBackup(JSON.stringify(makeBackup(data)));
    expect(restored.data.settings.plannedEvents).toEqual(data.settings.plannedEvents);
  });

  it("unirea a două telefoane e stabilă: a doua unire nu mai schimbă nimic", () => {
    const local = base();
    const remote = base();
    local.settings.salaryPlan.allocations = [{ id: "a1", label: "Alimente", amount: 900, updatedAt: "2026-09-20T10:00:00.000Z" }];
    remote.settings.salaryPlan.allocations = [{ id: "a2", label: "Transport", amount: 300, updatedAt: "2026-09-20T09:00:00.000Z" }];
    local.settings.plannedEvents = [{ id: "e1", name: "Crăciun", date: "2026-12-25", estimate: 1200, kind: "holiday", repeat: "yearly" }];
    const odata = mergeFamilyData(local, remote);
    const dedoua = mergeFamilyData(odata, remote);
    expect(JSON.stringify(dedoua)).toBe(JSON.stringify(odata));
  });
});
