import { describe, expect, it } from "vitest";
import { allocationFromText, createEmptyAppData, revertSalaryAllocationApplication, type AppData, type MonthlyNeed } from "./finance-data";
import { applyIncomeSplit, pendingSplitIncome, proposeIncomeSplit, reserveOf, sameDayNextMonth, cycleWeeks, weeklyTarget, nextPaydayAfter, rarePlan, pendingTransfers, markTransferDone } from "./monthly-needs";

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
  it("săptămâni întregi plus zilele rămase, fără virgulă", () => {
    expect(cycleWeeks("2026-10-10", "2026-11-10")).toEqual({ days: 32, weeks: 4, extraDays: 4 });
    expect(cycleWeeks("2026-02-10", "2026-03-09")).toEqual({ days: 28, weeks: 4, extraDays: 0 });
    // 600 pe fiecare săptămână întreagă, iar zilele rămase primesc partea lor rotundă.
    expect(weeklyTarget(600, { weeks: 4, extraDays: 4 })).toBe(2743);
    expect(weeklyTarget(600, { weeks: 4, extraDays: 0 })).toBe(2400);
  });
  it("următorul salariu după ziua declarată, chiar dacă acesta a venit devreme sau târziu", () => {
    expect(nextPaydayAfter("2026-10-10", 10)).toBe("2026-11-10");
    expect(nextPaydayAfter("2026-10-08", 10)).toBe("2026-11-10"); // a venit cu 2 zile mai devreme
    expect(nextPaydayAfter("2026-10-12", 10)).toBe("2026-11-10"); // a întârziat 2 zile
    expect(nextPaydayAfter("2026-09-30", 1)).toBe("2026-11-01"); // pe 1 oct. ar fi a doua zi
    expect(nextPaydayAfter("2026-11-02", 28)).toBe("2026-11-28");
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
    expect(split).toMatchObject({ weeks: 4, extraDays: 4 });
    const by = Object.fromEntries(split.lines.map((line) => [line.need.id, line]));
    // Obligații (maximul): 400 + 350 + 250 + 1.400 + 300 + 100 = 2.800.
    expect(["lumina", "abonamente", "gradinita", "rate", "rate0", "apa"].map((id) => by[id].amount)).toEqual([400, 350, 250, 1400, 300, 100]);
    expect(by.mancare).toMatchObject({ target: 2743, weeks: 4, extraDays: 4, perWeek: 600, amount: 1900, remaining: 843 });
    expect(by.taxi).toMatchObject({ amount: 0, remaining: 500 });
    expect(split).toMatchObject({ covered: 4700, free: 0, uncovered: 1343 });
    expect(split.nextIncome).toMatchObject({ label: "Salariul soției", amount: 2800, date: "2026-10-12" });
  });

  it("al doilea salariu completează doar ce a rămas, iar restul e liber", () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10"), income("s-sotia", "sotia", 2800, "2026-10-12")];
    data = applyIncomeSplit(data, "s-eu").data;
    const split = proposeIncomeSplit(data, "s-sotia");
    if (!split.ok) throw new Error(split.message);
    const by = Object.fromEntries(split.lines.map((line) => [line.need.id, line]));
    expect(by.mancare).toMatchObject({ fundedBefore: 1900, amount: 843, remaining: 0 });
    expect(by.taxi).toMatchObject({ amount: 500, remaining: 0 });
    expect(by.rate).toMatchObject({ fundedBefore: 1400, amount: 0 });
    expect(split).toMatchObject({ covered: 1343, free: 1457, uncovered: 0 });
    expect(split.nextIncome).toBeUndefined();

    data = applyIncomeSplit(data, "s-sotia").data;
    const envelope = (label: string) => data.settings.salaryPlan.allocations.find((item) => item.label === label);
    expect(envelope("Mâncare")).toMatchObject({ amount: 2743, weeklyAmount: 600, weeklyPace: true });
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

  it("salariul venit mai devreme păstrează data obișnuită a următorului, cu ± 3 zile", () => {
    let data = family();
    data.transactions = [income("s1", "eu", 4700, "2026-10-08")];
    data = applyIncomeSplit(data, "s1").data;
    expect(data.settings.salaryPlan).toMatchObject({ periodStart: "2026-10-08", nextPayday: "2026-11-10", paydayFlexDays: 3 });
  });

  it("data aleasă de mână pentru ciclul în curs are întâietate", () => {
    const data = family();
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "2026-10-10", nextPayday: "2026-11-13" };
    data.transactions = [income("s1", "eu", 4700, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s1");
    expect(split.ok && split.cycleEnd).toBe("2026-11-13");
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

describe("plățile rare în repartizare", () => {
  const withRare = () => {
    const data = family();
    data.settings.plannedEvents = [
      { id: "rca", name: "RCA", date: "2027-03-10", estimate: 1200, kind: "other", repeat: "yearly" },
      { id: "xmas", name: "Crăciun", date: "2026-12-25", estimate: 1500, kind: "holiday", repeat: "yearly", contributions: [{ id: "c0", amount: 300, date: "2026-09-01" }] },
    ];
    return data;
  };
  it("ce lipsește, împărțit pe lunile rămase, rotunjit la 10", () => {
    const plan = rarePlan(withRare(), "2026-10-10");
    // RCA: 1.200 în 151 de zile → ~240 pe lună; Crăciun: 1.200 lipsă în 76 de zile → ~480.
    expect(plan.events.map((item) => [item.event.id, item.perCycle])).toEqual([["rca", 240], ["xmas", 480]]);
    expect(plan.total).toBe(720);
  });
  it("vin după traiul lunii, iar al doilea salariu completează", () => {
    let data = withRare();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10"), income("s-sotia", "sotia", 2800, "2026-10-12")];
    const first = proposeIncomeSplit(data, "s-eu");
    if (!first.ok) throw new Error(first.message);
    expect(first.lines.at(-1)).toMatchObject({ need: { id: "rare" }, target: 720, amount: 0, remaining: 720 });
    data = applyIncomeSplit(data, "s-eu").data;
    const second = proposeIncomeSplit(data, "s-sotia");
    if (!second.ok) throw new Error(second.message);
    expect(second.lines.at(-1)).toMatchObject({ need: { id: "rare" }, amount: 720, remaining: 0 });
    data = applyIncomeSplit(data, "s-sotia").data;
    const saved = (id: string) => (data.settings.plannedEvents.find((item) => item.id === id)?.contributions || []).reduce((sum, item) => sum + item.amount, 0);
    expect([saved("rca"), saved("xmas")]).toEqual([240, 780]);
  });
  it("anularea scoate banii puși deoparte", () => {
    let data = withRare();
    data.transactions = [income("s-eu", "eu", 9000, "2026-10-10")];
    data = applyIncomeSplit(data, "s-eu").data;
    expect(data.settings.plannedEvents.find((item) => item.id === "rca")?.contributions?.length).toBe(1);
    const application = data.settings.salaryPlan.salaryAllocationApplications![0];
    data = revertSalaryAllocationApplication(data, application.id);
    expect(data.settings.plannedEvents.find((item) => item.id === "rca")?.contributions).toBeUndefined();
    expect(data.settings.plannedEvents.find((item) => item.id === "xmas")?.contributions?.length).toBe(1);
  });
});

describe("neprevăzutele, din ce rămâne liber", () => {
  it("vin ultimele și nu contează ca lipsă", () => {
    const data = family();
    data.settings.salaryPlan.needs = [...data.settings.salaryPlan.needs!, { id: "buf", label: "Neprevăzute", category: "Altele", cadence: "monthly", min: 400, max: 400, priority: "buffer" }];
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s-eu");
    if (!split.ok) throw new Error(split.message);
    expect(split.lines.at(-1)).toMatchObject({ need: { id: "buf" }, amount: 0, remaining: 400 });
    expect(split.uncovered).toBe(1343);
  });
  it("cu bani destui, primesc rezerva întreagă", () => {
    const data = family();
    data.settings.salaryPlan.needs = [...data.settings.salaryPlan.needs!, { id: "buf", label: "Neprevăzute", category: "Altele", cadence: "monthly", min: 400, max: 400, priority: "buffer" }];
    data.transactions = [income("s-eu", "eu", 9000, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s-eu");
    if (!split.ok) throw new Error(split.message);
    expect(split.lines.at(-1)).toMatchObject({ need: { id: "buf" }, amount: 400, remaining: 0 });
  });
});

describe("farmacia ajunge la neprevăzute", () => {
  it("Catena → plicul Neprevăzute, dacă nu există unul mai potrivit", async () => {
    const { allocationFromText } = await import("./finance-data");
    const data = family();
    data.settings.salaryPlan.allocations = [{ id: "n", label: "Neprevăzute", amount: 400, category: "Altele" }, { id: "m", label: "Mâncare", amount: 2400, category: "Alimente" }];
    expect(allocationFromText(data, "Catena 45 lei")?.id).toBe("n");
    expect(allocationFromText(data, "Lidl 120")?.id).toBe("m");
  });
});

describe("cine plătește", () => {
  it("grădinița plătită de soție, acoperită din salariul meu: propune transferul", () => {
    let data = family();
    data.settings.salaryPlan.needs = data.settings.salaryPlan.needs!.map((item) => item.id === "gradinita" || item.id === "apa" ? { ...item, paidById: "sotia" } : item);
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s-eu");
    if (!split.ok) throw new Error(split.message);
    expect(split.transfers).toEqual([{ toMemberId: "sotia", amount: 350, labels: ["Grădiniță", "Apă"] }]);
    data = applyIncomeSplit(data, "s-eu").data;
    expect(pendingTransfers(data, "2026-10-10")).toHaveLength(1);
    const application = data.settings.salaryPlan.salaryAllocationApplications![0];
    data = markTransferDone(data, application.id, "sotia");
    expect(pendingTransfers(data, "2026-10-10")).toEqual([]);
  });
  it("din salariul celui care plătește nu e nimic de trimis", () => {
    const data = family();
    data.settings.salaryPlan.needs = data.settings.salaryPlan.needs!.map((item) => item.id === "gradinita" ? { ...item, paidById: "eu" } : item);
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    const split = proposeIncomeSplit(data, "s-eu");
    expect(split.ok && split.transfers).toEqual([]);
  });
});

describe("anularea repartizării, după raportul QA", () => {
  it("anularea primului salariu, după al doilea, scade doar partea lui (BF-01)", () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10"), income("s-sotia", "sotia", 2800, "2026-10-12")];
    data = applyIncomeSplit(data, "s-eu").data;
    data = applyIncomeSplit(data, "s-sotia").data;
    const first = data.settings.salaryPlan.salaryAllocationApplications!.find((item) => item.incomeId === "s-eu")!;
    data = revertSalaryAllocationApplication(data, first.id);
    const envelope = (label: string) => data.settings.salaryPlan.allocations.find((item) => item.label === label);
    // Mâncarea rămâne cu partea soției (843), taxiul cu 500; ratele, acoperite doar de primul, pleacă.
    expect(envelope("Mâncare")?.amount).toBe(843);
    expect(envelope("Taxi")?.amount).toBe(500);
    expect(envelope("Rate bănci")).toBeUndefined();
  });
  it("a doua anulare nu mai scade nimic, iar repartizarea rămâne marcată", () => {
    let data = family();
    data.transactions = [income("s-eu", "eu", 4700, "2026-10-10")];
    data = applyIncomeSplit(data, "s-eu").data;
    const application = data.settings.salaryPlan.salaryAllocationApplications![0];
    data = revertSalaryAllocationApplication(data, application.id);
    const once = JSON.stringify(data.settings.salaryPlan.allocations);
    data = revertSalaryAllocationApplication(data, application.id);
    expect(JSON.stringify(data.settings.salaryPlan.allocations)).toBe(once);
    expect(data.settings.salaryPlan.salaryAllocationApplications![0].revertedAt).toBeTruthy();
    // După anulare, venitul poate fi repartizat din nou.
    expect(proposeIncomeSplit(data, "s-eu").ok).toBe(true);
  });
});
