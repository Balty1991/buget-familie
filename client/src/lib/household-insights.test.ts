import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { ageOfMoney, detectSubscriptions, formatWeeklyCheckInShare, householdActivity, lastDaysPulse, monthlyRecap, paydayTrack, recurringFromDetection, todayBrief, weeklyCheckIn } from "./household-insights";

const base = () => {
  const data = createEmptyAppData();
  const source = data.settings.paymentSources[0];
  source.openingBalance = 0;
  data.settings.members = [
    { id: "member-me", name: "Eu" },
    { id: "member-partner", name: "Soția" },
  ];
  return { data, source };
};

describe("analize de gospodărie", () => {
  it("calculează vârsta banilor ca medie ponderată FIFO între încasare și cheltuială", () => {
    const { data, source } = base();
    data.transactions = [
      { id: "in-1", title: "Salariu", amount: 2000, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-01" },
      { id: "out-1", title: "Chirie", amount: 1000, kind: "expense", category: "Casă & facturi", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-11" },
      { id: "out-2", title: "Alimente", amount: 1000, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-21" },
    ];
    expect(ageOfMoney(data, "2026-07-31")).toMatchObject({ days: 15, sampleAmount: 2000, unfundedAmount: 0 });
  });

  it("construiește recapitularea lunii cu categoria dominantă și comparația anterioară", () => {
    const { data, source } = base();
    data.transactions = [
      { id: "in-aug", title: "Salariu", amount: 4000, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-01" },
      { id: "out-aug-1", title: "Netflix", amount: 70, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-05" },
      { id: "out-aug-2", title: "Taxi", amount: 130, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-12" },
      { id: "in-jul", title: "Salariu", amount: 4000, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-01" },
      { id: "out-jul", title: "Taxi", amount: 80, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-10" },
    ];
    const recap = monthlyRecap(data, "2026-08");
    expect(recap).toMatchObject({ income: 4000, expense: 200, cashflow: 3800, priorExpense: 80, tone: "good" });
    expect(recap.topCategory).toEqual({ name: "Transport", amount: 130 });
  });

  it("împarte cheltuielile lunii pe membri, fără a crea colecții noi", () => {
    const { data, source } = base();
    data.transactions = [
      { id: "a", title: "Piață", amount: 300, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-04" },
      { id: "b", title: "Farmacie", amount: 100, kind: "expense", category: "Sănătate", sourceId: source.id, source: source.name, memberId: "member-partner", person: "Soția", date: "2026-08-06" },
    ];
    const activity = householdActivity(data, "2026-08");
    expect(activity.familyExpense).toBe(400);
    expect(activity.members.find((item) => item.memberId === "member-me")).toMatchObject({ expense: 300, share: 0.75 });
    expect(activity.members.find((item) => item.memberId === "member-partner")).toMatchObject({ expense: 100, share: 0.25 });
  });

  it("detectează un abonament lunar cu sumă stabilă și îl poate transforma în scadență", () => {
    const { data, source } = base();
    data.transactions = [
      { id: "n1", title: "Netflix", amount: 55, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-06-08" },
      { id: "n2", title: "Netflix", amount: 55, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-08" },
      { id: "n3", title: "Netflix", amount: 55, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-08" },
      { id: "food", title: "Kaufland", amount: 180, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-02" },
      { id: "food2", title: "Kaufland", amount: 210, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-09" },
    ];
    const hits = detectSubscriptions(data, "2026-08-20");
    expect(hits.map((item) => item.name)).toEqual(["Netflix"]);
    expect(hits[0]).toMatchObject({ amount: 55, confidence: "high", category: "Abonamente" });
    const draft = recurringFromDetection(data, hits[0]);
    expect(draft).toMatchObject({ name: "Netflix", amount: 55, dueDay: 8, autoPost: false, sourceId: source.id });
  });

  it("nu propune din nou un abonament deja urmărit ca scadență", () => {
    const { data, source } = base();
    data.recurring = [{ id: "rec-1", name: "Netflix", amount: 55, category: "Abonamente", sourceId: source.id, memberId: "member-me", dueDay: 8, active: true }];
    data.transactions = [
      { id: "n1", title: "Netflix", amount: 55, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-06-08" },
      { id: "n2", title: "Netflix", amount: 55, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-07-08" },
      { id: "n3", title: "Netflix", amount: 55, kind: "expense", category: "Abonamente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-08" },
    ];
    expect(detectSubscriptions(data, "2026-08-20")).toEqual([]);
  });

  it("desenează pulsul pe 7 zile și pune astăzi la capăt", () => {
    const { data, source } = base();
    data.transactions = [
      { id: "e1", title: "Pâine", amount: 20, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-31" },
      { id: "e0", title: "Taxi", amount: 40, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-25" },
    ];
    const pulse = lastDaysPulse(data, 7, "2026-08-31");
    expect(pulse).toHaveLength(7);
    expect(pulse[0].date).toBe("2026-08-25");
    expect(pulse[0].expense).toBe(40);
    expect(pulse[6]).toMatchObject({ date: "2026-08-31", expense: 20, isToday: true });
  });

  it("desenează pista până la venit între începutul ciclului și nextPayday", () => {
    const { data } = base();
    data.settings.salaryPlan.periodStart = "2026-08-01";
    data.settings.salaryPlan.nextPayday = "2026-08-31";
    expect(paydayTrack(data, "2026-08-16")).toMatchObject({ total: 31, elapsed: 16, remaining: 15 });
  });

  it("calculează cât poți cheltui azi ca minimul dintre ritmul sigur și lichidul pe zilele rămase", () => {
    const { data, source } = base();
    source.openingBalance = 3100;
    data.settings.salaryPlan.periodStart = "2026-08-01";
    data.settings.salaryPlan.nextPayday = "2026-08-31";
    const brief = todayBrief(data, "2026-08-16");
    expect(brief.hasPayday).toBe(true);
    expect(brief.spendable).toBeGreaterThan(100);
    expect(brief.spendable).toBeLessThanOrEqual(3100 / 16);
    expect(brief.dues).toEqual([]);
  });

  it("pune scadențele din următoarele 7 zile în briefingul de azi", () => {
    const { data, source } = base();
    data.settings.salaryPlan.periodStart = "2026-08-01";
    data.settings.salaryPlan.nextPayday = "2026-08-31";
    data.recurring = [{ id: "rec-chirie", name: "Chirie", amount: 1200, category: "Casă & facturi", sourceId: source.id, memberId: "member-me", dueDay: 20, active: true }];
    const brief = todayBrief(data, "2026-08-16");
    expect(brief.dues).toEqual([expect.objectContaining({ name: "Chirie", amount: 1200, dueDate: "2026-08-20", confirmable: true })]);
  });

  it("construiește bilanțul săptămânii luni–duminică, cu plicuri planificat vs realizat", () => {
    const { data, source } = base();
    data.settings.familyName = "Casa Vanzo";
    data.settings.salaryPlan.periodStart = "2026-08-03";
    data.settings.salaryPlan.nextPayday = "2026-08-30";
    data.settings.salaryPlan.allocations = [
      { id: "al-food", label: "Alimente", amount: 400, category: "Alimente", weeklyPace: false, alertThreshold: 80 },
      { id: "al-taxi", label: "Taxi", amount: 200, category: "Transport", weeklyPace: false, alertThreshold: 80 },
    ];
    data.transactions = [
      { id: "in", title: "Avans", amount: 500, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-24" },
      { id: "food", title: "Lidl", amount: 180, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-25", allocationId: "al-food" },
      { id: "taxi", title: "Bolt", amount: 30, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-partner", person: "Soția", date: "2026-08-26", allocationId: "al-taxi" },
      { id: "old", title: "În afara săptămânii", amount: 900, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-08-10", allocationId: "al-food" },
    ];
    const check = weeklyCheckIn(data, "2026-08-28");
    expect(check.start).toBe("2026-08-24");
    expect(check.end).toBe("2026-08-30");
    expect(check.income).toBe(500);
    expect(check.expense).toBe(210);
    expect(check.shouldPrompt).toBe(true);
    const food = check.envelopes.find((item) => item.id === "al-food");
    const taxi = check.envelopes.find((item) => item.id === "al-taxi");
    expect(food).toMatchObject({ spent: 180, planned: 100, state: "over" });
    expect(taxi).toMatchObject({ spent: 30, planned: 50, state: "healthy" });
    expect(check.members.find((item) => item.memberId === "member-me")?.expense).toBe(180);
    expect(check.members.find((item) => item.memberId === "member-partner")?.expense).toBe(30);
    expect(check.nextStep).toMatch(/Alimente/);
    const share = formatWeeklyCheckInShare(check);
    expect(share).toContain("Casa Vanzo");
    expect(share).toContain("Alimente");
    expect(share).toContain("Următorul pas");
  });

  it("nu cere bilanțul în mijlocul săptămânii și rămâne gol fără mișcări", () => {
    const { data } = base();
    expect(weeklyCheckIn(data, "2026-08-31")).toMatchObject({ shouldPrompt: false, tone: "empty", transactionCount: 0 });
  });
});
