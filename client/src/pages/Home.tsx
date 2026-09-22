/**
 * Atelierul Financiar — tablou mobil pentru o persoană sau o gospodărie, cu decizia următoare în prim-plan.
 * First paint: doar Astăzi. Restul ecranelor, sync-ul și formularele se încarcă la cerere.
 */
import { lazy, startTransition, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, BookOpen, CloudOff, RotateCcw, BellRing, CalendarClock, CreditCard, Inbox, Info, LayoutGrid, ListFilter, MessagesSquare, MoreHorizontal, PlayCircle, Plus, ReceiptText, Search, ShieldCheck, Ticket, Wallet, X, ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { allocationWeekStatus, adoptOutsideExpenses, commitLedgerEntry, confirmRecurringPayment, envelopeDecisionStatus, addIsoDays, financialBalance, formatDate, inPlanPeriod, isoDate, isoToday, newId, normalizeAppData, parseRomanianAmount, pendingRecurringInPlan, planAllocationMath, planEndDate, planForecast, sourceBalance, transferBetweenEnvelopes, transferBetweenWeeks, type AppData, type Debt, type Receipt, type SavingsGoal, type Transaction } from "@/lib/finance-data";
import { calendarBudgetWeekKey, currentCalendarBudgetWeek } from "@/lib/calendar-budget";
import { addContribution, eventTraits } from "@/lib/planned-events";
import { applyDeclaredBalance } from "@/lib/balance-check";
import { levelStartedWeek, totalForWeeklyPace } from "@/lib/started-week";
import { migrateLegacyReceiptImages, removeReceiptImages } from "@/lib/receipt-storage";
import { queueReceiptForReview } from "@/lib/receipt-review";
import { safeSetItem } from "@/lib/safe-storage";
import { markOpeningBalanceAsked, shouldAskOpeningBalance } from "@/lib/ui-prefs";
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { ChartEmpty, ChartTip } from "@/components/ChartFrame";
import { leiLabel } from "@/lib/chart-ui";
import type { FinancialUpdate, GuidedRevert, NaturalDraft } from "@/components/AICompanion";
import { BrandMark } from "@/components/BrandMark";
import { CategoryGlyph } from "@/components/CategoryGlyph";
import { TodayLedger } from "@/components/TodayLedger";
import { TodayBrief } from "@/components/TodayBrief";
import { observeQuickActions, publishWidgetTemplates } from "@/lib/quick-action-bridge";
import { allocationHistorySnapshot } from "@/lib/allocation-history";
import { householdActivityInCycle, todayBrief, trackModeHero, weeklyEnvelopeDailyRhythm } from "@/lib/household-insights";
import {
  DeferBelowFold,
  WhatsNewSheet,
  dateText,
  fmtExact,
  money,
  sourceKindName,
  type MainView,
  type MoreView,
} from "@/pages/home-kit";
import { markWhatsNewSeen, shouldShowWhatsNew } from "@/lib/theme-default";
import { markFirstWeekTourSeen, shouldOfferFirstWeekTour } from "@/lib/first-week-tour";
import { daysLabel, getLocale, t } from "@/lib/i18n";
import { hideNativeSplash, syncAndroidChrome } from "@/lib/native-splash";
import { ensureDeferredStyles } from "@/lib/ram-hygiene";
import { useLanguage } from "@/hooks/use-language";
import { useUndo } from "@/hooks/useUndo";
import { useThemeChrome } from "@/hooks/useThemeChrome";
import { useFamilySync, syncPortable } from "@/hooks/useFamilySync";
import { usePersistAppData, readInitialAppData } from "@/hooks/usePersistAppData";
import { useSimpleMode } from "@/hooks/useSimpleMode";
import { EnvelopeConflictBanner, MovementConflictBanner } from "@/components/EnvelopeConflictBanner";
import { FirstRunSetup } from "@/components/FirstRunSetup";
import { FAMILIE_OPEN_EVENT } from "@/lib/entitlements";

const PlanStudio = lazy(() => import("@/components/PlanStudio").then((module) => ({ default: module.PlanStudio })));
const MovementsJournal = lazy(() => import("@/components/MovementsJournal").then((module) => ({ default: module.MovementsJournal })));
const QuickEntryPanel = lazy(() => import("@/components/QuickEntryPanel").then((module) => ({ default: module.QuickEntryPanel })));
const FirstWeekTour = lazy(() => import("@/components/FirstWeekTour").then((module) => ({ default: module.FirstWeekTour })));
const WeeklySummaryPanel = lazy(() => import("@/components/WeeklySummaryPanel").then((module) => ({ default: module.WeeklySummaryPanel })));
const SafeSpendSheet = lazy(() => import("@/components/SafeSpendSheet").then((module) => ({ default: module.SafeSpendSheet })));
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
const AICompanion = lazy(() => import("@/components/AICompanion").then((module) => ({ default: module.AICompanion })));

/**
 * Link direct către un ecran. Lista era scrisă de mână și rămăsese în urmă: „goals”,
 * „habits” și „calendar” cădeau tăcut înapoi pe Astăzi, deși ecranele există — un link
 * dintr-o notificare sau o scurtătură ducea în altă parte decât spunea.
 */
const MAIN_VIEWS: MainView[] = ["today", "journal", "plan", "obligations", "goals", "habits", "calendar", "insights", "utilities"];
const initialMainView = (): MainView => {
  const requested = new URLSearchParams(window.location.search).get("view") as MainView | null;
  return requested && MAIN_VIEWS.includes(requested) ? requested : "today";
};
type AdvisorAction = "plan" | "recurring" | "objectives" | "journal";
type AdvisorSignal = { id: string; tone: "good" | "watch" | "risk"; eyebrow: string; title: string; detail: string; action: AdvisorAction; actionLabel: string };

const preloadView = (id: MainView) => {
  if (id === "journal") void import("@/components/MovementsJournal");
  else if (id === "plan") void import("@/components/PlanStudio");
  else if (id === "calendar") void import("@/components/FinancialCalendarView");
  else if (id === "insights" || id === "obligations" || id === "goals" || id === "habits" || id === "utilities") void loadSecondary();
};

function planMath(data: AppData) {
  const plan = data.settings.salaryPlan;
  const planEnd = planEndDate(plan);
  const alloc = planAllocationMath(data);
  const selected = data.settings.paymentSources.filter((source) => alloc.sourceIds.includes(source.id));
  const periodExpenses = data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, plan)).reduce((sum, item) => sum + item.amount, 0);
  const days = planEnd ? Math.max(1, Math.floor((new Date(`${planEnd}T12:00:00`).valueOf() - new Date(`${plan.periodStart}T12:00:00`).valueOf()) / 86400000) + 1) : 7;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weeklyPacedTotal = plan.allocations.filter((item) => item.weeklyPace !== false).reduce((sum, item) => sum + item.amount, 0);
  const weekly = plan.weeklyLimit || weeklyPacedTotal / weeks;
  return { plan, planEnd, selected, periodExpenses, days, weeks, weekly, weeklyPacedTotal, remaining: alloc.unrepartized, ...alloc };
}

function advisorSignals(data: AppData): AdvisorSignal[] {
  const math = planMath(data);
  const forecast = planForecast(data);
  const signals: AdvisorSignal[] = [];
  const pending = pendingRecurringInPlan(data).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!math.plan.nextPayday) {
    signals.push({ id: "plan-needed", tone: "watch", eyebrow: t("URMĂTORUL PAS"), title: t("Alege următorul venit"), detail: t("Planul are nevoie de o dată de salariu pentru a calcula ritmul sigur de cheltuire."), action: "plan", actionLabel: t("Configurează planul") });
  } else if (math.remaining < 0) {
    signals.push({ id: "over-plan", tone: "risk", eyebrow: t("ATENȚIE"), title: t("Planul este peste limită cu {amount}", { amount: money(Math.abs(math.remaining)) }), detail: t("Sunt incluse {expenses} cheltuieli și {scheduled} rezervate până la {until}.", { expenses: money(math.periodExpenses), scheduled: money(math.scheduled), until: dateText(math.planEnd || math.plan.nextPayday) }), action: "plan", actionLabel: t("Revizuiește planul") });
  } else if (forecast.spentToDate > 0 && forecast.projectedRemaining < 0) {
    signals.push({ id: "pace-risk", tone: "risk", eyebrow: t("RITM DE REVIZUIT"), title: t("La ritmul actual lipsesc {amount}", { amount: money(Math.abs(forecast.projectedRemaining)) }), detail: t("Cheltuielile sunt în medie {pace} pe zi; ritmul sigur este {safe} pe zi până la venit.", { pace: money(forecast.paceDaily), safe: money(forecast.safeDaily) }), action: "plan", actionLabel: t("Ajustează planul") });
  } else {
    const daily = math.remaining / Math.max(1, math.days);
    signals.push({ id: "daily-pace", tone: "good", eyebrow: t("RITM SIGUR"), title: t("{amount} pe zi până la venit", { amount: money(daily) }), detail: t("{amount} rămân după cheltuielile înregistrate și rezervele deja planificate.", { amount: money(math.remaining) }), action: "plan", actionLabel: t("Vezi calculele") });
  }
  if (pending[0]) {
    signals.push({ id: "next-recurring", tone: "watch", eyebrow: t("SCADENȚĂ REZERVATĂ"), title: t("{name} · {amount}", { name: pending[0].name, amount: money(pending[0].amount) }), detail: t("Este programată pentru {date} și este deja exclusă din suma disponibilă.", { date: dateText(pending[0].dueDate, true) }), action: "recurring", actionLabel: t("Deschide scadențele") });
  }
  const allocation = data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item) })).sort((a, b) => b.usage - a.usage)[0];
  if (allocation && allocation.state !== "healthy") {
    const over = allocation.state === "over";
    signals.push({ id: `allocation-${allocation.item.id}`, tone: over ? "risk" : "watch", eyebrow: over ? t("PLIC DEPĂȘIT") : t("APROAPE DE LIMITĂ"), title: t("{label}: {amount} rămași", { label: allocation.item.label, amount: money(Math.max(0, allocation.remaining)) }), detail: t("{spent} cheltuiți din limita ajustată de {budget} în perioada activă.", { spent: money(allocation.spent), budget: money(allocation.budget) }), action: "plan", actionLabel: t("Vezi plicul") });
  }
  const goal = data.savings.filter((item) => item.target > item.current).sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
  if (goal && signals.length < 3) signals.push({ id: `goal-${goal.id}`, tone: "good", eyebrow: t("OBIECTIV COMUN"), title: t("{amount} până la {name}", { amount: money(goal.target - goal.current), name: goal.name }), detail: t("Progres actual: {current} din {target}.", { current: money(goal.current), target: money(goal.target) }), action: "objectives", actionLabel: t("Vezi obiectivul") });
  const unrepartized = math.availableSources - math.reservedInEnvelopes - math.scheduled;
  const weeklyRhythm = weeklyEnvelopeDailyRhythm(data);
  /**
   * Când plicurile săptămânii dau cifra de azi, banii liberi nu o umflă. Nu-i mai
   * punem drept „următorul pas” — stau în Plan, liberi, până vrea omul.
   */
  if (unrepartized > 50 && data.settings.salaryPlan.allocations.length > 0 && !weeklyRhythm.hasWeekly) {
    signals.push({ id: "ready-to-assign", tone: "watch", eyebrow: t("DE REPARTIZAT"), title: t("{amount} fără un plic", { amount: money(unrepartized) }), detail: t("Banii din surse care nu au încă un loc. Dă-le un plic ca cifra de azi să nu se umfle din cash împărțit pe zile."), action: "plan", actionLabel: t("Repartizează") });
  }
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
function OpeningBalanceCard({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const [value, setValue] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const source = data.settings.paymentSources[0];
  if (dismissed || !source || source.openingBalance > 0 || data.transactions.length === 0 || !shouldAskOpeningBalance()) return null;
  const save = () => {
    const amount = Math.max(0, parseRomanianAmount(value));
    if (!amount) return;
    markOpeningBalanceAsked();
    setDismissed(true);
    onChange({
      ...data,
      settings: {
        ...data.settings,
        paymentSources: data.settings.paymentSources.map((entry) => entry.id === source.id ? { ...entry, openingBalance: amount } : entry),
      },
    });
  };
  return (
    <section className="bf-opening-prompt" aria-labelledby="bf-opening-title">
      <p className="bf-kicker">{t("SOLD REAL")}</p>
      <h2 id="bf-opening-title">{t("Cât ai acum pe {name}?", { name: source.name })}</h2>
      <p>{t("Altfel cifra de azi poate părea 0. Poți sări — completezi oricând din Setări.")}</p>
      <label className="bf-field"><span>{t("Sumă (lei)")}</span><input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0" /></label>
      <div className="bf-opening-actions">
        <button type="button" className="bf-secondary" onClick={() => { markOpeningBalanceAsked(); setDismissed(true); }}>{t("Mai târziu")}</button>
        <button type="button" className="bf-primary" onClick={save}>{t("Salvează soldul")}</button>
      </div>
    </section>
  );
}

function TodayView({ data, onAdd, onEdit, onGo, onChange, onOpenReview, onOpenSettings, onOpenRecurring }: { data: AppData; onAdd: () => void; onEdit: (item: Transaction) => void; onGo: (view: MainView) => void; onChange: (next: AppData) => void; onOpenReview: () => void; onOpenSettings: () => void; onOpenRecurring: () => void }) {
  const { simpleMode } = useSimpleMode();
  const math = useMemo(() => planMath(data), [data]);
  const forecast = useMemo(() => planForecast(data), [data]);
  const signals = useMemo(() => advisorSignals(data), [data]);
  const brief = useMemo(() => todayBrief(data), [data]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [shownTrancheKey, setShownTrancheKey] = useState("");
  const [openHint, setOpenHint] = useState(false);
  const [safeSheetOpen, setSafeSheetOpen] = useState(false);
  const [rhythmTip, setRhythmTip] = useState<string | null>(null);
  const envelopes = useMemo(() => data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item) })), [data]);
  const topEnvelope = [...envelopes].sort((a, b) => b.usage - a.usage)[0];
  const activeEnvelopeAlert = envelopes.filter((item) => item.state !== "healthy" && !dismissedAlerts.includes(item.item.id)).sort((a, b) => (b.state === "over" ? 2 : 1) - (a.state === "over" ? 2 : 1))[0];
  const lastMoves = useMemo(() => {
    const byRecency = (left: Transaction, right: Transaction) =>
      (right.updatedAt || right.createdAt || right.date).localeCompare(left.updatedAt || left.createdAt || left.date);
    if (data.settings.members.length < 2) {
      return [...data.transactions].sort(byRecency).slice(0, 5);
    }
    const recentIds = householdActivityInCycle(data).recent.map((item) => item.id);
    return recentIds
      .map((id) => data.transactions.find((item) => item.id === id))
      .filter((item): item is Transaction => Boolean(item));
  }, [data]);
  const overPlan = math.remaining < 0;
  const daily = math.plan.nextPayday ? forecast.safeDaily : 0;
  const weeklyEnvelopesRemaining = envelopes.filter((entry) => entry.scope === "week").reduce((sum, entry) => sum + entry.remaining, 0);
  const monthlyEnvelopesRemaining = envelopes.filter((entry) => entry.scope === "cycle").reduce((sum, entry) => sum + entry.remaining, 0);
  const envelopeTotalRemaining = Math.max(0, weeklyEnvelopesRemaining + monthlyEnvelopesRemaining);
  const periodIncome = data.transactions.filter((item) => item.kind === "income" && inPlanPeriod(item.date, math.plan)).reduce((sum, item) => sum + item.amount, 0);
  const periodExpense = data.transactions.filter((item) => item.kind === "expense" && inPlanPeriod(item.date, math.plan)).reduce((sum, item) => sum + item.amount, 0);
  const activeTranche = math.planEnd ? currentCalendarBudgetWeek(math.weeklyPacedTotal, math.plan.periodStart, math.planEnd, isoToday()) : undefined;
  const activeTrancheKey = activeTranche ? calendarBudgetWeekKey(activeTranche) : "";
  const showTrancheNotice = Boolean(activeTranche && shownTrancheKey === activeTrancheKey);
  useEffect(() => {
    if (!activeTranche || !activeTrancheKey || data.settings.seenWeeklyPlanTranches.includes(activeTrancheKey) || shownTrancheKey === activeTrancheKey) return;
    setShownTrancheKey(activeTrancheKey);
    window.dispatchEvent(new CustomEvent("buget-familie:local-settings", { detail: { seenWeeklyPlanTranches: [...data.settings.seenWeeklyPlanTranches, activeTrancheKey].slice(-80) } }));
  }, [activeTranche, activeTrancheKey, data.settings.seenWeeklyPlanTranches, shownTrancheKey]);
  const openSignal = (action: AdvisorAction) => {
    if (action === "plan") onGo("plan");
    else if (action === "journal") onGo("journal");
    else if (action === "recurring") onOpenRecurring();
    else onGo("obligations");
  };

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

  const fresh = !data.transactions.length
    && !data.settings.salaryPlan.allocations.length
    && !data.settings.paymentSources.some((item) => item.openingBalance > 0);

  const liquidNow = sourceRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const spentToday = data.transactions.filter((item) => item.kind === "expense" && item.date === todayIso).reduce((sum, item) => sum + item.amount, 0);
  const trackHero = trackModeHero({ periodIncome, liquidNow, spentToday });

  // Un singur număr de decizie: reperul zilnic (spendable), nu soldul plicurilor.
  // Fără payday, Ana cu 1.200 pe card nu trebuie să vadă „Plicuri neconfigurate · 0,00”.
  const heroLabel = overPlan
    ? t("Peste limita planului")
    : brief.hasPayday
      ? t("Poți folosi azi")
      : data.settings.salaryPlan.allocations.length
        ? t("Rămas în plicuri")
        : trackHero.kind === "income"
          ? t("Venit înregistrat în ciclu")
          : trackHero.kind === "liquid"
            ? t("Ai acum")
            : trackHero.kind === "spent"
              ? t("Cheltuit astăzi")
              : t("Plicuri neconfigurate");
  const heroValue = overPlan
    ? Math.abs(math.remaining)
    : brief.hasPayday
      ? brief.spendable
      : data.settings.salaryPlan.allocations.length
        ? envelopeTotalRemaining
        : trackHero.value;
  const heroHint = overPlan
    ? t("de acoperit prin limită, plicuri sau cheltuieli flexibile")
    : brief.hasPayday
      ? brief.reason
      : data.settings.salaryPlan.allocations.length
        ? t("{weekly} săptămânale · {monthly} lunare/fixe{benchmark}", { weekly: money(Math.max(0, weeklyEnvelopesRemaining)), monthly: money(Math.max(0, monthlyEnvelopesRemaining)), benchmark: math.plan.nextPayday ? t(" · reper {daily}/zi", { daily: money(daily) }) : "" })
        : trackHero.kind === "income"
          ? t("Suma e în Mișcări. Pune plicuri în Plan ca să vezi cât mai rămâne pe categorii.")
          : trackHero.kind === "liquid"
            ? t("Soldul surselor, după mișcările de azi. Pune data venitului în Plan ca să vezi cât poți folosi pe zi.")
            : trackHero.kind === "spent"
              ? t("Nu e un sold. E suma ieșită azi, până pui un venit sau un plic.")
              : t("Adaugă plicuri pentru a urmări cât mai rămâne în fiecare perioadă");
  const explainer = overPlan
    ? t("Planul este depășit: suma arată cât trebuie acoperit, nu bani disponibili pentru cheltuieli.")
    : brief.hasPayday
      ? rhythm.hasWeekly
        ? t("Este limita de azi din plicurile săptămânii. Ce n-are plic stă liber, nu mărește cifra.")
        : t("Reperul zilei este minimul dintre ritmul sigur ({daily}) și lichidul împărțit pe zile. Nu e un sold separat. În plicuri mai sunt {envelopes}; în surse {sources}.", { daily: money(daily), envelopes: money(envelopeTotalRemaining), sources: money(math.availableSources) })
      : data.settings.salaryPlan.allocations.length
        ? t("Este ce mai poți folosi din plicurile alocate. Reperul zilnic împarte suma pe cele {days} până la venit — nu e bani în plus, e ritmul ca să nu golești plicurile înainte.", { days: daysLabel(forecast.remainingDays) })
        : trackHero.kind === "liquid"
          ? t("Este soldul de pe card, cash sau bonuri, după ce ai înregistrat. Fără data venitului nu calculăm un ritm zilnic.")
          : t("Plicurile sunt sume puse deoparte pentru un scop, cum ar fi mâncare, transport sau facturi.");

  return (
    <div className={"bf-page bf-today-workspace" + (simpleMode ? " is-simple" : "")}>
      {simpleMode && (
        <aside className="bf-simple-mode-top-banner" role="status">
          <span>{t("Mod simplu activ — Dezactivează în Setări")}</span>
          <button type="button" onClick={onOpenSettings}>{t("Setări")}</button>
        </aside>
      )}
      <EnvelopeConflictBanner data={data} onChange={onChange} />
      <MovementConflictBanner data={data} onChange={onChange} />
      {!simpleMode && showTrancheNotice && activeTranche && (
        <aside className="bf-weekly-tranche-notice" role="status" aria-live="polite">
          <CalendarClock size={19} />
          <div>
            <p>{t("TRANȘA S{index} A ÎNCEPUT", { index: activeTranche.index })}</p>
            <strong>{formatDate(activeTranche.start, { day: "2-digit", month: "short" })} – {formatDate(activeTranche.end, { day: "2-digit", month: "short" })}</strong>
            <span>{t("Ritmul acestei tranșe este {amount} pentru {days} {dayLabel}.", { amount: money(activeTranche.amount), days: activeTranche.days, dayLabel: activeTranche.days === 1 ? t("zi") : t("zile") })}</span>
          </div>
          <button onClick={() => onGo("plan")}>{t("Plan")}</button>
          <button className="dismiss" aria-label={t("Ascunde alerta tranșei săptămânale")} onClick={() => setShownTrancheKey("")}><X size={16} /></button>
        </aside>
      )}
      {activeEnvelopeAlert && (
        <aside className={`bf-envelope-live-notice ${activeEnvelopeAlert.state}`} role="status" aria-live="polite">
          <BellRing size={19} />
          <div>
            <p>{activeEnvelopeAlert.state === "over" ? t("PLIC DEPĂȘIT") : t("APROAPE DE LIMITĂ")}</p>
            <strong>{activeEnvelopeAlert.item.label}</strong>
            <span>{activeEnvelopeAlert.state === "over" ? t("{amount} peste limita alocată.", { amount: money(Math.abs(activeEnvelopeAlert.remaining)) }) : t("{pct}% din limită este deja consumată.", { pct: Math.round(activeEnvelopeAlert.usage * 100) })}</span>
          </div>
          <button onClick={() => onGo("plan")}>{t("Vezi")}</button>
          <button className="dismiss" aria-label={t("Ascunde alerta pentru {label}", { label: activeEnvelopeAlert.item.label })} onClick={() => setDismissedAlerts((current) => [...current, activeEnvelopeAlert.item.id])}><X size={16} /></button>
        </aside>
      )}
      {data.pendingReview.length > 0 && (
        <aside className="bf-review-today-banner" role="status" aria-live="polite">
          <Inbox size={19} />
          <div>
            <p>{t("DE VERIFICAT")}</p>
            <strong>
              {data.pendingReview.length === 1
                ? t("De verificat: {title}", { title: data.pendingReview[0].transaction.title })
                : t("{count} propuneri de confirmat", { count: data.pendingReview.length })}
            </strong>
            <span>
              {data.pendingReview.length === 1
                ? t("{amount} · nu e încă în registru.", { amount: money(data.pendingReview[0].transaction.amount) })
                : t("Bonuri sau extras CSV așteaptă confirmarea înainte să intre în registru.")}
            </span>
          </div>
          <button type="button" onClick={onOpenReview}>{t("Deschide")}</button>
        </aside>
      )}

      <section className={`os-hero ${overPlan ? "is-risk" : ""}`}>
        <div className="os-hero-top">
          <span className="os-chip"><i /> {overPlan ? t("Plan de revizuit") : t("Ritm urmărit")}</span>
          <div className="os-date">
            <b>{String(new Date(`${todayIso}T12:00:00`).getDate()).padStart(2, "0")}</b>
            <span>{new Date(`${todayIso}T12:00:00`).toLocaleDateString(getLocale(), { month: "long" }).toLocaleUpperCase(getLocale())}</span>
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
            <button type="button" className="os-explainer secondary" onClick={() => window.dispatchEvent(new Event("buget-familie:open-usage-tutorial"))}>
              <BookOpen size={16} aria-hidden="true" /> {t("Cum se folosește")}
            </button>
          </div>
        ) : (
          <>
            <p className="os-kicker-lg">{heroLabel}</p>
            <h1 className="os-amount">
              <span>{(Number.isFinite(heroValue) ? heroValue : 0).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <small>RON</small>
            </h1>
            <p className="os-hint">{heroHint}</p>
            {(periodIncome > 0 || periodExpense > 0) && (
              <div className="bf-cycle-flow" aria-label={t("În ciclul ăsta")}>
                <span><small>{t("Intrat")}</small><b>+{money(periodIncome)}</b></span>
                <span><small>{t("Ieșit")}</small><b>−{money(periodExpense)}</b></span>
              </div>
            )}
            {!signals[0] && <p className="os-next-line">{t("Următoarea acțiune: înregistrează o mișcare.")}</p>}
          </>
        )}
        {!fresh && (
          <>
            <div className="bf-today-explainers">
            <button type="button" className="os-explainer" onClick={() => setSafeSheetOpen(true)}>
              <Info size={16} aria-hidden="true" /> {t("Cum se citește?")}
            </button>
            <button type="button" className="os-explainer secondary" onClick={() => window.dispatchEvent(new Event("buget-familie:open-usage-tutorial"))}>
              <BookOpen size={16} aria-hidden="true" /> {t("Cum se folosește")}
            </button>
            {!simpleMode && <button type="button" className="os-explainer secondary" onClick={() => setOpenHint((value) => !value)}>
              {t("Surse pe scurt")} <span>{openHint ? "−" : "+"}</span>
            </button>}
            </div>
            {!simpleMode && openHint ? (
              <div className="os-explainer-body bf-today-read-more">
                <p>{explainer}</p>
                {sourceRows.length > 0 && (
                  <ul className="bf-os-source-list compact">
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
                )}
                <p className="bf-os-note">{t("{available} disponibili după plicuri · {scheduled} în scadențe încă neconfirmate", { available: money(Math.max(0, math.remaining)), scheduled: money(math.scheduled) })}</p>
                {topEnvelope && <p className="bf-os-note">{t("Plic urmărit")}: {topEnvelope.item.label} · {Math.round(topEnvelope.usage * 100)}%</p>}
              </div>
            ) : null}
          </>
        )}
      </section>

      <div className="bf-os-actions">
        <button type="button" className="bf-today-add bf-os-decide" onPointerDown={() => void import("@/components/QuickEntryPanel")} onClick={onAdd}><Plus size={18} /> {t("Notează")}</button>
      </div>

      <OpeningBalanceCard data={data} onChange={onChange} />

      {!simpleMode && data.pendingReview.length === 0 && signals[0] && signals[0].id !== "daily-pace" && <NextStepCard signal={signals[0]} onOpen={() => signals[0] && openSignal(signals[0].action)} />}

      {/* Acțiuni scurte (scadențe / abonamente) — fără al doilea număr de decizie */}
      <TodayBrief data={data} onGo={onGo} onChange={onChange} hideSpendStamp simpleMode={simpleMode} onOpenWeek={simpleMode ? undefined : () => document.getElementById("bf-week-checkin")?.scrollIntoView({ behavior: "smooth", block: "start" })} />

      {!simpleMode && <DeferBelowFold>
        <section className="bf-os-rhythm" aria-label={t("Ritm zilnic")}>
          <div className="bf-os-rhythm-head">
            <div>
              <p className="bf-os-kicker">{t("Ritm zilnic")}</p>
              <h2 className="bf-os-title">{t("Cât mai ține ziua.")}</h2>
            </div>
            {!brief.hasPayday && (
              <p className="bf-os-note" style={{ margin: 0 }}>{t("azi")} <b>{money(rhythm.todayLeft)}</b></p>
            )}
          </div>
          {!rhythm.hasWeekly ? (
            <ChartEmpty title={t("Ritmul apare după plicuri săptămânale")} detail={t("Pune un plic cu ritm săptămânal în Plan — atunci zilele arată câți lei mai țin.")} />
          ) : (
            <>
              <div className="bf-os-rhythm-grid">
                {rhythm.days.map((row) => (
                  <button
                    key={row.day}
                    type="button"
                    className={`bf-os-day${row.isToday ? " is-today" : ""}${row.over ? " is-over" : ""}${row.isFuture ? " is-future" : ""}`}
                    aria-pressed={rhythmTip === row.day}
                    aria-label={t("{label}: {amount}", { label: weekdayShort()[row.weekday], amount: leiLabel(row.left) })}
                    onClick={() => setRhythmTip((current) => current === row.day ? null : row.day)}
                  >
                    <span>{weekdayShort()[row.weekday]}</span>
                    <b>{row.left >= 1000 ? `${Math.round(row.left / 1000)}k` : Math.round(row.left)}<small> lei</small></b>
                    <span className="bf-os-bar" aria-hidden="true"><i className={row.fill <= 0 ? "is-empty" : ""} style={{ height: `${row.fill}%` }} /></span>
                  </button>
                ))}
              </div>
              {(() => {
                const row = rhythm.days.find((item) => item.day === rhythmTip) || rhythm.days.find((item) => item.isToday);
                if (!row) return null;
                const when = row.isToday ? t("Azi · {amount} rămași", { amount: leiLabel(row.left) }) : row.isFuture ? t("Viitor · {amount} pe zi", { amount: leiLabel(row.left) }) : t("Trecut · {amount} rămași", { amount: leiLabel(row.left) });
                return <ChartTip><b>{weekdayShort()[row.weekday]}</b><span>{when}</span><span>{t("Cheltuieli {amount}", { amount: leiLabel(row.out) })}</span></ChartTip>;
              })()}
            </>
          )}
          <p className="bf-os-note">{rhythmNote}</p>
        </section>

        {!rhythm.hasWeekly && <TodayLedger data={data} onGo={(view) => onGo(view)} compact />}
        {(data.transactions.length > 0 || data.settings.members.length > 1 || data.settings.salaryPlan.allocations.length > 0) && (
          <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim bilanțul săptămânii…")}</div>}>
            <WeeklySummaryPanel data={data} onChange={onChange} onOpenJournal={() => onGo("journal")} onOpenPlan={() => onGo("plan")} />
          </Suspense>
        )}
        <div className="os-gauge bf-today-below-gauge">
          <HealthScoreBadge data={data} />
        </div>
        <section className="bf-today-activity">
          <div className="bf-section-heading">
            <div>
              <p className="bf-kicker">{data.settings.members.length > 1 ? t("FEED FAMILIE") : t("ACTIVITATE RECENTĂ")}</p>
              <h2>{data.settings.members.length > 1 ? t("Cine a mișcat banii") : t("Ce s-a înregistrat")}</h2>
            </div>
            <button onClick={() => onGo("journal")}>{t("Toate mișcările")} <ChevronRight size={15} /></button>
          </div>

            {data.settings.members.length > 1 && (() => {
          const activity = householdActivityInCycle(data);
          const sharers = activity.members.filter((item) => item.expense > 0 || item.income > 0);
          if (!sharers.length) return null;
          return (
              <ul className="bf-today-family-share" aria-label={t("Cine a mișcat banii în ciclu")}>
                {sharers.map((member) => (
                  <li key={member.memberId}>
                    <b>{member.name}</b>
                    <i><em style={{ width: `${Math.round(member.share * 100)}%` }} /></i>
                    <span>{Math.round(member.share * 100)}% · −{money(member.expense)}{member.income > 0 ? ` · +${money(member.income)}` : ""}</span>
                  </li>
                ))}
              </ul>
          );
        })()}
          {lastMoves.length ? (
            <div className="bf-today-activity-list">
              {lastMoves.map((item) => {
                const envelope = item.allocationId && item.allocationId !== "outside"
                  ? data.settings.salaryPlan.allocations.find((entry) => entry.id === item.allocationId)?.label
                  : item.allocationId === "outside"
                    ? t("în afara plicurilor")
                    : undefined;
                return (
                <article key={item.id} role="button" tabIndex={0} onClick={() => onEdit(item)} onKeyDown={(event) => { if (event.key === "Enter") onEdit(item); }}>
                  <span className={`bf-tx-icon ${item.kind}`}>{item.kind === "income" ? <ArrowDownRight size={16} /> : <CategoryGlyph category={item.category} size={16} />}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>{(() => {
                      const stamp = item.updatedAt || item.createdAt;
                      const ms = stamp ? Date.now() - Date.parse(stamp) : NaN;
                      const when = Number.isFinite(ms) && ms >= 0 && ms < 60_000
                        ? t("acum")
                        : Number.isFinite(ms) && ms < 3_600_000
                          ? t("acum {n} min", { n: String(Math.max(1, Math.round(ms / 60_000))) })
                          : Number.isFinite(ms) && ms < 86_400_000 && item.date === isoToday()
                            ? t("astăzi")
                            : dateText(item.date);
                      return `${when} · ${item.person} · ${t(item.category)}${envelope ? ` · ${envelope}` : ""}`;
                    })()}</small>
                  </div>
                  <strong className={item.kind}>{item.kind === "income" ? "+" : "−"}{fmtExact.format(item.amount)}</strong>
                </article>
                );
              })}
            </div>
          ) : (
            <button className="bf-today-empty-activity" onClick={onAdd}>
              <ReceiptText size={20} />
              <span><b>{t("Nicio mișcare azi.")}</b><small>{t("Notează prima cheltuială sau încasare.")}</small></span>
              <Plus size={18} />
            </button>
          )}
        </section>
      </DeferBelowFold>}
      {!simpleMode && data.settings.salaryPlan.allocations.length > 0 && (
        <DeferBelowFold>
          <section className="bf-today-envelope-evolution" aria-labelledby="today-envelope-evolution-title">
            <div className="bf-section-heading">
              <div>
                <p className="bf-kicker">{t("RITMUL PLICURILOR")}</p>
                <h2 id="today-envelope-evolution-title">{t("Evoluția în timp")}</h2>
              </div>
              <button onClick={() => onGo("plan")}>{t("Vezi istoricul")} <ChevronRight size={15} /></button>
            </div>
            <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim ritmul plicurilor…")}</div>}>
              <AllocationHistoryChart entries={allocationHistorySnapshot(data)} />
            </Suspense>
          </section>
        </DeferBelowFold>
      )}
      {safeSheetOpen && (
        <Suspense fallback={null}>
          <SafeSpendSheet data={data} onClose={() => setSafeSheetOpen(false)} onGoPlan={() => { setSafeSheetOpen(false); onGo("plan"); }} />
        </Suspense>
      )}

    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AppData>(readInitialAppData);
  const { storageNotice, setStorageNotice, storageReady, applyData } = usePersistAppData(data, setData);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(() => {
    try {
      if (window.localStorage.getItem("buget-familie:setup-complete")) return false;
      const seed = readInitialAppData();
      const hasStarted = seed.transactions.length > 0 || seed.settings.salaryPlan.allocations.length > 0 || seed.debts.length > 0 || seed.savings.length > 0 || seed.settings.paymentSources.some((source) => source.openingBalance > 0) || Boolean(seed.settings.salaryPlan.nextPayday);
      return !hasStarted;
    } catch {
      return false;
    }
  });
  const { simpleMode, setSimpleMode: setSimpleModePref } = useSimpleMode();
  useLayoutEffect(() => {
    hideNativeSplash();
    syncAndroidChrome();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.simpleMode = simpleMode ? "1" : "0";
    return () => { delete document.documentElement.dataset.simpleMode; };
  }, [simpleMode]);
  useLanguage();
  const [view, setView] = useState<MainView>(initialMainView);
  const initialViewRef = useRef(view);
  const [more, setMore] = useState<MoreView>("overview");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [guideOn, setGuideOn] = useState(false);
  const [modal, setModal] = useState<"quick" | "transaction" | "receipt" | "debt" | "saving" | "debt-payment" | null>(null);
  const [quickTemplateId, setQuickTemplateId] = useState<string | undefined>(undefined);
  const [editTx, setEditTx] = useState<Transaction>();
  const [editGoal, setEditGoal] = useState<Debt | SavingsGoal>();
  const [receiptStorageNotice, setReceiptStorageNotice] = useState("");
  const legacyReceiptMigrationStarted = useRef(false);
  const setupOffered = useRef(setupOpen);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false); const [firstWeekTourOpen, setFirstWeekTourOpen] = useState(false);
  const {
    themePickerOpen, setThemePickerOpen,
    theme, setTheme,
    themeSchedule, setThemeSchedule,
    background, setBackground,
    highContrast, setHighContrast,
    scheduleTimes, setScheduleTimes,
  } = useThemeChrome();

  useEffect(() => {
    if (!storageReady) return;
    const win = window as Window & { requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number; cancelIdleCallback?: (id: number) => void };
    const run = () => { void import("@/lib/local-notifications").then((module) => module.scheduleFinancialReminders(data)); };
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(run, { timeout: 4000 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 1200);
    return () => window.clearTimeout(id);
  }, [data, storageReady]);
  useEffect(() => { if (legacyReceiptMigrationStarted.current || !data.receipts.some((receipt) => (receipt.imageData || receipt.imageData2) && !receipt.imageKeys?.length)) return; legacyReceiptMigrationStarted.current = true; void migrateLegacyReceiptImages(data.receipts).then((migrated) => { if (!migrated.size) return; setData((current) => ({ ...current, receipts: current.receipts.map((receipt) => { const imageKeys = migrated.get(receipt.id); return imageKeys ? { ...receipt, imageKeys, imageData: undefined, imageData2: undefined } : receipt; }) })); setReceiptStorageNotice(`${migrated.size} bon${migrated.size === 1 ? " a fost mutat" : "uri au fost mutate"} în stocarea locală a telefonului.`); }).catch((reason) => setReceiptStorageNotice(reason instanceof Error ? reason.message : t("Nu am putut muta fotografiile vechi ale bonurilor; acestea nu au fost șterse."))); }, [data.receipts]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [view, more]); useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setQuickActionsOpen((open) => !open); } if (event.key === "Escape") setQuickActionsOpen(false); }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []); useEffect(() => { const replay = () => setOnboardingOpen(true); const replaySetup = () => setSetupOpen(true); const openTutorial = () => { setMore("guide"); go("utilities"); }; window.addEventListener("buget-familie:replay-onboarding", replay); window.addEventListener("buget-familie:replay-setup", replaySetup); window.addEventListener("buget-familie:open-usage-tutorial", openTutorial); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0) || Boolean(data.settings.salaryPlan.nextPayday); if (hasStarted && !window.localStorage.getItem("buget-familie:setup-complete")) safeSetItem(window.localStorage, "buget-familie:setup-complete", "true"); if (storageReady && !window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted && !setupOffered.current) { setupOffered.current = true; safeSetItem(window.localStorage, "buget-familie:onboarding-complete", "true"); setSetupOpen(true); } return () => { window.removeEventListener("buget-familie:replay-onboarding", replay); window.removeEventListener("buget-familie:replay-setup", replaySetup); window.removeEventListener("buget-familie:open-usage-tutorial", openTutorial); }; }, [storageReady, data.transactions.length, data.settings.salaryPlan.allocations.length, data.debts.length, data.savings.length, data.settings.paymentSources, data.settings.salaryPlan.nextPayday]);
  useEffect(() => {
    if (!storageReady || onboardingOpen || setupOpen) return;
    const started = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0;
    if (shouldOfferFirstWeekTour({
      storage: window.localStorage,
      blocked: Boolean(modal) || more === "sync",
      hasModal: Boolean(modal),
      onSyncScreen: more === "sync",
      hasStarted: started,
    })) {
      setFirstWeekTourOpen(true);
      return;
    }
    if (shouldShowWhatsNew(window.localStorage) && !modal && more !== "sync" && started) setWhatsNewOpen(true);
  }, [storageReady, onboardingOpen, setupOpen, modal, more, data.transactions.length, data.settings.salaryPlan.allocations.length]);
  const dismissWhatsNew = () => { markWhatsNewSeen(window.localStorage); setWhatsNewOpen(false); };
  const dismissFirstWeekTour = () => { markFirstWeekTourSeen(window.localStorage); setFirstWeekTourOpen(false); };

  const update = (fn: (current: AppData) => AppData) => applyData((current) => fn(current));
  useEffect(() => {
    if (!storageReady) return;
    applyData((current) => adoptOutsideExpenses(current));
  }, [storageReady, applyData]);

  const { undo, setUndo, runUndo, deleteWithUndo } = useUndo(data, setData);
  const go = (next: MainView) => { preloadView(next); startTransition(() => setView(next)); };
  useEffect(() => {
    if (view !== "today" || modal) void ensureDeferredStyles();
  }, [view, modal]);
  useEffect(() => {
    const openCatalog = (event: Event) => {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query || "";
      try {
        if (query) sessionStorage.setItem("buget-familie:catalog-query", query);
        else sessionStorage.removeItem("buget-familie:catalog-query");
      } catch { /* ignore */ }
      setMore("catalog");
      go("utilities");
    };
    window.addEventListener("buget-familie:open-catalog", openCatalog);
    return () => window.removeEventListener("buget-familie:open-catalog", openCatalog);
  }, []);
  useEffect(() => {
    const openFamilie = () => {
      setMore("settings");
      go("utilities");
      window.setTimeout(() => document.getElementById("bf-familie-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    };
    window.addEventListener(FAMILIE_OPEN_EVENT, openFamilie);
    return () => window.removeEventListener(FAMILIE_OPEN_EVENT, openFamilie);
  }, []);
  useEffect(() => {
    const onOpenGuide = () => setGuideOn(true);
    window.addEventListener("buget-familie:open-guide", onOpenGuide);
    return () => window.removeEventListener("buget-familie:open-guide", onOpenGuide);
  }, []);
  useEffect(() => {
    const skip = document.querySelector(".bf-skip-link");
    if (skip instanceof HTMLElement && skip === document.activeElement) skip.blur();
  }, []);

  const { syncPanelProps, setSyncPassword, setSyncPasswordReveal } = useFamilySync(data, setData);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => { const applySettings = (event: Event) => { const patch = (event as CustomEvent<Partial<AppData["settings"]>>).detail; if (!patch) return; applyData((current) => ({ ...current, settings: { ...current.settings, ...patch } })); }; window.addEventListener("buget-familie:local-settings", applySettings); return () => window.removeEventListener("buget-familie:local-settings", applySettings); }, []);
  const saveTx = (item: Transaction | Transaction[], meta?: { fromWeekIndex?: number }) => {
    let failed: Error | undefined;
    update((current) => {
      try {
        const list = Array.isArray(item) ? item : [item];
        return list.reduce((ledger, entry) => commitLedgerEntry(ledger, entry, meta?.fromWeekIndex), current);
      } catch (reason) {
        failed = reason instanceof Error ? reason : new Error(t("Nu am putut salva mișcarea."));
        return current;
      }
    });
    if (failed) throw failed;
  };
  const applyFinancialUpdate = (change: FinancialUpdate) => update((current) => { const member = current.settings.members.find((item) => "memberId" in change && change.memberId && item.id === change.memberId) || current.settings.members[0]; const source = current.settings.paymentSources.find((item) => item.memberId && member && item.memberId === member.id) || current.settings.paymentSources[0]; const now = new Date().toISOString(); if (change.kind === "income" && member && source) { const incomeCaptureId = ("clientCaptureId" in change && change.clientCaptureId) || newId("guided-income"); if (current.transactions.some((item) => item.id === incomeCaptureId || (item.kind === "income" && item.amount === change.amount && item.title === change.title && item.date === (change.date || isoToday())))) return current; const transaction: Transaction = { id: incomeCaptureId, title: change.title, amount: change.amount, kind: "income", category: "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: change.date || isoToday(), note: t("Venit adăugat împreună cu ghidul AI"), createdAt: now }; return { ...current, transactions: [transaction, ...current.transactions] }; } if (change.kind === "debt") { const key = change.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const existingIndex = current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key); const nextDebt: Debt = { id: existingIndex >= 0 ? current.debts[existingIndex].id : newId("guided-debt"), name: change.name, remaining: change.remaining, monthly: existingIndex >= 0 ? current.debts[existingIndex].monthly : 0, due: change.due || (existingIndex >= 0 ? current.debts[existingIndex].due : "Nespecificat"), memberId: member?.id, tone: existingIndex >= 0 ? current.debts[existingIndex].tone : "coral", updatedAt: now }; const debts = existingIndex >= 0 ? current.debts.map((item, index) => index === existingIndex ? nextDebt : item) : [nextDebt, ...current.debts]; return { ...current, debts }; } if (change.kind === "debt-monthly") { const key = change.name?.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const index = key ? current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key) : 0; if (index < 0) return current; return { ...current, debts: current.debts.map((item, itemIndex) => itemIndex === index ? { ...item, monthly: change.amount, updatedAt: now } : item) }; } if (change.kind === "expense" && member && source) { const day = change.date || isoToday(); const usedSource = current.settings.paymentSources.find((item) => item.id === change.sourceId) || source; const usedMember = current.settings.members.find((item) => item.id === change.memberId) || member; const expenseCaptureId = change.clientCaptureId || newId("guided-expense"); if (current.transactions.some((item) => item.id === expenseCaptureId)) return current; if (change.recurringId && current.transactions.some((item) => item.recurringId === change.recurringId && inPlanPeriod(item.date, current.settings.salaryPlan))) return current; const transaction: Transaction = { id: expenseCaptureId, title: change.title, amount: change.amount, kind: "expense", category: change.category, sourceId: usedSource.id, source: usedSource.name, memberId: usedMember.id, person: usedMember.name, date: day, allocationId: change.allocationId || "outside", recurringId: change.recurringId, note: change.recurringId ? t("Plată recurentă confirmată") : t("Cheltuială adăugată împreună cu ghidul AI"), createdAt: now }; try { const next = commitLedgerEntry(current, transaction, change.fromWeekIndex); if (change.kind === "expense" && change.receiptDraft?.items?.length) { const receipt: Receipt = { id: newId("guided-receipt"), vendor: change.receiptDraft.vendor || change.title, amount: change.amount, category: change.category, date: day, sourceId: usedSource.id, memberId: usedMember.id, linkedTransactionId: transaction.id, note: t("Bon citit de ghid — produsele sunt în rubrica Bonuri."), lines: change.receiptDraft.items.map((item, index) => ({ id: `guided-line-${index}`, category: item.category, amount: item.amount, label: item.label })), updatedAt: now }; return { ...next, receipts: [receipt, ...next.receipts] }; } return next; } catch { return current; } } if (change.kind === "transfer") return transferBetweenEnvelopes(current, { fromAllocationId: change.fromId, toAllocationId: change.toId, amount: change.amount, note: t("Realocare din ghidul AI") }) || current; if (change.kind === "recurring") {
      const source = current.settings.paymentSources.find((item) => item.memberId === member?.id) || current.settings.paymentSources[0];
      if (!source || !member) return current;
      const item = { id: newId("recurring"), name: change.name, amount: change.amount, category: change.category, sourceId: source.id, memberId: member.id, dueDay: Math.min(31, Math.max(1, change.dueDay)), active: true, autoPost: false, updatedAt: now };
      return { ...current, recurring: [...current.recurring, item] };
    }
    /**
     * Ștergerea și corectarea cerute prin asistent. Rândul pleacă din registru cu
     * piatră de mormânt, ca sincronizarea între telefoane să nu-l readucă înapoi.
     */
    if (change.kind === "delete-transaction") {
      const removed = current.transactions.find((item) => item.id === change.id);
      if (!removed) return current;
      const now = new Date().toISOString();
      return {
        ...current,
        transactions: current.transactions.filter((item) => item.id !== change.id),
        deleted: [...current.deleted, { entity: "transactions" as const, id: change.id, deletedAt: now }].slice(-500),
      };
    }
    if (change.kind === "amend-transaction") {
      if (!current.transactions.some((item) => item.id === change.id)) return current;
      const now = new Date().toISOString();
      return {
        ...current,
        transactions: current.transactions.map((item) => item.id === change.id ? { ...item, amount: change.amount, updatedAt: now } : item),
      };
    }
    if (change.kind === "goal") {
      const goal: SavingsGoal = { id: newId("goal"), name: change.name, current: change.current || 0, target: change.target, due: change.dueDate ? formatDate(change.dueDate, { day: "2-digit", month: "long", year: "numeric" }) : t("Fără termen"), dueDate: change.dueDate, memberId: member?.id, tone: "honey", updatedAt: now };
      return { ...current, savings: [goal, ...current.savings] };
    }
    /**
     * Evenimentul cerut prin asistent intră în aceeași listă ca cel scris de mână.
     * Același nume la aceeași dată nu se dublează: „notează Crăciunul” spus de două
     * ori într-o conversație ar fi făcut două fonduri pentru aceeași zi.
     */
    if (change.kind === "planned-event") {
      const key = change.name.toLocaleLowerCase("ro-RO").trim();
      const events = current.settings.plannedEvents;
      const existing = events.find((item) => item.name.toLocaleLowerCase("ro-RO").trim() === key && item.date === change.date);
      const next = existing
        ? events.map((item) => item.id === existing.id ? { ...item, estimate: change.estimate || item.estimate, repeat: change.repeat, updatedAt: now } : item)
        : [...events, { id: newId("planned-event"), name: change.name, date: change.date, estimate: change.estimate, repeat: change.repeat, memberId: member?.id, updatedAt: now, ...eventTraits(change.name, isoToday()) }];
      return { ...current, settings: { ...current.settings, plannedEvents: next } };
    }
    /**
     * O regulă de magazin cerută prin asistent: „de fiecare dată când scriu Lidl, pune-l pe
     * Alimente”. Regula nu scrie nimic singură — la următoarea cheltuială propune, iar omul
     * confirmă. Același text nu se dublează: se actualizează regula existentă.
     */
    if (change.kind === "merchant-rule") {
      const rules = current.settings.merchantRules || [];
      const key = change.match.toLocaleLowerCase("ro-RO").trim();
      const existing = rules.find((item) => item.match.toLocaleLowerCase("ro-RO").trim() === key);
      const next = existing
        ? rules.map((item) => item.id === existing.id ? { ...item, category: change.category || item.category, allocationId: change.allocationId || item.allocationId, updatedAt: now } : item)
        : [...rules, { id: newId("merchant-rule"), match: change.match, category: change.category, allocationId: change.allocationId, updatedAt: now }];
      return { ...current, settings: { ...current.settings, merchantRules: next.slice(0, 60) } };
    }
    /**
     * Repartizarea automată a venitului: „din fiecare salariu pune 20% la economii”. Se
     * aplică la venitul următor, nu la banii de acum — de aceea nu atinge nimic aici.
     */
    if (change.kind === "salary-rule") {
      const plan = current.settings.salaryPlan;
      if (!plan.allocations.some((item) => item.id === change.allocationId)) return current;
      const rules = plan.salaryAllocationRules || [];
      const existing = rules.find((item) => item.allocationId === change.allocationId && item.mode === change.mode);
      const next = existing
        ? rules.map((item) => item.id === existing.id ? { ...item, label: change.label, value: change.value, active: true, updatedAt: now } : item)
        : [...rules, { id: newId("salary-rule"), label: change.label, allocationId: change.allocationId, mode: change.mode, value: change.value, active: true, updatedAt: now }];
      return { ...current, settings: { ...current.settings, salaryPlan: { ...plan, salaryAllocationRules: next.slice(0, 24), updatedAt: now } } };
    }
    /**
     * Bani puși deoparte pentru un eveniment, cerut prin asistent. Nu e transfer și nu e
     * cheltuială: surse și registru rămân neatinse, se schimbă doar cât s-a strâns pentru
     * ziua aceea din calendar. Un eveniment care nu există nu se creează aici — asistentul
     * cere întâi să fie notat.
     */
    if (change.kind === "event-contribution") {
      const events = current.settings.plannedEvents;
      const target = events.find((item) => item.id === change.eventId);
      if (!target) return current;
      return {
        ...current,
        settings: {
          ...current.settings,
          plannedEvents: events.map((item) => item.id === target.id ? addContribution(item, change.amount, change.date, t("Pus deoparte din ghidul AI")) : item),
        },
      };
    }
    /**
     * Ștergerea unui plic cerută prin asistent. Banii nu dispar: suma plicului se întoarce
     * în nerepartizat, fiindcă „liberul” se calculează din surse minus plicuri. Un nume care
     * nu se potrivește cu niciun plic nu șterge nimic — mai bine nimic decât altceva.
     */
    /**
     * „Am un buget de 1800.” Banii nu sunt un venit de azi și nu sunt o cheltuială: sunt
     * soldul din care se face planul. Îl punem pe sursă astfel încât soldul curent să fie
     * chiar suma spusă — dacă există deja mișcări, ele rămân la locul lor și se scade doar
     * diferența, ca registrul să nu mintă în niciun sens.
     */
    /**
     * „Am un buget de 1850.” Banii ajungeau doar în soldul de pornire al sursei, deci omul
     * îi vedea în Plan, dar nu-i găsea nicăieri în Mișcări — iar o intrare de bani pe care
     * n-o vezi în registru pare pierdută. Acum se scrie diferența dintre cât spune el că
     * are și cât vede aplicația, ca mișcare adevărată, cu ziua ei.
     *
     * Soldul iese la fel ca înainte, fiindcă tot diferența se adaugă. Spus de două ori,
     * al doilea mesaj nu mai scrie nimic: diferența e zero.
     */
    if (change.kind === "funds") {
      const sources = current.settings.paymentSources;
      const target = sources.find((item) => item.id === change.sourceId)
        || (change.sourceHint ? sources.find((item) => item.kind === change.sourceHint) : undefined)
        || sources[0];
      // Aceeași scriere ca la verificarea soldului: diferența intră în registru, nu pe ascuns.
      return target ? applyDeclaredBalance(current, target.id, change.amount, change.date || isoToday()) : current;
    }
    if (change.kind === "allocation-delete") {
      const plan = current.settings.salaryPlan;
      const target = plan.allocations.find((item) => item.label === change.label || item.category === change.label);
      if (!target) return current;
      return {
        ...current,
        settings: {
          ...current.settings,
          salaryPlan: {
            ...plan,
            allocations: plan.allocations.filter((item) => item.id !== target.id),
            transfers: (plan.transfers || []).filter((item) => item.fromAllocationId !== target.id && item.toAllocationId !== target.id),
            weekTransfers: (plan.weekTransfers || []).filter((item) => item.allocationId !== target.id),
            updatedAt: now,
          },
        },
      };
    }
    if (change.kind === "payday") {
      // Data cerută devine reperul planului; fereastra spune cât poate întârzia salariul.
      const plan = current.settings.salaryPlan;
      const earliest = addIsoDays(change.date, 0);
      return { ...current, settings: { ...current.settings, salaryPlan: { ...plan, nextPayday: change.date, earliestPayday: earliest >= plan.periodStart ? earliest : plan.periodStart, paydayFlexDays: change.flexDays, updatedAt: now } } };
    }
    if (change.kind !== "allocation") return current;
    const labels: Record<string, string> = { Alimente: "Alimente", Facturi: "Casă & facturi", Transport: "Transport", Economii: "Economii", Datorii: "Rate produse" };
    const label = change.label || labels[change.category] || change.category;
    const existing = current.settings.salaryPlan.allocations.find((item) => item.label === label || item.category === label || (change.category && item.category === change.category));
    const weeklyPace = change.weekly ? undefined : false;
    const plan = current.settings.salaryPlan;
    const start = plan.periodStart || isoToday();
    const weeks = change.weeks && change.weeks >= 2 ? change.weeks : 4;
    const fallbackPayday = new Date(`${start}T12:00:00`); fallbackPayday.setDate(fallbackPayday.getDate() + weeks * 7 - 1);
    const spokenPayday = "payday" in change && change.payday && change.payday >= start ? change.payday : undefined;
    const nextPayday = spokenPayday || plan.nextPayday || isoDate(fallbackPayday);
    const flex = plan.paydayFlexDays ?? 3;
    const earliest = new Date(`${nextPayday}T12:00:00`); earliest.setDate(earliest.getDate() - flex);
    const earliestIso = isoDate(earliest);
    const earliestPayday = earliestIso < start ? start : earliestIso;
    /**
     * „Fă-mi plic Alimente cu 600 pe săptămână” spune un ritm, nu un total. Cât înseamnă în
     * bani se poate afla abia după ce se știe perioada, așa că suma se calculează aici, pe
     * zilele rămase până la venit — nu pe cele 26 din calendar, dintre care unele au trecut.
     */
    const withPeriod = { ...current, settings: { ...current.settings, salaryPlan: { ...plan, periodStart: start, nextPayday, earliestPayday, paydayFlexDays: flex } } };
    /**
     * „Mărește plicul de alimente cu 200” cere 1.100 peste 900, nu 200. Fără sensul ăsta,
     * ajustarea înlocuia suma și tăia 700 de lei din plic fără ca nimic să spună asta.
     * Scăderea nu trece sub zero, iar un plic care încă nu există primește suma spusă.
     */
    const paced = (change.amountIsWeekly ? totalForWeeklyPace(withPeriod, change.amount) : undefined) ?? change.amount;
    const amount = change.delta && existing
      ? Math.max(0, Math.round(((change.delta === "increase" ? existing.amount + change.amount : existing.amount - change.amount)) * 100) / 100)
      : paced;
    // O ajustare nu atinge ritmul plicului: rămâne cum l-a pus omul.
    const nextAllocation = existing ? { ...existing, amount, weeklyPace: change.delta ? existing.weeklyPace : weeklyPace, category: label, updatedAt: now } : { id: newId("guided-allocation"), label, category: label, amount, weeklyPace, memberId: member?.id, sourceId: source?.id };
    const allocations = existing ? current.settings.salaryPlan.allocations.map((item) => item.id === existing.id ? nextAllocation : item) : [...current.settings.salaryPlan.allocations, nextAllocation];
    const weeklyLimit = change.weeklyAmount || plan.weeklyLimit || (change.weekly ? Math.round((amount / weeks) * 100) / 100 : plan.weeklyLimit);
    const saved = { ...current, settings: { ...current.settings, salaryPlan: { ...plan, periodStart: start, nextPayday, earliestPayday, paydayFlexDays: flex, weeklyLimit, sourceIds: plan.sourceIds.length ? plan.sourceIds : source ? [source.id] : plan.sourceIds, allocations, updatedAt: now } } };
    /**
     * Aceeași regulă ca pe ecranul Plan: dacă săptămâna e deja începută, tranșa curentă
     * păstrează doar partea zilelor rămase, iar restul pleacă în săptămânile următoare.
     * Nu face nimic pentru un plic fără ritm săptămânal sau pentru o perioadă neîncepută.
     */
    return levelStartedWeek(saved, nextAllocation.id);
  });
  const revertGuided = (item: GuidedRevert) => update((current) => {
    const index = current.transactions.findIndex((entry) => entry.kind === item.kind && entry.title === item.title && entry.amount === item.amount && entry.date === item.date && (entry.note || "").includes("ghidul AI"));
    if (index < 0) return current;
    const removed = current.transactions[index];
    const now = new Date().toISOString();
    return {
      ...current,
      transactions: current.transactions.filter((_, position) => position !== index),
      deleted: [...current.deleted, { entity: "transactions" as const, id: removed.id, deletedAt: now }].slice(-500),
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
  const saveReceipt = (item: Receipt) => update((current) => queueReceiptForReview(current, item));
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
        next: { ...current, receipts: current.receipts.filter((item) => item.id !== id), transactions: current.transactions.filter((item) => !linked.includes(item.id) && item.receiptId !== id), pendingReview: current.pendingReview.filter((draft) => draft.transaction.receiptId !== id && !linked.includes(draft.transaction.id)), deleted: [...current.deleted, { entity: "receipts" as const, id, deletedAt: now }, ...linked.map((transactionId) => ({ entity: "transactions" as const, id: transactionId, deletedAt: now }))].slice(-500) },
        removed: { receipts: currentReceipt ? [{ ...currentReceipt, imageKeys: undefined }] : [], transactions: removedTransactions },
      };
    });
  };
  const openTx = (item?: Transaction) => { setEditTx(item); setModal(item ? "transaction" : "quick"); };
  // Widgetul și dala din Setări rapide deschid direct ecranul cerut, fără pași intermediari.
  useEffect(() => observeQuickActions((action) => {
    if (action === "receipt") { setModal("receipt"); return; }
    if (action === "expense") { setQuickTemplateId(undefined); setEditTx(undefined); setModal("quick"); return; }
    if (typeof action === "object" && action.kind === "template") {
      setQuickTemplateId(action.templateId);
      setEditTx(undefined);
      setModal("quick");
      return;
    }
    go("today");
  }), []);
  useEffect(() => {
    const expense = data.settings.quickTemplates.filter((item) => item.kind !== "income").slice(0, 3);
    publishWidgetTemplates(expense.map((item) => ({ id: item.id, label: item.label })));
  }, [data.settings.quickTemplates]);
  const allNav = [{ id: "today" as MainView, label: t("Astăzi"), icon: LayoutGrid }, { id: "journal" as MainView, label: t("Mișcări"), icon: ListFilter }, { id: "plan" as MainView, label: t("Plan"), icon: PlayCircle }, { id: "obligations" as MainView, label: t("Obligații"), icon: Bell }, { id: "insights" as MainView, label: t("Analiză"), icon: BarChart3 }];
  const nav = simpleMode ? allNav.filter((item) => item.id === "today" || item.id === "journal" || item.id === "plan" || item.id === "obligations") : allNav;
  useEffect(() => {
    if (!simpleMode) return;
    if (view === "insights" || view === "habits" || view === "goals" || view === "calendar") go("today");
  }, [simpleMode, view]);
  const current = () => { if (view === "journal") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim mișcările…")}</div>}><MovementsJournal data={data} onChange={applyData} onAdd={() => openTx()} onEdit={openTx} onOpenReview={() => { setMore("review"); go("utilities"); }} onDelete={(id) => deleteWithUndo(t("Mișcarea a fost ștearsă."), (currentData) => ({
      next: { ...currentData, transactions: currentData.transactions.filter((item) => item.id !== id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId !== id), deleted: [...currentData.deleted, { entity: "transactions" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { transactions: currentData.transactions.filter((item) => item.id === id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId === id) },
    }))} /></Suspense>; if (view === "plan")
 return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim planul…")}</div>}><PlanStudio data={data} onChange={applyData} simpleMode={simpleMode} /></Suspense>; if (view === "habits") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obiceiurile…")}</div>}><SpendingHabitsView data={data} /></Suspense>; if (view === "calendar") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim calendarul…")}</div>}><FinancialCalendarView data={data} onOpenEvents={() => { setMore("events"); go("utilities"); }} /></Suspense>; if (view === "goals") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obiectivele…")}</div>}><LongTermGoalsView data={data} onOpen={() => { setEditGoal(undefined); setModal("saving"); }} onEdit={(item) => { setEditGoal(item); setModal("saving"); }} onDelete={(id) => deleteWithUndo(t("Obiectivul a fost șters."), (currentData) => ({
      next: { ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { savings: currentData.savings.filter((item) => item.id === id) },
    }))} /></Suspense>; if (view === "obligations") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obligațiile…")}</div>}><ObjectivesView data={data} onEditDebt={(item) => { setEditGoal(item); setModal("debt"); }} onEditSaving={(item) => { setEditGoal(item); setModal("saving"); }} onPayDebt={(item) => { setEditGoal(item); setModal("debt-payment"); }} onDeleteDebt={(id) => deleteWithUndo(t("Datoria a fost ștearsă."), (currentData) => ({
      next: { ...currentData, debts: currentData.debts.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "debts" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { debts: currentData.debts.filter((item) => item.id === id) },
    }))} onDeleteSaving={(id) => deleteWithUndo(t("Obiectivul a fost șters."), (currentData) => ({
      next: { ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { savings: currentData.savings.filter((item) => item.id === id) },
    }))} openDebt={() => { setEditGoal(undefined); setModal("debt"); }} openSaving={() => { setEditGoal(undefined); setModal("saving"); }} onOpenGoals={() => go("goals")} onOpenCalendar={() => go("calendar")} onOpenEvents={() => { setMore("events"); go("utilities"); }} onOpenAssistant={() => { setMore("assistant"); go("utilities"); }} onOpenRecurring={() => { setMore("recurring"); go("utilities"); }} onPayRecurring={(id) => update((currentData) => confirmRecurringPayment(currentData, id) || currentData)} /></Suspense>; if (view === "insights") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim analiza…")}</div>}><InsightsView data={data} onChange={applyData} onGo={go} /></Suspense>; if (view === "utilities") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim instrumentele…")}</div>}><MoreViewScreen tab={more} setTab={setMore} data={data} onChange={applyData} onAddReceipt={() => setModal("receipt")} onSaveReceipt={saveReceipt} onDeleteReceipt={deleteReceipt} onOpenDebt={() => { setEditGoal(undefined); setModal("debt"); }} onOpenSaving={() => { setEditGoal(undefined); setModal("saving"); }} onEditDebt={(item) => { setEditGoal(item); setModal("debt"); }} onEditSaving={(item) => { setEditGoal(item); setModal("saving"); }} onPayDebt={(item) => { setEditGoal(item); setModal("debt-payment"); }} onOpenCalendar={() => go("calendar")} onGo={go} receiptStorageNotice={receiptStorageNotice} sync={syncPanelProps} /></Suspense>; return <TodayView data={data} onAdd={() => openTx()} onEdit={openTx} onGo={go} onChange={applyData} onOpenReview={() => { setMore("review"); go("utilities"); }} onOpenSettings={() => { setMore("settings"); go("utilities"); }} onOpenRecurring={() => { setMore("recurring"); go("utilities"); }} />; };
  return <div className={"bf-app os-shell" + (setupOpen || onboardingOpen ? " is-setup" : "")}>
    <a className="bf-skip-link" href="#main-content">{t("Sari la conținut")}</a>
    {storageNotice && <div className="bf-storage-notice" role="status"><ShieldCheck size={15} /><span>{storageNotice}</span><button type="button" aria-label={t("Închide notificarea")} onClick={() => setStorageNotice(null)}><X size={14} /></button></div>}
    {!online && <div className="bf-offline-banner" role="status" aria-live="polite"><CloudOff size={15} aria-hidden="true" /><span>{syncPanelProps.connected ? t("Fără conexiune — modificările rămân pe telefon și se trimit la reconectare.") : t("Fără conexiune — lucrezi local pe acest telefon.")}</span></div>}
    {simpleMode && view !== "today" && <div className="bf-simple-mode-top-banner" role="status"><span>{t("Mod simplu activ — Dezactivează în Setări")}</span><button type="button" onClick={() => { setSimpleModePref(false); setMore("settings"); go("utilities"); }}>{t("Dezactivează")}</button></div>}
    <header className="bf-appbar os-appbar"><button className="os-brand" onClick={() => go("today")}><BrandMark /><span className="os-brand-copy"><b>Buget</b><i>Familie</i></span></button><nav className="os-desktop-nav" aria-label={t("Navigație principală")}>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerEnter={() => preloadView(item.id)} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={17} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav><div className="os-tools"><button className="os-tool" aria-label={t("Deschide acțiunile rapide")} title={t("Acțiuni rapide · Ctrl K")} onPointerDown={() => void loadSecondary()} onClick={() => setQuickActionsOpen(true)}><Search size={17} /></button><button className={view === "utilities" ? "os-tool is-on" : "os-tool"} aria-label={data.pendingReview.length ? t("Deschide instrumentele · {count} de verificat", { count: data.pendingReview.length }) : t("Deschide instrumentele")} onPointerDown={() => preloadView("utilities")} onClick={() => go("utilities")}><MoreHorizontal size={19} />{data.pendingReview.length > 0 && <span className="bf-nav-count" aria-hidden="true">{data.pendingReview.length}</span>}</button><button className="os-tool" aria-label={t("Deschide ghidul")} onClick={openHouseholdGuide}><MessagesSquare size={17} /></button></div></header>
    <main id="main-content" key={view} className={setupOpen || onboardingOpen || view === initialViewRef.current ? undefined : "bf-screen-transition"}>{setupOpen ? null : current()}</main>
    {undo && (
      <div className="bf-undo-bar" role="status" aria-live="polite">
        <span>{undo.label}</span>
        <button type="button" onClick={runUndo}><RotateCcw size={15} aria-hidden="true" /> {t("Anulează")}</button>
        <button type="button" className="bf-undo-close" aria-label={t("Închide")} onClick={() => setUndo(null)}><X size={16} /></button>
      </div>
    )}

    {data.pendingReview.length > 0 && <button type="button" className="bf-dock-review-badge" onClick={() => { setMore("review"); go("utilities"); }} aria-label={t("Deschide De verificat · {count}", { count: data.pendingReview.length })}><Inbox size={15} /> {t("De verificat")} · {data.pendingReview.length}</button>}
    {!setupOpen && !onboardingOpen && !modal && <button type="button" className="bf-dock-plus" aria-label={t("Notează")} onPointerDown={() => void import("@/components/QuickEntryPanel")} onClick={() => openTx()}><Plus size={22} aria-hidden="true" /></button>}
    <div className="os-nav-fill" aria-hidden="true" />
    <nav className="os-dock" aria-label={t("Navigație mobilă")}>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={16} aria-hidden="true" /><span>{item.label}</span>{item.id === "journal" && data.pendingReview.length > 0 ? <i className="bf-dock-dot" aria-hidden="true" /> : null}</button>; })}</nav>
    {!simpleMode && guideOn && <Suspense fallback={null}><AICompanion initiallyOpen data={data} view={view} onAdd={() => openTx()} onGo={go} onNaturalEntry={openNaturalDraft} onFinancialUpdate={applyFinancialUpdate} onRevert={revertGuided} /></Suspense>}
    {themePickerOpen && <Suspense fallback={null}><ThemePicker theme={theme} schedule={themeSchedule} scheduleTimes={scheduleTimes} highContrast={highContrast} background={background} onChange={setTheme} onScheduleChange={setThemeSchedule} onScheduleTimesChange={setScheduleTimes} onContrastChange={setHighContrast} onBackgroundChange={setBackground} onClose={() => setThemePickerOpen(false)} /></Suspense>} {quickActionsOpen && <Suspense fallback={null}><QuickActionsPalette data={data} onClose={() => setQuickActionsOpen(false)} onAdd={() => openTx()} onGo={go} /></Suspense>} {onboardingOpen && <Suspense fallback={null}><CalmOnboarding onClose={() => { setOnboardingOpen(false); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0); if (!window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted) setSetupOpen(true); }} onAdd={() => openTx()} onGo={go} /></Suspense>} {setupOpen && <FirstRunSetup data={data} onChange={applyData} onClose={() => setSetupOpen(false)} onGoPlan={() => go("plan")} onAdd={() => openTx()} onOpenSync={(password) => { setSyncPassword(password); setSyncPasswordReveal(password); setMore("sync"); go("utilities"); }} />}
    {modal === "quick" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim înregistrarea rapidă…")}</div></div>}><QuickEntryPanel data={data} initialTemplateId={quickTemplateId} onSave={saveTx} onSaveTemplate={saveQuickTemplate} onDeleteTemplate={deleteQuickTemplate} onArchiveTemplate={archiveQuickTemplate} onRestoreTemplate={restoreQuickTemplate} onDeleteArchivedTemplate={deleteArchivedQuickTemplate} onClose={() => { setModal(null); setQuickTemplateId(undefined); }} onMore={(draft) => { setEditTx(draft); setQuickTemplateId(undefined); setModal("transaction"); }} /></Suspense>}
    {modal === "transaction" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim mișcarea…")}</div></div>}><TransactionForm data={data} initial={editTx} onSave={saveTx} onClose={() => { setModal(null); setEditTx(undefined); }} /></Suspense>}
    {modal === "receipt" && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim bonul…")}</div></div>}><ReceiptForm data={data} onSave={saveReceipt} onClose={() => setModal(null)} /></Suspense>}
    {modal === "debt" && <Suspense fallback={null}><GoalForm data={data} type="debt" item={editGoal} onSave={saveDebt} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "saving" && <Suspense fallback={null}><GoalForm data={data} type="saving" item={editGoal} onSave={saveSaving} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "debt-payment" && editGoal && "remaining" in editGoal && <Suspense fallback={null}><DebtPaymentForm data={data} debt={editGoal} onSave={applyData} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {firstWeekTourOpen && !onboardingOpen && !setupOpen && !modal && more !== "sync" && <Suspense fallback={null}><FirstWeekTour onClose={dismissFirstWeekTour} onCapture={() => { dismissFirstWeekTour(); openTx(); }} onPlan={() => { dismissFirstWeekTour(); go("plan"); }} onSync={() => { dismissFirstWeekTour(); setMore("sync"); go("utilities"); }} /></Suspense>}
    {whatsNewOpen && !onboardingOpen && !setupOpen && !firstWeekTourOpen && !modal && more !== "sync" && <WhatsNewSheet onClose={dismissWhatsNew} onOpenTheme={() => { dismissWhatsNew(); setThemePickerOpen(true); }} onOpenMore={() => { dismissWhatsNew(); setMore("overview"); go("utilities"); }} />}
  </div>;
}
