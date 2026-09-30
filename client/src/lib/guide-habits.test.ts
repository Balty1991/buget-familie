import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type Transaction } from "./finance-data";
import { habitWords, repeatedSpend, usualSpend } from "./guide-habits";

const tx = (id: string, title: string, amount: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, title, amount, date, kind: "expense", category: "Băuturi", source: "Card", sourceId: "card", person: "Eu", memberId: "m1", ...extra,
});

const withHistory = (): AppData => {
  const data = createEmptyAppData();
  data.transactions = [
    tx("1", "Cafea", 14, "2026-09-20", { allocationId: "env-cafe" }),
    tx("2", "Cafea", 14, "2026-09-24", { allocationId: "env-cafe" }),
    tx("3", "Cafea mare", 18, "2026-09-26", { allocationId: "env-cafe" }),
    tx("4", "Lidl", 230, "2026-09-25", { category: "Alimente" }),
    tx("5", "Taxi", 32, "2026-09-28", { category: "Transport" }),
    tx("6", "Lidl", 180, "2026-09-28", { category: "Alimente" }),
  ];
  return data;
};

describe("sumele obișnuite", () => {
  it("cuvintele care contează rămân, verbele și timpul pleacă", () => {
    expect(habitWords("am luat o cafea azi")).toEqual(["cafea"]);
  });

  it("„cafea” fără sumă → suma de obicei, categoria și plicul de obicei", () => {
    expect(usualSpend(withHistory(), "cafea", "2026-09-30")).toMatchObject({ amount: 14, title: "Cafea", category: "Băuturi", allocationId: "env-cafe", count: 3 });
    expect(usualSpend(withHistory(), "am luat cafeaua", "2026-09-30")?.amount).toBe(14);
  });

  it("o singură cheltuială nu e încă un obicei", () => {
    expect(usualSpend(withHistory(), "taxi", "2026-09-30")).toBeUndefined();
  });

  it("cu sumă scrisă nu intervine", () => {
    expect(usualSpend(withHistory(), "cafea 20", "2026-09-30")).toBeUndefined();
  });
});

describe("„la fel ca…”", () => {
  it("„la fel ca ieri” → ultima cheltuială de ieri", () => {
    expect(repeatedSpend(withHistory(), "la fel ca ieri", "2026-09-29")?.id).toBe("6");
  });

  it("„ca data trecută la Lidl” → ultima de la Lidl", () => {
    expect(repeatedSpend(withHistory(), "ca data trecuta la lidl", "2026-09-30")).toMatchObject({ title: "Lidl", amount: 180 });
  });

  it("fără cuvânt de repetare nu intervine", () => {
    expect(repeatedSpend(withHistory(), "lidl", "2026-09-30")).toBeUndefined();
  });
});

describe("ghidul propune din obiceiuri", () => {
  it("„cafea” → cheltuială de 14 lei, cu plicul de cafea primul", async () => {
    const { understand, decide } = await import("./understand");
    const data = withHistory();
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 1600, sourceId: "card", weeklyPace: false },
      { id: "env-cafe", label: "Cafele", category: "Băuturi", amount: 200, sourceId: "card", weeklyPace: false },
    ];
    const winner = decide(understand("cafea", data, { asOf: "2026-09-30" })).winner;
    expect(winner?.kind).toBe("expense");
    const proposal = winner && "proposal" in winner ? winner.proposal : undefined;
    expect(proposal?.text).toContain("De obicei");
    expect(proposal?.choices[0].update).toMatchObject({ amount: 14, allocationId: "env-cafe" });
  });

  it("„la fel ca data trecută la lidl” → 180 lei azi", async () => {
    const { understand, decide } = await import("./understand");
    const winner = decide(understand("la fel ca data trecuta la lidl", withHistory(), { asOf: "2026-09-30" })).winner;
    const proposal = winner && "proposal" in winner ? winner.proposal : undefined;
    expect(proposal?.spend).toMatchObject({ amount: 180, title: "Lidl", date: "2026-09-30" });
  });
});
