/**
 * Analize de gospodărie calculate numai din registrul local.
 * Nu persistă nimic în AppData și nu ating pachetul Firebase.
 */
import {
  allocationStatus,
  financialBalance,
  isoToday,
  newId,
  type AppData,
  type RecurringPayment,
  type Transaction,
} from "./finance-data";

const fold = (value: string) => value.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
export const monthTitle = (month: string) => new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));

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
  const opening = data.settings.paymentSources.reduce((sum, source) => sum + Math.max(0, source.openingBalance), 0);
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
    ? "Înregistrează prima mișcare ca să ai un recapitulativ de închis."
    : envelopesOver
      ? "Ajustează plicurile depășite înainte să începi luna următoare."
      : cashflow < 0
        ? "Cheltuielile au trecut peste venit. Mută o limită sau amână o plată neesențială."
        : topCategory
          ? `Categoria ${topCategory.name} a condus luna. Verifică dacă plicul ei rămâne realist.`
          : "Luna e în echilibru. Poți închide ritualul și descărca PDF-ul.";
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

const merchantKey = (title: string) => fold(title).replace(/[^a-z0-9\s]/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");

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
};

const groceryCategories = new Set(["Alimente", "Consumabile copil", "Dulciuri", "Băuturi", "Apă"]);

/** Detectează comercianți care se repetă lunar, fără a crea scadențe până la confirmare. */
export const detectSubscriptions = (data: AppData, asOf = isoToday()): SubscriptionDetection[] => {
  const from = new Date(`${asOf}T12:00:00`);
  from.setDate(from.getDate() - 180);
  const start = from.toISOString().slice(0, 10);
  const tracked = new Set(data.recurring.map((item) => merchantKey(item.name)).filter(Boolean));
  const groups = new Map<string, Transaction[]>();
  data.transactions.filter((item) => item.kind === "expense" && item.date >= start && item.date <= asOf).forEach((item) => {
    const key = merchantKey(item.title);
    if (!key || key.length < 3) return;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  });
  const detections: SubscriptionDetection[] = [];
  groups.forEach((entries, key) => {
    if (tracked.has(key) || entries.length < 2) return;
    const dates = Array.from(new Set(entries.map((item) => item.date))).sort();
    if (dates.length < 2) return;
    const intervals = dates.slice(1).map((date, index) => daysBetween(dates[index], date)).filter((value) => value > 0);
    const intervalDays = Math.round(median(intervals));
    const amounts = entries.map((item) => item.amount);
    const typical = median(amounts);
    const similar = amounts.every((value) => Math.abs(value - typical) <= Math.max(4, typical * 0.22));
    const monthly = intervalDays >= 25 && intervalDays <= 40;
    const weekly = intervalDays >= 6 && intervalDays <= 9;
    const category = entries[0].category;
    const isGrocery = groceryCategories.has(category);
    const labeled = category === "Abonamente";
    if (isGrocery && !labeled) return;
    if (!similar) return;
    if (!labeled && !monthly && !(weekly && entries.length >= 4)) return;
    if (!labeled && dates.length < 3 && !monthly) return;
    const last = entries.sort((a, b) => b.date.localeCompare(a.date))[0];
    detections.push({
      key,
      name: last.title.replace(/\s+\d+[.,]?\d*\s*(lei|ron)?$/i, "").trim() || last.title,
      amount: Math.round(typical * 100) / 100,
      count: dates.length,
      intervalDays: intervalDays || 30,
      category: labeled ? "Abonamente" : category,
      sourceId: last.sourceId,
      memberId: last.memberId,
      lastDate: last.date,
      confidence: labeled || (monthly && dates.length >= 3) ? "high" : "medium",
      reason: labeled
        ? "Categoria Abonamente, cu sumă stabilă."
        : monthly
          ? `Apare cam la ${intervalDays} zile, cu sumă aproape identică.`
          : `Se repetă săptămânal de ${dates.length} ori.`,
    });
  });
  return detections.sort((a, b) => b.amount - a.amount).slice(0, 8);
};

export const recurringFromDetection = (data: AppData, detection: SubscriptionDetection): RecurringPayment | undefined => {
  const sourceId = detection.sourceId || data.settings.paymentSources[0]?.id;
  const memberId = detection.memberId || data.settings.members[0]?.id;
  if (!sourceId || !memberId || detection.amount <= 0) return undefined;
  const dueDay = Math.min(28, Math.max(1, Number(detection.lastDate.slice(8, 10)) || 1));
  return { id: newId("recurring"), name: detection.name, amount: detection.amount, category: detection.category, sourceId, memberId, dueDay, active: true, autoPost: false, note: "Adăugat din detectarea abonamentelor", updatedAt: new Date().toISOString() };
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
    window.localStorage.setItem(MONTH_CLOSE_KEY, JSON.stringify(all));
  }
  return record;
};

export const liquidSafeToSpend = (data: AppData, asOf = isoToday()) => {
  const balance = financialBalance(data);
  const pending = data.recurring.filter((item) => item.active).reduce((sum, item) => sum + item.amount, 0);
  const envelopeLeft = data.settings.salaryPlan.allocations.reduce((sum, item) => sum + Math.max(0, allocationStatus(data, item).remaining), 0);
  const available = Math.max(0, balance.liquidFunds - pending);
  return { liquidFunds: balance.liquidFunds, reservedRecurring: pending, envelopeLeft, available, asOf };
};
