/**
 * Atelierul Financiar 2.0 — registru financiar local, normalizat și portabil.
 * Toate sumele sunt în RON, toate datele sunt ISO (YYYY-MM-DD), iar identitățile sunt stabile.
 */

export type TransactionKind = "income" | "expense";
export type PaymentKind = "card" | "cash" | "meal" | "transfer";

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  kind: TransactionKind;
  category: string;
  /** Denumire păstrată pentru lizibilitatea exporturilor vechi. */
  source: string;
  person: string;
  date: string;
  note?: string;
  sourceId?: string;
  memberId?: string;
  /** Plicul ales expres pentru această cheltuială; valoarea „outside” înseamnă că nu consumă niciun plic. */
  allocationId?: string;
  receiptId?: string;
  /** Legătură cu plata recurentă care a generat mișcarea. */
  recurringId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Debt = { id: string; name: string; remaining: number; monthly: number; due: string; tone: "forest" | "honey" | "coral"; dueDate?: string; updatedAt?: string };
export type SavingsGoal = { id: string; name: string; current: number; target: number; due: string; tone: "forest" | "honey" | "coral"; dueDate?: string; updatedAt?: string };
export type RecurringPayment = { id: string; name: string; amount: number; category: string; sourceId: string; memberId: string; dueDay: number; active: boolean; /** Creează local plata la prima deschidere din ziua scadenței sau după aceasta. */ autoPost?: boolean; note?: string; updatedAt?: string };
export type ReceiptLine = { id: string; category: string; amount: number; label?: string };

export type Receipt = {
  id: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  imageData?: string;
  /** A doua pagină a unui bon lung, păstrată doar local. */
  imageData2?: string;
  /** Repartizarea validată a totalului pe categorii. */
  lines?: ReceiptLine[];
  /** Text OCR propus local; este editabil și nu este sursă contabilă. */
  ocrText?: string;
  linkedTransactionId?: string;
  linkedTransactionIds?: string[];
  updatedAt?: string;
  sourceId?: string;
  memberId?: string;
};

export type FamilyMember = { id: string; name: string; color?: string };
export type PaymentSource = { id: string; name: string; kind: PaymentKind; memberId?: string; /** Sold la momentul configurării sursei. */ openingBalance: number };
export type BudgetAllocation = { id: string; label: string; amount: number; memberId?: string; category?: string; sourceId?: string; /** Detaliu liber, de exemplu „Taxi până la salariu”. */ note?: string };
export type BudgetTransfer = { id: string; fromAllocationId: string; toAllocationId: string; amount: number; note?: string; createdAt: string };
export type SalaryPlan = { periodStart: string; nextPayday: string; /** Prima zi în care venitul poate intra; planul folosește această dată prudentă. */ earliestPayday?: string; sourceIds: string[]; totalLimit: number; weeklyLimit: number; allocations: BudgetAllocation[]; transfers: BudgetTransfer[]; updatedAt?: string };
export type FamilySettings = { familyName: string; memberName: string; familyCode: string; members: FamilyMember[]; paymentSources: PaymentSource[]; customCategories: string[]; salaryPlan: SalaryPlan };
export type DeletedRecord = { entity: "transactions" | "debts" | "savings" | "receipts" | "recurring"; id: string; deletedAt: string };
export type AppData = { version: 8; transactions: Transaction[]; debts: Debt[]; savings: SavingsGoal[]; receipts: Receipt[]; recurring: RecurringPayment[]; deleted: DeletedRecord[]; settings: FamilySettings };

export const expenseCategories = ["Alimente", "Băuturi", "Apă", "Dulciuri", "Transport", "Casă & facturi", "Sănătate", "Timp liber", "Rate produse", "Altele"];
export const categoryColors: Record<string, string> = { Alimente: "#256B5B", "Casă & facturi": "#5D7283", Transport: "#D49A2A", "Timp liber": "#D56852", Sănătate: "#4987AA", "Rate produse": "#966E4A", Altele: "#7D8581" };

export const isoToday = () => new Date().toISOString().slice(0, 10);
export const createFamilyCode = () => { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(""); };
export const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const parseRomanianAmount = (raw: string | number) => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const clean = raw.replace(/[\s\u00A0]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const value = Number(clean);
  return Number.isFinite(value) ? value : 0;
};

export const formatDate = (iso?: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) => {
  if (!iso) return "Nespecificat";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? iso : new Intl.DateTimeFormat("ro-RO", options).format(date);
};

const safeDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? String(value) : isoToday();

export const createEmptyAppData = (): AppData => ({
  version: 8,
  transactions: [], debts: [], savings: [], receipts: [], recurring: [], deleted: [],
  settings: {
    familyName: "Familia mea", memberName: "Eu", familyCode: createFamilyCode(),
    members: [{ id: "member-me", name: "Eu", color: "#256B5B" }],
    paymentSources: [
      { id: "source-debit", name: "Card debit", kind: "card", memberId: "member-me", openingBalance: 0 },
      { id: "source-cash", name: "Cash", kind: "cash", memberId: "member-me", openingBalance: 0 },
      { id: "source-meal", name: "Bonuri de masă", kind: "meal", memberId: "member-me", openingBalance: 0 },
      { id: "source-transfer", name: "Transfer comun", kind: "transfer", openingBalance: 0 },
    ],
    customCategories: [],
    salaryPlan: { periodStart: isoToday(), nextPayday: "", sourceIds: [], totalLimit: 0, weeklyLimit: 0, allocations: [], transfers: [] },
  },
});

/** Migrare defensivă a exporturilor locale din versiunile anterioare. */
export const normalizeAppData = (input: unknown): AppData => {
  if (!input || typeof input !== "object") return createEmptyAppData();
  const old = input as Partial<AppData> & { settings?: Partial<FamilySettings> & { paymentSources?: Array<Partial<PaymentSource> & { balance?: number }> }; recurring?: Array<Partial<RecurringPayment>> };
  const fallback = createEmptyAppData();
  const oldSettings = (old.settings || {}) as Partial<FamilySettings> & { paymentSources?: Array<Partial<PaymentSource> & { balance?: number }> };
  const memberName = oldSettings.memberName || fallback.settings.memberName;
  const members = oldSettings.members?.length ? oldSettings.members.map((member, index) => ({ id: member.id || `member-${index}`, name: member.name || `Membru ${index + 1}`, color: member.color })) : [{ id: "member-me", name: memberName, color: "#256B5B" }];
  const sources = oldSettings.paymentSources?.length ? oldSettings.paymentSources.map((source, index) => ({
    id: source.id || `source-${index}`,
    name: source.name || `Sursă ${index + 1}`,
    kind: (source.kind || "card") as PaymentKind,
    memberId: source.memberId,
    openingBalance: Math.max(0, parseRomanianAmount(source.openingBalance ?? (source as Partial<PaymentSource> & { balance?: number }).balance ?? 0)),
  })) : fallback.settings.paymentSources;
  const sourceByName = new Map(sources.map((source) => [source.name.toLowerCase(), source]));
  const memberByName = new Map(members.map((member) => [member.name.toLowerCase(), member]));
  const transactions = Array.isArray(old.transactions) ? old.transactions.map((entry, index) => {
    const item = entry as Transaction;
    const rawSource = (item.source || "").toLowerCase();
    const source = sources.find((value) => value.id === item.sourceId) || sourceByName.get(rawSource) || (rawSource.includes("bon") ? sources.find((value) => value.kind === "meal") : undefined) || sources[0];
    const member = members.find((value) => value.id === item.memberId) || memberByName.get((item.person || "").toLowerCase());
    return { ...item, id: item.id || `legacy-tx-${index}`, amount: Math.max(0, parseRomanianAmount(item.amount)), date: safeDate(item.date), sourceId: source?.id, source: source?.name || item.source || "Necunoscut", memberId: member?.id, person: member?.name || item.person || memberName, createdAt: item.createdAt || new Date().toISOString() };
  }) : [];
  const receipts = Array.isArray(old.receipts) ? old.receipts.map((entry, index) => { const item = entry as Receipt; const linked = transactions.find((transaction) => transaction.id === item.linkedTransactionId || transaction.receiptId === item.id || transaction.id === `receipt-tx-${item.id}`); const lines = Array.isArray(item.lines) ? item.lines.map((line, lineIndex) => ({ id: line.id || `receipt-line-${index}-${lineIndex}`, category: line.category || "Altele", amount: Math.max(0, parseRomanianAmount(line.amount)), label: line.label || undefined })).filter((line) => line.amount > 0) : undefined; return { ...item, id: item.id || `legacy-receipt-${index}`, amount: Math.max(0, parseRomanianAmount(item.amount)), date: safeDate(item.date), lines, linkedTransactionId: linked?.id || item.linkedTransactionId, linkedTransactionIds: item.linkedTransactionIds?.length ? item.linkedTransactionIds : linked?.id ? [linked.id] : undefined }; }) : [];
  const oldPlan = oldSettings.salaryPlan || fallback.settings.salaryPlan;
  const periodStart = safeDate(oldPlan.periodStart);
  const nextPayday = /^\d{4}-\d{2}-\d{2}$/.test(oldPlan.nextPayday || "") ? oldPlan.nextPayday : "";
  const earliestCandidate = (oldPlan as Partial<SalaryPlan>).earliestPayday;
  const earliestPayday = /^\d{4}-\d{2}-\d{2}$/.test(earliestCandidate || "") && String(earliestCandidate) >= periodStart && (!nextPayday || String(earliestCandidate) <= nextPayday) ? earliestCandidate : undefined;
  return {
    version: 8, transactions, receipts,
    debts: Array.isArray(old.debts) ? old.debts.map((item) => ({ ...item, remaining: Math.max(0, parseRomanianAmount(item.remaining)), monthly: Math.max(0, parseRomanianAmount(item.monthly)) })) : [],
    savings: Array.isArray(old.savings) ? old.savings.map((item) => ({ ...item, current: Math.max(0, parseRomanianAmount(item.current)), target: Math.max(0, parseRomanianAmount(item.target)) })) : [],
    recurring: Array.isArray(old.recurring) ? old.recurring.map((item, index) => ({ id: item.id || `recurring-${index}`, name: item.name || `Plată recurentă ${index + 1}`, amount: Math.max(0, parseRomanianAmount(item.amount)), category: item.category || "Casă & facturi", sourceId: sources.some((source) => source.id === item.sourceId) ? String(item.sourceId) : sources[0]?.id || "", memberId: members.some((member) => member.id === item.memberId) ? String(item.memberId) : members[0]?.id || "", dueDay: Math.min(31, Math.max(1, Math.round(parseRomanianAmount(item.dueDay || 1)))), active: item.active !== false, autoPost: item.autoPost === true, note: item.note || undefined, updatedAt: item.updatedAt || undefined })) : [],
    deleted: Array.isArray(old.deleted) ? old.deleted.filter((item): item is DeletedRecord => Boolean(item && typeof item.id === "string" && typeof item.deletedAt === "string" && ["transactions", "debts", "savings", "receipts", "recurring"].includes(item.entity))).slice(-500) : [],
    settings: { familyName: oldSettings.familyName || fallback.settings.familyName, memberName, familyCode: oldSettings.familyCode || createFamilyCode(), members, paymentSources: sources, customCategories: oldSettings.customCategories || [], salaryPlan: { periodStart, nextPayday, earliestPayday, sourceIds: oldPlan.sourceIds || [], totalLimit: Math.max(0, parseRomanianAmount(oldPlan.totalLimit)), weeklyLimit: Math.max(0, parseRomanianAmount(oldPlan.weeklyLimit)), allocations: oldPlan.allocations || [], transfers: Array.isArray((oldPlan as Partial<SalaryPlan>).transfers) ? (oldPlan as Partial<SalaryPlan>).transfers!.filter((item) => item && typeof item.id === "string" && typeof item.fromAllocationId === "string" && typeof item.toAllocationId === "string" && item.fromAllocationId !== item.toAllocationId).map((item) => ({ id: item.id, fromAllocationId: item.fromAllocationId, toAllocationId: item.toAllocationId, amount: Math.max(0, parseRomanianAmount(item.amount)), note: item.note || undefined, createdAt: item.createdAt || new Date().toISOString() })).filter((item) => item.amount > 0) : [], updatedAt: oldPlan.updatedAt || undefined } },
  };
};

export const sourceBalance = (data: AppData, sourceId: string) => {
  const source = data.settings.paymentSources.find((item) => item.id === sourceId);
  if (!source) return 0;
  return source.openingBalance + data.transactions.filter((item) => item.sourceId === sourceId).reduce((total, item) => total + (item.kind === "income" ? item.amount : -item.amount), 0);
};

export const planEndDate = (plan: SalaryPlan) => plan.earliestPayday && (!plan.nextPayday || plan.earliestPayday <= plan.nextPayday) ? plan.earliestPayday : plan.nextPayday;
export const inPlanPeriod = (iso: string, plan: SalaryPlan) => { const end = planEndDate(plan); return iso >= plan.periodStart && (!end || iso <= end); };
export const allocationSpent = (data: AppData, allocation: BudgetAllocation) => data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, data.settings.salaryPlan)).filter((item) => item.allocationId ? item.allocationId === allocation.id : (!allocation.memberId || item.memberId === allocation.memberId) && (!allocation.category || item.category === allocation.category) && (!allocation.sourceId || item.sourceId === allocation.sourceId)).reduce((sum, item) => sum + item.amount, 0);
export const allocationBudget = (data: AppData, allocation: BudgetAllocation) => allocation.amount + data.settings.salaryPlan.transfers.reduce((sum, transfer) => sum + (transfer.toAllocationId === allocation.id ? transfer.amount : 0) - (transfer.fromAllocationId === allocation.id ? transfer.amount : 0), 0);
export const allocationStatus = (data: AppData, allocation: BudgetAllocation) => { const budget = allocationBudget(data, allocation); const spent = allocationSpent(data, allocation); const remaining = budget - spent; const usage = budget > 0 ? spent / budget : 0; return { budget, spent, remaining, usage, state: remaining < 0 ? "over" as const : usage >= 0.8 ? "watch" as const : "healthy" as const }; };
export const financialBalance = (data: AppData, start?: string, end?: string) => { const entries = data.transactions.filter((item) => (!start || item.date >= start) && (!end || item.date <= end)); const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0); const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0); const monthlyRates = data.debts.reduce((sum, item) => sum + item.monthly, 0); const debtRemaining = data.debts.reduce((sum, item) => sum + item.remaining, 0); const savingsCurrent = data.savings.reduce((sum, item) => sum + item.current, 0); const liquidFunds = data.settings.paymentSources.reduce((sum, source) => sum + sourceBalance(data, source.id), 0); return { income, expense, cashflow: income - expense, monthlyRates, debtRemaining, savingsCurrent, liquidFunds, netLiquidPosition: liquidFunds - debtRemaining }; };

/** Prima scadență lunară care intră în perioada curentă de plan, dacă există. */
export const recurringDueInPlan = (item: RecurringPayment, plan: SalaryPlan) => {
  const planEnd = planEndDate(plan); if (!item.active || !planEnd) return undefined;
  const start = new Date(`${plan.periodStart}T12:00:00`); const end = new Date(`${planEnd}T12:00:00`);
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const due = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(item.dueDay, lastDay), 12);
    if (due >= start && due <= end) return due.toISOString().slice(0, 10);
  }
  return undefined;
};

/** Plățile programate care trebuie încă rezervate, fără a număra de două ori mișcările deja înregistrate. */
export const pendingRecurringInPlan = (data: AppData) => data.recurring.flatMap((item) => {
  const dueDate = recurringDueInPlan(item, data.settings.salaryPlan);
  const paid = data.transactions.some((transaction) => transaction.recurringId === item.id && inPlanPeriod(transaction.date, data.settings.salaryPlan));
  return dueDate && !paid ? [{ ...item, dueDate }] : [];
});

/** Ziua reală a scadenței într-o lună; ziua 31 devine ultima zi din februarie sau dintr-o lună scurtă. */
export const recurringDueForMonth = (item: RecurringPayment, asOf = isoToday()) => {
  const basis = new Date(`${asOf}T12:00:00`);
  const lastDay = new Date(basis.getFullYear(), basis.getMonth() + 1, 0).getDate();
  return new Date(basis.getFullYear(), basis.getMonth(), Math.min(item.dueDay, lastDay), 12).toISOString().slice(0, 10);
};

/**
 * Generează numai plata scadentă din luna curentă, când aplicația este deschisă.
 * ID-ul determinist și verificarea recurringId+dată împiedică dublarea după reload sau sincronizare.
 */
export const autoPostDueRecurring = (data: AppData, asOf = isoToday()): AppData => {
  const additions: Transaction[] = [];
  data.recurring.forEach((item) => {
    if (!item.active || !item.autoPost || item.amount <= 0) return;
    const dueDate = recurringDueForMonth(item, asOf);
    if (dueDate > asOf) return;
    const source = data.settings.paymentSources.find((entry) => entry.id === item.sourceId);
    const member = data.settings.members.find((entry) => entry.id === item.memberId);
    if (!source || !member) return;
    const id = `recurring-auto-${item.id}-${dueDate}`;
    const exists = data.transactions.some((transaction) => transaction.id === id || (transaction.recurringId === item.id && transaction.date === dueDate));
    if (exists) return;
    additions.push({ id, recurringId: item.id, title: item.name, amount: item.amount, kind: "expense", category: item.category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: dueDate, note: "Adăugată automat din scadență recurentă", createdAt: `${asOf}T12:00:00.000Z` });
  });
  return additions.length ? { ...data, transactions: [...additions, ...data.transactions] } : data;
};

/**
 * O proiecție transparentă pentru perioada activă. Nu presupune venituri viitoare
 * și nu schimbă bugetul; estimează doar efectul păstrării ritmului deja observat.
 */
export const planForecast = (data: AppData, asOf = isoToday()) => {
  const plan = data.settings.salaryPlan;
  const sourceIds = plan.sourceIds.length ? plan.sourceIds : data.settings.paymentSources.map((source) => source.id);
  const availableSources = data.settings.paymentSources.filter((source) => sourceIds.includes(source.id)).reduce((sum, source) => sum + sourceBalance(data, source.id), 0);
  const budget = plan.totalLimit || Math.max(0, availableSources);
  const scheduled = pendingRecurringInPlan(data).reduce((sum, item) => sum + item.amount, 0);
  const start = new Date(`${plan.periodStart}T12:00:00`).valueOf();
  const prudentEnd = planEndDate(plan); const end = prudentEnd ? new Date(`${prudentEnd}T12:00:00`).valueOf() : start + 6 * 86400000;
  const current = Math.min(Math.max(new Date(`${asOf}T12:00:00`).valueOf(), start), end);
  const elapsedDays = Math.max(1, Math.floor((current - start) / 86400000) + 1);
  const remainingDays = Math.max(1, Math.floor((end - current) / 86400000) + 1);
  const spentToDate = data.transactions.filter((item) => item.kind === "expense" && item.date >= plan.periodStart && item.date <= asOf && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  const paceDaily = spentToDate / elapsedDays;
  const projectedExpenses = paceDaily * (elapsedDays + remainingDays - 1);
  const projectedRemaining = budget - scheduled - projectedExpenses;
  const safeDaily = Math.max(0, (budget - scheduled - spentToDate) / remainingDays);
  return { budget, scheduled, spentToDate, elapsedDays, remainingDays, paceDaily, safeDaily, projectedExpenses, projectedRemaining };
};

export type NaturalSpendScenario = { raw: string; amount: number; category?: string; timing: "azi" | "mâine" | "viitor" | "nespecificat"; title: string; understood: boolean };
export type SavingSuggestion = { id: string; tone: "good" | "watch" | "risk"; title: string; detail: string; potential?: number; basis?: string; nextStep?: string };
export type BudgetQuestionAnswer = { kind: "daily-average" | "weekly-average" | "remaining-daily"; amount: number; days: number; result: number; category?: string; source: "declared" | "envelope" | "plan" };

const foldRomanian = (value: string) => value.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Interpretează local expresii românești scurte, fără un model extern. Rezultatul
 * este doar o previzualizare de simulator; nu creează nicio tranzacție.
 */
export const parseNaturalSpendScenario = (raw: string, categories: string[] = expenseCategories): NaturalSpendScenario => {
  const folded = foldRomanian(raw.trim());
  const amountMatch = raw.match(/(?:^|\s)(\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?=\s*(?:lei|ron|leu|$))/i);
  const amount = amountMatch ? parseRomanianAmount(amountMatch[1]) : 0;
  const categoryAliases: Array<[RegExp, string]> = [
    [/\b(taxi|uber|bolt|transport|metrou|benzina|parcare|bilet)\b/, "Transport"],
    [/\b(mancare|restaurant|lunch|pranz|cina|cumparaturi|supermarket|lidl|kaufland)\b/, "Alimente"],
    [/\b(apa|suc|cafea|ceai|bere)\b/, "Băuturi"],
    [/\b(dulce|ciocolata|prajitura|snack)\b/, "Dulciuri"],
    [/\b(factura|internet|curent|gaz|chirie|detergent|casa)\b/, "Casă & facturi"],
    [/\b(medic|farmacie|doctor|sanatate)\b/, "Sănătate"],
    [/\b(film|joc|iesire|concert|timp liber)\b/, "Timp liber"],
    [/\b(rata|credit|imprumut)\b/, "Rate produse"],
  ];
  const category = categories.find((item) => folded.includes(foldRomanian(item))) || categoryAliases.find(([pattern]) => pattern.test(folded))?.[1];
  const timing: NaturalSpendScenario["timing"] = /\bmaine\b/.test(folded) ? "mâine" : /\b(azi|astazi)\b/.test(folded) ? "azi" : /\b(saptamana viitoare|luna viitoare|vineri|sambata|duminica|luni|marti|miercuri|joi)\b/.test(folded) ? "viitor" : "nespecificat";
  const title = category ? `cheltuială pentru ${category.toLocaleLowerCase("ro-RO")}` : "cheltuială propusă";
  return { raw, amount, category, timing, title, understood: amount > 0 };
};

/**
 * Înțelege întrebări matematice de buget înainte de simularea unei cheltuieli.
 * Nu modifică datele și nu estimează venituri sau investiții: explică strict
 * împărțirea unei limite declarate, a unui plic sau a planului deja salvat.
 */
export const answerBudgetQuestion = (raw: string, data: AppData, asOf = isoToday()): BudgetQuestionAnswer | undefined => {
  const folded = foldRomanian(raw);
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const category = categories.find((item) => folded.includes(foldRomanian(item)));
  const asksDaily = /\b(pe\s+zi|zilnic|media\s+(?:pe\s+)?zi|cat[^?]{0,26}\bzi)\b/.test(folded);
  const asksWeekly = /\b(pe\s+saptamana|saptamanal|media\s+(?:pe\s+)?saptamana)\b/.test(folded);
  const asksRemaining = /\b(pana\s+la\s+(?:venit|salariu)|ramas(?:e)?\s+zile|zile\s+ramase)\b/.test(folded);
  if (!asksDaily && !asksWeekly && !asksRemaining) return undefined;
  const values = Array.from(raw.matchAll(/\d{1,3}(?:[.\s]\d{3})*(?:[,\.]\d{1,2})?|\d+(?:[,\.]\d{1,2})?/g)).map((match) => parseRomanianAmount(match[0])).filter((value) => value > 0);
  const matchingEnvelope = category ? data.settings.salaryPlan.allocations.filter((item) => item.category === category).sort((a, b) => allocationBudget(data, b) - allocationBudget(data, a))[0] : undefined;
  const statedAmount = values[0]; const amount = statedAmount || (matchingEnvelope ? allocationBudget(data, matchingEnvelope) : 0);
  if (asksRemaining) { const forecast = planForecast(data, asOf); const days = forecast.remainingDays; return amount > 0 ? { kind: "remaining-daily", amount, days, result: amount / Math.max(1, days), category, source: statedAmount ? "declared" : matchingEnvelope ? "envelope" : "plan" } : { kind: "remaining-daily", amount: Math.max(0, forecast.budget - forecast.spentToDate - forecast.scheduled), days, result: forecast.safeDaily, category, source: "plan" }; }
  if (!amount) return undefined;
  if (asksWeekly && !asksDaily) return { kind: "weekly-average", amount, days: 7, result: amount, category, source: statedAmount ? "declared" : "envelope" };
  const weekly = /\b(pe\s+saptamana|saptamanal|saptamana)\b/.test(folded); const monthly = /\b(pe\s+luna|lunar|luna)\b/.test(folded);
  const days = weekly ? 7 : monthly ? 30 : 1;
  return { kind: "daily-average", amount, days, result: amount / days, category, source: statedAmount ? "declared" : "envelope" };
};

/** Sugestii observabile și calculate din registru; nu recomandă investiții și nu modifică datele. */
const daysBefore = (iso: string, days: number) => { const value = new Date(`${iso}T12:00:00`); value.setDate(value.getDate() - days); return value.toISOString().slice(0, 10); };

export const savingSuggestions = (data: AppData, asOf = isoToday()): SavingSuggestion[] => {
  const forecast = planForecast(data, asOf); const plan = data.settings.salaryPlan; const balance = financialBalance(data);
  const currentExpenses = data.transactions.filter((item) => item.kind === "expense" && item.date >= plan.periodStart && item.date <= asOf && inPlanPeriod(item.date, plan));
  const spendingByCategory = Object.entries(currentExpenses.reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort((a, b) => b[1] - a[1]);
  const suggestions: SavingSuggestion[] = [];
  if (balance.debtRemaining > 0 && balance.netLiquidPosition < 0) suggestions.push({ id: "net-position", tone: "risk", title: "Datoria depășește lichiditatea actuală", detail: `Poziția lichidă netă este ${Math.round(balance.netLiquidPosition)} RON. Nu presupune că economiile urmărite sunt disponibile pentru cheltuieli; verifică planul și obligațiile apropiate.`, potential: Math.abs(balance.netLiquidPosition), basis: `Solduri utilizabile ${Math.round(balance.liquidFunds)} RON − datorii rămase ${Math.round(balance.debtRemaining)} RON`, nextStep: "Revizuiește ratele și planul" });
  const incomeLast30 = data.transactions.filter((item) => item.kind === "income" && item.date >= daysBefore(asOf, 29) && item.date <= asOf).reduce((sum, item) => sum + item.amount, 0);
  if (balance.monthlyRates > 0 && incomeLast30 > 0 && balance.monthlyRates / incomeLast30 >= 0.35) { const share = Math.round(balance.monthlyRates / incomeLast30 * 100); suggestions.push({ id: "rate-pressure", tone: "watch", title: "Ratele apasă vizibil în veniturile recente", detail: `Ratele declarate reprezintă ${share}% din veniturile înregistrate în ultimele 30 de zile. Include-le în limita planului înainte de cheltuielile flexibile.`, potential: balance.monthlyRates, basis: `${Math.round(balance.monthlyRates)} RON rate/lună din ${Math.round(incomeLast30)} RON venituri în 30 zile`, nextStep: "Deschide scadențele" }); }
  if (plan.nextPayday && forecast.projectedRemaining < 0) suggestions.push({ id: "pace", tone: "risk", title: "Ritmul actual depășește planul", detail: `Estimarea indică un minus de ${Math.round(Math.abs(forecast.projectedRemaining))} RON până la următorul venit. Orice reducere a cheltuielilor flexibile micșorează direct această diferență.`, potential: Math.abs(forecast.projectedRemaining), basis: `${Math.round(forecast.spentToDate)} RON cheltuiți în ${forecast.elapsedDays} zile; orizont ${forecast.remainingDays} zile`, nextStep: "Compară ritmul cu planul" });
  const recentStart = daysBefore(asOf, 6); const previousStart = daysBefore(asOf, 13); const previousEnd = daysBefore(asOf, 7);
  const totalsFor = (start: string, end: string) => data.transactions.filter((item) => item.kind === "expense" && item.date >= start && item.date <= end).reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {});
  const recentByCategory = totalsFor(recentStart, asOf); const previousByCategory = totalsFor(previousStart, previousEnd);
  const trend = Object.entries(recentByCategory).map(([category, amount]) => ({ category, amount, previous: previousByCategory[category] || 0 })).filter((item) => item.previous > 0 && item.amount >= item.previous * 1.25 && item.amount - item.previous >= 40).sort((a, b) => (b.amount - b.previous) - (a.amount - a.previous))[0];
  if (trend) { const increase = Math.round(trend.amount - trend.previous); suggestions.push({ id: "history-trend", tone: "watch", title: `${trend.category} crește față de săptămâna anterioară`, detail: `În ultimele 7 zile sunt ${Math.round(trend.amount)} RON, cu ${increase} RON peste cele 7 zile anterioare. Compară intrările înainte de a decide dacă este un vârf punctual sau un nou ritm.`, potential: increase, basis: `${recentStart}–${asOf} comparat cu ${previousStart}–${previousEnd}`, nextStep: "Vezi mișcările categoriei" }); }
  const envelope = plan.allocations.filter((item) => Boolean(item.category)).map((item) => ({ item, ...allocationStatus(data, item) })).filter((item) => item.state !== "healthy").sort((a, b) => b.usage - a.usage)[0];
  if (envelope) suggestions.push({ id: "envelope", tone: envelope.state === "over" ? "risk" : "watch", title: envelope.state === "over" ? `${envelope.item.label} a depășit limita` : `${envelope.item.label} se apropie de limită`, detail: `${Math.round(envelope.spent)} RON au fost cheltuiți din limita ajustată de ${Math.round(envelope.budget)} RON. O realocare nu mută bani între surse; schimbă numai limitele plicurilor.`, potential: Math.abs(envelope.remaining), basis: `${Math.round(envelope.usage * 100)}% utilizat în perioada planului`, nextStep: "Vezi plicul și realocările" });
  const top = spendingByCategory[0];
  if (top && top[1] > 0) { const potential = Math.max(1, Math.round(top[1] * 0.1)); suggestions.push({ id: "category", tone: "watch", title: `Revizuiește ${top[0]}`, detail: `Aceasta este categoria principală în perioada curentă (${Math.round(top[1])} RON). O reducere orientativă de 10% ar păstra aproximativ ${potential} RON, fără să modifice nimic automat.`, potential, basis: `${Math.round(top[1])} RON din ${currentExpenses.length} cheltuieli ale planului`, nextStep: "Deschide jurnalul" }); }
  if (forecast.scheduled > 0) suggestions.push({ id: "reserve", tone: "watch", title: "Păstrează rezerva pentru scadențe", detail: `${Math.round(forecast.scheduled)} RON sunt deja rezervați pentru plăți recurente din acest plan. Tratează suma ca indisponibilă înainte de a face o cheltuială nouă.`, potential: forecast.scheduled, basis: `${data.recurring.filter((item) => item.active).length} scadențe active înregistrate`, nextStep: "Verifică scadențele" });
  const goal = data.savings.find((item) => item.target > item.current);
  if (goal && forecast.projectedRemaining > 0) suggestions.push({ id: "goal", tone: "good", title: `Protejează obiectivul „${goal.name}”`, detail: `Planul proiectează o marjă de ${Math.round(forecast.projectedRemaining)} RON. Poți compara această marjă cu deficitul obiectivului, fără ca aplicația să mute bani automat.`, potential: Math.min(forecast.projectedRemaining, goal.target - goal.current), basis: `${Math.round(goal.current)} RON din ținta de ${Math.round(goal.target)} RON`, nextStep: "Vezi obiectivul" });
  if (!suggestions.length) suggestions.push({ id: "history", tone: "good", title: "Construiește un profil financiar observabil", detail: "Înregistrează câteva venituri și cheltuieli, apoi stabilește data următorului venit. Asistentul va compara istoricul, bilanțul și ritmul real fără să trimită datele către un serviciu extern.", basis: "Încă nu există suficiente mișcări pentru o comparație personală", nextStep: "Adaugă prima mișcare" });
  return suggestions.slice(0, 4);
};
