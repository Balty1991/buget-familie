/**
 * Atelierul Financiar — tablou mobil pentru o persoană sau o gospodărie, cu decizia următoare în prim-plan.
 * First paint: doar Astăzi. Restul ecranelor, sync-ul și formularele se încarcă la cerere.
 */
import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, RotateCcw, BellRing, CalendarClock, CreditCard, Goal, Info, LayoutDashboard, LayoutGrid, ListFilter, MessagesSquare, MoreHorizontal, PlayCircle, Plus, ReceiptText, Search, ShieldCheck, Ticket, Wallet, WalletCards, X, ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { allocationStatus, allocationWeekStatus, autoPostDueRecurring, confirmRecurringPayment, createEmptyAppData, addIsoDays, financialBalance, formatDate, inPlanPeriod, isoDate, isoToday, newId, normalizeAppData, pendingRecurringInPlan, planEndDate, planForecast, sourceBalance, transferBetweenEnvelopes, type AppData, type Debt, type Receipt, type SavingsGoal, type Transaction } from "@/lib/finance-data";
import { calendarBudgetWeekKey, currentCalendarBudgetWeek } from "@/lib/calendar-budget";
import { buildUndo, type UndoAction } from "@/lib/undo-delete";
import { checkFamilyPassword } from "@/lib/family-password";
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
import { notifyFamilyEnvelopeChanges, scheduleFinancialReminders } from "@/lib/local-notifications";
import { observeQuickActions } from "@/lib/quick-action-bridge";
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
import { getLocale, t } from "@/lib/i18n";
import { useLanguage } from "@/hooks/use-language";

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
    signals.push({ id: "plan-needed", tone: "watch", eyebrow: t("URMĂTORUL PAS"), title: t("Alege următorul venit"), detail: t("Planul are nevoie de o dată de salariu pentru a calcula ritmul sigur de cheltuire."), action: "plan", actionLabel: t("Configurează planul") });
  } else if (math.remaining < 0) {
    signals.push({ id: "over-plan", tone: "risk", eyebrow: t("ATENȚIE"), title: t("Planul este peste limită cu {amount}", { amount: money(Math.abs(math.remaining)) }), detail: `Sunt incluse ${money(math.periodExpenses)} cheltuieli și ${money(math.scheduled)} rezervate până la ${dateText(math.planEnd || math.plan.nextPayday)}.`, action: "plan", actionLabel: t("Revizuiește planul") });
  } else if (forecast.spentToDate > 0 && forecast.projectedRemaining < 0) {
    signals.push({ id: "pace-risk", tone: "risk", eyebrow: "RITM DE REVIZUIT", title: `La ritmul actual lipsesc ${money(Math.abs(forecast.projectedRemaining))}`, detail: `Cheltuielile sunt în medie ${money(forecast.paceDaily)} pe zi; ritmul sigur este ${money(forecast.safeDaily)} pe zi până la venit.`, action: "plan", actionLabel: t("Ajustează planul") });
  } else {
    const daily = math.remaining / Math.max(1, math.days);
    signals.push({ id: "daily-pace", tone: "good", eyebrow: "RITM SIGUR", title: `${money(daily)} pe zi până la venit`, detail: `${money(math.remaining)} rămân după cheltuielile înregistrate și rezervele deja planificate.`, action: "plan", actionLabel: t("Vezi calculele") });
  }
  if (pending[0]) {
    signals.push({ id: "next-recurring", tone: "watch", eyebrow: t("SCADENȚĂ REZERVATĂ"), title: `${pending[0].name} · ${money(pending[0].amount)}`, detail: `Este programată pentru ${dateText(pending[0].dueDate, true)} și este deja exclusă din suma disponibilă.`, action: "recurring", actionLabel: t("Deschide scadențele") });
  }
  const allocation = data.settings.salaryPlan.allocations.map((item) => ({ item, ...allocationStatus(data, item) })).sort((a, b) => b.usage - a.usage)[0];
  if (allocation && allocation.state !== "healthy") {
    const over = allocation.state === "over";
    signals.push({ id: `allocation-${allocation.item.id}`, tone: over ? "risk" : "watch", eyebrow: over ? t("PLIC DEPĂȘIT") : t("APROAPE DE LIMITĂ"), title: `${allocation.item.label}: ${money(Math.max(0, allocation.remaining))} rămași`, detail: `${money(allocation.spent)} cheltuiți din limita ajustată de ${money(allocation.budget)} în perioada activă.`, action: "plan", actionLabel: t("Vezi plicul") });
  }
  const goal = data.savings.filter((item) => item.target > item.current).sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
  if (goal && signals.length < 3) signals.push({ id: `goal-${goal.id}`, tone: "good", eyebrow: "OBIECTIV COMUN", title: `${money(goal.target - goal.current)} până la ${goal.name}`, detail: `Progres actual: ${money(goal.current)} din ${money(goal.target)}.`, action: "objectives", actionLabel: t("Vezi obiectivul") });
  return signals.slice(0, 3);
}

/** Inițialele zilelor urmează limba activă, nu o listă fixă în română. */
const weekdayShort = () => Array.from({ length: 7 }, (_v, index) => new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 1 + index))).replace(".", ""));

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
function NextStepCard({ signal, onOpen }: { signal?: AdvisorSignal; onOpen: () => void }) {
  if (!signal) return null;
  const tone = signal.tone === "risk" ? "risk" : signal.tone === "watch" ? "watch" : "good";
  return <section className={"bf-next-step-card " + tone}><div className="bf-next-step-icon"><PlayCircle size={21} /></div><div className="bf-next-step-copy"><p className="bf-kicker">{t("RECOMANDAREA MEA PENTRU ACUM")}</p><h2>{signal.title}</h2><span>{signal.detail}</span></div><button type="button" onClick={onOpen}>{signal.actionLabel}<ChevronRight size={16} /></button></section>;
}
function TodayPulse({ data, onGo }: { data: AppData; onGo: (view: MainView) => void }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    const iso = isoDate(date);
    const amount = data.transactions.filter((item) => item.kind === "expense" && item.date === iso).reduce((sum, item) => sum + item.amount, 0);
    return { iso, label: date.toLocaleDateString(getLocale(), { weekday: "short" }).replace(".", ""), amount, today: index === 6 };
  });
  const max = Math.max(...days.map((day) => day.amount), 1);
  const weekTotal = days.reduce((sum, day) => sum + day.amount, 0);
  const average = weekTotal / 7;
  const categoryTotals = data.transactions.filter((item) => item.kind === "expense" && days.some((day) => day.iso === item.date)).reduce<Record<string, number>>((totals, item) => { totals[item.category] = (totals[item.category] || 0) + item.amount; return totals; }, {});
  const topCategories = Object.entries(categoryTotals).sort(([, left], [, right]) => right - left).slice(0, 3);
  return <section className="bf-modern-pulse"><div className="bf-modern-pulse-copy"><p className="bf-kicker">{t("PULSUL SĂPTĂMÂNII")}</p><h2>{t("Vezi ritmul banilor dintr-o privire.")}</h2><p>{weekTotal ? <>Ai cheltuit <b>{money(weekTotal)}</b> {t("în ultimele 7 zile, aproximativ")} <b>{money(average)}</b> pe zi.</> : t("Începe să înregistrezi mișcări pentru a vedea ritmul real al gospodăriei.")}</p><button type="button" onClick={() => onGo("journal")}>Deschide registrul <ChevronRight size={15} /></button>{topCategories.length > 0 && <div className="bf-modern-pulse-categories"><small>UNDE S-AU DUS BANII</small>{topCategories.map(([category, amount]) => <span key={category}><b>{category}</b><strong>{money(amount)}</strong><i><em style={{ width: Math.round((amount / weekTotal) * 100) + "%" }} /></i></span>)}</div>}</div><div className="bf-modern-pulse-chart" aria-label={t("Cheltuielile din ultimele 7 zile")}>{days.map((day) => <div key={day.iso} className={day.today ? "today" : ""}><span title={money(day.amount)}><i style={{ height: Math.max(8, Math.round((day.amount / max) * 100)) + "%" }} /></span><small>{day.label}</small></div>)}</div></section>;
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
    ? t("Nu sunt plicuri cu ritm săptămânal de împărțit pe zile.")
    : rhythm.remaining <= 0 && rhythm.todayLeft <= 0
      ? t("Plicul săptămânii e gol până duminică.")
      : rhythm.days.some((row) => row.isToday && row.over)
        ? t("Azi a trecut peste partea de {share}. Mai rămân {remaining}, cam {daily} pe zi până duminică.", { share: money(rhythm.todayShare), remaining: money(rhythm.remaining), daily: money(rhythm.futureShare) })
        : t("Mai rămân {remaining} în plicul săptămânii, cam {daily} pe zi până duminică.", { remaining: money(rhythm.remaining), daily: money(rhythm.todayShare) });

  const sourceRows = useMemo(
    () => data.settings.paymentSources.map((source) => ({ ...source, balance: sourceBalance(data, source.id) })),
    [data],
  );

  /**
   * Un registru încă gol nu are ce număra. Arăta totuși „0 RON” cu litere mari — cel
   * mai vizibil lucru de pe primul ecran era un zero fără înțeles, iar omul nu avea
   * de unde ști ce se așteaptă de la el. Îi arătăm în loc cei trei pași.
   */
  const fresh = !data.transactions.length
    && !data.settings.salaryPlan.allocations.length
    && !data.settings.paymentSources.some((item) => item.openingBalance > 0);

  const heroLabel = overPlan ? t("Peste limita planului") : data.settings.salaryPlan.allocations.length ? t("Rămas în plicuri") : monthIncome > 0 ? t("Venit înregistrat luna asta") : t("Plicuri neconfigurate");
  const heroValue = overPlan ? Math.abs(math.remaining) : data.settings.salaryPlan.allocations.length ? envelopeTotalRemaining : monthIncome;
  const heroHint = overPlan
    ? t("de acoperit prin limită, plicuri sau cheltuieli flexibile")
    : data.settings.salaryPlan.allocations.length
      ? t("{weekly} săptămânale · {monthly} lunare/fixe{benchmark}", { weekly: money(Math.max(0, weeklyEnvelopesRemaining)), monthly: money(Math.max(0, monthlyEnvelopesRemaining)), benchmark: math.plan.nextPayday ? t(" · reper {daily}/zi", { daily: money(daily) }) : "" })
      : monthIncome > 0
        ? t("Suma e în Mișcări. Pune plicuri în Plan ca să vezi cât mai rămâne pe categorii.")
        : t("Adaugă plicuri pentru a urmări cât mai rămâne în fiecare perioadă");
  const explainer = overPlan
    ? t("Planul este depășit: suma arată cât trebuie acoperit, nu bani disponibili pentru cheltuieli.")
    : data.settings.salaryPlan.allocations.length
      ? `Este ce mai poți folosi din plicurile alocate. Reperul zilnic împarte suma pe cele ${forecast.remainingDays} zile până la venit — nu e bani în plus, e ritmul ca să nu golești plicurile înainte.`
      : t("Plicurile sunt sume puse deoparte pentru un scop, cum ar fi mâncare, transport sau facturi.");

  return (
    <div className="bf-page bf-today-workspace">
      <section className={`os-hero ${overPlan ? "is-risk" : ""}`}>
        <div className="os-hero-top">
          <span className="os-chip"><i /> {overPlan ? t("Plan de revizuit") : t("Ritm urmărit")}</span>
          <div className="os-date">
            <b>{String(new Date(`${todayIso}T12:00:00`).getDate()).padStart(2, "0")}</b>
            <span>{new Date(`${todayIso}T12:00:00`).toLocaleDateString(getLocale(), { month: "long" }).toLocaleUpperCase("ro-RO")}</span>
            <span>{new Date(`${todayIso}T12:00:00`).getFullYear()}</span>
          </div>
        </div>
        {fresh ? (
          <div className="os-start">
            <p className="os-kicker-lg">{t("De unde începi")}</p>
            <h1 className="os-start-title">{t("Trei pași și cifrele devin ale tale.")}</h1>
            <ol className="os-start-steps">
              <li>
                <button type="button" onClick={onAdd}>
                  <span className="os-start-step-text">

                    <b>{t("Treci prima mișcare")}</b>

                    <small>{t("Un salariu încasat sau o cumpărătură de azi")}</small>

                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onGo("plan")}>
                  <span className="os-start-step-text">

                    <b>{t("Fă primul plic")}</b>

                    <small>{t("Alimente, transport, facturi — cât aloci pentru fiecare")}</small>

                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onGo("plan")}>
                  <span className="os-start-step-text">

                    <b>{t("Spune când vine salariul")}</b>

                    <small>{t("De aici se calculează cât poți cheltui pe zi")}</small>

                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            </ol>
          </div>
        ) : (
          <>
            <p className="os-kicker-lg">{heroLabel}</p>
            <h1 className="os-amount">
              <span>{Math.round(heroValue).toLocaleString("ro-RO")}</span>
              <small>RON</small>
            </h1>
            <p className="os-hint">{heroHint}</p>
          </>
        )}
        {!fresh && (
          <>
            <button type="button" className="os-explainer" onClick={() => setOpenHint((value) => !value)}>
              <Info size={16} aria-hidden="true" /> {t("Cum se citește suma?")} <span>{openHint ? "−" : "+"}</span>
            </button>
            {openHint ? <p className="os-explainer-body">{explainer}</p> : null}
          </>
        )}
        <div className="os-gauge">
          <HealthScoreBadge data={data} />
        </div>
      </section>

      <section className="bf-os-rhythm" aria-label={t("Ritm zilnic")}>
        <div className="bf-os-rhythm-head">
          <div>
            <p className="bf-os-kicker">{t("Ritm zilnic")}</p>
            <h2 className="bf-os-title">{t("Cât mai ține ziua.")}</h2>
          </div>
          <p className="bf-os-note" style={{ margin: 0 }}>{t("azi")} <b>{money(rhythm.todayLeft)}</b></p>
        </div>
        <div className="bf-os-rhythm-grid">
          {rhythm.days.map((row) => (
            <div key={row.day} className={`bf-os-day${row.isToday ? " is-today" : ""}${row.over ? " is-over" : ""}${row.isFuture ? " is-future" : ""}`}>
              <span>{weekdayShort()[row.weekday]}</span>
              <b>{row.left >= 1000 ? `${Math.round(row.left / 1000)}k` : Math.round(row.left)}</b>
              <span className="bf-os-bar" aria-hidden="true"><i style={{ height: `${row.fill}%` }} /></span>
            </div>
          ))}
        </div>
        <p className="bf-os-note">{rhythmNote}</p>
      </section>

      <div className="bf-os-actions">
        <button type="button" className="bf-os-decide" onClick={openHouseholdGuide}>{t("Poți cheltui?")}</button>
        <button type="button" className="bf-today-add bf-os-secondary" onClick={onAdd}><Plus size={18} /> {t("Înregistrează")}</button>
      </div>

      <TodayBrief data={data} onGo={onGo} onChange={onChange} onOpenWeek={() => document.getElementById("bf-week-checkin")?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      {sourceRows.length > 0 && (
        <section className="bf-os-sources" aria-label="Surse">
          <p className="bf-os-kicker">Surse</p>
          <h2 className="bf-os-title">{t("De unde pleacă banii.")}</h2>
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

      <section className="bf-os-income" aria-label={t("Următorul venit")}>
        <div className="bf-os-income-head">
          <div>
            <p className="bf-os-kicker">{t("Următorul venit")}</p>
            <h2 className="bf-os-title">{math.plan.nextPayday ? `${forecast.remainingDays} zile` : t("Setează data")}</h2>
            <p className="bf-os-note">{math.plan.nextPayday ? dateText(math.plan.nextPayday, true) : t("Planul are nevoie de următorul salariu ca să calculeze ritmul.")}</p>
          </div>
          <div>
            <strong>{money(math.availableSources)}</strong>
            <small>{t("în surse acum")}</small>
          </div>
        </div>
        <p className="bf-os-note">{t("{available} disponibili după plicuri · {scheduled} în scadențe încă neconfirmate", { available: money(Math.max(0, math.remaining)), scheduled: money(math.scheduled) })}</p>
        <button type="button" className="bf-today-plan-link" style={{ marginTop: 12 }} onClick={() => onGo("plan")}>Deschide planul <ChevronRight size={16} /></button>
      </section>

      <TodayLedger data={data} onGo={(view) => onGo(view)} />
      {(data.transactions.length > 0 || data.settings.members.length > 1 || data.settings.salaryPlan.allocations.length > 0) && (
        <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim bilanțul săptămânii…")}</div>}>
          <WeeklySummaryPanel data={data} onChange={onChange} onOpenJournal={() => onGo("journal")} onOpenPlan={() => onGo("plan")} />
        </Suspense>
      )}
      <DeferBelowFold>
        <section className="bf-today-hub-links" aria-label="Acces rapid">
          <p className="bf-kicker">ACCES RAPID</p>
          <div>
            {[{ label: "Plicuri", detail: t("Repartizează"), icon: Goal, view: "plan" as MainView }, { label: t("Mișcări"), detail: t("Vezi registrul"), icon: WalletCards, view: "journal" as MainView }, { label: t("Obligații"), detail: t("Urmărește scadențele"), icon: BellRing, view: "obligations" as MainView }, { label: t("Analiză"), detail: t("Înțelege ritmul"), icon: LayoutDashboard, view: "insights" as MainView }].map((item) => {
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
            <button className="dismiss" aria-label={t("Ascunde alerta tranșei săptămânale")} onClick={() => setShownTrancheKey("")}><X size={16} /></button>
          </aside>
        )}
        {activeEnvelopeAlert && (
          <aside className={`bf-envelope-live-notice ${activeEnvelopeAlert.state}`} role="status" aria-live="polite">
            <BellRing size={19} />
            <div>
              <p>{activeEnvelopeAlert.state === "over" ? t("PLIC DEPĂȘIT") : t("APROAPE DE LIMITĂ")}</p>
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
              <p className="bf-kicker">{t("DECIZIA URMĂTOARE")}</p>
              <h1>{t("Ce are nevoie")} <em>{t("gospodăria acum.")}</em></h1>
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
                <span><small>{t("PLANUL DE LUCRU")}</small><b>{t("Configurează următorul venit")}</b><em>{t("Gospodăria are nevoie de intervalul următor pentru a calcula ritmul.")}</em></span>
                <ChevronRight size={19} />
              </button>
            )}
          </div>
        </section>
        <section className="bf-today-measurements" aria-label={t("Măsurători financiare curente")}>
          <article>
            <span>SURSE UTILIZABILE</span>
            <b>{money(balance.liquidFunds)}</b>
            <small>{t("banii incluși în registru")}</small>
          </article>
          <article>
            <span>{t("OBLIGAȚII CONFIRMATE")}</span>
            <b className={balance.monthlyRates > 0 ? "attention" : ""}>{money(balance.monthlyRates)}</b>
            <small>{data.debts.length} de revizuit lunar</small>
          </article>
          <article>
            <span>{topEnvelope ? `LIMITĂ: ${topEnvelope.item.label}` : t("PLICURI / LIMITE")}</span>
            <b className={topEnvelope?.state === "over" ? "negative" : ""}>{topEnvelope ? `${Math.round(topEnvelope.usage * 100)}%` : "—"}</b>
            <small>{topEnvelope ? `${money(Math.max(0, topEnvelope.remaining))} rămași pentru perioadă` : t("creează prima limită")}</small>
          </article>
        </section>
        <TodayPulse data={data} onGo={onGo} />
        <NextStepCard signal={signals[0]} onOpen={() => signals[0] && openSignal(signals[0].action)} />
        <section className="bf-today-activity">
          <div className="bf-section-heading">
            <div>
              <p className="bf-kicker">{t("ACTIVITATE RECENTĂ")}</p>
              <h2>{t("Ce s-a înregistrat")}</h2>
            </div>
            <button onClick={() => onGo("journal")}>{t("Toate mișcările")} <ChevronRight size={15} /></button>
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
              <span><b>{t("Registrul zilei este pregătit.")}</b><small>{t("Înregistrează prima cheltuială sau încasare.")}</small></span>
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
                <h2 id="today-envelope-evolution-title">{t("Evoluția în timp")}</h2>
              </div>
              <button onClick={() => onGo("plan")}>Vezi istoricul <ChevronRight size={15} /></button>
            </div>
            <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim ritmul plicurilor…")}</div>}>
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
  useLanguage(); const [view, setView] = useState<MainView>(initialMainView); const [more, setMore] = useState<MoreView>("overview"); const [quickActionsOpen, setQuickActionsOpen] = useState(false); const [modal, setModal] = useState<"quick" | "transaction" | "receipt" | "debt" | "saving" | "debt-payment" | null>(null); const [editTx, setEditTx] = useState<Transaction>(); const [editGoal, setEditGoal] = useState<Debt | SavingsGoal>(); const [receiptStorageNotice, setReceiptStorageNotice] = useState(""); const legacyReceiptMigrationStarted = useRef(false); const [themePickerOpen, setThemePickerOpen] = useState(false); const [theme, setTheme] = useState<ThemeId>(() => { const saved = window.localStorage.getItem("buget-familie:theme"); return saved === "dark" ? "forest" : themeOptions.some((item) => item.id === saved) ? saved as ThemeId : "ivory"; }); const [themeSchedule, setThemeSchedule] = useState<ThemeSchedule>(() => window.localStorage.getItem("buget-familie:theme-schedule") === "auto" ? "auto" : "manual"); const [background, setBackground] = useState<BackgroundId>(() => { const saved = window.localStorage.getItem("buget-familie:background"); return backgroundOptions.some((item) => item.id === saved) ? saved as BackgroundId : "plain"; }); const previousBackgroundRef = useRef<BackgroundId>(background); const backgroundTransitionReady = useRef(false); const [highContrast, setHighContrast] = useState(() => window.localStorage.getItem("buget-familie:high-contrast") === "true"); const [scheduleTimes, setScheduleTimes] = useState<ThemeScheduleTimes>(() => { try { const saved = JSON.parse(window.localStorage.getItem("buget-familie:theme-schedule-times") || "null") as Partial<ThemeScheduleTimes> | null; return { dayStart: typeof saved?.dayStart === "string" ? saved.dayStart : defaultScheduleTimes.dayStart, eveningStart: typeof saved?.eveningStart === "string" ? saved.eveningStart : defaultScheduleTimes.eveningStart, nightStart: typeof saved?.nightStart === "string" ? saved.nightStart : defaultScheduleTimes.nightStart }; } catch { return defaultScheduleTimes; } }); const activeTheme = themeSchedule === "auto" ? automaticTheme(currentLocalMinutes(), scheduleTimes) : theme; const previousThemeRef = useRef<ThemeId>(activeTheme); const themeTransitionReady = useRef(false);

  useEffect(() => { let active = true; void readAppData().then((stored) => { if (!active || !stored) return; setData(normalizeAppData(stored)); }).catch(() => setStorageNotice(t("Stocarea modernă nu este disponibilă; folosim fallback-ul local al browserului."))).finally(() => { storageHydrated.current = true; setStorageReady(true); }); return () => { active = false; }; }, []);
  useEffect(() => { if (!storageHydrated.current) return; const serialized = syncPortable(data); try { window.localStorage.setItem(APP_STORAGE_KEY, serialized); } catch { setStorageNotice(t("Spațiul local este aproape plin. Fotografiile bonurilor rămân în stocarea dedicată; exportă un backup dacă problema continuă.")); } const timer = window.setTimeout(() => { void writeAppData(data).catch(() => setStorageNotice(t("Datele sunt păstrate în fallback-ul browserului; stocarea modernă nu a confirmat salvarea."))); }, 280); return () => window.clearTimeout(timer); }, [data]); useEffect(() => { setData((current) => autoPostDueRecurring(current)); }, []);
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
  }, [storageReady]); useEffect(() => { if (legacyReceiptMigrationStarted.current || !data.receipts.some((receipt) => (receipt.imageData || receipt.imageData2) && !receipt.imageKeys?.length)) return; legacyReceiptMigrationStarted.current = true; void migrateLegacyReceiptImages(data.receipts).then((migrated) => { if (!migrated.size) return; setData((current) => ({ ...current, receipts: current.receipts.map((receipt) => { const imageKeys = migrated.get(receipt.id); return imageKeys ? { ...receipt, imageKeys, imageData: undefined, imageData2: undefined } : receipt; }) })); setReceiptStorageNotice(`${migrated.size} bon${migrated.size === 1 ? " a fost mutat" : "uri au fost mutate"} în stocarea locală a telefonului.`); }).catch((reason) => setReceiptStorageNotice(reason instanceof Error ? reason.message : t("Nu am putut muta fotografiile vechi ale bonurilor; acestea nu au fost șterse."))); }, [data.receipts]); useEffect(() => { const root = document.documentElement; const previous = previousThemeRef.current; root.classList.remove(...themeOptions.map((item) => `theme-${item.id}`)); root.classList.add(`theme-${activeTheme}`); root.classList.toggle("dark", !LIGHT_THEMES.includes(activeTheme)); if (themeTransitionReady.current && previous !== activeTheme) { root.classList.remove("theme-transitioning"); root.classList.add("theme-transitioning"); const timer = window.setTimeout(() => root.classList.remove("theme-transitioning"), 420); previousThemeRef.current = activeTheme; return () => window.clearTimeout(timer); } themeTransitionReady.current = true; previousThemeRef.current = activeTheme; }, [activeTheme]); useEffect(() => { window.localStorage.setItem("buget-familie:theme", theme); }, [theme]); useEffect(() => { window.localStorage.setItem("buget-familie:theme-schedule", themeSchedule); }, [themeSchedule]); useEffect(() => { window.localStorage.setItem("buget-familie:theme-schedule-times", JSON.stringify(scheduleTimes)); }, [scheduleTimes]); useEffect(() => { const root = document.documentElement; const previous = previousBackgroundRef.current; if (backgroundTransitionReady.current && previous !== background) { root.classList.remove("background-transitioning", "background-from-plain", "background-from-paper", "background-from-grid", "background-from-aurora", "background-from-dots"); root.classList.add("background-transitioning", `background-from-${previous}`); const timer = window.setTimeout(() => root.classList.remove("background-transitioning", `background-from-${previous}`), 520); previousBackgroundRef.current = background; return () => window.clearTimeout(timer); } backgroundTransitionReady.current = true; previousBackgroundRef.current = background; }, [background]); useEffect(() => { document.documentElement.classList.remove("background-plain", "background-paper", "background-grid", "background-aurora", "background-dots"); document.documentElement.classList.add(`background-${background}`); window.localStorage.setItem("buget-familie:background", background); }, [background]); useEffect(() => { document.documentElement.classList.toggle("bf-high-contrast", highContrast); window.localStorage.setItem("buget-familie:high-contrast", String(highContrast)); }, [highContrast]); useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [view, more]); useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setQuickActionsOpen((open) => !open); } if (event.key === "Escape") setQuickActionsOpen(false); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []); useEffect(() => { const replay = () => setOnboardingOpen(true); const replaySetup = () => setSetupOpen(true); window.addEventListener("buget-familie:replay-onboarding", replay); window.addEventListener("buget-familie:replay-setup", replaySetup); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0) || Boolean(data.settings.salaryPlan.nextPayday); if (hasStarted && !window.localStorage.getItem("buget-familie:setup-complete")) window.localStorage.setItem("buget-familie:setup-complete", "true"); if (storageReady && !window.localStorage.getItem("buget-familie:onboarding-complete") && !hasStarted) setOnboardingOpen(true); if (storageReady && window.localStorage.getItem("buget-familie:onboarding-complete") && !window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted) setSetupOpen(true); return () => { window.removeEventListener("buget-familie:replay-onboarding", replay); window.removeEventListener("buget-familie:replay-setup", replaySetup); }; }, [storageReady, data.transactions.length, data.settings.salaryPlan.allocations.length, data.debts.length, data.savings.length, data.settings.paymentSources, data.settings.salaryPlan.nextPayday]);
  const update = (fn: (current: AppData) => AppData) => setData((current) => fn(current));

  /**
   * Ștergerea este un gest dintr-o singură atingere, deci și greșeala este.
   * Ținem lângă ea rândurile scoase, câteva secunde, ca revenirea să fie tot
   * o singură atingere. Vezi `lib/undo-delete.ts` pentru de ce nu e de ajuns
   * lista de „tombstones”.
   */
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const offerUndo = (action: UndoAction | undefined) => {
    window.clearTimeout(undoTimer.current);
    if (!action) return;
    setUndo(action);
    undoTimer.current = window.setTimeout(() => setUndo(null), 9000);
  };
  const runUndo = () => {
    window.clearTimeout(undoTimer.current);
    if (undo) update(undo.apply);
    setUndo(null);
  };
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  /**
   * Șterge rândurile alese și pregătește anularea, dintr-un singur loc.
   * Calculul se face pe starea curentă, nu într-un `setData(fn)`: acela rulează
   * abia la randare, deci rândurile scoase ar fi ajuns la bara de anulare goale.
   */
  const deleteWithUndo = (label: string, pick: (current: AppData) => { next: AppData; removed: Parameters<typeof buildUndo>[1] }) => {
    const { next, removed } = pick(data);
    setData(next);
    offerUndo(buildUndo(label, removed));
  };
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
  const syncDisconnect = () => { syncUnsubscribeRef.current?.(); syncUnsubscribeRef.current = undefined; syncRoomIdRef.current = undefined; window.clearTimeout(syncPushTimerRef.current); setSyncConnected(false); setSyncPassword(""); setSyncNotice(t("Sesiunea a fost închisă pe acest telefon.")); };
  const syncHandleRemoteEnvelope = async (envelope: EncryptedEnvelope) => {
    try {
      const crypto = await loadFamilyCrypto();
      const remoteData = normalizeAppData(await crypto.decryptFamilyData(envelope, syncPasswordRef.current));
      const merged = syncRetainLocalReceiptImages(crypto.mergeFamilyData(syncDataRef.current, remoteData));
      const mergedPortable = syncPortable(merged);
      if (mergedPortable === syncPortable(syncDataRef.current)) { setSyncLastSync(new Date().toISOString()); return; }
      const previous = syncDataRef.current;
      syncLastPortableRef.current = mergedPortable; setData(merged); setSyncLastSync(new Date().toISOString());
      // Anunță imediat dacă mișcarea primită a împins un plic peste prag; altfel afli abia la final de perioadă.
      void notifyFamilyEnvelopeChanges(previous, merged).catch(() => undefined);
      syncAppendJournal({ createdAt: new Date().toISOString(), status: "resolved", message: t("Actualizare primită de la un alt telefon conectat."), action: t("Datele au fost reunite automat prin ID și marcaj de actualizare.") });
    } catch (error) {
      syncAppendJournal({ createdAt: new Date().toISOString(), status: "failed", message: error instanceof Error ? error.message : "Pachetul primit nu a putut fi decriptat.", action: t("Verifică să fie exact aceeași parolă pe toate telefoanele.") });
      setSyncNotice(error instanceof Error ? error.message : "Un pachet primit nu a putut fi decriptat.");
    }
  };
  const syncConnect = async () => {
    /**
     * Din parolă se derivă și identificatorul camerei de sincronizare: cine îl
     * află poate suprascrie pachetul familiei, chiar fără să-l poată citi. O
     * lungime de 12 caractere nu spune nimic despre asta — „123456789012” are 12.
     */
    const strength = checkFamilyPassword(syncPassword);
    if (!strength.ok) { setSyncNotice(`${strength.label}. ${strength.advice.join(" ")}`); return; }
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
      setSyncNotice(t("Sesiunea familiei este activă. Actualizările apar automat pe toate telefoanele conectate, fără reîmprospătare manuală."));
    } catch (error) {
      setSyncNotice(error instanceof Error ? error.message : t("Familia nu a putut fi conectată."));
    } finally { setSyncBusy(false); }
  };
  useEffect(() => { if (!syncConnected || !syncRoomIdRef.current) return; const currentPortable = syncPortable(data); if (currentPortable === syncLastPortableRef.current) return; window.clearTimeout(syncPushTimerRef.current); syncPushTimerRef.current = window.setTimeout(() => { void (async () => { try { const { encryptFamilyData } = await loadFamilyCrypto();
          const envelope = await encryptFamilyData(data, syncPasswordRef.current); const { pushFamilyEnvelope } = await loadFamilySync();
          await pushFamilyEnvelope(syncRoomIdRef.current!, envelope); syncLastPortableRef.current = currentPortable; setSyncLastSync(new Date().toISOString()); } catch (error) { setSyncNotice(error instanceof Error ? error.message : t("Actualizarea nu a putut fi trimisă.")); } })(); }, 800); return () => window.clearTimeout(syncPushTimerRef.current); }, [data, syncConnected]);
  useEffect(() => () => syncUnsubscribeRef.current?.(), []);
  const syncPanelProps: SyncPanelProps = { connected: syncConnected, busy: syncBusy, password: syncPassword, setPassword: setSyncPassword, notice: syncNotice, lastSync: syncLastSync, journal: syncJournal, onConnect: () => void syncConnect(), onDisconnect: syncDisconnect, onClearJournal: () => { setSyncJournal([]); writeSyncJournal([]); } };
  useEffect(() => { const applySettings = (event: Event) => { const patch = (event as CustomEvent<Partial<AppData["settings"]>>).detail; if (!patch) return; setData((current) => ({ ...current, settings: { ...current.settings, ...patch } })); }; window.addEventListener("buget-familie:local-settings", applySettings); return () => window.removeEventListener("buget-familie:local-settings", applySettings); }, []);
  useEffect(() => { const openTheme = () => setThemePickerOpen(true); window.addEventListener("buget-familie:open-theme", openTheme); return () => window.removeEventListener("buget-familie:open-theme", openTheme); }, []);
  const saveTx = (item: Transaction) => update((current) => { const stamped = { ...item, updatedAt: new Date().toISOString() }; return { ...current, transactions: current.transactions.some((entry) => entry.id === item.id) ? current.transactions.map((entry) => entry.id === item.id ? stamped : entry) : [stamped, ...current.transactions] }; });
  const applyFinancialUpdate = (change: FinancialUpdate) => update((current) => { const member = current.settings.members.find((item) => "memberId" in change && change.memberId && item.id === change.memberId) || current.settings.members[0]; const source = current.settings.paymentSources.find((item) => item.memberId && member && item.memberId === member.id) || current.settings.paymentSources[0]; const now = new Date().toISOString(); if (change.kind === "income" && member && source) { if (current.transactions.some((item) => item.kind === "income" && item.amount === change.amount && item.title === change.title && item.date === (change.date || isoToday()))) return current; const transaction: Transaction = { id: newId("guided-income"), title: change.title, amount: change.amount, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: change.date || isoToday(), note: t("Venit adăugat împreună cu ghidul AI"), createdAt: now }; return { ...current, transactions: [transaction, ...current.transactions], settings: { ...current.settings, salaryPlan: { ...current.settings.salaryPlan, totalLimit: Math.max(0, (current.settings.salaryPlan.totalLimit || 0) + change.amount), updatedAt: now } } }; } if (change.kind === "debt") { const key = change.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const existingIndex = current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key); const nextDebt: Debt = { id: existingIndex >= 0 ? current.debts[existingIndex].id : newId("guided-debt"), name: change.name, remaining: change.remaining, monthly: existingIndex >= 0 ? current.debts[existingIndex].monthly : 0, due: change.due || (existingIndex >= 0 ? current.debts[existingIndex].due : "Nespecificat"), memberId: member?.id, tone: existingIndex >= 0 ? current.debts[existingIndex].tone : "coral", updatedAt: now }; const debts = existingIndex >= 0 ? current.debts.map((item, index) => index === existingIndex ? nextDebt : item) : [nextDebt, ...current.debts]; return { ...current, debts }; } if (change.kind === "debt-monthly") { const key = change.name?.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const index = key ? current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key) : 0; if (index < 0) return current; return { ...current, debts: current.debts.map((item, itemIndex) => itemIndex === index ? { ...item, monthly: change.amount, updatedAt: now } : item) }; } if (change.kind === "expense" && member && source) { const day = change.date || isoToday(); const usedSource = current.settings.paymentSources.find((item) => item.id === change.sourceId) || source; const usedMember = current.settings.members.find((item) => item.id === change.memberId) || member; const transaction: Transaction = { id: newId("guided-expense"), title: change.title, amount: change.amount, kind: "expense", category: change.category, sourceId: usedSource.id, source: usedSource.name, memberId: usedMember.id, person: usedMember.name, date: day, allocationId: change.allocationId || "outside", note: t("Cheltuială adăugată împreună cu ghidul AI"), createdAt: now }; return { ...current, transactions: [transaction, ...current.transactions] }; } if (change.kind === "transfer") return transferBetweenEnvelopes(current, { fromAllocationId: change.fromId, toAllocationId: change.toId, amount: change.amount, note: t("Realocare din ghidul AI") }) || current; if (change.kind === "recurring") {
      const source = current.settings.paymentSources.find((item) => item.memberId === member?.id) || current.settings.paymentSources[0];
      if (!source || !member) return current;
      const item = { id: newId("recurring"), name: change.name, amount: change.amount, category: change.category, sourceId: source.id, memberId: member.id, dueDay: Math.min(31, Math.max(1, change.dueDay)), active: true, autoPost: false, updatedAt: now };
      return { ...current, recurring: [...current.recurring, item] };
    }
    if (change.kind === "goal") {
      const goal: SavingsGoal = { id: newId("goal"), name: change.name, current: change.current || 0, target: change.target, due: change.dueDate ? formatDate(change.dueDate, { day: "2-digit", month: "long", year: "numeric" }) : t("Fără termen"), dueDate: change.dueDate, memberId: member?.id, tone: "honey", updatedAt: now };
      return { ...current, savings: [goal, ...current.savings] };
    }
    if (change.kind === "payday") {
      // Data cerută devine reperul planului; fereastra spune cât poate întârzia salariul.
      const plan = current.settings.salaryPlan;
      const earliest = addIsoDays(change.date, 0);
      return { ...current, settings: { ...current.settings, salaryPlan: { ...plan, nextPayday: change.date, earliestPayday: earliest >= plan.periodStart ? earliest : plan.periodStart, paydayFlexDays: change.flexDays, updatedAt: now } } };
    }
    if (change.kind !== "allocation") return current; const labels: Record<string, string> = { Alimente: "Alimente", Facturi: "Casă & facturi", Transport: "Transport", Economii: "Economii", Datorii: "Rate produse" }; const label = change.label || labels[change.category] || change.category; const existing = current.settings.salaryPlan.allocations.find((item) => item.label === label || item.category === label); const weeklyPace = change.weekly ? undefined : false; const nextAllocation = existing ? { ...existing, amount: change.amount, weeklyPace, category: label, updatedAt: now } : { id: newId("guided-allocation"), label, category: label, amount: change.amount, weeklyPace, memberId: member?.id, sourceId: source?.id }; const allocations = existing ? current.settings.salaryPlan.allocations.map((item) => item.id === existing.id ? nextAllocation : item) : [...current.settings.salaryPlan.allocations, nextAllocation]; const plan = current.settings.salaryPlan; const start = plan.periodStart || isoToday(); const weeks = change.weeks && change.weeks >= 2 ? change.weeks : 4; const fallbackPayday = new Date(`${start}T12:00:00`); fallbackPayday.setDate(fallbackPayday.getDate() + weeks * 7 - 1); const spokenPayday = "payday" in change && change.payday && change.payday >= start ? change.payday : undefined; const nextPayday = spokenPayday || plan.nextPayday || fallbackPayday.toISOString().slice(0, 10); const flex = spokenPayday ? (plan.paydayFlexDays ?? 3) : (plan.paydayFlexDays ?? 3); const earliest = new Date(`${nextPayday}T12:00:00`); earliest.setDate(earliest.getDate() - flex); const earliestPayday = earliest.toISOString().slice(0, 10) < start ? start : earliest.toISOString().slice(0, 10); const weeklyLimit = change.weeklyAmount || plan.weeklyLimit || (change.weekly ? Math.round((change.amount / weeks) * 100) / 100 : plan.weeklyLimit); return { ...current, settings: { ...current.settings, salaryPlan: { ...plan, periodStart: start, nextPayday, earliestPayday, paydayFlexDays: flex, weeklyLimit, sourceIds: plan.sourceIds.length ? plan.sourceIds : source ? [source.id] : plan.sourceIds, allocations, updatedAt: now } } }; });
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
  const deleteReceipt = (id: string) => {
    const receipt = data.receipts.find((item) => item.id === id);
    void removeReceiptImages(receipt?.imageKeys).catch(() => setReceiptStorageNotice(t("Bonul a fost șters din registru, dar telefonul nu a confirmat încă ștergerea fotografiei locale.")));
    // Fotografiile sunt deja șterse de pe telefon, deci anularea readuce bonul fără poze; o spunem pe față.
    deleteWithUndo(receipt?.imageKeys?.length ? t("Bonul a fost șters. Anularea îl readuce fără fotografii.") : t("Bonul a fost șters."), (current) => {
      const currentReceipt = current.receipts.find((item) => item.id === id);
      const linked = currentReceipt?.linkedTransactionIds || [currentReceipt?.linkedTransactionId, `receipt-tx-${id}`].filter((value): value is string => Boolean(value));
      const now = new Date().toISOString();
      const removedTransactions = current.transactions.filter((item) => linked.includes(item.id) || item.receiptId === id);
      return {
        next: { ...current, receipts: current.receipts.filter((item) => item.id !== id), transactions: current.transactions.filter((item) => !linked.includes(item.id) && item.receiptId !== id), deleted: [...current.deleted, { entity: "receipts" as const, id, deletedAt: now }, ...linked.map((transactionId) => ({ entity: "transactions" as const, id: transactionId, deletedAt: now }))].slice(-500) },
        removed: { receipts: currentReceipt ? [{ ...currentReceipt, imageKeys: undefined }] : [], transactions: removedTransactions },
      };
    });
  };
  const openTx = (item?: Transaction) => { setEditTx(item); setModal(item ? "transaction" : "quick"); };
  // Widgetul și dala din Setări rapide deschid direct ecranul cerut, fără pași intermediari.
  useEffect(() => observeQuickActions((action) => {
    if (action === "receipt") { setModal("receipt"); return; }
    if (action === "expense") { setEditTx(undefined); setModal("quick"); return; }
    go("today");
  }), []);
  const nav = [{ id: "today" as MainView, label: t("Astăzi"), icon: LayoutGrid }, { id: "journal" as MainView, label: t("Mișcări"), icon: ListFilter }, { id: "plan" as MainView, label: t("Plan"), icon: PlayCircle }, { id: "obligations" as MainView, label: t("Obligații"), icon: Bell }, { id: "insights" as MainView, label: t("Analiză"), icon: BarChart3 }];
  const current = () => { if (view === "journal") return <MovementsJournal data={data} onAdd={() => openTx()} onEdit={openTx} onDelete={(id) => deleteWithUndo(t("Mișcarea a fost ștearsă."), (currentData) => ({
      next: { ...currentData, transactions: currentData.transactions.filter((item) => item.id !== id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId !== id), deleted: [...currentData.deleted, { entity: "transactions" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { transactions: currentData.transactions.filter((item) => item.id === id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId === id) },
    }))} />; if (view === "plan")
 return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim planul…")}</div>}><PlanStudio data={data} onChange={setData} /></Suspense>; if (view === "habits") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obiceiurile…")}</div>}><SpendingHabitsView data={data} /></Suspense>; if (view === "calendar") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim calendarul…")}</div>}><FinancialCalendarView data={data} /></Suspense>; if (view === "goals") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obiectivele…")}</div>}><LongTermGoalsView data={data} onOpen={() => { setEditGoal(undefined); setModal("saving"); }} onEdit={(item) => { setEditGoal(item); setModal("saving"); }} onDelete={(id) => deleteWithUndo(t("Obiectivul a fost șters."), (currentData) => ({
      next: { ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { savings: currentData.savings.filter((item) => item.id === id) },
    }))} /></Suspense>; if (view === "obligations") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obligațiile…")}</div>}><ObjectivesView data={data} onEditDebt={(item) => { setEditGoal(item); setModal("debt"); }} onEditSaving={(item) => { setEditGoal(item); setModal("saving"); }} onPayDebt={(item) => { setEditGoal(item); setModal("debt-payment"); }} onDeleteDebt={(id) => deleteWithUndo(t("Datoria a fost ștearsă."), (currentData) => ({
      next: { ...currentData, debts: currentData.debts.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "debts" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { debts: currentData.debts.filter((item) => item.id === id) },
    }))} onDeleteSaving={(id) => deleteWithUndo(t("Obiectivul a fost șters."), (currentData) => ({
      next: { ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { savings: currentData.savings.filter((item) => item.id === id) },
    }))} openDebt={() => { setEditGoal(undefined); setModal("debt"); }} openSaving={() => { setEditGoal(undefined); setModal("saving"); }} onOpenGoals={() => go("goals")} onOpenCalendar={() => go("calendar")} onOpenAssistant={() => { setMore("assistant"); go("utilities"); }} onOpenRecurring={() => { setMore("recurring"); go("utilities"); }} onPayRecurring={(id) => update((currentData) => confirmRecurringPayment(currentData, id) || currentData)} /></Suspense>; if (view === "insights") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim analiza…")}</div>}><InsightsView data={data} onChange={setData} onGo={go} /></Suspense>; if (view === "utilities") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim instrumentele…")}</div>}><MoreViewScreen tab={more} setTab={setMore} data={data} onChange={setData} onAddReceipt={() => setModal("receipt")} onDeleteReceipt={deleteReceipt} onOpenDebt={() => { setEditGoal(undefined); setModal("debt"); }} onOpenSaving={() => { setEditGoal(undefined); setModal("saving"); }} onOpenCalendar={() => go("calendar")} receiptStorageNotice={receiptStorageNotice} sync={syncPanelProps} /></Suspense>; return <TodayView data={data} onAdd={() => openTx()} onGo={go} onChange={setData} />; };
  return <div className="bf-app">
    <a className="bf-skip-link" href="#main-content">{t("Sari la conținut")}</a>
    {storageNotice && <div className="bf-storage-notice" role="status"><ShieldCheck size={15} /><span>{storageNotice}</span><button type="button" aria-label={t("Închide notificarea")} onClick={() => setStorageNotice(null)}><X size={14} /></button></div>}
    <header className="bf-appbar os-appbar"><button className="os-brand" onClick={() => go("today")}><BrandMark /><span className="os-brand-copy"><b>Buget</b><i>Familie</i></span></button><nav className="os-desktop-nav" aria-label={t("Navigație principală")}>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerEnter={() => preloadView(item.id)} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={17} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav><div className="os-tools"><button className="os-tool" aria-label={t("Deschide acțiunile rapide")} title={t("Acțiuni rapide · Ctrl K")} onPointerDown={() => void loadSecondary()} onClick={() => setQuickActionsOpen(true)}><Search size={17} /></button><button className={view === "utilities" ? "os-tool is-on" : "os-tool"} aria-label="Deschide instrumentele" onPointerDown={() => preloadView("utilities")} onClick={() => go("utilities")}><MoreHorizontal size={19} /></button><button className="os-tool" aria-label="Deschide ghidul" onClick={openHouseholdGuide}><MessagesSquare size={17} /></button></div></header>
    <main id="main-content" key={view} className="bf-screen-transition">{current()}</main>
    {undo && (
      <div className="bf-undo-bar" role="status" aria-live="polite">
        <span>{undo.label}</span>
        <button type="button" onClick={runUndo}><RotateCcw size={15} aria-hidden="true" /> {t("Anulează")}</button>
        <button type="button" className="bf-undo-close" aria-label={t("Închide")} onClick={() => setUndo(null)}><X size={16} /></button>
      </div>
    )}

    <nav className="os-dock" aria-label={t("Navigație mobilă")}>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={16} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav>
    <AICompanion data={data} view={view} onAdd={() => openTx()} onGo={go} onNaturalEntry={openNaturalDraft} onFinancialUpdate={applyFinancialUpdate} onRevert={revertGuided} />
    {themePickerOpen && <Suspense fallback={null}><ThemePicker theme={theme} schedule={themeSchedule} scheduleTimes={scheduleTimes} highContrast={highContrast} background={background} onChange={setTheme} onScheduleChange={setThemeSchedule} onScheduleTimesChange={setScheduleTimes} onContrastChange={setHighContrast} onBackgroundChange={setBackground} onClose={() => setThemePickerOpen(false)} /></Suspense>} {quickActionsOpen && <Suspense fallback={null}><QuickActionsPalette onClose={() => setQuickActionsOpen(false)} onAdd={() => openTx()} onGo={go} /></Suspense>} {onboardingOpen && <Suspense fallback={null}><CalmOnboarding onClose={() => { setOnboardingOpen(false); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0); if (!window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted) setSetupOpen(true); }} onAdd={() => openTx()} onGo={go} /></Suspense>} {setupOpen && <AIFinancialSetup data={data} onChange={setData} onClose={() => setSetupOpen(false)} onGoPlan={() => go("plan")} onAdd={() => openTx()} />}
    {modal === "quick" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim înregistrarea rapidă…")}</div></div>}><QuickEntryPanel data={data} onSave={saveTx} onSaveTemplate={saveQuickTemplate} onDeleteTemplate={deleteQuickTemplate} onArchiveTemplate={archiveQuickTemplate} onRestoreTemplate={restoreQuickTemplate} onDeleteArchivedTemplate={deleteArchivedQuickTemplate} onClose={() => setModal(null)} onMore={() => { setEditTx(undefined); setModal("transaction"); }} /></Suspense>}
    {modal === "transaction" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim mișcarea…")}</div></div>}><TransactionForm data={data} initial={editTx} onSave={saveTx} onClose={() => { setModal(null); setEditTx(undefined); }} /></Suspense>}
    {modal === "receipt" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim bonul…")}</div></div>}><ReceiptForm data={data} onSave={saveReceipt} onClose={() => setModal(null)} /></Suspense>}
    {modal === "debt" && <Suspense fallback={null}><GoalForm data={data} type="debt" item={editGoal} onSave={saveDebt} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "saving" && <Suspense fallback={null}><GoalForm data={data} type="saving" item={editGoal} onSave={saveSaving} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "debt-payment" && editGoal && "remaining" in editGoal && <Suspense fallback={null}><DebtPaymentForm data={data} debt={editGoal} onSave={setData} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
  </div>;
}
