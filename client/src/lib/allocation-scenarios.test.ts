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
  planAllocationMath,
  planEndDate,
  plannedEnvelopeReserved,
  sourceBalance,
  transferBetweenWeeks,
  type AppData,
} from "./finance-data";
import { calendarBudget } from "./calendar-budget";
import { parseAssistantMessage } from "./assistant-intents";
import { emptyGuideMemory, expenseProposal } from "./understand";

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
});
