import { describe, expect, it } from "vitest";
import { allocationFromText, createEmptyAppData, revertSalaryAllocationApplication, type AppData, type MonthlyNeed } from "./finance-data";
import { applyIncomeSplit, pendingSplitIncome, proposeIncomeSplit, reserveOf, sameDayNextMonth, weeksInCycle } from "./monthly-needs";

const need = (id: string, label: string, min: number, max: number, extra: Partial<MonthlyNeed> = {}): MonthlyNeed => ({ id, label, category: label, cadence: "monthly", min, max, priority: "fixed", ...extra });

/** Familia din exemplu: eu 4.700 pe 10, soția 2.800 pe 12, tichete pe card separat. */
const family = (): AppData => {
  const data = createEmptyAppData();
  data.settings.members = [{ id: "eu", name: "Eu" }, { id: "sotia", name: "Soția" }];
  data.settings.paymentSources = [
    { id: "card", name: "Card", kind: "card", openingBalance: 0 },
    { id: "tichete", name: "Tichete", kind: "meal", openingBalance: 0 },
  ];
  data.settings.salaryPlan = {
    ...data.settings.salaryPlan,
    periodStart: "2026-09-10",
    nextPayday: "2026-10-10",
    allocations: [],
    incomes: [
      { id: "i-eu", memberId: "eu", label: "Salariul meu", amount: 4700, day: 10 },
      { id: "i-sotia", memberId: "sotia", label: "Salariul soției", amount: 2800, day: 12 },
    ],
    needs: [
      need("mancare", "Mâncare", 600, 600, { cadence: "weekly", priority: "flex" }),
      need("lumina", "Lumină", 300, 400),
      need("taxi", "Taxi", 500, 500, { priority: "flex" }),
      need("abonamente", "Abonamente", 300, 350),
      need("gradinita", "Grădiniță", 200, 250),
      need("rate", "Rate bănci", 1300, 1400),
      need("rate0", "Rate fără dobândă", 150, 300),
      need("apa", "Apă", 50, 100),
    ],
  };
  return data;
};
const income = (id: string, memberId: string, amount: number, date: string, sourceId = "card") => ({ id, title: "Salariu", amount, kind: "income" as const, category: "Venit", source: "Card", person: "", date, sourceId, memberId });

describe("săptămânile și zilele ciclului", () => {
  it("numără săptămânile care încep în ciclu: 4 sau 5, fără virgulă", () => {
    expect(weeksInCycle("2026-10-10", "2026-11-10")).toBe(5); // luni: 12, 19, 26 oct., 2, 9 nov.
    expect(weeksInCycle("2026-02-10", "2026-03-10")).toBe(4);
  });
  it("aceeași zi luna viitoare, fără să sară în luna de după", () => {
    expect(sameDayNextMonth("2026-01-31")).toBe("2026-02-28");
    expect(sameDayNextMonth("2026-10-10")).toBe("2026-11-10");
  });
  it("rezerva din interval: maximul implicit, media sau minimul la alegere", () => {
    expect(reserveOf({ min: 300, max: 400 })).toBe(400);
    expect(reserveOf({ min: 300, max: 400, reserve: "avg" })).toBe(350);
    expect(reserveOf({ min: 300, max: 400, reserve: "min" })).toBe(300);
  });
});

describe("repartizarea la salariu", () => {
  it("primul salariu acoperă obligațiile întâi, apoi mâncarea cât ajunge", () => {
    const data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s-eu");
    if (!split.ok) throw new Error(split.message);
    expect(split.weeks).toBe(5);
    const by = Object.fromEntries(split.lines.map((line) => [line.need.id, line]));
    // Obligații (maximul): 400 + 350 + 250 + 1.400 + 300 + 100 = 2.800.
    expect(["lumina", "abonamente", "gradinita", "rate", "rate0", "apa"].map((id) => by[id].amount)).toEqual([400, 350, 250, 1400, 300, 100]);
    expect(by.mancare).toMatchObject({ target: 3000, weeks: 5, amount: 1900, remaining: 1100 });
    expect(by.taxi).toMatchObject({ amount: 0, remaining: 500 });
    expect(split).toMatchObject({ covered: 4700, free: 0, uncovered: 1600 });
    expect(split.nextIncome).toMatchObject({ label: "Salariul soției", amount: 2800, date: "2026-10-12" });
  });

  it("al doilea salariu completează doar ce a rămas, iar restul e liber", () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10"), income("s-sotia", "sotia", 2800, "2026-10-12")];
    data = applyIncomeSplit(data, "s-eu").data;
    const split = proposeIncomeSplit(data, "s-sotia");
    if (!split.ok) throw new Error(split.message);
    const by = Object.fromEntries(split.lines.map((line) => [line.need.id, line]));
    expect(by.mancare).toMatchObject({ fundedBefore: 1900, amount: 1100, remaining: 0 });
    expect(by.taxi).toMatchObject({ amount: 500, remaining: 0 });
    expect(by.rate).toMatchObject({ fundedBefore: 1400, amount: 0 });
    expect(split).toMatchObject({ covered: 1600, free: 1200, uncovered: 0 });
    expect(split.nextIncome).toBeUndefined();

    data = applyIncomeSplit(data, "s-sotia").data;
    const envelope = (label: string) => data.settings.salaryPlan.allocations.find((item) => item.label === label);
    expect(envelope("Mâncare")).toMatchObject({ amount: 3000, weeklyPace: true });
    expect(envelope("Rate bănci")).toMatchObject({ amount: 1400, weeklyPace: false });
    expect(envelope("Taxi")?.amount).toBe(500);
  });

  it("luna următoare stabilește plicul din nou, nu adună peste luna trecută", () => {
    let data = family();
    data.transactions = [income("s1", "eu", 4700, "2026-10-10"), income("s2", "eu", 4700, "2026-11-10")];
    data = applyIncomeSplit(data, "s1").data;
    data = applyIncomeSplit(data, "s2").data;
    const rate = data.settings.salaryPlan.allocations.find((item) => item.label === "Rate bănci");
    expect(rate?.amount).toBe(1400);
    // Luna nouă, primul venit: ciclul pornește din ziua lui, după ce planul vechi s-a încheiat.
    expect(data.settings.salaryPlan).toMatchObject({ periodStart: "2026-11-10", nextPayday: "2026-12-10" });
  });

  it("anularea pune la loc suma de dinainte a plicului", () => {
    let data = family();
    data.transactions = [income("s1", "eu", 4700, "2026-10-10"), income("s2", "eu", 4700, "2026-11-10")];
    data = applyIncomeSplit(data, "s1").data;
    const food = () => data.settings.salaryPlan.allocations.find((item) => item.label === "Mâncare")?.amount;
    expect(food()).toBe(1900);
    data = applyIncomeSplit(data, "s2").data;
    const second = data.settings.salaryPlan.salaryAllocationApplications!.find((item) => item.incomeId === "s2")!;
    data = revertSalaryAllocationApplication(data, second.id);
    expect(food()).toBe(1900);
  });

  it("la primul salariu, toate cheltuielile primesc plic, chiar cu 0 deocamdată", () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    data = applyIncomeSplit(data, "s-eu").data;
    expect(data.settings.salaryPlan.allocations.find((item) => item.label === "Taxi")).toMatchObject({ amount: 0, category: "Taxi" });
  });

  it("respectă cine plătește: grădinița doar din salariul soției", () => {
    const data = family();
    data.settings.salaryPlan.needs = data.settings.salaryPlan.needs!.map((item) => item.id === "gradinita" ? { ...item, payerId: "sotia" } : item);
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s-eu");
    if (!split.ok) throw new Error(split.message);
    expect(split.lines.find((line) => line.need.id === "gradinita")).toMatchObject({ amount: 0, remaining: 250, skipped: "other-payer" });
  });

  it("tichetele de masă nu intră în repartizare", () => {
    const data = family();
    data.transactions = [income("t", "eu", 800, "2026-10-05", "tichete")];
    expect(proposeIncomeSplit(data, "t")).toMatchObject({ ok: false, reason: "meal" });
    expect(pendingSplitIncome(data, "2026-10-06")).toBeUndefined();
  });

  it("propune doar venituri recente, nerepartizate, când există cheltuieli declarate", () => {
    const data = family();
    data.transactions = [income("vechi", "eu", 4700, "2026-09-10"), income("nou", "eu", 4700, "2026-10-10")];
    expect(pendingSplitIncome(data, "2026-10-11")?.id).toBe("nou");
    expect(pendingSplitIncome({ ...data, settings: { ...data.settings, salaryPlan: { ...data.settings.salaryPlan, needs: [] } } }, "2026-10-11")).toBeUndefined();
  });
});

describe("cheltuiala ajunge în plicul ei după ce scrii", () => {
  const withEnvelopes = () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10"), income("s-sotia", "sotia", 2800, "2026-10-12")];
    data = applyIncomeSplit(data, "s-eu").data;
    return applyIncomeSplit(data, "s-sotia").data;
  };
  const envelopeFor = (data: AppData, text: string) => allocationFromText(data, text, { memberId: "eu", sourceId: "card" })?.label;

  it("după numele plicului și după furnizorii știuți", () => {
    const data = withEnvelopes();
    expect(envelopeFor(data, "Taxi aeroport")).toBe("Taxi");
    expect(envelopeFor(data, "Bolt")).toBe("Taxi");
    expect(envelopeFor(data, "Grădiniță octombrie")).toBe("Grădiniță");
    expect(envelopeFor(data, "Enel factura")).toBe("Lumină");
    expect(envelopeFor(data, "Apa Nova")).toBe("Apă");
    expect(envelopeFor(data, "Netflix")).toBe("Abonamente");
    expect(envelopeFor(data, "Lidl")).toBe("Mâncare");
  });

  it("deosebește plicurile cu aceeași categorie: ratele la bancă de cele fără dobândă", () => {
    const data = withEnvelopes();
    expect(envelopeFor(data, "Rata BCR")).toBe("Rate bănci");
    expect(envelopeFor(data, "Rate TBI")).toBe("Rate fără dobândă");
    expect(envelopeFor(data, "rate fara dobanda frigider")).toBe("Rate fără dobândă");
  });

  it("nu ghicește din texte fără legătură", () => {
    const data = withEnvelopes();
    expect(envelopeFor(data, "Cadou Maria")).toBeUndefined();
    expect(envelopeFor(data, "ab")).toBeUndefined();
  });
});

describe("te-ai răzgândit", () => {
  it("anularea scoate plicurile create de repartizare, dacă n-au cheltuieli, și redeschide venitul", () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    data = applyIncomeSplit(data, "s-eu").data;
    const lumina = data.settings.salaryPlan.allocations.find((item) => item.label === "Lumină")!;
    // O cheltuială deja pusă pe Lumină: plicul acela rămâne, restul pleacă.
    data.transactions.push({ id: "enel", title: "Enel", amount: 380, kind: "expense", category: "Casă & facturi", source: "Card", person: "", date: "2026-10-11", sourceId: "card", memberId: "eu", allocationId: lumina.id });
    const application = data.settings.salaryPlan.salaryAllocationApplications![0];
    data = revertSalaryAllocationApplication(data, application.id);
    expect(data.settings.salaryPlan.allocations.map((item) => item.label)).toEqual(["Lumină"]);
    expect(data.settings.salaryPlan.allocations[0].amount).toBe(0);
    expect(pendingSplitIncome(data, "2026-10-11")?.id).toBe("s-eu");
  });
});
