/**
 * Atelierul Financiar — tablou mobil pentru o persoană sau o gospodărie, cu decizia următoare în prim-plan.
 * First paint: doar Astăzi. Restul ecranelor, sync-ul și formularele se încarcă la cerere.
 */
import { lazy, startTransition, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Bell, CloudOff, Users, RotateCcw, Inbox, LayoutGrid, MessagesSquare, MoreHorizontal, ReceiptText, Search, ShieldCheck, Wallet, X } from "lucide-react";
import { rollIncomeHorizon, deviceTimeZone, setFamilyTimeZone, adoptOutsideExpenses, commitLedgerEntry, confirmRecurringPayment, addIsoDays, formatDate, inPlanPeriod, isoDate, isoToday, newId, transferBetweenEnvelopes, type AppData, type Debt, type Receipt, type SavingsGoal, type Transaction } from "@/lib/finance-data";
import { addContribution, eventTraits } from "@/lib/planned-events";
import { applyDeclaredBalance } from "@/lib/balance-check";
import { levelStartedWeek, totalForWeeklyPace } from "@/lib/started-week";
import { migrateLegacyReceiptImages, removeReceiptImages } from "@/lib/receipt-storage";
import { queueReceiptForReview } from "@/lib/receipt-review";
import { safeSetItem } from "@/lib/safe-storage";
import { BrandMark } from "@/components/BrandMark";
import type { FinancialUpdate, GuidedRevert, NaturalDraft } from "@/components/AICompanion";
import { isAppLockEnabled } from "@/lib/app-lock";
import { observeQuickActions, publishSpendToday, publishWidgetTemplates } from "@/lib/quick-action-bridge";
import { hasQueuedFeedback } from "@/lib/feedback-queue";
import { useMemberMode } from "@/lib/member-mode";
import { MemberModeScreen } from "@/components/MemberModeScreen";
import {
  WhatsNewSheet,
  fmtExact,
  money,
  type MainView,
  type MoreView,
} from "@/pages/home-kit";
import { markWhatsNewSeen, shouldShowWhatsNew } from "@/lib/theme-default";
import { markFirstWeekTourSeen, shouldOfferFirstWeekTour } from "@/lib/first-week-tour";
import { daysLabel, t } from "@/lib/i18n";
import { todayBrief } from "@/lib/household-insights";
import { applyIncomeSplit, pendingSplitIncome } from "@/lib/monthly-needs";
import { hideNativeSplash, syncAndroidChrome } from "@/lib/native-splash";
import { ensureDeferredStyles } from "@/lib/ram-hygiene";
import { useLanguage } from "@/hooks/use-language";
import { useUndo } from "@/hooks/useUndo";
import { useThemeChrome } from "@/hooks/useThemeChrome";
import { useFamilySync } from "@/hooks/useFamilySync";
import { usePersistAppData, readInitialAppData } from "@/hooks/usePersistAppData";
import { useSimpleMode } from "@/hooks/useSimpleMode";
import { FAMILIE_OPEN_EVENT } from "@/lib/entitlements";
import { selfMemberOf } from "@/lib/member-identity";
import { isNativeApp } from "@/lib/app-storage";
import { buildUndoSave } from "@/lib/undo-delete";
import { formatInvite, parseInvite, takeInviteFromLocation } from "@/lib/family-invite";
import { openHouseholdGuide, TodayView } from "@/pages/TodayView";
import { reloadToNewVersion, useUpdateAvailable } from "@/lib/update-check";

export { recentActivityMoves } from "@/pages/TodayView";

const PlanStudio = lazy(() => import("@/components/PlanStudio").then((module) => ({ default: module.PlanStudio })));
const MovementsJournal = lazy(() => import("@/components/MovementsJournal").then((module) => ({ default: module.MovementsJournal })));
const QuickEntryPanel = lazy(() => import("@/components/QuickEntryPanel").then((module) => ({ default: module.QuickEntryPanel })));
const FirstWeekTour = lazy(() => import("@/components/FirstWeekTour").then((module) => ({ default: module.FirstWeekTour })));
const FinancialCalendarView = lazy(() => import("@/components/FinancialCalendarView").then((module) => ({ default: module.FinancialCalendarView })));
const ThemePicker = lazy(() => import("@/pages/ThemePicker").then((module) => ({ default: module.ThemePicker })));
const QuickActionsPalette = lazy(() => import("@/pages/QuickActionsPalette").then((module) => ({ default: module.QuickActionsPalette })));
const CalmOnboarding = lazy(() => import("@/pages/QuickActionsPalette").then((module) => ({ default: module.CalmOnboarding })));
const TransactionForm = lazy(() => import("@/pages/TransactionForm").then((module) => ({ default: module.TransactionForm })));
const GoalForm = lazy(() => import("@/pages/GoalForms").then((module) => ({ default: module.GoalForm })));
const DebtPaymentForm = lazy(() => import("@/pages/GoalForms").then((module) => ({ default: module.DebtPaymentForm })));
const ReceiptForm = lazy(() => import("@/pages/ReceiptForm").then((module) => ({ default: module.ReceiptForm })));
const SpendingHabitsView = lazy(() => import("@/pages/HabitsGoals").then((module) => ({ default: module.SpendingHabitsView })));
const LongTermGoalsView = lazy(() => import("@/pages/HabitsGoals").then((module) => ({ default: module.LongTermGoalsView })));
const ObjectivesView = lazy(() => import("@/pages/ObjectivesView").then((module) => ({ default: module.ObjectivesView })));
const InsightsView = lazy(() => import("@/pages/InsightsView").then((module) => ({ default: module.InsightsView })));
const MoreViewScreen = lazy(() => import("@/pages/home-secondary").then((module) => ({ default: module.MoreView })));
const FirstRunSetup = lazy(() => import("@/components/FirstRunSetup").then((module) => ({ default: module.FirstRunSetup })));
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

const preloadView = (id: MainView) => {
  if (id === "journal") void import("@/components/MovementsJournal");
  else if (id === "plan") void import("@/components/PlanStudio");
  else if (id === "calendar") void import("@/components/FinancialCalendarView");
  else if (id === "insights") void import("@/pages/InsightsView");
  else if (id === "obligations") void import("@/pages/ObjectivesView");
  else if (id === "goals" || id === "habits") void import("@/pages/HabitsGoals");
  else if (id === "utilities") void import("@/pages/home-secondary");
};

export default function Home() {
  const updateAvailable = useUpdateAvailable();
  const [data, setData] = useState<AppData>(readInitialAppData);
  const { storageNotice, setStorageNotice, storageReady, applyData } = usePersistAppData(data, setData);
  /** „Azi” al familiei: se setează înainte de orice calcul din randare (testare, #10). */
  setFamilyTimeZone(data.settings.familyTimeZone);
  /** Mesajele de feedback trimise fără internet pleacă la prima deschidere cu rețea. */
  // Firebase se încarcă doar dacă e un mesaj de trimis, nu la fiecare pornire.
  useEffect(() => { if (hasQueuedFeedback()) void import("@/lib/feedback").then(({ flushFeedbackQueue }) => flushFeedbackQueue()).catch(() => undefined); }, []);
  /** Venit neregulat: perioada „banii să-mi ajungă N zile” pornește din ziua de azi (M6). */
  const todayIso = isoToday();
  useEffect(() => {
    if (!storageReady || !data.settings.salaryPlan.horizonDays) return;
    setData((current) => rollIncomeHorizon(current, todayIso));
  }, [storageReady, todayIso, data.settings.salaryPlan.horizonDays]);
  useEffect(() => {
    if (!storageReady || data.settings.familyTimeZone) return;
    const zone = deviceTimeZone();
    if (zone) setData((current) => current.settings.familyTimeZone ? current : { ...current, settings: { ...current.settings, familyTimeZone: zone } });
  }, [storageReady, data.settings.familyTimeZone]);
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
  // „Telefonul lui X”: un singur ecran, doar pentru persoana aceea (copil, bunic).
  const memberMode = useMemberMode();
  const memberModeActive = Boolean(memberMode && data.settings.members.some((item) => item.id === memberMode));
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
  /** Ecranul de unde s-a deschis un instrument, ca „Înapoi” să ducă tot acolo (testare, #6). */
  const [moreReturn, setMoreReturn] = useState<{ view: MainView; label: string } | null>(null);
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
    activeTheme, setTheme,
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
      blocked: Boolean(modal) || (view === "utilities" && more === "sync"),
      hasModal: Boolean(modal),
      onSyncScreen: view === "utilities" && more === "sync",
      hasStarted: started,
    })) {
      setFirstWeekTourOpen(true);
      return;
    }
    if (shouldShowWhatsNew(window.localStorage) && !modal && !(view === "utilities" && more === "sync") && started) setWhatsNewOpen(true);
  }, [storageReady, onboardingOpen, setupOpen, modal, more, view, data.transactions.length, data.settings.salaryPlan.allocations.length]);
  const dismissWhatsNew = () => { markWhatsNewSeen(window.localStorage); setWhatsNewOpen(false); };
  const dismissFirstWeekTour = () => { markFirstWeekTourSeen(window.localStorage); setFirstWeekTourOpen(false); };

  const update = (fn: (current: AppData) => AppData) => applyData((current) => fn(current));
  useEffect(() => {
    if (!storageReady) return;
    applyData((current) => adoptOutsideExpenses(current));
  }, [storageReady, applyData]);

  const { undo, setUndo, runUndo, deleteWithUndo, offerUndo } = useUndo(data, setData);
  const go = (next: MainView) => { preloadView(next); if (next !== "utilities") setMoreReturn(null); startTransition(() => setView(next)); };
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
      void import("@/pages/SettingsPanel");
      const started = Date.now();
      const tick = () => {
        const node = document.getElementById("bf-familie-plan");
        if (node) {
          node.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (Date.now() - started < 2500) window.setTimeout(tick, 50);
      };
      window.setTimeout(tick, 80);
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

  const { syncPanelProps, offerInvite } = useFamilySync(data, setData, storageReady);
  /** Link de invitație (`#alatura=…`): deschidem Sync cu invitația pusă deja în câmp. */
  useEffect(() => {
    const invite = takeInviteFromLocation();
    if (!invite) return;
    offerInvite(formatInvite(invite));
    // Telefonul nou intră direct în familie; configurarea vine din camera ei.
    setSetupOpen(false);
    setMore("sync");
    go("utilities");
    // O singură dată, la deschiderea linkului.
  }, []);
  /**
   * Aplicația Android deschisă din „Deschide în aplicație” (bugetfamilie://alatura?cod=…):
   * aceeași invitație, pusă în câmp, fără să intrăm singuri în familie.
   */
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    const accept = (url: string | undefined) => {
      const invite = url ? parseInvite(decodeURIComponent(url)) : undefined;
      if (!invite) return;
      offerInvite(formatInvite(invite));
      setSetupOpen(false);
      setMore("sync");
      go("utilities");
    };
    void import("@capacitor/app").then(async ({ App }) => {
      accept((await App.getLaunchUrl().catch(() => undefined))?.url);
      const handle = await App.addListener("appUrlOpen", (event) => accept(event.url));
      remove = () => void handle.remove();
    }).catch(() => undefined);
    return () => remove?.();
  }, []);
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
    const saved = Array.isArray(item) ? item : [item];
    /** Doar mișcările noi primesc „Anulează”; o corectură se refac din formular. */
    const fresh = saved.every((entry) => !data.transactions.some((existing) => existing.id === entry.id));
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
    if (fresh && saved.length) {
      const label = saved.length === 1
        ? t("Notat · {title} · {amount}", { title: saved[0].title, amount: money(saved[0].amount) })
        : t("Notat · {count} mișcări", { count: saved.length });
      offerUndo(buildUndoSave(label, saved.map((entry) => entry.id)));
    }
  };
  const applyFinancialUpdate = (change: FinancialUpdate) => update((current) => { const member = current.settings.members.find((item) => "memberId" in change && change.memberId && item.id === change.memberId) || current.settings.members[0]; const source = current.settings.paymentSources.find((item) => item.memberId && member && item.memberId === member.id) || current.settings.paymentSources[0]; const now = new Date().toISOString(); if (change.kind === "income" && member && source) { const incomeSource = current.settings.paymentSources.find((item) => item.memberId === member.id && item.kind !== "meal") || current.settings.paymentSources.find((item) => item.kind !== "meal") || source; const incomeCaptureId = ("clientCaptureId" in change && change.clientCaptureId) || newId("guided-income"); if (current.transactions.some((item) => item.id === incomeCaptureId || (item.kind === "income" && item.amount === change.amount && item.title === change.title && item.date === (change.date || isoToday())))) return current; const transaction: Transaction = { id: incomeCaptureId, title: change.title, amount: change.amount, kind: "income", category: "Venit", sourceId: incomeSource.id, source: incomeSource.name, memberId: member.id, person: member.name, date: change.date || isoToday(), note: t("Venit adăugat împreună cu ghidul AI"), createdAt: now }; return { ...current, transactions: [transaction, ...current.transactions] }; } if (change.kind === "debt") { const key = change.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const existingIndex = current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key); const nextDebt: Debt = { id: existingIndex >= 0 ? current.debts[existingIndex].id : newId("guided-debt"), name: change.name, remaining: change.remaining, monthly: existingIndex >= 0 ? current.debts[existingIndex].monthly : 0, due: change.due || (existingIndex >= 0 ? current.debts[existingIndex].due : "Nespecificat"), memberId: member?.id, tone: existingIndex >= 0 ? current.debts[existingIndex].tone : "coral", updatedAt: now }; const debts = existingIndex >= 0 ? current.debts.map((item, index) => index === existingIndex ? nextDebt : item) : [nextDebt, ...current.debts]; return { ...current, debts }; } if (change.kind === "debt-monthly") { const key = change.name?.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); const index = key ? current.debts.findIndex((item) => item.name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === key) : 0; if (index < 0) return current; return { ...current, debts: current.debts.map((item, itemIndex) => itemIndex === index ? { ...item, monthly: change.amount, updatedAt: now } : item) }; } if (change.kind === "expense" && member && source) { const day = change.date || isoToday(); const usedSource = current.settings.paymentSources.find((item) => item.id === change.sourceId) || source; const usedMember = current.settings.members.find((item) => item.id === change.memberId) || member; const expenseCaptureId = change.clientCaptureId || newId("guided-expense"); if (current.transactions.some((item) => item.id === expenseCaptureId)) return current; if (change.recurringId && current.transactions.some((item) => item.recurringId === change.recurringId && inPlanPeriod(item.date, current.settings.salaryPlan))) return current; const transaction: Transaction = { id: expenseCaptureId, title: change.title, amount: change.amount, kind: "expense", category: change.category, sourceId: usedSource.id, source: usedSource.name, memberId: usedMember.id, person: usedMember.name, date: day, allocationId: change.allocationId || "outside", recurringId: change.recurringId, note: change.recurringId ? t("Plată recurentă confirmată") : t("Cheltuială adăugată împreună cu ghidul AI"), createdAt: now }; try { const next = commitLedgerEntry(current, transaction, change.fromWeekIndex); if (change.kind === "expense" && change.receiptDraft?.items?.length) { const receipt: Receipt = { id: newId("guided-receipt"), vendor: change.receiptDraft.vendor || change.title, amount: change.amount, category: change.category, date: day, sourceId: usedSource.id, memberId: usedMember.id, linkedTransactionId: transaction.id, note: t("Bon citit de ghid — produsele sunt în rubrica Bonuri."), lines: change.receiptDraft.items.map((item, index) => ({ id: `guided-line-${index}`, category: item.category, amount: item.amount, label: item.label })), updatedAt: now }; return { ...next, receipts: [receipt, ...next.receipts] }; } return next; } catch { return current; } } if (change.kind === "transfer") return transferBetweenEnvelopes(current, { fromAllocationId: change.fromId, toAllocationId: change.toId, amount: change.amount, note: t("Realocare din ghidul AI") }) || current; if (change.kind === "recurring") {
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
    if (change.kind === "income-split") {
      // Venitul din aceeași propunere a intrat deja (actualizările se aplică pe rând).
      const income = pendingSplitIncome(current, isoToday());
      return income ? applyIncomeSplit(current, income.id).data : current;
    }
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
    const weeklyPace = change.weekly ? true : false;
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
  const openNaturalDraft = (draft: NaturalDraft) => { const member = selfMemberOf(data); const source = data.settings.paymentSources[0]; if (!member || !source) { openTx(); return; } openTx({ id: newId("natural-draft"), title: draft.title, amount: draft.amount, kind: draft.kind, category: draft.category, source: source.name, sourceId: source.id, person: member.name, memberId: member.id, date: draft.date || isoToday(), note: draft.note }); };
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
    // Widgetul „Poți cheltui azi” arată aceeași cifră ca Astăzi; fără punte nativă nu face nimic.
    const today = isoToday();
    // Cu PIN pe aplicație sau pe telefonul unui copil, suma nu stă pe ecranul principal.
    if (isAppLockEnabled() || memberModeActive) {
      publishSpendToday({ amount: "", caption: "", date: today, stale: "" });
      return;
    }
    const brief = todayBrief(data);
    publishSpendToday({
      amount: fmtExact.format(brief.spendable),
      caption: brief.hasPayday && !brief.expired ? t("până la salariu: {days}", { days: daysLabel(brief.remainingDays) }) : t("Setează data salariului în Plan."),
      date: today,
      stale: t("Cifra e de pe {date} — deschide aplicația pentru azi", { date: formatDate(today, { day: "numeric", month: "long" }) }),
    });
  }, [data, memberModeActive]);
  // Copia săptămânală, pe telefon: o dată la 7 zile, după ce omul a spus „da”.
  useEffect(() => { void import("@/components/AutoBackupCard").then(({ runAutoBackupIfDue }) => runAutoBackupIfDue(data)).catch(() => undefined); }, [data]);
  useEffect(() => {
    const expense = data.settings.quickTemplates.filter((item) => item.kind !== "income").slice(0, 3);
    publishWidgetTemplates(expense.map((item) => ({ id: item.id, label: item.label })));
  }, [data.settings.quickTemplates]);
  const allNav = [{ id: "today" as MainView, label: t("Astăzi"), icon: LayoutGrid }, { id: "journal" as MainView, label: t("Mișcări"), icon: ReceiptText }, { id: "plan" as MainView, label: t("Plan"), icon: Wallet }, { id: "obligations" as MainView, label: t("Obligații"), icon: Bell }, { id: "insights" as MainView, label: t("Analiză"), icon: BarChart3 }];
  const nav = memberModeActive ? [] : simpleMode ? allNav.filter((item) => item.id === "today" || item.id === "journal" || item.id === "plan" || item.id === "obligations") : allNav;
  useEffect(() => {
    if (!simpleMode) return;
    if (view === "insights" || view === "habits" || view === "goals" || view === "calendar") go("today");
  }, [simpleMode, view]);
  /** Bannerele de sync se ascund doar când ecranul Sync e chiar deschis, nu când a fost ultimul instrument. */
  const onSyncScreen = view === "utilities" && more === "sync";
  const current = () => { if (view === "journal") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim mișcările…")}</div>}><MovementsJournal data={data} onChange={applyData} onAdd={() => openTx()} onEdit={openTx} onOpenReview={() => { setMore("review"); go("utilities"); }} onDelete={(id) => deleteWithUndo(t("Mișcarea a fost ștearsă."), (currentData) => ({
      next: { ...currentData, transactions: currentData.transactions.filter((item) => item.id !== id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId !== id), deleted: [...currentData.deleted, { entity: "transactions" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { transactions: currentData.transactions.filter((item) => item.id === id), receipts: currentData.receipts.filter((receipt) => receipt.linkedTransactionId === id) },
    }))} /></Suspense>; if (view === "plan")
 return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim planul…")}</div>}><PlanStudio data={data} onChange={applyData} simpleMode={simpleMode} /></Suspense>; if (view === "habits") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obiceiurile…")}</div>}><SpendingHabitsView data={data} /></Suspense>; if (view === "calendar") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim calendarul…")}</div>}><FinancialCalendarView data={data} onOpenEvents={() => { setMore("events"); go("utilities"); }} /></Suspense>; if (view === "goals") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obiectivele…")}</div>}><LongTermGoalsView data={data} onOpen={() => { setEditGoal(undefined); setModal("saving"); }} onEdit={(item) => { setEditGoal(item); setModal("saving"); }} onDelete={(id) => deleteWithUndo(t("Obiectivul a fost șters."), (currentData) => ({
      next: { ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { savings: currentData.savings.filter((item) => item.id === id) },
    }))} /></Suspense>; if (view === "obligations") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim obligațiile…")}</div>}><ObjectivesView data={data} onSaveToGoal={(id, amount) => update((currentData) => ({ ...currentData, savings: currentData.savings.map((item) => item.id === id ? { ...item, current: Math.round((item.current + amount) * 100) / 100, updatedAt: new Date().toISOString() } : item) }))} onEditDebt={(item) => { setEditGoal(item); setModal("debt"); }} onEditSaving={(item) => { setEditGoal(item); setModal("saving"); }} onPayDebt={(item) => { setEditGoal(item); setModal("debt-payment"); }} onDeleteDebt={(id) => deleteWithUndo(t("Datoria a fost ștearsă."), (currentData) => ({
      next: { ...currentData, debts: currentData.debts.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "debts" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { debts: currentData.debts.filter((item) => item.id === id) },
    }))} onDeleteSaving={(id) => deleteWithUndo(t("Obiectivul a fost șters."), (currentData) => ({
      next: { ...currentData, savings: currentData.savings.filter((item) => item.id !== id), deleted: [...currentData.deleted, { entity: "savings" as const, id, deletedAt: new Date().toISOString() }].slice(-500) },
      removed: { savings: currentData.savings.filter((item) => item.id === id) },
    }))} openDebt={() => { setEditGoal(undefined); setModal("debt"); }} openSaving={() => { setEditGoal(undefined); setModal("saving"); }} onOpenGoals={() => go("goals")} onOpenCalendar={() => go("calendar")} onOpenEvents={() => { setMore("events"); go("utilities"); }} onOpenAssistant={() => { setMore("assistant"); go("utilities"); }} onOpenRecurring={() => { setMoreReturn({ view: "obligations", label: t("Înapoi la Obligații") }); setMore("recurring"); go("utilities"); }} onPayRecurring={(id) => { if (data.recurring.find((item) => item.id === id)?.variable) { setMoreReturn({ view: "obligations", label: t("Înapoi la Obligații") }); setMore("recurring"); go("utilities"); return; } update((currentData) => confirmRecurringPayment(currentData, id) || currentData); }} /></Suspense>; if (view === "insights") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim analiza…")}</div>}><InsightsView data={data} onChange={applyData} onGo={go} /></Suspense>; if (view === "utilities") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim instrumentele…")}</div>}><MoreViewScreen tab={more} setTab={(value) => { setMore(value); if (value === "overview") setMoreReturn(null); }} backTo={moreReturn ? { label: moreReturn.label, go: () => { const target = moreReturn.view; setMoreReturn(null); setMore("overview"); go(target); } } : undefined} data={data} onChange={applyData} onAddReceipt={() => setModal("receipt")} onSaveReceipt={saveReceipt} onDeleteReceipt={deleteReceipt} onOpenDebt={() => { setEditGoal(undefined); setModal("debt"); }} onOpenSaving={() => { setEditGoal(undefined); setModal("saving"); }} onEditDebt={(item) => { setEditGoal(item); setModal("debt"); }} onEditSaving={(item) => { setEditGoal(item); setModal("saving"); }} onPayDebt={(item) => { setEditGoal(item); setModal("debt-payment"); }} onOpenCalendar={() => go("calendar")} onGo={go} receiptStorageNotice={receiptStorageNotice} sync={syncPanelProps} /></Suspense>; return <TodayView data={data} onAdd={() => openTx()} onEdit={openTx} onGo={go} onChange={applyData} onOpenReview={() => { setMore("review"); go("utilities"); }} onOpenSettings={() => { setMore("settings"); go("utilities"); }} onOpenRecurring={() => { setMoreReturn({ view: "today", label: t("Înapoi la Astăzi") }); setMore("recurring"); go("utilities"); }} coach={view === "today" && firstWeekTourOpen && !onboardingOpen && !setupOpen && !modal && more !== "sync" ? <Suspense fallback={null}><FirstWeekTour onClose={dismissFirstWeekTour} onCapture={() => { dismissFirstWeekTour(); openTx(); }} onPlan={() => { dismissFirstWeekTour(); go("plan"); }} onSync={() => { dismissFirstWeekTour(); setMore("sync"); go("utilities"); }} /></Suspense> : null} />; };
  return <div className={"bf-app os-shell" + (setupOpen || onboardingOpen ? " is-setup" : "")}>
    <a className="bf-skip-link" href="#main-content">{t("Sari la conținut")}</a>
    {storageNotice && <div className="bf-storage-notice" role="status"><ShieldCheck size={15} /><span>{storageNotice}</span><button type="button" aria-label={t("Închide notificarea")} onClick={() => setStorageNotice(null)}><X size={14} /></button></div>}
    {updateAvailable && <div className="bf-offline-banner bf-update-banner" role="status" aria-live="polite"><RotateCcw size={15} aria-hidden="true" /><span>{t("Există o versiune nouă a aplicației.")}</span><button type="button" onClick={() => void reloadToNewVersion()}>{t("Reîncarcă")}</button></div>}
    {!online && <div className="bf-offline-banner" role="status" aria-live="polite"><CloudOff size={15} aria-hidden="true" /><span>{syncPanelProps.connected ? t("Fără conexiune — modificările rămân pe telefon și se trimit la reconectare.") : t("Fără conexiune — lucrezi local pe acest telefon.")}</span></div>}
    {syncPanelProps.stopped && !onSyncScreen && <div className="bf-offline-banner bf-sync-off-banner" role="status" aria-live="polite"><CloudOff size={15} aria-hidden="true" /><span>{t("Sincronizarea familiei e oprită pe acest telefon. Ce notezi nu ajunge la ceilalți.")}</span><button type="button" onClick={() => { setMore("sync"); go("utilities"); }}>{t("Reconectează")}</button></div>}
    {syncPanelProps.needsSelfChoice && syncPanelProps.connected && !onSyncScreen && !memberModeActive && <div className="bf-offline-banner bf-sync-off-banner" role="status"><Users size={15} aria-hidden="true" /><span>{t("Spune-ne cine ești pe acest telefon, ca cheltuielile tale să nu apară pe altcineva.")}</span><button type="button" onClick={() => { setMore("sync"); go("utilities"); }}>{t("Alege")}</button></div>}
    {simpleMode && !memberModeActive && view !== "today" && <div className="bf-simple-mode-top-banner" role="status"><span>{t("Mod simplu activ — Dezactivează în Setări")}</span><button type="button" onClick={() => { setSimpleModePref(false); setMore("settings"); go("utilities"); }}>{t("Dezactivează")}</button></div>}
    <header className="bf-appbar os-appbar"><button className="os-brand" onClick={() => go("today")}><BrandMark /><span className="os-brand-copy"><b>Buget</b><i>Familie</i></span></button><nav className="os-desktop-nav" aria-label={t("Navigație principală")}>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerEnter={() => preloadView(item.id)} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={17} aria-hidden="true" /><span>{item.label}</span></button>; })}</nav>{!memberModeActive && <div className="os-tools"><button className="os-tool" aria-label={t("Deschide acțiunile rapide")} title={t("Acțiuni rapide · Ctrl K")} onPointerDown={() => void import("@/pages/QuickActionsPalette")} onClick={() => setQuickActionsOpen(true)}><Search size={17} /></button><button className={view === "utilities" ? "os-tool is-on" : "os-tool"} aria-label={data.pendingReview.length ? t("Deschide instrumentele · {count} de verificat", { count: data.pendingReview.length }) : t("Deschide instrumentele")} onPointerDown={() => preloadView("utilities")} onClick={() => go("utilities")}><MoreHorizontal size={19} />{data.pendingReview.length > 0 && <span className="bf-nav-count" aria-hidden="true">{data.pendingReview.length}</span>}</button><button className="os-tool" aria-label={t("Deschide ghidul")} onClick={openHouseholdGuide}><MessagesSquare size={17} /></button></div>}</header>
    <main id="main-content" key={view} className={setupOpen || onboardingOpen || view === initialViewRef.current ? undefined : "bf-screen-transition"}>{setupOpen ? null : memberModeActive ? <MemberModeScreen data={data} memberId={memberMode} onChange={applyData} /> : current()}</main>
    {undo && (
      <div className="bf-undo-bar" role="status" aria-live="polite">
        <span>{undo.label}</span>
        <button type="button" onClick={runUndo}><RotateCcw size={15} aria-hidden="true" /> {t("Anulează")}</button>
        <button type="button" className="bf-undo-close" aria-label={t("Închide")} onClick={() => setUndo(null)}><X size={16} /></button>
      </div>
    )}

    {data.pendingReview.length > 0 && <button type="button" className="bf-dock-review-badge" onClick={() => { setMore("review"); go("utilities"); }} aria-label={t("Deschide De verificat · {count}", { count: data.pendingReview.length })}><Inbox size={15} /> {t("De verificat")} · {data.pendingReview.length}</button>}
    <div className="os-nav-fill" aria-hidden="true" />
    <nav className="os-dock" aria-label={t("Navigație mobilă")}>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "is-on" : ""} aria-current={view === item.id ? "page" : undefined} onPointerDown={() => preloadView(item.id)} onClick={() => go(item.id)}><Icon size={16} aria-hidden="true" /><span>{item.label}</span>{item.id === "journal" && data.pendingReview.length > 0 ? <i className="bf-dock-dot" aria-hidden="true" /> : null}</button>; })}</nav>
    {!simpleMode && !memberModeActive && guideOn && <Suspense fallback={null}><AICompanion initiallyOpen data={data} view={view} onAdd={() => openTx()} onGo={go} onNaturalEntry={openNaturalDraft} onFinancialUpdate={applyFinancialUpdate} onRevert={revertGuided} /></Suspense>}
    {themePickerOpen && <Suspense fallback={null}><ThemePicker theme={activeTheme} schedule={themeSchedule} scheduleTimes={scheduleTimes} highContrast={highContrast} background={background} onChange={setTheme} onScheduleChange={setThemeSchedule} onScheduleTimesChange={setScheduleTimes} onContrastChange={setHighContrast} onBackgroundChange={setBackground} onClose={() => setThemePickerOpen(false)} /></Suspense>} {quickActionsOpen && <Suspense fallback={null}><QuickActionsPalette data={data} onClose={() => setQuickActionsOpen(false)} onAdd={() => openTx()} onGo={go} /></Suspense>} {onboardingOpen && <Suspense fallback={null}><CalmOnboarding onClose={() => { setOnboardingOpen(false); const hasStarted = data.transactions.length > 0 || data.settings.salaryPlan.allocations.length > 0 || data.debts.length > 0 || data.savings.length > 0 || data.settings.paymentSources.some((source) => source.openingBalance > 0); if (!window.localStorage.getItem("buget-familie:setup-complete") && !hasStarted) setSetupOpen(true); }} onAdd={() => openTx()} onGo={go} /></Suspense>} {setupOpen && <Suspense fallback={null}><FirstRunSetup data={data} onChange={applyData} onClose={() => setSetupOpen(false)} onGoPlan={() => go("plan")} onAdd={() => openTx()} onOpenSync={() => { setMore("sync"); go("utilities"); }} /></Suspense>}
    {modal === "quick" && !memberModeActive && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim înregistrarea rapidă…")}</div></div>}><QuickEntryPanel data={data} initialTemplateId={quickTemplateId} onSave={saveTx} onSaveTemplate={saveQuickTemplate} onDeleteTemplate={deleteQuickTemplate} onArchiveTemplate={archiveQuickTemplate} onRestoreTemplate={restoreQuickTemplate} onDeleteArchivedTemplate={deleteArchivedQuickTemplate} onClose={() => { setModal(null); setQuickTemplateId(undefined); }} onMore={(draft) => { setEditTx(draft); setQuickTemplateId(undefined); setModal("transaction"); }} /></Suspense>}
    {modal === "transaction" && !memberModeActive && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim mișcarea…")}</div></div>}><TransactionForm data={data} initial={editTx} onSave={saveTx} onClose={() => { setModal(null); setEditTx(undefined); }} /></Suspense>}
    {modal === "receipt" && !memberModeActive && <Suspense fallback={<div className="bf-modal-backdrop"><div className="bf-lazy-panel">{t("Pregătim bonul…")}</div></div>}><ReceiptForm data={data} onSave={saveReceipt} onClose={() => setModal(null)} /></Suspense>}
    {modal === "debt" && <Suspense fallback={null}><GoalForm data={data} type="debt" item={editGoal} onSave={saveDebt} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "saving" && <Suspense fallback={null}><GoalForm data={data} type="saving" item={editGoal} onSave={saveSaving} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {modal === "debt-payment" && editGoal && "remaining" in editGoal && <Suspense fallback={null}><DebtPaymentForm data={data} debt={editGoal} onSave={applyData} onClose={() => { setModal(null); setEditGoal(undefined); }} /></Suspense>}
    {whatsNewOpen && !onboardingOpen && !setupOpen && !firstWeekTourOpen && !modal && more !== "sync" && <WhatsNewSheet onClose={dismissWhatsNew} onOpenTheme={() => { dismissWhatsNew(); setThemePickerOpen(true); }} onOpenMore={() => { dismissWhatsNew(); setMore("overview"); go("utilities"); }} />}
  </div>;
}
