import { describe, expect, it } from "vitest";
import { createEmptyAppData, type AppData, type MonthlyNeed } from "./finance-data";
import { compactGuideContext, understand } from "./understand";

const need = (id: string, label: string, min: number, max: number, extra: Partial<MonthlyNeed> = {}): MonthlyNeed => ({ id, label, category: label, cadence: "monthly", min, max, priority: "fixed", ...extra });
const family = (withNeeds = true): AppData => {
  const data = createEmptyAppData();
  data.settings.members = [{ id: "eu", name: "Eu" }, { id: "sotia", name: "Soția" }];
  data.settings.selfMemberId = "eu";
  data.settings.paymentSources = [
    { id: "tichete", name: "Tichete", kind: "meal", openingBalance: 0, memberId: "eu" },
    { id: "card", name: "Card", kind: "card", openingBalance: 0, memberId: "eu" },
    { id: "card-s", name: "Card Soția", kind: "card", openingBalance: 0, memberId: "sotia" },
  ];
  data.settings.salaryPlan = {
    ...data.settings.salaryPlan,
    allocations: [],
    incomes: [{ id: "i1", memberId: "eu", label: "Salariul meu", amount: 4700, day: 10 }, { id: "i2", memberId: "sotia", label: "Salariul soției", amount: 2800, day: 12 }],
    needs: withNeeds ? [need("rate", "Rate bănci", 1300, 1400), need("lumina", "Lumină", 300, 400), need("mancare", "Mâncare", 600, 600, { cadence: "weekly", priority: "flex" })] : [],
  };
  return data;
};
const top = (text: string, data: AppData, asOf = "2026-10-10") => understand(text, data, { asOf }).sort((a, b) => b.score - a.score)[0];

describe("ghidul și „Ce plătim lunar”", () => {
  it("„am primit salariul 4700” notează venitul și propune repartizarea din listă", () => {
    const reading = top("am primit salariul 4700", family());
    expect(reading.kind).toBe("intents");
    if (reading.kind !== "intents") return;
    const kinds = reading.intents.map((item) => item.intent.kind);
    expect(kinds).toEqual(["income", "income-split"]);
    const split = reading.intents[1].intent;
    expect(split.kind === "income-split" && split.preview).toMatch(/Rate bănci 1\.400 RON · Lumină 400 RON · Mâncare 2\.900 RON din 3\.000 RON/);
    expect(split.kind === "income-split" && split.preview).toMatch(/rămân 100 RON pentru Salariul soției/);
  });

  it("„soția a primit salariul 2800” pune venitul pe soție", () => {
    const reading = top("soția a primit salariul 2800", family());
    if (reading.kind !== "intents") throw new Error(reading.kind);
    const income = reading.intents[0].intent;
    expect(income.kind === "income" && income.memberId).toBe("sotia");
  });

  it("„cum împart salariul?” găsește salariul nerepartizat", () => {
    const data = family();
    data.transactions = [{ id: "s", title: "Salariu", amount: 4700, kind: "income", category: "Venit", source: "Card", person: "Eu", date: "2026-10-10", sourceId: "card", memberId: "eu" }];
    const reading = top("cum împart salariul?", data, "2026-10-11");
    if (reading.kind !== "intents") throw new Error(reading.kind);
    expect(reading.intents.map((item) => item.intent.kind)).toEqual(["income-split"]);
    expect(reading.headline).toMatch(/nerepartizat/);
  });

  it("fără salariu de repartizat, spune ce să scrie", () => {
    const reading = top("cum împart salariul?", family(), "2026-10-11");
    expect(reading.kind).toBe("insight");
  });

  it("fără „Ce plătim lunar”, ghidul rămâne cum era", () => {
    const reading = top("am primit salariul 4700", family(false));
    if (reading.kind === "intents") expect(reading.intents.some((item) => item.intent.kind === "income-split")).toBe(false);
  });

  it("modelul online primește lista, cu numele plătitorului", () => {
    const data = family();
    data.settings.salaryPlan.needs![0].payerId = "sotia";
    const context = compactGuideContext(data);
    expect(context.monthlyNeeds[0]).toMatchObject({ label: "Rate bănci", per: "month", reserved: 1400, payer: "Soția", first: true });
    expect(context.expectedIncomes).toEqual([{ who: "Eu", label: "Salariul meu", amount: 4700, day: 10 }, { who: "Soția", label: "Salariul soției", amount: 2800, day: 12 }]);
  });
});
