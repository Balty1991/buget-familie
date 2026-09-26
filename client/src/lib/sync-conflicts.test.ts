import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAppData, normalizeAppData, type AppData } from "@/lib/finance-data";
import { recordRemovals } from "@/lib/sync-removals";
import { activeAllocationConflicts, applyAllocationConflictChoice, mergeFamilyData, syncBaseOf } from "@/lib/family-crypto";

const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.salaryPlan = { ...data.settings.salaryPlan, allocations: [
    { id: "m", label: "Mâncare", amount: 600, category: "Alimente", updatedAt: "2026-09-01T10:00:00.000Z" },
  ] };
  return normalizeAppData(data);
};
const setAmount = (data: AppData, amount: number, at: string): AppData => ({ ...data, settings: { ...data.settings, salaryPlan: { ...data.settings.salaryPlan, allocations: data.settings.salaryPlan.allocations.map((item) => item.id === "m" ? { ...item, amount, updatedAt: at } : item) } } });
const amountOf = (data: AppData) => data.settings.salaryPlan.allocations[0].amount;

describe("conflicte de plic între telefoane", () => {
  let clock = Date.parse("2026-09-10T12:00:00.000Z");
  const tick = () => { clock += 1000; vi.setSystemTime(clock); };
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(clock); });
  afterEach(() => vi.useRealTimers());

  it("conflictul primit de la partener arată sumele din perspectiva acestui telefon, fără să schimbe suma", () => {
    const shared = family();
    const A = setAmount(shared, 650, "2026-09-10T10:00:00.000Z");
    const B = setAmount(shared, 700, "2026-09-10T10:00:01.000Z");
    const b = mergeFamilyData(B, A, syncBaseOf(shared));
    expect(amountOf(b)).toBe(700);
    tick();
    const a = mergeFamilyData(A, b, syncBaseOf(A));
    expect(amountOf(a)).toBe(650);
    const [conflict] = activeAllocationConflicts(a);
    expect({ local: conflict.localAmount, remote: conflict.remoteAmount }).toEqual({ local: 650, remote: 700 });
    // B trimite din nou, cu baza lui: conflictul deschis blochează „câștigă cine a schimbat”.
    tick();
    const bAgain = mergeFamilyData(b, a, syncBaseOf(A));
    expect(amountOf(bAgain)).toBe(700);
    expect(activeAllocationConflicts(bAgain)).toHaveLength(1);
  });

  it("alegerea făcută pe un telefon închide conflictul și pe celălalt, cu suma aleasă", () => {
    const shared = family();
    const A = setAmount(shared, 650, "2026-09-10T10:00:00.000Z");
    const B = setAmount(shared, 700, "2026-09-10T10:00:01.000Z");
    let a = mergeFamilyData(A, B, syncBaseOf(shared));
    const b = mergeFamilyData(B, A, syncBaseOf(shared));
    tick();
    a = applyAllocationConflictChoice(a, activeAllocationConflicts(a)[0].id, "local");
    expect(amountOf(a)).toBe(650);
    tick();
    // A primește pachetul vechi al lui B (conflict încă deschis acolo): rezolvarea lui A rămâne.
    const aAfter = mergeFamilyData(a, b, syncBaseOf(B));
    expect(activeAllocationConflicts(aAfter)).toHaveLength(0);
    expect(amountOf(aAfter)).toBe(650);
    tick();
    // B primește alegerea lui A: trece pe 650 și nu mai are conflict.
    const bAfter = mergeFamilyData(b, aAfter, syncBaseOf(A));
    expect(activeAllocationConflicts(bAfter)).toHaveLength(0);
    expect(amountOf(bAfter)).toBe(650);
  });
});

describe("ștergeri care nu trebuie să revină", () => {
  it("o categorie ștearsă și creată din nou rămâne după unirea cu partenerul", () => {
    const start = family();
    const shared = { ...start, settings: { ...start.settings, customCategories: ["Vacanță"] } };
    const aRemoved = recordRemovals(shared, { ...shared, settings: { ...shared.settings, customCategories: [] } }, "2026-09-10T10:00:00.000Z");
    const b = mergeFamilyData(shared, aRemoved);
    expect(b.settings.customCategories).toEqual([]);
    const aBack = recordRemovals(aRemoved, { ...aRemoved, settings: { ...aRemoved.settings, customCategories: ["Vacanță"] } }, "2026-09-12T10:00:00.000Z");
    expect(mergeFamilyData(aBack, b).settings.customCategories).toEqual(["Vacanță"]);
    expect(mergeFamilyData(b, aBack).settings.customCategories).toEqual(["Vacanță"]);
  });

  it("o contribuție scoasă dintr-un eveniment nu revine de pe celălalt telefon", () => {
    const start = family();
    const withEvent: AppData = { ...start, settings: { ...start.settings, plannedEvents: [{ id: "ev", name: "Crăciun", date: "2026-12-24", estimate: 1000, kind: "holiday", repeat: "yearly", contributions: [{ id: "c1", amount: 200, date: "2026-09-10" }], updatedAt: "2026-09-10T10:00:00.000Z" } as AppData["settings"]["plannedEvents"][number]] } };
    const removed = recordRemovals(withEvent, { ...withEvent, settings: { ...withEvent.settings, plannedEvents: withEvent.settings.plannedEvents.map((item) => ({ ...item, contributions: undefined })) } });
    expect(mergeFamilyData(removed, withEvent).settings.plannedEvents[0].contributions).toBeUndefined();
    expect(mergeFamilyData(withEvent, removed).settings.plannedEvents[0].contributions).toBeUndefined();
  });
});
