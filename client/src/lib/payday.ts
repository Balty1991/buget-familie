/**
 * „A intrat salariul”, într-un singur pas.
 *
 * Până acum ziua salariului cerea cinci locuri: notezi venitul în Notează, muți data în Plicuri,
 * refaci plicurile pe noua perioadă, te uiți în Obligații ce rate vin, apoi în Plan cât a rămas
 * nerepartizat. Aici propunerea pleacă de la luna trecută (aceleași venituri, aceleași plicuri,
 * cu ritmul pe săptămână păstrat), iar cifrele de la final sunt chiar cele din Plan, socotite pe
 * datele care ar rezulta, nu o a doua formulă care s-ar putea despărți de prima.
 */
import {
  addIsoDays,
  allocationStatus,
  appendAllocationHistory,
  commitLedgerEntry,
  foldRomanian,
  debtsOutsideTrackedMoney,
  isBalanceAdjustment,
  isWeeklyPaced,
  money2,
  newId,
  paydayFlexDays,
  planAllocationMath,
  planEndDate,
  reservedDebtsInPlan,
  sourceBalance,
  type AppData,
  type BudgetAllocation,
  type CycleMemory,
  type Transaction,
} from "./finance-data";
import { periodDays, totalFromWeeklyPace } from "./calendar-budget";
import { nextPaydayAfter } from "./monthly-needs";
import { t } from "./i18n";

export type PaydayIncome = {
  key: string;
  title: string;
  amount: number;
  sourceId: string;
  memberId?: string;
  /** Venitul e deja în Mișcări (notat înainte de a deschide pasul): nu se mai adaugă o dată. */
  notedId?: string;
};

export type PaydayEnvelope = {
  allocationId: string;
  label: string;
  /** Plic cu ritm: se alege suma pe o săptămână întreagă, totalul vine din zilele noii perioade. */
  weekly?: number;
  /** Plic fără ritm (taxi, facturi): suma pe toată perioada. */
  amount: number;
  previous: number;
};

export type PaydayProposal = {
  date: string;
  nextPayday: string;
  incomes: PaydayIncome[];
  envelopes: PaydayEnvelope[];
};

export type PaydayDue = { id: string; name: string; amount: number; dueDate: string; memberName?: string; outside: boolean };

export type PaydaySummary = {
  /** Pe carduri și cash (fără tichete și fără sursele unui membru fără bani notați), după venit. */
  inSources: number;
  /** Partea plicurilor plătită din aceste surse; completarea din tichete nu intră. */
  inEnvelopes: number;
  /** Rate și facturi până la salariul următor, ținute deoparte. */
  dues: number;
  free: number;
  /** Tichetele de după venit: merg doar în plicurile care le folosesc. */
  meal: number;
  duesList: PaydayDue[];
  days: number;
};

const round = (value: number) => Math.round(value);

/** Ziua din lună în care vine de obicei salariul: din planul de acum, apoi din veniturile declarate. */
const salaryDay = (data: AppData, date: string) => {
  const plan = data.settings.salaryPlan;
  const fromPlan = Number(plan.nextPayday?.slice(8, 10));
  if (fromPlan) return fromPlan;
  const declared = (plan.incomes || []).filter((item) => !item.archived).map((item) => item.day).sort((a, b) => a - b)[0];
  return declared || Number(date.slice(8, 10));
};

/** Plicul cu ritm: cât pe o săptămână întreagă, din suma lui pe perioada trecută dacă n-a fost scris. */
const weeklyOf = (data: AppData, allocation: BudgetAllocation) => {
  if (allocation.weeklyAmount && allocation.weeklyAmount > 0) return allocation.weeklyAmount;
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  const days = plan.periodStart && end ? periodDays(plan.periodStart, end) : 0;
  return days > 0 ? round(allocation.amount * 7 / days) : round(allocation.amount / 4.3);
};

const isIncomeRow = (item: Transaction) => item.kind === "income" && !isBalanceAdjustment(item) && item.category !== "Transfer" && item.amount > 0;

/**
 * Propunerea pentru ziua salariului: veniturile de la începutul lunii trecute (salariu, tichete),
 * cu suma din Mișcări dacă au fost deja notate azi, și plicurile de acum pe noua perioadă.
 */
export function proposePayday(data: AppData, date: string): PaydayProposal {
  const plan = data.settings.salaryPlan;
  const nextPayday = nextPaydayAfter(date, salaryDay(data, date));
  const sources = data.settings.paymentSources;
  // Ce s-a notat deja de la începutul ferestrei de salariu: nu se cere și nu se adaugă a doua oară.
  const windowStart = addIsoDays(date, -Math.max(3, paydayFlexDays(plan)));
  const noted = data.transactions.filter((item) => isIncomeRow(item) && item.date >= windowStart && item.date <= date);
  const usedNoted = new Set<string>();
  const previous = plan.periodStart && plan.periodStart < windowStart
    ? data.transactions.filter((item) => isIncomeRow(item) && item.date >= addIsoDays(plan.periodStart, -3) && item.date <= addIsoDays(plan.periodStart, 3))
    : [];
  const seen = new Set<string>();
  const incomes: PaydayIncome[] = [];
  // Venitul de lună: salariul, tichetele, alocația. Voucherul SGR de 40 de lei nu vine cu salariul.
  for (const item of previous.filter((row) => row.amount >= 100).sort((left, right) => right.amount - left.amount)) {
    if (!item.sourceId || !sources.some((source) => source.id === item.sourceId)) continue;
    const key = `${item.sourceId}:${foldRomanian(item.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Notat deja: același titlu pe aceeași sursă, sau o sumă apropiată (salariul de luna asta e rar fix același).
    const free = noted.filter((row) => row.sourceId === item.sourceId && !usedNoted.has(row.id));
    const already = free.find((row) => foldRomanian(row.title) === foldRomanian(item.title)) || free.find((row) => Math.abs(row.amount - item.amount) <= item.amount * 0.25);
    if (already) usedNoted.add(already.id);
    incomes.push({ key, title: already?.title || item.title, amount: already?.amount ?? item.amount, sourceId: item.sourceId, memberId: already?.memberId || item.memberId, ...(already ? { notedId: already.id } : {}) });
  }
  // Venituri notate deja azi, dar fără pereche în luna trecută (prima lună în aplicație).
  for (const row of noted) {
    if (usedNoted.has(row.id) || !row.sourceId || row.amount < 100) continue;
    usedNoted.add(row.id);
    incomes.push({ key: `${row.sourceId}:${row.memberId || ""}:${row.id}`, title: row.title, amount: row.amount, sourceId: row.sourceId, memberId: row.memberId, notedId: row.id });
  }
  if (!incomes.length) {
    const self = data.settings.selfMemberId || data.settings.members[0]?.id;
    const card = sources.find((source) => source.kind === "card" && source.memberId === self) || sources.find((source) => source.kind === "card") || sources[0];
    const declared = (plan.incomes || []).filter((item) => !item.archived);
    if (declared.length) {
      declared.forEach((item, index) => {
        const source = sources.find((entry) => entry.kind === "card" && entry.memberId === item.memberId) || card;
        if (source) incomes.push({ key: `declared:${index}`, title: item.label, amount: item.amount, sourceId: source.id, memberId: item.memberId || source.memberId });
      });
    } else if (card) {
      incomes.push({ key: "salary", title: t("Salariu"), amount: 0, sourceId: card.id, memberId: card.memberId || self });
    }
  }
  const envelopes = plan.allocations.map((item): PaydayEnvelope => isWeeklyPaced(item, plan)
    ? { allocationId: item.id, label: item.label, weekly: weeklyOf(data, item), amount: 0, previous: item.amount }
    : { allocationId: item.id, label: item.label, amount: item.amount, previous: item.amount });
  return { date, nextPayday, incomes, envelopes: envelopes.map((item) => item.weekly ? { ...item, amount: round(totalFromWeeklyPace(item.weekly, date, nextPayday)) } : item) };
}

/** Suma plicului pe noua perioadă: plicul cu ritm primește săptămânile întregi și zilele în plus. */
export const envelopeTotal = (envelope: Pick<PaydayEnvelope, "weekly" | "amount">, date: string, nextPayday: string) =>
  envelope.weekly != null ? round(totalFromWeeklyPace(Math.max(0, envelope.weekly), date, nextPayday)) : Math.max(0, money2(envelope.amount));

/**
 * Pornește luna: notează veniturile încă nenotate, închide ciclul vechi (cu ce a rămas în plicuri,
 * pentru istoric), mută perioada de azi până la salariul următor și pune sumele noi pe plicuri.
 * Mișcările vechi rămân neatinse; mutările dintre plicuri și săptămâni erau ale lunii trecute.
 */
export function applyPayday(data: AppData, proposal: PaydayProposal): AppData {
  const plan = data.settings.salaryPlan;
  const { date, nextPayday } = proposal;
  const now = new Date().toISOString();
  let next = data;
  for (const income of proposal.incomes) {
    if (income.notedId || !(income.amount > 0)) continue;
    const source = data.settings.paymentSources.find((item) => item.id === income.sourceId);
    if (!source) continue;
    const member = data.settings.members.find((item) => item.id === (income.memberId || source.memberId));
    next = commitLedgerEntry(next, {
      id: newId("tx"),
      title: income.title.trim() || t("Salariu"),
      amount: money2(income.amount),
      kind: "income",
      category: "Venit",
      sourceId: source.id,
      source: source.name,
      memberId: member?.id,
      person: member?.name || "",
      date,
      createdAt: now,
    });
  }
  // Ciclul care se încheie rămâne în istoric, ca la „Pornește ciclul nou”.
  const oldEnd = planEndDate(plan);
  const memory: CycleMemory | undefined = plan.periodStart && plan.periodStart < date && plan.allocations.length
    ? (() => {
      const outcomes = plan.allocations.map((item) => ({ label: item.label, ...allocationStatus(data, item) }));
      return {
        periodStart: plan.periodStart,
        periodEnd: addIsoDays(date, -1) < (oldEnd || date) ? addIsoDays(date, -1) : oldEnd || addIsoDays(date, -1),
        spent: money2(outcomes.reduce((sum, item) => sum + item.spent, 0)),
        leftInEnvelopes: money2(outcomes.reduce((sum, item) => sum + Math.max(0, item.remaining), 0)),
        over: outcomes.filter((item) => item.remaining < -1).map((item) => item.label),
      };
    })()
    : undefined;
  const flex = paydayFlexDays(plan);
  const byId = new Map(proposal.envelopes.map((item) => [item.allocationId, item]));
  const changed: Array<{ allocation: BudgetAllocation; amount: number }> = [];
  const allocations = plan.allocations.map((item) => {
    const line = byId.get(item.id);
    if (!line) return item;
    const amount = envelopeTotal(line, date, nextPayday);
    if (amount !== item.amount) changed.push({ allocation: item, amount });
    // Completarea din altă sursă (tichetele) nu poate fi mai mare decât plicul.
    const funding = item.funding?.map((entry) => ({ ...entry, amount: Math.min(entry.amount, amount) })).filter((entry) => entry.amount > 0);
    return {
      ...item,
      amount,
      ...(line.weekly != null ? { weeklyAmount: Math.max(0, money2(line.weekly)), weeklyPace: true } : {}),
      ...(funding ? { funding } : {}),
      updatedAt: now,
    };
  });
  next = {
    ...next,
    settings: {
      ...next.settings,
      salaryPlan: {
        ...next.settings.salaryPlan,
        periodStart: date,
        nextPayday,
        earliestPayday: flex > 0 ? addIsoDays(nextPayday, -flex) : undefined,
        paydayFlexDays: flex,
        allocations,
        transfers: [],
        weekTransfers: [],
        joinedMidCycle: false,
        ...(memory ? { cycleMemory: [memory, ...(plan.cycleMemory || [])].slice(0, 6) } : {}),
        updatedAt: now,
        scalarsUpdatedAt: now,
      },
    },
  };
  for (const item of changed) {
    next = appendAllocationHistory(next, { kind: "updated", allocationId: item.allocation.id, allocationLabel: item.allocation.label, previousAmount: item.allocation.amount, newAmount: item.amount, note: t("Ziua salariului: plicul pe {start} – {end}", { start: date, end: nextPayday }) });
  }
  return next;
}

/** Cifrele de la final, din datele care ar rezulta: aceleași ca în Plan după apăsare. */
export function summarizePayday(data: AppData, proposal: PaydayProposal): PaydaySummary {
  const after = applyPayday(data, proposal);
  const math = planAllocationMath(after);
  const meal = after.settings.paymentSources.filter((source) => source.kind === "meal");
  const names = new Map(after.settings.members.map((member) => [member.id, member.name]));
  const duesList: PaydayDue[] = [
    ...reservedDebtsInPlan(after).map((item) => ({ id: item.id, name: item.name, amount: item.amount, dueDate: item.dueDate, memberName: item.memberId ? names.get(item.memberId) : undefined, outside: false })),
    ...debtsOutsideTrackedMoney(after).map((item) => ({ id: item.id, name: item.name, amount: item.amount, dueDate: item.dueDate, memberName: item.memberId ? names.get(item.memberId) : undefined, outside: true })),
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  return {
    inSources: money2(math.availableSources),
    inEnvelopes: money2(math.reservedInEnvelopes),
    dues: money2(math.scheduled),
    free: money2(math.unrepartized),
    meal: money2(meal.reduce((sum, source) => sum + sourceBalance(after, source.id), 0)),
    duesList,
    days: periodDays(proposal.date, proposal.nextPayday) - 1,
  };
}

/**
 * E ziua salariului: fereastra lui s-a deschis (sau a trecut) și luna nouă nu e încă pornită.
 * Astăzi arată atunci „A intrat salariul”, în locul pașilor împrăștiați.
 */
export const paydayDue = (data: AppData, asOf: string) => {
  const plan = data.settings.salaryPlan;
  if (!plan.nextPayday || !plan.allocations.length) return false;
  const opens = plan.earliestPayday && plan.earliestPayday < plan.nextPayday ? plan.earliestPayday : addIsoDays(plan.nextPayday, -paydayFlexDays(plan));
  return asOf >= opens && plan.periodStart < opens;
};
