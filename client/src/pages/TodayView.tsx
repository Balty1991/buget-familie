/**
 * Ecranul Astăzi: cifra zilei, ritmul săptămânii, alertele și activitatea recentă.
 * Mutat din Home.tsx, care ajunsese la peste 1.000 de linii; comportamentul e același.
 */
import { mergeSplitPayments } from "@/lib/split-payment";
import { visibleShopping } from "@/lib/shopping-list";
import { YearRecapEntry } from "@/components/YearRecapEntry";
import { noSpendDays } from "@/lib/logging-habits";
import { safeSetItem } from "@/lib/safe-storage";
import { tickMemo } from "@/lib/tick-cache";
import { useCountUp } from "@/hooks/useCountUp";
import { dayGreeting } from "@/lib/day-greeting";

const INTRO_KEY = "buget-familie:today-intro";
import { applyDeclaredBalance, balanceCheckDue, markBalanceChecked, readLastBalanceCheck } from "@/lib/balance-check";
import "../monthly-needs.css";
import { readAutoBackup } from "@/lib/auto-backup";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, BellRing, FileBarChart, ListChecks, Image as ImageIcon, CalendarClock, CreditCard, Gift, Inbox, Info, PiggyBank, PlayCircle, Plus, ReceiptText, Ticket, Wallet, X, ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { addIsoDays, planEndDate, calculateHealthScore, dropEnvelopeTransfer, envelopeDecisionStatus, formatDate, inPlanPeriod, isBalanceAdjustment, isoToday, parseRomanianAmount, pendingRecurringInPlan, planForecast, planWeeklyCycle, sourceBalance, transferBetweenEnvelopes, type AppData, type Transaction } from "@/lib/finance-data";
import { calendarBudgetWeekKey } from "@/lib/calendar-budget";
import { markOpeningBalanceAsked, shouldAskOpeningBalance } from "@/lib/ui-prefs";
import { ChartTip } from "@/components/ChartFrame";
import { CategoryGlyph } from "@/components/CategoryGlyph";
import { categoryTone } from "@/lib/category-color";
import { TodayLedger } from "@/components/TodayLedger";
import { TodayBrief } from "@/components/TodayBrief";
import { allocationHistorySnapshot } from "@/lib/allocation-history";
import { acceptRecurringPrice, monthTitle, readClosedMonths, ageOfMoney, ageOfMoneyLine, calendarPace, calendarPaceLine, checkInRebalance, envelopeRunOut, extendRunOutMove, mealRunway, mealRunwayLine, nextTrueExpense, recurringPriceChanges, repeatedOverLine, savingsSuggestion, weekTooFast, weekVersusLast, weekVersusLastLine, householdActivityInCycle, weeklyCheckIn, weeklyEnvelopeDailyRhythm, dayStripFigure, stripLei, todayBrief, currentMonthKey, monthlyFamilyReport } from "@/lib/household-insights";
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
import { HouseOfferCard } from "@/components/HouseOfferCard";
import { EnvelopeConflictBanner, MovementConflictBanner } from "@/components/EnvelopeConflictBanner";
import { distinctExpenseDays } from "@/lib/quiet-start";
import { HABIT_DAYS, otherPhoneHasLogged, partnersQuietToday } from "@/lib/habit-hold";
import { formatPlanPriceRon, openFamilieCatalog } from "@/lib/entitlements";
import { getOrCreateDeviceId } from "@/lib/sync-devices";
import { paydayDue } from "@/lib/payday";
import "../house-offer.css";

const HealthScoreBadge = lazy(() => import("@/components/HealthScoreBadge").then((module) => ({ default: module.HealthScoreBadge })));
const WeeklySummaryPanel = lazy(() => import("@/components/WeeklySummaryPanel").then((module) => ({ default: module.WeeklySummaryPanel })));
const MonthShareSheet = lazy(() => import("@/components/MonthShareSheet").then((module) => ({ default: module.MonthShareSheet })));
const TripTodayCard = lazy(() => import("@/components/TripTodayCard").then((module) => ({ default: module.TripTodayCard })));
const MonthEndCard = lazy(() => import("@/components/MonthEndCard").then((module) => ({ default: module.MonthEndCard })));
const MonthChallengeCard = lazy(() => import("@/components/MonthChallengeCard").then((module) => ({ default: module.MonthChallengeCard })));
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
const SEEN_TRANCHES_KEY = "buget-familie:seen-tranches";
const readSeenTranches = (): string[] => { try { const value = JSON.parse(window.localStorage.getItem(SEEN_TRANCHES_KEY) || "[]"); return Array.isArray(value) ? value.map(String) : []; } catch { return []; } };
export const weekdayShort = () => weekdayShortLabels(getLocale());

export function openHouseholdGuide() {
  window.dispatchEvent(new CustomEvent("buget-familie:open-guide"));
}

function SourceGlyph({ kind }: { kind: keyof typeof sourceKindName }) {
  if (kind === "cash") return <Wallet size={16} />;
  if (kind === "meal" || kind === "voucher") return <Ticket size={16} />;
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
  // Când „Cât ai de fapt pe card?” e deja pe ecran, a doua întrebare despre același lucru e în plus.
  if (balanceCheckDue(data, readLastBalanceCheck()).due) return null;
  const save = () => {
    const amount = Math.max(0, parseRomanianAmount(value));
    if (!amount) return;
    markOpeningBalanceAsked();
    // Aceeași verificare ca „Cât ai de fapt pe card?”: nu mai întreabă a doua oară azi.
    markBalanceChecked();
    setDismissed(true);
    /* „Cât ai acum” e soldul de azi, nu cel de la început: se scrie doar diferența față de
       ce vede aplicația. Ca sold inițial, 5.200 + salariile deja notate dădea 9.942. */
    onChange(applyDeclaredBalance(data, source.id, amount));
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
  // „Astăzi pictat”: prima dată când ecranul cu cifra zilei e pe ecran. Splash-ul e LCP-ul real,
  // deci Lighthouse arată mai bine decât e; scripts/lighthouse.mjs raportează și acest semn.
  useEffect(() => {
    if (typeof performance === "undefined" || performance.getEntriesByName("bf-today-painted").length) return;
    requestAnimationFrame(() => requestAnimationFrame(() => performance.mark("bf-today-painted")));
  }, []);
  const { simpleMode } = useSimpleMode();
  const math = usePlanCycle(data);
  const summary = useTodaySummary(data);
  const { overPlan, duesShort, salaryMissing, heroLabel, heroValue, heroHint, explainer, heroTracksWeek, rhythm, rhythmNote, brief, planHelp } = summary;
  // Prima deschidere a zilei: salutul, intrarea pe rând a cardurilor și cifra care urcă de la 0.
  const [intro] = useState(() => { try { if (navigator.webdriver || window.localStorage.getItem(INTRO_KEY) === isoToday()) return false; safeSetItem(window.localStorage, INTRO_KEY, isoToday()); return true; } catch { return false; } });
  // Asistentul de final de lună (și fișierul lui) se încarcă doar în ultimele 5 zile dinainte de salariu.
  const nearPayday = useMemo(() => { const end = planEndDate(data.settings.salaryPlan); const days = end ? Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${isoToday()}T12:00:00Z`)) / 86_400_000) : -1; return days >= 1 && days <= 5; }, [data.settings.salaryPlan]);
  // Raportul lunii trecute: în primele 7 zile, cât timp luna nu e închisă și are destule mișcări.
  const [closedTick, setClosedTick] = useState(0);
  useEffect(() => { const bump = () => setClosedTick((value) => value + 1); window.addEventListener("buget-familie:month-closed", bump); return () => window.removeEventListener("buget-familie:month-closed", bump); }, []);
  const advisorMonth = useMemo(() => {
    const today = isoToday();
    if (Number(today.slice(8, 10)) > 7) return "";
    const date = new Date(`${today.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1);
    const key = date.toISOString().slice(0, 7);
    if (readClosedMonths()[key]) return "";
    return data.transactions.filter((item) => item.date.startsWith(key)).length >= 5 ? key : "";
    // closedTick: după „Închide luna”, cardul dispare fără reîncărcare.
  }, [data.transactions, closedTick]);
  const greeting = useMemo(() => dayGreeting(data, isoToday(), new Date().getHours()), [data]);
  const heroShown = useCountUp(Number.isFinite(heroValue) ? heroValue : 0, intro ? 700 : 0, intro ? 0 : undefined);
  const signals = useMemo(() => tickMemo([data], `signals:${isoToday()}`, () => advisorSignals(data)), [data]);
  // „Poți folosi azi” e deja cifra mare de sus; dacă un plic se golește înainte de salariu, aceea e recomandarea.
  const nextStep = signals[0] && signals[0].id !== "daily-pace" ? signals[0] : signals.find((item) => item.id.startsWith("runout-"));
  const showHealthGauge = useMemo(() => tickMemo([data], `health:${isoToday()}`, () => calculateHealthScore(data).score !== null), [data]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [shownTrancheKey, setShownTrancheKey] = useState("");
  const [openHint, setOpenHint] = useState(false);
  const [safeSheetOpen, setSafeSheetOpen] = useState(false);
  const [rhythmTip, setRhythmTip] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [whereOpen, setWhereOpen] = useState(false);
  /** „Unde sunt banii”: soldul fiecărei surse (și al cui e) și pe ce s-a cheltuit luna asta. */
  const where = useMemo(() => {
    if (!whereOpen) return undefined;
    const sources = data.settings.paymentSources.map((source) => ({ id: source.id, name: source.name, owner: data.settings.members.find((member) => member.id === source.memberId)?.name, balance: sourceBalance(data, source.id) }))
      .filter((row) => Math.abs(row.balance) > 0.009).sort((a, b) => b.balance - a.balance);
    const month = isoToday().slice(0, 7);
    const byCategory = new Map<string, number>();
    for (const item of data.transactions) {
      if (item.kind !== "expense" || item.transferId || isBalanceAdjustment(item) || !item.date.startsWith(month)) continue;
      byCategory.set(item.category, (byCategory.get(item.category) || 0) + item.amount);
    }
    const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { sources, categories };
  }, [whereOpen, data]);
  const [dayMore, setDayMore] = useState(false);
  const [priceLater, setPriceLater] = useState(false);
  const [moved, setMoved] = useState<{ id: string; amount: number; from: string; to: string } | null>(null);
  const envelopes = useMemo(() => tickMemo([data], `envelopes:${isoToday()}`, () => data.settings.salaryPlan.allocations.map((item) => ({ item, ...envelopeDecisionStatus(data, item) }))), [data]);
  const ageLine = useMemo(() => tickMemo([data], `age-line:${isoToday()}`, () => ageOfMoneyLine(ageOfMoney(data))), [data]);
  const mealLine = useMemo(() => tickMemo([data], `meal-run:${isoToday()}`, () => mealRunwayLine(mealRunway(data))), [data]);
  const focusGoal = useMemo(() => tickMemo([data], `goal-now:${isoToday()}`, () => {
    const open = data.savings.filter((item) => item.target > item.current + 0.5);
    const dated = open.filter((item) => item.dueDate && item.dueDate >= isoToday()).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const goal = dated[0] || [...open].sort((a, b) => (b.target - b.current) - (a.target - a.current))[0];
    if (!goal) return undefined;
    const suggestion = savingsSuggestion(data, goal);
    return suggestion && suggestion.monthly >= 1 ? { name: goal.name, left: suggestion.left, monthly: suggestion.monthly, current: Math.max(0, goal.current), target: goal.target } : undefined;
  }), [data]);
  const trueExpense = useMemo(() => nextTrueExpense(data), [data]);
  const rise = useMemo(() => (priceLater ? undefined : recurringPriceChanges(data)[0]), [data, priceLater]);
  const weekShare = useMemo(() => tickMemo([data], `week-share:${isoToday()}`, () => {
    if (data.settings.members.length < 2) return "";
    const spent = weeklyCheckIn(data).members.filter((item) => item.expense >= 1);
    if (spent.length < 2) return "";
    return t("Săptămâna asta: {one} {oneAmount} · {two} {twoAmount}.", { one: spent[0].name, oneAmount: money(spent[0].expense), two: spent[1].name, twoAmount: money(spent[1].expense) });
  }), [data]);
  const weekRow = useMemo(() => tickMemo([data], `week-vs:${isoToday()}`, () => weekVersusLast(data)), [data]);
  const weekLine = weekVersusLastLine(weekRow);
  const pace = useMemo(() => tickMemo([data], `pace-line:${isoToday()}`, () => calendarPace(data)), [data]);
  const againLine = useMemo(() => tickMemo([data], `again:${isoToday()}`, () => repeatedOverLine(data) || ""), [data]);
  const topEnvelope = [...envelopes].sort((a, b) => b.usage - a.usage)[0];
  const runOuts = useMemo(() => envelopeRunOut(data), [data]);
  const activeEnvelopeAlert = envelopes.filter((item) => item.state !== "healthy" && !dismissedAlerts.includes(item.item.id)).sort((a, b) => (b.state === "over" ? 2 : 1) - (a.state === "over" ? 2 : 1))[0];
  // Același plic: „se termină pe …” spune mai mult decât „80% consumat”; și apare înainte de prag, dacă ritmul e prea repede.
  const fastWeeks = useMemo(() => tickMemo([data], `weekTooFast:${isoToday()}`, () => weekTooFast(data)), [data]).filter((item) => !dismissedAlerts.includes(`week-${item.allocationId}-${item.weekIndex}`));
  const fastWeek = fastWeeks[0];
  // „Se termină înainte de salariu” spune mai mult decât „aproape de limită”, oricare ar fi plicul
  // (Taxi pe 3 oct. nu mai stă ascuns în spatele „Mâncare 83%”).
  const liveRunOuts = runOuts.filter((item) => !dismissedAlerts.includes(item.allocationId) && !(activeEnvelopeAlert?.state === "over" && activeEnvelopeAlert.item.id === item.allocationId));
  const runOutAlert = activeEnvelopeAlert?.state === "over" ? undefined : liveRunOuts[0];
  /**
   * O singură bandă despre plicuri, cea mai importantă: plic depășit, apoi săptămâna depășită
   * sau prea repede, apoi „se termină înainte de salariu”, apoi „aproape de limită”, apoi
   * începutul tranșei. Celelalte se numără, ca să nu umple ecranul patru benzi deodată.
   */
  const noticeOrder = [
    activeEnvelopeAlert?.state === "over" ? "envelope" : "",
    fastWeek && !(activeEnvelopeAlert?.state === "over" && activeEnvelopeAlert.item.id === fastWeek.allocationId) ? "fast" : "",
    runOutAlert ? "runout" : "",
    activeEnvelopeAlert && activeEnvelopeAlert.state !== "over" && !runOutAlert ? "envelope" : "",
  ].filter(Boolean);
  const topNotice = noticeOrder[0] || "";
  const cover = activeEnvelopeAlert?.state === "over" && topNotice === "envelope"
    ? (() => {
      const proposal = checkInRebalance(data);
      return proposal && proposal.toId === activeEnvelopeAlert.item.id ? proposal : undefined;
    })()
    : undefined;
  const extend = runOutAlert && topNotice === "runout" ? extendRunOutMove(data, runOutAlert.allocationId) : undefined;
  const applyMove = (proposal: { fromId: string; toId: string; amount: number; fromLabel: string; toLabel: string }) => {
    const next = transferBetweenEnvelopes(data, { fromAllocationId: proposal.fromId, toAllocationId: proposal.toId, amount: proposal.amount, note: t("Acoperit din {from}", { from: proposal.fromLabel }) });
    if (!next) return;
    const added = next.settings.salaryPlan.transfers.find((item) => !data.settings.salaryPlan.transfers.some((old) => old.id === item.id));
    if (added) setMoved({ id: added.id, amount: proposal.amount, from: proposal.fromLabel, to: proposal.toLabel });
    onChange(next);
  };
  const undoMove = () => {
    if (!moved) return;
    const next = dropEnvelopeTransfer(data, moved.id);
    setMoved(null);
    if (next) onChange(next);
  };
  // Restul se numără pe plicuri, nu pe tipuri de bandă: trei plicuri depășite sunt „încă 2”.
  const flaggedEnvelopes = new Set([
    ...envelopes.filter((item) => item.state !== "healthy" && !dismissedAlerts.includes(item.item.id)).map((item) => item.item.id),
    ...fastWeeks.map((item) => item.allocationId),
    ...liveRunOuts.map((item) => item.allocationId),
  ]);
  const moreNotices = Math.max(0, flaggedEnvelopes.size - (topNotice ? 1 : 0));
  const lastMoves = useMemo(() => {
    const today = isoToday();
    const cycleIds = data.settings.members.length < 2 ? [] : householdActivityInCycle(data, today).recent.map((item) => item.id);
    return recentActivityMoves(mergeSplitPayments(data.transactions), cycleIds, today, data.settings.members.length);
  }, [data]);
  const periodIncome = data.transactions.filter((item) => item.kind === "income" && !isBalanceAdjustment(item) && inPlanPeriod(item.date, math.plan)).reduce((sum, item) => sum + item.amount, 0);
  const periodExpense = data.transactions.filter((item) => item.kind === "expense" && !isBalanceAdjustment(item) && inPlanPeriod(item.date, math.plan)).reduce((sum, item) => sum + item.amount, 0);
  // Tranșa din plicuri (600 la mâncare), nu o împărțire pe zile a totalului (599,97).
  const activeTranche = math.planEnd ? planWeeklyCycle(data)?.weeks.find((week) => isoToday() >= week.start && isoToday() <= (week.graceDays ? addIsoDays(week.end, week.graceDays) : week.end)) : undefined;
  const activeTrancheKey = activeTranche ? calendarBudgetWeekKey(activeTranche) : "";
  const showTrancheNotice = Boolean(activeTranche && shownTrancheKey === activeTrancheKey);
  useEffect(() => {
    if (!activeTranche || !activeTrancheKey || shownTrancheKey === activeTrancheKey) return;
    // Ținut în preferințele telefonului, nu în registru: altfel prima intrare din fiecare
    // săptămână rescria tot registrul (1 MB) doar pentru un semn „văzut”.
    const seen = readSeenTranches();
    if (seen.includes(activeTrancheKey) || data.settings.seenWeeklyPlanTranches.includes(activeTrancheKey)) return;
    setShownTrancheKey(activeTrancheKey);
    try { safeSetItem(window.localStorage, SEEN_TRANCHES_KEY, JSON.stringify([...seen, activeTrancheKey].slice(-80))); } catch { /* fără stocare: anunțul poate reapărea */ }
  }, [activeTranche, activeTrancheKey, data.settings.seenWeeklyPlanTranches, shownTrancheKey]);
  const openSignal = (action: AdvisorAction) => {
    if (action === "plan") onGo("plan");
    else if (action === "journal") onGo("journal");
    else if (action === "recurring") onOpenRecurring();
    else onGo("obligations");
  };

  const todayIso = isoToday();
  const isPaydayDue = paydayDue(data, todayIso);
  const held = distinctExpenseDays(data.transactions) >= HABIT_DAYS;
  const quietPartners = held ? partnersQuietToday(data, todayIso) : [];
  const otherPhoneLogged = held && otherPhoneHasLogged(data, getOrCreateDeviceId());
  // În prima săptămână a lunii: imaginea lunii trecute, o singură dată (se poate ascunde).
  const shoppingTodo = useMemo(() => visibleShopping(data.settings.shoppingList || []).todo.length, [data.settings.shoppingList]);
  const recapMonth = currentMonthKey(addIsoDays(`${todayIso.slice(0, 7)}-01`, -1));
  const recapKey = `buget-familie:month-card-${recapMonth}`;
  const [recapHidden, setRecapHidden] = useState(() => { try { return localStorage.getItem(recapKey) === "1"; } catch { return true; } });
  const [recapOpen, setRecapOpen] = useState(false);
  const recapReport = useMemo(() => (Number(todayIso.slice(8, 10)) <= 7 && !recapHidden ? monthlyFamilyReport(data, recapMonth) : undefined), [data, todayIso, recapHidden, recapMonth]);
  const hideRecap = () => { safeSetItem(localStorage, recapKey, "1"); setRecapHidden(true); };

  const sourceRows = useMemo(
    () => data.settings.paymentSources.map((source) => ({ ...source, balance: sourceBalance(data, source.id) })),
    [data],
  );
  const glance = [...envelopes]
    .filter((item) => item.budget > 0 || item.spent > 0)
    .sort((a, b) => (b.state === "over" ? 2 : b.state === "watch" ? 1 : 0) - (a.state === "over" ? 2 : a.state === "watch" ? 1 : 0) || b.usage - a.usage)
    .slice(0, 8);
  const spendFree = useMemo(() => noSpendDays(data.transactions, todayIso), [data.transactions, todayIso]);
  const paydayIn = data.settings.salaryPlan.nextPayday && data.settings.salaryPlan.nextPayday >= todayIso
    ? Math.round((Date.parse(`${data.settings.salaryPlan.nextPayday}T12:00:00`) - Date.parse(`${todayIso}T12:00:00`)) / 86_400_000)
    : undefined;

  /** Pornirea în 3 pași e făcută: cheltuielile lunare sunt declarate, doar plicurile vin la primul salariu. */
  const declaredNeeds = (data.settings.salaryPlan.needs || []).filter((item) => !item.archived).length;
  const planDeclared = declaredNeeds > 0;
  const fresh = !data.transactions.length
    && !data.settings.salaryPlan.allocations.length
    && !data.settings.paymentSources.some((item) => item.openingBalance > 0);

  /* Sub butonul strâns rămânea un gol mare: cadranul sănătății banilor îl umple și duce la detalii. */
  const healthPulse = (
    <div className="bf-health-pulse">
      <div className="bf-health-pulse-gauge">
        <Suspense fallback={null}>
          <HealthScoreBadge data={data} onGo={onGo} />
        </Suspense>
      </div>
      <div className="bf-health-pulse-copy">
        <b>{t("Sănătatea banilor, de la 0 la 100")}</b>
        <small>{t("Arată dacă banii ajung liniștit până la următorul venit: marja rămasă, plicurile în limită, scadențele din 7 zile și ritmul de cheltuire.")} {showHealthGauge ? t("Peste 72 e calm, sub 45 e tensionat. Atinge cadranul pentru detalii.") : t("Scorul apare după ce notezi câteva zile. Atinge cadranul ca să vezi ce lipsește.")}</small>
      </div>
    </div>
  );
  return (
    <div className={"bf-page bf-today-workspace" + (simpleMode ? " is-simple" : "") + (intro ? " is-entering" : "") + (held ? " is-held" : "") + (held && dayMore ? " is-open" : "")}>
      <header className="bf-greet"><b>{greeting.hello}</b><span>{greeting.line}</span></header>
      {/* Modul simplu nu mai are bandă permanentă de avertizare: se oprește din „Mai mult” → Setări. */}
      <EnvelopeConflictBanner data={data} onChange={onChange} />
      <MovementConflictBanner data={data} onChange={onChange} />
      {moved && (
        <aside className="bf-income-split-done" role="status">
          <span>{t("Am mutat {amount} din {from} în {to}.", { amount: money(moved.amount), from: moved.from, to: moved.to })}</span>
          <button type="button" className="bf-secondary" onClick={undoMove}>{t("Anulează")}</button>
        </aside>
      )}
      <section className={`os-hero ${overPlan ? "is-risk" : ""}`}>
        <div className="os-hero-top">
          {overPlan ? <span className="os-chip"><i /> {duesShort ? t("Rate de acoperit") : t("Plan de revizuit")}</span> : null}
          {/* D13: data pe un singur rând („dum., 27 sept.”), nu pe trei. */}
          <time className="os-date-line" dateTime={todayIso}>{new Date(`${todayIso}T12:00:00`).toLocaleDateString(getLocale(), { weekday: "short", day: "numeric", month: "short" })}</time>
        </div>
        {fresh && planDeclared ? (
          <div className="os-start os-start-ready">
            <p className="os-kicker-lg">{t("Gata")}</p>
            <h1 className="os-start-title">{t("Planul e pregătit.")}</h1>
            <p className="os-start-note">
              {data.settings.salaryPlan.nextPayday
                ? t("Când îți vine salariul (în jur de {date}), notează-l și îți propun împărțirea pe plicuri, după cele {count} cheltuieli declarate.", { date: formatDate(data.settings.salaryPlan.nextPayday, { day: "numeric", month: "long" }), count: declaredNeeds })
                : t("Când îți vine salariul, notează-l și îți propun împărțirea pe plicuri, după cele {count} cheltuieli declarate.", { count: declaredNeeds })}
            </p>
            <button type="button" className="bf-primary os-start-cta" onClick={() => window.dispatchEvent(new Event("buget-familie:open-income"))}>{t("Notează salariul")}</button>
            <button type="button" className="bf-secondary" onClick={onAdd}>{t("Notează o cheltuială")}</button>
          </div>
        ) : fresh ? (
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
            <h1 className="os-amount">
              <span>{overPlan && !duesShort ? "−" : ""}{heroShown.toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <small>RON</small>
            </h1>
            {/* Eticheta spune mereu ce e cifra; lipsa partenerului e o notă dedesubt, nu în locul ei. */}
            <p className="os-hero-label">{heroLabel}</p>
            <p className="os-hint" role={quietPartners.length && !overPlan ? "status" : undefined}>{overPlan ? heroHint : quietPartners.length === 1 ? t("{name} n-a notat încă azi: cifra poate fi mai mică.", { name: quietPartners[0] }) : quietPartners.length > 1 ? t("{names} n-au notat încă azi: cifra poate fi mai mică.", { names: quietPartners.join(", ") }) : heroHint}</p>
            <div className="bf-hero-chips">
              {isPaydayDue
                ? <button type="button" className="bf-hero-chip" onClick={() => window.dispatchEvent(new Event("buget-familie:open-payday"))}>{t("A intrat salariul")}</button>
                : salaryMissing && <button type="button" className="bf-hero-chip" onClick={() => window.dispatchEvent(new Event("buget-familie:open-income"))}>{t("Notează salariul")}</button>}
              <button type="button" className="bf-hero-chip" aria-expanded={whereOpen} onClick={() => setWhereOpen((open) => !open)}>{t("Unde sunt banii · Mută")}</button>
            </div>
            {where && (
              <div className="bf-money-where" style={{ display: "grid", gap: 8, marginTop: 10 }} role="region" aria-label={t("Unde sunt banii")}>
                <p className="bf-kicker">{t("PE SURSE")}</p>
                <ul className="bf-money-where-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                  {where.sources.map((row) => <li key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{row.name}{row.owner && !row.name.includes(row.owner) ? ` · ${row.owner}` : ""}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(row.balance)}</b></li>)}
                  {!where.sources.length && <li><span>{t("Nicio sursă cu bani acum.")}</span></li>}
                </ul>
                {where.categories.length > 0 && <>
                  <p className="bf-kicker">{t("CHELTUIT LUNA ASTA, PE CATEGORII")}</p>
                  <ul className="bf-money-where-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                    {where.categories.map(([name, amount]) => <li key={name} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{t(name)}</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(amount)}</b></li>)}
                  </ul>
                </>}
                <button type="button" className="bf-primary full" onClick={() => window.dispatchEvent(new Event("buget-familie:open-transfer"))}>{t("Mută bani sau dă cuiva")}</button>
                <p className="bf-helper">{t("De exemplu, dai bani soției: alegi din ce sursă și „Cash” al ei. Nu e o cheltuială, doar se mută banii.")}</p>
              </div>
            )}
            <div className="bf-os-actions">
              <button type="button" className="bf-today-add bf-os-decide" onPointerDown={() => void import("@/components/QuickEntryPanel")} onClick={onAdd}><Plus size={18} /> {t("Notează")}</button>
            </div>
            {simpleMode || !rhythm.hasWeekly || brief.expired ? null : (
              <div className="bf-hero-week" aria-label={t("Pe zi")}>
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
                      aria-label={t("{label}: {amount}", { label: weekdayShort()[row.weekday], amount: row.isToday || row.isFuture ? t("{amount} de cheltuit", { amount: figureLabel }) : t("{amount} cheltuiți", { amount: figureLabel }) })}
                      onClick={() => setRhythmTip((current) => current === row.day ? null : row.day)}
                    >
                      <span>{weekdayShort()[row.weekday]}</span>
                      <b>{Math.round(figure).toLocaleString(getLocale())}</b>
                      <span className="bf-os-bar" aria-hidden="true"><i className={row.fill <= 0 ? "is-empty" : ""} style={{ height: `${row.fill}%` }} /></span>
                    </button>
                    );
                  })}
                </div>
                {/* Zilele trecute arată ce s-a cheltuit, azi și viitorul ce se poate cheltui: se spune, nu se ghicește. */}
                {rhythm.days.some((row) => !row.isToday && !row.isFuture) && rhythm.days.some((row) => row.isToday || row.isFuture) && <p className="bf-os-legend">{t("Zilele trecute: cheltuit · de azi: cât poți cheltui")}</p>}
                {(() => {
                  // D13: detaliul zilei apare doar la atingerea unei zile; pentru azi, cifra e deja în erou.
                  const row = rhythm.days.find((item) => item.day === rhythmTip);
                  if (!row) return null;
                  const shown = dayStripFigure(row, heroTracksWeek ? brief.spendable : row.left, heroTracksWeek);
                  const leiExact = (value: number) => money(value);
                  const when = row.isToday ? t("Azi · {amount} rămași", { amount: leiExact(shown) }) : row.isFuture ? t("Viitor · {amount} pe zi", { amount: leiExact(row.left) }) : t("Trecut · {amount} cheltuiți", { amount: leiExact(row.out) });
                  return <ChartTip><b>{weekdayShort()[row.weekday]}</b><span>{when}</span><span>{t("Cheltuieli {amount}", { amount: leiExact(row.out) })}</span></ChartTip>;
                })()}
                {(!heroTracksWeek || rhythm.days.some((row) => row.isFuture)) && <p className="bf-os-note">{rhythmNote}</p>}
              </div>
            )}
            {(periodIncome > 0 || periodExpense > 0 || paydayIn !== undefined) && (
              <dl className="bf-cycle-strip" aria-label={t("În ciclul ăsta")}>
                {paydayIn !== undefined && <div><dt>{t("Până la salariu")}</dt><dd>{paydayIn === 0 ? t("azi") : daysLabel(paydayIn)}</dd></div>}
                <div><dt>{t("Intrat")}</dt><dd className="income">+{Math.round(periodIncome).toLocaleString(getLocale())} lei</dd></div>
                <div><dt>{t("Ieșit")}</dt><dd>{periodExpense >= 0.5 ? "−" : ""}{Math.round(periodExpense).toLocaleString(getLocale())} lei</dd></div>
              </dl>
            )}
            {ageLine && <p className="os-hint">{ageLine}</p>}
            {!simpleMode && spendFree >= 2 && <p className="os-hint bf-no-spend">{t("{count} zile fără cheltuieli luna asta. Fiecare lasă bani în plic.", { count: spendFree })}</p>}
            {mealLine && <p className="os-hint">{mealLine}</p>}
            {planHelp && <button type="button" className="bf-link-button bf-hero-plan-link" onClick={() => onGo("plan")}>{t("Pune bani în plic")} <ChevronRight size={14} aria-hidden="true" /></button>}
            {!simpleMode && pace && pace.allocationId !== runOutAlert?.allocationId && <p className="os-hint">{calendarPaceLine(pace)}</p>}
            {!simpleMode && againLine && <p className="os-hint">{againLine}</p>}
            {!simpleMode && (
              <div className="bf-hero-chips">
                {!simpleMode && <button type="button" className="bf-hero-chip" onClick={() => window.dispatchEvent(new Event("buget-familie:open-afford"))}>{t("Îmi permit…?")}</button>}
                {!simpleMode && weekRow && <button type="button" className="bf-hero-chip" aria-expanded={weekOpen} onClick={() => setWeekOpen((open) => !open)}>{t("Față de săptămâna trecută")}</button>}
                {!simpleMode && (focusGoal || trueExpense || weekShare) && <button type="button" className="bf-hero-chip" aria-expanded={moneyOpen} onClick={() => setMoneyOpen((open) => !open)}>{t("Obiectiv și evenimente")}</button>}
              </div>
            )}
            {weekOpen && !simpleMode && weekRow && (
              <div className="bf-week-vs" aria-label={t("Față de săptămâna trecută")}>
                <span>
                  <small>{t("Săptămâna asta")}</small>
                  <b>{money(weekRow.thisSpent)}</b>
                  <i aria-hidden="true"><em style={{ width: `${Math.round(weekRow.thisSpent / Math.max(weekRow.thisSpent, weekRow.lastSpent, 1) * 100)}%` }} /></i>
                </span>
                <span>
                  <small>{t("Săptămâna trecută")}</small>
                  <b>{money(weekRow.lastSpent)}</b>
                  <i aria-hidden="true"><em style={{ width: `${Math.round(weekRow.lastSpent / Math.max(weekRow.thisSpent, weekRow.lastSpent, 1) * 100)}%` }} /></i>
                </span>
              </div>
            )}
            {weekOpen && !simpleMode && weekRow && weekRow.byDay.length > 1 && (
              <div className="bf-week-days" style={{ ["--d" as string]: String(weekRow.byDay.length) }} aria-label={t("Față de săptămâna trecută")}>
                {weekRow.byDay.map((day) => {
                  const peak = Math.max(1, ...weekRow.byDay.flatMap((item) => [item.thisSpent, item.lastSpent]));
                  const bar = (amount: number) => (amount > 0 ? `${Math.max(14, Math.round((amount / peak) * 100))}%` : "0");
                  return (
                    <span key={day.weekday}>
                      <small>{weekdayShort()[day.weekday]}</small>
                      <i aria-hidden="true">
                        <em style={{ height: bar(day.thisSpent) }} />
                        <em style={{ height: bar(day.lastSpent) }} />
                      </i>
                    </span>
                  );
                })}
              </div>
            )}
            {weekOpen && !simpleMode && weekLine && <p className="os-hint">{weekLine}</p>}
            {moneyOpen && !simpleMode && focusGoal && (
              <button type="button" className="bf-glance-goal" onClick={() => onGo("goals")}>
                <PiggyBank size={16} aria-hidden="true" />
                <span>
                  <b>{focusGoal.name}</b>
                  <small>{t("mai sunt {left} · cam {monthly} pe lună", { left: money(focusGoal.left), monthly: money(focusGoal.monthly) })}</small>
                  <i aria-hidden="true"><em style={{ width: `${Math.min(100, Math.round((focusGoal.current / Math.max(1, focusGoal.target)) * 100))}%` }} /></i>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
            {moneyOpen && !simpleMode && trueExpense && (
              <button type="button" className="bf-glance-goal is-event" onClick={() => window.dispatchEvent(new Event("buget-familie:open-events"))}>
                <Gift size={16} aria-hidden="true" />
                <span>
                  <b>{trueExpense.name}</b>
                  <small>{t("pe {date} · mai lipsesc {left}", { date: formatDate(trueExpense.date, { day: "numeric", month: "short" }), left: money(trueExpense.left) })}</small>
                  <i aria-hidden="true"><em style={{ width: `${Math.min(100, Math.round((trueExpense.saved / Math.max(1, trueExpense.estimate)) * 100))}%` }} /></i>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
            {moneyOpen && !simpleMode && weekShare && <p className="os-hint">{weekShare}</p>}
            {!signals[0] && !held && <p className="os-next-line">{t("Următoarea acțiune: înregistrează o mișcare.")}</p>}
          </>
        )}
      </section>
      {otherPhoneLogged && (
        <p className="bf-partner-quiet">
          {t("Al doilea telefon a notat. Familia e {year} pe an, pentru toată casa.", { year: formatPlanPriceRon("familie", "year") })}
          {" "}
          <button type="button" className="bf-link-button" onClick={openFamilieCatalog}>{t("Vezi planul Familia")}</button>
        </p>
      )}
      {held && (
        <button type="button" className="bf-held-toggle" aria-expanded={dayMore} onClick={() => setDayMore((value) => !value)}>
          {dayMore ? t("Mai puțin din ziua asta") : t("Mai mult din ziua asta")}
        </button>
      )}
      {held && !dayMore && healthPulse}
      {/* Cifra zilei întâi: avertizările vin imediat sub ea, nu o împing sub pliu. */}
      {!simpleMode && showTrancheNotice && activeTranche && !topNotice && (
        <aside className="bf-weekly-tranche-notice" role="status" aria-live="polite">
          <CalendarClock size={19} />
          <div>
            <p>{t("A ÎNCEPUT SĂPTĂMÂNA {index}", { index: activeTranche.index })}</p>
            <strong>{formatDate(activeTranche.start, { day: "2-digit", month: "short" })} – {formatDate(activeTranche.end, { day: "2-digit", month: "short" })}</strong>
            <span>{t("Săptămâna aceasta are {amount} pentru {days} {dayLabel}.", { amount: money(activeTranche.amount), days: activeTranche.days, dayLabel: activeTranche.days === 1 ? t("zi") : t("zile") })}{activeTranche.graceDays ? " " + t("Dacă salariul întârzie, mai acoperă {count} zile.", { count: activeTranche.graceDays }) : ""}</span>
          </div>
          <button onClick={() => onGo("plan")}>{t("Plicuri")}</button>
          <button className="dismiss" aria-label={t("Ascunde anunțul săptămânii")} onClick={() => setShownTrancheKey("")}><X size={16} /></button>
        </aside>
      )}
      {!simpleMode && fastWeek && topNotice === "fast" && (
        <aside className={`bf-envelope-live-notice ${fastWeek.over ? "over" : "watch"}`} role="status" aria-live="polite">
          <BellRing size={19} />
          <div>
            <small>{fastWeek.over ? t("SĂPTĂMÂNA E DEPĂȘITĂ") : t("SĂPTĂMÂNA MERGE REPEDE")}</small>
            <strong>{t("{label} · S{index}", { label: fastWeek.label, index: fastWeek.weekIndex })}</strong>
            <span>{fastWeek.over
              ? t("{spent} din {budget}, peste cu {amount}. Se scade din ce rămâne în plic.", { spent: money(fastWeek.spent), budget: money(fastWeek.budget), amount: money(-fastWeek.remaining) })
              : fastWeek.daysLeft > 1
                ? t("{spent} din {budget}, mai sunt {days}. Azi cel mult {today}, apoi cam {future} pe zi.", { spent: money(fastWeek.spent), budget: money(fastWeek.budget), days: daysLabel(fastWeek.daysLeft), today: money(fastWeek.todayLeft), future: money(fastWeek.futureShare) })
                : t("{spent} din {budget}; azi mai sunt {today}.", { spent: money(fastWeek.spent), budget: money(fastWeek.budget), today: money(fastWeek.todayLeft) })}</span>
          </div>
          <button onClick={() => onGo("plan")}>{t("Vezi")}</button>
          <button className="dismiss" style={{ flex: "none", minWidth: 36 }} aria-label={t("Ascunde alerta pentru {label}", { label: fastWeek.label })} onClick={() => setDismissedAlerts((current) => [...current, `week-${fastWeek.allocationId}-${fastWeek.weekIndex}`])}><X size={16} /></button>
        </aside>
      )}
      {!simpleMode && runOutAlert && topNotice === "runout" && (
        <aside className="bf-envelope-live-notice watch" role="status" aria-live="polite">
          <BellRing size={19} />
          <div>
            <small>{t("SE TERMINĂ ÎNAINTE DE SALARIU")}</small>
            <strong>{runOutAlert.label}</strong>
            <span>{t("Ajunge la zero pe {date}. Ca să țină până la salariu: cel mult {safe} pe zi (acum {rate}).", { date: formatDate(runOutAlert.runOutDate, { day: "numeric", month: "long" }), safe: money(runOutAlert.safeDaily), rate: money(runOutAlert.dailyRate) })}{extend ? ` ${t("Poți muta {move} din {from}.", { move: money(extend.amount), from: extend.fromLabel })}` : ""}</span>
          </div>
          <button onClick={() => (extend ? applyMove(extend) : onGo("plan"))}>{extend ? t("Mută") : t("Vezi")}</button>
          <button className="dismiss" style={{ flex: "none", minWidth: 36 }} aria-label={t("Ascunde alerta pentru {label}", { label: runOutAlert.label })} onClick={() => setDismissedAlerts((current) => [...current, runOutAlert.allocationId])}><X size={16} /></button>
        </aside>
      )}
      {activeEnvelopeAlert && topNotice === "envelope" && (!simpleMode || activeEnvelopeAlert.state === "over") && (
        <aside className={`bf-envelope-live-notice ${activeEnvelopeAlert.state}`} role="status" aria-live="polite">
          <BellRing size={19} />
          <div>
            <small>{activeEnvelopeAlert.state === "over" ? t("PLIC DEPĂȘIT") : t("APROAPE DE LIMITĂ")}</small>
            <strong>{activeEnvelopeAlert.item.label}</strong>
            <span>{activeEnvelopeAlert.state === "over"
              ? cover
                ? t("{amount} peste limită. Poți muta {move} din {from}.", { amount: money(Math.abs(activeEnvelopeAlert.remaining)), move: money(cover.amount), from: cover.fromLabel })
                : t("{amount} peste limita alocată.", { amount: money(Math.abs(activeEnvelopeAlert.remaining)) })
              : t("{pct}% din limită este deja consumată.", { pct: Math.round(activeEnvelopeAlert.usage * 100) })}</span>
          </div>
          <button onClick={() => (cover ? applyMove(cover) : onGo("plan"))}>{cover ? t("Mută") : t("Vezi")}</button>
          <button className="dismiss" style={{ flex: "none", minWidth: 36 }} aria-label={t("Ascunde alerta pentru {label}", { label: activeEnvelopeAlert.item.label })} onClick={() => setDismissedAlerts((current) => [...current, activeEnvelopeAlert.item.id])}><X size={16} /></button>
        </aside>
      )}
      {topNotice && moreNotices > 0 && (
        <button type="button" className="bf-notice-more" onClick={() => onGo("plan")}>{moreNotices === 1 ? t("Încă o alertă la plicuri — vezi în Plicuri") : t("Încă {count} alerte la plicuri — vezi în Plicuri", { count: moreNotices })}</button>
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

      {recapReport && !recapReport.empty && (
        <aside className="bf-month-card-cta" aria-label={t("Imaginea lunii")}>
          <span className="bf-month-card-cta-icon" aria-hidden="true"><ImageIcon size={18} /></span>
          <button type="button" className="bf-month-card-cta-open" onClick={() => setRecapOpen(true)}>
            <b>{t("{month} s-a încheiat", { month: recapReport.title.charAt(0).toLocaleUpperCase() + recapReport.title.slice(1) })}</b>
            <small>{t("Vezi luna într-o imagine și trimite-o familiei.")}</small>
          </button>
          <button type="button" className="bf-month-card-cta-close" aria-label={t("Ascunde imaginea lunii")} onClick={hideRecap}><X size={16} /></button>
        </aside>
      )}
      <HouseOfferCard data={data} />
      <YearRecapEntry data={data} seasonal />
      {shoppingTodo > 0 && <button type="button" className="bf-shop-chip" onClick={() => window.dispatchEvent(new Event("buget-familie:open-shopping"))}><ListChecks size={17} aria-hidden="true" /><span>{t("Lista de cumpărături")}</span><b>{t("{count} de luat", { count: shoppingTodo })}</b></button>}
      {recapOpen && recapReport && <Suspense fallback={null}><MonthShareSheet report={recapReport} onClose={() => { setRecapOpen(false); hideRecap(); }} /></Suspense>}
      {coach}

      {/* D10: pe desktop coloana din dreapta; pe telefon, doar un grup în flux. */}
      <div className="bf-today-side">
      {!simpleMode && glance.length > 0 && (
        <section className="bf-envelope-strip-wrap" aria-labelledby="bf-glance-title">
          <div className="bf-section-heading">
            <h2 id="bf-glance-title">{t("Plicurile tale")}</h2>
            <button type="button" onClick={() => onGo("plan")}>{t("Toate plicurile")} <ChevronRight size={15} /></button>
          </div>
          <ul className="bf-envelope-strip">
            {glance.map((row) => {
              const used = Math.min(100, Math.round(Math.max(0, row.usage) * 100));
              const label = row.state === "over" ? t("peste cu {amount}", { amount: money(Math.abs(row.remaining)) }) : t("din {amount}", { amount: money(row.budget) });
              return (
                <li key={row.item.id} className={row.state === "over" ? "is-over" : row.state === "watch" ? "is-watch" : ""} style={{ ...categoryTone(row.item.category || row.item.label), ["--bf-used" as string]: String(used) }}>
                  <button type="button" onClick={() => onGo("plan")} aria-label={t("{label}: {left} rămași, {label2}", { label: row.item.label, left: money(Math.max(0, row.remaining)), label2: label })}>
                    <span className="bf-envelope-ring" aria-hidden="true"><CategoryGlyph category={row.item.category || row.item.label} size={18} /></span>
                    <b>{row.item.label}</b>
                    <strong>{money(Math.max(0, row.remaining))}</strong>
                    <small>{label}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {data.settings.trip && <Suspense fallback={null}><TripTodayCard data={data} today={todayIso} /></Suspense>}
      {advisorMonth && <button type="button" className="bf-challenge bf-trip-today" onClick={() => window.dispatchEvent(new Event("buget-familie:open-advisor"))}>
        <span className="bf-challenge-icon" aria-hidden="true"><FileBarChart size={18} /></span>
        <span><span className="bf-challenge-kicker">{t("RAPORTUL LUNII")}</span><b>{t("{month} e gata de citit.", { month: monthTitle(advisorMonth) })}</b><small>{t("Ce a mers, ce nu și trei lucruri de făcut luna asta.")}</small></span>
      </button>}
      {nearPayday && <Suspense fallback={null}><MonthEndCard data={data} today={todayIso} onChange={onChange} /></Suspense>}
      {!simpleMode && <Suspense fallback={null}><MonthChallengeCard data={data} today={todayIso} /></Suspense>}
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
                  : item.allocationId === "outside" && data.settings.salaryPlan.allocations.length
                    ? t("în afara plicurilor")
                    : undefined;
                return (
                <article key={item.id} role="button" tabIndex={0} onClick={() => onEdit(item)} onKeyDown={(event) => { if (event.key === "Enter") onEdit(item); }}>
                  <span className={`bf-tx-icon ${item.kind}`} style={item.kind === "income" ? undefined : categoryTone(item.category)}>{item.kind === "income" ? <ArrowDownRight size={16} /> : <CategoryGlyph category={item.category} size={16} />}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>{(() => {
                      const stamp = item.updatedAt || item.createdAt;
                      const ms = stamp ? Date.now() - Date.parse(stamp) : NaN;
                      // „acum” doar pentru mișcările de azi: o corectură a bonului de ieri arată tot ziua bonului.
                      const when = item.date !== isoToday()
                        ? dateText(item.date)
                        : Number.isFinite(ms) && ms >= 0 && ms < 60_000
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


      {!simpleMode && <OpeningBalanceCard data={data} onChange={onChange} />}

      <TodayBrief data={data} onGo={onGo} onChange={onChange} onOpenRecurring={onOpenRecurring} hideSpendStamp simpleMode={simpleMode} onOpenWeek={simpleMode ? undefined : () => { setDayMore(true); window.setTimeout(() => document.getElementById("bf-week-checkin")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40); }} />
      {rise && (
        <aside className="bf-price-rise" role="status">
          <CreditCard size={18} aria-hidden="true" />
          <span>{t("{name} s-a scumpit: {from} → {to}.", { name: rise.name, from: money(rise.from), to: money(rise.to) })}</span>
          <button type="button" className="bf-secondary" onClick={() => { const next = acceptRecurringPrice(data, rise.recurringId); if (next) onChange(next); }}>{t("Pune prețul nou")}</button>
          <button type="button" className="bf-brief-check-later" onClick={() => setPriceLater(true)}>{t("Mai târziu")}</button>
        </aside>
      )}

      {!simpleMode && (
        <section className="bf-today-more">
          <button type="button" className="bf-today-more-toggle" aria-expanded={dayMore} onClick={() => setDayMore((value) => !value)}>
            {dayMore ? t("Mai puțin din ziua asta") : t("Mai mult din ziua asta")}
          </button>
          {!held && !dayMore && healthPulse}
          {dayMore && (
            <>
              {data.pendingReview.length === 0 && nextStep && <NextStepCard signal={nextStep} onOpen={() => openSignal(nextStep.action)} />}
              {(() => {
                // Copia de siguranță la vedere: pierderea telefonului fără copie e cel mai mare risc pentru registru.
                const backup = readAutoBackup();
                const stamps = [backup.lastAt, backup.live && !backup.liveError ? backup.liveAt : undefined].map((value) => (value ? Date.parse(value) : NaN)).filter(Number.isFinite);
                const days = stamps.length ? Math.floor((Date.now() - Math.max(...stamps)) / 86_400_000) : null;
                return (
                  <p className={`bf-today-backup-line${days === null || days > 30 ? " is-old" : ""}`}>
                    <span>{days === null ? t("Nicio copie de siguranță încă.") : days === 0 ? t("Ultima copie de siguranță: azi.") : t("Ultima copie de siguranță: acum {days}.", { days: daysLabel(days) })}</span>
                    <button type="button" className="bf-link-button" onClick={onOpenSettings}>{days === null || days > 7 ? t("Fă o copie") : t("Copii de siguranță")}</button>
                  </p>
                );
              })()}
              <div className="bf-today-explainers">
                <button type="button" className="os-explainer secondary" onClick={() => setSafeSheetOpen(true)}>
                  <Info size={16} aria-hidden="true" /> {t("Cum se citește?")}
                </button>
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
                  <HealthScoreBadge data={data} onGo={onGo} />
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
      </div>

      {safeSheetOpen && (
        <Suspense fallback={null}>
          <SafeSpendSheet data={data} onClose={() => setSafeSheetOpen(false)} onGoPlan={() => { setSafeSheetOpen(false); onGo("plan"); }} />
        </Suspense>
      )}

    </div>
  );
}

