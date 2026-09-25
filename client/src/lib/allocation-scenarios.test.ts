/**
 * Audit pe repartizare și înregistrări — scenariile reale din casă, nu cazuri abstracte.
 *
 * Firul pe care s-a rupt aplicația: venit 500 → plic Alimente 250/săpt. × 2 →
 * taxi 20. Aici verificăm că plicul, săptămânile, soldul și ghidul rămân aliniate.
 */
import { describe, expect, it } from "vitest";
import {
  adoptOutsideExpenses,
  allocationStatus,
  allocationWeeksStatus,
  createEmptyAppData,
  envelopeDecisionStatus,
  isoToday,
  planAllocationMath,
  planEndDate,
  planWeeklyCycle,
  plannedEnvelopeReserved,
  sourceBalance,
  sourceFreeBalance,
  transferBetweenEnvelopes,
  transferBetweenWeeks,
  type AppData,
} from "./finance-data";
import { calendarBudget } from "./calendar-budget";
import { parseAssistantMessage } from "./assistant-intents";
import { emptyGuideMemory, expenseProposal, understand, decide, buildExpenseOffer } from "./understand";
import { levelStartedWeek } from "./started-week";

const me = "member-me";

const house = (): AppData => {
  const data = createEmptyAppData();
  data.settings.paymentSources = [{ id: "card", name: "Card debit", kind: "card", memberId: me, openingBalance: 0 }];
  data.settings.salaryPlan.periodStart = "2026-09-12";
  data.settings.salaryPlan.nextPayday = "2026-09-25";
  data.settings.salaryPlan.sourceIds = ["card"];
  return data;
};

const addIncome = (data: AppData, amount = 500, date = "2026-09-13") => {
  data.transactions.push({
    id: `in-${amount}`, title: "Venit rapid", amount, kind: "income", category: "Venit",
    source: "Card debit", sourceId: "card", person: "Eu", memberId: me, date,
  });
};

const addEnvelope = (data: AppData, amount = 500) => {
  data.settings.salaryPlan.allocations = [{
    id: "env-food", label: "Alimente", category: "Alimente", amount, sourceId: "card", memberId: me, weeklyPace: true,
  }];
};

const addExpense = (data: AppData, amount: number, extra: Partial<AppData["transactions"][number]> = {}) => {
  data.transactions.push({
    id: extra.id || `ex-${amount}-${data.transactions.length}`,
    title: extra.title || "Taxi",
    amount,
    kind: "expense",
    category: extra.category || "Transport",
    source: "Card debit",
    sourceId: "card",
    person: "Eu",
    memberId: me,
    date: extra.date || "2026-09-13",
    allocationId: extra.allocationId,
    outsideChosen: extra.outsideChosen,
  });
};

describe("scenariul casei: 500 lei, plic Alimente pe 2 săptămâni", () => {
  it("împarte 500 pe 2 săptămâni de 250, fără să creeze un nume-gunoi", () => {
    const [intent] = parseAssistantMessage("Împarte cei 500 disponibili în plicuri de alimente pe 2 săptămâni", { asOf: "2026-09-13" });
    expect(intent.intent).toMatchObject({ kind: "envelope", label: "Alimente", amount: 500, weeklyLimit: 250, weeklyPace: true });
  });

  it("după venit și plic, totul e așezat: 500 în plic, 0 nerepartizați", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    const math = planAllocationMath(data);
    expect(math.availableSources).toBe(500);
    expect(math.allocated).toBe(500);
    expect(math.reservedInEnvelopes).toBe(500);
    expect(math.unrepartized).toBe(0);
    const end = planEndDate(data.settings.salaryPlan)!;
    const cycle = calendarBudget(500, data.settings.salaryPlan.periodStart, end)!;
    expect(cycle.weeks).toHaveLength(2);
    expect(cycle.weeks.map((week) => week.amount)).toEqual([250, 250]);
  });

  it("ghidul nu oferă „nealocat” și lasă alegerea săptămânii", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    const out = expenseProposal("cheltuieli taxi 20 lei", undefined, data, emptyGuideMemory(), true);
    const labels = out!.choices.map((item) => item.label);
    expect(labels.join(" ")).not.toMatch(/nealocat/i);
    expect(labels.some((label) => /S1/.test(label))).toBe(true);
    expect(labels.some((label) => /S2/.test(label))).toBe(true);
    expect(out!.choices.every((item) => item.update.kind === "expense" && item.update.allocationId === "env-food")).toBe(true);
  });

  it("drumul real din ghid (intents de la model sau expense local) tot nu oferă nealocat", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    const { winner } = decide(understand("cheltuieli taxi 20 lei", data, { asOf: "2026-09-13" }));
    expect(["expense", "intents"]).toContain(winner?.kind);
    const fromIntent = winner?.kind === "intents" && winner.intents[0].intent.kind === "expense"
      ? winner.intents[0].intent
      : { amount: 20, title: "Taxi", category: "Transport", date: "2026-09-13" };
    const offer = winner?.kind === "expense" ? winner.proposal : buildExpenseOffer(data, fromIntent, emptyGuideMemory());
    const labels = offer.choices.map((item) => item.label).join(" | ");
    expect(labels).not.toMatch(/nealocat|afara/i);
    expect(labels).toMatch(/Alimente · S1/);
    expect(labels).toMatch(/Alimente · S2/);
    expect(offer.choices[0].update.kind === "expense" && offer.choices[0].update.allocationId).toBe("env-food");
    /**
     * Prima alegere ia tranșa zilei de azi, nu tranșa numărul 1: scris ca număr fix,
     * testul pica singur în ziua în care perioada fixture-ului intra în a doua săptămână.
     */
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    const today = isoToday();
    const currentWeek = weeks.find((week) => today >= week.start && today <= week.end) || weeks[0];
    expect(offer.choices[0].update.kind === "expense" && offer.choices[0].update.fromWeekIndex).toBe(currentWeek.index);
  });

  it("la o cheltuială din S2, Confirmă pe toate ia S2, nu prima săptămână cu bani", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    const offer = buildExpenseOffer(data, { amount: 20, title: "Taxi", category: "Transport", date: "2026-09-20" }, emptyGuideMemory());
    expect(offer.choices[0].update.kind === "expense" && offer.choices[0].update.fromWeekIndex).toBe(2);
    expect(offer.choices.some((item) => item.update.kind === "expense" && item.update.fromWeekIndex === 1)).toBe(true);
    expect(offer.choices[0].label).toMatch(/S2/);
  });

  it("taxi 20 din S1: card 480, plic 480, nerepartizați 0 — nu „peste disponibil”", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    addExpense(data, 20, { allocationId: "env-food", date: "2026-09-13" });
    const food = data.settings.salaryPlan.allocations[0];
    expect(sourceBalance(data, "card")).toBe(480);
    expect(allocationStatus(data, food)).toMatchObject({ budget: 500, spent: 20, remaining: 480 });
    expect(planAllocationMath(data).unrepartized).toBe(0);
    expect(planAllocationMath(data).allocated).toBe(500);
    const weeks = allocationWeeksStatus(data, food);
    expect(weeks[0]).toMatchObject({ index: 1, spent: 20, remaining: 230 });
    expect(weeks[1]).toMatchObject({ index: 2, spent: 0, remaining: 250 });
    const remainingById = { "env-food": 480 };
    const reserved = plannedEnvelopeReserved(data.settings.salaryPlan.allocations, remainingById, { "env-food": 500 });
    expect(reserved).toBe(480);
    expect(planAllocationMath(data).availableSources - reserved).toBe(0);
  });

  it("taxi înregistrat greșit „în afara” intra în singurul plic", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    addExpense(data, 20, { allocationId: "outside" });
    expect(planAllocationMath(data).unrepartized).toBe(-20);
    const next = adoptOutsideExpenses(data);
    expect(next.transactions.find((item) => item.title === "Taxi")?.allocationId).toBe("env-food");
    expect(planAllocationMath(next).unrepartized).toBe(0);
    expect(allocationStatus(next, next.settings.salaryPlan.allocations[0]).remaining).toBe(480);
    expect(adoptOutsideExpenses(next)).toBe(next);
  });

  it("mutarea din S2 în S1 apoi cheltuiala acoperă săptămâna curentă", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    const moved = transferBetweenWeeks(data, { allocationId: "env-food", fromWeekIndex: 2, toWeekIndex: 1, amount: 20 })!;
    addExpense(moved, 20, { allocationId: "env-food", date: "2026-09-13" });
    const weeks = allocationWeeksStatus(moved, moved.settings.salaryPlan.allocations[0]);
    expect(weeks[0]).toMatchObject({ index: 1, budget: 270, spent: 20, remaining: 250 });
    expect(weeks[1]).toMatchObject({ index: 2, budget: 230, spent: 0, remaining: 230 });
    expect(planAllocationMath(moved).unrepartized).toBe(0);
  });

  it("restul din ghid urmărește plicul după transfer, nu doar suma scrisă", () => {
    const data = house();
    addIncome(data, 900);
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 500, sourceId: "card", memberId: me, weeklyPace: true },
      { id: "env-house", label: "Casă", category: "Casă & facturi", amount: 400, sourceId: "card", memberId: me, weeklyPace: false },
    ];
    const moved = transferBetweenEnvelopes(data, { fromAllocationId: "env-house", toAllocationId: "env-food", amount: 100 })!;
    const allocations = moved.settings.salaryPlan.allocations;
    const remainingById = Object.fromEntries(allocations.map((item) => [item.id, Math.max(0, allocationStatus(moved, item).remaining)]));
    const draft = Object.fromEntries(allocations.map((item) => [item.id, item.amount]));
    const reserved = plannedEnvelopeReserved(allocations, remainingById, draft);
    const math = planAllocationMath(moved);
    expect(math.reservedInEnvelopes).toBe(900);
    expect(reserved).toBe(900);
    expect(math.availableSources - math.scheduled - reserved).toBeCloseTo(math.unrepartized, 2);
  });
});

describe("mai multe plicuri și înregistrări", () => {
  it("taxi-ul se duce în plicul de Transport, nu în Alimente", () => {
    const data = house();
    addIncome(data, 800);
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 500, sourceId: "card", memberId: me, weeklyPace: true },
      { id: "env-trans", label: "Transport", category: "Transport", amount: 300, sourceId: "card", memberId: me, weeklyPace: true },
    ];
    addExpense(data, 20, { allocationId: "outside", category: "Transport" });
    const next = adoptOutsideExpenses(data);
    expect(next.transactions.at(-1)?.allocationId).toBe("env-trans");
    expect(allocationStatus(next, next.settings.salaryPlan.allocations[0]).remaining).toBe(500);
    expect(allocationStatus(next, next.settings.salaryPlan.allocations[1]).remaining).toBe(280);
    expect(planAllocationMath(next).unrepartized).toBe(0);
  });

  it("o cheltuială fără plic potrivit rămâne în afara, dacă sunt mai multe plicuri", () => {
    const data = house();
    addIncome(data, 800);
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 500, sourceId: "card", memberId: me },
      { id: "env-house", label: "Casă", category: "Casă & facturi", amount: 300, sourceId: "card", memberId: me },
    ];
    addExpense(data, 20, { allocationId: "outside", category: "Sănătate", title: "Farmacie" });
    expect(adoptOutsideExpenses(data).transactions.at(-1)?.allocationId).toBe("outside");
    expect(planAllocationMath(data).unrepartized).toBe(-20);
  });

  it("dacă a rămas nealocat, ghidul îl arată cu suma liberă, nu cu tot soldul cardului", () => {
    const data = house();
    addIncome(data, 500);
    addEnvelope(data, 300);
    const out = expenseProposal("cheltuieli taxi 20 lei", undefined, data, emptyGuideMemory(), true);
    const free = out!.choices.find((item) => /nealocat/.test(item.label));
    expect(free?.label).toMatch(/200/);
    expect(free?.label).not.toMatch(/500/);
    expect(planAllocationMath(data).unrepartized).toBe(200);
  });

  it("cheltuiala din plic nu schimbă marja nerepartizată", () => {
    const data = house();
    addIncome(data, 500);
    addEnvelope(data, 300);
    expect(planAllocationMath(data).unrepartized).toBe(200);
    addExpense(data, 40, { allocationId: "env-food", category: "Alimente", title: "Lidl" });
    expect(sourceBalance(data, "card")).toBe(460);
    expect(allocationStatus(data, data.settings.salaryPlan.allocations[0]).remaining).toBe(260);
    expect(planAllocationMath(data).unrepartized).toBe(200);
  });

  it("scadența rezervată scade din ce poți așeza, fără să mănânce plicul", () => {
    const data = house();
    addIncome(data, 500);
    addEnvelope(data, 400);
    data.recurring = [{ id: "net", name: "Netflix", amount: 50, dueDay: 20, category: "Abonamente", sourceId: "card", memberId: me, active: true, autoPost: false }];
    const math = planAllocationMath(data);
    expect(math.scheduled).toBe(50);
    expect(math.reservedInEnvelopes).toBe(400);
    expect(math.unrepartized).toBe(50);
  });
});

describe("ritmul săptămânal nu se amestecă cu totalul plicului", () => {
  it("o săptămână depășită nu strică restul ciclului", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    addExpense(data, 300, { allocationId: "env-food", category: "Alimente", title: "Lidl", date: "2026-09-13" });
    const food = data.settings.salaryPlan.allocations[0];
    const weeks = allocationWeeksStatus(data, food);
    expect(weeks[0].remaining).toBe(-50);
    expect(weeks[1].remaining).toBe(250);
    expect(allocationStatus(data, food).remaining).toBe(200);
    const shown = envelopeDecisionStatus(data, food, "2026-09-13");
    expect(shown.scope).toBe("week");
    expect(shown.remaining).toBe(-50);
    expect(planAllocationMath(data).unrepartized).toBe(0);
  });

  it("plicul fără ritm săptămânal se citește pe tot ciclul", () => {
    const data = house();
    addIncome(data);
    data.settings.salaryPlan.allocations = [{
      id: "env-flex", label: "Taxi ocazional", category: "Transport", amount: 500, sourceId: "card", memberId: me, weeklyPace: false,
    }];
    addExpense(data, 20, { allocationId: "env-flex", category: "Transport" });
    const shown = envelopeDecisionStatus(data, data.settings.salaryPlan.allocations[0], "2026-09-13");
    expect(shown.scope).toBe("cycle");
    expect(shown.remaining).toBe(480);
    expect(planAllocationMath(data).unrepartized).toBe(0);
  });

  it("două cheltuieli în S1 se adună, S2 rămâne intact", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    addExpense(data, 30, { id: "a", allocationId: "env-food", category: "Alimente", title: "Pâine", date: "2026-09-13" });
    addExpense(data, 20, { id: "b", allocationId: "env-food", category: "Alimente", title: "Lapte", date: "2026-09-14" });
    const weeks = allocationWeeksStatus(data, data.settings.salaryPlan.allocations[0]);
    expect(weeks[0]).toMatchObject({ spent: 50, remaining: 200 });
    expect(weeks[1]).toMatchObject({ spent: 0, remaining: 250 });
    expect(planAllocationMath(data).unrepartized).toBe(0);
  });

  it("la mijlocul ciclului, plicul rezervă tot, nu doar săptămâna curentă", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [{ id: "cash", name: "Cash", kind: "cash", memberId: me, openingBalance: 1800 }];
    data.settings.salaryPlan.periodStart = "2026-09-14";
    data.settings.salaryPlan.nextPayday = "2026-10-10";
    data.settings.salaryPlan.sourceIds = ["cash"];
    data.settings.salaryPlan.joinedMidCycle = true;
    data.settings.salaryPlan.allocations = [{
      id: "env-food", label: "Alimente", category: "Alimente", amount: 1950, sourceId: "cash", memberId: me, weeklyPace: true,
    }];
    const calendar = calendarBudget(1950, "2026-09-14", "2026-10-10")!;
    const first = calendar.weeks[0];
    const last = calendar.weeks[calendar.weeks.length - 1];
    const delta = Math.round((first.amount - 150) * 100) / 100;
    if (delta > 0.5) {
      data.settings.salaryPlan.weekTransfers = [{
        id: "wt-mid", allocationId: "env-food", fromWeekIndex: first.index, toWeekIndex: last.index, amount: delta, createdAt: "2026-09-16T12:00:00.000Z",
      }];
    }
    const math = planAllocationMath(data);
    expect(math.availableSources).toBe(1800);
    expect(math.allocated).toBe(1950);
    expect(math.reservedInEnvelopes).toBe(1950);
    expect(math.unrepartized).toBeCloseTo(-150, 0);
  });

  it("la mijlocul ciclului, fără plicuri, tot cash-ul rămâne nerepartizat", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [
      { id: "cash", name: "Cash", kind: "cash", memberId: me, openingBalance: 1800 },
      { id: "card", name: "Card debit", kind: "card", memberId: me, openingBalance: 0 },
      { id: "meal", name: "Bonuri de masă", kind: "meal", memberId: me, openingBalance: 0 },
    ];
    data.settings.salaryPlan.periodStart = "2026-09-14";
    data.settings.salaryPlan.nextPayday = "2026-10-10";
    data.settings.salaryPlan.sourceIds = [];
    data.settings.salaryPlan.joinedMidCycle = true;
    data.settings.salaryPlan.allocations = [];
    const math = planAllocationMath(data);
    expect(math.availableSources).toBe(1800);
    expect(math.allocated).toBe(0);
    expect(math.reservedInEnvelopes).toBe(0);
    expect(math.unrepartized).toBe(1800);
  });

  it("1.850 alocați de joi scad tot plicul, iar S1 ține doar zilele rămase", () => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [
      { id: "cash", name: "Cash", kind: "cash", memberId: me, openingBalance: 1800 },
      { id: "angi", name: "Cash · Angi", kind: "cash", openingBalance: 450 },
    ];
    data.settings.salaryPlan.periodStart = "2026-09-14";
    data.settings.salaryPlan.nextPayday = "2026-10-10";
    data.settings.salaryPlan.sourceIds = ["cash", "angi"];
    data.settings.salaryPlan.joinedMidCycle = true;
    data.settings.salaryPlan.allocations = [{
      id: "env-food", label: "Alimente", category: "Alimente", amount: 1850, sourceId: "cash", memberId: me, weeklyPace: true,
      funding: [{ sourceId: "angi", amount: 50 }],
    }];
    const leveled = levelStartedWeek(data, "env-food", "2026-09-17");
    const math = planAllocationMath(leveled);
    expect(math.availableSources).toBe(2250);
    expect(math.allocated).toBe(1850);
    expect(math.reservedInEnvelopes).toBe(1850);
    expect(math.unrepartized).toBe(400);
    const weeks = allocationWeeksStatus(leveled, leveled.settings.salaryPlan.allocations[0]);
    expect(weeks[0].budget).toBeCloseTo(308, 0);
    const later = weeks.slice(1).reduce((sum, week) => sum + week.budget, 0);
    expect(later).toBeCloseTo(1542, 0);
    const cycle = planWeeklyCycle(leveled)!;
    expect(cycle.weeks[0].amount).toBeCloseTo(308, 0);
    expect(cycle.total).toBeCloseTo(1850, 0);
    expect(sourceFreeBalance(leveled, "cash").reserved).toBe(1800);
    expect(sourceFreeBalance(leveled, "cash").free).toBe(0);
    expect(sourceFreeBalance(leveled, "angi").reserved).toBe(50);
    expect(sourceFreeBalance(leveled, "angi").free).toBe(400);
  });
});

/**
 * Banii puși deja într-un plic nu mai sunt „de repartizat”. Ecranul de plicuri îi arăta
 * a doua oară ca sold liber al sursei, deci o familie își repartiza aceiași lei de două ori.
 */
describe("banii liberi dintr-o sursă", () => {
  const twoPurses = (): AppData => {
    const data = createEmptyAppData();
    data.settings.paymentSources = [
      { id: "cash", name: "Cash", kind: "cash", memberId: me, openingBalance: 1800 },
      { id: "cash-angi", name: "Cash · Angi", kind: "cash", openingBalance: 300 },
    ];
    data.settings.salaryPlan.periodStart = "2026-09-14";
    data.settings.salaryPlan.nextPayday = "2026-10-12";
    data.settings.salaryPlan.allocations = [
      { id: "env-food", label: "Alimente", category: "Alimente", amount: 1800, sourceId: "cash", weeklyPace: true },
      { id: "env-taxi", label: "Taxi", category: "Transport", amount: 300, sourceId: "cash-angi", weeklyPace: false },
    ];
    return data;
  };

  it("scade din sold ce ține deja plicul plătit din sursa aceea", () => {
    const data = twoPurses();
    expect(sourceBalance(data, "cash")).toBe(1800);
    expect(sourceFreeBalance(data, "cash")).toEqual({ balance: 1800, reserved: 1800, free: 0 });
    expect(sourceFreeBalance(data, "cash-angi")).toEqual({ balance: 300, reserved: 300, free: 0 });
  });

  it("cheltuiala din plic eliberează sursa, pentru că banii au și plecat din ea", () => {
    const data = twoPurses();
    data.transactions.push({
      id: "ex-taxi", title: "Taxi", amount: 100, kind: "expense", category: "Transport",
      source: "Cash · Angi", sourceId: "cash-angi", person: "Eu", memberId: me, date: "2026-09-16", allocationId: "env-taxi",
    });
    expect(sourceFreeBalance(data, "cash-angi")).toEqual({ balance: 200, reserved: 200, free: 0 });
  });

  it("plicul editat își dă înapoi rezerva, altfel nu l-ai mai putea salva", () => {
    const data = twoPurses();
    expect(sourceFreeBalance(data, "cash", "env-food").free).toBe(1800);
    expect(sourceFreeBalance(data, "cash", "env-taxi").free).toBe(0);
  });

  it("scadențele neplătite din sursă intră tot în rezervă", () => {
    const data = twoPurses();
    data.settings.salaryPlan.allocations = [];
    data.recurring = [{
      id: "rec-net", name: "Internet", amount: 120, dueDay: 20, category: "Casă & facturi",
      sourceId: "cash", memberId: me, active: true,
    }];
    const free = sourceFreeBalance(data, "cash");
    expect(free.reserved).toBe(120);
    expect(free.free).toBe(1680);
  });
});

/** Mutarea între tranșe merge în ambele sensuri: și din S1 spre următoarele. */
describe("mutarea între săptămâni, în ambele sensuri", () => {
  it("scoate bani din prima săptămână spre a treia", () => {
    const data = house();
    addIncome(data, 500);
    addEnvelope(data, 500);
    const moved = transferBetweenWeeks(data, { allocationId: "env-food", fromWeekIndex: 1, toWeekIndex: 2, amount: 80 })!;
    const weeks = allocationWeeksStatus(moved, moved.settings.salaryPlan.allocations[0]);
    expect(weeks[0]).toMatchObject({ index: 1, budget: 170 });
    expect(weeks[1]).toMatchObject({ index: 2, budget: 330 });
    expect(planAllocationMath(moved).unrepartized).toBe(0);
  });

  it("nu poate trimite mai mult decât a rămas în săptămâna sursă", () => {
    const data = house();
    addIncome(data, 500);
    addEnvelope(data, 500);
    expect(transferBetweenWeeks(data, { allocationId: "env-food", fromWeekIndex: 1, toWeekIndex: 2, amount: 400 })).toBeUndefined();
  });
});

describe("„În afara plicurilor” ales de om", () => {
  it("rămâne în afara, iar cea implicită intră în plic cu updatedAt nou", () => {
    const data = house();
    addIncome(data);
    addEnvelope(data);
    addExpense(data, 20, { allocationId: "outside", outsideChosen: true, title: "Cadou" });
    addExpense(data, 15, { allocationId: "outside", title: "Taxi" });
    const next = adoptOutsideExpenses(data);
    expect(next.transactions.find((item) => item.title === "Cadou")?.allocationId).toBe("outside");
    const taxi = next.transactions.find((item) => item.title === "Taxi");
    expect(taxi?.allocationId).toBe("env-food");
    expect(taxi?.updatedAt).toBeTruthy();
  });
});

describe("sursa spusă în frază", () => {
  it("tichetele și cardul Anei ajung în propunere", async () => {
    const { hintedSource } = await import("./understand");
    const data = createEmptyAppData();
    data.settings.members = [{ id: "eu", name: "Andrei" }, { id: "ana", name: "Ana" }];
    data.settings.paymentSources = [
      { id: "c-eu", name: "Card Andrei", kind: "card", memberId: "eu", openingBalance: 500 },
      { id: "c-ana", name: "Card Ana", kind: "card", memberId: "ana", openingBalance: 500 },
      { id: "tichete", name: "Bonuri de masă", kind: "meal", openingBalance: 400 },
    ];
    expect(hintedSource(data, "card", "Anei")?.id).toBe("c-ana");
    expect(hintedSource(data, "meal")?.id).toBe("tichete");
    const offer = buildExpenseOffer(data, { amount: 80, title: "Kaufland", category: "Alimente", date: "2026-09-20", sourceHint: "meal" }, emptyGuideMemory());
    expect(offer.choices.every((choice) => choice.update?.kind === "expense" && choice.update.sourceId === "tichete")).toBe(true);
  });
});
