/**
 * Ecranul Astăzi: cifra zilei, ritmul săptămânii, alertele și activitatea recentă.
 * Mutat din Home.tsx, care ajunsese la peste 1.000 de linii; comportamentul e același.
 */
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, BellRing, CalendarClock, CreditCard, Inbox, Info, PlayCircle, Plus, ReceiptText, Ticket, Wallet, X, ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { calculateHealthScore, envelopeDecisionStatus, formatDate, inPlanPeriod, isoToday, parseRomanianAmount, pendingRecurringInPlan, planForecast, sourceBalance, type AppData, type Transaction } from "@/lib/finance-data";
import { calendarBudgetWeekKey, currentCalendarBudgetWeek } from "@/lib/calendar-budget";
import { markOpeningBalanceAsked, shouldAskOpeningBalance } from "@/lib/ui-prefs";
import { ChartTip } from "@/components/ChartFrame";
import { CategoryGlyph } from "@/components/CategoryGlyph";
import { TodayLedger } from "@/components/TodayLedger";
import { TodayBrief } from "@/components/TodayBrief";
import { allocationHistorySnapshot } from "@/lib/allocation-history";
import { envelopeRunOut, weekTooFast, householdActivityInCycle, weeklyEnvelopeDailyRhythm, dayStripFigure, stripLei, todayBrief } from "@/lib/household-insights";
import { hasNoMoneyYet, planCycle } from "@/lib/plan-cycle";
import {
  dateText,
  fmtExact,
  money,
  sourceKindName,
  type MainView,
} from "@/pages/home-kit";
import { daysLabel, getLocale, t } from "@/lib/i18n";
import { weekdayShortLabels } from "@/lib/civil-weekday";
import { useSimpleMode } from "@/hooks/useSimpleMode";
import { usePlanCycle } from "@/hooks/usePlanCycle";
import { useTodaySummary } from "@/hooks/useTodaySummary";
import { EnvelopeConflictBanner, MovementConflictBanner } from "@/components/EnvelopeConflictBanner";

const HealthScoreBadge = lazy(() => import("@/components/HealthScoreBadge").then((module) => ({ default: module.HealthScoreBadge })));
const WeeklySummaryPanel = lazy(() => import("@/components/WeeklySummaryPanel").then((module) => ({ default: module.WeeklySummaryPanel })));
const SafeSpendSheet = lazy(() => import("@/components/SafeSpendSheet").then((module) => ({ default: module.SafeSpendSheet })));
const AllocationHistoryChart = lazy(() => import("@/components/AllocationHistoryChart").then((module) => ({ default: module.AllocationHistoryChart })));

type AdvisorAction = "plan" | "recurring" | "objectives" | "journal";
type AdvisorSignal = { id: string; tone: "good" | "watch" | "risk"; eyebrow: string; title: string; detail: string; action: AdvisorAction; actionLabel: string };

export function advisorSignals(data: AppData): AdvisorSignal[] {
  const math = planCycle(data);
  const forecast = planForecast(data);
  const signals: AdvisorSignal[] = [];
  const pending = pendingRecurringInPlan(data).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!math.plan.nextPayday) {
    signals.push({ id: "plan-needed", tone: "watch", eyebrow: t("URMĂTORUL PAS"), title: t("Alege următorul venit"), detail: t("Planul are nevoie de o dată de salariu pentru a calcula ritmul sigur de cheltuire."), action: "plan", actionLabel: t("Configurează planul") });
  } else if (math.remaining < 0 && !hasNoMoneyYet(data)) {
    signals.push({ id: "over-plan", tone: "risk", eyebrow: t("ATENȚIE"), title: t("Planul este peste limită cu {amount}", { amount: money(Math.abs(math.remaining)) }), detail: t("Sunt incluse {expenses} cheltuieli și {scheduled} rezervate până la {until}.", { expenses: money(math.periodExpenses), scheduled: money(math.scheduled), until: dateText(math.planEnd || math.plan.nextPayday) }), action: "plan", actionLabel: t("Revizuiește planul") });
  } else if (forecast.spentToDate > 0 && forecast.projectedRemaining < 0) {
    signals.push({ id: "pace-risk", tone: "risk", eyebrow: t("RITM DE REVIZUIT"), title: t("La ritmul actual lipsesc {amount}", { amount: money(Math.abs(forecast.projectedRemaining)) }), detail: t("Cheltuielile sunt în medie {pace} pe zi; ritmul sigur este {safe} pe zi până la venit.", { pace: money(forecast.paceDaily), safe: money(forecast.safeDaily) }), action: "plan", actionLabel: t("Ajustează planul") });
  } else {
    const briefNow = todayBrief(data);
    const average = math.remaining / Math.max(1, math.days);
    const differs = Math.abs(average - briefNow.spendable) > 1;
    signals.push({ id: "daily-pace", tone: "good", eyebrow: t("RITM SIGUR"), title: t("Poți folosi azi {amount}", { amount: money(briefNow.spendable) }), detail: differs ? t("Aceeași cifră ca sus. Până la venit, media ar fi {average} pe zi — nu e limita de azi.", { average: money(average) }) : t("{amount} rămân după cheltuielile înregistrate și rezervele deja planificate.", { amount: money(math.remaining) }), action: "plan", actionLabel: t("Vezi calculele") });
  }
  if (pending[0]) {
    signals.push({ id: "next-recurring", tone: "watch", eyebrow: t("SCADENȚĂ REZERVATĂ"), title: t("{name} · {amount}", { name: pending[0].name, amount: money(pending[0].amount) }), detail: t("Este programată pentru {date} și este deja exclusă din suma disponibilă.", { date: dateText(pending[0].dueDate, true) }), action: "recurring", actionLabel: t("Deschide scadențele") });
  }
  const allocation = data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item) })).sort((a, b) => b.usage - a.usage)[0];
  const runOuts = envelopeRunOut(data);
  // Pentru același plic, „se termină pe 3 octombrie” spune mai mult decât „aproape de limită”.
  const runOut = runOuts.find((item) => item.allocationId === allocation?.item.id) || runOuts[0];
  if (allocation && allocation.state !== "healthy" && !(allocation.state !== "over" && runOut?.allocationId === allocation.item.id)) {
    const over = allocation.state === "over";
    signals.push({ id: `allocation-${allocation.item.id}`, tone: over ? "risk" : "watch", eyebrow: over ? t("PLIC DEPĂȘIT") : t("APROAPE DE LIMITĂ"), title: t("{label}: {amount} rămași", { label: allocation.item.label, amount: money(Math.max(0, allocation.remaining)) }), detail: t("{spent} cheltuiți din limita ajustată de {budget} în perioada activă.", { spent: money(allocation.spent), budget: money(allocation.budget) }), action: "plan", actionLabel: t("Vezi plicul") });
  }
  if (runOut && !(allocation?.state === "over" && allocation.item.id === runOut.allocationId)) {
    signals.push({ id: `runout-${runOut.allocationId}`, tone: "watch", eyebrow: t("SE TERMINĂ ÎNAINTE DE SALARIU"), title: t("{label} ajunge la zero pe {date}", { label: runOut.label, date: formatDate(runOut.runOutDate, { day: "numeric", month: "long" }) }), detail: t("La {rate} pe zi, rămâi {days} fără bani în plic până la venit. Ca să ajungă: cel mult {safe} pe zi.", { rate: money(runOut.dailyRate), days: daysLabel(runOut.daysShort), safe: money(runOut.safeDaily) }), action: "plan", actionLabel: t("Vezi plicul") });
  }
  const goal = data.savings.filter((item) => item.target > item.current).sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
  if (goal && signals.length < 3) signals.push({ id: `goal-${goal.id}`, tone: "good", eyebrow: t("OBIECTIV COMUN"), title: t("{amount} până la {name}", { amount: money(goal.target - goal.current), name: goal.name }), detail: t("Progres actual: {current} din {target}.", { current: money(goal.current), target: money(goal.target) }), action: "objectives", actionLabel: t("Vezi obiectivul") });
  const unrepartized = math.unrepartized;
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

/** Luni → duminică, aceeași ordine în orice fus orar. */
export const weekdayShort = () => weekdayShortLabels(getLocale());

export function openHouseholdGuide() {
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
        paymentSources: data.settings.paymentSources.map((entry) => entry.id === source.id ? { ...entry, openingBalance: amount, updatedAt: new Date().toISOString() } : entry),
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

type ActivityRow = { id: string; date: string; updatedAt?: string; createdAt?: string };

/**
 * Pe o gospodărie, feedul ciclului lasă afară ce e notat azi după ce ciclul s-a închis
 * (și cheltuiala personală de azi). Lista „Ultimele mișcări” e despre ce tocmai s-a întâmplat,
 * nu doar despre intervalul planului — altfel starea goală spune „nicio mișcare azi”.
 */
export function recentActivityMoves<T extends ActivityRow>(transactions: T[], cycleRecentIds: string[], today: string, memberCount: number): T[] {
  const byRecency = (left: T, right: T) =>
    (right.updatedAt || right.createdAt || right.date).localeCompare(left.updatedAt || left.createdAt || left.date);
  if (memberCount < 2) return [...transactions].sort(byRecency).slice(0, 5);
  const byId = new Map(transactions.map((item) => [item.id, item]));
  const seen = new Set(cycleRecentIds);
  const todayIds = transactions.filter((item) => item.date === today && !seen.has(item.id)).map((item) => item.id);
  return [...todayIds, ...cycleRecentIds]
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item))
    .sort(byRecency)
    .slice(0, 5);
}

export function TodayView({ data, onAdd, onEdit, onGo, onChange, onOpenReview, onOpenSettings, onOpenRecurring, coach }: { data: AppData; onAdd: () => void; onEdit: (item: Transaction) => void; onGo: (view: MainView) => void; onChange: (next: AppData) => void; onOpenReview: () => void; onOpenSettings: () => void; onOpenRecurring: () => void; coach?: ReactNode }) {
  const { simpleMode } = useSimpleMode();
  const math = usePlanCycle(data);
  const summary = useTodaySummary(data);
  const { overPlan, heroLabel, heroValue, heroHint, explainer, heroTracksWeek, rhythm, rhythmNote, brief, planHelp } = summary;
  const signals = useMemo(() => advisorSignals(data), [data]);
  // „Poți folosi azi” e deja cifra mare de sus; dacă un plic se golește înainte de salariu, aceea e recomandarea.
  const nextStep = signals[0] && signals[0].id !== "daily-pace" ? signals[0] : signals.find((item) => item.id.startsWith("runout-"));
  const showHealthGauge = useMemo(() => calculateHealthScore(data).score !== null, [data]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [shownTrancheKey, setShownTrancheKey] = useState("");
  const [openHint, setOpenHint] = useState(false);
  const [safeSheetOpen, setSafeSheetOpen] = useState(false);
  const [rhythmTip, setRhythmTip] = useState<string | null>(null);
  const [dayMore, setDayMore] = useState(false);
  const envelopes = useMemo(() => data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item) })), [data]);
  const topEnvelope = [...envelopes].sort((a, b) => b.usage - a.usage)[0];
  const runOuts = useMemo(() => envelopeRunOut(data), [data]);
  const activeEnvelopeAlert = envelopes.filter((item) => item.state !== "healthy" && !dismissedAlerts.includes(item.item.id)).sort((a, b) => (b.state === "over" ? 2 : 1) - (a.state === "over" ? 2 : 1))[0];
  // Același plic: „se termină pe …” spune mai mult decât „80% consumat”; și apare înainte de prag, dacă ritmul e prea repede.
  const fastWeek = useMemo(() => weekTooFast(data), [data]).find((item) => !dismissedAlerts.includes(`week-${item.allocationId}-${item.weekIndex}`));
  const runOutAlert = activeEnvelopeAlert?.state === "over" ? undefined : activeEnvelopeAlert ? runOuts.find((item) => item.allocationId === activeEnvelopeAlert.item.id) : runOuts.find((item) => !dismissedAlerts.includes(item.allocationId));
  const lastMoves = useMemo(() => {
    const today = isoToday();
    const cycleIds = data.settings.members.length < 2 ? [] : householdActivityInCycle(data, today).recent.map((item) => item.id);
    return recentActivityMoves(data.transactions, cycleIds, today, data.settings.members.length);
  }, [data]);
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

  const sourceRows = useMemo(
    () => data.settings.paymentSources.map((source) => ({ ...source, balance: sourceBalance(data, source.id) })),
    [data],
  );

  const fresh = !data.transactions.length
    && !data.settings.salaryPlan.allocations.length
    && !data.settings.paymentSources.some((item) => item.openingBalance > 0);

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
      {fastWeek && (
        <aside className={`bf-envelope-live-notice ${fastWeek.over ? "over" : "watch"}`} role="status" aria-live="polite">
          <BellRing size={19} />
          <div>
            <p>{fastWeek.over ? t("SĂPTĂMÂNA E DEPĂȘITĂ") : t("SĂPTĂMÂNA MERGE REPEDE")}</p>
            <strong>{t("{label} · S{index}", { label: fastWeek.label, index: fastWeek.weekIndex })}</strong>
            <span>{fastWeek.over
              ? t("{spent} din {budget}, peste cu {amount}. Se scade din ce rămâne în plic.", { spent: money(fastWeek.spent), budget: money(fastWeek.budget), amount: money(-fastWeek.remaining) })
              : t("{spent} din {budget}, mai sunt {days}. Ca să ajungă: cel mult {perDay} pe zi.", { spent: money(fastWeek.spent), budget: money(fastWeek.budget), days: daysLabel(fastWeek.daysLeft), perDay: money(fastWeek.perDay) })}</span>
          </div>
          <button onClick={() => onGo("plan")}>{t("Vezi")}</button>
          <button className="dismiss" aria-label={t("Ascunde alerta pentru {label}", { label: fastWeek.label })} onClick={() => setDismissedAlerts((current) => [...current, `week-${fastWeek.allocationId}-${fastWeek.weekIndex}`])}><X size={16} /></button>
        </aside>
      )}
      {runOutAlert && (
        <aside className="bf-envelope-live-notice watch" role="status" aria-live="polite">
          <BellRing size={19} />
          <div>
            <p>{t("SE TERMINĂ ÎNAINTE DE SALARIU")}</p>
            <strong>{runOutAlert.label}</strong>
            <span>{t("Ajunge la zero pe {date}. Ca să țină până la salariu: cel mult {safe} pe zi (acum {rate}).", { date: formatDate(runOutAlert.runOutDate, { day: "numeric", month: "long" }), safe: money(runOutAlert.safeDaily), rate: money(runOutAlert.dailyRate) })}</span>
          </div>
          <button onClick={() => onGo("plan")}>{t("Vezi")}</button>
          <button className="dismiss" aria-label={t("Ascunde alerta pentru {label}", { label: runOutAlert.label })} onClick={() => setDismissedAlerts((current) => [...current, runOutAlert.allocationId])}><X size={16} /></button>
        </aside>
      )}
      {activeEnvelopeAlert && !runOutAlert && (
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
            {planHelp && <button type="button" className="bf-link-button bf-hero-plan-link" onClick={() => onGo("plan")}>{t("Pune bani în plic")} <ChevronRight size={14} aria-hidden="true" /></button>}
            {(periodIncome > 0 || periodExpense > 0) && (
              <div className="bf-cycle-flow" aria-label={t("În ciclul ăsta")}>
                <span><small>{t("Intrat")}</small><b>+{fmtExact.format(periodIncome)}</b></span>
                <span><small>{t("Ieșit")}</small><b>−{fmtExact.format(periodExpense)}</b></span>
              </div>
            )}
            <div className="bf-os-actions">
              <button type="button" className="bf-today-add bf-os-decide" onPointerDown={() => void import("@/components/QuickEntryPanel")} onClick={onAdd}><Plus size={18} /> {t("Notează")}</button>
            </div>
            {!rhythm.hasWeekly || brief.expired ? null : (
              <div className="bf-hero-week" aria-label={t("Ritm zilnic")}>
                <div className="bf-os-rhythm-grid" style={{ ["--bf-rhythm-days" as string]: String(Math.max(1, rhythm.days.length)) }}>
                  {rhythm.days.map((row) => {
                    const figure = dayStripFigure(row, heroTracksWeek ? brief.spendable : row.left, heroTracksWeek);
                    const figureLabel = `${stripLei(figure, getLocale())} lei`;
                    return (
                    <button
                      key={row.day}
                      type="button"
                      className={`bf-os-day${row.isToday ? " is-today" : ""}${row.over ? " is-over" : ""}${row.isFuture ? " is-future" : ""}`}
                      aria-pressed={rhythmTip === row.day}
                      aria-label={t("{label}: {amount}", { label: weekdayShort()[row.weekday], amount: figureLabel })}
                      onClick={() => setRhythmTip((current) => current === row.day ? null : row.day)}
                    >
                      <span>{weekdayShort()[row.weekday]}</span>
                      <b>{Math.round(figure).toLocaleString(getLocale())}</b>
                      <span className="bf-os-bar" aria-hidden="true"><i className={row.fill <= 0 ? "is-empty" : ""} style={{ height: `${row.fill}%` }} /></span>
                    </button>
                    );
                  })}
                </div>
                {(() => {
                  const row = rhythm.days.find((item) => item.day === rhythmTip) || rhythm.days.find((item) => item.isToday);
                  if (!row) return null;
                  const shown = dayStripFigure(row, heroTracksWeek ? brief.spendable : row.left, heroTracksWeek);
                  const leiExact = (value: number) => `${stripLei(value, getLocale())} lei`;
                  const when = row.isToday ? t("Azi · {amount} rămași", { amount: leiExact(shown) }) : row.isFuture ? t("Viitor · {amount} pe zi", { amount: leiExact(row.left) }) : t("Trecut · {amount} cheltuiți", { amount: leiExact(row.out) });
                  return <ChartTip><b>{weekdayShort()[row.weekday]}</b><span>{when}</span><span>{t("Cheltuieli {amount}", { amount: leiExact(row.out) })}</span></ChartTip>;
                })()}
                <p className="bf-os-note">{rhythmNote}</p>
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
            </div>
          </>
        )}
      </section>
      {coach}

      <OpeningBalanceCard data={data} onChange={onChange} />

      <TodayBrief data={data} onGo={onGo} onChange={onChange} onOpenRecurring={onOpenRecurring} hideSpendStamp simpleMode={simpleMode} onOpenWeek={simpleMode ? undefined : () => { setDayMore(true); window.setTimeout(() => document.getElementById("bf-week-checkin")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40); }} />

      <section className="bf-today-activity">
          <div className="bf-section-heading">
            <div>
              <h2>{t("Ultimele mișcări")}</h2>
            </div>
            <button onClick={() => onGo("journal")}>{t("Toate mișcările")} <ChevronRight size={15} /></button>
          </div>
          {lastMoves.length ? (
            <div className="bf-today-activity-list">
              {lastMoves.slice(0, 3).map((item) => {
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
                      const categoryLabel = t(item.category);
                      const envelopeLabel = envelope && envelope !== item.category && envelope !== categoryLabel ? envelope : "";
                      return `${when} · ${item.person} · ${categoryLabel}${envelopeLabel ? ` · ${envelopeLabel}` : ""}`;
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
              <span><b>{data.transactions.length ? t("Nicio mișcare azi.") : t("Nicio mișcare încă")}</b><small>{data.transactions.length ? t("Zilele trecute sunt în Mișcări.") : t("Prima cheltuială sau încasare apare aici.")}</small></span>
              <Plus size={18} />
            </button>
          )}
        </section>

      {!simpleMode && (
        <section className="bf-today-more">
          <button type="button" className="bf-today-more-toggle" aria-expanded={dayMore} onClick={() => setDayMore((value) => !value)}>
            {dayMore ? t("Mai puțin din ziua asta") : t("Mai mult din ziua asta")}
          </button>
          {dayMore && (
            <>
              {data.pendingReview.length === 0 && nextStep && <NextStepCard signal={nextStep} onOpen={() => openSignal(nextStep.action)} />}
              <div className="bf-today-explainers">
                <button type="button" className="os-explainer secondary" onClick={() => window.dispatchEvent(new Event("buget-familie:open-usage-tutorial"))}>
                  <BookOpen size={16} aria-hidden="true" /> {t("Cum se folosește")}
                </button>
                <button type="button" className="os-explainer secondary" onClick={() => setOpenHint((value) => !value)}>
                  {t("Surse pe scurt")} <span>{openHint ? "−" : "+"}</span>
                </button>
              </div>
              {openHint ? (
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
              {!rhythm.hasWeekly && <TodayLedger data={data} onGo={(view) => onGo(view)} compact />}
              {(data.transactions.length > 0 || data.settings.members.length > 1 || data.settings.salaryPlan.allocations.length > 0) && (
                <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim bilanțul săptămânii…")}</div>}>
                  <WeeklySummaryPanel data={data} onChange={onChange} onOpenJournal={() => onGo("journal")} onOpenPlan={() => onGo("plan")} />
                </Suspense>
              )}
              {showHealthGauge && (
              <div className="os-gauge bf-today-below-gauge">
                <Suspense fallback={null}>
                  <HealthScoreBadge data={data} />
                </Suspense>
              </div>
              )}
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
              {data.settings.salaryPlan.allocations.length > 0 && (
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
              )}
            </>
          )}
        </section>
      )}

      {safeSheetOpen && (
        <Suspense fallback={null}>
          <SafeSpendSheet data={data} onClose={() => setSafeSheetOpen(false)} onGoPlan={() => { setSafeSheetOpen(false); onGo("plan"); }} />
        </Suspense>
      )}

    </div>
  );
}

