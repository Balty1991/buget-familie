/**
 * Consultantul financiar (Analiză → Asistent). Telefonul face socotelile și trimite doar
 * un rezumat: totaluri pe luni și pe categorii, plicuri, scadențe, datorii, obiective și
 * evenimente, fără tranzacții, magazine, notițe sau nume de persoane (doar categoriile, ale aplicației sau create de familie). Modelul le explică
 * și propune pașii; raportul se păstrează pe telefon pentru luna în curs.
 */
import { addIsoDays, allocationStatus, isBalanceAdjustment, isoToday, type AppData } from "./finance-data";
import { emergencyFund } from "./emergency-fund";
import { upcomingPlannedEvents } from "./planned-events";
import { getLanguage, t } from "./i18n";

const ENDPOINT = "https://europe-central2-buget-familie-a6a0d.cloudfunctions.net/aiGuide";
const REPORT_KEY = "buget-familie:consult-report";
const CONSENT_KEY = "buget-familie:consult-consent";

export type ConsultSource = "gemini" | "groq";
export type ConsultReport = {
  headline: string;
  status: "bine" | "atentie" | "risc";
  summary: string;
  actions: Array<{ title: string; detail: string; amount: number }>;
  watch: string[];
  praise: string;
};
export type SavedConsult = { month: string; at: string; source: ConsultSource; report: ConsultReport };

const round = (value: number) => Math.round(value);
const monthOf = (iso: string) => iso.slice(0, 7);
const previousMonth = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, "0")}`;
};

/** Rezumatul trimis: cifre și categorii; titlurile, notițele și numele nu pleacă. */
export function consultContext(data: AppData, today = isoToday()) {
  const current = monthOf(today);
  const months = [previousMonth(previousMonth(previousMonth(current))), previousMonth(previousMonth(current)), previousMonth(current), current];
  const byMonth = new Map(months.map((month) => [month, { income: 0, expense: 0, categories: new Map<string, number>() }]));
  for (const item of data.transactions) {
    if (!(item.amount > 0) || isBalanceAdjustment(item) || item.date > today) continue;
    const bucket = byMonth.get(monthOf(item.date));
    if (!bucket) continue;
    if (item.kind === "income") bucket.income += item.amount;
    else {
      bucket.expense += item.amount;
      bucket.categories.set(item.category, (bucket.categories.get(item.category) || 0) + item.amount);
    }
  }
  const past = months.slice(0, 3).filter((month) => (byMonth.get(month)?.expense || 0) + (byMonth.get(month)?.income || 0) > 0);
  const now = byMonth.get(current)!;
  const categoryNames = new Set<string>();
  for (const month of months) byMonth.get(month)!.categories.forEach((_, name) => categoryNames.add(name));
  const categories = Array.from(categoryNames).map((name) => ({
    name,
    thisMonth: round(now.categories.get(name) || 0),
    monthlyAverage: past.length ? round(past.reduce((sum, month) => sum + (byMonth.get(month)!.categories.get(name) || 0), 0) / past.length) : 0,
  })).sort((a, b) => Math.max(b.thisMonth, b.monthlyAverage) - Math.max(a.thisMonth, a.monthlyAverage)).slice(0, 12);

  const fund = emergencyFund(data, today);
  const events = upcomingPlannedEvents(data.settings.plannedEvents, today, 180).slice(0, 4);
  const recurring = data.recurring.filter((item) => item.active);
  const monthlyRecurring = recurring.reduce((sum, item) => sum + (item.frequency === "yearly" ? item.amount / 12 : item.frequency === "quarterly" ? item.amount / 3 : item.amount), 0);
  const [year, month] = current.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    language: getLanguage(),
    today,
    month: { dayOfMonth: Number(today.slice(8, 10)), daysInMonth, income: round(now.income), expense: round(now.expense) },
    previousMonths: past.map((month) => ({ month, income: round(byMonth.get(month)!.income), expense: round(byMonth.get(month)!.expense) })),
    categories,
    envelopes: data.settings.salaryPlan.allocations.slice(0, 12).map((item) => {
      const status = allocationStatus(data, item);
      return { category: item.category, planned: round(item.amount), left: round(status.remaining) };
    }),
    nextPayday: data.settings.salaryPlan.nextPayday || null,
    fixedMonthly: round(monthlyRecurring),
    debts: data.debts.filter((debt) => debt.remaining > 0).slice(0, 8).map((debt) => ({ kind: debt.kind || "credit", remaining: round(debt.remaining), monthly: round(debt.monthly), ...(debt.annualRate ? { annualRatePercent: debt.annualRate } : {}) })),
    goals: data.savings.slice(0, 8).map((goal) => ({ target: round(goal.target), saved: round(goal.current), ...(goal.dueDate ? { dueDate: goal.dueDate } : {}), emergency: fund?.goal?.id === goal.id })),
    emergencyFund: fund ? { monthlySpending: fund.monthly, saved: round(fund.saved), months: fund.months, target: round(fund.target) } : null,
    upcomingEvents: events.map((item) => ({ kind: item.event.kind, daysLeft: item.daysLeft, estimate: round(item.estimate), saved: round(item.saved), perMonth: round(item.perMonth) })),
  };
}

/** Cât poate propune modelul pe lună: nu mai mult decât intră de obicei. */
export function groundReport(report: ConsultReport, context: ReturnType<typeof consultContext>): ConsultReport {
  const incomes = [context.month.income, ...context.previousMonths.map((month) => month.income)].filter((value) => value > 0);
  const ceiling = incomes.length ? Math.max(...incomes) : 0;
  return { ...report, actions: report.actions.map((action) => ({ ...action, amount: action.amount > 0 && (!ceiling || action.amount <= ceiling) ? action.amount : 0 })) };
}

/** Destule mișcări cât să aibă ce spune: o lună întreagă sau două săptămâni din luna asta. */
export function consultReady(data: AppData, today = isoToday()) {
  const since = addIsoDays(today, -45);
  const days = new Set(data.transactions.filter((item) => item.date >= since && item.date <= today && !isBalanceAdjustment(item)).map((item) => item.date));
  return days.size >= 7;
}

export async function requestConsult(data: AppData): Promise<SavedConsult> {
  const context = consultContext(data);
  const { appCheckHeader, authHeader } = await import("./realtime-sync");
  const capped = <T,>(work: Promise<T>) => Promise.race([work, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8_000))]);
  const [token, identity] = await Promise.all([capped(appCheckHeader()), capped(authHeader())]);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["X-Firebase-AppCheck"] = token;
  if (identity) headers.Authorization = identity;
  let response: Response;
  try {
    response = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify({ mode: "consult", context }), signal: AbortSignal.timeout(65_000) });
  } catch {
    throw new Error(t("Nu am putut ajunge la consultant. Verifică internetul și mai încearcă o dată."));
  }
  const payload = await response.json().catch(() => ({})) as { report?: ConsultReport; source?: string; error?: string };
  if (!response.ok || !payload.report) throw new Error(payload.error || t("Consultantul nu a putut răspunde acum. Mai încearcă puțin mai târziu."));
  const saved: SavedConsult = { month: monthOf(context.today), at: new Date().toISOString(), source: payload.source === "groq" ? "groq" : "gemini", report: groundReport(payload.report, context) };
  try { localStorage.setItem(REPORT_KEY, JSON.stringify(saved)); } catch { /* fără stocare: raportul rămâne doar pe ecran */ }
  return saved;
}

export function savedConsult(): SavedConsult | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(REPORT_KEY) || "null") as SavedConsult | null;
    return value && value.report && typeof value.report.headline === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function consultConsented(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; }
}

export function rememberConsultConsent() {
  try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* fără stocare: întrebăm din nou data viitoare */ }
}
