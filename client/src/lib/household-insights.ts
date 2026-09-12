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
  type SalaryPlan,
  type Transaction,
  isoDate,
} from "./finance-data";
import { getLocale, t } from "./i18n";
import { safeSetItem } from "@/lib/safe-storage";

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

/** Activitate pe ciclul salarial (periodStart → nextPayday), nu pe luna calendar. */
export const householdActivityInCycle = (data: AppData, asOf = isoToday()): HouseholdActivity => {
  const plan = data.settings.salaryPlan;
  const start = plan.periodStart || `${asOf.slice(0, 7)}-01`;
  const end = plan.nextPayday && plan.nextPayday >= start ? plan.nextPayday : asOf;
  const cycleTx = data.transactions.filter((item) => item.date >= start && item.date <= end);
  const familyExpense = cycleTx.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const members = data.settings.members.map((member) => {
    const entries = cycleTx.filter((item) => item.memberId === member.id);
    const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { memberId: member.id, name: member.name, income, expense, count: entries.length, share: familyExpense > 0 ? expense / familyExpense : 0 };
  }).sort((a, b) => b.expense - a.expense);
  const recent = [...cycleTx].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 8).map((item) => ({ id: item.id, date: item.date, title: item.title, amount: item.amount, kind: item.kind, person: item.person, category: item.category }));
  return { month: `${start}…${end}`, members, familyExpense, recent };
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
  const start = isoDate(from);
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
        ? t("Categoria Abonamente, cu sumă stabilă.")
        : monthly
          ? t("Apare cam la {days} zile, cu sumă aproape identică.", { days: intervalDays })
          : t("Se repetă săptămânal de {count} ori.", { count: dates.length }),
    });
  });
  return detections.sort((a, b) => b.amount - a.amount).slice(0, 8);
};

export const recurringFromDetection = (data: AppData, detection: SubscriptionDetection): RecurringPayment | undefined => {
  const sourceId = detection.sourceId || data.settings.paymentSources[0]?.id;
  const memberId = detection.memberId || data.settings.members[0]?.id;
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

export const envelopeLane = (data: AppData) => data.settings.salaryPlan.allocations
  .map((item) => ({ item, ...allocationStatus(data, item) }))
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
    ? t("Setează următorul venit ca să calculăm cât poți cheltui azi.")
    : spendable <= 0
      ? t("Ritmul sigur e 0 — verifică plicurile sau scadențele rezervate.")
      : t("Ritm {pace} lei/zi, din {available} disponibili pe {days} zile.", { pace: Math.round(fromPace), available: Math.round(safe.available), days: remainingDays });

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
    reason,
    dues,
    hunts: detectSubscriptions(data, asOf).slice(0, 2),
    closeSoon: hasPayday && remainingDays <= 2,
  };
};

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
  const steps = [
    { label: t("Lichid în surse"), amount: safe.liquidFunds, note: t("Card, cash, bonuri — sold calculat local") },
    { label: t("Minus scadențe active"), amount: -safe.reservedRecurring, note: t("Chirie, abonamente rezervate, încă neconfirmate") },
    { label: t("Disponibil prudent"), amount: safe.available },
    { label: t("Ritm sigur din plan"), amount: forecast.safeDaily, note: t("Ce rămâne după plicuri și cheltuieli, pe zi") },
    { label: t("Lichid ÷ zile rămase"), amount: fromLiquidDaily, note: t("{days} zile până la venit", { days: remainingDays }) },
  ];
  const summary = !brief.hasPayday
    ? t("Fără dată de venit nu putem calcula un reper zilnic. Setează salariul în Plan.")
    : t("Reperul zilei ({amount}) e minimul dintre ritmul sigur și lichidul împărțit pe zile. Nu e un sold bancar.", { amount: Math.round(brief.spendable) });
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

const mondayOf = (asOf: string) => {
  const weekday = (new Date(`${asOf}T12:00:00`).getDay() + 6) % 7;
  return addIsoDays(asOf, -weekday);
};

/**
 * Cât mai ține fiecare zi din săptămâna luni–duminică: restul plicurilor cu ritm
 * săptămânal, împărțit egal pe zilele rămase. Nu folosește reperul până la salariu.
 */
export const weeklyEnvelopeDailyRhythm = (data: AppData, asOf = isoToday()): WeeklyEnvelopeRhythm => {
  const weekly = data.settings.salaryPlan.allocations.filter((item) => item.weeklyPace !== false);
  const remainingRaw = weekly.reduce((sum, allocation) => sum + (allocationWeekStatus(data, allocation, asOf)?.remaining ?? 0), 0);
  const start = mondayOf(asOf);
  const spentByDay = Array.from({ length: 7 }, (_, index) => {
    const day = addIsoDays(start, index);
    const out = data.transactions.filter((item) => item.date === day && weekly.some((allocation) => matchesAllocation(item, allocation))).reduce((sum, item) => sum + item.amount, 0);
    return { day, out };
  });
  const todayIndex = Math.max(0, spentByDay.findIndex((item) => item.day === asOf));
  const remainingDays = 7 - todayIndex;
  const todayOut = spentByDay[todayIndex]?.out ?? 0;
  const startOfToday = remainingRaw + todayOut;
  const todayShareRaw = remainingDays > 0 ? startOfToday / remainingDays : 0;
  const todayLeftRaw = Math.max(0, todayShareRaw - todayOut);
  const futureDays = remainingDays - 1;
  const futureShareRaw = futureDays > 0 ? Math.max(0, remainingRaw - todayLeftRaw) / futureDays : 0;
  const weekOut = spentByDay.reduce((sum, item) => sum + item.out, 0);
  const pastShareRaw = (remainingRaw + weekOut) / 7;
  const days = spentByDay.map((row, weekday) => {
    const isToday = row.day === asOf;
    const isFuture = row.day > asOf;
    const shareRaw = isFuture ? futureShareRaw : isToday ? todayShareRaw : pastShareRaw;
    const leftRaw = isFuture ? futureShareRaw : isToday ? todayLeftRaw : Math.max(0, pastShareRaw - row.out);
    const over = !isFuture && shareRaw > 0 && row.out > shareRaw + 0.009;
    const fill = shareRaw <= 0
      ? (row.out > 0 ? 100 : 8)
      : isFuture
        ? 36
        : Math.max(8, Math.min(100, (row.out / shareRaw) * 100));
    return { day: row.day, weekday, out: roundMoney(row.out), left: roundMoney(leftRaw), share: roundMoney(shareRaw), isToday, isFuture, over, fill };
  });
  return {
    days,
    remaining: roundMoney(Math.max(0, remainingRaw)),
    remainingDays,
    todayLeft: roundMoney(todayLeftRaw),
    todayShare: roundMoney(todayShareRaw),
    futureShare: roundMoney(futureShareRaw),
    hasWeekly: weekly.length > 0,
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
      title: t("Cheltuielile depășesc veniturile cu {amount}", { amount: Math.round(Math.abs(check.cashflow)) }),
      detail: check.nextStep,
    };
  }
  const top = check.categories[0];
  return {
    tone: "good" as const,
    title: top ? t("Cel mai mult: {category} ({amount})", { category: top[0], amount: Math.round(Number(top[1])) }) : t("Săptămâna e în ritm"),
    detail: check.nextStep,
  };
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


