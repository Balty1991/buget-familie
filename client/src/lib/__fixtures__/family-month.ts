/**
 * O familie inventată, construită ca familiile reale care folosesc aplicația: doi membri,
 * card + cash + tichete pentru unul, surse fără bani notați pentru celălalt, salariul pe 9,
 * plic de alimente cu 600 pe săptămână din două surse, un plic de taxi fără ritm și rate
 * pe numele amândurora. Nicio sumă sau nume nu vine dintr-un backup real.
 */
import { addIsoDays, commitLedgerEntry, createEmptyAppData, recordDebtPayment, sourceTransferPair, type AppData, type Debt, type Transaction } from "../finance-data";

export const ME = "member-ion";
export const PARTNER = "member-ana";
export const CARD = "source-debit";
export const CASH = "source-cash";
export const MEAL = "source-meal";
export const PARTNER_CARD = "source-ana-card";
export const FOOD = "allocation-food";
export const TAXI = "allocation-taxi";
export const PERIOD_START = "2026-10-09";
export const PAYDAY = "2026-11-09";

const debt = (id: string, name: string, monthly: number, dueDate: string, memberId: string, remaining: number): Debt =>
  ({ id, name, remaining, monthly, due: "", tone: "coral", dueDate, memberId, kind: "card" });

/** Ziua salariului: venitul e notat, plicurile sunt făcute, ratele încă neplătite. */
export const familyAtPayday = (): AppData => {
  const data = createEmptyAppData();
  data.settings.members = [{ id: PARTNER, name: "Ana" }, { id: ME, name: "Ion" }];
  data.settings.selfMemberId = ME;
  data.settings.paymentSources = [
    { id: CARD, name: "Card Ion", kind: "card", memberId: ME, openingBalance: 0 },
    { id: CASH, name: "Cash Ion", kind: "cash", memberId: ME, openingBalance: 0 },
    { id: MEAL, name: "Tichete Ion", kind: "meal", memberId: ME, openingBalance: 0 },
    { id: PARTNER_CARD, name: "Card Ana", kind: "card", memberId: PARTNER, openingBalance: 0 },
  ];
  data.settings.salaryPlan = {
    ...data.settings.salaryPlan,
    periodStart: PERIOD_START,
    nextPayday: PAYDAY,
    earliestPayday: addIsoDays(PAYDAY, -1),
    paydayFlexDays: 1,
    allocations: [
      { id: FOOD, label: "Alimente", amount: 2744, category: "Alimente", sourceId: CARD, funding: [{ sourceId: MEAL, amount: 600 }], weeklyPace: true, weeklyAmount: 600, alertThreshold: 80 },
      { id: TAXI, label: "Taxi", amount: 500, category: "Transport", sourceId: CARD, weeklyPace: false, alertThreshold: 80 },
    ],
  };
  const tx = (id: string, title: string, amount: number, kind: Transaction["kind"], sourceId: string, date: string, extra: Partial<Transaction> = {}): Transaction =>
    ({ id, title, amount, kind, category: kind === "income" ? "Venit" : "Alimente", sourceId, source: sourceId, memberId: ME, person: "Ion", date, ...extra });
  data.transactions = [
    tx("rest", "Rămas din luna trecută", 280, "income", CASH, "2026-10-05"),
    tx("salary", "Salariu Ion", 4300, "income", CARD, PERIOD_START),
    tx("meal-in", "Tichete Ion", 990, "income", MEAL, PERIOD_START),
  ];
  data.debts = [
    debt("debt-iron", "Fier de călcat", 90.25, "2026-10-10", ME, 270.75),
    debt("debt-blades", "Lame aparat", 32.85, "2026-10-17", ME, 98.55),
    debt("debt-loan", "Credit Ion", 672.96, "2026-10-30", ME, 27000),
    debt("debt-phone", "Telefon Ana", 179, "2026-10-25", PARTNER, 358),
    debt("debt-loan-ana", "Credit Ana", 580.68, "2026-10-17", PARTNER, 23000),
  ];
  return data;
};

/** Generator determinist: aceeași sămânță, aceeași lună. */
export const seeded = (seed: number) => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (low: number, high: number) => Math.round((low + next() * (high - low)) * 100) / 100,
    chance: (probability: number) => next() < probability,
  };
};

let counter = 0;
const expense = (input: Partial<Transaction> & Pick<Transaction, "title" | "amount" | "sourceId" | "date">): Transaction => {
  counter += 1;
  return { id: `sim-${counter}`, kind: "expense", category: "Alimente", source: input.sourceId || "", memberId: ME, person: "Ion", ...input };
};

/**
 * O zi obișnuită: câteva cumpărături mici, uneori un bon mare cu consumabile pentru toată luna,
 * taxi, ratele în ziua lor (cele ale Anei plătite uneori de Ion) și din când în când bani mutați în cash.
 */
export const liveOneDay = (data: AppData, day: string, random: ReturnType<typeof seeded>): AppData => {
  let next = data;
  const shops = Math.floor(random.next() * 3);
  for (let index = 0; index < shops; index += 1) {
    const amount = random.between(4, 95);
    const sourceId = random.chance(0.35) ? MEAL : random.chance(0.3) ? CASH : CARD;
    next = commitLedgerEntry(next, expense({ title: "Magazin", amount, sourceId, date: day, allocationId: FOOD, category: random.chance(0.2) ? "Dulciuri" : "Alimente" }));
  }
  if (random.chance(0.12)) {
    const amount = random.between(120, 260);
    const spreadAmount = Math.round(amount * random.between(0.4, 0.85) * 100) / 100;
    next = commitLedgerEntry(next, expense({ title: "Hipermarket", amount, sourceId: CARD, date: day, allocationId: FOOD, spreadAmount }));
  }
  if (random.chance(0.3)) next = commitLedgerEntry(next, expense({ title: "Taxi", amount: random.between(10, 45), sourceId: random.chance(0.5) ? CASH : CARD, date: day, allocationId: TAXI, category: "Transport" }));
  if (random.chance(0.15)) next = commitLedgerEntry(next, expense({ title: "Farmacie", amount: random.between(15, 70), sourceId: CARD, date: day, allocationId: "outside", outsideChosen: true, category: "Sănătate" }));
  if (random.chance(0.1)) {
    const pair = sourceTransferPair(next, { fromId: CARD, toId: CASH, amount: random.between(20, 100), date: day, memberId: ME });
    next = { ...next, transactions: [...pair, ...next.transactions] };
  }
  for (const item of next.debts) {
    if (item.dueDate !== day || item.remaining <= 0) continue;
    // Rata Anei: uneori o confirmă Ion din cardul lui, alteori rămâne neconfirmată.
    if (item.memberId === PARTNER && !random.chance(0.5)) continue;
    const paid = recordDebtPayment(next, { debtId: item.id, amount: Math.min(item.monthly, item.remaining), sourceId: CARD, memberId: ME, date: day });
    if (paid) next = paid;
  }
  return next;
};
