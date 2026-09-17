/**
 * Un plic se plătește din bani care există. Când sursa aleasă nu ajunge — 1.900 într-un cash
 * de 1.800 — diferența vine explicit din altă sursă, iar rezervarea se împarte între ele.
 */
import { describe, expect, it } from "vitest";
import { allocationFundingShares, allocationSourceIds, createEmptyAppData, matchingAllocationsForExpense, sourceFreeBalance, type AppData } from "./finance-data";

const house = (): AppData => {
  const data = createEmptyAppData();
  const me = data.settings.members[0];
  data.settings.members.push({ id: "m2", name: "Angi" });
  data.settings.paymentSources = [
    { id: "cash", name: "Cash", kind: "cash", memberId: me.id, openingBalance: 1800 },
    { id: "cash-angi", name: "Cash · Angi", kind: "cash", memberId: "m2", openingBalance: 300 },
  ];
  data.settings.salaryPlan.periodStart = "2026-09-14";
  data.settings.salaryPlan.nextPayday = "2026-10-09";
  return data;
};

describe("alimentarea unui plic din mai multe surse", () => {
  it("sursa principală duce restul, completările își scriu suma", () => {
    const shares = allocationFundingShares({ id: "e", label: "Alimente", amount: 1900, sourceId: "cash", funding: [{ sourceId: "cash-angi", amount: 100 }] });
    expect(shares).toEqual([{ sourceId: "cash", amount: 1800 }, { sourceId: "cash-angi", amount: 100 }]);
    expect(shares.reduce((sum, entry) => sum + entry.amount, 0)).toBe(1900);
  });

  it("fără completări, totul stă pe sursa principală", () => {
    expect(allocationFundingShares({ id: "e", label: "Alimente", amount: 1900, sourceId: "cash" }))
      .toEqual([{ sourceId: "cash", amount: 1900 }]);
  });

  it("rezervă din fiecare sursă doar partea ei", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "env", label: "Alimente", category: "Alimente", amount: 1900, sourceId: "cash", funding: [{ sourceId: "cash-angi", amount: 100 }] }];
    expect(sourceFreeBalance(data, "cash").free).toBe(0);
    expect(sourceFreeBalance(data, "cash-angi").free).toBe(200);
  });

  it("la editarea plicului, propria rezervă intră la loc în ambele surse", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "env", label: "Alimente", category: "Alimente", amount: 1900, sourceId: "cash", funding: [{ sourceId: "cash-angi", amount: 100 }] }];
    expect(sourceFreeBalance(data, "cash", "env").free).toBe(1800);
    expect(sourceFreeBalance(data, "cash-angi", "env").free).toBe(300);
  });

  it("o cheltuială din sursa completării scade tot din plic", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "env", label: "Alimente", category: "Alimente", amount: 1900, sourceId: "cash", funding: [{ sourceId: "cash-angi", amount: 100 }] }];
    expect(allocationSourceIds(data.settings.salaryPlan.allocations[0])).toEqual(["cash", "cash-angi"]);
    const matches = matchingAllocationsForExpense(data, { category: "Alimente", sourceId: "cash-angi" });
    expect(matches.map((item) => item.id)).toContain("env");
  });

  it("cheltuiala eliberează proporțional din fiecare sursă", () => {
    const data = house();
    data.settings.salaryPlan.allocations = [{ id: "env", label: "Alimente", category: "Alimente", amount: 1900, sourceId: "cash", funding: [{ sourceId: "cash-angi", amount: 100 }] }];
    data.transactions = [{ id: "tx", title: "Lidl", amount: 190, kind: "expense", category: "Alimente", source: "Cash", sourceId: "cash", person: "Eu", date: "2026-09-17", allocationId: "env" }];
    /* Cei 190 au ieșit din cash: soldul lui scade la 1.610, iar rezervarea lui la 1.610.
       Partea partenerei rămâne neatinsă, fiindcă nu din ea s-a plătit. */
    expect(sourceFreeBalance(data, "cash").free).toBe(0);
    expect(sourceFreeBalance(data, "cash-angi").free).toBe(200);
  });
});
