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
  receiptId?: string;
  createdAt?: string;
};

export type Debt = { id: string; name: string; remaining: number; monthly: number; due: string; tone: "forest" | "honey" | "coral"; dueDate?: string };
export type SavingsGoal = { id: string; name: string; current: number; target: number; due: string; tone: "forest" | "honey" | "coral"; dueDate?: string };

export type Receipt = {
  id: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  imageData?: string;
  linkedTransactionId?: string;
  sourceId?: string;
  memberId?: string;
};

export type FamilyMember = { id: string; name: string; color?: string };
export type PaymentSource = { id: string; name: string; kind: PaymentKind; memberId?: string; /** Sold la momentul configurării sursei. */ openingBalance: number };
export type BudgetAllocation = { id: string; label: string; amount: number; memberId?: string; category?: string; sourceId?: string };
export type SalaryPlan = { periodStart: string; nextPayday: string; sourceIds: string[]; totalLimit: number; weeklyLimit: number; allocations: BudgetAllocation[] };
export type FamilySettings = { familyName: string; memberName: string; familyCode: string; members: FamilyMember[]; paymentSources: PaymentSource[]; customCategories: string[]; salaryPlan: SalaryPlan };
export type AppData = { version: 6; transactions: Transaction[]; debts: Debt[]; savings: SavingsGoal[]; receipts: Receipt[]; settings: FamilySettings };

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
  version: 6,
  transactions: [], debts: [], savings: [], receipts: [],
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
    salaryPlan: { periodStart: isoToday(), nextPayday: "", sourceIds: [], totalLimit: 0, weeklyLimit: 0, allocations: [] },
  },
});

/** Migrare defensivă a exporturilor locale din versiunile anterioare. */
export const normalizeAppData = (input: unknown): AppData => {
  if (!input || typeof input !== "object") return createEmptyAppData();
  const old = input as Partial<AppData> & { settings?: Partial<FamilySettings> & { paymentSources?: Array<Partial<PaymentSource> & { balance?: number }> } };
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
  const receipts = Array.isArray(old.receipts) ? old.receipts.map((entry, index) => { const item = entry as Receipt; const linked = transactions.find((transaction) => transaction.id === item.linkedTransactionId || transaction.receiptId === item.id || transaction.id === `receipt-tx-${item.id}`); return { ...item, id: item.id || `legacy-receipt-${index}`, amount: Math.max(0, parseRomanianAmount(item.amount)), date: safeDate(item.date), linkedTransactionId: linked?.id }; }) : [];
  const oldPlan = oldSettings.salaryPlan || fallback.settings.salaryPlan;
  return {
    version: 6, transactions, receipts,
    debts: Array.isArray(old.debts) ? old.debts.map((item) => ({ ...item, remaining: Math.max(0, parseRomanianAmount(item.remaining)), monthly: Math.max(0, parseRomanianAmount(item.monthly)) })) : [],
    savings: Array.isArray(old.savings) ? old.savings.map((item) => ({ ...item, current: Math.max(0, parseRomanianAmount(item.current)), target: Math.max(0, parseRomanianAmount(item.target)) })) : [],
    settings: { familyName: oldSettings.familyName || fallback.settings.familyName, memberName, familyCode: oldSettings.familyCode || createFamilyCode(), members, paymentSources: sources, customCategories: oldSettings.customCategories || [], salaryPlan: { periodStart: safeDate(oldPlan.periodStart), nextPayday: /^\d{4}-\d{2}-\d{2}$/.test(oldPlan.nextPayday || "") ? oldPlan.nextPayday : "", sourceIds: oldPlan.sourceIds || [], totalLimit: Math.max(0, parseRomanianAmount(oldPlan.totalLimit)), weeklyLimit: Math.max(0, parseRomanianAmount(oldPlan.weeklyLimit)), allocations: oldPlan.allocations || [] } },
  };
};

export const sourceBalance = (data: AppData, sourceId: string) => {
  const source = data.settings.paymentSources.find((item) => item.id === sourceId);
  if (!source) return 0;
  return source.openingBalance + data.transactions.filter((item) => item.sourceId === sourceId).reduce((total, item) => total + (item.kind === "income" ? item.amount : -item.amount), 0);
};

export const inPlanPeriod = (iso: string, plan: SalaryPlan) => iso >= plan.periodStart && (!plan.nextPayday || iso <= plan.nextPayday);
export const allocationSpent = (data: AppData, allocation: BudgetAllocation) => data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, data.settings.salaryPlan)).filter((item) => (!allocation.memberId || item.memberId === allocation.memberId) && (!allocation.category || item.category === allocation.category) && (!allocation.sourceId || item.sourceId === allocation.sourceId)).reduce((sum, item) => sum + item.amount, 0);
