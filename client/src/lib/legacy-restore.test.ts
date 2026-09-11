/**
 * Ce se întâmplă cu un backup făcut de o versiune mai veche a aplicației.
 * Este exact scenariul pentru care există butonul: actualizezi aplicația și vrei
 * datele înapoi. Un câmp lipsă sau redenumit nu are voie să piardă mișcări.
 */
import { describe, expect, it } from "vitest";
import { normalizeAppData, sourceBalance, allocationStatus } from "./finance-data";
import { parseBackup } from "./app-storage";

/** Formă veche: fără `version`, fără `sourceId`/`memberId`, cu `balance` în loc de `openingBalance`. */
const legacyBackup = () => JSON.stringify({
  kind: "buget-familie-backup",
  version: 1,
  exportedAt: "2024-03-02T10:00:00.000Z",
  data: {
    transactions: [
      { id: "t1", title: "Salariu", amount: "5.200,50", kind: "income", category: "Venit", source: "Card debit", person: "Eu", date: "2024-03-01" },
      { id: "t2", title: "Lidl", amount: 240, kind: "expense", category: "Alimente", source: "Card debit", person: "Eu", date: "2024-03-02" },
      { id: "t3", title: "Bon masă", amount: 60, kind: "expense", category: "Alimente", source: "Tichete", person: "Eu", date: "2024-03-02" },
    ],
    receipts: [], debts: [], savings: [], recurring: [],
    settings: {
      familyName: "Familia Veche",
      memberName: "Eu",
      members: [{ id: "m1", name: "Eu" }],
      paymentSources: [
        { id: "s1", name: "Card debit", kind: "card", memberId: "m1", balance: 1000 },
        { id: "s2", name: "Tichete", kind: "meal", memberId: "m1", balance: 300 },
      ],
      customCategories: [],
      salaryPlan: {
        periodStart: "2024-02-25", nextPayday: "2024-03-25", sourceIds: [], totalLimit: 0, weeklyLimit: 0,
        allocations: [{ id: "a1", label: "Alimente", category: "Alimente", amount: 800, sourceId: "s1" }],
        transfers: [],
      },
    },
  },
});

describe("un backup vechi se recuperează întreg", () => {
  const data = normalizeAppData(parseBackup(legacyBackup()).data);

  it("nu pierde nicio mișcare", () => {
    expect(data.transactions).toHaveLength(3);
  });

  it("citește sumele scrise românește", () => {
    expect(data.transactions.find((item) => item.id === "t1")!.amount).toBeCloseTo(5200.5, 2);
  });

  it("leagă fiecare mișcare de sursa ei după nume, deși lipsea `sourceId`", () => {
    expect(data.transactions.find((item) => item.id === "t2")!.sourceId).toBe("s1");
    expect(data.transactions.find((item) => item.id === "t3")!.sourceId).toBe("s2");
  });

  it("mută vechiul `balance` în soldul de pornire, ca soldurile să iasă", () => {
    // 1000 de pornire + 5200,50 venit − 240 cheltuială
    expect(sourceBalance(data, "s1")).toBeCloseTo(5960.5, 2);
    expect(sourceBalance(data, "s2")).toBeCloseTo(240, 2);
  });

  it("leagă membrul după nume, deși lipsea `memberId`", () => {
    expect(data.transactions.every((item) => item.memberId === "m1")).toBe(true);
  });

  it("păstrează plicul și îi calculează consumul", () => {
    const allocation = data.settings.salaryPlan.allocations[0];
    expect(allocation.amount).toBe(800);
    expect(allocationStatus(data, allocation).spent).toBe(240);
  });

  it("ridică datele la versiunea curentă fără să le rescrie", () => {
    expect(data.version).toBe(9);
    expect(data.settings.familyName).toBe("Familia Veche");
    expect(data.pendingReview).toEqual([]);
  });
});
