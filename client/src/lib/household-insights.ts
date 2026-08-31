/**
 * Analize de gospodărie calculate numai din registrul local.
 * Nu persistă nimic în AppData și nu ating pachetul Firebase.
 */
import {
  allocationBudget,
  allocationStatus,
  allocationWeekStatus,
  financialBalance,
  formatDate,
  isoToday,
  newId,
  pendingRecurringInPlan,
  planEndDate,
  planForecast,
  weeklySummary,
  type AppData,
  type BudgetAllocation,
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

export const lastDaysPulse = (data: AppData, days = 7, asOf = isoToday()) => {
  const basis = new Date(`${asOf}T12:00:00`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(basis);
    date.setDate(basis.getDate() - (days - 1 - index));
    const iso = date.toISOString().slice(0, 10);
    const entries = data.transactions.filter((item) => item.date === iso);
    const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    return {
      date: iso,
      weekday: new Intl.DateTimeFormat("ro-RO", { weekday: "short" }).format(date).replace(".", ""),
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

export const envelopeLane = (data: AppData) => data.settings.salaryPlan.allocations
  .map((item) => ({ item, ...allocationStatus(data, item) }))
  .sort((left, right) => (right.state === "over" ? 2 : right.state === "watch" ? 1 : 0) - (left.state === "over" ? 2 : left.state === "watch" ? 1 : 0) || right.usage - left.usage)
  .slice(0, 8);

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
  reason: string;
  dues: TodayDue[];
  hunts: SubscriptionDetection[];
  closeSoon: boolean;
};

/**
 * Cât poți cheltui azi fără să rupi ritmul până la venit.
 * Minim dintre ritmul sigur al planului și lichidul împărțit pe zilele rămase.
 * Nu scrie în AppData.
 */
export const todayBrief = (data: AppData, asOf = isoToday()): TodayBrief => {
  const hasPayday = Boolean(data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday);
  const forecast = planForecast(data, asOf);
  const safe = liquidSafeToSpend(data, asOf);
  const remainingDays = Math.max(1, forecast.remainingDays);
  const fromPace = Math.max(0, forecast.safeDaily);
  const fromLiquid = Math.max(0, safe.available / remainingDays);
  const spendable = hasPayday ? Math.max(0, Math.min(fromPace, fromLiquid)) : 0;
  const reason = !hasPayday
    ? "Setează următorul venit ca să calculăm cât poți cheltui azi."
    : spendable <= 0
      ? "Ritmul sigur e 0 — verifică plicurile sau scadențele rezervate."
      : `Ritm ${Math.round(fromPace)} lei/zi, din ${Math.round(safe.available)} disponibili pe ${remainingDays} zile.`;

  const horizonDate = new Date(`${asOf}T12:00:00`);
  horizonDate.setDate(horizonDate.getDate() + 7);
  const horizon = horizonDate.toISOString().slice(0, 10);
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
    reason,
    dues,
    hunts: detectSubscriptions(data, asOf).slice(0, 2),
    closeSoon: hasPayday && remainingDays <= 2,
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

/**
 * Bilanțul săptămânii de familie: luni–duminică, planificat vs realizat pe plic, fără scriere în AppData.
 */
export const weeklyCheckIn = (data: AppData, asOf = isoToday(), memberId?: string): WeeklyCheckIn => {
  const summary = weeklySummary(data, asOf, memberId);
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  const planDays = end ? Math.max(1, daysBetween(plan.periodStart, end) + 1) : 7;
  const weekTx = data.transactions.filter((item) => item.date >= summary.start && item.date <= summary.end && (!memberId || item.memberId === memberId));
  const envelopes = plan.allocations.map((allocation) => {
    const spent = roundMoney(weekTx.filter((item) => matchesAllocation(item, allocation)).reduce((sum, item) => sum + item.amount, 0));
    const cycleBudget = allocationBudget(data, allocation);
    const weekStatus = allocation.weeklyPace === false ? undefined : allocationWeekStatus(data, allocation, asOf);
    const planned = roundMoney(weekStatus ? weekStatus.budget : cycleBudget * Math.min(7, planDays) / planDays);
    const remaining = roundMoney(planned - spent);
    const usage = planned > 0 ? spent / planned : spent > 0 ? 1 : 0;
    const alertThreshold = Math.min(95, Math.max(50, allocation.alertThreshold ?? 80));
    const state = remaining < 0 || (planned <= 0 && spent > 0) ? "over" as const : usage >= alertThreshold / 100 ? "watch" as const : "healthy" as const;
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
    ? "Înregistrează mișcări ca să ai un bilanț de trimis familiei."
    : over[0]
      ? `Mută lei în ${over[0].label} sau încetinește cheltuielile din acest plic (${lei(Math.abs(over[0].remaining))} peste plan).`
      : summary.cashflow < 0 && summary.income > 0
        ? "Cheltuielile au trecut peste veniturile săptămânii. Amână o plată neesențială."
        : watch[0]
          ? `Urmărește ${watch[0].label} — s-a consumat ${Math.round(watch[0].usage * 100)}% din tranșa săptămânii.`
          : "Săptămâna e în ritm. Poți trimite bilanțul familiei.";

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
    familyName: data.settings.familyName || "Familie",
  };
};

/** Text de trimis pe WhatsApp sau copiat — fără poze, fără date de sync. */
export const formatWeeklyCheckInShare = (check: WeeklyCheckIn) => {
  const range = `${formatDate(check.start, { day: "2-digit", month: "short" })} – ${formatDate(check.end, { day: "2-digit", month: "short" })}`;
  const lines = [
    `${check.familyName} · bilanț ${range}`,
    `Venituri ${lei(check.income)}`,
    `Cheltuieli ${lei(check.expense)}`,
    `Diferență ${check.cashflow >= 0 ? "+" : "−"}${lei(Math.abs(check.cashflow))}`,
  ];
  if (check.members.length > 1 && check.expense > 0) {
    lines.push(check.members.filter((item) => item.expense > 0).map((item) => `${item.name} ${lei(item.expense)}`).join(" · "));
  }
  if (check.envelopes.some((item) => item.spent > 0 || item.planned > 0)) {
    lines.push("", "Plicuri (planificat → cheltuit)");
    check.envelopes.slice(0, 8).forEach((item) => {
      const mark = item.state === "over" ? "peste" : item.state === "watch" ? "atenție" : "ok";
      lines.push(`${item.label}  ${lei(item.planned)} → ${lei(item.spent)}  (${mark})`);
    });
  }
  lines.push("", `Următorul pas: ${check.nextStep}`);
  return lines.join("\n");
};


