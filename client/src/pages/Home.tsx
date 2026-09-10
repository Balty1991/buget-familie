/**
 * Atelierul Financiar — tablou mobil pentru o persoană sau o gospodărie, cu decizia următoare în prim-plan.
 * First paint: doar Astăzi. Restul ecranelor, sync-ul și formularele se încarcă la cerere.
 */
import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, BellRing, CalendarClock, CreditCard, Goal, Info, LayoutDashboard, LayoutGrid, ListFilter, MessagesSquare, MoreHorizontal, PlayCircle, Plus, ReceiptText, Search, ShieldCheck, Ticket, Wallet, WalletCards, X, ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { allocationStatus, allocationWeekStatus, autoPostDueRecurring, confirmRecurringPayment, createEmptyAppData, financialBalance, formatDate, inPlanPeriod, isoToday, newId, normalizeAppData, pendingRecurringInPlan, planEndDate, planForecast, sourceBalance, transferBetweenEnvelopes, type AppData, type Debt, type Receipt, type SavingsGoal, type Transaction } from "@/lib/finance-data";
import { calendarBudgetWeekKey, currentCalendarBudgetWeek } from "@/lib/calendar-budget";
import { migrateLegacyReceiptImages, removeReceiptImages } from "@/lib/receipt-storage";
import { APP_STORAGE_KEY, LEGACY_STORAGE_KEY, readAppData, readSyncJournal, writeAppData, writeSyncJournal, type SyncJournalEntry } from "@/lib/app-storage";
import type { EncryptedEnvelope } from "@/lib/family-crypto";
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { AICompanion, type FinancialUpdate, type GuidedRevert, type NaturalDraft } from "@/components/AICompanion";
import { AIFinancialSetup } from "@/components/AIFinancialSetup";
import { BrandMark } from "@/components/BrandMark";
import { TodayLedger } from "@/components/TodayLedger";
import { TodayBrief } from "@/components/TodayBrief";
import { MovementsJournal } from "@/components/MovementsJournal";
import { scheduleFinancialReminders } from "@/lib/local-notifications";
import { allocationHistorySnapshot } from "@/lib/allocation-history";
import { weeklyEnvelopeDailyRhythm } from "@/lib/household-insights";
import {
  DeferBelowFold,
  LIGHT_THEMES,
  automaticTheme,
  backgroundOptions,
  currentLocalMinutes,
  dateText,
  defaultScheduleTimes,
  fmtExact,
  money,
  sourceKindName,
  themeOptions,
  type BackgroundId,
  type MainView,
  type MoreView,
  type SyncPanelProps,
  type ThemeId,
  type ThemeSchedule,
  type ThemeScheduleTimes,
} from "@/pages/home-kit";

const PlanStudio = lazy(() => import("@/components/PlanStudio").then((module) => ({ default: module.PlanStudio })));
const QuickEntryPanel = lazy(() => import("@/components/QuickEntryPanel").then((module) => ({ default: module.QuickEntryPanel })));
const FirstRunSetup = lazy(() => import("@/components/FirstRunSetup").then((module) => ({ default: module.FirstRunSetup })));
const WeeklySummaryPanel = lazy(() => import("@/components/WeeklySummaryPanel").then((module) => ({ default: module.WeeklySummaryPanel })));
const AllocationHistoryChart = lazy(() => import("@/components/AllocationHistoryChart").then((module) => ({ default: module.AllocationHistoryChart })));
const FinancialCalendarView = lazy(() => import("@/components/FinancialCalendarView").then((module) => ({ default: module.FinancialCalendarView })));
const loadSecondary = () => import("@/pages/home-secondary");
const ThemePicker = lazy(() => loadSecondary().then((module) => ({ default: module.ThemePicker })));
const QuickActionsPalette = lazy(() => loadSecondary().then((module) => ({ default: module.QuickActionsPalette })));
const CalmOnboarding = lazy(() => loadSecondary().then((module) => ({ default: module.CalmOnboarding })));
const TransactionForm = lazy(() => loadSecondary().then((module) => ({ default: module.TransactionForm })));
const GoalForm = lazy(() => loadSecondary().then((module) => ({ default: module.GoalForm })));
const DebtPaymentForm = lazy(() => loadSecondary().then((module) => ({ default: module.DebtPaymentForm })));
const ReceiptForm = lazy(() => loadSecondary().then((module) => ({ default: module.ReceiptForm })));
const SpendingHabitsView = lazy(() => loadSecondary().then((module) => ({ default: module.SpendingHabitsView })));
const LongTermGoalsView = lazy(() => loadSecondary().then((module) => ({ default: module.LongTermGoalsView })));
const ObjectivesView = lazy(() => loadSecondary().then((module) => ({ default: module.ObjectivesView })));
const InsightsView = lazy(() => loadSecondary().then((module) => ({ default: module.InsightsView })));
const MoreViewScreen = lazy(() => loadSecondary().then((module) => ({ default: module.MoreView })));
const loadFamilySync = () => import("@/lib/realtime-sync");
const loadFamilyCrypto = () => import("@/lib/family-crypto");

const initialMainView = (): MainView => { const requested = new URLSearchParams(window.location.search).get("view"); return requested === "journal" || requested === "plan" || requested === "obligations" || requested === "insights" || requested === "utilities" ? requested : "today"; };
type AdvisorAction = "plan" | "recurring" | "objectives" | "journal";
type AdvisorSignal = { id: string; tone: "good" | "watch" | "risk"; eyebrow: string; title: string; detail: string; action: AdvisorAction; actionLabel: string };

const preloadView = (id: MainView) => {
  if (id === "plan") void import("@/components/PlanStudio");
  else if (id === "calendar") void import("@/components/FinancialCalendarView");
  else if (id === "insights" || id === "obligations" || id === "goals" || id === "habits" || id === "utilities") void loadSecondary();
};

function planMath(data: AppData) {
  const plan = data.settings.salaryPlan;
  const planEnd = planEndDate(plan);
  const sourceIds = plan.sourceIds.length ? plan.sourceIds : data.settings.paymentSources.map((source) => source.id);
  const selected = data.settings.paymentSources.filter((source) => sourceIds.includes(source.id));
  const availableSources = selected.reduce((sum, source) => sum + sourceBalance(data, source.id), 0);
  const periodExpenses = data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  const days = planEnd ? Math.max(1, Math.floor((new Date(`${planEnd}T12:00:00`).valueOf() - new Date(`${plan.periodStart}T12:00:00`).valueOf()) / 86400000) + 1) : 7;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weeklyPacedTotal = plan.allocations.filter((item) => item.weeklyPace !== false).reduce((sum, item) => sum + item.amount, 0);
  const weekly = plan.weeklyLimit || weeklyPacedTotal / weeks;
  const scheduled = pendingRecurringInPlan(data).reduce((sum, item) => sum + item.amount, 0);
  /** Banii deja puși deoparte în plicuri nu se scad a doua oară de aici: o cheltuială dintr-un plic mișcă doar plicul, nu și marja generală. */
  const reservedInEnvelopes = plan.allocations.reduce((sum, item) => sum + allocationStatus(data, item).remaining, 0);
  const remaining = availableSources - reservedInEnvelopes - scheduled;
  return { plan, planEnd, sourceIds, selected, availableSources, periodExpenses, scheduled, reservedInEnvelopes, remaining, days, weeks, weekly, weeklyPacedTotal };
}

function advisorSignals(data: AppData): AdvisorSignal[] {
  const math = planMath(data);
  const forecast = planForecast(data);
  const signals: AdvisorSignal[] = [];
  const pending = pendingRecurringInPlan(data).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!math.plan.nextPayday) {
    signals.push({ id: "plan-needed", tone: "watch", eyebrow: "URMĂTORUL PAS", title: "Alege următorul venit", detail: "Planul are nevoie de o dată de salariu pentru a calcula ritmul sigur de cheltuire.", action: "plan", actionLabel: "Configurează planul" });
  } else if (math.remaining < 0) {
    signals.push({ id: "over-plan", tone: "risk", eyebrow: "ATENȚIE", title: `Planul este peste limită cu ${money(Math.abs(math.remaining))}`, detail: `Sunt incluse ${money(math.periodExpenses)} cheltuieli și ${money(math.scheduled)} rezervate până la ${dateText(math.planEnd || math.plan.nextPayday)}.`, action: "plan", actionLabel: "Revizuiește planul" });
  } else if (forecast.spentToDate > 0 && forecast.projectedRemaining < 0) {
    signals.push({ id: "pace-risk", tone: "risk", eyebrow: "RITM DE REVIZUIT", title: `La ritmul actual lipsesc ${money(Math.abs(forecast.projectedRemaining))}`, detail: `Cheltuielile sunt în medie ${money(forecast.paceDaily)} pe zi; ritmul sigur este ${money(forecast.safeDaily)} pe zi până la venit.`, action: "plan", actionLabel: "Ajustează planul" });
  } else {
    const daily = math.remaining / Math.max(1, math.days);
    signals.push({ id: "daily-pace", tone: "good", eyebrow: "RITM SIGUR", title: `${money(daily)} pe zi până la venit`, detail: `${money(math.remaining)} rămân după cheltuielile înregistrate și rezervele deja planificate.`, action: "plan", actionLabel: "Vezi calculele" });
  }
  if (pending[0]) {
    signals.push({ id: "next-recurring", tone: "watch", eyebrow: "SCADENȚĂ REZERVATĂ", title: `${pending[0].name} · ${money(pending[0].amount)}`, detail: `Este programată pentru ${dateText(pending[0].dueDate, true)} și este deja exclusă din suma disponibilă.`, action: "recurring", actionLabel: "Deschide scadențele" });
  }
  const allocation = data.settings.salaryPlan.allocations.map((item) => ({ item, ...allocationStatus(data, item) })).sort((a, b) => b.usage - a.usage)[0];
  if (allocation && allocation.state !== "healthy") {
    const over = allocation.state === "over";
    signals.push({ id: `allocation-${allocation.item.id}`, tone: over ? "risk" : "watch", eyebrow: over ? "PLIC DEPĂȘIT" : "APROAPE DE LIMITĂ", title: `${allocation.item.label}: ${money(Math.max(0, allocation.remaining))} rămași`, detail: `${money(allocation.spent)} cheltuiți din limita ajustată de ${money(allocation.budget)} în perioada activă.`, action: "plan", actionLabel: "Vezi plicul" });
  }
  const goal = data.savings.filter((item) => item.target > item.current).sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
  if (goal && signals.length < 3) signals.push({ id: `goal-${goal.id}`, tone: "good", eyebrow: "OBIECTIV COMUN", title: `${money(goal.target - goal.current)} până la ${goal.name}`, detail: `Progres actual: ${money(goal.current)} din ${money(goal.target)}.`, action: "objectives", actionLabel: "Vezi obiectivul" });
  return signals.slice(0, 3);
}

const WEEKDAY_SHORT = ["L", "Ma", "Mi", "J", "V", "S", "D"];

function openHouseholdGuide() {
  window.dispatchEvent(new CustomEvent("buget-familie:open-guide"));
}

function SourceGlyph({ kind }: { kind: keyof typeof sourceKindName }) {
  if (kind === "cash") return <Wallet size={16} />;
  if (kind === "meal") return <Ticket size={16} />;
  if (kind === "transfer") return <ArrowUpRight size={16} />;
  return <CreditCard size={16} />;
}

/**
 * Household OS — situația zilei: cât a rămas, ritmul, sursele și următorul venit.
 */
function TodayPulse({ data, onGo }: { data: AppData; onGo: (view: MainView) => void }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    const iso = date.toISOString().slice(0, 10);
    const amount = data.transactions.filter((item) => item.kind === "expense" && item.date === iso).reduce((sum, item) => sum + item.amount, 0);
    return { iso, label: date.toLocaleDateString("ro-RO", { weekday: "short" }).replace(".", ""), amount, today: index === 6 };
  });
  const max = Math.max(...days.map((day) => day.amount), 1);
  const weekTotal = days.reduce((sum, day) => sum + day.amount, 0);
  const average = weekTotal / 7;
  const categoryTotals = data.transactions.filter((item) => item.kind === "expense" && days.some((day) => day.iso === item.date)).reduce<Record<string, number>>((totals, item) => { totals[item.category] = (totals[item.category] || 0) + item.amount; return totals; }, {});
  const topCategories = Object.entries(categoryTotals).sort(([, left], [, right]) => right - left).slice(0, 3);
  return <section className="bf-modern-pulse"><div className="bf-modern-pulse-copy"><p className="bf-kicker">PULSUL SĂPTĂMÂNII</p><h2>Vezi ritmul banilor dintr-o privire.</h2><p>{weekTotal ? <>Ai cheltuit <b>{money(weekTotal)}</b> în ultimele 7 zile, aproximativ <b>{money(average)}</b> pe zi.</> : "Începe să înregistrezi mișcări pentru a vedea ritmul real al gospodăriei."}</p><button type="button" onClick={() => onGo("journal")}>Deschide registrul <ChevronRight size={15} /></button>{topCategories.length > 0 && <div className="bf-modern-pulse-categories"><small>UNDE S-AU DUS BANII</small>{topCategories.map(([category, amount]) => <span key={category}><b>{category}</b><strong>{money(amount)}</strong><i><em style={{ width: Math.round((amount / weekTotal) * 100) + "%" }} /></i></span>)}</div>}</div><div className="bf-modern-pulse-chart" aria-label="Cheltuielile din ultimele 7 zile">{days.map((day) => <div key={day.iso} className={day.today ? "today" : ""}><span title={money(day.amount)}><i style={{ height: Math.max(8, Math.round((day.amount / max) * 100)) + "%" }} /></span><small>{day.label}</small></div>)}</div></section>;
}
function TodayView({ data, onAdd, onGo, onChange }: { data: AppData; onAdd: () => void; onGo: (view: MainView) => void; onChange: (next: AppData) => void }) {
  const math = useMemo(() => planMath(data), [data]);
  const forecast = useMemo(() => planForecast(data), [data]);
  const signals = useMemo(() => advisorSignals(data), [data]);
  const balance = useMemo(() => financialBalance(data, math.plan.periodStart, math.planEnd), [data, math.plan.periodStart, math.planEnd]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [shownTrancheKey, setShownTrancheKey] = useState("");
  const [openHint, setOpenHint] = useState(false);
  const envelopes = useMemo(() => data.settings.salaryPlan.allocations.map((item) => ({ item, ...allocationStatus(data, item) })), [data]);
  const topEnvelope = [...envelopes].sort((a, b) => b.usage - a.usage)[0];
  const activeEnvelopeAlert = envelopes.filter((item) => item.state !== "healthy" && !dismissedAlerts.includes(item.item.id)).sort((a, b) => (b.state === "over" ? 2 : 1) - (a.state === "over" ? 2 : 1))[0];
  const lastMoves = data.transactions.slice(0, 3);
  const overPlan = math.remaining < 0;
  const daily = math.plan.nextPayday ? forecast.safeDaily : 0;
  const weeklyEnvelopesRemaining = useMemo(() => envelopes.filter((entry) => entry.item.weeklyPace !== false).reduce((sum, entry) => sum + (allocationWeekStatus(data, entry.item)?.remaining ?? entry.remaining), 0), [data, envelopes]);
  const monthlyEnvelopesRemaining = useMemo(() => envelopes.filter((entry) => entry.item.weeklyPace === false).reduce((sum, entry) => sum + entry.remaining, 0), [envelopes]);
  const envelopeTotalRemaining = Math.max(0, weeklyEnvelopesRemaining + monthlyEnvelopesRemaining);
  const monthIncome = data.transactions.filter((item) => item.kind === "income" && item.date.startsWith(isoToday().slice(0, 7))).reduce((sum, item) => sum + item.amount, 0);
  const activeTranche = math.planEnd ? currentCalendarBudgetWeek(math.weeklyPacedTotal, math.plan.periodStart, math.planEnd, isoToday()) : undefined;
  const activeTrancheKey = activeTranche ? calendarBudgetWeekKey(activeTranche) : "";
  const showTrancheNotice = Boolean(activeTranche && shownTrancheKey === activeTrancheKey);
  useEffect(() => {
    if (!activeTranche || !activeTrancheKey || data.settings.seenWeeklyPlanTranches.includes(activeTrancheKey) || shownTrancheKey === activeTrancheKey) return;
    setShownTrancheKey(activeTrancheKey);
    window.dispatchEvent(new CustomEvent("buget-familie:local-settings", { detail: { seenWeeklyPlanTranches: [...data.settings.seenWeeklyPlanTranches, activeTrancheKey].slice(-80) } }));
  }, [activeTranche, activeTrancheKey, data.settings.seenWeeklyPlanTranches, shownTrancheKey]);
  const openSignal = (action: AdvisorAction) => onGo(action === "plan" ? "plan" : action === "objectives" ? "obligations" : action === "journal" ? "journal" : "obligations");

  const todayIso = isoToday();
  const rhythm = useMemo(() => weeklyEnvelopeDailyRhythm(data, todayIso), [data, todayIso]);
  const rhythmNote = !rhythm.hasWeekly
    ? "Nu sunt plicuri cu ritm săptămânal de împărțit pe zile."
    : rhythm.remaining <= 0 && rhythm.todayLeft <= 0
      ? "Plicul săptămânii e gol până duminică."
      : rhythm.days.some((row) => row.isToday && row.over)
        ? `Azi a trecut peste partea de ${money(rhythm.todayShare)}. Mai rămân ${money(rhythm.remaining)}, cam ${money(rhythm.futureShare)} pe zi până duminică.`
        : `Mai rămân ${money(rhythm.remaining)} în plicul săptămânii, cam ${money(rhythm.todayShare)} pe zi până duminică.`;

  const sourceRows = useMemo(
    () => data.settings.paymentSources.map((source) => ({ ...source, balance: sourceBalance(data, source.id) })),
    [data],
  );

  const heroLabel = overPlan ? "Peste limita planului" : data.settings.salaryPlan.allocations.length ? "Rămas în plicuri" : monthIncome > 0 ? "Venit înregistrat luna asta" : "Plicuri neconfigurate";
  const heroValue = overPlan ? Math.abs(math.remaining) : data.settings.salaryPlan.allocations.length ? envelopeTotalRemaining : monthIncome;
  const heroHint = overPlan
    ? "de acoperit prin limită, plicuri sau cheltuieli flexibile"
    : data.settings.salaryPlan.allocations.length
      ? `${money(Math.max(0, weeklyEnvelopesRemaining))} săptămânale · ${money(Math.max(0, monthlyEnvelopesRemaining))} lunare/fixe${math.plan.nextPayday ? ` · reper ${money(daily)}/zi` : ""}`
      : monthIncome > 0
        ? "Suma e în Mișcări. Pune plicuri în Plan ca să vezi cât mai rămâne pe categorii."
        : "Adaugă plicuri pentru a urmări cât mai rămâne în fiecare perioadă";
  const explainer = overPlan
    ? "Planul este depășit: suma arată cât trebuie acoperit, nu bani disponibili pentru cheltuieli."
    : data.settings.salaryPlan.allocations.length
      ? `Este ce mai poți folosi din plicurile alocate. Reperul zilnic împarte suma pe cele ${forecast.remainingDays} zile până la venit — nu e bani în plus, e ritmul ca să nu golești plicurile înainte.`
      : "Plicurile sunt sume puse deoparte pentru un scop, cum ar fi mâncare, transport sau facturi.";

  return (
    <div className="bf-page bf-today-workspace">
      <section className={`os-hero ${overPlan ? "is-risk" : ""}`}>
        <div className="os-hero-top">
          <span className="os-chip"><i /> {overPlan ? "Plan de revizuit" : "Ritm urmărit"}</span>
          <div className="os-date">
            <b>{String(new Date(`${todayIso}T12:00:00`).getDate()).padStart(2, "0")}</b>
            <span>{new Date(`${todayIso}T12:00:00`).toLocaleDateString("ro-RO", { month: "long" }).toLocaleUpperCase("ro-RO")}</span>
            <span>{new Date(`${todayIso}T12:00:00`).getFullYear()}</span>
          </div>
        </div>
        <p className="os-kicker-lg">{heroLabel}</p>
        <h1 className="os-amount">
          <span>{Math.round(heroValue).toLocaleString("ro-RO")}</span>
          <small>RON</small>
        </h1>
        <p className="os-hint">{heroHint}</p>
        <button type="button" className="os-explainer" onClick={() => setOpenHint((value) => !value)}>
          <Info size={16} aria-hidden="true" /> Cum se citește suma? <span>{openHint ? "−" : "+"}</span>
        </button>
        {openHint ? <p className="os-explainer-body">{explainer}</p> : null}
        <div className="os-gauge">
          <HealthScoreBadge data={data} />
        </div>
      </section>

      <section className="bf-os-rhythm" aria-label="Ritm zilnic">
        <div className="bf-os-rhythm-head">
          <div>
            <p className="bf-os-kicker">Ritm zilnic</p>
            <h2 className="bf-os-title">Cât mai ține ziua.</h2>
          </div>
          <p className="bf-os-note" style={{ margin: 0 }}>azi <b>{money(rhythm.todayLeft)}</b></p>
        </div>
        <div className="bf-os-rhythm-grid">
          {rhythm.days.map((row) => (
            <div key={row.day} className={`bf-os-day${row.isToday ? " is-today" : ""}${row.over ? " is-over" : ""}${row.isFuture ? " is-future" : ""}`}>
              <span>{WEEKDAY_SHORT[row.weekday]}</span>
              <b>{row.left >= 1000 ? `${Math.round(row.left / 1000)}k` : Math.round(row.left)}</b>
              <span className="bf-os-bar" aria-hidden="true"><i style={{ height: `${row.fill}%` }} /></span>
            </div>
          ))}
        </div>
        <p className="bf-os-note">{rhythmNote}</p>
      </section>

      <div className="bf-os-actions">
        <button type="button" className="bf-os-decide" onClick={openHouseholdGuide}>Poți cheltui?</button>
        <button type="button" className="bf-today-add bf-os-secondary" onClick={onAdd}><Plus size={18} /> Înregistrează</button>
      </div>

      <TodayBrief data={data} onGo={onGo} onChange={onChange} onOpenWeek={() => document.getElementById("bf-week-checkin")?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      {sourceRows.length > 0 && (
        <section className="bf-os-sources" aria-label="Surse">
          <p className="bf-os-kicker">Surse</p>
          <h2 className="bf-os-title">De unde pleacă banii.</h2>
          <ul className="bf-os-source-list">
            {sourceRows.map((source) => (
              <li key={source.id}>
                <span className="bf-os-source-icon"><SourceGlyph kind={source.kind} /></span>
                <div>
                  <b>{source.name}</b>
                  <small>{sourceKindName[source.kind]}</small>
                </div>
                <strong>{money(source.balance)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bf-os-income" aria-label="Următorul venit">
        <div className="bf-os-income-head">
          <div>
            <p className="bf-os-kicker">Următorul venit</p>
            <h2 className="bf-os-title">{math.plan.nextPayday ? `${forecast.remainingDays} zile` : "Setează data"}</h2>
            <p className="bf-os-note">{math.plan.nextPayday ? dateText(math.plan.nextPayday, true) : "Planul are nevoie de următorul salariu ca să calculeze ritmul."}</p>
          </div>
          <div>
            <strong>{money(math.availableSources)}</strong>
            <small>în surse acum</small>
          </div>
        </div>
        <p className="bf-os-note">{money(Math.max(0, math.remaining))} disponibili după plicuri · {money(math.scheduled)} în scadențe încă neconfirmate</p>
        <button type="button" className="bf-today-plan-link" style={{ marginTop: 12 }} onClick={() => onGo("plan")}>Deschide planul <ChevronRight size={16} /></button>
      </section>

      <TodayLedger data={data} onGo={(view) => onGo(view)} />
      {(data.transactions.length > 0 || data.settings.members.length > 1 || data.settings.salaryPlan.allocations.length > 0) && (
        <Suspense fallback={<div className="bf-lazy-panel">Pregătim bilanțul săptămânii…</div>}>
          <WeeklySummaryPanel data={data} onOpenJournal={() => onGo("journal")} onOpenPlan={() => onGo("plan")} />
        </Suspense>
      )}
      <DeferBelowFold>
        <section className="bf-today-hub-links" aria-label="Acces rapid">
          <p className="bf-kicker">ACCES RAPID</p>
          <div>
            {[{ label: "Plicuri", detail: "Repartizează", icon: Goal, view: "plan" as MainView }, { label: "Mișcări", detail: "Vezi registrul", icon: WalletCards, view: "journal" as MainView }, { label: "Obligații", detail: "Urmărește scadențele", icon: BellRing, view: "obligations" as MainView }, { label: "Analiză", detail: "Înțelege ritmul", icon: LayoutDashboard, view: "insights" as MainView }].map((item) => {
              const Icon = item.icon;
              return <button key={item.label} onClick={() => onGo(item.view)}><span><Icon size={16} /></span><b>{item.label}</b><small>{item.detail}</small><ChevronRight size={14} /></button>;
            })}
          </div>
        </section>
        {showTrancheNotice && activeTranche && (
          <aside className="bf-weekly-tranche-notice" role="status" aria-live="polite">
            <CalendarClock size={19} />
            <div>
              <p>TRANȘA S{activeTranche.index} A ÎNCEPUT</p>
              <strong>{formatDate(activeTranche.start, { day: "2-digit", month: "short" })} – {formatDate(activeTranche.end, { day: "2-digit", month: "short" })}</strong>
              <span>Ritmul acestei tranșe este {money(activeTranche.amount)} pentru {activeTranche.days} {activeTranche.days === 1 ? "zi" : "zile"}.</span>
            </div>
            <button onClick={() => onGo("plan")}>Plan</button>
            <button className="dismiss" aria-label="Ascunde alerta tranșei săptămânale" onClick={() => setShownTrancheKey("")}><X size={16} /></button>
          </aside>
        )}
        {activeEnvelopeAlert && (
          <aside className={`bf-envelope-live-notice ${activeEnvelopeAlert.state}`} role="status" aria-live="polite">
            <BellRing size={19} />
            <div>
              <p>{activeEnvelopeAlert.state === "over" ? "PLIC DEPĂȘIT" : "APROAPE DE LIMITĂ"}</p>
              <strong>{activeEnvelopeAlert.item.label}</strong>
              <span>{activeEnvelopeAlert.state === "over" ? `${money(Math.abs(activeEnvelopeAlert.remaining))} peste limita alocată.` : `${Math.round(activeEnvelopeAlert.usage * 100)}% din limită este deja consumată.`}</span>
            </div>
            <button onClick={() => onGo("plan")}>Vezi</button>
            <button className="dismiss" aria-label={`Ascunde alerta pentru ${activeEnvelopeAlert.item.label}`} onClick={() => setDismissedAlerts((current) => [...current, activeEnvelopeAlert.item.id])}><X size={16} /></button>
          </aside>
        )}
        <section className="bf-today-decision">
          <div className="bf-today-decision-heading">
            <div>
              <p className="bf-kicker">DECIZIA URMĂTOARE</p>
              <h1>Ce are nevoie <em>gospodăria acum.</em></h1>
            </div>
            <button onClick={() => onGo("insights")}><LayoutDashboard size={17} /> Vezi analiza</button>
          </div>
          <div className="bf-decision-stack">
            {signals.map((signal, index) => (
              <button className={`bf-decision-row ${signal.tone} ${index === 0 ? "primary" : ""}`} key={signal.id} onClick={() => openSignal(signal.action)}>
                <span className="bf-decision-index">0{index + 1}</span>
                <span><small>{signal.eyebrow}</small><b>{signal.title}</b><em>{signal.detail}</em></span>
                <ChevronRight size={19} />
              </button>
            ))}
            {!signals.length && (
              <button className="bf-decision-row good primary" onClick={() => onGo("plan")}>
                <span className="bf-decision-index">01</span>
                <span><small>PLANUL DE LUCRU</small><b>Configurează următorul venit</b><em>Gospodăria are nevoie de intervalul următor pentru a calcula ritmul.</em></span>
                <ChevronRight size={19} />
              </button>
            )}
          </div>
        </section>
        <section className="bf-today-measurements" aria-label="Măsurători financiare curente">
          <article>
            <span>SURSE UTILIZABILE</span>
            <b>{money(balance.liquidFunds)}</b>
            <small>banii incluși în registru</small>
          </article>
          <article>
            <span>OBLIGAȚII CONFIRMATE</span>
            <b className={balance.monthlyRates > 0 ? "attention" : ""}>{money(balance.monthlyRates)}</b>
            <small>{data.debts.length} de revizuit lunar</small>
          </article>
          <article>
            <span>{topEnvelope ? `LIMITĂ: ${topEnvelope.item.label}` : "PLICURI / LIMITE"}</span>
            <b className={topEnvelope?.state === "over" ? "negative" : ""}>{topEnvelope ? `${Math.round(topEnvelope.usage * 100)}%` : "—"}</b>
            <small>{topEnvelope ? `${money(Math.max(0, topEnvelope.remaining))} rămași pentru perioadă` : "creează prima limită"}</small>
          </article>
        </section>
        <TodayPulse data={data} onGo={onGo} />
        <section className="bf-today-activity">
          <div className="bf-section-heading">
            <div>
              <p className="bf-kicker">ACTIVITATE RECENTĂ</p>
              <h2>Ce s-a înregistrat</h2>
            </div>
            <button onClick={() => onGo("journal")}>Toate mișcările <ChevronRight size={15} /></button>
          </div>
          {lastMoves.length ? (
            <div className="bf-today-activity-list">
              {lastMoves.map((item) => (
                <article key={item.id}>
                  <span className={`bf-tx-icon ${item.kind}`}>{item.kind === "income" ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>{dateText(item.date)} · {item.person} · {item.category}</small>
                  </div>
                  <strong className={item.kind}>{item.kind === "income" ? "+" : "−"}{fmtExact.format(item.amount)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <button className="bf-today-empty-activity" onClick={onAdd}>
              <ReceiptText size={20} />
              <span><b>Registrul zilei este pregătit.</b><small>Înregistrează prima cheltuială sau încasare.</small></span>
              <Plus size={18} />
            </button>
          )}
        </section>
      </DeferBelowFold>
      {data.settings.salaryPlan.allocations.length > 0 && (
        <DeferBelowFold>
          <section className="bf-today-envelope-evolution" aria-labelledby="today-envelope-evolution-title">
            <div className="bf-section-heading">
              <div>
                <p className="bf-kicker">RITMUL PLICURILOR</p>
                <h2 id="today-envelope-evolution-title">Evoluția în timp</h2>
              </div>
              <button onClick={() => onGo("plan")}>Vezi istoricul <ChevronRight size={15} /></button>
            </div>
            <Suspense fallback={<div className="bf-lazy-panel">Pregătim ritmul plicurilor…</div>}>
              <AllocationHistoryChart entries={allocationHistorySnapshot(data)} />
            </Suspense>
          </section>
        </DeferBelowFold>
      )}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AppData>(() => { try { const raw = window.localStorage.getItem(APP_STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY); return raw ? normalizeAppData(JSON.parse(raw)) : createEmptyAppData(); } catch { return createEmptyAppData(); } });
  const [storageNotice, setStorageNotice] = useState<string | null>(null); const [storageReady, setStorageReady] = useState(false); const [onboardingOpen, setOnboardingOpen] = useState(false); const [setupOpen, setSetupOpen] = useState(false);
  const storageHydrated = useRef(false);
  const [view, setView] = useState<MainView>(initialMainView); const [more, setMore] = useState<MoreView>("overview"); const [quickActionsOpen, setQuickActionsOpen] = useState(false); const [modal, setModal] = useState<"quick" | "transaction" | "receipt" | "debt" | "saving" | "debt-payment" | null>(null); const [editTx, setEditTx] = useState<Transaction>(); const [editGoal, setEditGoal] = useState<Debt | SavingsGoal>(); const [receiptStorageNotice, setReceiptStorageNotice] = useState(""); const legacyReceiptMigrationStarted = useRef(false); const [themePickerOpen, setThemePickerOpen] = useState(false); const [theme, setTheme] = useState<ThemeId>(() => { const saved = window.localStorage.getItem("buget-familie:theme"); return saved === "dark" ? "forest" : themeOptions.some((item) => item.id === saved) ? saved as ThemeId : "ivory"; }); const [themeSchedule, setThemeSchedule] = useState<ThemeSchedule>(() => window.localStorage.getItem("buget-familie:theme-schedule") === "auto" ? "auto" : "manual"); const [background, setBackground] = useState<BackgroundId>(() => { const saved = window.localStorage.getItem("buget-familie:background"); return backgroundOptions.some((item) => item.id === saved) ? saved as BackgroundId : "plain"; }); const previousBackgroundRef = useRef<BackgroundId>(background); const backgroundTransitionReady = useRef(false); const [highContrast, setHighContrast] = useState(() => window.localStorage.getItem("buget-familie:high-contrast") === "true"); const [scheduleTimes, setScheduleTimes] = useState<ThemeScheduleTimes>(() => { try { const saved = JSON.parse(window.localStorage.getItem("buget-familie:theme-schedule-times") || "null") as Partial<ThemeScheduleTimes> | null; return { dayStart: typeof saved?.dayStart === "string" ? saved.dayStart : defaultScheduleTimes.dayStart, eveningStart: typeof saved?.eveningStart === "string" ? saved.eveningStart : defaultScheduleTimes.eveningStart, nightStart: typeof saved?.nightStart === "string" ? saved.nightStart : defaultScheduleTimes.nightStart }; } catch { return defaultScheduleTimes; } }); const activeTheme = themeSchedule === "auto" ? automaticTheme(currentLocalMinutes(), scheduleTimes) : theme; const previousThemeRef = useRef<ThemeId>(activeTheme); const themeTransitionReady = useRef(false);

  useEffect(() => { let active = true; void readAppData().then((stored) => { if (!active || !stored) return; setData(normalizeAppData(stored)); }).catch(() => setStorageNotice("Stocarea modernă nu este disponibilă; folosim fallback-ul local al browserului.")).finally(() => { storageHydrated.current = true; setStorageReady(true); }); return () => { active = false; }; }, []);
  useEffect(() => { if (!storageHydrated.current) return; const serialized = syncPortable(data); try { window.localStorage.setItem(APP_STORAGE_KEY, serialized); } catch { setStorageNotice("Spațiul local este aproape plin. Fotografiile bonurilor rămân în stocarea dedicată; exportă un backup dacă problema continuă."); } const timer = window.setTimeout(() => { void writeAppData(data).catch(() => setStorageNotice("Datele sunt păstrate în fallback-ul browserului; stocarea modernă nu a confirmat salvarea.")); }, 280); return () => window.clearTimeout(timer); }, [data]); useEffect(() => { setData((current) => autoPostDueRecurring(current)); }, []);
  useEffect(() => {
    if (!storageReady) return;
    const win = window as Window & { requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number; cancelIdleCallback?: (id: number) => void };
    const run = () => { void scheduleFinancialReminders(data); };
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(run, { timeout: 4000 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 1200);
    return () => window.clearTimeout(id);
  }, [data, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    // Preîncărcăm navigarea după primul paint, ca primul tap pe un meniu să nu afișeze fallback-ul Suspense.
    const warm = () => {
      void Promise.all([
        import("@/components/PlanStudio"),
        loadSecondary(),
      ]);
    };
    const id = window.setTimeout(warm, 250);
    return () => window.clearTimeout(id);
  }, [storageReady]); useEffect(() => { if (legacyReceiptMigrationStarted.current || !data.receipts.some((receipt) => (receipt.imageData || receipt.imageData2) && !receipt.imageKeys?.length)) return; legacyReceiptMigrationStarted.current = true; void migrateLegacyReceiptImages(data.receipts).then((migrated) => { if (!migrated.size) return; setData((current) => ({ ...current, receipts: current.receipts.map((receipt) => { const imageKeys = migrated.get(receipt.id); return imageKeys ? { ...receipt, imageKeys, imageData: undefined, imageData2: undefined } : receipt; }) })); setReceiptStorageNotice(`${migrated.size} bon${migrated.size === 1 ? " a fost mutat" : "uri au fost mutate"} în stocarea locală a telefonului.`); }).catch((reason) => setReceiptStorageNotice(reason instanceof Error ? reason.message : "Nu am putut muta fotografiile vechi ale bonurilor; acestea nu au fost șterse.")); }, [data.receipts]); useEffect(() => { const root = document.documentElement; const previous = previousThemeRef.current; root.classList.remove(...themeOptions.map((item) => `theme-${item.id}`)); root.classList.add(`theme-${activeTheme}`); root.classList.toggle("dark", !LIGHT_THEMES.includes(activeTheme)); if (themeTransitionReady.current && previous !== activeTheme) { root.classList.remove("theme-transitioning"); root.classList.add("theme-transitioning"); const timer = window.setTimeout(() => root.classList.remove("theme-transitioning"), 420); previousThemeRef.current = activeTheme; return () => window.clearTimeout(timer); } themeTransitionReady.current = true; previousThemeRef.current = activeTheme; }, [activeTheme]); useEffect(() => { window.localStorage.setItem("buget-familie:theme", theme); }, [theme]); useEffect(() => { window.localStorage.setItem("buget-familie:theme-schedule", themeSchedule); }, [themeSchedule]); useEffect(() => { window.localStorage.setItem("buget-familie:theme-schedule-times", JSON.stringify(scheduleTimes)); }, [scheduleTimes]); useEffect(() => { const root = document.documentElement; const previous = previousBackgroundRef.current; if (backgroundTransitionReady.current && previous !== background) { root.classList.remove("background-transitioning", "background-from-plain", "background-from-paper", "background-from-grid", "background-from-aurora", "background-from-dots"); root.classList.add("background-transitioning", `background-from-${previous}`); const timer = window.setTimeout(() => root.classList.remove("background-transitioning", `background-from-${previous}`), 520); previousBackgroundRef.current = background; return () => window.clearTimeout(timer); } backgroundTransitionReady.current = true; previousBackgroundRef.current = background; }, [background]); useEffect(() => { document.documentElement.classList.remove("background-plain", "background-paper", "background-grid", "background-aurora", "background-dots"); document.documentElement.classList.add(`background-${background}`); window.localStorage.setItem("buget-familie:background", background); }, [background]); useEffect(() => { document.documentElement.classList.toggle("bf-high-contrast", highContrast); window.localStorage.setItem("buget-familie:high-contrast", String(highContrast)); }, [highContrast]); useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [view, more]); useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setQuickActionsOpen((open) => !open); } if (event.key === "Escape") setQuickActionsOpen(false); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []); useEffect(() => { const replay = () => setOnboardingOpen(true); const replaySetup = () => setSetupOpen(true); window.addEventListener("buget-familie:replay-onboarding", replay); window.addEventListener("buget-familie:replay-setup", replaySetup); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0) || Boolean(data.settings.salaryPlan.nextPayday); if (hasStarted && !window.localStorage.getItem("buget-familie:setup-complete")) window.localStorage.setItem("buget-familie:setup-complete", "true"); if (storageReady && !window.localStorage.getItem("buget-familie:onboarding-complete") && !hasStarted) setOnboardingOpen(true); if (storageReady && window.localStorage.getItem("buget-familie:onboarding-complete") && !window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted) setSetupOpen(true); return () => { window.removeEventListener("buget-familie:replay-onboarding", replay); window.removeEventListener("buget-familie:replay-setup", replaySetup); }; }, [storageReady, data.transactions.length, data.settings.salaryPlan.allocations.length, data.debts.length, data.savings.length, data.settings.paymentSources, data.settings.salaryPlan.nextPayday]);
  const update = (fn: (current: AppData) => AppData) => setData((current) => fn(current));
  const go = (next: MainView) => { preloadView(next); startTransition(() => setView(next)); };
  useEffect(() => {
    const skip = document.querySelector(".bf-skip-link");
    if (skip instanceof HTMLElement && skip === document.activeElement) skip.blur();
  }, []);

  const [syncPassword, setSyncPassword] = useState(""); const [syncNotice, setSyncNotice] = useState(""); const [syncBusy, setSyncBusy] = useState(false); const [syncConnected, setSyncConnected] = useState(false); const [syncLastSync, setSyncLastSync] = useState(""); const [syncJournal, setSyncJournal] = useState<SyncJournalEntry[]>(readSyncJournal);
  const syncDataRef = useRef(data); syncDataRef.current = data; const syncPasswordRef = useRef(syncPassword); syncPasswordRef.current = syncPassword; const syncRoomIdRef = useRef<string | undefined>(undefined); const syncUnsubscribeRef = useRef<(() => void) | undefined>(undefined); const syncLastPortableRef = useRef(""); const syncPushTimerRef = useRef<number | undefined>(undefined);
  const syncAppendJournal = (entry: Omit<SyncJournalEntry, "id">) => setSyncJournal((current) => { const next = [{ ...entry, id: newId("sync-log") }, ...current].slice(0, 40); writeSyncJournal(next); return next; });
  const syncPortable = (value: AppData) => JSON.stringify({ ...value, receipts: value.receipts.map(({ imageData: _one, imageData2: _two, imageKeys: _keys, ...rest }) => rest) });
  const syncRetainLocalReceiptImages = (value: AppData): AppData => ({ ...value, receipts: value.receipts.map((receipt) => { const local = syncDataRef.current.receipts.find((item) => item.id === receipt.id); return { ...receipt, imageData: local?.imageData, imageData2: local?.imageData2, imageKeys: local?.imageKeys }; }) });
  const syncDisconnect = () => { syncUnsubscribeRef.current?.(); syncUnsubscribeRef.current = undefined; syncRoomIdRef.current = undefined; window.clearTimeout(syncPushTimerRef.current); setSyncConnected(false); setSyncPassword(""); setSyncNotice("Sesiunea a fost închisă pe acest telefon."); };
  const syncHandleRemoteEnvelope = async (envelope: EncryptedEnvelope) => {
    try {
      const crypto = await loadFamilyCrypto();
      const remoteData = normalizeAppData(await crypto.decryptFamilyData(envelope, syncPasswordRef.current));
      const merged = syncRetainLocalReceiptImages(crypto.mergeFamilyData(syncDataRef.current, remoteData));
      const mergedPortable = syncPortable(merged);
      if (mergedPortable === syncPortable(syncDataRef.current)) { setSyncLastSync(new Date().toISOString()); return; }
      syncLastPortableRef.current = mergedPortable; setData(merged); setSyncLastSync(new Date().toISOString());
      syncAppendJournal({ createdAt: new Date().toISOString(), status: "resolved", message: "Actualizare primită de la un alt telefon conectat.", action: "Datele au fost reunite automat prin ID și marcaj de actualizare." });
    } catch (error) {
      syncAppendJournal({ createdAt: new Date().toISOString(), status: "failed", message: error instanceof Error ? error.message : "Pachetul primit nu a putut fi decriptat.", action: "Verifică să fie exact aceeași parolă pe toate telefoanele." });
      setSyncNotice(error instanceof Error ? error.message : "Un pachet primit nu a putut fi decriptat.");
    }
  };
  const syncConnect = async () => {
    if (syncPassword.length < 12) { setSyncNotice("Introdu parola de familie, de cel puțin 12 caractere."); return; }
    setSyncBusy(true);
    try {
      const crypto = await loadFamilyCrypto();
      const roomId = await crypto.deriveFamilyRoomId(syncPassword);
      const syncApi = await loadFamilySync();
      const remoteEnvelope = await syncApi.fetchFamilyEnvelope(roomId);
      let merged = syncDataRef.current;
      if (remoteEnvelope) { const remoteData = normalizeAppData(await crypto.decryptFamilyData(remoteEnvelope, syncPassword)); merged = syncRetainLocalReceiptImages(crypto.mergeFamilyData(syncDataRef.current, remoteData)); }
      const mergedPortable = syncPortable(merged);
      syncLastPortableRef.current = mergedPortable;
      if (mergedPortable !== syncPortable(syncDataRef.current)) setData(merged);
      const envelope = await crypto.encryptFamilyData(merged, syncPassword);
      await syncApi.pushFamilyEnvelope(roomId, envelope);
      syncRoomIdRef.current = roomId;
      syncUnsubscribeRef.current = syncApi.subscribeFamilyRoom(roomId, (incoming) => void syncHandleRemoteEnvelope(incoming), (error) => setSyncNotice(error.message));
      setSyncConnected(true); setSyncLastSync(new Date().toISOString());
      setSyncNotice("Sesiunea familiei este activă. Actualizările apar automat pe toate telefoanele conectate, fără reîmprospătare manuală.");
    } catch (error) {
      setSyncNotice(error instanceof Error ? error.message : "Familia nu a putut fi conectată.");
    } finally { setSyncBusy(false); }
  };
  useEffect(() => { if (!syncConnected || !syncRoomIdRef.current) return; const currentPortable = syncPortable(data); if (currentPortable === syncLastPortableRef.current) return; window.clearTimeout(syncPushTimerRef.current); syncPushTimerRef.current = window.setTimeout(() => { void (async () => { try { const { encryptFamilyData } = await loadFamilyCrypto();
          const envelope = await encryptFamilyData(data, syncPasswordRef.current); const { pushFamilyEnvelope } = await loadFamilySync();
          await pushFamilyEnvelope(syncRoomIdRef.current!, envelope); syncLastPortableRef.current = currentPortable; setSyncLastSync(new Date().toISOString()); } catch (error) { setSyncNotice(error instanceof Error ? error.message : "Actualizarea nu a putut fi trimisă."); } })(); }, 800); return () => window.clearTimeout(syncPushTimerRef.current); }, [data, syncConnected]);
  useEffect(() => () => syncUnsubscribeRef.current?.(), []);
  const syncPanelProps: SyncPanelProps = { connected: syncConnected, busy: syncBusy, password: syncPassword, setPassword: setSyncPassword, notice: syncNotice, lastSync: syncLastSync, journal: syncJournal, onConnect: () => void syncConnect(), onDisconnect: syncDisconnect, onClearJournal: () => { setSyncJournal([]); writeSyncJournal([]); } };
  useEffect(() => { const applySettings = (event: Event) => { const patch = (event as CustomEvent<Partial<AppData["settings"]>>).detail; if (!patch) return; setData((current) => ({ ...current, settings: { ...current.settings, ...patch } })); }; window.addEventListener("buget-familie:local-settings", applySettings); return () => window.removeEventListener("buget-familie:local-settings", applySettings); }, []);
  useEffect(() => { const openTheme = () => setThemePickerOpen(true); window.addEventListener("buget-familie:open-theme", openTheme); return () => window.removeEventListener("buget-familie:open-theme", openTheme); }, []);
  const saveTx = (item: Transaction) => update((current) => { const stamped = { ...item, updatedAt: new Date().toISOString() }; return { ...current, transactions: current.transactions.some((entry) => entry.id === item.id) ? current.transactions.map((entry) => entry.id === item.id ? stamped : entry) : [stamped, ...current.transactions] }; });
  const applyFinancialUpdate = (change: FinancialUpdate) => update((current) => { const member = current.settings.members.find((item) => "memberId" in change && change.memberId && item.id === change.memberId) || current.settings.members[0]; const source = current.settings.paymentSources.find((item) => item.memberId && member && item.memberId === member.id) || current.settings.paymentSources[0]; const now = new Date().toISOString(); if (change.kind === "income" && member && source) { if (current.transactions.some((item) => item.kind === "income" && item.amount === change.amount && item.title === change.title && item.date === (change.date || isoToday()))) return current; const transaction: Transaction = { id: newId("guided-income"), title: change.title, amount: change.amount, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: change.date || isoToday(), note: "Venit adăugat împreună cu ghidul AI", createdAt: now }; return { ...current, transactions: [transaction, ...current.transactions], settings: { ...current.settings, salaryPlan: { ...current.settings.salaryPlan, totalLimit: Math.max(0, (current.settings.salaryPlan.totalLimit || 0) + change.amount), updatedAt: now } } }; } if (change.kind === "debt") { const key = change.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const existingIndex = current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key); const nextDebt: Debt = { id: existingIndex >= 0 ? current.debts[existingIndex].id : newId("guided-debt"), name: change.name, remaining: change.remaining, monthly: existingIndex >= 0 ? current.debts[existingIndex].monthly : 0, due: change.due || (existingIndex >= 0 ? current.debts[existingIndex].due : "Nespecificat"), memberId: member?.id, tone: existingIndex >= 0 ? current.debts[existingIndex].tone : "coral", updatedAt: now }; const debts = existingIndex >= 0 ? current.debts.map((item, index) => index === existingIndex ? nextDebt : item) : [nextDebt, ...current.debts]; return { ...current, debts }; } if (change.kind === "debt-monthly") { const key = change.name?.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const index = key ? current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key) : 0; if (index < 0) return current; return { ...current, debts: current.debts.map((item, itemIndex) => itemIndex === index ? { ...item, monthly: change.amount, updatedAt: now } : item) }; } if (change.kind === "expense" && member && source) { const day = change.date || isoToday(); const usedSource = current.settings.paymentSources.find((item) => item.id === change.sourceId) || source; const usedMember = current.settings.members.find((item) => item.id === change.memberId) || member; const transaction: Transaction = { id: newId("guided-expense"), title: change.title, amount: change.amount, kind: "expense", category: change.category, sourceId: usedSource.id, source: usedSource.name, memberId: usedMember.id, person: usedMember.name, date: day, allocationId: change.allocationId || "outside", note: "Cheltuială adăugată împreună cu ghidul AI", createdAt: now }; return { ...current, transactions: [transaction, ...current.transactions] }; } if (change.kind === "transfer") return transferBetweenEnvelopes(current, { fromAllocationId: change.fromId, toAllocationId: change.toId, amount: change.amount, note: "Realocare din ghidul AI" }) || current; if (change.kind !== "allocation") return current; const labels: Record<string, string> = { Alimente: "Alimente", Facturi: "Casă & facturi", Transport: "Transport", Economii: "Economii", Datorii: "Rate produse" }; const label = labels[change.category] || change.category; const existing = current.settings.salaryPlan.allocations.find((item) => item.label === label || item.category === label); const weeklyPace = change.weekly ? undefined : false; const nextAllocation = existing ? { ...existing, amount: change.amount, weeklyPace, category: label, updatedAt: now } : { id: newId("guided-allocation"), label, category: label, amount: change.amount, weeklyPace, memberId: member?.id, sourceId: source?.id }; const allocations = existing ? current.settings.salaryPlan.allocations.map((item) => item.id === existing.id ? nextAllocation : item) : [...current.settings.salaryPlan.allocations, nextAllocation]; const plan = current.settings.salaryPlan; const start = plan.periodStart || isoToday(); const weeks = change.weeks && change.weeks >= 2 ? change.weeks : 4; const fallbackPayday = new Date(`${start}T12:00:00`); fallbackPayday.setDate(fallbackPayday.getDate() + weeks * 7 - 1); const spokenPayday = "payday" in change && change.payday && change.payday >= start ? change.payday : undefined; const nextPayday = spokenPayday || plan.nextPayday || fallbackPayday.toISOString().slice(0, 10); const flex = spokenPayday ? (plan.paydayFlexDays ?? 3) : (plan.paydayFlexDays ?? 3); const earliest = new Date(`${nextPayday}T12:00:00`); earliest.setDate(earliest.getDate() - flex); const earliestPayday = earliest.toISOString().slice(0, 10) < start ? start : earliest.toISOString().slice(0, 10); const weeklyLimit = change.weeklyAmount || plan.weeklyLimit || (change.weekly ? Math.round((change.amount / weeks) * 100) / 100 : plan.weeklyLimit); return { ...current, settings: { ...current.settings, salaryPlan: { ...plan, periodStart: start, nextPayday, earliestPayday, paydayFlexDays: flex, weeklyLimit, sourceIds: plan.sourceIds.length ? plan.sourceIds : source ? [source.id] : plan.sourceIds, allocations, updatedAt: now } } }; });
  const revertGuided = (item: GuidedRevert) => update((current) => {
    const index = current.transactions.findIndex((entry) => entry.kind === item.kind && entry.title === item.title && entry.amount === item.amount && entry.date === item.date && (entry.note || "").includes("ghidul AI"));
    if (index < 0) return current;
    const removed = current.transactions[index];
    const now = new Date().toISOString();
    const totalLimit = item.kind === "income" ? Math.max(0, (current.settings.salaryPlan.totalLimit || 0) - item.amount) : current.settings.salaryPlan.totalLimit;
    return {
      ...current,
      transactions: current.transactions.filter((_, position) => position !== index),
      deleted: [...current.deleted, { entity: "transactions" as const, id: removed.id, deletedAt: now }].slice(-500),
      settings: item.kind === "income" ? { ...current.settings, salaryPlan: { ...current.settings.salaryPlan, totalLimit, updatedAt: now } } : current.settings,
    };
  });
  const openNaturalDraft = (draft: NaturalDraft) => { const member = data.settings.members[0]; const source = data.settings.paymentSources[0]; if (!member || !source) { openTx(); return; } openTx({ id: newId("natural-draft"), title: draft.title, amount: draft.amount, kind: draft.kind, category: draft.category, source: source.name, sourceId: source.id, person: member.name, memberId: member.id, date: draft.date || isoToday(), note: draft.note }); };
  const saveQuickTemplate = (item: AppData["settings"]["quickTemplates"][number]) => update((current) => ({ ...current, settings: { ...current.settings, quickTemplates: [item, ...current.settings.quickTemplates.filter((entry) => entry.id !== item.id && entry.label.toLocaleLowerCase("ro-RO") !== item.label.toLocaleLowerCase("ro-RO"))].slice(0, 12) } }));
  const deleteQuickTemplate = (id: string) => update((current) => ({ ...current, settings: { ...current.settings, quickTemplates: current.settings.quickTemplates.filter((item) => item.id !== id) } }));
  const archiveQuickTemplate = (id: string) => update((current) => { const template = current.settings.quickTemplates.find((item) => item.id === id); if (!template) return current; const archivedAt = new Date().toISOString(); return { ...current, settings: { ...current.settings, quickTemplates: current.settings.quickTemplates.filter((item) => item.id !== id), archivedQuickTemplates: [{ ...template, archivedAt }, ...current.settings.archivedQuickTemplates.filter((item) => item.id !== id)].slice(0, 60) } }; });
  const restoreQuickTemplate = (id: string) => update((current) => { const template = current.settings.archivedQuickTemplates.find((item) => item.id === id); if (!template) return current; const { archivedAt: _archivedAt, ...restored } = template; return { ...current, settings: { ...current.settings, quickTemplates: [{ ...restored, updatedAt: new Date().toISOString() }, ...current.settings.quickTemplates.filter((item) => item.id !== id && item.label.toLocaleLowerCase("ro-RO") !== restored.label.toLocaleLowerCase("ro-RO"))].slice(0, 12), archivedQuickTemplates: current.settings.archivedQuickTemplates.filter((item) => item.id !== id) } }; });
  const deleteArchivedQuickTemplate = (id: string) => update((current) => ({ ...current, settings: { ...current.settings, archivedQuickTemplates: current.settings.archivedQuickTemplates.filter((item) => item.id !== id) } }));
  const saveDebt = (item: Debt | SavingsGoal) => update((current) => { const stamped = { ...item, updatedAt: new Date().toISOString() } as Debt; return { ...current, debts: current.debts.some((entry) => entry.id === item.id) ? current.debts.map((entry) => entry.id === item.id ? stamped : entry) : [...current.debts, stamped] }; });
  const saveSaving = (item: Debt | SavingsGoal) => update((current) => { const stamped = { ...item, updatedAt: new Date().toISOString() } as SavingsGoal; return { ...current, savings: current.savings.some((entry) => entry.id === item.id) ? current.savings.map((entry) => entry.id === item.id ? stamped : entry) : [...current.savings, stamped] }; });
  const saveReceipt = (item: Receipt) => update((current) => { const member = current.settings.members.find((entry) => entry.id === item.memberId) || current.settings.members[0]; const source = current.settings.paymentSources.find((entry) => entry.id === item.sourceId) || current.settings.paymentSources[0]; const lines = item.lines?.length ? item.lines : [{ id: "whole", category: item.category, amount: item.amount }]; const transactionIds = lines.map((line) => `receipt-tx-${item.id}-${line.id}`); const receipt = { ...item, linkedTransactionId: transactionIds[0], linkedTransactionIds: transactionIds }; const transactions: Transaction[] = lines.map((line, index) => ({ id: transactionIds[index], receiptId: item.id, title: `Bon — ${item.vendor}${line.label ? ` · ${line.label}` : ""}`, amount: line.amount, kind: "expense", category: line.category, sourceId: source?.id, source: source?.name || "Bon", memberId: member?.id, person: member?.name || current.settings.memberName, date: item.date, note: item.note, createdAt: new Date().toISOString() })); const formerIds = current.receipts.find((entry) => entry.id === item.id)?.linkedTransactionIds || [item.linkedTransactionId, `receipt-tx-${item.id}`].filter((value): value is string => Boolean(value)); return { ...current, receipts: [receipt, ...current.receipts.filter((entry) => entry.id !== item.id)], transactions: [...transactions, ...current.transactions.filter((entry) => !formerIds.includes(entry.id) && entry.receiptId !== item.id)] }; });
  const deleteReceipt = (id: string) => { const receipt = data.receipts.find((item) => item.id === id); void removeReceiptImages(receipt?.imageKeys).catch(() => setReceiptStorageNotice("Bonul a fost șters din registru, dar telefonul nu a confirmat încă ștergerea fotografiei locale.")); update((current) => { const currentReceipt = current.receipts.find((item) => item.id === id); const linked = currentReceipt?.linkedTransactionIds || [currentReceipt?.linkedTransactionId, `receipt-tx-${id}`].filter((value): value is string => Boolean(value)); const now = new Date().toISOString(); return { ...current, receipts: current.receipts.filter((item) => item.id !== id), transactions: current.transactions.filter((item) => !linked.includes(item.id) && item.receiptId !== id), deleted: [...current.deleted, { entity: "receipts" as const, id, deletedAt: now }, ...linked.map((transactionId) => ({ entity: "transactions" as const, id: transactionId, deletedAt: now }))].slice(-500) }; }); };
  const openTx = (item?: Transaction) => { setEditTx(item); setModal(item ? "transaction" : "quick"); };
  const nav = [{ id: "today" as MainView, label: "Astăzi", icon: LayoutGrid }, { id: "journal" as MainView, label: "Mișcări", icon: ListFilter }, { id: "plan" as MainView, label: "Plan", icon: PlayCircle }, { id: "obligations" as MainView, label: "Obligații", icon: Bell }, { id: "insights" as MainView, label: "Analiză", icon: BarChart3 }];
  const current = () => { if (view === "journal") return <MovementsJournal data={data} onAdd={() => openTx()} onEdit={openTx} onDelete={(id) => update((currentData) => ({ ...currentData, transactions: currentData.transactions.filter((item) => item.id !== id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId !== id), deleted: [...currentData.deleted, { entity: "transactions" as const, id, deletedAt: new Date().toISOString() }].slice(-500) }))} />; if (view === "plan")
 return <Suspense fallback={<div className="bf-lazy-panel">Pregătim planul…</div>}><PlanStudio data={data} onChange={setData} /></Suspense>; if (view === "habits") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim obiceiurile…</div>}><SpendingHabitsView data={data} /></Suspense>; if (view === "calendar") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim calendarul…</div>}><FinancialCalendarView data={data} /></Suspense>; if (view === "goals") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim obiectivele…</div>}><LongTermGoalsView data={data} onOpen={() => { setEditGoal(undefined); setModal("saving"); }} onEdit={(item) => { setEditGoal(item); setModal("saving"); }} onDelete={(id) => window.confirm("Ștergi acest obiectiv de economisire?") && update((currentData) => ({ ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) }))} /></Suspense>; if (view === "obligations") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim obligațiile…</div>}><ObjectivesView data={data} onEditDebt={(item) => { setEditGoal(item); setModal("debt"); }} onEditSaving={(item) => { setEditGoal(item); setModal("saving"); }} onPayDebt={(item) => { setEditGoal(item); setModal("debt-payment"); }} onDeleteDebt={(id) => window.confirm("Ștergi această datorie? Acțiunea poate fi sincronizată și pe celelalte dispozitive.") && update((currentData) => ({ ...currentData, debts: currentData.debts.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "debts" as const, id, deletedAt: new Date().toISOString() }].slice(-500) }))} onDeleteSaving={(id) => window.confirm("Ștergi acest obiectiv de economisire? Acțiunea poate fi sincronizată și pe celelalte dispozitive.") && update((currentData) => ({ ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) }))} openDebt={() => { setEditGoal(undefined); setModal("debt"); }} openSaving={() => { setEditGoal(undefined); setModal("saving"); }} onOpenGoals={() => go("goals")} onOpenCalendar={() => go("calendar")} onOpenAssistant={() => { setMore("assistant"); go("utilities"); }} onOpenRecurring={() => { setMore("recurring"); go("utilities"); }} onPayRecurring={(id) => update((currentData) => confirmRecurringPayment(currentData, id) || currentData)} /></Suspense>; if (view === "insights") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim analiza…</div>}><InsightsView data={data} onChange={setData} onGo={go} /></Suspense>; if (view === "utilities") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim instrumentele…</div>}><MoreViewScreen tab={more} setTab={setMore} data={data} onChange={setData} onAddReceipt={() => setModal("receipt")} onDeleteReceipt={deleteReceipt} onOpenDebt={() => { setEditGoal(undefined); setModal("debt"); }} onOpenSaving={() => { setEditGoal(undefined); setModal("saving"); }} onOpenCalendar={() => go("calendar")} receiptStorageNotice={receiptStorageNotice} sync={syncPanelProps} /></Suspense>; return <TodayView data={data} onAdd={() => openTx()} onGo={go} onChange={setData} />; };
  return <div className="bf-app">
    <a className="bf-skip-link" href="#main-content">Sari la conținut</a>
    {storageNotice && <div className="bf-storage-notice" role="status"><ShieldCheck size={15} /><span>{storageNotice}</span><button type="button" aria-label="Închide notificarea" onClick={() => setStorageNotice(null)}><X size={14} /></button></div>}
    <header className="bf-appbar os-appbar"><button className="os-brand" onClick={() => go("today")}><BrandMark /><span className="os-brand-copy"><b>Buget</b><i>Familie</i></span></button><nav className="os-desktop-nav" aria-label="Navigație principală">{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerEnter={() => preloadView(item.id)} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={17} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav><div className="os-tools"><button className="os-tool" aria-label="Deschide acțiunile rapide" title="Acțiuni rapide · Ctrl K" onPointerDown={() => void loadSecondary()} onClick={() => setQuickActionsOpen(true)}><Search size={17} /></button><button className={view === "utilities" ? "os-tool is-on" : "os-tool"} aria-label="Deschide instrumentele" onPointerDown={() => preloadView("utilities")} onClick={() => go("utilities")}><MoreHorizontal size={19} /></button><button className="os-tool" aria-label="Deschide ghidul" onClick={openHouseholdGuide}><MessagesSquare size={17} /></button></div></header>
    <main id="main-content" key={view} className="bf-screen-transition">{current()}</main>
    <nav className="os-dock" aria-label="Navigație mobilă">{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={16} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav>
    <AICompanion data={data} view={view} onAdd={() => openTx()} onGo={go} onNaturalEntry={openNaturalDraft} onFinancialUpdate={applyFinancialUpdate} onRevert={revertGuided} />
    {themePickerOpen && <Suspense fallback={null}><ThemePicker theme={theme} schedule={themeSchedule} scheduleTimes={scheduleTimes} highContrast={highContrast} background={background} onChange={setTheme} onScheduleChange={setThemeSchedule} onScheduleTimesChange={setScheduleTimes} onContrastChange={setHighContrast} onBackgroundChange={setBackground} onClose={() => setThemePickerOpen(false)} /></Suspense>} {quickActionsOpen && <Suspense fallback={null}><QuickActionsPalette onClose={() => setQuickActionsOpen(false)} onAdd={() => openTx()} onGo={go} /></Suspense>} {onboardingOpen && <Suspense fallback={null}><CalmOnboarding onClose={() => { setOnboardingOpen(false); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0); if (!window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted) setSetupOpen(true); }} onAdd={() => openTx()} onGo={go} /></Suspense>} {setupOpen && <AIFinancialSetup data={data} onChange={setData} onClose={() => setSetupOpen(false)} onGoPlan={() => go("plan")} onAdd={() => openTx()} />}
    {modal === "quick" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">Pregătim înregistrarea rapidă…</div></div>}><QuickEntryPanel data={data} onSave={saveTx} onSaveTemplate={saveQuickTemplate} onDeleteTemplate={deleteQuickTemplate} onArchiveTemplate={archiveQuickTemplate} onRestoreTemplate={restoreQuickTemplate} onDeleteArchivedTemplate={deleteArchivedQuickTemplate} onClose={() => setModal(null)} onMore={() => { setEditTx(undefined); setModal("transaction"); }} /></Suspense>}
    {modal === "transaction" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">Pregătim mișcarea…</div></div>}><TransactionForm data={data} initial={editTx} onSave={saveTx} onClose={() => { setModal(null); setEditTx(undefined); }} /></Suspense>}
    {modal === "receipt" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">Pregătim bonul…</div></div>}><ReceiptForm data={data} onSave={saveReceipt} onClose={() => setModal(null)} /></Suspense>}
    {modal === "debt" && <Suspense fallback={null}><GoalForm data={data} type="debt" item={editGoal} onSave={saveDebt} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "saving" && <Suspense fallback={null}><GoalForm data={data} type="saving" item={editGoal} onSave={saveSaving} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "debt-payment" && editGoal && "remaining" in editGoal && <Suspense fallback={null}><DebtPaymentForm data={data} debt={editGoal} onSave={setData} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
  </div>;
}
