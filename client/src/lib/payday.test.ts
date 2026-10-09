import { afterEach, describe, expect, it, vi } from "vitest";
import { addIsoDays, allocationWeeksStatus, commitLedgerEntry, planAllocationMath, type AppData } from "./finance-data";
import { applyPayday, proposePayday, summarizePayday } from "./payday";
import { CARD, FOOD, MEAL, ME, PAYDAY, PERIOD_START, TAXI, familyAtPayday, liveOneDay, seeded } from "./__fixtures__/family-month";
import { atNoon, checkInvariants } from "./__fixtures__/invariants";

afterEach(() => { vi.useRealTimers(); });

/** Luna din fixture trăită până în ajunul salariului. */
const monthLived = (seed = 21) => {
  const random = seeded(seed);
  let data = familyAtPayday();
  for (let day = PERIOD_START; day < PAYDAY; day = addIsoDays(day, 1)) {
    atNoon(day);
    data = liveOneDay(data, day, random);
  }
  return data;
};

describe("A intrat salariul: propunerea", () => {
  it("pleacă de la luna trecută: același salariu și aceleași tichete, plicul de alimente cu 600 pe săptămână", () => {
    const data = monthLived();
    atNoon(PAYDAY);
    const proposal = proposePayday(data, PAYDAY);
    expect(proposal.nextPayday).toBe("2026-12-09");
    expect(proposal.incomes.map((item) => [item.sourceId, item.amount])).toEqual([[CARD, 4300], [MEAL, 990]]);
    const food = proposal.envelopes.find((item) => item.allocationId === FOOD)!;
    expect(food.weekly).toBe(600);
    // 9 noiembrie – 9 decembrie, cu ambele capete, ca plicurile făcute din Plan: 600 × 31 / 7.
    expect(food.amount).toBe(Math.round(600 * 31 / 7));
    expect(proposal.envelopes.find((item) => item.allocationId === TAXI)).toMatchObject({ amount: 500 });
    expect(proposal.envelopes.find((item) => item.allocationId === TAXI)?.weekly).toBeUndefined();
  });

  it("alocația de pe același card intră și ea; voucherul de 40 de lei nu e venit de lună", () => {
    let data = monthLived();
    atNoon(PAYDAY);
    const income = (id: string, title: string, amount: number, date: string) => commitLedgerEntry(data, { id, title, amount, kind: "income", category: "Venit", sourceId: CARD, source: "Card Ion", memberId: ME, person: "Ion", date });
    data = income("aloc", "Alocație", 292, "2026-10-08");
    data = income("sgr", "Voucher SGR", 40.5, "2026-10-08");
    const proposal = proposePayday(data, PAYDAY);
    expect(proposal.incomes.map((item) => [item.title, item.amount])).toEqual([["Salariu Ion", 4300], ["Tichete Ion", 990], ["Alocație", 292]]);
  });

  it("salariul notat deja azi din Notează nu se mai adaugă o dată", () => {
    let data = monthLived();
    atNoon(PAYDAY);
    data = commitLedgerEntry(data, { id: "already", title: "Salariu noiembrie", amount: 4410, kind: "income", category: "Venit", sourceId: CARD, source: "Card Ion", memberId: ME, person: "Ion", date: PAYDAY });
    const proposal = proposePayday(data, PAYDAY);
    expect(proposal.incomes[0]).toMatchObject({ amount: 4410, notedId: "already" });
    const after = applyPayday(data, proposal);
    expect(after.transactions.filter((item) => item.kind === "income" && item.date === PAYDAY && item.sourceId === CARD)).toHaveLength(1);
    expect(after.transactions.filter((item) => item.kind === "income" && item.date === PAYDAY && item.sourceId === MEAL)).toHaveLength(1);
  });

  it("salariul venit cu o zi mai devreme pornește tot luna până pe 9 decembrie", () => {
    const data = monthLived();
    const early = addIsoDays(PAYDAY, -1);
    atNoon(early);
    expect(proposePayday(data, early).nextPayday).toBe("2026-12-09");
  });

  it("prima lună în aplicație: un rând de salariu gol pe cardul tău", () => {
    const data = familyAtPayday();
    data.transactions = [];
    data.settings.salaryPlan = { ...data.settings.salaryPlan, periodStart: "", nextPayday: "", earliestPayday: undefined };
    atNoon("2026-10-09");
    const proposal = proposePayday(data, "2026-10-09");
    expect(proposal.incomes).toEqual([expect.objectContaining({ sourceId: CARD, amount: 0, memberId: ME })]);
  });
});

describe("A intrat salariul: după apăsare", () => {
  const paid = () => {
    const data = monthLived();
    atNoon(PAYDAY);
    const proposal = proposePayday(data, PAYDAY);
    return { before: data, proposal, after: applyPayday(data, proposal) };
  };

  it("perioada nouă, plicurile pe ea, istoricul lunii trecute păstrat", () => {
    const { before, after } = paid();
    const plan = after.settings.salaryPlan;
    expect(plan.periodStart).toBe(PAYDAY);
    expect(plan.nextPayday).toBe("2026-12-09");
    expect(plan.earliestPayday).toBe("2026-12-08");
    expect(plan.transfers).toEqual([]);
    expect(plan.weekTransfers).toEqual([]);
    expect(plan.cycleMemory?.[0]).toMatchObject({ periodStart: PERIOD_START });
    // Mișcările lunii trecute rămân toate; se adaugă doar salariul și tichetele.
    expect(after.transactions.length).toBe(before.transactions.length + 2);
    const food = plan.allocations.find((item) => item.id === FOOD)!;
    expect(food.weeklyAmount).toBe(600);
    // Săptămânile întregi primesc exact 600.
    const weeks = allocationWeeksStatus(after, food);
    expect(weeks.filter((week) => week.days === 7).every((week) => week.budget === 600)).toBe(true);
  });

  it("cifrele de la final sunt chiar cele din Plan", () => {
    const { before, proposal, after } = paid();
    const summary = summarizePayday(before, proposal);
    const math = planAllocationMath(after);
    expect(summary.free).toBeCloseTo(math.unrepartized, 2);
    expect(summary.inSources - summary.inEnvelopes - summary.dues).toBeCloseTo(summary.free, 2);
    // Creditul lui Ion (30 nov) e de plătit; al Anei rămâne pe numele ei, neconfirmat de nimeni.
    expect(summary.duesList.find((item) => item.id === "debt-loan")).toMatchObject({ outside: false });
  });

  it("luna următoare, trăită zi cu zi, respectă toate regulile", () => {
    const { after } = paid();
    const random = seeded(77);
    let data: AppData = after;
    for (let day = PAYDAY; day < "2026-12-09"; day = addIsoDays(day, 1)) {
      atNoon(day);
      data = liveOneDay(data, day, random);
      checkInvariants(data, day);
    }
  });

  it("schimbi suma pe săptămână înainte de apăsare: plicul se reface din ea", () => {
    const data = monthLived();
    atNoon(PAYDAY);
    const proposal = proposePayday(data, PAYDAY);
    const edited = { ...proposal, envelopes: proposal.envelopes.map((item) => item.allocationId === FOOD ? { ...item, weekly: 700 } : item) };
    const food = applyPayday(data, edited).settings.salaryPlan.allocations.find((item) => item.id === FOOD)!;
    expect(food).toMatchObject({ weeklyAmount: 700, amount: Math.round(700 * 31 / 7) });
    // Tichetele (600) rămân completare; nu pot trece de plic.
    expect(food.funding).toEqual([{ sourceId: MEAL, amount: 600 }]);
  });
});
