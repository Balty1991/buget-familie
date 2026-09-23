/**
 * Atelier Financiar — Plan pe categorii: fiecare plic își declară o singură dată suma; totalul e suma lor.
 * Filosofie: o familie adaugă bani direct pe categorii, unele cu ritm săptămânal, altele doar cu un total.
 * Perioada e opțională și comună — servește doar categoriilor cu ritm săptămânal; nu există o sumă „generală” separată.
 */
import "../envelope-weekly-toggle.css";
import "../week-transfer.css";
import "../plan-header-stat.css";
import "../plan-studio.css";
import "../envelope-source.css";
import "../envelope-transfer.css";
import "../envelope-insights.css";
import { useState } from "react";
import { createPortal } from "react-dom";
import { BookmarkPlus, Check, ChevronDown, FileDown, Pencil, Plus, Sparkles, Trash2, WalletCards } from "lucide-react";
import { EnvelopeEmptyArt, EnvelopeMark } from "@/components/EnvelopeMark";
import { calendarBudget, remainingPace, startedWeekShare, totalFromWeeklyPace, weeklyPaceFromTotal } from "@/lib/calendar-budget";
import { levelStartedWeek, spreadStartedWeekSurplus, startedWeekPlan } from "@/lib/started-week";
import { downloadCalendarPlanPdf } from "@/lib/calendar-plan-pdf";
import { AllocationHistoryPanel } from "@/components/AllocationHistoryPanel";
import { CycleClosePanel } from "@/components/CycleClosePanel";
import { AllocationRecommendationsPanel } from "@/components/AllocationRecommendationsPanel";
import { EnvelopeTransferPanel } from "@/components/EnvelopeTransferPanel";
import { MonthlyAllocationWizard } from "@/components/MonthlyAllocationWizard";
import { SalaryRitualPanel } from "@/components/SalaryRitualPanel";
import { allocationStatus, allocationWeekStatus, allocationWeeksStatus, addIsoDays, appendAllocationHistory, expenseCategories, formatDate, isoDate, isoToday, isWeeklyPaced, newId, parseRomanianAmount, paydayWindow, planAllocationMath, planEndDate, planWeeklyCycle, sourceFreeBalance, suggestWeeklyAllocationsFromCashflow, transferBetweenWeeks, type AppData, type BudgetAllocation } from "@/lib/finance-data";
import { envelopeBurnPace } from "@/lib/household-insights";
import { daysLabel, envelopesLabel, getLocale, t } from "@/lib/i18n";
import { leiLabel } from "@/lib/chart-ui";
import { hasSeenEnvelopeGlossary, markEnvelopeGlossarySeen } from "@/lib/ui-prefs";
import { EnvelopeConflictBadge, EnvelopeConflictBanner } from "@/components/EnvelopeConflictBanner";
import { canAddEnvelope, PLANS } from "@/lib/entitlements";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const thresholdOptions = [50, 60, 70, 80, 90, 95];
const daysBetween = (start: string, end: string) => Math.floor((new Date(`${end}T12:00:00`).valueOf() - new Date(`${start}T12:00:00`).valueOf()) / 86_400_000) + 1;

const QUICK_ENVELOPE_PRESETS = [
  { category: "Alimente", amount: "1500", weekly: true },
  { category: "Transport", amount: "400", weekly: true },
  { category: "Casă & facturi", amount: "800", weekly: false },
  { category: "Abonamente", amount: "150", weekly: false },
  { category: "Consumabile copil", amount: "500", weekly: true },
  { category: "Timp liber", amount: "300", weekly: true },
] as const;

function PlanField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="bf-plan-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function personName(data: AppData, memberId?: string) {
  return data.settings.members.find((member) => member.id === memberId)?.name || "Familie / comun";
}

function sourceName(data: AppData, sourceId?: string) {
  return data.settings.paymentSources.find((source) => source.id === sourceId)?.name || t("Orice sursă");
}

export function PlanStudio({ data, onChange, simpleMode = false }: { data: AppData; onChange: (data: AppData) => void; simpleMode?: boolean }) {
  const plan = data.settings.salaryPlan;
  const planEnd = planEndDate(plan);
  const categories = [...expenseCategories, ...data.settings.customCategories.filter((category) => !expenseCategories.includes(category))];
  const [cycleStart, setCycleStart] = useState(plan.periodStart);
  const [cycleEnd, setCycleEnd] = useState(plan.nextPayday || "");
  const [cycleFlex, setCycleFlex] = useState(plan.paydayFlexDays ?? 3);
  const [cycleError, setCycleError] = useState("");
  const [cycleTemplateLabel, setCycleTemplateLabel] = useState("");
  const [templateRenameId, setTemplateRenameId] = useState("");
  const [templateRename, setTemplateRename] = useState("");
  const [allocationLabel, setAllocationLabel] = useState("");
  const [allocationCategory, setAllocationCategory] = useState(categories[0] || "Alimente");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationMemberId, setAllocationMemberId] = useState("");
  /* Prima sursă din listă e rareori cea potrivită: un card gol nu poate plăti niciun plic.
     Pornim de la sursa care chiar are bani liberi. */
  const richestSourceId = () => [...data.settings.paymentSources]
    .map((source) => ({ id: source.id, free: sourceFreeBalance(data, source.id).free }))
    .sort((left, right) => right.free - left.free)[0]?.id || data.settings.paymentSources[0]?.id || "";
  const [allocationSourceId, setAllocationSourceId] = useState(() => richestSourceId());
  const [allocationNote, setAllocationNote] = useState("");
  const [allocationThreshold, setAllocationThreshold] = useState(80);
  const [allocationWeeklyPace, setAllocationWeeklyPace] = useState(true);
  /** „total” = suma pe toată perioada; „weekly” = cât revine unei săptămâni întregi. */
  const [allocationPaceMode, setAllocationPaceMode] = useState<"total" | "weekly">("total");
  /**
   * Când perioada e deja începută, zilele trecute nu mai pot primi bani. Comutatorul dă tranșei
   * curente doar partea zilelor rămase și trimite restul în săptămânile următoare, la salvare.
   */
  const [allocationLevelStarted, setAllocationLevelStarted] = useState(true);
  /** Completări din alte surse, când sursa principală nu acoperă singură plicul. */
  const [allocationFunding, setAllocationFunding] = useState<Array<{ sourceId: string; amount: string }>>([]);
  const [editingAllocationId, setEditingAllocationId] = useState("");
  const [allocationError, setAllocationError] = useState("");
  const [weekTransferAllocationId, setWeekTransferAllocationId] = useState("");
  const [weekTransferDirection, setWeekTransferDirection] = useState<"in" | "out">("in");
  const [weekTransferFromIndex, setWeekTransferFromIndex] = useState("");
  const [weekTransferAmount, setWeekTransferAmount] = useState("");
  const [weekTransferError, setWeekTransferError] = useState("");
  const [allocationPeriod, setAllocationPeriod] = useState<"next-income" | "month" | "week" | "custom">("next-income");
  const [allocationPreviewOpen, setAllocationPreviewOpen] = useState(false);
  const [planFlowOpen, setPlanFlowOpen] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationAmounts, setSimulationAmounts] = useState<Record<string, string>>({});
  const [showGlossary, setShowGlossary] = useState(() => !hasSeenEnvelopeGlossary());
  const [cashflowOpen, setCashflowOpen] = useState(false);
  const [cashflowDraft, setCashflowDraft] = useState<Record<string, string>>({});

  const periodValid = Boolean(cycleStart && cycleEnd && cycleEnd >= cycleStart);
  const weeklyPacedTotal = plan.allocations.filter((item) => isWeeklyPaced(item, plan)).reduce((sum, item) => sum + item.amount, 0);
  const activeCycle = planWeeklyCycle(data) || (planEnd && weeklyPacedTotal > 0 ? calendarBudget(weeklyPacedTotal, plan.periodStart, planEnd) : undefined);
  const activeWeek = activeCycle?.weeks.find((week) => isoToday() >= week.start && isoToday() <= week.end);
  const envelopes = plan.allocations.map((item) => ({ item, ...allocationStatus(data, item), week: isWeeklyPaced(item, plan) ? allocationWeekStatus(data, item) : undefined, weeks: isWeeklyPaced(item, plan) ? allocationWeeksStatus(data, item) : [] }));
  const allocated = envelopes.reduce((sum, envelope) => sum + envelope.budget, 0);
  const weekSpentByIndex = envelopes.reduce((all, envelope) => { envelope.weeks.forEach((week) => all.set(week.index, (all.get(week.index) || 0) + week.spent)); return all; }, new Map<number, number>());
  const { availableSources, scheduled, reservedInEnvelopes, unrepartized } = planAllocationMath(data);
  /**
   * Suma scrisă poate fi totalul pe perioadă sau ritmul unei săptămâni întregi. Plicul
   * păstrează mereu totalul — ritmul e doar felul în care îl scrii, tradus pe zile.
   */
  const paceByWeek = allocationWeeklyPace && Boolean(planEnd);
  /** Perioada e începută dacă ziua de azi cade după prima zi a ei — atunci contează doar zilele rămase. */
  const periodStarted = Boolean(planEnd) && isoToday() > plan.periodStart && isoToday() <= planEnd;
  const levelStarted = paceByWeek && periodStarted && allocationLevelStarted;
  /** Ritmul scris se traduce în total pe zilele care chiar mai pot primi bani. */
  const paceToday = levelStarted ? isoToday() : undefined;
  const allocationTotalFromInput = () => {
    const typed = parseRomanianAmount(allocationAmount);
    if (!paceByWeek || allocationPaceMode !== "weekly") return typed;
    return Math.round(totalFromWeeklyPace(typed, plan.periodStart, planEnd, paceToday));
  };
  const allocationTotal = allocationTotalFromInput();
  const previewPrevious = editingAllocationId ? plan.allocations.find((item) => item.id === editingAllocationId) : undefined;
  const previewOldRemaining = previewPrevious ? Math.max(0, allocationStatus(data, previewPrevious).remaining) : 0;
  const previewNextRemaining = allocationTotal > 0
    ? Math.max(0, allocationStatus(data, previewPrevious
      ? { ...previewPrevious, amount: allocationTotal }
      : { id: "preview", label: allocationLabel || allocationCategory, amount: allocationTotal, category: allocationCategory, sourceId: allocationSourceId || undefined, memberId: allocationMemberId || undefined, weeklyPace: allocationWeeklyPace ? undefined : false }).remaining)
    : 0;
  const previewAfter = unrepartized - previewNextRemaining + previewOldRemaining;
  const allocationPreview = planEnd ? calendarBudget(allocationTotal, plan.periodStart, planEnd) : undefined;
  /** Câți bani i-ar reveni tranșei începute din suma scrisă, ca să se vadă înainte de salvare. */
  const allocationStartedShare = (() => {
    if (!levelStarted || allocationTotal <= 0) return undefined;
    const current = allocationPreview?.weeks.find((week) => isoToday() >= week.start && isoToday() <= week.end);
    return current ? startedWeekShare(current, isoToday(), remainingPace(allocationTotal, planEnd, isoToday())) : undefined;
  })();
  /**
   * Două feluri de a împărți banii nerepartizați, ca familia să aleagă, nu să ghicească.
   * „De azi” socotește doar zilele rămase: o săptămână începută joi primește partea a patru zile,
   * nu a șapte. „Perioada întreagă” lasă tranșa curentă cu bugetul ei plin — mai lejer acum,
   * mai strâns până la venit. Ambele repartizează exact aceiași bani.
   */
  const paceOptions = (() => {
    /* Variantele se socotesc pe suma scrisă în câmp, nu pe toți banii liberi: dacă omul a
       hotărât că plicul ăsta ia 1.800, nu are ce face cu o împărțire a celor 2.200 din casă.
       Doar cu câmpul gol se propune întreg disponibilul. */
    const base = allocationTotal > 0 ? allocationTotal : unrepartized;
    if (!paceByWeek || base <= 0) return [];
    const today = isoToday();
    const cycle = calendarBudget(base, plan.periodStart, planEnd);
    const current = cycle?.weeks.find((week) => today >= week.start && today <= week.end);
    const pace = remainingPace(base, planEnd, today > plan.periodStart ? today : plan.periodStart);
    if (!pace || !cycle) return [];
    const share = current ? startedWeekShare(current, today, pace) : undefined;
    const started = Boolean(share && share.daysLeft < share.daysTotal);
    const options = [{
      id: "even",
      weekly: Math.round(pace.weekly),
      level: true,
      title: started ? t("De azi, egal pe zile") : t("Egal pe toată perioada"),
      detail: started && share
        ? t("{days} rămase din S{index} primesc {fair}, apoi {weekly} pe săptămână întreagă — ≈{perDay} pe zi peste tot.", { days: daysLabel(share.daysLeft), index: String(current?.index ?? 1), fair: money(share.fair), weekly: money(Math.round(pace.weekly)), perDay: money(pace.perDay) })
        : t("{weekly} pe fiecare săptămână întreagă, ≈{perDay} pe zi.", { weekly: money(Math.round(pace.weekly)), perDay: money(pace.perDay) }),
    }];
    if (started && current && share) {
      const wholeWeekly = weeklyPaceFromTotal(base, plan.periodStart, planEnd);
      options.push({
        id: "whole",
        weekly: Math.round(wholeWeekly),
        level: false,
        title: t("Săptămâna începută rămâne întreagă"),
        detail: t("S{index} păstrează {amount} pentru {days} rămase, apoi {weekly} pe săptămână — mai lejer acum, mai strâns până la venit.", { index: String(current.index), amount: money(current.amount), days: daysLabel(share.daysLeft), weekly: money(Math.round(wholeWeekly)) }),
      });
    }
    return options;
  })();
  const simulationTotal = plan.allocations.reduce((sum, item) => sum + Math.max(0, parseRomanianAmount(simulationAmounts[item.id] ?? String(item.amount))), 0);
  const simulationRemainder = availableSources - scheduled - simulationTotal;
  const openSimulation = () => { setSimulationAmounts(Object.fromEntries(plan.allocations.map((item) => [item.id, String(item.amount)]))); setSimulationOpen(true); };
  const applySimulation = () => { const changes = plan.allocations.map((item) => ({ id: item.id, amount: Math.max(0, parseRomanianAmount(simulationAmounts[item.id] ?? String(item.amount))) })).filter((change) => change.amount !== plan.allocations.find((item) => item.id === change.id)?.amount); applyMonthlyAllocation(changes); setSimulationOpen(false); };
  const cashflowHint = suggestWeeklyAllocationsFromCashflow(data);
  const openCashflowSuggest = () => {
    setCashflowDraft(Object.fromEntries(cashflowHint.suggestions.map((item) => [item.allocationId, String(item.suggestedAmount)])));
    setCashflowOpen(true);
  };
  const applyCashflowSuggest = () => {
    const changes = cashflowHint.suggestions.map((item) => ({
      id: item.allocationId,
      amount: Math.max(0, parseRomanianAmount(cashflowDraft[item.allocationId] ?? String(item.suggestedAmount))),
    })).filter((change) => change.amount !== plan.allocations.find((item) => item.id === change.id)?.amount);
    if (changes.length) applyMonthlyAllocation(changes);
    setCashflowOpen(false);
  };
  const currentSourceOptions = data.settings.paymentSources.filter((source) => !allocationMemberId || !source.memberId || source.memberId === allocationMemberId);
  /**
   * Eticheta sursei arată banii care mai pot fi repartizați, nu soldul brut: ce stă deja în
   * plicuri plătite din sursa asta nu mai e disponibil pentru un plic nou. Când editezi un
   * plic, propria lui rezervă intră la loc în disponibil — altfel n-ai putea să-l salvezi.
   */
  const sourceAvailable = (sourceId: string) => sourceFreeBalance(data, sourceId, editingAllocationId || undefined);
  const wholeLei = (value: number) => Math.round(value).toLocaleString(getLocale());
  const sourceOptionLabel = (source: { id: string; name: string }) => {
    const { balance, free } = sourceAvailable(source.id);
    return Math.round(free) === Math.round(balance)
      ? `${source.name} · ${wholeLei(balance)}`
      : `${source.name} · ${wholeLei(free)} ${t("liberi din")} ${wholeLei(balance)}`;
  };
  const selectedSourceAvailable = allocationSourceId ? sourceAvailable(allocationSourceId) : undefined;
  /**
   * Acoperirea plicului: sursa principală plus completările, fiecare limitată la cât are
   * liber. Un plic fără bani în spate nu e un plan, e o dorință — de aceea suma se compară
   * cu ce chiar există, nu cu totalul casei.
   */
  const fundingEntries = allocationFunding
    .map((entry) => ({ sourceId: entry.sourceId, amount: Math.max(0, parseRomanianAmount(entry.amount)) }))
    .filter((entry) => entry.sourceId && entry.sourceId !== allocationSourceId && entry.amount > 0);
  const fundingTotal = Math.round(fundingEntries.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
  const fundingOverdrawn = fundingEntries.filter((entry) => entry.amount > sourceAvailable(entry.sourceId).free + 0.5);
  const fundingExcess = allocationTotal > 0 && fundingTotal > allocationTotal + 0.5;
  const primaryNeeded = Math.max(0, allocationTotal - fundingTotal);
  const primaryFree = selectedSourceAvailable?.free ?? 0;
  const covered = Math.min(primaryNeeded, primaryFree) + fundingTotal;
  const shortfall = Math.round(Math.max(0, allocationTotal - covered) * 100) / 100;
  /** Surse care mai au bani liberi și nu sunt deja folosite de acest plic. */
  const fundingCandidates = data.settings.paymentSources.filter((source) =>
    source.id !== allocationSourceId
    && !allocationFunding.some((entry) => entry.sourceId === source.id)
    && sourceAvailable(source.id).free > 0.5);
  /** Câți bani mai stau liberi în toată casa, dacă surplusul se caută în altă parte. */
  const freeElsewhere = Math.round(fundingCandidates.reduce((sum, source) => sum + sourceAvailable(source.id).free, 0) * 100) / 100;
  const overBudget = shortfall > 0.5 || fundingOverdrawn.length > 0 || fundingExcess;
  const sourceFreeHint = !selectedSourceAvailable
    ? undefined
    : Math.round(selectedSourceAvailable.reserved) <= 0
      ? undefined
      : selectedSourceAvailable.free > 0
        ? t("Din {balance} ai deja {reserved} în plicuri sau scadențe; liberi rămân {free}.", { balance: money(selectedSourceAvailable.balance), reserved: money(selectedSourceAvailable.reserved), free: money(selectedSourceAvailable.free) })
        : t("Toți banii din această sursă sunt deja repartizați.");

  const updatePlan = (patch: Partial<typeof plan>) => onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, ...patch, updatedAt: new Date().toISOString() } } });
  const addDays = (start: string, amount: number) => { const date = new Date(`${start || isoToday()}T12:00:00`); date.setDate(date.getDate() + amount); return isoDate(date); };
  const allocationPeriodOptions = [{ id: "next-income" as const, label: t("Până la următorul venit") }, { id: "month" as const, label: t("Luna aceasta") }, { id: "week" as const, label: t("Săptămâna aceasta") }, { id: "custom" as const, label: t("Personalizat") }];
  const selectAllocationPeriod = (periodId: typeof allocationPeriod) => { setAllocationPeriod(periodId); if (periodId === "next-income") { setCycleStart(plan.periodStart); setCycleEnd(plan.nextPayday || ""); } else if (periodId === "month") { const now = new Date(); setCycleStart(isoDate(new Date(now.getFullYear(), now.getMonth(), 1))); setCycleEnd(isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))); } else if (periodId === "week") { setCycleStart(isoToday()); setCycleEnd(addIsoDays(isoToday(), 6)); } };
  const resetAllocationBuilder = () => { setAllocationLabel(""); setAllocationCategory(categories[0] || "Alimente"); setAllocationAmount(""); setAllocationMemberId(""); setAllocationSourceId(richestSourceId()); setAllocationNote(""); setAllocationThreshold(80); setAllocationWeeklyPace(true); setAllocationFunding([]); setEditingAllocationId(""); setAllocationError(""); };

  const windowPayday = paydayWindow(plan);
  const persistCycle = (start: string, end: string, flex = cycleFlex) => {
    if (!start || !end || end < start) return;
    const earliest = flex > 0 ? addIsoDays(end, -flex) : undefined;
    updatePlan({ periodStart: start, nextPayday: end, paydayFlexDays: flex, earliestPayday: earliest && earliest >= start ? earliest : start });
    setCycleError("");
  };
  const autoApplyPeriod = () => {
    persistCycle(cycleStart, cycleEnd, cycleFlex);
  };
  const saveCycleTemplate = () => {
    if (!periodValid) return setCycleError(t("Alege perioada înainte de a salva șablonul."));
    const days = daysBetween(cycleStart, cycleEnd);
    const label = cycleTemplateLabel.trim() || `Ciclu de ${days} zile`;
    const now = new Date().toISOString();
    const duplicate = data.settings.salaryCycleTemplates.find((item) => item.label.toLocaleLowerCase("ro-RO") === label.toLocaleLowerCase("ro-RO"));
    const template = { id: duplicate?.id || newId("salary-cycle"), label, amount: 0, durationDays: days, updatedAt: now };
    onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: [template, ...data.settings.salaryCycleTemplates.filter((item) => item.id !== duplicate?.id)].slice(0, 12) } });
    setCycleTemplateLabel("");
  };
  const applyCycleTemplate = (template: AppData["settings"]["salaryCycleTemplates"][number]) => {
    const start = cycleStart || isoToday(); const end = addDays(start, template.durationDays - 1);
    setCycleStart(start); setCycleEnd(end); setCycleError("");
    persistCycle(start, end, cycleFlex);
  };
  const renameCycleTemplate = (id: string) => {
    const label = templateRename.trim(); if (!label) return;
    onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: data.settings.salaryCycleTemplates.map((item) => item.id === id ? { ...item, label: label.slice(0, 42), updatedAt: new Date().toISOString() } : item) } });
    setTemplateRenameId(""); setTemplateRename("");
  };
  const deleteCycleTemplate = (id: string, label: string) => { if (window.confirm(`Ștergi șablonul local „${label}”?`)) onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: data.settings.salaryCycleTemplates.filter((item) => item.id !== id) } }); };

  const saveAllocation = () => {
    const amount = allocationTotalFromInput();
    const source = data.settings.paymentSources.find((item) => item.id === allocationSourceId);
    const member = data.settings.members.find((item) => item.id === allocationMemberId);
    if (amount <= 0) return setAllocationError(t("Introdu suma pentru această categorie."));
    if (fundingExcess) return setAllocationError(t("Completările depășesc suma plicului. Scade-le sau mărește suma."));
    if (fundingOverdrawn.length) return setAllocationError(t("O completare cere mai mult decât are sursa liberă. Scade suma sau alege altă sursă."));
    if (shortfall > 0.5) {
      return setAllocationError(freeElsewhere > 0.5
        ? t("Mai lipsesc {amount}. Completează din altă sursă mai jos sau scade suma plicului.", { amount: money(shortfall) })
        : t("Mai lipsesc {amount} și nu mai sunt bani liberi în nicio sursă. Scade suma plicului.", { amount: money(shortfall) }));
    }
    if (!source) return setAllocationError(t("Alege sursa din care vei plăti această categorie."));
    if (!editingAllocationId && !canAddEnvelope(plan.allocations.length)) {
      return setAllocationError(t("Casa include până la {n} plicuri. Planul Familia deblochează plicuri nelimitate.", { n: String(PLANS.casa.envelopes) }));
    }
    const label = allocationLabel.trim() || `${allocationCategory}${member ? ` · ${member.name}` : ""}`;
    const next: BudgetAllocation = { id: editingAllocationId || newId("allocation"), label, amount, category: allocationCategory, memberId: member?.id, sourceId: source.id, funding: fundingEntries.length ? fundingEntries : undefined, note: allocationNote.trim() || undefined, alertThreshold: allocationThreshold, weeklyPace: allocationWeeklyPace ? undefined : false };
    const previous = editingAllocationId ? plan.allocations.find((item) => item.id === editingAllocationId) : undefined;
    const nextAllocations = editingAllocationId ? plan.allocations.map((item) => item.id === editingAllocationId ? next : item) : [...plan.allocations, next];
    const nextData = { ...data, settings: { ...data.settings, salaryPlan: { ...plan, allocations: nextAllocations, totalLimit: nextAllocations.reduce((sum, item) => sum + item.amount, 0), updatedAt: new Date().toISOString() } } };
    const saved = appendAllocationHistory(nextData, { kind: editingAllocationId ? "updated" : "created", allocationId: next.id, allocationLabel: label, amount, previousAmount: previous?.amount, newAmount: amount });
    onChange(levelStarted ? levelStartedWeek(saved, next.id) : saved);
    resetAllocationBuilder();
  };
  const editAllocation = (item: BudgetAllocation) => { setAllocationFunding((item.funding || []).map((entry) => ({ sourceId: entry.sourceId, amount: String(entry.amount) }))); setEditingAllocationId(item.id); setAllocationLabel(item.label); setAllocationCategory(item.category || categories[0] || "Alimente"); setAllocationAmount(String(item.amount)); setAllocationMemberId(item.memberId || ""); setAllocationSourceId(item.sourceId || data.settings.paymentSources[0]?.id || ""); setAllocationNote(item.note || ""); setAllocationThreshold(item.alertThreshold || 80); setAllocationWeeklyPace(item.weeklyPace !== false); setAllocationError(""); window.setTimeout(() => document.getElementById("bf-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  const applyRecommendation = (allocation: BudgetAllocation, amount: number) => { setEditingAllocationId(allocation.id); setAllocationLabel(allocation.label); setAllocationCategory(allocation.category || categories[0] || "Alimente"); setAllocationAmount(String(amount)); setAllocationMemberId(allocation.memberId || ""); setAllocationSourceId(allocation.sourceId || data.settings.paymentSources[0]?.id || ""); setAllocationNote(allocation.note || ""); setAllocationThreshold(allocation.alertThreshold || 80); setAllocationWeeklyPace(allocation.weeklyPace !== false); setAllocationError(""); window.setTimeout(() => document.getElementById("bf-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  const applyMonthlyAllocation = (changes: { id: string; amount: number }[]) => { let nextData = data; changes.forEach(({ id, amount }) => { const currentPlan = nextData.settings.salaryPlan; const previous = currentPlan.allocations.find((item) => item.id === id); if (!previous || previous.amount === amount) return; const nextAllocations = currentPlan.allocations.map((item) => item.id === id ? { ...item, amount } : item); const changedData = { ...nextData, settings: { ...nextData.settings, salaryPlan: { ...currentPlan, allocations: nextAllocations, totalLimit: nextAllocations.reduce((sum, item) => sum + item.amount, 0), updatedAt: new Date().toISOString() } } }; nextData = appendAllocationHistory(changedData, { kind: "updated", allocationId: id, allocationLabel: previous.label, amount, previousAmount: previous.amount, newAmount: amount }); }); if (nextData !== data) onChange(nextData); };
  const deleteAllocation = (id: string, label: string) => {
    if (!window.confirm(`Ștergi plicul „${label}”? Cheltuielile deja înregistrate rămân în jurnal.`)) return;
    const nextAllocations = plan.allocations.filter((item) => item.id !== id);
    const nextData = { ...data, settings: { ...data.settings, salaryPlan: { ...plan, allocations: nextAllocations, totalLimit: nextAllocations.reduce((sum, item) => sum + item.amount, 0), transfers: plan.transfers.filter((transfer) => transfer.fromAllocationId !== id && transfer.toAllocationId !== id), salaryAllocationRules: (plan.salaryAllocationRules || []).filter((rule) => rule.allocationId !== id) } } };
    onChange(appendAllocationHistory(nextData, { kind: "deleted", allocationId: id, allocationLabel: label, previousAmount: plan.allocations.find((item) => item.id === id)?.amount }));
  };
  const exportCyclePdf = async () => {
    if (!activeCycle) return;
    try {
      const weekSpent = Object.fromEntries(Array.from(weekSpentByIndex.entries()));
      await downloadCalendarPlanPdf(activeCycle, data.settings.familyName, {
        weekSpent,
        envelopes: envelopes.map(({ item, budget, remaining, spent }) => ({
          label: item.label,
          budget,
          spent,
          remaining,
        })),
      });
    } catch {
      setCycleError(t("PDF-ul nu a putut fi generat local. Încearcă din nou."));
    }
  };

  const openWeekTransfer = (allocationId: string) => { setWeekTransferAllocationId(allocationId); setWeekTransferDirection("in"); setWeekTransferFromIndex(""); setWeekTransferAmount(""); setWeekTransferError(""); };
  const closeWeekTransfer = () => { setWeekTransferAllocationId(""); setWeekTransferDirection("in"); setWeekTransferFromIndex(""); setWeekTransferAmount(""); setWeekTransferError(""); };
  /**
   * `currentWeekIndex` e tranșa din care se citește cardul. Direcția alege dacă banii vin
   * spre ea („aduc din altă săptămână”) sau pleacă din ea spre tranșa aleasă — aceeași
   * mișcare, în ambele sensuri, ca săptămâna 1 să nu fie doar destinație.
   */
  const applyWeekTransfer = (allocationId: string, currentWeekIndex: number) => {
    const otherWeekIndex = Number(weekTransferFromIndex);
    const amount = parseRomanianAmount(weekTransferAmount);
    const allocation = plan.allocations.find((item) => item.id === allocationId);
    if (!allocation) return setWeekTransferError(t("Plicul nu mai există în plan."));
    if (!otherWeekIndex) return setWeekTransferError(weekTransferDirection === "in" ? t("Alege săptămâna din care muți bani.") : t("Alege săptămâna în care muți bani."));
    if (amount <= 0) return setWeekTransferError(t("Introdu o sumă mai mare decât zero."));
    const fromWeekIndex = weekTransferDirection === "in" ? otherWeekIndex : currentWeekIndex;
    const toWeekIndex = weekTransferDirection === "in" ? currentWeekIndex : otherWeekIndex;
    const next = transferBetweenWeeks(data, { allocationId, fromWeekIndex, toWeekIndex, amount });
    if (!next) return setWeekTransferError(t("Suma depășește ce a mai rămas în săptămâna aleasă."));
    const transfer = next.settings.salaryPlan.weekTransfers?.[0];
    const updated = appendAllocationHistory(next, { kind: "week-transfer", referenceId: transfer?.id, allocationId, allocationLabel: allocation.label, amount, fromWeekIndex, toWeekIndex });
    onChange(updated);
    closeWeekTransfer();
  };

  /**
   * Săptămâna începută ține bugetul a șapte zile pentru zilele care au mai rămas. Surplusul
   * nu dispare: se împarte în tranșele următoare, proporțional cu zilele lor, prin aceleași
   * transferuri pe care le poți face și de mână (deci se văd în istoric și se pot desface).
   */
  const rebalanceStartedWeek = (allocationId: string, weekIndex: number, amount: number) => {
    const next = spreadStartedWeekSurplus(data, allocationId, weekIndex, amount);
    if (next !== data) onChange(next);
  };

  const hasPacedAllocations = plan.allocations.some((item) => item.weeklyPace !== false);
  const completedPlanSteps = Number(periodValid) + Number(envelopes.length > 0) + Number(Boolean(activeCycle));
  const nextPlanStep = !envelopes.length ? t("Adaugă primul plic") : hasPacedAllocations && !periodValid ? t("Setează perioada pentru ritm") : t("Verifică ritmul și consumul");
  const allocationHealth = unrepartized < 0 ? "attention" : unrepartized > 0 ? "ready" : "balanced";
  const allocationHealthLabel = allocationHealth === "attention" ? "Ai alocat peste soldul disponibil" : allocationHealth === "ready" ? t("Mai există bani de repartizat") : t("Banii disponibili sunt repartizați");
  const allocatedRatio = availableSources > 0 ? Math.min(1, Math.max(0, (availableSources - Math.max(0, unrepartized)) / availableSources)) : 0;
  const missingCategories = QUICK_ENVELOPE_PRESETS.filter((preset) => !plan.allocations.some((item) => item.category === preset.category));
  const quickStartPreset = (preset: (typeof QUICK_ENVELOPE_PRESETS)[number]) => {
    setAllocationCategory(preset.category);
    setAllocationLabel(preset.category);
    setAllocationAmount(preset.amount);
    setAllocationWeeklyPace(preset.weekly);
    setAllocationError("");
    setEditingAllocationId("");
    window.setTimeout(() => document.getElementById("bf-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <div className="bf-page bf-plan-workspace bf-salary-cycle-plan">
    {/* Un ciclu încheiat e cel mai important lucru de pe ecran: stă înaintea planului. */}
    <CycleClosePanel data={data} onChange={onChange} />
    <EnvelopeConflictBanner data={data} onChange={onChange} />
    <header className="bf-plan-studio-header bf-plan-hero-glass">
      <div className="bf-plan-hero-copy"><p className="bf-kicker">{t("PLANUL FAMILIEI, PE CATEGORII")}</p><h1>{t("Fiecare leu")} <em>{t("are un loc.")}</em></h1><p>{t("Adaugă câte o categorie cu suma ei. Totalul e suma categoriilor — nu introduci nicio sumă generală separat.")}</p></div>
      <div className="bf-plan-header-stat"><span><WalletCards size={20} /></span><small>{t("NEREPARTIZAȚI")}</small><b>{money(unrepartized)}</b></div>
    </header>

    {(simpleMode || showGlossary) && (
      <aside className={simpleMode ? "bf-plan-simple-tip" : "bf-envelope-glossary-tip"} role="note">
        <p className="bf-kicker">{t("PE SCURT")}</p>
        <b>{t("Plicul e o limită, nu un sold.")}</b>
        <p>{t("Banii stau în surse (card, cash). Plicul spune cât poți cheltui pe o categorie până la următorul venit — nu „mută” lei din cont.")}</p>
        {!simpleMode && <button type="button" className="bf-link-button" onClick={() => { markEnvelopeGlossarySeen(); setShowGlossary(false); }}>{t("Am înțeles")}</button>}
      </aside>
    )}
    <section className="bf-allocation-progress-card" aria-label="Progres repartizare">
      <div className="bf-allocation-progress-top">
        <div>
          <p className="bf-kicker">{t("PROGRES REPARTIZARE")}</p>
          <h2>{allocationHealth === "balanced" ? "Totul are un loc." : allocationHealth === "ready" ? t("Mai ai de așezat.") : t("Ajustează limitele.")}</h2>
        </div>
        <strong>{Math.round(allocatedRatio * 100)}%</strong>
      </div>
      <div
        className="bf-allocation-progress-track"
        role="progressbar"
        aria-label={t("Procentul banilor repartizați în plicuri")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(allocatedRatio * 100)}
      >
        <i aria-hidden="true" style={{ width: `${Math.round(allocatedRatio * 100)}%` }} className={allocationHealth} />
      </div>
      {/* Bara merge de la 0 la banii disponibili, deci partea „repartizați” trebuie să fie
          exact complementul celor rămași: rezerva din plicuri plus scadențele. Cu totalul
          planificat (care include și ce s-a cheltuit deja) cele două cifre nu se adunau la
          capătul axei, iar procentul părea greșit. */}
      <div className="bf-allocation-progress-meta">
        <span><b>{money(Math.max(0, availableSources - Math.max(0, unrepartized)))}</b> {t("repartizați")}</span>
        <span><b>{money(Math.max(0, unrepartized))}</b> {t("rămași")}</span>
      </div>
      <div className="bf-plan-allocation-axis" aria-hidden="true">
        <span>0 lei</span>
        <span>{leiLabel(Math.max(0, availableSources))}</span>
      </div>
      {missingCategories.length > 0 && (
        <div className="bf-quick-envelope-chips" aria-label={t("Pornire rapidă plicuri")}>
          <p><Sparkles size={14} /> {t("Pornește rapid")}</p>
          <div>
            {missingCategories.slice(0, 5).map((preset) => (
              <button key={preset.category} type="button" onClick={() => quickStartPreset(preset)}>
                {preset.category}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>

    <section className="bf-allocation-period" aria-labelledby="allocation-period-title"><div className="bf-allocation-period-heading"><div><p className="bf-kicker">{t("REPARTIZARE PE PERIOADĂ")}</p><h2 id="allocation-period-title">{t("Alege ritmul casei.")}</h2><p>{t("Vezi banii disponibili pentru intervalul în care iei decizia.")}</p></div><span>{money(Math.max(0, unrepartized))}<small>{t("rămași de repartizat")}</small></span></div><div className="bf-allocation-period-tabs" role="tablist" aria-label={t("Perioada repartizării")}>{allocationPeriodOptions.map((option) => <button key={option.id} role="tab" aria-selected={allocationPeriod === option.id} className={allocationPeriod === option.id ? "active" : ""} onClick={() => selectAllocationPeriod(option.id)}>{option.label}</button>)}</div><div className="bf-allocation-period-summary"><span><b>{money(availableSources)}</b><small>{t("disponibil în surse")}</small></span><span><b>{money(reservedInEnvelopes)}</b><small>{t("în plicuri")}</small></span><span><b>{money(scheduled)}</b><small>{t("scadențe rezervate")}</small></span><span><b>{money(Math.max(0, unrepartized))}</b><small>{t("de repartizat")}</small></span></div></section>


    <section className="bf-plan-cashflow-suggest" aria-labelledby="bf-cashflow-suggest-title">
      <div>
        <p className="bf-kicker">{t("DIN FLUXUL REAL")}</p>
        <h2 id="bf-cashflow-suggest-title">{t("Propunere pentru următoarele 7 zile")}</h2>
        <p>{t("Combină ultimele 7 zile de cheltuieli cu scadențele și obiectivele din săptămâna următoare. Tu confirmi fiecare sumă.")}</p>
      </div>
      <button type="button" className="bf-secondary" disabled={!plan.allocations.length || !cashflowHint.suggestions.length} onClick={openCashflowSuggest}>
        <Sparkles size={16} /> {t("Vezi propunerea")}
      </button>
    </section>
    {cashflowOpen && (
      <section className="bf-plan-simulation bf-plan-cashflow-panel" role="dialog" aria-modal="true" aria-labelledby="bf-cashflow-panel-title">
        <div className="bf-plan-simulation-heading">
          <div>
            <p className="bf-kicker">{t("SUGESTIE EDITABILĂ")}</p>
            <h2 id="bf-cashflow-panel-title">{t("Cheltuieli, scadențe și obiective → 7 zile")}</h2>
            <p>{t("Ajustează sumele, apoi aplică doar ce confirmi. Nimic nu se schimbă automat.")}</p>
          </div>
          <button type="button" className="bf-link-button" onClick={() => setCashflowOpen(false)}>{t("Închide")}</button>
        </div>
        <div className="bf-plan-simulation-list">
          {cashflowHint.suggestions.map((item) => (
            <label key={item.allocationId}>
              <span>
                <b>{item.label}</b>
                <small>{t("acum {current} · propus {actual}{dues}{goals}", { current: money(item.currentAmount), actual: money(item.suggestedAmount), dues: item.fromDues ? t(" · scadențe {amount}", { amount: money(item.fromDues) }) : "", goals: item.fromGoals ? t(" · obiective {amount}", { amount: money(item.fromGoals) }) : "" })}</small>
              </span>
              <input
                value={cashflowDraft[item.allocationId] ?? String(item.suggestedAmount)}
                onChange={(event) => setCashflowDraft((current) => ({ ...current, [item.allocationId]: event.target.value }))}
                inputMode="decimal"
                aria-label={t("Sumă propusă pentru {label}", { label: item.label })}
              />
            </label>
          ))}
        </div>
        {cashflowHint.unallocated.length > 0 && (
          <p className="bf-plan-simulation-note">
            {t("Categorii fără plic în ultimele 7 zile")}: {cashflowHint.unallocated.map((item) => `${item.category} ${money(item.amount)}`).join(" · ")}
          </p>
        )}
        <footer>
          <button type="button" onClick={() => setCashflowOpen(false)}>{t("Renunță")}</button>
          <button type="button" className="bf-primary" onClick={applyCashflowSuggest}><Check size={16} /> {t("Aplică sumele confirmate")}</button>
        </footer>
      </section>
    )}
    <section className="bf-plan-simulator" aria-labelledby="bf-plan-simulator-title"><div className="bf-plan-simulator-copy"><p className="bf-kicker">{t("SCENARIU FĂRĂ RISC")}</p><h2 id="bf-plan-simulator-title">{t("Testează planul înainte să-l schimbi.")}</h2><p>{t("Modifică sumele într-o copie temporară. Registrul și planul real rămân intacte până când confirmi.")}</p></div><button type="button" className="bf-secondary bf-plan-simulator-action" onClick={openSimulation} disabled={!plan.allocations.length}><Sparkles size={16} aria-hidden="true" /> {t("Deschide simularea")}</button></section>
    {simulationOpen && <section className="bf-plan-simulation" role="dialog" aria-modal="true" aria-labelledby="bf-plan-simulation-title"><div className="bf-plan-simulation-heading"><div><p className="bf-kicker">{t("SIMULARE LOCALĂ")}</p><h2 id="bf-plan-simulation-title">{t("Cum ar arăta o altă repartizare?")}</h2><p>{t("Aceste valori sunt temporare și nu sunt salvate automat.")}</p></div><button type="button" className="bf-link-button" onClick={() => setSimulationOpen(false)}>{t("Închide")}</button></div><div className="bf-plan-simulation-list">{plan.allocations.map((item) => <label key={item.id}><span><b>{item.label}</b><small>{item.category || "Categorie"} · acum {money(item.amount)}</small></span><input value={simulationAmounts[item.id] ?? String(item.amount)} onChange={(event) => setSimulationAmounts((current) => ({ ...current, [item.id]: event.target.value }))} inputMode="decimal" aria-label={`Suma simulată pentru ${item.label}`} /></label>)}</div><div className={`bf-plan-simulation-result ${simulationRemainder < 0 ? "negative" : "positive"}`}><span><small>{t("Total simulat")}</small><b>{money(simulationTotal)}</b></span><span><small>{t("Rămâne după scadențe")}</small><b>{money(simulationRemainder)}</b></span><span><small>{t("Interpretare")}</small><b>{simulationRemainder < 0 ? t("Peste disponibil") : simulationRemainder === 0 ? t("Echilibru") : t("Bani nealocați")}</b></span></div><p className="bf-plan-simulation-note">{simulationRemainder < 0 ? t("Scenariul depășește banii disponibili. Redu una dintre sume înainte de aplicare.") : simulationRemainder > 0 ? t("După repartizare rămân {amount} nealocați, disponibili pentru o nevoie viitoare.", { amount: money(simulationRemainder) }) : t("Scenariul acoperă disponibilul și scadențele fără surplus.")}</p><footer><button type="button" className="bf-ghost" onClick={() => setSimulationOpen(false)}>{t("Renunță")}</button><button type="button" className="bf-primary" disabled={simulationRemainder < 0} onClick={applySimulation}><Check size={16} /> {t("Aplică scenariul")}</button></footer></section>}
    {!simpleMode && <AllocationRecommendationsPanel data={data} allocations={plan.allocations} periodDays={periodValid ? daysBetween(cycleStart, cycleEnd) : 30} onApply={applyRecommendation} />}
    <section className={`bf-plan-flow ${planFlowOpen ? "expanded" : "compact"}`} aria-label={t("Progresul planului în trei pași")}><button type="button" className="bf-plan-flow-toggle" aria-expanded={planFlowOpen} onClick={() => setPlanFlowOpen((value) => !value)}><span>{planFlowOpen ? "Ascunde ghidul" : t("Arată ghidul complet")}</span><ChevronDown size={16} /></button>
      <div className="bf-plan-flow-summary"><div><p className="bf-kicker">{t("PLAN ÎN TREI PAȘI")}</p><h2>{nextPlanStep}</h2><span>{t("Configurația rămâne locală și poate fi ajustată oricând.")}</span></div><strong>{completedPlanSteps}<small>{t("/ 3 pregătit")}</small></strong></div>
      <ol>
        <li className={periodValid ? "complete" : "active"}><span>01</span><div><b>{t("Cadrul")}</b><small>{t("Perioadă opțională")}</small></div></li>
        <li className={envelopes.length ? "complete" : "active"}><span>02</span><div><b>{t("Plicurile")}</b><small>{envelopes.length ? t("{count} configurate", { count: envelopes.length }) : t("Adaugă categorii")}</small></div></li>
        <li className={activeCycle ? "complete" : "upcoming"}><span>03</span><div><b>{t("Ritmul")}</b><small>{activeCycle ? t("Gata de urmărit") : t("Se activează cu perioada")}</small></div></li>
      </ol>
    </section>

    {activeWeek && <section className="bf-active-week" aria-labelledby="active-week-title"><div><p className="bf-kicker">{t("ACUM · TRANȘA S{index}", { index: activeWeek.index })}</p><h2 id="active-week-title">{formatDate(activeWeek.start)} – {formatDate(activeWeek.end)}</h2><span>{t("Aceasta este săptămâna din care se vor scădea cheltuielile repartizate.")}</span></div><strong>{money(activeWeek.amount)}<small>{t("ritm total")}</small></strong></section>}

    <section className="bf-cycle-setup" aria-labelledby="cycle-setup-title">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">{t("CATEGORII")}</p><h2 id="cycle-setup-title">{t("Unde merge fiecare leu")}</h2></div><span>{envelopesLabel(envelopes.length)} · {money(allocated)}</span></div>
      <p>{t("Perioada e opțională — o folosesc doar categoriile cu ritm săptămânal. Data salariului poate varia; alege o fereastră, nu o zi exactă.")}</p>
      <div className="bf-cycle-setup-fields">
        <PlanField label={t("Prima zi a perioadei (opțional)")}><input type="date" value={cycleStart} onChange={(event) => { setCycleStart(event.target.value); setCycleError(""); }} onBlur={autoApplyPeriod} /></PlanField>
        <PlanField label={t("Data obișnuită a salariului")} hint={t("Alege ziua la care vine de obicei, nu trebuie să fie exactă.")}><input type="date" min={cycleStart || undefined} value={cycleEnd} onChange={(event) => { setCycleEnd(event.target.value); setCycleError(""); }} onBlur={autoApplyPeriod} /></PlanField>
        <PlanField label={t("Poate varia cu")} hint={t("Dacă salariul întârzie sau vine mai devreme.")}>
          <select value={cycleFlex} onChange={(event) => { const flex = Number(event.target.value); setCycleFlex(flex); persistCycle(cycleStart, cycleEnd, flex); }}>
            <option value={0}>{t("Nu variază")}</option>
            <option value={1}>± 1 zi</option>
            <option value={2}>± 2 zile</option>
            <option value={3}>± 3 zile</option>
            <option value={4}>± 4 zile</option>
            <option value={5}>± 5 zile</option>
          </select>
        </PlanField>
      </div>
      {windowPayday.typical && windowPayday.flex > 0 && <p className="bf-payday-window">Tranșele țin până pe {formatDate(windowPayday.typical)}. Dacă salariul întârzie, plicurile rămân active până pe {formatDate(windowPayday.latest)}; ritmul zilnic e calculat ca și cum ar veni pe {formatDate(windowPayday.earliest)}.</p>}
      {activeCycle && <div className="bf-cycle-tranches"><div><span>{t("RITM ORIENTATIV, DOAR CATEGORIILE CU RITM SĂPTĂMÂNAL")}</span><b>{money(activeCycle.weeklyAmount)} / {t("săptămână")}</b></div><details className="bf-cycle-tools"><summary><span>{t("Vezi cele {count} tranșe", { count: activeCycle.weeks.length })}</span><ChevronDown size={17} /></summary><ol>{activeCycle.weeks.map((week) => { const spent = weekSpentByIndex.get(week.index) || 0; return <li key={week.index}><span>S{week.index}</span><b>{formatDate(week.start)} – {formatDate(week.end)}</b><small>{t("{spent} cheltuiți din {amount}", { spent: money(spent), amount: money(week.amount) })}</small><strong>{money(Math.max(0, week.amount - spent))}</strong></li>; })}</ol></details></div>}
      {cycleError && <p className="bf-form-error" role="alert">{cycleError}</p>}
      <div className="bf-cycle-setup-actions"><button disabled={!activeCycle} onClick={() => void exportCyclePdf()}><FileDown size={17} /> {t("PDF plan")}</button></div>

      <section className={`bf-allocation-guidance ${allocationHealth}`} aria-labelledby="bf-allocation-guidance-title"><div className="bf-allocation-guidance-heading"><div><p className="bf-kicker">{t("REPARTIZARE GHIDATĂ")}</p><h2 id="bf-allocation-guidance-title">{unrepartized > 0 ? <>{t("Înainte să adaugi un plic, vezi")} <em>{t("ce mai trebuie acoperit.")}</em></> : unrepartized < 0 ? t("Plicurile depășesc disponibilul") : t("Banii disponibili sunt repartizați")}</h2><p>{allocationHealthLabel}. {t("Plicurile sunt limite de planificare; nu mută bani din card sau cash.")}</p></div><WalletCards size={23} aria-hidden="true" /></div><div className="bf-allocation-guidance-stats"><span><small>{t("Disponibil în surse")}</small><b>{money(Math.max(0, availableSources))}</b></span><span><small>{t("În plicuri")}</small><b>{money(Math.max(0, reservedInEnvelopes))}</b></span><span><small>{t("Scadențe")}</small><b>{money(Math.max(0, scheduled))}</b></span><span><small>{t("De repartizat")}</small><b>{money(Math.max(0, unrepartized))}</b></span></div>{unrepartized > 0 && <button type="button" className="bf-allocation-guidance-action" onClick={() => { setAllocationAmount(String(Math.round(unrepartized))); setAllocationError(""); document.getElementById("bf-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{t("Folosește suma nealocată pentru următorul plic")} <ChevronDown size={15} /></button>}{unrepartized < 0 && <p className="bf-form-error" role="alert">{t("Limitele plicurilor și scadențele depășesc soldul disponibil. Redu un plic sau verifică sursele înainte de a continua.")}</p>}</section><p className="bf-allocation-intro">{t("Adaugă o categorie pentru fiecare parte a banilor: alimente, taxi, abonamente, consumabile copil. La o cheltuială reală, alegi categoria și aplicația scade automat din plicul potrivit.")}</p>
      <div id="bf-allocation-builder" className="bf-allocation-builder">
        <PlanField label={t("Ce plătește plicul")}><select value={allocationCategory} onChange={(event) => setAllocationCategory(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></PlanField>
        <PlanField label={t("Nume plic")} hint={t("Poți scrie «Taxi soție» sau lăsa automat.")}><input value={allocationLabel} onChange={(event) => setAllocationLabel(event.target.value)} placeholder={t("ex. Alimente · card soție")} /></PlanField>
        <PlanField label={t("Membru")}><select value={allocationMemberId} onChange={(event) => { const memberId = event.target.value; setAllocationMemberId(memberId); const firstCompatible = data.settings.paymentSources.find((source) => !source.memberId || source.memberId === memberId); if (firstCompatible) setAllocationSourceId(firstCompatible.id); }}><option value="">{t("Familie")}</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></PlanField>
        {/* Sursa și completările ei stau într-un singur loc din grilă: regulile vechi de
            layout numără copiii, așa că un element în plus ar muta coloanele celorlalte câmpuri. */}
        <div className={`bf-source-field${allocationTotal > 0 && (shortfall > 0.5 || allocationFunding.length > 0) ? " is-funding" : ""}`}>
        <PlanField label={t("Plătit din")} hint={sourceFreeHint}><select value={allocationSourceId} onChange={(event) => setAllocationSourceId(event.target.value)}>{currentSourceOptions.map((source) => <option key={source.id} value={source.id}>{sourceOptionLabel(source)}</option>)}</select></PlanField>
        {/* Plicul se plătește din surse reale. Când cea aleasă nu ajunge, diferența se ia
            explicit din alta — 1.800 din cashul tău și 100 din al partenerei — în loc să fie
            promisă din bani care nu există. */}
        {allocationTotal > 0 && (shortfall > 0.5 || allocationFunding.length > 0) && (
          <div className="bf-funding">
            <p className={shortfall > 0.5 || fundingExcess ? "bf-funding-gap" : "bf-funding-ok"}>
              {fundingExcess
                ? t("Completările fac {funded}, mai mult decât plicul de {total}.", { funded: money(fundingTotal), total: money(allocationTotal) })
                : shortfall > 0.5
                ? t("{source} acoperă {covered} din {total}. Mai lipsesc {gap}.", { source: sourceName(data, allocationSourceId), covered: money(Math.max(0, covered)), total: money(allocationTotal), gap: money(shortfall) })
                : t("Acoperit integral: {total}.", { total: money(allocationTotal) })}
            </p>
            {allocationFunding.map((entry, index) => {
              const free = entry.sourceId ? sourceAvailable(entry.sourceId).free : 0;
              const asked = Math.max(0, parseRomanianAmount(entry.amount));
              return <div className="bf-funding-row" key={`${entry.sourceId}-${index}`}>
                <select value={entry.sourceId} aria-label={t("Sursa completării")} onChange={(event) => setAllocationFunding((current) => current.map((row, position) => position === index ? { ...row, sourceId: event.target.value } : row))}>
                  {data.settings.paymentSources.filter((source) => source.id !== allocationSourceId).map((source) => <option key={source.id} value={source.id}>{sourceOptionLabel(source)}</option>)}
                </select>
                <input value={entry.amount} inputMode="decimal" aria-label={t("Cât iei din această sursă")} onChange={(event) => { setAllocationFunding((current) => current.map((row, position) => position === index ? { ...row, amount: event.target.value } : row)); setAllocationError(""); }} />
                <button type="button" aria-label={t("Renunță la completare")} onClick={() => setAllocationFunding((current) => current.filter((_, position) => position !== index))}>×</button>
                {asked > free + 0.5 && <small className="bf-funding-over">{t("Liberi doar {amount}.", { amount: money(free) })}</small>}
              </div>;
            })}
            {shortfall > 0.5 && fundingCandidates.length > 0 && (
              <button type="button" className="bf-funding-add" onClick={() => { const best = fundingCandidates[0]; setAllocationFunding((current) => [...current, { sourceId: best.id, amount: String(Math.round(Math.min(shortfall, sourceAvailable(best.id).free))) }]); setAllocationError(""); }}>
                <Plus size={14} /> {t("Ia {amount} din {source}", { amount: money(Math.min(shortfall, sourceAvailable(fundingCandidates[0].id).free)), source: fundingCandidates[0].name })}
              </button>
            )}
            {shortfall > 0.5 && fundingCandidates.length === 0 && <small className="bf-funding-none">{t("Nu mai sunt bani liberi în nicio sursă. Scade suma plicului.")}</small>}
          </div>
        )}
        </div>
        {/* Un singur loc în grilă: câmpul sumei plus comutatorul „total / pe săptămână”.
            Regulile vechi de layout numără copiii, așa că tot ce ține de sumă stă împreună. */}
        <div className="bf-pace-field">
          <PlanField
            label={allocationPaceMode === "weekly" && paceByWeek ? t("Cât pe săptămână întreagă") : t("Suma acestei categorii")}
            hint={!allocationWeeklyPace
              ? t("Fără ritm săptămânal — contează doar totalul.")
              : !paceByWeek
                ? t("Alege perioada mai sus ca să vezi ritmul săptămânal.")
                : allocationPaceMode === "weekly"
                  ? (allocationTotal <= 0
                      ? t("Scrie cât vrei să ai la dispoziție într-o săptămână întreagă.")
                      : allocationStartedShare
                        ? t("{total} pentru zilele rămase, din care {fair} în săptămâna începută.", { total: money(allocationTotal), fair: money(allocationStartedShare.fair) })
                        : t("Total pe perioadă: {amount}.", { amount: money(allocationTotal) }))
                  : (allocationStartedShare
                      ? t("≈{weekly} pe săptămână întreagă, {fair} pentru zilele rămase din săptămâna începută.", { weekly: money(Math.round(weeklyPaceFromTotal(allocationTotal, plan.periodStart, planEnd, paceToday))), fair: money(allocationStartedShare.fair) })
                      : allocationPreview ? t("În fiecare săptămână: aproximativ {amount} din acest plic.", { amount: money(allocationPreview.weeklyAmount) }) : t("Alege perioada mai sus ca să vezi ritmul săptămânal."))}
          >
            <input value={allocationAmount} onChange={(event) => { setAllocationAmount(event.target.value); setAllocationError(""); }} inputMode="decimal" placeholder={allocationPaceMode === "weekly" ? "ex. 500" : "ex. 1200"} />
          </PlanField>
          {paceByWeek && (
            <div className="bf-pace-switch" role="group" aria-label={t("Cum scrii suma")}>
              <button type="button" className={allocationPaceMode === "total" ? "active" : ""} aria-pressed={allocationPaceMode === "total"} onClick={() => {
                if (allocationPaceMode === "total") return;
                const weekly = parseRomanianAmount(allocationAmount);
                setAllocationPaceMode("total");
                if (weekly > 0) setAllocationAmount(String(Math.round(totalFromWeeklyPace(weekly, plan.periodStart, planEnd, paceToday))));
              }}>{t("Total pe perioadă")}</button>
              <button type="button" className={allocationPaceMode === "weekly" ? "active" : ""} aria-pressed={allocationPaceMode === "weekly"} onClick={() => {
                if (allocationPaceMode === "weekly") return;
                const total = parseRomanianAmount(allocationAmount);
                setAllocationPaceMode("weekly");
                if (total > 0) setAllocationAmount(String(Math.round(weeklyPaceFromTotal(total, plan.periodStart, planEnd, paceToday))));
              }}>{t("Pe săptămână întreagă")}</button>
            </div>
          )}
        </div>
        <PlanField label={t("Avertizează la")}><select value={allocationThreshold} onChange={(event) => setAllocationThreshold(Number(event.target.value))}>{thresholdOptions.map((value) => <option key={value} value={value}>{value}%</option>)}</select></PlanField>
        <PlanField label="Detaliu liber"><input value={allocationNote} onChange={(event) => setAllocationNote(event.target.value)} placeholder={t("ex. telefon, cablu și aplicații")} /></PlanField>
        <label className="bf-plan-toggle"><input type="checkbox" checked={allocationWeeklyPace} onChange={(event) => setAllocationWeeklyPace(event.target.checked)} /><span><b>{t("Împarte pe săptămâni")}</b><small>{t("Dezactivează pentru plicuri fără ritm fix — taxi, cheltuieli ocazionale: rămâne doar totalul, fără presiune pe săptămână.")}</small></span></label>
        {paceByWeek && periodStarted && <label className="bf-plan-toggle"><input type="checkbox" checked={allocationLevelStarted} onChange={(event) => setAllocationLevelStarted(event.target.checked)} /><span><b>{t("Alocă de azi, nu și pe zilele trecute")}</b><small>{t("Săptămâna e începută: tranșa curentă primește doar partea zilelor rămase, iar restul pleacă în săptămânile următoare. Fără asta, zilele deja trecute rămân cu bani pe hârtie.")}</small></span></label>}
        {paceOptions.length > 0 && (
          /* Recomandările pleacă de la banii nerepartizați și de la zilele care au mai rămas.
             Sunt variante, nu o singură cifră: familia alege dacă săptămâna începută primește
             partea zilelor rămase sau bugetul ei întreg. */
          <div className="bf-pace-advice">
            <p><b>{allocationTotal > 0 ? t("Cum împarți cei {amount} din acest plic", { amount: money(allocationTotal) }) : t("Cum împarți cei {amount} nerepartizați", { amount: money(unrepartized) })}</b></p>
            <ul>
              {paceOptions.map((option) => <li key={option.id}>
                <div><b>{option.title}</b><small>{option.detail}</small></div>
                <button type="button" onClick={() => {
                  setAllocationWeeklyPace(true);
                  setAllocationLevelStarted(option.level);
                  setAllocationPaceMode("weekly");
                  setAllocationAmount(String(option.weekly));
                  setAllocationError("");
                }}>{t("Folosește")} · {money(option.weekly)}{t("/săpt.")}</button>
              </li>)}
            </ul>
          </div>
        )}
        {fundingOverdrawn.length > 0 && <p className="bf-form-error" role="alert">{t("O completare cere mai mult decât are sursa liberă. Scade suma sau alege altă sursă.")}</p>}
        <div className="bf-allocation-builder-actions"><button className="bf-primary" onClick={() => setAllocationPreviewOpen(true)}><Plus size={17} /> {editingAllocationId ? t("Salvează plicul") : t("Adaugă plicul")}</button>{editingAllocationId && <button onClick={resetAllocationBuilder}>{t("Renunță")}</button>}</div>
      </div>
      {/* Randat prin portal în <body>: `.bf-app` are `overflow: clip`, care limitează un element
          `position: fixed` la pagină, așa că dialogul apărea sus, nu peste ecran. */}
      {allocationPreviewOpen && createPortal(<div className="bf-allocation-preview" role="dialog" aria-modal="true" aria-labelledby="allocation-preview-title"><div><p className="bf-kicker">{t("PREVIZUALIZARE")}</p><h3 id="allocation-preview-title">{t("Verifică înainte de aplicare")}</h3><p>Vei {editingAllocationId ? "actualiza" : t("adăuga")} plicul <b>{allocationLabel.trim() || allocationCategory}</b> cu <strong>{money(allocationTotal)}</strong> {t("pentru perioada aleasă.")}</p><div><span>{t("Rămas acum")}<strong>{money(unrepartized)}</strong></span><span>{t("Rămas după")}<strong>{money(previewAfter)}</strong></span></div><small>{t("Previzualizarea nu schimbă nimic până când nu confirmi.")}</small><footer><button onClick={() => setAllocationPreviewOpen(false)}>{t("Înapoi la editare")}</button><button className="bf-primary" onClick={() => { setAllocationPreviewOpen(false); saveAllocation(); }}><Check size={16} /> {t("Confirmă repartizarea")}</button></footer></div></div>, document.body)}
      {allocationError && <p className="bf-form-error" role="alert">{allocationError}</p>}
      <div className="bf-allocation-list bf-envelope-desk" aria-live="polite">
        {envelopes.map(({ item, budget, remaining, spent, usage, state, week, weeks }) => <article key={item.id} className={state}>
          <div className="bf-envelope-portrait" aria-hidden="true"><EnvelopeMark remaining={Math.max(0, 1 - usage)} state={state} size={58} /></div>
          <div className="bf-allocation-list-heading"><div className="bf-allocation-flags"><span className={`bf-allocation-state ${state}`}>{state === "over" ? t("depășit") : state === "watch" ? t("aproape de limită") : t("în plan")}</span>{(() => { const burn = envelopeBurnPace(data).find((entry) => entry.allocationId === item.id); if (!burn || !burn.totalDays) return null; const label = burn.pace === "ahead" ? t("în avans") : burn.pace === "behind" ? t("în urmă") : burn.pace === "over" ? t("depășit") : t("în ritm"); return <span className={`bf-plic-pace pace-${burn.pace}`} title={burn.reason}>{label} · {Math.round(burn.expectedUsage * 100)}% așteptat</span>; })()}<EnvelopeConflictBadge allocationId={item.id} data={data} /></div><b>{item.label}</b><small>{personName(data, item.memberId)} · {sourceName(data, item.sourceId)}{item.note ? ` · ${item.note}` : ""}</small></div>
          <div className="bf-allocation-list-total"><strong>{money(Math.max(0, remaining))}</strong><small>{t("rămași din {amount}", { amount: money(budget) })}</small></div>
          <div className={`bf-envelope-meter${(week ? week.state : state) === "over" ? " is-over" : ""}`}><span>{week ? t("Săptămâna asta") : t("Tot plicul")}</span><b>{money(week ? week.spent : spent)} <small>/ {money(week ? week.budget : budget)}</small></b><i aria-hidden="true"><em style={{ width: `${Math.min(100, Math.max(0, ((week ? week.budget : budget) > 0 ? (week ? week.spent : spent) / (week ? week.budget : budget) : 0) * 100))}%` }} /></i></div>
          {week && <div className={`bf-allocation-week ${week.state === "over" ? "over" : ""}`}><span>S{week.index} · {formatDate(week.start)} – {formatDate(week.end)}</span><b>{money(Math.max(0, week.remaining))}</b><small>{money(week.spent)} cheltuiți din {money(week.budget)} în această tranșă</small></div>}
          {week && weeks.length > 1 && (() => {
            const shift = startedWeekPlan(data, item);
            if (!shift) return null;
            return <div className="bf-week-started">
              <p>{t("Săptămâna e începută: pentru {days} rămase revin {fair} (≈{perDay}/zi).", { days: daysLabel(shift.share.daysLeft), fair: money(shift.share.fair), perDay: money(shift.share.perDay) })}</p>
              {shift.movable >= 1
                ? <button type="button" onClick={() => rebalanceStartedWeek(item.id, shift.weekIndex, shift.movable)}>{t("Mută {amount} în săptămânile următoare", { amount: money(shift.movable) })}</button>
                : <small>{t("Nu prisosește nimic de mutat în săptămânile următoare.")}</small>}
            </div>;
          })()}
          <p className="bf-allocation-why"><b>{state === "over" ? t("De ce cere atenție") : state === "watch" ? t("De ce apare aici") : t("Cum se citește")}:</b> {state === "over" ? `Ai depășit limita cu ${money(Math.abs(remaining))}. Redu suma planificată sau revizuiește cheltuielile înainte de următorul venit.` : state === "watch" ? `${Math.round(usage * 100)}% din plic este consumat; mai ai ${money(Math.max(0, remaining))} pentru perioada aleasă.` : week ? `Mai ai ${money(Math.max(0, remaining))} în plic, iar ritmul săptămânal este ${money(week.budget)}.` : `Ai planificat ${money(budget)} pentru această categorie, fără presiune pe o tranșă săptămânală.`}</p>
          {week && weeks.length > 1 && <div className="bf-week-transfer">
            {weekTransferAllocationId === item.id ? <div className="bf-week-transfer-form">
              <div className="bf-week-transfer-direction" role="group" aria-label={t("Sensul mutării")}>
                <button type="button" className={weekTransferDirection === "in" ? "active" : ""} aria-pressed={weekTransferDirection === "in"} onClick={() => { setWeekTransferDirection("in"); setWeekTransferFromIndex(""); setWeekTransferError(""); }}>{t("Adu în S{index}", { index: String(week.index) })}</button>
                <button type="button" className={weekTransferDirection === "out" ? "active" : ""} aria-pressed={weekTransferDirection === "out"} onClick={() => { setWeekTransferDirection("out"); setWeekTransferFromIndex(""); setWeekTransferError(""); }}>{t("Trimite din S{index}", { index: String(week.index) })}</button>
              </div>
              <select value={weekTransferFromIndex} aria-label={weekTransferDirection === "in" ? t("Din ce săptămână?") : t("În ce săptămână?")} onChange={(event) => { setWeekTransferFromIndex(event.target.value); setWeekTransferError(""); }}>
                <option value="">{weekTransferDirection === "in" ? t("Din ce săptămână?") : t("În ce săptămână?")}</option>
                {weeks.filter((other) => other.index !== week.index).map((other) => <option key={other.index} value={other.index}>S{other.index} · {formatDate(other.start)}–{formatDate(other.end)} · {money(other.remaining)} rămași</option>)}
              </select>
              <input value={weekTransferAmount} onChange={(event) => { setWeekTransferAmount(event.target.value); setWeekTransferError(""); }} inputMode="decimal" placeholder="ex. 100" aria-label={t("Suma mutată")} />
              <small className="bf-week-transfer-note">{weekTransferDirection === "in" ? t("Mai ai {amount} în S{index}; aduci din altă tranșă.", { amount: money(Math.max(0, week.remaining)), index: String(week.index) }) : t("Poți trimite cel mult {amount}, cât a rămas în S{index}.", { amount: money(Math.max(0, week.remaining)), index: String(week.index) })}</small>
              <div><button className="bf-primary" onClick={() => applyWeekTransfer(item.id, week.index)}>{weekTransferDirection === "in" ? t("Transferă în S{index}", { index: String(week.index) }) : t("Transferă din S{index}", { index: String(week.index) })}</button><button onClick={closeWeekTransfer}>{t("Renunță")}</button></div>
              {weekTransferError && <p className="bf-form-error" role="alert">{weekTransferError}</p>}
            </div> : <button type="button" className="bf-week-transfer-toggle" onClick={() => openWeekTransfer(item.id)}>{t("Mută bani între săptămâni")}</button>}
          </div>}
          <div className="bf-allocation-actions"><button aria-label={`Editează ${item.label}`} onClick={() => editAllocation(item)}><Pencil size={15} /> {t("Editează")}</button><button aria-label={`Șterge ${item.label}`} onClick={() => deleteAllocation(item.id, item.label)}><Trash2 size={15} /> {t("Șterge")}</button></div>
        </article>)}
        {!envelopes.length && <div className="bf-allocation-empty"><EnvelopeEmptyArt size={88} /><b>{t("Așază primii lei într-un plic.")}</b><span>{t("Alege o categorie de mai sus sau completează formularul. Totalul planului este suma plicurilor — fără o limită generală separată.")}</span></div>}
            </div>
      <EnvelopeTransferPanel data={data} onChange={onChange} />
      {!simpleMode && <SalaryRitualPanel data={data} onChange={onChange} />}
      {!simpleMode && <AllocationHistoryPanel data={data} />}
    </section>
    {!simpleMode && <MonthlyAllocationWizard allocations={plan.allocations} available={availableSources} scheduled={scheduled} remainingById={Object.fromEntries(envelopes.map((envelope) => [envelope.item.id, Math.max(0, envelope.remaining)]))} periodLabel={allocationPeriodOptions.find((option) => option.id === allocationPeriod)?.label || t("Luna aceasta")} onApply={applyMonthlyAllocation} />}
    <details className="bf-cycle-tools"><summary><span><BookmarkPlus size={17} /> {t("Instrumente pentru perioade repetate")}</span><ChevronDown size={17} /></summary><div className="bf-cycle-tools-body"><p>{t("Un șablon reține doar durata perioadei; începi mereu următorul ciclu cu data aleasă de tine.")}</p><div className="bf-cycle-template-save"><input value={cycleTemplateLabel} onChange={(event) => setCycleTemplateLabel(event.target.value)} maxLength={42} placeholder={periodValid ? `ex. Salariu ${daysBetween(cycleStart, cycleEnd)} zile` : t("Completează mai întâi perioada")} disabled={!periodValid} /><button disabled={!periodValid} onClick={saveCycleTemplate}>{t("Salvează șablonul")}</button></div><div className="bf-cycle-template-list">{data.settings.salaryCycleTemplates.map((template) => <article key={template.id}>{templateRenameId === template.id ? <div className="bf-cycle-template-rename"><input autoFocus value={templateRename} maxLength={42} onChange={(event) => setTemplateRename(event.target.value)} /><button onClick={() => renameCycleTemplate(template.id)}>{t("Salvează")}</button><button onClick={() => { setTemplateRenameId(""); setTemplateRename(""); }}>{t("Anulează")}</button></div> : <><button type="button" onClick={() => applyCycleTemplate(template)}><b>{template.label}</b><small>{template.durationDays} zile</small></button><div><button type="button" aria-label={`Redenumește șablonul ${template.label}`} onClick={() => { setTemplateRenameId(template.id); setTemplateRename(template.label); }}><Pencil size={15} /></button><button type="button" aria-label={`Șterge șablonul ${template.label}`} onClick={() => deleteCycleTemplate(template.id, template.label)}><Trash2 size={15} /></button></div></>}</article>)}{!data.settings.salaryCycleTemplates.length && <span>{t("Nu ai șabloane salvate încă.")}</span>}</div></div></details>
  </div>;
}
