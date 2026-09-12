/**
 * Atelierul Financiar 2.0 — registru financiar local, normalizat și portabil.
 * Toate sumele sunt în RON, toate datele sunt ISO (YYYY-MM-DD), iar identitățile sunt stabile.
 */
import { calendarBudget } from "./calendar-budget";
import { getLocale, t } from "./i18n";

export type TransactionKind = "income" | "expense";
/** Personal = doar al membrului; shared = bugetul comun al familiei. Implicit shared pentru compatibilitate. */
export type ShareScope = "personal" | "shared";
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
  /** Datoria redusă de această plată confirmată manual. */
  debtId?: string;
  /** Soldul datoriei imediat după această plată, pentru istoricul explicabil. */
  debtRemainingAfter?: number;
  createdAt?: string;
  updatedAt?: string;
  /**
   * `amount` este întotdeauna în lei, ca toate însumările să rămână corecte fără conversii.
   * Când plata s-a făcut în altă valută, suma tastată și cursul folosit se păstrează aici,
   * ca mișcarea să poată fi verificată față de extrasul băncii.
   */
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  /** Lipsa valorii = shared (mișcări vechi și sync fără câmp). */
  shareScope?: ShareScope;
};

export type Debt = { id: string; name: string; remaining: number; monthly: number; due: string; tone: "forest" | "honey" | "coral"; dueDate?: string; memberId?: string; updatedAt?: string };
export type SavingsGoal = { id: string; name: string; current: number; target: number; due: string; tone: "forest" | "honey" | "coral"; dueDate?: string; memberId?: string; updatedAt?: string };
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
  /** Chei locale IndexedDB pentru fotografiile bonului; nu se sincronizează între dispozitive. */
  imageKeys?: string[];
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

/**
 * `kind` marchează un membru drept copil. Nu schimbă nimic în contabilitate — banii de
 * buzunar sunt tot un plic al familiei, iar cheltuielile copilului sunt tot cheltuieli.
 * Schimbă doar ecranul: un copil vede o singură cifră, nu un plan salarial.
 */
export type FamilyMember = { id: string; name: string; color?: string; kind?: "adult" | "child" };

/**
 * Registrul are o singură monedă de bază: leul. O sursă poate ține însă altă valută,
 * iar cursul este introdus manual, cu data lui — aplicația nu întreabă niciun serviciu
 * extern de cursuri și nu recalculează retroactiv istoricul.
 */

/** Mișcările fără câmp sunt tratate ca shared — sync-safe, fără migrare forțată. */
export const transactionShareScope = (item: Pick<Transaction, "shareScope"> | undefined): ShareScope =>
  item?.shareScope === "personal" ? "personal" : "shared";
export const BASE_CURRENCY = "RON";
export const supportedCurrencies = ["RON", "EUR", "USD", "GBP", "CHF", "MDL", "HUF"];
/** `rate` este câți lei face o unitate din valuta respectivă. */
export type ExchangeRate = { currency: string; rate: number; updatedAt: string };
export type PaymentSource = { id: string; name: string; kind: PaymentKind; memberId?: string; /** Sold la momentul configurării sursei, în valuta sursei. */ openingBalance: number; /** Implicit RON. */ currency?: string };
export type BudgetAllocation = { id: string; label: string; amount: number; memberId?: string; category?: string; sourceId?: string; /** Prag local de atenție; depășirea rămâne la 100%. */ alertThreshold?: number; /** Detaliu liber, de exemplu „Taxi până la salariu”. */ note?: string; /** Implicit adevărat: arată tranșa săptămânii active. Fals pentru plicuri fără ritm fix, unde contează doar totalul ciclului. */ weeklyPace?: boolean; updatedAt?: string };
export type BudgetTransfer = { id: string; fromAllocationId: string; toAllocationId: string; amount: number; note?: string; createdAt: string };
/** Mută bani între tranșele săptămânale ale aceluiași plic, de exemplu când săptămâna curentă s-a epuizat. */
export type WeekTransfer = { id: string; allocationId: string; fromWeekIndex: number; toWeekIndex: number; amount: number; note?: string; createdAt: string };
/** Regulă de planificare: repartizează o valoare sau un procent dintr-un venit confirmat către un plic compatibil. */
export type SalaryAllocationRule = { id: string; label: string; allocationId: string; mode: "fixed" | "percent"; value: number; active: boolean; updatedAt?: string };
/** Jurnal de planificare, nu mișcare bancară: blochează aplicarea aceleiași repartizări de două ori. */
export type SalaryAllocationApplication = { id: string; incomeId: string; incomeTitle: string; incomeAmount: number; sourceId?: string; memberId?: string; appliedAt: string; allocations: Array<{ ruleId: string; allocationId: string; amount: number }> };
export type AllocationHistoryKind = "created" | "updated" | "deleted" | "income-applied" | "income-reverted" | "envelope-transfer" | "week-transfer";
export type AllocationHistoryEntry = { id: string; referenceId?: string; kind: AllocationHistoryKind; allocationId?: string; allocationLabel?: string; fromAllocationId?: string; fromAllocationLabel?: string; toAllocationId?: string; toAllocationLabel?: string; amount?: number; previousAmount?: number; newAmount?: number; incomeId?: string; incomeTitle?: string; fromWeekIndex?: number; toWeekIndex?: number; note?: string; createdAt: string };
/** Preferință de viteză locală: păstrează suma și durata, nu fixează datele calendaristice ale următorului ciclu. */
export type SalaryCycleTemplate = { id: string; label: string; amount: number; durationDays: number; updatedAt?: string };
export type SalaryPlan = { periodStart: string; nextPayday: string; /** Prima zi în care venitul poate intra; planul folosește această dată prudentă. */ earliestPayday?: string; /** Câte zile poate varia salariul față de data obișnuită. Implicit 3. */ paydayFlexDays?: number; sourceIds: string[]; totalLimit: number; weeklyLimit: number; allocations: BudgetAllocation[]; transfers: BudgetTransfer[]; weekTransfers?: WeekTransfer[]; salaryAllocationRules?: SalaryAllocationRule[]; salaryAllocationApplications?: SalaryAllocationApplication[]; allocationHistory?: AllocationHistoryEntry[]; updatedAt?: string };
/** Preferință locală pentru completarea rapidă; nu este o mișcare financiară până la confirmare. */
export type QuickTransactionTemplate = { id: string; label: string; kind: TransactionKind; category: string; amount: number; memberId?: string; sourceId?: string; updatedAt?: string };
export type ArchivedQuickTransactionTemplate = QuickTransactionTemplate & { archivedAt: string };
export type SavedJournalFilter = { id: string; label: string; kind: "all" | TransactionKind; memberId?: string; sourceId?: string; shareScope?: "all" | ShareScope; query?: string; fromDate?: string; toDate?: string; updatedAt: string };
export type FamilySettings = { familyName: string; memberName: string; familyCode: string; members: FamilyMember[]; paymentSources: PaymentSource[]; customCategories: string[]; quickTemplates: QuickTransactionTemplate[]; archivedQuickTemplates: ArchivedQuickTransactionTemplate[]; savedJournalFilters: SavedJournalFilter[]; salaryCycleTemplates: SalaryCycleTemplate[]; exchangeRates: ExchangeRate[]; seenWeeklyPlanTranches: string[]; /** Cheile produselor alese pentru coșul etalon; preferință locală, calculată din bonuri. */ basketProducts: string[]; /** Telefoane văzute în camera de sync (în pachetul criptat). */ syncDevices: SyncDevice[]; salaryPlan: SalaryPlan };
export type DeletedRecord = { entity: "transactions" | "debts" | "savings" | "receipts" | "recurring"; id: string; deletedAt: string };
/** De unde vine o mișcare propusă. Determină explicația arătată lângă ea în centrul de revizuire. */
export type ReviewOrigin = "import" | "bon" | "asistent" | "notificare";
/**
 * O mișcare propusă, nu una înregistrată. Stă într-o listă separată tocmai pentru ca
 * soldurile, plicurile și prognozele să rămână neatinse până la confirmarea explicită.
 */
export type ReviewDraft = { id: string; origin: ReviewOrigin; reason: string; createdAt: string; transaction: Transaction };
/** Conflict de sumă pe același plic, după sync pe două telefoane — nu se rezolvă silent LWW. */
export type AllocationAmountConflict = {
  id: string;
  allocationId: string;
  label: string;
  localAmount: number;
  remoteAmount: number;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
  detectedAt: string;
  /** Suma înainte de ultima rezolvare, pentru Anulare. */
  previousAmount?: number;
  /** Dacă utilizatorul a rezolvat recent și poate anula. */
  resolvedChoice?: "local" | "remote";
};
/** Telefon conectat la camera de familie (în pachetul criptat). */
export type SyncDevice = {
  id: string;
  label: string;
  lastSeenAt: string;
  revokedAt?: string;
};
export type AppData = { version: 9; transactions: Transaction[]; debts: Debt[]; savings: SavingsGoal[]; receipts: Receipt[]; recurring: RecurringPayment[]; deleted: DeletedRecord[]; pendingReview: ReviewDraft[]; allocationConflicts: AllocationAmountConflict[]; settings: FamilySettings };

export const expenseCategories = ["Alimente", "Consumabile copil", "Abonamente", "Băuturi", "Apă", "Dulciuri", "Transport", "Casă & facturi", "Sănătate", "Timp liber", "Rate produse", "Altele"];
export const categoryColors: Record<string, string> = { Alimente: "#256B5B", "Consumabile copil": "#55877D", Abonamente: "#5D7283", "Casă & facturi": "#5D7283", Transport: "#D49A2A", "Timp liber": "#D56852", Sănătate: "#4987AA", "Rate produse": "#966E4A", Altele: "#7D8581" };

/**
 * Data calendaristică a telefonului, nu cea UTC. `toISOString()` ar întoarce ziua
 * precedentă între miezul nopții și ora 03:00 în România (UTC+2/+3), iar mișcarea
 * ar ajunge în ziua, săptămâna sau chiar perioada salarială greșită.
 */
export const isoDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
export const isoToday = () => isoDate(new Date());
export const createFamilyCode = () => { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(""); };

/** UUID v4 criptografic; evită coliziunile de ID când două telefoane creează înregistrări simultan, înainte de sincronizare. */
const randomUUID = () => {
  const cryptoRef = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  if (cryptoRef?.getRandomValues) {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const newId = (prefix: string) => `${prefix}-${randomUUID()}`;

export const parseRomanianAmount = (raw: string | number | null | undefined) => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  // Un backup poate să nu aibă deloc câmpul; fără paza asta, o singură linie stricată
  // arunca o excepție și pierdea tot importul.
  if (typeof raw !== "string") return 0;
  const clean = raw.replace(/[\s\u00A0]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const value = Number(clean);
  return Number.isFinite(value) ? value : 0;
};

/** Un bon se salvează și fără poze: dacă nu există linii cu sumă, totalul devine un singur produs. */
export function resolveReceiptLines(
  lines: Array<{ id?: string; category?: string; amount?: string | number; label?: string }>,
  total: number,
): ReceiptLine[] {
  const normalized = lines
    .map((line, index) => ({
      id: line.id || `receipt-line-${index}`,
      category: line.category || "Alimente",
      amount: parseRomanianAmount(line.amount ?? 0),
      label: String(line.label || "").trim() || undefined,
    }))
    .filter((line) => line.amount > 0);
  if (!normalized.length && total > 0) {
    const first = lines[0];
    normalized.push({
      id: first?.id || "whole",
      category: first?.category || "Alimente",
      amount: total,
      label: String(first?.label || "").trim() || undefined,
    });
  }
  return normalized;
}

export const formatDate = (iso?: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) => {
  if (!iso) return "Nespecificat";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? iso : new Intl.DateTimeFormat(getLocale(), options).format(date);
};

/**
 * Forma corectă nu înseamnă și dată existentă: „2026-13-45” trecea de un simplu tipar
 * și ajungea în registru, unde orice calcul cu ea dădea „Invalid Date”. Verificăm deci
 * că ziua, luna și anul chiar formează o zi din calendar.
 */
/**
 * Un fișier trunchiat sau editat de mână poate avea `null` în mijlocul unei liste.
 * Rândurile care nu sunt obiecte nu au ce salva: păstrate, deveneau mișcări fantomă
 * „Mișcare — 0 RON” în registrul omului.
 */
const realRows = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value.filter((item) => item !== null && typeof item === "object") as T[]) : [];

const safeDate = (value?: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return isoToday();
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1) return isoToday();
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return isoToday();
  return String(value);
};

export const createEmptyAppData = (): AppData => ({
  version: 9,
  transactions: [], debts: [], savings: [], receipts: [], recurring: [], deleted: [], pendingReview: [], allocationConflicts: [],
  settings: {
    familyName: "Familia mea", memberName: "Eu", familyCode: createFamilyCode(),
    members: [{ id: "member-me", name: "Eu", color: "#256B5B" }],
    paymentSources: [
      { id: "source-debit", name: "Card debit", kind: "card", memberId: "member-me", openingBalance: 0 },
      { id: "source-cash", name: "Cash", kind: "cash", memberId: "member-me", openingBalance: 0 },
      { id: "source-meal", name: "Bonuri de masă", kind: "meal", memberId: "member-me", openingBalance: 0 },
      { id: "source-transfer", name: "Transfer comun", kind: "transfer", openingBalance: 0 },
    ],
    customCategories: [], quickTemplates: [], archivedQuickTemplates: [], savedJournalFilters: [], salaryCycleTemplates: [], exchangeRates: [], seenWeeklyPlanTranches: [], basketProducts: [], syncDevices: [],
    salaryPlan: { periodStart: isoToday(), nextPayday: "", sourceIds: [], totalLimit: 0, weeklyLimit: 0, allocations: [], transfers: [], weekTransfers: [], salaryAllocationRules: [], salaryAllocationApplications: [], allocationHistory: [] },
  },
});

/** Migrare defensivă a exporturilor locale din versiunile anterioare. */
export const normalizeAppData = (input: unknown): AppData => {
  if (!input || typeof input !== "object") return createEmptyAppData();
  const old = input as Partial<AppData> & { settings?: Partial<FamilySettings> & { paymentSources?: Array<Partial<PaymentSource> & { balance?: number }> }; recurring?: Array<Partial<RecurringPayment>> };
  const fallback = createEmptyAppData();
  const oldSettings = (old.settings || {}) as Partial<FamilySettings> & { paymentSources?: Array<Partial<PaymentSource> & { balance?: number }> };
  const memberName = oldSettings.memberName || fallback.settings.memberName;
  const members = oldSettings.members?.length ? oldSettings.members.map((member, index) => ({ id: member.id || `member-${index}`, name: member.name || `Membru ${index + 1}`, color: member.color, kind: member.kind === "child" ? "child" as const : undefined })) : [{ id: "member-me", name: memberName, color: "#256B5B" }];
  const sources = oldSettings.paymentSources?.length ? oldSettings.paymentSources.map((source, index) => ({
    id: source.id || `source-${index}`,
    name: source.name || `Sursă ${index + 1}`,
    kind: (source.kind || "card") as PaymentKind,
    memberId: source.memberId,
    openingBalance: Math.max(0, parseRomanianAmount(source.openingBalance ?? (source as Partial<PaymentSource> & { balance?: number }).balance ?? 0)),
    currency: typeof source.currency === "string" && source.currency.trim() && source.currency.toUpperCase() !== BASE_CURRENCY ? source.currency.trim().toUpperCase().slice(0, 3) : undefined,
  })) : fallback.settings.paymentSources;
  const sourceByName = new Map(sources.map((source) => [source.name.toLowerCase(), source]));
  const memberByName = new Map(members.map((member) => [member.name.toLowerCase(), member]));
  const normalizeTransaction = (entry: unknown, index: number, prefix: string): Transaction => {
    const item = (entry || {}) as Transaction;
    const rawSource = (item.source || "").toLowerCase();
    const source = sources.find((value) => value.id === item.sourceId) || sourceByName.get(rawSource) || (rawSource.includes("bon") ? sources.find((value) => value.kind === "meal") : undefined) || sources[0];
    const member = members.find((value) => value.id === item.memberId) || memberByName.get((item.person || "").toLowerCase());
    const originalCurrency = typeof item.originalCurrency === "string" && item.originalCurrency.trim().toUpperCase() !== BASE_CURRENCY ? item.originalCurrency.trim().toUpperCase().slice(0, 3) : undefined;
    const originalAmount = originalCurrency ? Math.max(0, parseRomanianAmount(item.originalAmount ?? 0)) || undefined : undefined;
    const shareScope: ShareScope | undefined = item.shareScope === "personal" ? "personal" : item.shareScope === "shared" ? "shared" : undefined;
    return { ...item, id: item.id || `${prefix}-${index}`, title: String(item.title || "Mișcare"), kind: item.kind === "income" ? "income" : "expense", category: String(item.category || "Altele"), amount: Math.max(0, parseRomanianAmount(item.amount)), date: safeDate(item.date), sourceId: source?.id, source: source?.name || item.source || "Necunoscut", memberId: member?.id, person: member?.name || item.person || memberName, createdAt: item.createdAt || new Date().toISOString(), originalCurrency: originalAmount ? originalCurrency : undefined, originalAmount, exchangeRate: originalAmount ? Math.max(0, parseRomanianAmount(item.exchangeRate ?? 0)) || undefined : undefined, shareScope };
  };
  const transactions = realRows<Partial<Transaction>>(old.transactions).map((entry, index) => normalizeTransaction(entry, index, "legacy-tx"));
  const transactionIds = new Set(transactions.map((item) => item.id));
  const reviewOrigins: ReviewOrigin[] = ["import", "bon", "asistent", "notificare"];
  /** O propunere confirmată pe celălalt telefon există deja în registru; nu o mai cerem a doua oară. */
  const pendingReview: ReviewDraft[] = Array.isArray((old as Partial<AppData>).pendingReview)
    ? (old as Partial<AppData>).pendingReview!.map((entry, index) => {
        const item = (entry || {}) as Partial<ReviewDraft>;
        return {
          id: String(item.id || `review-${index}`),
          origin: reviewOrigins.includes(item.origin as ReviewOrigin) ? (item.origin as ReviewOrigin) : "import",
          reason: String(item.reason || "Propunere de verificat").slice(0, 160),
          createdAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item.createdAt || "")) ? String(item.createdAt) : new Date().toISOString(),
          transaction: normalizeTransaction(item.transaction, index, "review-tx"),
        };
      }).filter((item) => item.transaction.amount > 0 && !transactionIds.has(item.transaction.id)).slice(0, 300)
    : [];
  const receipts = realRows<Receipt>(old.receipts).map((entry, index) => { const item = entry as Receipt; const linked = transactions.find((transaction) => transaction.id === item.linkedTransactionId || transaction.receiptId === item.id || transaction.id === `receipt-tx-${item.id}`); const lines = Array.isArray(item.lines) ? item.lines.map((line, lineIndex) => ({ id: line.id || `receipt-line-${index}-${lineIndex}`, category: line.category || "Altele", amount: Math.max(0, parseRomanianAmount(line.amount)), label: line.label || undefined })).filter((line) => line.amount > 0) : undefined; const imageKeys = Array.isArray(item.imageKeys) ? item.imageKeys.filter((key): key is string => typeof key === "string" && key.length > 0).slice(0, 2) : undefined; return { ...item, id: item.id || `legacy-receipt-${index}`, amount: Math.max(0, parseRomanianAmount(item.amount)), date: safeDate(item.date), lines, imageKeys, linkedTransactionId: linked?.id || item.linkedTransactionId, linkedTransactionIds: item.linkedTransactionIds?.length ? item.linkedTransactionIds : linked?.id ? [linked.id] : undefined }; });
  const oldPlan = oldSettings.salaryPlan || fallback.settings.salaryPlan;
  const periodStart = safeDate(oldPlan.periodStart);
  const nextPayday = /^\d{4}-\d{2}-\d{2}$/.test(oldPlan.nextPayday || "") ? oldPlan.nextPayday : "";
  const earliestCandidate = (oldPlan as Partial<SalaryPlan>).earliestPayday;
  const earliestPayday = /^\d{4}-\d{2}-\d{2}$/.test(earliestCandidate || "") && String(earliestCandidate) >= periodStart && (!nextPayday || String(earliestCandidate) <= nextPayday) ? earliestCandidate : undefined;
  const normalizeQuickTemplate = (item: Partial<QuickTransactionTemplate>, index: number) => ({ id: item.id || `quick-template-${index}`, label: String(item.label || item.category || "Șablon rapid").trim(), kind: item.kind === "income" ? "income" as const : "expense" as const, category: item.kind === "income" ? "Venit" : String(item.category || "Alimente"), amount: Math.max(0, parseRomanianAmount(item.amount ?? 0)), memberId: members.some((member) => member.id === item.memberId) ? item.memberId : undefined, sourceId: sources.some((source) => source.id === item.sourceId) ? item.sourceId : undefined, updatedAt: item.updatedAt || undefined });
  const quickTemplates = Array.isArray(oldSettings.quickTemplates) ? oldSettings.quickTemplates.map(normalizeQuickTemplate).filter((item) => item.label).slice(0, 12) : [];
  const archivedQuickTemplates = Array.isArray(oldSettings.archivedQuickTemplates) ? oldSettings.archivedQuickTemplates.map((item, index) => ({ ...normalizeQuickTemplate(item, index), archivedAt: /^\d{4}-\d{2}-\d{2}/.test(String(item.archivedAt || "")) ? String(item.archivedAt) : new Date().toISOString() })).filter((item) => item.label).slice(0, 60) : [];
  const savedJournalFilters = (Array.isArray(oldSettings.savedJournalFilters) ? oldSettings.savedJournalFilters.map((item, index) => ({ id: item.id || `saved-filter-${index}`, label: String(item.label || "Filtru salvat").trim(), kind: item.kind === "income" || item.kind === "expense" ? item.kind : "all" as const, memberId: members.some((member) => member.id === item.memberId) ? item.memberId : undefined, sourceId: sources.some((source) => source.id === item.sourceId) ? item.sourceId : undefined, shareScope: (item.shareScope === "personal" || item.shareScope === "shared" || item.shareScope === "all" ? item.shareScope : undefined) as SavedJournalFilter["shareScope"], query: String(item.query || "").trim() || undefined, fromDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.fromDate || "")) ? String(item.fromDate) : undefined, toDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.toDate || "")) ? String(item.toDate) : undefined, updatedAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item.updatedAt || "")) ? String(item.updatedAt) : new Date().toISOString() })).filter((item) => item.label && (!item.fromDate || !item.toDate || item.fromDate <= item.toDate)) : []).reduce<typeof fallback.settings.savedJournalFilters>((all, item) => all.some((saved) => saved.id === item.id || saved.label.toLocaleLowerCase("ro-RO") === item.label.toLocaleLowerCase("ro-RO")) ? all : [...all, item], []).slice(0, 8);
  const salaryCycleTemplates = (Array.isArray(oldSettings.salaryCycleTemplates) ? oldSettings.salaryCycleTemplates.map((item, index) => ({ id: String(item.id || `salary-cycle-${index}`), label: String(item.label || "Ciclu salarial").trim().slice(0, 42), amount: Math.max(0, parseRomanianAmount(item.amount)), durationDays: Math.min(93, Math.max(7, Math.round(parseRomanianAmount(item.durationDays || 28)))), updatedAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item.updatedAt || "")) ? String(item.updatedAt) : undefined })).filter((item) => item.label && item.amount > 0) : []).reduce<typeof fallback.settings.salaryCycleTemplates>((all, item) => all.some((saved) => saved.id === item.id || saved.label.toLocaleLowerCase("ro-RO") === item.label.toLocaleLowerCase("ro-RO")) ? all : [...all, item], []).slice(0, 12);
  const exchangeRates = (Array.isArray(oldSettings.exchangeRates) ? oldSettings.exchangeRates.map((item) => ({
    currency: String(item.currency || "").trim().toUpperCase().slice(0, 3),
    rate: Math.max(0, parseRomanianAmount(item.rate)),
    updatedAt: /^\d{4}-\d{2}-\d{2}/.test(String(item.updatedAt || "")) ? String(item.updatedAt) : new Date().toISOString(),
  })).filter((item) => item.currency && item.currency !== BASE_CURRENCY && item.rate > 0) : [])
    .reduce<ExchangeRate[]>((all, item) => all.some((saved) => saved.currency === item.currency) ? all : [...all, item], [])
    .slice(0, 12);
  const basketProducts = Array.isArray(oldSettings.basketProducts) ? Array.from(new Set(oldSettings.basketProducts.filter((item): item is string => typeof item === "string" && item.trim().length > 1))).slice(0, 30) : [];
  const seenWeeklyPlanTranches = Array.isArray(oldSettings.seenWeeklyPlanTranches) ? oldSettings.seenWeeklyPlanTranches.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}:\d+$/.test(item)).slice(-80) : [];
  const allocationHistory = Array.isArray((oldPlan as Partial<SalaryPlan>).allocationHistory) ? (oldPlan as Partial<SalaryPlan>).allocationHistory!.map((item, index) => ({ id: String(item.id || `allocation-history-${index}`), referenceId: item.referenceId || undefined, kind: ["created", "updated", "deleted", "income-applied", "income-reverted", "envelope-transfer", "week-transfer"].includes(String(item.kind)) ? String(item.kind) as AllocationHistoryKind : "updated" as const, allocationId: item.allocationId || undefined, allocationLabel: item.allocationLabel || undefined, fromAllocationId: item.fromAllocationId || undefined, fromAllocationLabel: item.fromAllocationLabel || undefined, toAllocationId: item.toAllocationId || undefined, toAllocationLabel: item.toAllocationLabel || undefined, amount: item.amount === undefined ? undefined : Math.max(0, parseRomanianAmount(item.amount)), previousAmount: item.previousAmount === undefined ? undefined : Math.max(0, parseRomanianAmount(item.previousAmount)), newAmount: item.newAmount === undefined ? undefined : Math.max(0, parseRomanianAmount(item.newAmount)), incomeId: item.incomeId || undefined, incomeTitle: item.incomeTitle || undefined, fromWeekIndex: Number.isFinite(item.fromWeekIndex) ? Math.max(1, Math.round(item.fromWeekIndex as number)) : undefined, toWeekIndex: Number.isFinite(item.toWeekIndex) ? Math.max(1, Math.round(item.toWeekIndex as number)) : undefined, note: item.note || undefined, createdAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item.createdAt || "")) ? String(item.createdAt) : new Date().toISOString() })).slice(0, 400) : [];
  const syncDevices = Array.isArray(oldSettings.syncDevices) ? oldSettings.syncDevices.map((item, index) => ({
    id: String(item?.id || `device-${index}`),
    label: String(item?.label || `Telefon ${index + 1}`).slice(0, 48),
    lastSeenAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item?.lastSeenAt || "")) ? String(item.lastSeenAt) : new Date().toISOString(),
    revokedAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item?.revokedAt || "")) ? String(item.revokedAt) : undefined,
  })).filter((item) => item.id).slice(0, 20) : [];
  const allocationConflicts = Array.isArray((old as Partial<AppData>).allocationConflicts)
    ? (old as Partial<AppData>).allocationConflicts!.map((item, index) => ({
      id: String(item?.id || `conflict-${index}`),
      allocationId: String(item?.allocationId || ""),
      label: String(item?.label || "Plic"),
      localAmount: Math.max(0, parseRomanianAmount(item?.localAmount)),
      remoteAmount: Math.max(0, parseRomanianAmount(item?.remoteAmount)),
      localUpdatedAt: item?.localUpdatedAt,
      remoteUpdatedAt: item?.remoteUpdatedAt,
      detectedAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item?.detectedAt || "")) ? String(item.detectedAt) : new Date().toISOString(),
      previousAmount: item?.previousAmount === undefined ? undefined : Math.max(0, parseRomanianAmount(item.previousAmount)),
      resolvedChoice: item?.resolvedChoice === "local" || item?.resolvedChoice === "remote" ? item.resolvedChoice : undefined,
    })).filter((item) => item.allocationId && item.localAmount !== item.remoteAmount).slice(0, 40)
    : [];
  return {
    version: 9, transactions, receipts, pendingReview, allocationConflicts,
    debts: realRows<Debt>(old.debts).map((item) => ({ ...item, remaining: Math.max(0, parseRomanianAmount(item.remaining)), monthly: Math.max(0, parseRomanianAmount(item.monthly)) })),
    savings: realRows<SavingsGoal>(old.savings).map((item) => ({ ...item, current: Math.max(0, parseRomanianAmount(item.current)), target: Math.max(0, parseRomanianAmount(item.target)) })),
    recurring: realRows<RecurringPayment>(old.recurring).map((item, index) => ({ id: item.id || `recurring-${index}`, name: item.name || `Plată recurentă ${index + 1}`, amount: Math.max(0, parseRomanianAmount(item.amount)), category: item.category || "Casă & facturi", sourceId: sources.some((source) => source.id === item.sourceId) ? String(item.sourceId) : sources[0]?.id || "", memberId: members.some((member) => member.id === item.memberId) ? String(item.memberId) : members[0]?.id || "", dueDay: Math.min(31, Math.max(1, Math.round(parseRomanianAmount(item.dueDay || 1)))), active: item.active !== false, autoPost: item.autoPost === true, note: item.note || undefined, updatedAt: item.updatedAt || undefined })),
    deleted: Array.isArray(old.deleted) ? old.deleted.filter((item): item is DeletedRecord => Boolean(item && typeof item.id === "string" && typeof item.deletedAt === "string" && ["transactions", "debts", "savings", "receipts", "recurring"].includes(item.entity))).slice(-500) : [],
    settings: { familyName: oldSettings.familyName || fallback.settings.familyName, memberName, familyCode: oldSettings.familyCode || createFamilyCode(), members, paymentSources: sources, customCategories: oldSettings.customCategories || [], quickTemplates, archivedQuickTemplates, savedJournalFilters, salaryCycleTemplates, exchangeRates, seenWeeklyPlanTranches, basketProducts, syncDevices, salaryPlan: { periodStart, nextPayday, earliestPayday, paydayFlexDays: Number.isFinite((oldPlan as Partial<SalaryPlan>).paydayFlexDays) ? Math.min(5, Math.max(0, Math.round(Number((oldPlan as Partial<SalaryPlan>).paydayFlexDays)))) : undefined, sourceIds: oldPlan.sourceIds || [], totalLimit: Math.max(0, parseRomanianAmount(oldPlan.totalLimit)), weeklyLimit: Math.max(0, parseRomanianAmount(oldPlan.weeklyLimit)), allocations: Array.isArray(oldPlan.allocations) ? oldPlan.allocations.map((item, index) => ({ ...item, id: item.id || `allocation-${index}`, label: item.label || item.category || `Plic ${index + 1}`, amount: Math.max(0, parseRomanianAmount(item.amount)), alertThreshold: Math.min(95, Math.max(50, Math.round(parseRomanianAmount(item.alertThreshold ?? 80)))) })) : [], transfers: Array.isArray((oldPlan as Partial<SalaryPlan>).transfers) ? (oldPlan as Partial<SalaryPlan>).transfers!.filter((item) => item && typeof item.id === "string" && typeof item.fromAllocationId === "string" && typeof item.toAllocationId === "string" && item.fromAllocationId !== item.toAllocationId).map((item) => ({ id: item.id, fromAllocationId: item.fromAllocationId, toAllocationId: item.toAllocationId, amount: Math.max(0, parseRomanianAmount(item.amount)), note: item.note || undefined, createdAt: item.createdAt || new Date().toISOString() })).filter((item) => item.amount > 0) : [], weekTransfers: Array.isArray((oldPlan as Partial<SalaryPlan>).weekTransfers) ? (oldPlan as Partial<SalaryPlan>).weekTransfers!.filter((item) => item && typeof item.id === "string" && typeof item.allocationId === "string" && Number.isFinite(item.fromWeekIndex) && Number.isFinite(item.toWeekIndex) && item.fromWeekIndex !== item.toWeekIndex).map((item) => ({ id: item.id, allocationId: item.allocationId, fromWeekIndex: Math.max(1, Math.round(item.fromWeekIndex)), toWeekIndex: Math.max(1, Math.round(item.toWeekIndex)), amount: Math.max(0, parseRomanianAmount(item.amount)), note: item.note || undefined, createdAt: item.createdAt || new Date().toISOString() })).filter((item) => item.amount > 0) : [], salaryAllocationRules: Array.isArray((oldPlan as Partial<SalaryPlan>).salaryAllocationRules) ? (oldPlan as Partial<SalaryPlan>).salaryAllocationRules!.map((item, index) => ({ id: item.id || `salary-rule-${index}`, label: String(item.label || "Repartizare venit").trim(), allocationId: String(item.allocationId || ""), mode: item.mode === "percent" ? "percent" as const : "fixed" as const, value: Math.max(0, item.mode === "percent" ? Math.min(100, parseRomanianAmount(item.value)) : parseRomanianAmount(item.value)), active: item.active !== false, updatedAt: item.updatedAt || undefined })).filter((item) => item.label && item.allocationId && item.value > 0).slice(0, 24) : [], salaryAllocationApplications: Array.isArray((oldPlan as Partial<SalaryPlan>).salaryAllocationApplications) ? (oldPlan as Partial<SalaryPlan>).salaryAllocationApplications!.map((item, index) => ({ id: item.id || `salary-application-${index}`, incomeId: String(item.incomeId || ""), incomeTitle: String(item.incomeTitle || "Venit"), incomeAmount: Math.max(0, parseRomanianAmount(item.incomeAmount)), sourceId: item.sourceId || undefined, memberId: item.memberId || undefined, appliedAt: /^\d{4}-\d{2}-\d{2}T/.test(String(item.appliedAt || "")) ? String(item.appliedAt) : new Date().toISOString(), allocations: Array.isArray(item.allocations) ? item.allocations.map((entry) => ({ ruleId: String(entry.ruleId || ""), allocationId: String(entry.allocationId || ""), amount: Math.max(0, parseRomanianAmount(entry.amount)) })).filter((entry) => entry.ruleId && entry.allocationId && entry.amount > 0) : [] })).filter((item) => item.incomeId && item.allocations.length).slice(0, 80) : [], allocationHistory, updatedAt: oldPlan.updatedAt || undefined } },
  };
};

/**
 * Centrul de revizuire. Propunerile stau separat de registru: nu ating soldurile,
 * plicurile sau prognozele până când utilizatorul le confirmă. Ignorarea unei propuneri
 * nu lasă urmă în registru, pentru că mișcarea nu a existat niciodată acolo.
 */
export const addReviewDrafts = (data: AppData, drafts: ReviewDraft[]): AppData => {
  if (!drafts.length) return data;
  const known = new Set([...data.pendingReview.map((item) => item.transaction.id), ...data.transactions.map((item) => item.id)]);
  const fresh = drafts.filter((draft) => !known.has(draft.transaction.id));
  if (!fresh.length) return data;
  return { ...data, pendingReview: [...fresh, ...data.pendingReview].slice(0, 300) };
};

export const confirmReviewDraft = (data: AppData, draftId: string): AppData | undefined => {
  const draft = data.pendingReview.find((item) => item.id === draftId);
  if (!draft || data.transactions.some((item) => item.id === draft.transaction.id)) return undefined;
  const now = new Date().toISOString();
  return {
    ...data,
    transactions: [{ ...draft.transaction, updatedAt: now }, ...data.transactions],
    pendingReview: data.pendingReview.filter((item) => item.id !== draftId),
  };
};

export const confirmAllReviewDrafts = (data: AppData): AppData => data.pendingReview.reduce<AppData>((all, draft) => confirmReviewDraft(all, draft.id) || all, data);

/** Ignorarea scoate propunerea din listă; registrul rămâne neatins, deci nu e nevoie de piatră funerară. */
export const dismissReviewDraft = (data: AppData, draftId: string): AppData => ({ ...data, pendingReview: data.pendingReview.filter((item) => item.id !== draftId) });

export const updateReviewDraft = (data: AppData, draftId: string, patch: Partial<Transaction>): AppData => ({
  ...data,
  pendingReview: data.pendingReview.map((item) => item.id === draftId ? { ...item, transaction: { ...item.transaction, ...patch } } : item),
});

/**
 * O mișcare deja cunoscută: aceeași sursă, aceeași zi, aceeași sumă și același sens.
 * Extrasele de cont se descarcă adesea suprapus, iar reimportarea aceleiași perioade
 * nu trebuie să dubleze nimic.
 */
export const isKnownTransaction = (data: AppData, candidate: Pick<Transaction, "date" | "amount" | "kind" | "sourceId">) => {
  const same = (item: Pick<Transaction, "date" | "amount" | "kind" | "sourceId">) =>
    item.date === candidate.date && item.kind === candidate.kind && item.sourceId === candidate.sourceId && Math.abs(item.amount - candidate.amount) < 0.005;
  return data.transactions.some(same) || data.pendingReview.some((draft) => same(draft.transaction));
};

export const appendAllocationHistory = (data: AppData, entry: Omit<AllocationHistoryEntry, "id" | "createdAt">): AppData => {
  const plan = data.settings.salaryPlan;
  const history: AllocationHistoryEntry = { ...entry, id: newId("allocation-history"), createdAt: new Date().toISOString() };
  return { ...data, settings: { ...data.settings, salaryPlan: { ...plan, allocationHistory: [history, ...(plan.allocationHistory || [])].slice(0, 400), updatedAt: history.createdAt } } };
};

const roundedMoney = (value: number) => Math.round(Math.max(0, value) * 100) / 100;

/** Reguli eligibile pentru un venit: plicul trebuie să accepte aceeași sursă și, când este personal, același membru. */
export const eligibleSalaryAllocationRules = (data: AppData, income: Transaction) => (data.settings.salaryPlan.salaryAllocationRules || []).filter((rule) => {
  const allocation = data.settings.salaryPlan.allocations.find((item) => item.id === rule.allocationId);
  return income.kind === "income" && rule.active && Boolean(allocation) && (!allocation?.sourceId || allocation.sourceId === income.sourceId) && (!allocation?.memberId || allocation.memberId === income.memberId);
});

/** Aplică o singură dată reguli explicite unui venit deja înregistrat; crește numai limitele plicurilor și nu mută bani între surse. */
export const applySalaryAllocationRules = (data: AppData, incomeId: string) => {
  const income = data.transactions.find((item) => item.id === incomeId);
  const plan = data.settings.salaryPlan;
  const previous = (plan.salaryAllocationApplications || []).find((item) => item.incomeId === incomeId);
  if (!income || income.kind !== "income") return { data, applied: [], total: 0, remaining: 0, error: t("Alege un venit înregistrat.") };
  if (previous) return { data, applied: [], total: 0, remaining: income.amount, error: t("Acest venit a fost deja repartizat prin reguli.") };
  const rules = eligibleSalaryAllocationRules(data, income);
  const applied = rules.map((rule) => ({ ruleId: rule.id, allocationId: rule.allocationId, amount: roundedMoney(rule.mode === "percent" ? income.amount * rule.value / 100 : rule.value) })).filter((item) => item.amount > 0);
  if (!applied.length) return { data, applied: [], total: 0, remaining: income.amount, error: t("Nu există reguli active compatibile cu acest venit și sursa sa.") };
  const total = roundedMoney(applied.reduce((sum, item) => sum + item.amount, 0));
  if (total > income.amount) return { data, applied: [], total, remaining: income.amount, error: t("Regulile active depășesc suma venitului. Revizuiește valorile înainte de aplicare.") };
  const appliedAt = new Date().toISOString();
  const application: SalaryAllocationApplication = { id: newId("salary-application"), incomeId: income.id, incomeTitle: income.title, incomeAmount: income.amount, sourceId: income.sourceId, memberId: income.memberId, appliedAt, allocations: applied };
  const amounts = applied.reduce((all, item) => all.set(item.allocationId, roundedMoney((all.get(item.allocationId) || 0) + item.amount)), new Map<string, number>());
  const nextData = { ...data, settings: { ...data.settings, salaryPlan: { ...plan, allocations: plan.allocations.map((item) => amounts.has(item.id) ? { ...item, amount: roundedMoney(item.amount + (amounts.get(item.id) || 0)) } : item), salaryAllocationApplications: [application, ...(plan.salaryAllocationApplications || [])].slice(0, 80), updatedAt: appliedAt } } };
  return { data: appendAllocationHistory(nextData, { kind: "income-applied", referenceId: application.id, allocationLabel: applied.map((item) => plan.allocations.find((allocation) => allocation.id === item.allocationId)?.label || t("Plic eliminat")).join(", "), amount: total, incomeId: income.id, incomeTitle: income.title, note: `Venit de ${income.amount.toLocaleString("ro-RO")} RON` }), applied, total, remaining: roundedMoney(income.amount - total) };
};

/** Revocă o aplicare de reguli și scade numai limitele majorate prin ea; registrul și soldurile surselor rămân neschimbate. */
export const revertSalaryAllocationApplication = (data: AppData, applicationId: string): AppData => {
  const plan = data.settings.salaryPlan; const application = (plan.salaryAllocationApplications || []).find((item) => item.id === applicationId);
  if (!application) return data;
  const amounts = application.allocations.reduce((all, item) => all.set(item.allocationId, roundedMoney((all.get(item.allocationId) || 0) + item.amount)), new Map<string, number>());
  const nextData = { ...data, settings: { ...data.settings, salaryPlan: { ...plan, allocations: plan.allocations.map((item) => amounts.has(item.id) ? { ...item, amount: roundedMoney(item.amount - (amounts.get(item.id) || 0)) } : item), salaryAllocationApplications: (plan.salaryAllocationApplications || []).filter((item) => item.id !== applicationId), updatedAt: new Date().toISOString() } } };
  return appendAllocationHistory(nextData, { kind: "income-reverted", referenceId: application.id, allocationLabel: application.allocations.map((item) => plan.allocations.find((allocation) => allocation.id === item.allocationId)?.label || "Plic eliminat").join(", "), amount: application.allocations.reduce((sum, item) => sum + item.amount, 0), incomeId: application.incomeId, incomeTitle: application.incomeTitle, note: t("Repartizarea a fost anulată.") });
};

/** Valuta unei surse; absența ei înseamnă lei. */
export const sourceCurrency = (data: AppData, sourceId?: string) =>
  data.settings.paymentSources.find((item) => item.id === sourceId)?.currency || BASE_CURRENCY;

/** Cursul salvat manual pentru o valută, în lei per unitate. Leul are mereu cursul 1. */
export const exchangeRateFor = (data: AppData, currency?: string): number | undefined => {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  if (code === BASE_CURRENCY) return 1;
  return data.settings.exchangeRates.find((item) => item.currency === code)?.rate;
};

/** Transformă o sumă în lei folosind cursul dat. Fără curs nu inventăm unul. */
export const toBaseAmount = (amount: number, rate?: number) =>
  rate && rate > 0 ? Math.round(amount * rate * 100) / 100 : undefined;

/**
 * Soldul unei surse, în lei. Mișcările poartă deja suma în lei, deci singurul lucru de
 * convertit este soldul inițial, tastat în valuta sursei. Fără un curs salvat soldul
 * inițial valutar nu este presupus, ci lăsat la zero — o cifră inventată ar strica
 * marja, prognoza și scorul.
 */
export const sourceBalance = (data: AppData, sourceId: string) => {
  const source = data.settings.paymentSources.find((item) => item.id === sourceId);
  if (!source) return 0;
  const opening = source.currency ? toBaseAmount(source.openingBalance, exchangeRateFor(data, source.currency)) ?? 0 : source.openingBalance;
  return opening + data.transactions.filter((item) => item.sourceId === sourceId).reduce((total, item) => total + (item.kind === "income" ? item.amount : -item.amount), 0);
};

/**
 * Soldul unei surse valutare, în propria ei valută — ce vede utilizatorul în extrasul
 * băncii. Mișcările fără sumă originală au fost introduse în lei; le convertim înapoi
 * cu cursul curent, iar faptul că este o aproximare se spune în interfață.
 */
export const sourceBalanceInCurrency = (data: AppData, sourceId: string) => {
  const source = data.settings.paymentSources.find((item) => item.id === sourceId);
  const currency = source?.currency;
  if (!source || !currency) return undefined;
  const rate = exchangeRateFor(data, currency);
  const total = data.transactions
    .filter((item) => item.sourceId === sourceId)
    .reduce((sum, item) => {
      const own = item.originalCurrency === currency && item.originalAmount ? item.originalAmount : rate && rate > 0 ? item.amount / rate : 0;
      return sum + (item.kind === "income" ? own : -own);
    }, 0);
  return { currency, amount: Math.round((source.openingBalance + total) * 100) / 100, exact: data.transactions.every((item) => item.sourceId !== sourceId || item.originalCurrency === currency) };
};

/** Valutele folosite efectiv de surse, fără leu. */
export const activeCurrencies = (data: AppData) =>
  Array.from(new Set(data.settings.paymentSources.map((item) => item.currency).filter((item): item is string => Boolean(item))));

/** Valutele folosite de surse pentru care lipsește cursul; fără el soldul nu poate fi calculat. */
export const currenciesMissingRate = (data: AppData) =>
  activeCurrencies(data).filter((currency) => !exchangeRateFor(data, currency));

export const planEndDate = (plan: SalaryPlan) => paydayWindow(plan).typical || plan.nextPayday || plan.earliestPayday || "";
export const planCoverEndDate = (plan: SalaryPlan) => paydayWindow(plan).latest || planEndDate(plan);
export const prudentPlanEndDate = (plan: SalaryPlan) => paydayWindow(plan).earliest || planEndDate(plan);
export const addIsoDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};
export const paydayFlexDays = (plan: SalaryPlan) => Math.min(5, Math.max(0, Math.round(plan.paydayFlexDays ?? 0)));
export const paydayWindow = (plan: SalaryPlan) => {
  const flex = paydayFlexDays(plan);
  if (!plan.nextPayday) return { typical: "", earliest: plan.earliestPayday || "", latest: "", flex };
  const typical = plan.nextPayday;
  const computedEarliest = addIsoDays(typical, -flex);
  const earliest = plan.earliestPayday && plan.earliestPayday <= typical
    ? (plan.earliestPayday < plan.periodStart ? plan.periodStart : plan.earliestPayday)
    : (computedEarliest < plan.periodStart ? plan.periodStart : computedEarliest);
  return { typical, earliest, latest: addIsoDays(typical, flex), flex };
};
export const inPlanPeriod = (iso: string, plan: SalaryPlan) => { const end = planCoverEndDate(plan); return iso >= plan.periodStart && (!end || iso <= end); };

/**
 * Cât s-a consumat dintr-un plic, într-o singură trecere.
 *
 * Varianta dinainte chema `inPlanPeriod` pentru fiecare mișcare, iar acela chema
 * `planCoverEndDate`, care construiește obiecte `Date`. Cu trei ani de registru și
 * șase plicuri, o singură randare ajungea la zeci de mii de construcții de dată:
 * ecranul Analiză pornea în 2,3 secunde. Marginile perioadei se calculează acum o
 * dată, înainte de buclă, și nu mai facem liste intermediare.
 *
 * Un rezultat păstrat între apeluri ar fi fost și mai rapid, dar nu se poate ține
 * pe identitatea listei: registrul chiar este modificat pe loc pe alocuri, deci o
 * referință egală nu garantează date egale. Trecerea unică este destul de ieftină
 * și nu poate rămâne în urmă.
 */
export const allocationSpent = (data: AppData, allocation: BudgetAllocation) => {
  const plan = data.settings.salaryPlan;
  const start = plan.periodStart;
  const end = planCoverEndDate(plan);
  let total = 0;
  for (const item of data.transactions) {
    if (item.kind !== "expense") continue;
    if (item.date < start || (end && item.date > end)) continue;
    const matches = item.allocationId
      ? item.allocationId === allocation.id
      : (!allocation.memberId || item.memberId === allocation.memberId)
        && (!allocation.category || item.category === allocation.category)
        && (!allocation.sourceId || item.sourceId === allocation.sourceId);
    if (matches) total += item.amount;
  }
  return total;
};

export const allocationBudget = (data: AppData, allocation: BudgetAllocation) => allocation.amount + data.settings.salaryPlan.transfers.reduce((sum, transfer) => sum + (transfer.toAllocationId === allocation.id ? transfer.amount : 0) - (transfer.fromAllocationId === allocation.id ? transfer.amount : 0), 0);
export const allocationStatus = (data: AppData, allocation: BudgetAllocation) => { const budget = allocationBudget(data, allocation); const spent = allocationSpent(data, allocation); const remaining = budget - spent; const usage = budget > 0 ? spent / budget : 0; const alertThreshold = Math.min(95, Math.max(50, allocation.alertThreshold ?? 80)); return { budget, spent, remaining, usage, alertThreshold, state: remaining < 0 ? "over" as const : usage >= alertThreshold / 100 ? "watch" as const : "healthy" as const }; };

const roundSigned = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Situația fiecărei tranșe calendaristice a unui plic, cu ajustările din transferurile între săptămâni. */
export const allocationWeeksStatus = (data: AppData, allocation: BudgetAllocation) => {
  const plan = data.settings.salaryPlan;
  const end = planEndDate(plan);
  const budget = allocationBudget(data, allocation);
  const calendar = end ? calendarBudget(budget, plan.periodStart, end) : undefined;
  if (!calendar) return [];
  const weekTransfers = (plan.weekTransfers || []).filter((item) => item.allocationId === allocation.id);
  /**
   * Limita se împarte pe zile până la data obișnuită a venitului, dar plicul numără
   * cheltuielile până la data cea mai târzie a ferestrei. Fără prelungirea ultimei tranșe,
   * o cheltuială din zilele de flexibilitate scădea din totalul plicului fără să apară
   * în nicio săptămână. Sumele rămân neschimbate; se lărgește doar intervalul acoperit.
   */
  const cover = planCoverEndDate(plan);
  const lastIndex = calendar.weeks.length - 1;
  return calendar.weeks.map((week, index) => {
    const adjustment = weekTransfers.reduce((sum, item) => sum + (item.toWeekIndex === week.index ? item.amount : 0) - (item.fromWeekIndex === week.index ? item.amount : 0), 0);
    const weekBudget = roundSigned(week.amount + adjustment);
    const weekEnd = index === lastIndex && cover > week.end ? cover : week.end;
    const spent = data.transactions.filter((item) => {
      if (item.kind !== "expense" || item.date < week.start || item.date > weekEnd) return false;
      if (item.allocationId) return item.allocationId === allocation.id;
      return (!allocation.memberId || item.memberId === allocation.memberId) && (!allocation.category || item.category === allocation.category) && (!allocation.sourceId || item.sourceId === allocation.sourceId);
    }).reduce((sum, item) => sum + item.amount, 0);
    const remaining = roundSigned(weekBudget - spent);
    const days = weekEnd === week.end ? week.days : Math.round((new Date(`${weekEnd}T12:00:00`).valueOf() - new Date(`${week.start}T12:00:00`).valueOf()) / 86400000) + 1;
    return { ...week, end: weekEnd, days, budget: weekBudget, spent: roundedMoney(spent), remaining, usage: weekBudget > 0 ? spent / weekBudget : 0, state: remaining < 0 ? "over" as const : "healthy" as const };
  });
};

/** Situația unui plic în tranșa calendaristică ce conține data verificată. */
export const allocationWeekStatus = (data: AppData, allocation: BudgetAllocation, date = isoToday()) => {
  return allocationWeeksStatus(data, allocation).find((week) => date >= week.start && date <= week.end);
};

/** Mută bani dintr-o tranșă săptămânală în alta, în interiorul aceluiași plic; nu poate lua mai mult decât e disponibil în tranșa sursă. */
export const transferBetweenWeeks = (data: AppData, input: { allocationId: string; fromWeekIndex: number; toWeekIndex: number; amount: number; note?: string }): AppData | undefined => {
  const plan = data.settings.salaryPlan;
  const allocation = plan.allocations.find((item) => item.id === input.allocationId);
  const amount = Math.round(Math.max(0, input.amount) * 100) / 100;
  if (!allocation || amount <= 0 || input.fromWeekIndex === input.toWeekIndex) return undefined;
  const weeks = allocationWeeksStatus(data, allocation);
  const fromWeek = weeks.find((week) => week.index === input.fromWeekIndex);
  if (!fromWeek || amount > fromWeek.remaining) return undefined;
  const transfer: WeekTransfer = { id: newId("week-transfer"), allocationId: allocation.id, fromWeekIndex: input.fromWeekIndex, toWeekIndex: input.toWeekIndex, amount, note: input.note?.trim() || undefined, createdAt: new Date().toISOString() };
  return { ...data, settings: { ...data.settings, salaryPlan: { ...plan, weekTransfers: [transfer, ...(plan.weekTransfers || [])], updatedAt: new Date().toISOString() } } };
};

/** Mută o limită între două plicuri; nu poate lua mai mult decât a rămas în plicul sursă și nu mișcă bani din surse. */
export const transferBetweenEnvelopes = (data: AppData, input: { fromAllocationId: string; toAllocationId: string; amount: number; note?: string }): AppData | undefined => {
  const plan = data.settings.salaryPlan;
  const from = plan.allocations.find((item) => item.id === input.fromAllocationId);
  const to = plan.allocations.find((item) => item.id === input.toAllocationId);
  const amount = roundedMoney(input.amount);
  if (!from || !to || from.id === to.id || amount <= 0) return undefined;
  if (amount > allocationStatus(data, from).remaining) return undefined;
  const transfer: BudgetTransfer = { id: newId("transfer"), fromAllocationId: from.id, toAllocationId: to.id, amount, note: input.note?.trim() || undefined, createdAt: new Date().toISOString() };
  return { ...data, settings: { ...data.settings, salaryPlan: { ...plan, transfers: [transfer, ...plan.transfers], updatedAt: transfer.createdAt } } };
};

/** Venituri încă nerepartizate prin ritualul de salariu. */
export const unappliedSalaryIncomes = (data: AppData) => {
  const applied = new Set((data.settings.salaryPlan.salaryAllocationApplications || []).map((item) => item.incomeId));
  return data.transactions
    .filter((item) => item.kind === "income" && !applied.has(item.id))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
};

export type DebtSnowballStep = {
  debt: Debt;
  rank: number;
  remaining: number;
  monthly: number;
  monthsAtMinimum: number | null;
  recommended: number;
  isNext: boolean;
};

/** Ordine tip minge de zăpadă: cea mai mică datorie rămasă întâi. Nu estimează dobândă. */
export const debtSnowball = (data: AppData) => {
  const open = [...data.debts.filter((item) => item.remaining > 0)].sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name, "ro-RO"));
  const order: DebtSnowballStep[] = open.map((debt, index) => ({
    debt,
    rank: index + 1,
    remaining: debt.remaining,
    monthly: debt.monthly,
    monthsAtMinimum: debt.monthly > 0 ? Math.ceil(debt.remaining / debt.monthly) : null,
    recommended: Math.min(debt.remaining, debt.monthly > 0 ? debt.monthly : debt.remaining),
    isNext: index === 0,
  }));
  return {
    order,
    next: order[0],
    totalRemaining: roundedMoney(open.reduce((sum, item) => sum + item.remaining, 0)),
    count: open.length,
  };
};

/** Plicuri compatibile pentru o cheltuială reală, cu prioritate pentru potrivirea exactă membru + sursă. */
export const matchingAllocationsForExpense = (data: AppData, input: { category: string; memberId?: string; sourceId?: string }) => data.settings.salaryPlan.allocations
  .filter((allocation) => allocation.category === input.category && (!allocation.sourceId || allocation.sourceId === input.sourceId))
  .filter((allocation, _index, all) => {
    if (!allocation.memberId || allocation.memberId === input.memberId) return true;
    const exactMemberMatchExists = all.some((item) => item.memberId === input.memberId);
    const sourceOwnerId = data.settings.paymentSources.find((source) => source.id === input.sourceId)?.memberId;
    return !exactMemberMatchExists && allocation.memberId === sourceOwnerId;
  })
  .sort((left, right) => {
    const score = (item: BudgetAllocation) => (item.memberId ? 2 : 0) + (item.sourceId ? 2 : 0) + (allocationBudget(data, item) - allocationSpent(data, item) > 0 ? 1 : 0);
    return score(right) - score(left);
  });

/**
 * Propune sume pe plicuri pentru următoarele 7 zile, din cheltuielile reale ale
 * ultimelor 7 zile. Nu modifică planul — e doar o sugestie editabilă.
 */
export const suggestWeeklyAllocationsFromCashflow = (data: AppData, asOf = isoToday()) => {
  const start = addIsoDays(asOf, -6);
  const spentByCategory = new Map<string, number>();
  for (const item of data.transactions) {
    if (item.kind !== "expense" || item.date < start || item.date > asOf) continue;
    const key = item.category || "Altele";
    spentByCategory.set(key, (spentByCategory.get(key) || 0) + item.amount);
  }
  const suggestions = data.settings.salaryPlan.allocations.map((allocation) => {
    const category = allocation.category || allocation.label;
    const actual = Math.round((spentByCategory.get(category) || 0) * 100) / 100;
    return {
      allocationId: allocation.id,
      label: allocation.label,
      category,
      currentAmount: allocation.amount,
      suggestedAmount: actual,
      delta: Math.round((actual - allocation.amount) * 100) / 100,
    };
  }).filter((item) => item.suggestedAmount > 0 || item.currentAmount > 0);
  const unallocated = Array.from(spentByCategory.entries())
    .filter(([category]) => !data.settings.salaryPlan.allocations.some((item) => (item.category || item.label) === category))
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .filter((item) => item.amount > 0);
  return { asOf, start, end: asOf, suggestions, unallocated, totalSuggested: suggestions.reduce((sum, item) => sum + item.suggestedAmount, 0) };
};

export const financialBalance = (data: AppData, start?: string, end?: string, memberId?: string) => { const entries = data.transactions.filter((item) => (!start || item.date >= start) && (!end || item.date <= end) && (!memberId || item.memberId === memberId)); const income = entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0); const expense = entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0); const scopedDebts = data.debts.filter((item) => !memberId || !item.memberId || item.memberId === memberId); const scopedSavings = data.savings.filter((item) => !memberId || !item.memberId || item.memberId === memberId); const monthlyRates = scopedDebts.reduce((sum, item) => sum + item.monthly, 0); const debtRemaining = scopedDebts.reduce((sum, item) => sum + item.remaining, 0); const savingsCurrent = scopedSavings.reduce((sum, item) => sum + item.current, 0); const sources = data.settings.paymentSources.filter((source) => !memberId || !source.memberId || source.memberId === memberId); const liquidFunds = sources.reduce((sum, source) => sum + sourceBalance(data, source.id), 0); return { income, expense, cashflow: income - expense, monthlyRates, debtRemaining, savingsCurrent, liquidFunds, netLiquidPosition: liquidFunds - debtRemaining, memberId }; };

/** Recapitulare locală luni–duminică. Perspectiva unui membru include numai mișcările lui. */
export const weeklySummary = (data: AppData, asOf = isoToday(), memberId?: string) => {
  const basis = new Date(`${safeDate(asOf)}T12:00:00`); const shift = (basis.getDay() + 6) % 7; const start = new Date(basis); start.setDate(basis.getDate() - shift); const end = new Date(start); end.setDate(start.getDate() + 6); const startIso = isoDate(start); const endIso = isoDate(end);
  const transactions = data.transactions.filter((item) => item.date >= startIso && item.date <= endIso && (!memberId || item.memberId === memberId)); const income = transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0); const expense = transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0); const categories = Object.entries(transactions.filter((item) => item.kind === "expense").reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort(([, left], [, right]) => right - left).slice(0, 3);
  return { start: startIso, end: endIso, income, expense, cashflow: income - expense, categories, transactionCount: transactions.length, memberId };
};

/** Confirmă o plată reală de rată: scade doar datoria aleasă și înregistrează ieșirea din sursa aleasă. */
export const debtPaymentHistory = (data: AppData, debtId: string) => data.transactions.filter((item) => item.debtId === debtId).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));

export const recordDebtPayment = (data: AppData, input: { debtId: string; amount: number; sourceId: string; memberId: string; date?: string; note?: string }) => {
  const debt = data.debts.find((item) => item.id === input.debtId); const source = data.settings.paymentSources.find((item) => item.id === input.sourceId); const member = data.settings.members.find((item) => item.id === input.memberId); const amount = Math.round(Math.max(0, input.amount) * 100) / 100;
  if (!debt || !source || !member || (source.memberId && source.memberId !== member.id) || amount <= 0 || amount > debt.remaining) return undefined;
  const now = new Date().toISOString(); const remainingAfter = Math.max(0, Math.round((debt.remaining - amount) * 100) / 100); const paymentState = remainingAfter === 0 ? t("achitată integral") : t("plată parțială"); const transaction: Transaction = { id: newId("debt-payment"), debtId: debt.id, debtRemainingAfter: remainingAfter, title: t("Rată {state} — {name}", { state: paymentState, name: debt.name }), amount, kind: "expense", category: "Rate produse", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: input.date || isoToday(), note: input.note?.trim() || t("Rată {state}; sold rămas {amount} RON", { state: paymentState, amount: remainingAfter.toFixed(2) }), allocationId: "outside", createdAt: now, updatedAt: now };
  return { ...data, transactions: [transaction, ...data.transactions], debts: data.debts.map((item) => item.id === debt.id ? { ...item, remaining: remainingAfter, updatedAt: now } : item) };
};

/** Prima scadență lunară care intră în perioada curentă de plan, dacă există. */
export const recurringDueInPlan = (item: RecurringPayment, plan: SalaryPlan) => {
  const planEnd = planEndDate(plan); if (!item.active || !planEnd) return undefined;
  const start = new Date(`${plan.periodStart}T12:00:00`); const end = new Date(`${planEnd}T12:00:00`);
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const due = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(item.dueDay, lastDay), 12);
    if (due >= start && due <= end) return isoDate(due);
  }
  return undefined;
};

/** Plățile programate care trebuie încă rezervate, fără a număra de două ori mișcările deja înregistrate. */
export const pendingRecurringInPlan = (data: AppData) => data.recurring.flatMap((item) => {
  const dueDate = recurringDueInPlan(item, data.settings.salaryPlan);
  const paid = data.transactions.some((transaction) => transaction.recurringId === item.id && inPlanPeriod(transaction.date, data.settings.salaryPlan));
  return dueDate && !paid ? [{ ...item, dueDate }] : [];
});

/** Confirmă o scadență rezervată în perioada activă: adaugă mișcarea reală o singură dată, fără s-o poată dubla. */
export const confirmRecurringPayment = (data: AppData, recurringId: string): AppData | undefined => {
  const pending = pendingRecurringInPlan(data).find((item) => item.id === recurringId);
  const item = data.recurring.find((entry) => entry.id === recurringId);
  const source = item && data.settings.paymentSources.find((entry) => entry.id === item.sourceId);
  const member = item && data.settings.members.find((entry) => entry.id === item.memberId);
  /** Fără scadență în așteptare plata este deja înregistrată în perioada activă; o a doua apăsare nu trebuie s-o dubleze. */
  if (!pending || !item || !source || !member) return undefined;
  const now = new Date().toISOString();
  const transaction: Transaction = { id: newId("recurring-tx"), recurringId: item.id, title: item.name, amount: item.amount, kind: "expense", category: item.category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: pending.dueDate, note: t("Plată recurentă confirmată"), createdAt: now, updatedAt: now };
  return { ...data, transactions: [transaction, ...data.transactions] };
};

/** Ziua reală a scadenței într-o lună; ziua 31 devine ultima zi din februarie sau dintr-o lună scurtă. */
export const recurringDueForMonth = (item: RecurringPayment, asOf = isoToday()) => {
  const basis = new Date(`${asOf}T12:00:00`);
  const lastDay = new Date(basis.getFullYear(), basis.getMonth() + 1, 0).getDate();
  return isoDate(new Date(basis.getFullYear(), basis.getMonth(), Math.min(item.dueDay, lastDay), 12));
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
    additions.push({ id, recurringId: item.id, title: item.name, amount: item.amount, kind: "expense", category: item.category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: dueDate, note: t("Adăugată automat din scadență recurentă"), createdAt: `${asOf}T12:00:00.000Z` });
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
  const scheduled = pendingRecurringInPlan(data).reduce((sum, item) => sum + item.amount, 0);
  const start = new Date(`${plan.periodStart}T12:00:00`).valueOf();
  const prudentEnd = prudentPlanEndDate(plan); const end = prudentEnd ? new Date(`${prudentEnd}T12:00:00`).valueOf() : start + 6 * 86400000;
  const current = Math.min(Math.max(new Date(`${asOf}T12:00:00`).valueOf(), start), end);
  const elapsedDays = Math.max(1, Math.floor((current - start) / 86400000) + 1);
  const remainingDays = Math.max(1, Math.floor((end - current) / 86400000) + 1);
  const spentToDate = data.transactions.filter((item) => item.kind === "expense" && item.date >= plan.periodStart && item.date <= asOf && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  /** Reface soldul de la începutul perioadei: cheltuielile deja înregistrate nu trebuie scăzute de două ori, o dată din sold și o dată din proiecție. */
  const budget = Math.max(0, availableSources + spentToDate);
  const paceDaily = spentToDate / elapsedDays;
  const projectedExpenses = paceDaily * (elapsedDays + remainingDays - 1);
  const projectedRemaining = budget - scheduled - projectedExpenses;
  const safeDaily = Math.max(0, (budget - scheduled - spentToDate) / remainingDays);
  return { budget, scheduled, spentToDate, elapsedDays, remainingDays, paceDaily, safeDaily, projectedExpenses, projectedRemaining };
};

export type NaturalSpendScenario = { raw: string; amount: number; category?: string; timing: "azi" | "mâine" | "viitor" | "nespecificat"; title: string; understood: boolean };
export type SavingSuggestion = { id: string; tone: "good" | "watch" | "risk"; title: string; detail: string; potential?: number; basis?: string; nextStep?: string };
export type BudgetQuestionAnswer = { kind: "daily-average" | "weekly-average" | "remaining-daily"; amount: number; days: number; result: number; category?: string; source: "declared" | "envelope" | "plan" };

export const foldRomanian = (value: string) => value.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** O singură listă de indicii, folosită și de simulatorul de scenarii, și de importul de extras. */
const categoryAliases: Array<[RegExp, string]> = [
  [/\b(taxi|uber|bolt|transport|metrou|stb|ratb|cfr|benzina|motorina|combustibil|omv|mol|petrom|rompetrol|parcare|bilet|blueair|wizz|tarom)\b/, "Transport"],
  [/\b(mancare|restaurant|lunch|pranz|cina|cumparaturi|supermarket|lidl|kaufland|carrefour|profi|auchan|penny|mega image|selgros|glovo|tazz|bolt food|patiserie|paine|covrig)\b/, "Alimente"],
  [/\b(apa|suc|cafea|ceai|bere|starbucks|5 to go)\b/, "Băuturi"],
  [/\b(dulce|ciocolata|prajitura|snack)\b/, "Dulciuri"],
  [/\b(factura|internet|curent|gaz|chirie|detergent|casa|enel|electrica|engie|digi|rcs|orange|vodafone|telekom|apa nova|salubr)\b/, "Casă & facturi"],
  [/\b(medic|farmacie|doctor|sanatate|catena|help ?net|dona|regina maria|medlife|sanador)\b/, "Sănătate"],
  [/\b(film|joc|iesire|concert|timp liber|cinema|netflix|spotify|steam|hbo|disney)\b/, "Timp liber"],
  [/\b(abonament|subscription)\b/, "Abonamente"],
  [/\b(tigar|tutun|vape)\b/, "Altele"],
  [/\b(rata|credit|imprumut|leasing)\b/, "Rate produse"],
];

/** Propune o categorie dintr-o descriere liberă. Rămâne o propunere: nimic nu se salvează fără confirmare. */
export const guessCategoryFromText = (raw: string, categories: string[] = expenseCategories) => {
  const folded = foldRomanian(raw);
  return categories.find((item) => folded.includes(foldRomanian(item))) || categoryAliases.find(([pattern]) => pattern.test(folded))?.[1];
};

/**
 * Interpretează local expresii românești scurte, fără un model extern. Rezultatul
 * este doar o previzualizare de simulator; nu creează nicio tranzacție.
 */
export const parseNaturalSpendScenario = (raw: string, categories: string[] = expenseCategories): NaturalSpendScenario => {
  const folded = foldRomanian(raw.trim());
  const amountMatch = raw.match(/(?:^|\s)(\d{1,3}(?:[.\s]\d{3})*(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?=\s*(?:de\s+)?(?:lei|ron|leu|pe|pentru|$))/i);
  const amount = amountMatch ? parseRomanianAmount(amountMatch[1]) : 0;
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
const daysBefore = (iso: string, days: number) => { const value = new Date(`${iso}T12:00:00`); value.setDate(value.getDate() - days); return isoDate(value); };

export const savingSuggestions = (data: AppData, asOf = isoToday()): SavingSuggestion[] => {
  const forecast = planForecast(data, asOf); const plan = data.settings.salaryPlan; const balance = financialBalance(data);
  const currentExpenses = data.transactions.filter((item) => item.kind === "expense" && item.date >= plan.periodStart && item.date <= asOf && inPlanPeriod(item.date, plan));
  const spendingByCategory = Object.entries(currentExpenses.reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort((a, b) => b[1] - a[1]);
  const suggestions: SavingSuggestion[] = [];
  if (balance.debtRemaining > 0 && balance.netLiquidPosition < 0) suggestions.push({ id: "net-position", tone: "risk", title: t("Datoria depășește lichiditatea actuală"), detail: t("Poziția lichidă netă este {amount} RON. Nu presupune că economiile urmărite sunt disponibile pentru cheltuieli; verifică planul și obligațiile apropiate.", { amount: Math.round(balance.netLiquidPosition) }), potential: Math.abs(balance.netLiquidPosition), basis: t("Solduri utilizabile {funds} RON − datorii rămase {debts} RON", { funds: Math.round(balance.liquidFunds), debts: Math.round(balance.debtRemaining) }), nextStep: t("Revizuiește ratele și planul") });
  const incomeLast30 = data.transactions.filter((item) => item.kind === "income" && item.date >= daysBefore(asOf, 29) && item.date <= asOf).reduce((sum, item) => sum + item.amount, 0);
  if (balance.monthlyRates > 0 && incomeLast30 > 0 && balance.monthlyRates / incomeLast30 >= 0.35) { const share = Math.round(balance.monthlyRates / incomeLast30 * 100); suggestions.push({ id: "rate-pressure", tone: "watch", title: t("Ratele apasă vizibil în veniturile recente"), detail: t("Ratele declarate reprezintă {share}% din veniturile înregistrate în ultimele 30 de zile. Include-le în limita planului înainte de cheltuielile flexibile.", { share }), potential: balance.monthlyRates, basis: t("{rates} RON rate/lună din {income} RON venituri în 30 zile", { rates: Math.round(balance.monthlyRates), income: Math.round(incomeLast30) }), nextStep: t("Deschide scadențele") }); }
  if (plan.nextPayday && forecast.projectedRemaining < 0) suggestions.push({ id: "pace", tone: "risk", title: t("Ritmul actual depășește planul"), detail: t("Estimarea indică un minus de {amount} RON până la următorul venit. Orice reducere a cheltuielilor flexibile micșorează direct această diferență.", { amount: Math.round(Math.abs(forecast.projectedRemaining)) }), potential: Math.abs(forecast.projectedRemaining), basis: t("{spent} RON cheltuiți în {elapsed} zile; orizont {remaining} zile", { spent: Math.round(forecast.spentToDate), elapsed: forecast.elapsedDays, remaining: forecast.remainingDays }), nextStep: t("Compară ritmul cu planul") });
  const recentStart = daysBefore(asOf, 6); const previousStart = daysBefore(asOf, 13); const previousEnd = daysBefore(asOf, 7);
  const totalsFor = (start: string, end: string) => data.transactions.filter((item) => item.kind === "expense" && item.date >= start && item.date <= end).reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {});
  const recentByCategory = totalsFor(recentStart, asOf); const previousByCategory = totalsFor(previousStart, previousEnd);
  const trend = Object.entries(recentByCategory).map(([category, amount]) => ({ category, amount, previous: previousByCategory[category] || 0 })).filter((item) => item.previous > 0 && item.amount >= item.previous * 1.25 && item.amount - item.previous >= 40).sort((a, b) => (b.amount - b.previous) - (a.amount - a.previous))[0];
  if (trend) { const increase = Math.round(trend.amount - trend.previous); suggestions.push({ id: "history-trend", tone: "watch", title: t("{category} crește față de săptămâna anterioară", { category: t(trend.category) }), detail: t("În ultimele 7 zile sunt {amount} RON, cu {increase} RON peste cele 7 zile anterioare. Compară intrările înainte de a decide dacă este un vârf punctual sau un nou ritm.", { amount: Math.round(trend.amount), increase }), potential: increase, basis: t("{from}–{to} comparat cu {previousFrom}–{previousTo}", { from: recentStart, to: asOf, previousFrom: previousStart, previousTo: previousEnd }), nextStep: t("Vezi mișcările categoriei") }); }
  const envelope = plan.allocations.filter((item) => Boolean(item.category)).map((item) => ({ item, ...allocationStatus(data, item) })).filter((item) => item.state !== "healthy").sort((a, b) => b.usage - a.usage)[0];
  if (envelope) suggestions.push({ id: "envelope", tone: envelope.state === "over" ? "risk" : "watch", title: envelope.state === "over" ? t("{label} a depășit limita", { label: envelope.item.label }) : t("{label} se apropie de limită", { label: envelope.item.label }), detail: t("{spent} RON au fost cheltuiți din limita ajustată de {budget} RON. O realocare nu mută bani între surse; schimbă numai limitele plicurilor.", { spent: Math.round(envelope.spent), budget: Math.round(envelope.budget) }), potential: Math.abs(envelope.remaining), basis: t("{percent}% utilizat în perioada planului", { percent: Math.round(envelope.usage * 100) }), nextStep: t("Vezi plicul și realocările") });
  const top = spendingByCategory[0];
  if (top && top[1] > 0) { const potential = Math.max(1, Math.round(top[1] * 0.1)); suggestions.push({ id: "category", tone: "watch", title: t("Revizuiește {category}", { category: t(top[0]) }), detail: t("Aceasta este categoria principală în perioada curentă ({amount} RON). O reducere orientativă de 10% ar păstra aproximativ {potential} RON, fără să modifice nimic automat.", { amount: Math.round(top[1]), potential }), potential, basis: t("{amount} RON din {count} cheltuieli ale planului", { amount: Math.round(top[1]), count: currentExpenses.length }), nextStep: t("Deschide jurnalul") }); }
  if (forecast.scheduled > 0) suggestions.push({ id: "reserve", tone: "watch", title: t("Păstrează rezerva pentru scadențe"), detail: t("{amount} RON sunt deja rezervați pentru plăți recurente din acest plan. Tratează suma ca indisponibilă înainte de a face o cheltuială nouă.", { amount: Math.round(forecast.scheduled) }), potential: forecast.scheduled, basis: t("{count} scadențe active înregistrate", { count: data.recurring.filter((item) => item.active).length }), nextStep: t("Verifică scadențele") });
  const goal = data.savings.find((item) => item.target > item.current);
  if (goal && forecast.projectedRemaining > 0) suggestions.push({ id: "goal", tone: "good", title: t("Protejează obiectivul „{name}”", { name: goal.name }), detail: t("Planul proiectează o marjă de {amount} RON. Poți compara această marjă cu deficitul obiectivului, fără ca aplicația să mute bani automat.", { amount: Math.round(forecast.projectedRemaining) }), potential: Math.min(forecast.projectedRemaining, goal.target - goal.current), basis: t("{current} RON din ținta de {target} RON", { current: Math.round(goal.current), target: Math.round(goal.target) }), nextStep: t("Vezi obiectivul") });
  if (!suggestions.length) suggestions.push({ id: "history", tone: "good", title: t("Construiește un profil financiar observabil"), detail: t("Înregistrează câteva venituri și cheltuieli, apoi stabilește data următorului venit. Asistentul va compara istoricul, bilanțul și ritmul real fără să trimită datele către un serviciu extern."), basis: t("Încă nu există suficiente mișcări pentru o comparație personală"), nextStep: t("Adaugă prima mișcare") });
  return suggestions.slice(0, 4);
};

export type HealthScoreBreakdown = {
  /** `null` înseamnă „încă nu am din ce calcula”, nu „zero”. */
  score: number | null;
  tone: "good" | "watch" | "risk" | "unknown";
  factors: Array<{
    id: string;
    label: string;
    value: number;
    weight: number;
    detail: string;
    /** Fals când factorul nu are pe ce se sprijini; atunci nu intră în scor. */
    known: boolean;
  }>;
  /** Ce îi lipsește registrului ca scorul să însemne ceva. */
  missing: string[];
};

/**
 * Scor local 0–100 pentru ecranul Astăzi.
 * Combină marja, starea plicurilor, scadențele apropiate și ritmul de cheltuire.
 * Nu estimează venituri viitoare și nu modifică datele.
 *
 * Un factor intră în scor doar dacă are pe ce se sprijini. Altfel un registru gol
 * primea 80 din 100 și eticheta „calm”: „toate plicurile sunt în limite” și „nicio
 * scadență” sunt adevărate fără să însemne nimic atunci când nu există nici plicuri,
 * nici scadențe. Când datele cunoscute cântăresc prea puțin, scorul este `null` și
 * spunem ce lipsește, în loc să inventăm o notă de trecere.
 */
export const calculateHealthScore = (data: AppData, asOf = isoToday()): HealthScoreBreakdown => {
  const plan = data.settings.salaryPlan;
  const forecast = planForecast(data, asOf);
  const sourceIds = plan.sourceIds.length ? plan.sourceIds : data.settings.paymentSources.map((s) => s.id);
  const availableSources = data.settings.paymentSources
    .filter((s) => sourceIds.includes(s.id))
    .reduce((sum, s) => sum + sourceBalance(data, s.id), 0);

  const reserved = plan.allocations.reduce((sum, a) => sum + Math.max(0, allocationStatus(data, a).remaining), 0);
  const scheduled = pendingRecurringInPlan(data).reduce((sum, i) => sum + i.amount, 0);
  const remaining = availableSources - reserved - scheduled;
  const marginRatio = availableSources > 0 ? Math.max(0, Math.min(1, remaining / availableSources)) : (remaining >= 0 ? 0.6 : 0);
  // Marja are sens doar dacă știm ce bani există: o mișcare înregistrată sau un sold de pornire.
  const marginKnown = data.transactions.length > 0 || data.settings.paymentSources.some((item) => item.openingBalance > 0);
  const marginDetail = remaining >= 0
    ? t("{remaining} RON nerepartizați din {available} RON", { remaining: Math.round(remaining), available: Math.round(availableSources) })
    : t("Planul este peste limită cu {amount} RON", { amount: Math.round(Math.abs(remaining)) });

  const envelopes = plan.allocations.map((a) => allocationStatus(data, a));
  let envelopeScore = 1;
  if (envelopes.length) {
    const avgHealth = envelopes.reduce((sum, e) => sum + Math.max(0, 1 - e.usage), 0) / envelopes.length;
    const overPenalty = envelopes.some((e) => e.state === "over") ? 0.35 : envelopes.some((e) => e.state === "watch") ? 0.15 : 0;
    envelopeScore = Math.max(0, avgHealth - overPenalty);
  }
  const overCount = envelopes.filter((e) => e.state === "over").length;
  const watchCount = envelopes.filter((e) => e.state === "watch").length;
  const envelopeDetail = envelopes.length
    ? overCount
      ? t(overCount > 1 ? "{count} plicuri depășite" : "{count} plic depășit", { count: overCount })
      : watchCount
        ? t(watchCount > 1 ? "{count} plicuri aproape de limită" : "{count} plic aproape de limită", { count: watchCount })
        : t("Toate plicurile sunt în limite")
    : t("Nu există încă plicuri");

  const in7Days = new Date(`${asOf}T12:00:00`);
  in7Days.setDate(in7Days.getDate() + 7);
  const horizon = isoDate(in7Days);
  const upcomingRecurring = pendingRecurringInPlan(data).filter((i) => i.dueDate <= horizon);
  const upcomingDebts = data.debts.filter((d) => d.dueDate && d.dueDate >= asOf && d.dueDate <= horizon);
  const upcomingAmount = upcomingRecurring.reduce((sum, i) => sum + i.amount, 0) +
    upcomingDebts.reduce((sum, d) => sum + (d.monthly || 0), 0);
  const dueScore = upcomingAmount === 0 ? 1 : Math.max(0, 1 - Math.min(1, upcomingAmount / Math.max(1, availableSources * 0.4)));
  const upcomingCount = upcomingRecurring.length + upcomingDebts.length;
  const dueDetail = upcomingCount
    ? t(upcomingCount > 1 ? "{count} scadențe în 7 zile ({amount} RON)" : "{count} scadență în 7 zile ({amount} RON)", { count: upcomingCount, amount: Math.round(upcomingAmount) })
    : t("Nicio scadență în următoarele 7 zile");

  let paceScore = 0.7;
  let paceKnown = false;
  let paceDetail = t("Setează următorul venit pentru a calcula ritmul");
  if (plan.nextPayday || plan.earliestPayday) {
    paceKnown = true;
    if (forecast.spentToDate <= 0) {
      paceScore = 0.85;
      paceDetail = t("Încă nu există cheltuieli în perioada curentă");
    } else if (forecast.safeDaily <= 0) {
      paceScore = 0.2;
      paceDetail = t("Ritmul sigur este zero sau negativ");
    } else {
      const ratio = forecast.paceDaily / forecast.safeDaily;
      paceScore = ratio <= 0.85 ? 1 : ratio <= 1.05 ? 0.75 : ratio <= 1.3 ? 0.4 : 0.15;
      paceDetail = t("Ritm actual {pace} RON/zi vs sigur {safe} RON/zi", { pace: Math.round(forecast.paceDaily), safe: Math.round(forecast.safeDaily) });
    }
  }

  const duesKnown = data.recurring.some((item) => item.active) || data.debts.length > 0;

  const factors = [
    { id: "margin", label: t("Marjă până la venit"), value: marginRatio, weight: 0.35, known: marginKnown, detail: marginKnown ? marginDetail : t("Încă nu există mișcări sau solduri de pornire") },
    { id: "envelopes", label: t("Starea plicurilor"), value: envelopeScore, weight: 0.25, known: envelopes.length > 0, detail: envelopeDetail },
    { id: "dues", label: t("Scadențe apropiate"), value: dueScore, weight: 0.20, known: duesKnown, detail: duesKnown ? dueDetail : t("Nu urmărești încă scadențe sau datorii") },
    { id: "pace", label: t("Ritm de cheltuire"), value: paceScore, weight: 0.20, known: paceKnown, detail: paceDetail },
  ];

  const missing = [
    marginKnown ? "" : t("Adaugă o mișcare sau soldul unei surse"),
    envelopes.length ? "" : t("Creează primul plic în Plan"),
    duesKnown ? "" : t("Treci scadențele lunare sau o datorie"),
    paceKnown ? "" : t("Stabilește data următorului venit"),
  ].filter(Boolean);

  // Sub jumătate din pondere cunoscută, orice număr ar fi o presupunere.
  const knownWeight = factors.reduce((sum, f) => sum + (f.known ? f.weight : 0), 0);
  if (knownWeight < 0.5) return { score: null, tone: "unknown", factors, missing };

  const raw = factors.reduce((sum, f) => sum + (f.known ? f.value * f.weight : 0), 0) / knownWeight;
  const score = Math.round(Math.max(0, Math.min(100, raw * 100)));
  const tone: HealthScoreBreakdown["tone"] = score >= 75 ? "good" : score >= 45 ? "watch" : "risk";

  return { score, tone, factors, missing };
};
