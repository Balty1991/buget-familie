import { describe, expect, it } from "vitest";
import { createEmptyAppData } from "./finance-data";
import { ageOfMoney, analysisCompareWindow, detectSubscriptions, envelopeBurnPace, formatWeeklyCheckInShare, householdActivity, householdActivityInCycle, lastDaysPulse, monthlyRecap, paydayTrack, recurringFromDetection, safeSpendBreakdown, todayBrief, weeklyCheckIn, weeklyDigestHeadline, weeklyEnvelopeDailyRhythm } from "./household-insights";

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

  it("împarte restul plicului săptămânal egal pe zilele rămase, nu reperul până la salariu", () => {
    const { data, source } = base();
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-09-07",
      nextPayday: "2026-10-04",
      allocations: [{ id: "food", label: "Alimente", amount: 2400, category: "Alimente" }],
      transfers: [],
    };
    data.transactions = [
      { id: "lidl", title: "Lidl", amount: 225, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-09-07", allocationId: "food" },
      { id: "rent", title: "Chirie", amount: 1200, kind: "expense", category: "Casă & facturi", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-09-07", allocationId: "outside" },
    ];
    const monday = weeklyEnvelopeDailyRhythm(data, "2026-09-07");
    expect(monday.remaining).toBe(375);
    expect(monday.remainingDays).toBe(7);
    expect(monday.todayShare).toBe(85.71);
    expect(monday.todayLeft).toBe(0);
    expect(monday.futureShare).toBe(62.5);
    expect(monday.days[0]).toMatchObject({ day: "2026-09-07", left: 0, over: true, isToday: true });
    expect(monday.days.slice(1).map((item) => item.left)).toEqual([62.5, 62.5, 62.5, 62.5, 62.5, 62.5]);
    expect(monday.days.every((item) => item.out === 0 || item.day === "2026-09-07")).toBe(true);

    const wednesday = weeklyEnvelopeDailyRhythm(data, "2026-09-09");
    expect(wednesday.remainingDays).toBe(5);
    expect(wednesday.todayOut).toBe(0);
    expect(wednesday.todayShare).toBe(75);
    expect(wednesday.todayLeft).toBe(75);
    expect(wednesday.futureShare).toBe(75);
    expect(wednesday.days[0]).toMatchObject({ over: true, left: 0, isToday: false });
    expect(wednesday.days[2]).toMatchObject({ day: "2026-09-09", left: 75, isToday: true, over: false });
  });

  it("nu consumă ritmul zilnic din plicuri lunare sau din plăți în afara plicurilor", () => {
    const { data, source } = base();
    data.settings.salaryPlan = {
      ...data.settings.salaryPlan,
      periodStart: "2026-09-07",
      nextPayday: "2026-10-04",
      allocations: [
        { id: "food", label: "Alimente", amount: 2400, category: "Alimente" },
        { id: "bills", label: "Facturi", amount: 800, category: "Casă & facturi", weeklyPace: false },
      ],
      transfers: [],
    };
    data.transactions = [
      { id: "bill", title: "ENEL", amount: 400, kind: "expense", category: "Casă & facturi", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-09-07", allocationId: "bills" },
    ];
    const rhythm = weeklyEnvelopeDailyRhythm(data, "2026-09-07");
    expect(rhythm.remaining).toBe(600);
    expect(rhythm.todayOut).toBe(0);
    expect(rhythm.todayShare).toBeCloseTo(85.71, 1);
    expect(rhythm.todayLeft).toBeCloseTo(85.71, 1);
    expect(rhythm.days.every((item) => item.left === rhythm.todayShare)).toBe(true);
  });
});

describe("fereastra de comparație Analiză", () => {
  it("luna calendaristică compară cu luna anterioară", () => {
    const { data } = base();
    const window = analysisCompareWindow(data.settings.salaryPlan, "2026-09", "calendar");
    expect(window).toMatchObject({
      mode: "calendar",
      start: "2026-09-01",
      end: "2026-09-30",
      priorStart: "2026-08-01",
      priorEnd: "2026-08-31",
    });
  });

  it("ciclul de salariu compară intervalul anterior de aceeași lungime", () => {
    const { data } = base();
    data.settings.salaryPlan.periodStart = "2026-08-26";
    data.settings.salaryPlan.nextPayday = "2026-09-25";
    const window = analysisCompareWindow(data.settings.salaryPlan, "2026-09", "cycle");
    expect(window.mode).toBe("cycle");
    expect(window.start).toBe("2026-08-26");
    expect(window.end).toBe("2026-09-25");
    expect(window.priorEnd).toBe("2026-08-25");
    expect(window.priorStart).toBe("2026-07-26");
  });

  it("fără dată de salariu, ciclul cade pe luna calendaristică", () => {
    const { data } = base();
    data.settings.salaryPlan.periodStart = "2026-09-01";
    data.settings.salaryPlan.nextPayday = "";
    const window = analysisCompareWindow(data.settings.salaryPlan, "2026-09", "cycle");
    expect(window.mode).toBe("calendar");
    expect(window.start).toBe("2026-09-01");
  });

  it("compară burn-ul plicului cu zilele scurse din ciclu", () => {
    const { data, source } = base();
    data.settings.salaryPlan.periodStart = "2026-09-01";
    data.settings.salaryPlan.nextPayday = "2026-09-30";
    data.settings.salaryPlan.allocations = [
      { id: "alloc-food", label: "Alimente", amount: 1000, category: "Alimente", sourceId: source.id, memberId: "member-me" },
    ];
    data.transactions = [
      { id: "e1", title: "Lidl", amount: 200, kind: "expense", category: "Alimente", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-09-05", allocationId: "alloc-food" },
    ];
    const paces = envelopeBurnPace(data, "2026-09-15");
    expect(paces[0]).toMatchObject({ label: "Alimente", usage: 0.2, pace: "ahead" });
    expect(paces[0].expectedUsage).toBeCloseTo(15 / 30, 5);
  });

  it("explică formula Poți folosi azi pe pași", () => {
    const { data, source } = base();
    source.openingBalance = 3000;
    data.settings.salaryPlan.periodStart = "2026-09-01";
    data.settings.salaryPlan.nextPayday = "2026-09-30";
    data.settings.salaryPlan.allocations = [
      { id: "alloc-food", label: "Alimente", amount: 900, category: "Alimente", sourceId: source.id, memberId: "member-me" },
    ];
    const sheet = safeSpendBreakdown(data, "2026-09-10");
    expect(sheet.hasPayday).toBe(true);
    expect(sheet.steps.length).toBeGreaterThanOrEqual(4);
    expect(sheet.spendable).toBeGreaterThanOrEqual(0);
    expect(sheet.summary).toMatch(/Reperul|minim/i);
  });

  it("compune un headline pentru digestul săptămânii", () => {
    const { data, source } = base();
    data.transactions = [
      { id: "e1", title: "Taxi", amount: 80, kind: "expense", category: "Transport", sourceId: source.id, source: source.name, memberId: "member-me", person: "Eu", date: "2026-09-10" },
    ];
    const digest = weeklyDigestHeadline(data, "2026-09-10");
    expect(digest.title).toMatch(/Transport|ritm|goală|Cheltuielile|depășesc/i);
    expect(digest.detail.length).toBeGreaterThan(0);
  });

});


describe("householdActivityInCycle", () => {
  it("folosește periodStart → nextPayday, nu luna calendar", () => {
    const data = createEmptyAppData();
    data.settings.salaryPlan.periodStart = "2026-08-20";
    data.settings.salaryPlan.nextPayday = "2026-09-20";
    data.settings.members = [{ id: "me", name: "Eu", color: "#256B5B" }, { id: "partner", name: "Ea", color: "#966E4A" }];
    data.transactions = [
      { id: "t1", title: "Lidl", amount: 100, kind: "expense", category: "Alimente", source: "Card", sourceId: "s", person: "Eu", memberId: "me", date: "2026-08-25", createdAt: "2026-08-25T10:00:00.000Z" },
      { id: "t2", title: "Taxi", amount: 50, kind: "expense", category: "Transport", source: "Card", sourceId: "s", person: "Ea", memberId: "partner", date: "2026-09-05", createdAt: "2026-09-05T10:00:00.000Z" },
      { id: "t3", title: "Vechi", amount: 999, kind: "expense", category: "Altele", source: "Card", sourceId: "s", person: "Eu", memberId: "me", date: "2026-07-01", createdAt: "2026-07-01T10:00:00.000Z" },
    ];
    const cycle = householdActivityInCycle(data, "2026-09-10");
    expect(cycle.familyExpense).toBe(150);
    expect(cycle.members.find((m) => m.memberId === "me")?.expense).toBe(100);
  });
});
