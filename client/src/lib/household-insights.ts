/**
 * Analize de gospodărie calculate numai din registrul local.
 * Nu persistă nimic în AppData și nu ating pachetul Firebase.
 */
import {
  addIsoDays,
  allocationBudget,
  allocationStatus,
  exchangeRateFor,
  toBaseAmount,
  allocationWeekStatus,
  allocationWeeksStatus,
  envelopeDecisionStatus,
  financialBalance,
  formatDate,
  isoToday,
  isWeeklyPaced,
  newId,
  inPlanPeriod,
  pendingRecurringInPlan,
  scheduledInPlan,
  planEndDate,
  planExpired,
  planCoverEndDate,
  paydayWindow,
  planForecast,
  weeklySummary,
  transactionShareScope,
  type AppData,
  type BudgetAllocation,
  type RecurringPayment,
  type SavingsGoal,
  type SalaryPlan,
  type Transaction,
  isoDate,
  foldRomanian,
} from "./finance-data";
import { statementMerchant } from "./statement-merchant";
import { lei as leiExact } from "./money-format";
import { daysLabel, getLocale, t } from "./i18n";
import { safeSetItem } from "@/lib/safe-storage";
import { selfMemberIdOf } from "./member-identity";
import { pendingTransfers } from "./monthly-needs";

const fold = foldRomanian;
const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).valueOf() - new Date(`${from}T12:00:00`).valueOf()) / 86_400_000);
const monthRange = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return { start: `${month}-01`, end: `${month}-${String(new Date(year, index, 0).getDate()).padStart(2, "0")}` };
};
const previousMonth = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(year, index - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
export const currentMonthKey = (asOf = isoToday()) => asOf.slice(0, 7);
export const monthTitle = (month: string) => new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export type AgeOfMoney = {
  days: number;
  sampleAmount: number;
  unfundedAmount: number;
  incomeCount: number;
  expenseCount: number;
};

/** FIFO simplu: câți zile stă un leu între încasare și cheltuială. Soldul inițial contează ca bani „deja prezenți”. */
export const ageOfMoney = (data: AppData, asOf = isoToday()): AgeOfMoney | undefined => {
  // Soldurile inițiale valutare se convertesc, ca totalul să rămână în lei ca restul registrului.
  const opening = data.settings.paymentSources.reduce((sum, source) => sum + Math.max(0, source.currency ? toBaseAmount(source.openingBalance, exchangeRateFor(data, source.currency)) ?? 0 : source.openingBalance), 0);
  const incomes = data.transactions.filter((item) => item.kind === "income" && item.date <= asOf).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
  const expenses = data.transactions.filter((item) => item.kind === "expense" && item.date <= asOf).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
  if (!expenses.length || (!incomes.length && opening <= 0)) return undefined;
  const pools = [
    ...(opening > 0 ? [{ date: data.settings.salaryPlan.periodStart || asOf, remaining: opening }] : []),
    ...incomes.map((item) => ({ date: item.date, remaining: item.amount })),
  ];
  let sampleAmount = 0;
  let weightedDays = 0;
  let unfundedAmount = 0;
  for (const expense of expenses) {
    let need = expense.amount;
    for (const pool of pools) {
      if (need <= 0) break;
      if (pool.remaining <= 0) continue;
      const take = Math.min(need, pool.remaining);
      weightedDays += take * Math.max(0, daysBetween(pool.date, expense.date));
      sampleAmount += take;
      pool.remaining -= take;
      need -= take;
    }
    unfundedAmount += need;
  }
  if (sampleAmount <= 0) return undefined;
  return {
    days: Math.round((weightedDays / sampleAmount) * 10) / 10,
    sampleAmount: Math.round(sampleAmount * 100) / 100,
    unfundedAmount: Math.round(unfundedAmount * 100) / 100,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
  };
};

export type MonthlyRecap = {
  month: string;
  title: string;
  income: number;
  expense: number;
  cashflow: number;
  priorIncome: number;
  priorExpense: number;
  priorCashflow: number;
  transactionCount: number;
  topCategory?: { name: string; amount: number };
  envelopesOver: number;
  envelopesWatch: number;
  nextStep: string;
  tone: "good" | "watch" | "risk" | "empty";
};

export const monthlyRecap = (data: AppData, month = currentMonthKey()): MonthlyRecap => {
  const range = monthRange(month);
  const prior = monthRange(previousMonth(month));
  const inRange = (start: string, end: string) => data.transactions.filter((item) => item.date >= start && item.date <= end);
  const selected = inRange(range.start, range.end);
  const previous = inRange(prior.start, prior.end);
  const sum = (entries: Transaction[], kind: Transaction["kind"]) => entries.filter((item) => item.kind === kind).reduce((total, item) => total + item.amount, 0);
  const income = sum(selected, "income");
  const expense = sum(selected, "expense");
  const cashflow = income - expense;
  const priorIncome = sum(previous, "income");
  const priorExpense = sum(previous, "expense");
  const priorCashflow = priorIncome - priorExpense;
  const categories = Object.entries(selected.filter((item) => item.kind === "expense").reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort((a, b) => b[1] - a[1]);
  const alerts = data.settings.salaryPlan.allocations.map((item) => allocationStatus(data, item));
  const envelopesOver = alerts.filter((item) => item.state === "over").length;
  const envelopesWatch = alerts.filter((item) => item.state === "watch").length;
  const topCategory = categories[0] ? { name: categories[0][0], amount: categories[0][1] } : undefined;
  const tone = !selected.length ? "empty" as const : envelopesOver || cashflow < 0 ? "risk" as const : envelopesWatch ? "watch" as const : "good" as const;
  const nextStep = !selected.length
    ? t("Înregistrează prima mișcare ca să ai un recapitulativ de închis.")
    : envelopesOver
      ? t("Ajustează plicurile depășite înainte să începi luna următoare.")
      : cashflow < 0
        ? t("Cheltuielile au trecut peste venit. Mută o limită sau amână o plată neesențială.")
        : topCategory
          ? t("Categoria {name} a condus luna. Verifică dacă plicul ei rămâne realist.", { name: t(topCategory.name) })
          : t("Luna e în echilibru. Poți închide ritualul și descărca PDF-ul.");
  return { month, title: monthTitle(month), income, expense, cashflow, priorIncome, priorExpense, priorCashflow, transactionCount: selected.length, topCategory, envelopesOver, envelopesWatch, nextStep, tone };
};

export type HouseholdMemberShare = {
  memberId: string;
  name: string;
  income: number;
  expense: number;
  count: number;
  share: number;
};

export type HouseholdActivity = {
  month: string;
  members: HouseholdMemberShare[];
  familyExpense: number;
  recent: Array<{ id: string; date: string; title: string; amount: number; kind: Transaction["kind"]; person: string; category: string }>;
};

export const householdActivity = (data: AppData, month = currentMonthKey()): HouseholdActivity => {
  const range = monthRange(month);
  const monthTx = data.transactions.filter((item) => item.date >= range.start && item.date <= range.end);
  const familyExpense = monthTx.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const members = data.settings.members.map((member) => {
    const entries = monthTx.filter((item) => item.memberId === member.id);
    const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { memberId: member.id, name: member.name, income, expense, count: entries.length, share: familyExpense > 0 ? expense / familyExpense : 0 };
  }).sort((a, b) => b.expense - a.expense);
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 8).map((item) => ({ id: item.id, date: item.date, title: item.title, amount: item.amount, kind: item.kind, person: item.person, category: item.category }));
  return { month, members, familyExpense, recent };
};

/** Activitate pe ciclul salarial (periodStart → ultima zi acoperită, inclusiv flexul venitului), nu pe luna calendar. */
export const householdActivityInCycle = (data: AppData, asOf = isoToday()): HouseholdActivity => {
  const plan = data.settings.salaryPlan;
  const start = plan.periodStart || `${asOf.slice(0, 7)}-01`;
  const cover = planCoverEndDate(plan);
  const end = cover && cover >= start ? cover : asOf;
  const cycleTx = data.transactions.filter((item) => item.date >= start && item.date <= end && transactionShareScope(item) !== "personal");
  const familyExpense = cycleTx.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const members = data.settings.members.map((member) => {
    const entries = cycleTx.filter((item) => item.memberId === member.id);
    const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { memberId: member.id, name: member.name, income, expense, count: entries.length, share: familyExpense > 0 ? expense / familyExpense : 0 };
  }).sort((a, b) => b.expense - a.expense);
  const recent = [...cycleTx].sort((a, b) => {
    const right = b.updatedAt || b.createdAt || `${b.date}T00:00:00.000Z`;
    const left = a.updatedAt || a.createdAt || `${a.date}T00:00:00.000Z`;
    return right.localeCompare(left) || b.date.localeCompare(a.date);
  }).slice(0, 8).map((item) => ({ id: item.id, date: item.date, title: item.title, amount: item.amount, kind: item.kind, person: item.person, category: item.category }));
  return { month: `${start}…${end}`, members, familyExpense, recent };
};

const merchantKey = (title: string) => fold(title).replace(/[^a-z0-9\s]/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
/**
 * Mișcările importate înainte de curățarea numelor au titlul băncii („Plata la POS non-BT cu card
 * VISA; NETFLIX.COM …”): fără curățare, toate plățile cu cardul ar avea aceeași cheie.
 */
const subscriptionName = (title: string) => statementMerchant(title).replace(/\s+\d+[.,]?\d*\s*(lei|ron)?$/i, "").trim() || title;
const subscriptionKey = (title: string) => merchantKey(subscriptionName(title));
/** Scadența „Netflix” și plata „NETFLIX.COM LU” sunt același lucru: se potrivesc după primul cuvânt. */
const brandOf = (key: string) => { const word = key.split(" ")[0] || ""; return word.length >= 3 ? word : key; };

export type SubscriptionDetection = {
  key: string;
  name: string;
  amount: number;
  count: number;
  intervalDays: number;
  category: string;
  sourceId?: string;
  memberId?: string;
  lastDate: string;
  confidence: "high" | "medium";
  reason: string;
  /** Ultima plată a sărit peste prețul obișnuit (abonament scumpit). */
  priceChange?: { from: number; to: number };
};

/** Un preț nou, nu o variație de curs: cel puțin 4% și 2 lei în plus. */
const isPriceRise = (from: number, to: number) => to - from >= Math.max(2, from * 0.04);

const groceryCategories = new Set(["Alimente", "Consumabile copil", "Dulciuri", "Băuturi", "Apă"]);
const billCategories = new Set(["Casă & facturi", "Rate produse"]);
const FUEL = /\b(omv|mol|petrom|rompetrol|lukoil|socar|gazprom|benzina|motorina|carburant|combustibil|shell)\b/;

/** Detectează comercianți care se repetă lunar, fără a crea scadențe până la confirmare. */
export const detectSubscriptions = (data: AppData, asOf = isoToday()): SubscriptionDetection[] => {
  const from = new Date(`${asOf}T12:00:00`);
  from.setDate(from.getDate() - 180);
  const start = isoDate(from);
  const tracked = new Set(data.recurring.map((item) => brandOf(subscriptionKey(item.name))).filter(Boolean));
  const groups = new Map<string, Transaction[]>();
  data.transactions.filter((item) => item.kind === "expense" && item.date >= start && item.date <= asOf).forEach((item) => {
    const key = subscriptionKey(item.title);
    if (!key || key.length < 3) return;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  });
  const detections: SubscriptionDetection[] = [];
  groups.forEach((entries, key) => {
    if (tracked.has(brandOf(key)) || entries.length < 2) return;
    const dates = Array.from(new Set(entries.map((item) => item.date))).sort();
    if (dates.length < 2) return;
    const intervals = dates.slice(1).map((date, index) => daysBetween(dates[index], date)).filter((value) => value > 0);
    const intervalDays = Math.round(median(intervals));
    const byDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const latest = byDate[byDate.length - 1].amount;
    // Cu trei plăți sau mai multe, ultima poate fi un preț nou: comparăm istoricul fără ea.
    const history = byDate.length >= 3 ? byDate.slice(0, -1).map((item) => item.amount) : byDate.map((item) => item.amount);
    const typical = median(history);
    const similar = history.every((value) => Math.abs(value - typical) <= Math.max(4, typical * 0.22));
    const priceChange = byDate.length >= 3 && isPriceRise(typical, latest) ? { from: Math.round(typical * 100) / 100, to: latest } : undefined;
    if (byDate.length >= 3 && !priceChange && Math.abs(latest - typical) > Math.max(4, typical * 0.22)) return;
    const monthly = intervalDays >= 25 && intervalDays <= 40;
    const weekly = intervalDays >= 6 && intervalDays <= 9;
    const category = entries[0].category;
    const isGrocery = groceryCategories.has(category);
    const labeled = category === "Abonamente";
    if (isGrocery && !labeled) return;
    // Plinul la benzinărie se repetă lunar cu sume apropiate, dar nu e o scadență.
    if (!labeled && FUEL.test(key)) return;
    if (!similar) return;
    // În afara facturilor și ratelor, o sumă „apropiată” nu ajunge: un abonament costă la fel.
    const billLike = billCategories.has(category);
    if (!labeled && !billLike && (dates.length < 3 || history.some((value) => Math.abs(value - typical) > Math.max(2, typical * 0.08)))) return;
    if (!labeled && !monthly && !(weekly && entries.length >= 4)) return;
    if (!labeled && dates.length < 3 && !monthly) return;
    const last = entries.sort((a, b) => b.date.localeCompare(a.date))[0];
    detections.push({
      key,
      name: subscriptionName(last.title),
      amount: priceChange ? priceChange.to : Math.round(typical * 100) / 100,
      count: dates.length,
      intervalDays: intervalDays || 30,
      category: labeled ? "Abonamente" : category,
      sourceId: last.sourceId,
      memberId: last.memberId,
      lastDate: last.date,
      confidence: labeled || (monthly && dates.length >= 3) ? "high" : "medium",
      reason: priceChange
        ? t("S-a scumpit: {from} → {to}.", { from: leiExact(priceChange.from), to: leiExact(priceChange.to) })
        : labeled
        ? t("Categoria Abonamente, cu sumă stabilă.")
        : monthly
          ? t("Apare cam la {days} zile, cu sumă aproape identică.", { days: intervalDays })
          : t("Se repetă săptămânal de {count} ori.", { count: dates.length }),
      priceChange,
    });
  });
  return detections.sort((a, b) => b.amount - a.amount).slice(0, 8);
};

export type RecurringPriceChange = { recurringId: string; name: string; from: number; to: number; date: string };

/**
 * Scadențele urmărite care s-au scumpit: ultima plată la același comerciant (din ultimele 45 de
 * zile) e peste suma salvată. Plățile variabile (curent, gaz) nu intră: acolo suma chiar variază.
 */
export const recurringPriceChanges = (data: AppData, asOf = isoToday()): RecurringPriceChange[] => {
  const since = addIsoDays(asOf, -45);
  const changes: RecurringPriceChange[] = [];
  for (const item of data.recurring) {
    if (!item.active || item.variable || item.amount <= 0) continue;
    const brand = brandOf(subscriptionKey(item.name));
    if (!brand || brand.length < 3) continue;
    const latest = data.transactions
      .filter((entry) => entry.kind === "expense" && entry.date >= since && entry.date <= asOf && brandOf(subscriptionKey(entry.title)) === brand)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    // O plată de peste două ori suma nu e un preț nou, e altceva la același comerciant.
    if (latest && isPriceRise(item.amount, latest.amount) && latest.amount <= item.amount * 2) {
      changes.push({ recurringId: item.id, name: item.name, from: item.amount, to: latest.amount, date: latest.date });
    }
  }
  return changes.sort((a, b) => (b.to - b.from) - (a.to - a.from));
};

/** Cât costă abonamentele urmărite, adus la o lună și la un an (trimestrialele și anualele împărțite). */
export const subscriptionSpend = (data: AppData) => {
  const active = data.recurring.filter((item) => item.active && item.category === "Abonamente");
  const monthly = active.reduce((sum, item) => sum + (item.frequency === "yearly" ? item.amount / 12 : item.frequency === "quarterly" ? item.amount / 3 : item.amount), 0);
  return { count: active.length, monthly: Math.round(monthly * 100) / 100, yearly: Math.round(monthly * 12 * 100) / 100 };
};

export type MonthlyFamilyReport = {
  month: string;
  title: string;
  priorTitle: string;
  familyName: string;
  income: number;
  expense: number;
  cashflow: number;
  priorExpense: number;
  /** Cât din venit a rămas în casă (0–1); lipsește fără venit. */
  keptShare?: number;
  categories: Array<{ name: string; amount: number; prior: number; delta: number }>;
  /** Categoria care a crescut cel mai mult față de luna trecută (măcar 50 de lei). */
  biggestRise?: { name: string; delta: number };
  members: Array<{ name: string; expense: number }>;
  subscriptions: { monthly: number; yearly: number; count: number; rises: RecurringPriceChange[] };
  nextStep: string;
  empty: boolean;
};

/** Raportul lunii pentru toată familia: ce a intrat, unde s-a dus, ce s-a schimbat față de luna trecută. */
export const monthlyFamilyReport = (data: AppData, month = currentMonthKey()): MonthlyFamilyReport => {
  const recap = monthlyRecap(data, month);
  const range = monthRange(month);
  const prior = monthRange(previousMonth(month));
  const spendBy = (start: string, end: string) => data.transactions
    .filter((item) => item.kind === "expense" && item.date >= start && item.date <= end)
    .reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {});
  const now = spendBy(range.start, range.end);
  const before = spendBy(prior.start, prior.end);
  const round = (value: number) => Math.round(value * 100) / 100;
  const categories = Object.keys(now)
    .map((name) => ({ name, amount: round(now[name]), prior: round(before[name] || 0), delta: round(now[name] - (before[name] || 0)) }))
    .sort((a, b) => b.amount - a.amount);
  const rise = recap.priorExpense > 0 ? [...categories].sort((a, b) => b.delta - a.delta)[0] : undefined;
  const members = data.settings.members.length > 1
    ? data.settings.members
      .map((member) => ({ name: member.name, expense: round(data.transactions.filter((item) => item.kind === "expense" && item.memberId === member.id && item.date >= range.start && item.date <= range.end).reduce((sum, item) => sum + item.amount, 0)) }))
      .filter((item) => item.expense > 0)
      .sort((a, b) => b.expense - a.expense)
    : [];
  const spend = subscriptionSpend(data);
  return {
    month,
    title: recap.title,
    priorTitle: monthTitle(previousMonth(month)),
    familyName: data.settings.familyName || t("Familie"),
    income: round(recap.income),
    expense: round(recap.expense),
    cashflow: round(recap.cashflow),
    priorExpense: round(recap.priorExpense),
    keptShare: recap.income > 0 ? Math.max(0, recap.cashflow) / recap.income : undefined,
    categories: categories.slice(0, 5),
    biggestRise: rise && rise.delta >= 50 ? { name: rise.name, delta: rise.delta } : undefined,
    members,
    subscriptions: { ...spend, rises: recurringPriceChanges(data, range.end < isoToday() ? range.end : isoToday()) },
    nextStep: recap.nextStep,
    empty: recap.tone === "empty",
  };
};

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${leiExact(Math.abs(value))}`;

/** Textul de trimis pe WhatsApp sau oriunde: scurt, fără tabele, cu cifrele care contează. */
export const formatMonthlyReportShare = (report: MonthlyFamilyReport) => {
  const lines = [
    t("{family} · raportul lunii {month}", { family: report.familyName, month: report.title }),
    t("Venituri {income} · Cheltuieli {expense}", { income: leiExact(report.income), expense: leiExact(report.expense) }),
    report.cashflow >= 0
      ? report.keptShare !== undefined
        ? t("Au rămas {amount} ({share}% din venit)", { amount: leiExact(report.cashflow), share: Math.round(report.keptShare * 100) })
        : t("Au rămas {amount}", { amount: leiExact(report.cashflow) })
      : t("S-a cheltuit cu {amount} peste venit", { amount: leiExact(-report.cashflow) }),
  ];
  if (report.priorExpense > 0) lines.push(t("Față de {month}: cheltuieli {delta}", { month: report.priorTitle, delta: signed(report.expense - report.priorExpense) }));
  if (report.categories.length) {
    lines.push("", t("Unde s-au dus banii"));
    report.categories.forEach((item) => lines.push(`• ${t(item.name)} ${leiExact(item.amount)}${report.priorExpense > 0 && Math.abs(item.delta) >= 1 ? ` (${signed(item.delta)})` : ""}`));
  }
  if (report.biggestRise) lines.push(t("A crescut cel mai mult: {name}, {delta}", { name: t(report.biggestRise.name), delta: signed(report.biggestRise.delta) }));
  if (report.members.length > 1) lines.push("", t("Cine a cheltuit: {list}", { list: report.members.map((item) => `${item.name} ${leiExact(item.expense)}`).join(" · ") }));
  if (report.subscriptions.count) lines.push("", t("Abonamente: {monthly} pe lună · {yearly} pe an.", { monthly: leiExact(report.subscriptions.monthly), yearly: leiExact(report.subscriptions.yearly) }));
  report.subscriptions.rises.forEach((item) => lines.push(t("S-a scumpit {name}: {from} → {to}", { name: item.name, from: leiExact(item.from), to: leiExact(item.to) })));
  lines.push("", t("Următorul pas: {step}", { step: report.nextStep }));
  return lines.join("\n");
};

export const recurringFromDetection = (data: AppData, detection: SubscriptionDetection): RecurringPayment | undefined => {
  const sourceId = detection.sourceId || data.settings.paymentSources[0]?.id;
  const memberId = detection.memberId || selfMemberIdOf(data);
  if (!sourceId || !memberId || detection.amount <= 0) return undefined;
  const dueDay = Math.min(28, Math.max(1, Number(detection.lastDate.slice(8, 10)) || 1));
  return { id: newId("recurring"), name: detection.name, amount: detection.amount, category: detection.category, sourceId, memberId, dueDay, active: true, autoPost: false, note: t("Adăugat din detectarea abonamentelor"), updatedAt: new Date().toISOString() };
};

const MONTH_CLOSE_KEY = "buget-familie:month-close-v1";

export type MonthCloseRecord = { month: string; closedAt: string; income: number; expense: number; cashflow: number; note?: string };

export const readClosedMonths = (): Record<string, MonthCloseRecord> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MONTH_CLOSE_KEY);
    return raw ? JSON.parse(raw) as Record<string, MonthCloseRecord> : {};
  } catch {
    return {};
  }
};

export const closeMonthLocally = (recap: MonthlyRecap, note?: string): MonthCloseRecord => {
  const record: MonthCloseRecord = { month: recap.month, closedAt: new Date().toISOString(), income: recap.income, expense: recap.expense, cashflow: recap.cashflow, note };
  if (typeof window !== "undefined") {
    const all = { ...readClosedMonths(), [recap.month]: record };
    safeSetItem(window.localStorage, MONTH_CLOSE_KEY, JSON.stringify(all));
  }
  return record;
};

export const liquidSafeToSpend = (data: AppData, asOf = isoToday()) => {
  const balance = financialBalance(data);
  const pending = scheduledInPlan(data);
  const envelopeLeft = data.settings.salaryPlan.allocations.reduce((sum, item) => sum + Math.max(0, allocationStatus(data, item).remaining), 0);
  const available = Math.max(0, balance.liquidFunds - pending);
  return { liquidFunds: balance.liquidFunds, reservedRecurring: pending, envelopeLeft, available, asOf };
};

export const lastDaysPulse = (data: AppData, days = 7, asOf = isoToday()) => {
  const basis = new Date(`${asOf}T12:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(basis);
    date.setDate(basis.getDate() - (days - 1 - index));
    const iso = isoDate(date);
    const entries = data.transactions.filter((item) => item.date === iso);
    const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    return {
      date: iso,
      weekday: new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(date).replace(".", ""),
      expense,
      income,
      isToday: iso === asOf,
    };
  });
};

export const paydayTrack = (data: AppData, asOf = isoToday()) => {
  const plan = data.settings.salaryPlan;
  const end = plan.nextPayday || plan.earliestPayday;
  if (!plan.periodStart || !end) return undefined;
  const total = Math.max(1, daysBetween(plan.periodStart, end) + 1);
  const elapsed = Math.max(0, Math.min(total, daysBetween(plan.periodStart, asOf) + 1));
  return { start: plan.periodStart, end, total, elapsed, remaining: Math.max(0, total - elapsed), ratio: elapsed / total };
};

/**
 * Cât mai e până la salariu: zilele până la data obișnuită și până la cea mai târzie din
 * fereastra de ± zile. Banii trebuie să ajungă până în ziua dinaintea salariului.
 */
export const untilPayday = (plan: SalaryPlan, asOf = isoToday()) => {
  if (!plan.nextPayday || plan.nextPayday < asOf || plan.horizonDays) return undefined;
  const range = paydayWindow(plan);
  return { typical: range.typical, earliest: range.earliest, latest: range.latest, flex: range.flex, days: daysBetween(asOf, range.typical), latestDays: daysBetween(asOf, range.latest) };
};

/** Pentru un plic: câte zile mai are de acoperit și cât iese pe zi / pe săptămână, prudent. */
export const envelopeUntilPayday = (data: AppData, allocation: BudgetAllocation, asOf = isoToday()) => {
  const until = untilPayday(data.settings.salaryPlan, asOf);
  if (!until) return undefined;
  const remaining = Math.max(0, allocationStatus(data, allocation).remaining);
  const days = Math.max(1, until.latestDays);
  const perDay = Math.floor(remaining / days);
  return { ...until, remaining, perDay, perWeek: Math.floor(remaining * 7 / days) };
};

/**
 * Cât se poate da azi dintr-un plic pe săptămâni, ca tranșa să ajungă până la capătul ei:
 * ce a rămas în săptămână, împărțit la zilele rămase (cu tot cu azi). Aceeași cifră pe
 * plic, în avertizare și în ghid.
 */
export const weekDayCap = (data: AppData, allocation: BudgetAllocation, asOf = isoToday()) => {
  if (!isWeeklyPaced(allocation, data.settings.salaryPlan)) return undefined;
  const week = allocationWeekStatus(data, allocation, asOf);
  if (!week) return undefined;
  const daysLeft = Math.max(1, daysBetween(asOf, week.end) + 1);
  // La bani, ca cifra de pe Astăzi (37,50), rotunjit în jos ca să nu promită mai mult.
  return { week, daysLeft, perDay: Math.floor(Math.max(0, week.remaining) * 100 / daysLeft) / 100 };
};

export type WeekTooFast = { allocationId: string; label: string; weekIndex: number; spent: number; budget: number; remaining: number; daysLeft: number; perDay: number; over: boolean };

/**
 * Plicurile pe săptămâni în care tranșa curentă se duce mai repede decât zilele: „450 din 600,
 * mai sunt 3 zile”. Cel puțin 60% folosit și cu 15 puncte peste partea de zile scursă,
 * ca o singură cumpărătură mare de luni să nu sune alarma pentru orice.
 */
export const weekTooFast = (data: AppData, asOf = isoToday()): WeekTooFast[] => {
  const plan = data.settings.salaryPlan;
  const out: WeekTooFast[] = [];
  for (const item of plan.allocations) {
    if (!isWeeklyPaced(item, plan)) continue;
    const cap = weekDayCap(data, item, asOf);
    if (!cap) continue;
    const { week, daysLeft } = cap;
    if (week.budget <= 0 || week.spent <= 0) continue;
    const elapsed = Math.max(1, daysBetween(week.start, asOf) + 1);
    const usage = week.spent / week.budget;
    const over = week.remaining < 0;
    if (!over && (daysLeft < 2 || usage < 0.6 || usage < elapsed / week.days + 0.15)) continue;
    out.push({ allocationId: item.id, label: item.label, weekIndex: week.index, spent: week.spent, budget: week.budget, remaining: week.remaining, daysLeft, perDay: cap.perDay, over });
  }
  return out.sort((a, b) => Number(b.over) - Number(a.over) || b.spent / b.budget - a.spent / a.budget);
};

export type CycleEndReport = {
  payday: string;
  daysLeft: number;
  made: Array<{ id: string; label: string; left: number }>;
  over: Array<{ id: string; label: string; over: number }>;
  leftTotal: number;
  /** Cât se poate muta fără grijă: plicuri de facturi deja plătite, surplusul mâncării peste zilele rămase. */
  spare: number;
  goal?: { id: string; name: string; left: number };
};

/**
 * Raportul de la capătul ciclului, cu câteva zile înainte de salariu: ce plicuri au ajuns,
 * care nu, cât a rămas și cât se poate pune deoparte fără să lipsească în zilele rămase.
 * O factură încă neplătită își ține banii; mâncarea își ține partea pentru zilele rămase.
 */
export const cycleEndReport = (data: AppData, asOf = isoToday()): CycleEndReport | undefined => {
  const plan = data.settings.salaryPlan;
  const until = untilPayday(plan, asOf);
  if (!until || until.days > 3 || !plan.allocations.length || plan.cycleReportDone === plan.nextPayday) return undefined;
  const made: CycleEndReport["made"] = [];
  const over: CycleEndReport["over"] = [];
  let spare = 0;
  const daysLeft = Math.max(0, until.latestDays);
  for (const item of plan.allocations) {
    const status = allocationStatus(data, item);
    if (status.budget <= 0) continue;
    if (status.remaining < 0) { over.push({ id: item.id, label: item.label, over: Math.round(-status.remaining * 100) / 100 }); continue; }
    made.push({ id: item.id, label: item.label, left: Math.round(status.remaining * 100) / 100 });
    if (isWeeklyPaced(item, plan)) {
      const perDay = (item.weeklyAmount || status.budget / Math.max(1, daysBetween(plan.periodStart, until.typical) + 1) * 7) / 7;
      spare += Math.max(0, status.remaining - perDay * daysLeft);
    } else if (status.spent > 0) {
      spare += status.remaining;
    }
  }
  const leftTotal = made.reduce((sum, item) => sum + item.left, 0);
  const goal = data.savings.filter((item) => item.target > item.current).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))[0];
  return {
    payday: until.typical,
    daysLeft: until.days,
    made: made.sort((a, b) => b.left - a.left),
    over: over.sort((a, b) => b.over - a.over),
    leftTotal: Math.round(leftTotal * 100) / 100,
    // Ce s-a depășit într-un plic a fost luat din altă parte: se scade din surplus.
    spare: Math.max(0, Math.floor((spare - over.reduce((sum, item) => sum + item.over, 0)) / 10) * 10),
    goal: goal ? { id: goal.id, name: goal.name, left: Math.round((goal.target - goal.current) * 100) / 100 } : undefined,
  };
};

export const envelopeLane = (data: AppData, asOf = isoToday()) => data.settings.salaryPlan.allocations
  .map((item) => ({ item, ...envelopeDecisionStatus(data, item, asOf) }))
  .sort((left, right) => (right.state === "over" ? 2 : right.state === "watch" ? 1 : 0) - (left.state === "over" ? 2 : left.state === "watch" ? 1 : 0) || right.usage - left.usage)
  .slice(0, 8);

export type EnvelopeBurnPace = {
  allocationId: string;
  label: string;
  budget: number;
  spent: number;
  remaining: number;
  usage: number;
  expectedUsage: number;
  delta: number;
  pace: "ahead" | "on_track" | "behind" | "over";
  reason: string;
  elapsedDays: number;
  totalDays: number;
};

/**
 * Compară consumul plicului cu ritmul calendaristic al ciclului.
 * „în avans” = ai cheltuit mai puțin decât proporția zilelor scurse; „în urmă” = mai mult.
 * Toleranță ±8pp ca să nu alarmeze pe zgomot zilnic.
 */
export const envelopeBurnPace = (data: AppData, asOf = isoToday()): EnvelopeBurnPace[] => {
  const track = paydayTrack(data, asOf);
  const expectedUsage = track ? Math.min(1, track.elapsed / track.total) : 0;
  const totalDays = track?.total ?? 0;
  const elapsedDays = track?.elapsed ?? 0;
  return data.settings.salaryPlan.allocations.map((item) => {
    const status = allocationStatus(data, item);
    const usage = status.usage;
    let pace: EnvelopeBurnPace["pace"] = "on_track";
    if (status.remaining < 0 || usage >= 1) pace = "over";
    else if (!track) pace = usage >= (item.alertThreshold ?? 80) / 100 ? "behind" : "on_track";
    else if (usage > expectedUsage + 0.08) pace = "behind";
    else if (usage < expectedUsage - 0.08) pace = "ahead";
    const delta = Math.round((expectedUsage - usage) * 100);
    const reason = !track
      ? t("Setează perioada până la venit ca să comparăm ritmul cu calendarul.")
      : pace === "over"
        ? t("Plicul e depășit — mută lei din alt plic sau reduce cheltuielile.")
        : pace === "behind"
          ? t("Ai consumat {usage}% din plic, dar ciclul e doar la {expected}%.", { usage: Math.round(usage * 100), expected: Math.round(expectedUsage * 100) })
          : pace === "ahead"
            ? t("Ești cu ~{delta}pp sub ritmul zilelor scurse — poți folosi cu calm.", { delta: Math.abs(delta) })
            : t("Consumul ({usage}%) e aliniat cu zilele scurse ({expected}%).", { usage: Math.round(usage * 100), expected: Math.round(expectedUsage * 100) });
    return {
      allocationId: item.id,
      label: item.label,
      budget: status.budget,
      spent: status.spent,
      remaining: status.remaining,
      usage,
      expectedUsage,
      delta,
      pace,
      reason,
      elapsedDays,
      totalDays,
    };
  }).sort((a, b) => {
    const rank = (p: EnvelopeBurnPace["pace"]) => (p === "over" ? 3 : p === "behind" ? 2 : p === "on_track" ? 1 : 0);
    return rank(b.pace) - rank(a.pace) || b.usage - a.usage;
  });
};


export type EnvelopeRunOut = {
  allocationId: string;
  label: string;
  remaining: number;
  /** Media pe zi de la începutul ciclului. */
  dailyRate: number;
  /** Ziua în care, la ritmul ăsta, plicul ajunge la zero. */
  runOutDate: string;
  /** Câte zile rămân fără bani în plic până la salariu. */
  daysShort: number;
  /** Cât se poate cheltui pe zi, de azi până la salariu, ca plicul să ajungă. */
  safeDaily: number;
  payday: string;
};

/**
 * Plicurile care, la ritmul de până acum, se golesc înainte de salariu. Alerta de prag spune
 * „ai folosit 80%”; asta spune „pe 3 octombrie rămâi fără, cu 7 zile înainte de venit” — cu
 * măcar 3 zile de ciclu scurse, ca un singur plin de cumpărături să nu sune alarma.
 */
export const envelopeRunOut = (data: AppData, asOf = isoToday()): EnvelopeRunOut[] => {
  const track = paydayTrack(data, asOf);
  if (!track || track.elapsed < 3 || track.remaining < 2) return [];
  const out: EnvelopeRunOut[] = [];
  // Când săptămâna plicului merge deja prea repede, avertizarea ei spune cifra de azi; a doua
  // cifră, pe tot ciclul, ar contrazice-o pe același ecran.
  const fast = new Set(weekTooFast(data, asOf).map((item) => item.allocationId));
  for (const item of data.settings.salaryPlan.allocations) {
    if (fast.has(item.id)) continue;
    const status = allocationStatus(data, item);
    if (status.spent <= 0 || status.remaining <= 0) continue;
    const dailyRate = status.spent / track.elapsed;
    const daysLeft = status.remaining / dailyRate;
    const daysShort = Math.floor(track.remaining - daysLeft);
    if (daysShort < 2) continue;
    out.push({
      allocationId: item.id,
      label: item.label,
      remaining: status.remaining,
      dailyRate: Math.round(dailyRate * 100) / 100,
      runOutDate: addIsoDays(asOf, Math.max(0, Math.floor(daysLeft))),
      daysShort,
      safeDaily: Math.floor((status.remaining / (track.remaining + 1)) * 100) / 100,
      payday: track.end,
    });
  }
  return out.sort((a, b) => b.daysShort - a.daysShort);
};

export type SavingsSuggestion = {
  goalId: string;
  left: number;
  /** Suma propusă pe lună, rotunjită la leu (cu termen) sau la 10 lei (fără termen). */
  monthly: number;
  months: number;
  /** Luna în care se atinge ținta la ritmul propus. */
  eta: string;
  /** Media lunară „venit − cheltuieli” din ultimele 3 luni întregi; lipsește fără date. */
  surplus?: number;
  /** Suma pe lună trece de ce rămâne de obicei în casă. */
  stretch: boolean;
  basis: "deadline" | "surplus";
};

/** Ce rămâne în medie pe lună (venit − cheltuieli) în ultimele 3 luni întregi cu mișcări. */
export const monthlySurplus = (data: AppData, asOf = isoToday()): number | undefined => {
  const months: number[] = [];
  let month = previousMonth(asOf.slice(0, 7));
  for (let step = 0; step < 3; step += 1) {
    const range = monthRange(month);
    const entries = data.transactions.filter((item) => item.date >= range.start && item.date <= range.end);
    if (entries.length) months.push(entries.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : item.kind === "expense" ? -item.amount : 0), 0));
    month = previousMonth(month);
  }
  return months.length ? months.reduce((sum, value) => sum + value, 0) / months.length : undefined;
};

/**
 * Cât să pui deoparte pe lună pentru un obiectiv. Cu termen: ce lipsește împărțit la lunile
 * rămase. Fără termen: o sumă confortabilă — cam 30% din ce rămâne de obicei la final de lună —
 * și luna în care ajungi. În ambele cazuri spune dacă suma trece de ce rămâne de obicei.
 */
export const savingsSuggestion = (data: AppData, goal: SavingsGoal, asOf = isoToday()): SavingsSuggestion | undefined => {
  const left = Math.round((goal.target - goal.current) * 100) / 100;
  if (left <= 0) return undefined;
  const surplus = monthlySurplus(data, asOf);
  const etaFor = (months: number) => {
    const date = new Date(`${asOf}T12:00:00`);
    date.setMonth(date.getMonth() + months);
    return isoDate(date).slice(0, 7);
  };
  if (goal.dueDate && goal.dueDate > asOf) {
    // Luni calendaristice întregi: 25 sept. → 25 ian. înseamnă 4, nu 122 / 30,44 zile.
    const [y1, m1, d1] = asOf.split("-").map(Number);
    const [y2, m2, d2] = goal.dueDate.split("-").map(Number);
    const months = Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
    const monthly = Math.ceil(left / months);
    return { goalId: goal.id, left, monthly, months, eta: goal.dueDate.slice(0, 7), surplus, stretch: surplus !== undefined && monthly > Math.max(0, surplus), basis: "deadline" };
  }
  if (!surplus || surplus <= 0) return undefined;
  const monthly = Math.min(Math.ceil(left), Math.max(50, Math.round((surplus * 0.3) / 10) * 10));
  const months = Math.max(1, Math.ceil(left / monthly));
  return { goalId: goal.id, left, monthly, months, eta: etaFor(months), surplus, stretch: false, basis: "surplus" };
};

export type TodayDue = {
  id: string;
  kind: "recurring" | "debt";
  name: string;
  amount: number;
  dueDate: string;
  daysLeft: number;
  confirmable: boolean;
};

export type TodayBrief = {
  spendable: number;
  remainingDays: number;
  hasPayday: boolean;
  /** Ciclul s-a încheiat și nu a fost reînnoit: cifra zilei nu mai are pe ce sta. */
  expired: boolean;
  reason: string;
  dues: TodayDue[];
  hunts: SubscriptionDetection[];
  closeSoon: boolean;
};

/**
 * Cât poți cheltui azi. O singură regulă, cu plicuri sau fără: partea zilei = banii de la
 * începutul zilei împărțiți pe zilele rămase, iar ce cheltui azi scade din partea de azi.
 * Mâine, ce a rămas se reîmparte. Când există plicuri cu ritm, banii sunt cei din plicul
 * săptămânii; fără plicuri, lichidul prudent până la venit (după scadențe și rate).
 */
export const todayBrief = (data: AppData, asOf = isoToday()): TodayBrief => {
  const hasPayday = Boolean(data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday);
  /** Un plan expirat nu mai are ce ritm să dea: cifra corectă e zero, iar motivul e altul. */
  const expired = planExpired(data.settings.salaryPlan, asOf);
  const forecast = planForecast(data, asOf);
  const safe = liquidSafeToSpend(data, asOf);
  const remainingDays = Math.max(1, forecast.remainingDays);
  const plan = data.settings.salaryPlan;
  const spentToday = data.transactions.filter((item) => item.kind === "expense" && item.date === asOf && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  /** Partea de azi, socotită din banii de la începutul zilei; cheltuiala de azi o micșorează leu cu leu. */
  const dayShareLeft = (moneyNowAfterToday: number) => Math.max(0, (moneyNowAfterToday + spentToday) / remainingDays - spentToday);
  const fromPace = dayShareLeft(Math.max(0, forecast.safeDaily) * remainingDays);
  const fromLiquid = dayShareLeft(Math.max(0, safe.available));
  const rhythm = weeklyEnvelopeDailyRhythm(data, asOf);
  const fromWeek = rhythm.hasWeekly ? Math.max(0, rhythm.todayLeft) : undefined;
  const spendable = hasPayday && !expired ? Math.max(0, Math.min(fromWeek ?? fromPace, fromLiquid, safe.available)) : 0;
  const reason = !hasPayday
    ? t("Setează următorul venit sau, la venituri neregulate, câte zile să-ți ajungă banii (Plan), ca să calculăm cât poți cheltui azi.")
    : expired
      ? t("Ciclul s-a încheiat pe {date} — pornește ciclul nou ca să-ți spun din nou ritmul zilei.", { date: formatDate(planEndDate(data.settings.salaryPlan)) })
      : spendable <= 0 && remainingDays > 1 && (fromWeek != null ? rhythm.remaining : safe.available) > 0
      ? t("Azi ai folosit partea zilei. De mâine: {daily} lei/zi ({available} pe {days}).", fromWeek != null
        ? { daily: stripLei(rhythm.futureShare, getLocale()), available: stripLei(rhythm.remaining, getLocale()), days: daysLabel(Math.max(1, rhythm.remainingDays - 1)) }
        : { daily: stripLei(safe.available / (remainingDays - 1), getLocale()), available: stripLei(safe.available, getLocale()), days: daysLabel(remainingDays - 1) })
      : spendable <= 0
      ? t("Ritmul sigur e 0 — verifică plicurile sau scadențele rezervate.")
      : fromWeek != null
        ? t("Ritm {pace} lei/zi, din {available} rămași în plicul săptămânii, pe {days}.", { pace: stripLei(fromWeek, getLocale()), available: stripLei(rhythm.remaining, getLocale()), days: daysLabel(rhythm.remainingDays) })
        : t("Ritm {pace} lei/zi, din {available} disponibili pe {days}.", { pace: stripLei(fromPace, getLocale()), available: stripLei(safe.available, getLocale()), days: daysLabel(remainingDays) });

  const horizonDate = new Date(`${asOf}T12:00:00`);
  horizonDate.setDate(horizonDate.getDate() + 7);
  const horizon = isoDate(horizonDate);
  const dues: TodayDue[] = [
    ...pendingRecurringInPlan(data)
      .filter((item) => item.dueDate <= horizon)
      .map((item) => ({
        id: item.id,
        kind: "recurring" as const,
        name: item.name,
        amount: item.amount,
        dueDate: item.dueDate,
        daysLeft: daysBetween(asOf, item.dueDate),
        confirmable: true,
      })),
    ...data.debts
      .filter((item) => item.dueDate && item.dueDate <= horizon)
      .map((item) => ({
        id: item.id,
        kind: "debt" as const,
        name: item.name,
        amount: item.monthly || item.remaining,
        dueDate: item.dueDate as string,
        daysLeft: daysBetween(asOf, item.dueDate as string),
        confirmable: false,
      })),
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate) || right.amount - left.amount).slice(0, 4);

  return {
    spendable,
    remainingDays,
    hasPayday,
    expired,
    reason,
    dues,
    hunts: detectSubscriptions(data, asOf).slice(0, 2),
    closeSoon: hasPayday && remainingDays <= 2,
  };
};

/** Hero pe drumul „doar urmăresc”: fără payday, fără plicuri. */
export function trackModeHero(input: { periodIncome: number; liquidNow: number; spentToday: number }): {
  kind: "income" | "liquid" | "spent" | "empty";
  value: number;
} {
  if (input.periodIncome > 0) return { kind: "income", value: input.periodIncome };
  if (input.liquidNow > 0) return { kind: "liquid", value: input.liquidNow };
  if (input.spentToday > 0) return { kind: "spent", value: input.spentToday };
  return { kind: "empty", value: 0 };
}

export type SafeSpendBreakdown = {
  spendable: number;
  hasPayday: boolean;
  remainingDays: number;
  paydayDate: string;
  liquidFunds: number;
  reservedRecurring: number;
  availableAfterReserved: number;
  envelopeLeft: number;
  safeDaily: number;
  fromLiquidDaily: number;
  steps: Array<{ label: string; amount: number; note?: string }>;
  summary: string;
};

/** Formula explicabilă pentru „Poți folosi azi” — fără a scrie în AppData. */
export const safeSpendBreakdown = (data: AppData, asOf = isoToday()): SafeSpendBreakdown => {
  const brief = todayBrief(data, asOf);
  const safe = liquidSafeToSpend(data, asOf);
  const forecast = planForecast(data, asOf);
  const paydayDate = data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday || "";
  const remainingDays = Math.max(1, forecast.remainingDays);
  const fromLiquidDaily = Math.max(0, safe.available / remainingDays);
  const rhythm = weeklyEnvelopeDailyRhythm(data, asOf);
  const steps = rhythm.hasWeekly
    ? [
      { label: t("Rămas în plicul săptămânii"), amount: rhythm.remaining, note: t("Doar tranșa activă, nu tot cash-ul până la salariu") },
      { label: t("Limita de azi"), amount: rhythm.todayLeft, note: t("{days} rămase din săptămână", { days: daysLabel(rhythm.remainingDays) }) },
      { label: t("Lichid în surse"), amount: safe.liquidFunds },
      { label: t("Minus scadențe active"), amount: -safe.reservedRecurring },
    ]
    : [
      { label: t("Lichid în surse"), amount: safe.liquidFunds, note: t("Card, cash, bonuri — sold calculat local") },
      { label: t("Minus scadențe active"), amount: -safe.reservedRecurring, note: t("Chirie, abonamente și rate rezervate, încă neconfirmate") },
      { label: t("Disponibil prudent"), amount: safe.available },
      { label: t("Ritm sigur din plan"), amount: forecast.safeDaily, note: t("Ce rămâne după plicuri și cheltuieli, pe zi") },
      { label: t("Lichid ÷ zile rămase"), amount: fromLiquidDaily, note: t("{days} până la venit", { days: daysLabel(remainingDays) }) },
    ];
  const summary = !brief.hasPayday
    ? t("Fără dată de venit nu putem calcula un reper zilnic. Setează salariul în Plan.")
    : rhythm.hasWeekly
      ? t("Reperul zilei ({amount}) e limita de azi din plicurile săptămânii. Banii fără plic nu măresc cifra.", { amount: lei(brief.spendable) })
      : t("Reperul zilei ({amount}): banii de la începutul zilei, după scadențe și rate, împărțiți pe zilele până la venit. Ce cheltui azi scade din el; mâine restul se reîmparte. Nu e un sold bancar.", { amount: lei(brief.spendable) });
  return {
    spendable: brief.spendable,
    hasPayday: brief.hasPayday,
    remainingDays,
    paydayDate,
    liquidFunds: safe.liquidFunds,
    reservedRecurring: safe.reservedRecurring,
    availableAfterReserved: safe.available,
    envelopeLeft: safe.envelopeLeft,
    safeDaily: forecast.safeDaily,
    fromLiquidDaily,
    steps,
    summary,
  };
};


const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const matchesAllocation = (item: Transaction, allocation: BudgetAllocation) => {
  if (item.kind !== "expense") return false;
  if (item.allocationId) return item.allocationId === allocation.id;
  return (!allocation.memberId || item.memberId === allocation.memberId)
    && (!allocation.category || item.category === allocation.category)
    && (!allocation.sourceId || item.sourceId === allocation.sourceId);
};

export type EnvelopeMonth = { month: string; amount: number };

/**
 * Cât s-a cheltuit din plic în fiecare lună calendaristică, ultimele `count` luni (cea în curs
 * inclusă, ultima în listă). Media se face doar pe lunile întregi cu cheltuieli, ca o lună
 * abia începută sau una fără date să n-o strice.
 */
export const envelopeMonthlyHistory = (data: AppData, allocation: BudgetAllocation, asOf = isoToday(), count = 6) => {
  const base = new Date(`${asOf}T12:00:00`);
  const months: EnvelopeMonth[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(base.getFullYear(), base.getMonth() - back, 1, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const amount = data.transactions.filter((item) => item.date.startsWith(key) && matchesAllocation(item, allocation)).reduce((sum, item) => sum + item.amount, 0);
    months.push({ month: key, amount: roundMoney(amount) });
  }
  const full = months.slice(0, -1).filter((item) => item.amount > 0);
  const average = full.length ? roundMoney(full.reduce((sum, item) => sum + item.amount, 0) / full.length) : undefined;
  // Fără nicio cheltuială în afară de luna în curs, istoricul n-are ce arăta.
  return { months: months.filter((item, index) => item.amount > 0 || index === months.length - 1 || months.slice(0, index).some((prev) => prev.amount > 0)), average, fullMonths: full.length };
};

export type WeeklyEnvelopeDayRhythm = {
  day: string;
  weekday: number;
  out: number;
  left: number;
  share: number;
  isToday: boolean;
  isFuture: boolean;
  over: boolean;
  fill: number;
};

export type WeeklyEnvelopeRhythm = {
  days: WeeklyEnvelopeDayRhythm[];
  remaining: number;
  remainingDays: number;
  todayLeft: number;
  todayShare: number;
  futureShare: number;
  hasWeekly: boolean;
  todayOut: number;
};

const weekdayIndex = (day: string) => (new Date(`${day}T12:00:00`).getDay() + 6) % 7;

const mondayOf = (asOf: string) => addIsoDays(asOf, -weekdayIndex(asOf));

export type DayStripRow = { isToday: boolean; isFuture: boolean; left: number; out: number };

/**
 * Aceeași cifră pe banda de zile și pe cardul mare.
 * Azi arată ce mai poți folosi; viitorul, reperul; trecutul, cheltuiala reală.
 */
export function dayStripFigure(row: DayStripRow, todaySpendable: number, heroTracksWeek: boolean): number {
  if (row.isToday) return heroTracksWeek ? todaySpendable : row.left;
  if (row.isFuture) return row.left;
  return row.out;
}

/** Fără rotunjire la leu: 250,50 rămâne 250,50, nu 251. */
export function stripLei(value: number, locale: string): string {
  const n = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  const whole = Math.abs(n - Math.round(n)) < 0.001;
  return n.toLocaleString(locale, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

/**
 * Cât mai ține fiecare zi din tranșa activă.
 *
 * Banda urmează exact cele șapte zile ale tranșei (de exemplu miercuri–marți),
 * nu săptămâna calendaristică luni–duminică. Restul se împarte pe zilele rămase
 * din aceeași tranșă, ca suma căsuțelor de azi și de mâine să fie plicul rămas.
 */
export const weeklyEnvelopeDailyRhythm = (data: AppData, asOf = isoToday()): WeeklyEnvelopeRhythm => {
  const plan = data.settings.salaryPlan;
  const weekly = plan.allocations.filter((item) => isWeeklyPaced(item, plan));
  const packs = weekly.map((allocation) => {
    const weeks = allocationWeeksStatus(data, allocation);
    const current = weeks.find((week) => asOf >= week.start && asOf <= week.end);
    return { weeks, current };
  });
  const active = packs.flatMap((pack) => pack.current ? [pack.current] : []);
  const remainingRaw = active.reduce((sum, week) => sum + week.remaining, 0);
  const trancheStart = active.length ? active.reduce((min, week) => week.start < min ? week.start : min, active[0].start) : "";
  const trancheEnd = active.length ? active.reduce((max, week) => week.end > max ? week.end : max, active[0].end) : "";
  const hasTranche = Boolean(trancheStart && trancheEnd);
  const gridStart = mondayOf(asOf);
  const windowStart = hasTranche ? trancheStart : gridStart;
  const windowEnd = hasTranche ? trancheEnd : addIsoDays(gridStart, 6);
  const inside = (day: string) => day >= windowStart && day <= windowEnd;
  const listed: string[] = [];
  const cursor = hasTranche ? asOf : windowStart;
  const cursorEnd = hasTranche ? windowEnd : windowEnd;
  for (let day = cursor; day && day <= cursorEnd && listed.length < 14; day = addIsoDays(day, 1)) listed.push(day);
  const spentByDay = listed.map((day) => {
    const out = data.transactions.filter((item) => item.date === day && weekly.some((allocation) => matchesAllocation(item, allocation))).reduce((sum, item) => sum + item.amount, 0);
    return { day, out };
  });
  const todayIndex = Math.max(0, spentByDay.findIndex((item) => item.day === asOf));
  const calendarRemainingDays = 7 - todayIndex;
  const todayIsInside = inside(asOf);
  const remainingDays = todayIsInside ? daysBetween(asOf, windowEnd) + 1 : calendarRemainingDays;
  const todayOut = spentByDay[todayIndex]?.out ?? 0;
  const countedToday = todayIsInside ? todayOut : 0;
  const startOfToday = remainingRaw + countedToday;
  const todayShareRaw = remainingDays > 0 ? startOfToday / remainingDays : 0;
  const todayLeftRaw = Math.max(0, todayShareRaw - countedToday);
  const futureDays = Math.max(0, remainingDays - 1);
  const futureShareRaw = futureDays > 0 ? Math.max(0, remainingRaw - todayLeftRaw) / futureDays : 0;
  const trancheSpent = active.reduce((sum, week) => sum + week.spent, 0);
  const trancheDays = Math.max(1, daysBetween(windowStart, windowEnd) + 1);
  const pastShareRaw = hasTranche
    ? (remainingRaw + trancheSpent) / trancheDays
    : (remainingRaw + spentByDay.reduce((sum, item) => sum + item.out, 0)) / 7;
  const otherWeek = (day: string) => {
    let budget = 0;
    let remaining = 0;
    let days = 0;
    for (const pack of packs) {
      const week = pack.weeks.find((item) => day >= item.start && day <= item.end);
      if (!week) continue;
      budget += week.budget;
      remaining += week.remaining;
      days = week.days;
    }
    return { budget, remaining, days };
  };
  const days = spentByDay.map((row) => {
    const weekday = weekdayIndex(row.day);
    const isToday = row.day === asOf;
    const isFuture = row.day > asOf;
    let shareRaw: number;
    let leftRaw: number;
    if (hasTranche && !inside(row.day)) {
      const other = otherWeek(row.day);
      shareRaw = other.days > 0 ? (isFuture ? other.remaining : other.budget) / other.days : 0;
      leftRaw = isFuture ? shareRaw : Math.max(0, shareRaw - row.out);
    } else {
      shareRaw = isFuture ? futureShareRaw : isToday ? todayShareRaw : pastShareRaw;
      leftRaw = isFuture ? futureShareRaw : isToday ? todayLeftRaw : Math.max(0, pastShareRaw - row.out);
    }
    const over = !isFuture && shareRaw > 0 && row.out > shareRaw + 0.009;
    const fill = shareRaw <= 0
      ? (row.out > 0 ? 100 : 0)
      : isFuture
        ? (shareRaw > 0 ? 36 : 0)
        : Math.max(0, Math.min(100, (row.out / shareRaw) * 100));
    return { day: row.day, weekday, out: roundMoney(row.out), left: roundMoney(leftRaw), share: roundMoney(shareRaw), isToday, isFuture, over, fill };
  });
  return {
    days,
    remaining: roundMoney(Math.max(0, remainingRaw)),
    remainingDays,
    todayLeft: roundMoney(todayLeftRaw),
    todayShare: roundMoney(todayShareRaw),
    futureShare: roundMoney(futureShareRaw),
    hasWeekly: weekly.length > 0 && hasTranche,
    todayOut: roundMoney(todayOut),
  };
};

export type WeeklyCheckInEnvelope = {
  id: string;
  label: string;
  planned: number;
  spent: number;
  remaining: number;
  usage: number;
  state: "healthy" | "watch" | "over";
};

export type WeeklyCheckInMember = {
  memberId: string;
  name: string;
  expense: number;
  income: number;
  share: number;
};

export type WeeklyCheckIn = {
  start: string;
  end: string;
  income: number;
  expense: number;
  cashflow: number;
  transactionCount: number;
  categories: Array<[string, number]>;
  envelopes: WeeklyCheckInEnvelope[];
  members: WeeklyCheckInMember[];
  nextStep: string;
  tone: "good" | "watch" | "risk" | "empty";
  shouldPrompt: boolean;
  familyName: string;
};

const lei = (value: number) => `${Math.round(value).toLocaleString("ro-RO")} lei`;
/** Ca `lei`, dar cu bani când există: cifra pe zi trebuie să fie aceeași ca pe Astăzi (37,50). */
const leiCents = (value: number) => `${value.toLocaleString("ro-RO", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} lei`;

/**
 * Bilanțul săptămânii de familie: luni–duminică, planificat vs realizat pe plic, fără scriere în AppData.
 */
export const weeklyCheckIn = (data: AppData, asOf = isoToday(), memberId?: string): WeeklyCheckIn => {
  const summary = weeklySummary(data, asOf, memberId);
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  const planDays = end ? Math.max(1, daysBetween(plan.periodStart, end) + 1) : 7;
  const weekTx = data.transactions.filter((item) => item.date >= summary.start && item.date <= summary.end && (!memberId || item.memberId === memberId));
  // Aceeași regulă ca avertizarea de pe Astăzi: o săptămână care merge prea repede e „atenție”, nu „în ritm”.
  const fastIds = new Set(weekTooFast(data, asOf).map((item) => item.allocationId));
  const envelopes = plan.allocations.map((allocation) => {
    const cycleBudget = allocationBudget(data, allocation);
    const weekStatus = isWeeklyPaced(allocation, plan) ? allocationWeekStatus(data, allocation, asOf) : undefined;
    const calendarSpent = roundMoney(weekTx.filter((item) => matchesAllocation(item, allocation)).reduce((sum, item) => sum + item.amount, 0));
    const planned = roundMoney(weekStatus ? weekStatus.budget : cycleBudget * Math.min(7, planDays) / planDays);
    // La plicurile cu ritm, cheltuiala din tranșă contează și dacă a căzut în săptămâna
    // calendaristică anterioară. Altfel restul arătat luni uită ce s-a cheltuit marțea trecută.
    const spent = roundMoney(weekStatus ? weekStatus.spent : calendarSpent);
    const remaining = roundMoney(weekStatus ? weekStatus.remaining : planned - spent);
    const usage = planned > 0 ? spent / planned : spent > 0 ? 1 : 0;
    const alertThreshold = Math.min(95, Math.max(50, allocation.alertThreshold ?? 80));
    const state = remaining < 0 || (planned <= 0 && spent > 0) ? "over" as const : usage >= alertThreshold / 100 || fastIds.has(allocation.id) ? "watch" as const : "healthy" as const;
    return { id: allocation.id, label: allocation.label, planned, spent, remaining, usage, state };
  }).sort((left, right) => (right.state === "over" ? 2 : right.state === "watch" ? 1 : 0) - (left.state === "over" ? 2 : left.state === "watch" ? 1 : 0) || right.spent - left.spent);

  const familyExpense = weekTx.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const members = data.settings.members.map((member) => {
    const entries = weekTx.filter((item) => item.memberId === member.id);
    const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    return { memberId: member.id, name: member.name, expense, income, share: familyExpense > 0 ? expense / familyExpense : 0 };
  }).sort((left, right) => right.expense - left.expense);

  const over = envelopes.filter((item) => item.state === "over");
  const watch = envelopes.filter((item) => item.state === "watch");
  const weekday = new Date(`${asOf}T12:00:00`).getDay();
  const weekend = weekday === 0 || weekday >= 5;
  const empty = summary.transactionCount === 0;
  const tone = empty ? "empty" as const : over.length || summary.cashflow < 0 ? "risk" as const : watch.length ? "watch" as const : "good" as const;
  const nextStep = empty
    ? t("Înregistrează mișcări ca să ai un bilanț de trimis familiei.")
    : over[0]
      ? t("Mută lei în {label} sau încetinește cheltuielile din acest plic ({amount} peste plan).", { label: over[0].label, amount: lei(Math.abs(over[0].remaining)) })
      : summary.cashflow < 0 && summary.income > 0
        ? t("Cheltuielile au trecut peste veniturile săptămânii. Amână o plată neesențială.")
        : watch[0]
          ? t("Urmărește {label} — s-a consumat {percent}% din tranșa săptămânii.", { label: watch[0].label, percent: Math.round(watch[0].usage * 100) })
          : t("Săptămâna e în ritm. Poți trimite bilanțul familiei.");

  return {
    start: summary.start,
    end: summary.end,
    income: summary.income,
    expense: summary.expense,
    cashflow: summary.cashflow,
    transactionCount: summary.transactionCount,
    categories: summary.categories,
    envelopes,
    members,
    nextStep,
    tone,
    shouldPrompt: weekend && !empty,
    familyName: data.settings.familyName || t("Familie"),
  };
};

/** Text de trimis pe WhatsApp sau copiat — fără poze, fără date de sync. */

/**
 * Propunerea concretă de reechilibrare a check-in-ului: din ce plic, în ce plic și cât.
 * „Mută lei în Alimente” este un sfat; „mută 120 lei din Timp liber în Alimente” este o
 * acțiune. Suma este limitată de ce a rămas efectiv în plicul donator, ca transferul să
 * fie acceptat de `transferBetweenEnvelopes` și să nu creeze un al doilea deficit.
 */
export type CheckInRebalance = {
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  amount: number;
  deficit: number;
  covers: boolean;
};

export const checkInRebalance = (data: AppData): CheckInRebalance | undefined => {
  const allocations = data.settings.salaryPlan.allocations || [];
  if (allocations.length < 2) return undefined;
  const status = allocations.map((allocation) => ({ allocation, ...allocationStatus(data, allocation) }));
  // Deficitul și donatorul se măsoară pe ciclu, nu pe săptămână: limitele plicurilor sunt ale ciclului.
  const short = status.filter((item) => item.remaining < -0.005).sort((left, right) => left.remaining - right.remaining)[0];
  if (!short) return undefined;
  const donor = status
    .filter((item) => item.allocation.id !== short.allocation.id && item.remaining > 0.005)
    .sort((left, right) => right.remaining - left.remaining)[0];
  if (!donor) return undefined;
  const deficit = roundMoney(Math.abs(short.remaining));
  const amount = roundMoney(Math.min(deficit, donor.remaining));
  if (amount <= 0) return undefined;
  return {
    fromId: donor.allocation.id,
    fromLabel: donor.allocation.label,
    toId: short.allocation.id,
    toLabel: short.allocation.label,
    amount,
    deficit,
    covers: amount >= deficit - 0.005,
  };
};


export type AnalysisCompareWindow = {
  mode: "calendar" | "cycle";
  start: string;
  end: string;
  priorStart: string;
  priorEnd: string;
  title: string;
};

/**
 * Fereastra de comparație pentru Analiză.
 * Calendar = luna civilă (implicit). Ciclu = periodStart → nextPayday,
 * comparat cu intervalul anterior de aceeași lungime — evită alarma falsă
 * „cheltuieli fără venit” între 1 și ziua de salariu.
 */
export function analysisCompareWindow(
  plan: Pick<SalaryPlan, "periodStart" | "nextPayday" | "earliestPayday" | "paydayFlexDays">,
  focusMonth: string,
  mode: "calendar" | "cycle",
): AnalysisCompareWindow {
  const cycleEnd = planEndDate(plan as SalaryPlan);
  if (mode === "cycle" && plan.periodStart && cycleEnd) {
    const start = plan.periodStart;
    const end = cycleEnd < start ? start : cycleEnd;
    const length = Math.max(1, Math.round((new Date(`${end}T12:00:00`).valueOf() - new Date(`${start}T12:00:00`).valueOf()) / 86_400_000) + 1);
    const priorEnd = addIsoDays(start, -1);
    const priorStart = addIsoDays(priorEnd, -(length - 1));
    return {
      mode: "cycle",
      start,
      end,
      priorStart,
      priorEnd,
      title: `${formatDate(start, { day: "2-digit", month: "short" })} – ${formatDate(end, { day: "2-digit", month: "short" })}`,
    };
  }
  const range = monthRange(focusMonth);
  const prior = monthRange(previousMonth(focusMonth));
  return {
    mode: "calendar",
    start: range.start,
    end: range.end,
    priorStart: prior.start,
    priorEnd: prior.end,
    title: monthTitle(focusMonth),
  };
}

export const weeklyDigestHeadline = (data: AppData, asOf = isoToday()) => {
  const check = weeklyCheckIn(data, asOf);
  const over = check.envelopes.filter((item) => item.state === "over");
  if (!check.transactionCount) {
    return { tone: "watch" as const, title: t("Săptămâna e încă goală în registru"), detail: check.nextStep };
  }
  if (over.length) {
    return {
      tone: "risk" as const,
      title: t("{count} plicuri peste plan săptămâna asta", { count: over.length }),
      detail: t("{label} cere atenție · {step}", { label: over[0].label, step: check.nextStep }),
    };
  }
  if (check.cashflow < 0) {
    return {
      tone: "watch" as const,
      title: t("Cheltuielile depășesc veniturile cu {amount}", { amount: lei(Math.abs(check.cashflow)) }),
      detail: check.nextStep,
    };
  }
  const top = check.categories[0];
  return {
    tone: "good" as const,
    title: top ? t("Cel mai mult: {category} ({amount})", { category: top[0], amount: lei(Number(top[1])) }) : t("Săptămâna e în ritm"),
    detail: check.nextStep,
  };
};

/**
 * Rândurile de adăugat la bilanțul trimis familiei: câte zile mai sunt până la salariu,
 * ce plicuri merg prea repede săptămâna asta și ce transferuri mai sunt de făcut.
 */
export const familyWeekExtras = (data: AppData, asOf = isoToday()): string[] => {
  const lines: string[] = [];
  const until = untilPayday(data.settings.salaryPlan, asOf);
  if (until && until.days > 0) lines.push(t("Până la salariu: {days} (~{date}).", { days: daysLabel(until.days), date: formatDate(until.typical, { day: "numeric", month: "long" }) }));
  for (const item of weekTooFast(data, asOf).slice(0, 3)) {
    lines.push(item.over
      ? t("{label}: săptămâna e depășită cu {amount}.", { label: item.label, amount: lei(-item.remaining) })
      : t("{label}: {spent} din {budget}, cel mult {perDay} pe zi până la capătul săptămânii.", { label: item.label, spent: lei(item.spent), budget: lei(item.budget), perDay: leiCents(item.perDay) }));
  }
  const members = data.settings.members;
  for (const entry of members.length > 1 ? pendingTransfers(data, asOf) : []) {
    lines.push(t("De trimis: {amount} către {name} ({labels}).", { amount: lei(entry.amount), name: members.find((item) => item.id === entry.toMemberId)?.name || "", labels: entry.labels.join(", ") }));
  }
  return lines;
};

export const formatWeeklyCheckInShare = (check: WeeklyCheckIn, rebalance?: CheckInRebalance) => {
  const range = `${formatDate(check.start, { day: "2-digit", month: "short" })} – ${formatDate(check.end, { day: "2-digit", month: "short" })}`;
  const lines = [
    t("{family} · bilanț {range}", { family: check.familyName, range }),
    t("Venituri {amount}", { amount: lei(check.income) }),
    t("Cheltuieli {amount}", { amount: lei(check.expense) }),
    t("Diferență {sign}{amount}", { sign: check.cashflow >= 0 ? "+" : "−", amount: lei(Math.abs(check.cashflow)) }),
  ];
  if (check.members.length > 1 && check.expense > 0) {
    lines.push(check.members.filter((item) => item.expense > 0).map((item) => `${item.name} ${lei(item.expense)}`).join(" · "));
  }
  if (check.envelopes.some((item) => item.spent > 0 || item.planned > 0)) {
    lines.push("", t("Plicuri (planificat → cheltuit)"));
    check.envelopes.slice(0, 8).forEach((item) => {
      const mark = item.state === "over" ? t("peste") : item.state === "watch" ? t("atenție") : t("ok");
      lines.push(`${item.label}  ${lei(item.planned)} → ${lei(item.spent)}  (${mark})`);
    });
  }
  lines.push("", t("Următorul pas: {step}", { step: check.nextStep }));
  if (rebalance) {
    lines.push(t("Propunere: mută {amount} din {from} în {to}{partial}.", { amount: lei(rebalance.amount), from: rebalance.fromLabel, to: rebalance.toLabel, partial: rebalance.covers ? "" : t(" (acoperă parțial {deficit})", { deficit: lei(rebalance.deficit) }) }));
  }
  return lines.join("\n");
};


