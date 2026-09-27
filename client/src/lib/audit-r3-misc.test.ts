import { describe, expect, it } from "vitest";
import { createEmptyAppData, normalizeAppData, planAllocationMath, sourceFreeBalance, type AppData } from "@/lib/finance-data";
import { mergeFamilyData, syncBaseOf, activeAllocationConflicts } from "@/lib/family-crypto";
import { resolveHydrateMerge, hashAppPayload, localSnapshotText } from "@/lib/app-storage";

describe("M1: plic finanțat parțial din tichete", () => {
  it("„nerepartizați” nu scade partea de tichete a plicului din banii de pe card", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = data.settings.paymentSources.map((s) => s.id === "source-debit" ? { ...s, openingBalance: 3000 } : s.id === "source-meal" ? { ...s, openingBalance: 600 } : s);
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-09-10", nextPayday: "2026-10-10", allocations: [{ id: "food", label: "Mâncare", category: "Alimente", amount: 1500, alertThreshold: 80, sourceId: "source-debit", funding: [{ sourceId: "source-meal", amount: 600 }] }] };
    const math = planAllocationMath(data);
    const freeOnCard = sourceFreeBalance(data, "source-debit").free; // 3000 - 900 = 2100
    expect(freeOnCard).toBe(2100);
    expect(math.unrepartized).toBe(freeOnCard); // primit: 1500 (cei 600 de pe tichete scad din card)
  });
});

describe("M2: plafonul de normalizare numără și rândurile arhivate", () => {
  it("un venit nou nu dispare când există 12 venituri arhivate", () => {
    const data = createEmptyAppData();
    const archived = Array.from({ length: 12 }, (_, i) => ({ id: `old${i}`, memberId: "member-me", label: `Vechi ${i}`, amount: 1000, day: 10, archived: true }));
    data.settings.salaryPlan = { ...data.settings.salaryPlan, incomes: [...archived, { id: "new", memberId: "member-me", label: "Salariu nou", amount: 6000, day: 25 }] };
    const normalized = normalizeAppData(JSON.parse(JSON.stringify(data)));
    expect(normalized.settings.salaryPlan.incomes!.some((i) => i.id === "new")).toBe(true);
  });
});

describe("M3: două file pe web unesc cu bază comună", () => {
  it("o sumă de plic schimbată într-o filă nu devine conflict în cealaltă", () => {
    const tabB = createEmptyAppData();
    tabB.settings.salaryPlan = { ...tabB.settings.salaryPlan, allocations: [{ id: "m", label: "Mâncare", amount: 600, alertThreshold: 80, updatedAt: "2026-09-01T10:00:00.000Z" }] };
    const tabA: AppData = { ...tabB, settings: { ...tabB.settings, salaryPlan: { ...tabB.settings.salaryPlan, allocations: [{ ...tabB.settings.salaryPlan.allocations[0], amount: 700, updatedAt: "2026-09-27T10:00:00.000Z" }] } } };
    // usePersistAppData ține ultima copie comună (tabB) ca bază.
    const merged = mergeFamilyData(tabB, tabA, syncBaseOf(tabB));
    expect(activeAllocationConflicts(merged)).toHaveLength(0);
    expect(merged.settings.salaryPlan.allocations[0].amount).toBe(700);
  });
});

describe("M4: hidratare după ce localStorage a fost golit de plafon", () => {
  it("o cheltuială notată înainte să răspundă IndexedDB nu înlocuiește tot registrul", () => {
    const indexedData = createEmptyAppData();
    indexedData.transactions = Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, title: "x", amount: 10, kind: "expense" as const, category: "Alimente", source: "", person: "", date: "2026-09-01" }));
    // localStorage golit la QuotaExceeded (freeHeavyLocalCache) => readInitialAppData() dă un registru gol.
    const memory = createEmptyAppData();
    memory.transactions = [{ id: "new", title: "Lidl", amount: 40, kind: "expense", category: "Alimente", source: "", person: "", date: "2026-09-27" }];
    const text = localSnapshotText(indexedData);
    const picked = resolveHydrateMerge({
      local: { data: null, savedAt: "2026-09-26T10:00:00.000Z", hash: hashAppPayload(text) }, // meta rămâne, datele nu
      indexed: { data: indexedData, savedAt: "2026-09-26T10:00:00.000Z", hash: hashAppPayload(text) },
      memory,
      editedBeforeHydrate: true,
    })!;
    expect(picked.transactions.length).toBeGreaterThanOrEqual(50); // primit: 1
  });
});
