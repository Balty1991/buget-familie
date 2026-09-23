/**
 * Ecrane și formulare încărcate după Astăzi — nu intra în first paint.
 */
import "../receipt-mobile.css";
import "../receipt-form-fix.css";
import "../family-guide.css";
import "../objective-edit.css";
import "../currency.css";
import "../transaction-envelope-picker.css";
import "../mobile-capture-pass.css";
import "../mobile-obligations-pass.css";
import "../mobile-settings-pass.css";
/* Rândurile de membri din Setări își iau aspectul din pocket.css, care până acum venea
   doar cu panoul „Buzunar”: fără el, numele, bifa „Copil” și coșul se îngrămădeau. */
import "../pocket.css";
import "../atelier-review-final.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { BellRing, BrainCircuit, BookOpen, Bot, CalendarClock, CalendarDays, Check, Gift, Inbox, ChevronLeft, ChevronRight, Cloud, Download, LayoutDashboard, Search, Palette, PiggyBank, Plus, ReceiptText, Settings, ShieldCheck, ShoppingBasket, Store, PiggyBank as PiggyBankIcon, Trash2 } from "lucide-react";
import { createEmptyAppData, isoToday, type AppData, type Debt, type Receipt, type SavingsGoal } from "@/lib/finance-data";
import { clearReceiptImageStorage } from "@/lib/receipt-storage";
import { setSimpleMode } from "@/lib/ui-prefs";
import {
  BudgetBar,
  dateText,
  money,
  type MainView,
  type MoreView,
  type SyncPanelProps,
} from "@/pages/home-kit";
import { t, countLabel } from "@/lib/i18n";
import { plannedEventsPressure } from "@/lib/planned-events";
import { ReceiptsStudio } from "@/components/ReceiptsStudio";
import { LearnedRulesPanel } from "@/components/LearnedRulesPanel";
import { ProductCatalogPanel } from "@/components/ProductCatalogPanel";
import { SettingsPanel } from "./SettingsPanel";
export { SettingsPanel };
import { SyncPanel } from "./SyncPanel";
export { SyncPanel };
export { TransactionForm } from "./TransactionForm";
export { ThemePicker } from "./ThemePicker";
export { QuickActionsPalette, CalmOnboarding } from "./QuickActionsPalette";
export { ReceiptThumbnail } from "./ReceiptMedia";
import { ReceiptThumbnail } from "./ReceiptMedia";
export { GoalForm, DebtPaymentForm } from "./GoalForms";
export { SpendingHabitsView, LongTermGoalsView, SavingsScenarioSimulator } from "./HabitsGoals";
export { ReceiptForm } from "./ReceiptForm";
export { FamilyGuide } from "./FamilyGuide";
import { FamilyGuide } from "./FamilyGuide";
export { InsightsView } from "./InsightsView";

const ReportsPanel = lazy(() => import("@/components/ReportsPanel").then((module) => ({ default: module.ReportsPanel })));
const RecurringPanel = lazy(() => import("@/components/RecurringPanel").then((module) => ({ default: module.RecurringPanel })));
const ReviewCenterPanel = lazy(() => import("@/components/ReviewCenterPanel").then((module) => ({ default: module.ReviewCenterPanel })));
const PriceWatchPanel = lazy(() => import("@/components/PriceWatchPanel").then((module) => ({ default: module.PriceWatchPanel })));
const PocketPanel = lazy(() => import("@/components/PocketPanel").then((module) => ({ default: module.PocketPanel })));
const PlannedEventsPanel = lazy(() => import("@/components/PlannedEventsPanel").then((module) => ({ default: module.PlannedEventsPanel })));
const AdvisorPanel = lazy(() => import("@/components/AdvisorPanel").then((module) => ({ default: module.AdvisorPanel })));

export { DebtPaymentHistory, ObjectivesView } from "./ObjectivesView";

export function MoreView({ tab, setTab, data, onChange, onAddReceipt, onSaveReceipt, onDeleteReceipt, onOpenDebt, onOpenSaving, onOpenCalendar, onEditDebt, onEditSaving, onPayDebt, onGo, receiptStorageNotice, sync }: { tab: MoreView; setTab: (value: MoreView) => void; data: AppData; onChange: (value: AppData) => void; onAddReceipt: () => void; onSaveReceipt: (item: Receipt) => void; onDeleteReceipt: (id: string) => void; onOpenDebt: () => void; onOpenSaving: () => void; onOpenCalendar: () => void; onEditDebt?: (item: Debt) => void; onEditSaving?: (item: SavingsGoal) => void; onPayDebt?: (item: Debt) => void; onGo?: (view: MainView) => void; receiptStorageNotice?: string; sync: SyncPanelProps }) {
  const [simpleMode, setSimpleModeState] = useState(() => {
    try { return window.localStorage.getItem("buget-familie:simple-mode") === "1"; } catch { return false; }
  });
  useEffect(() => {
    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent<{ simpleMode?: boolean }>).detail;
      if (typeof detail?.simpleMode === "boolean") setSimpleModeState(detail.simpleMode);
    };
    window.addEventListener("buget-familie:ui-prefs", onPrefs);
    return () => window.removeEventListener("buget-familie:ui-prefs", onPrefs);
  }, []);
  useEffect(() => {
    if (!simpleMode) return;
    const allowed = new Set(["overview", "settings", "sync", "guide", "review", "recurring", "catalog"]);
    if (!allowed.has(tab)) setTab("overview");
  }, [simpleMode, tab, setTab]);
  const isCollaborative = data.settings.members.length > 1;
  /** Rândul din „Mai mult” spune deja cifra care contează: ce urmează și cât mai lipsește. */
  const eventsPressure = plannedEventsPressure(data.settings.plannedEvents, isoToday(), 90);
  const eventsHint = eventsPressure.next
    ? t("{name} · {date} · {amount} de strâns", { name: eventsPressure.next.event.name, date: dateText(eventsPressure.next.date), amount: money(eventsPressure.remaining) })
    : t("Crăciun, Paște, aniversări — cu costul lor");
  const content = () => {
    if (tab === "overview") return <div className="bf-more-overview">
      {simpleMode ? (
        <>
          <aside className="bf-simple-mode-top-banner" role="status" style={{ position: "relative", borderRadius: 12, marginBottom: 12 }}>
            <span>{t("Mod simplu activ — Dezactivează în Setări")}</span>
          </aside>
          <section className="bf-more-group" aria-labelledby="more-simple-title">
            <p className="bf-kicker bf-more-section-label" id="more-simple-title">{t("ESENȚIAL")}</p>
            <div className="bf-more-grid bf-settings-group">
              <button type="button" className="bf-settings-row" onClick={() => setTab("settings")}><Settings size={20} /><span className="bf-settings-copy"><b>{t("Setări")}</b><small>{t("profil, surse, backup și export")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
              <button type="button" className={data.pendingReview.length ? "bf-settings-row has-badge" : "bf-settings-row"} onClick={() => setTab("review")}><Inbox size={20} /><span className="bf-settings-copy"><b>{t("De verificat")}{data.pendingReview.length > 0 && <span className="bf-nav-count">{data.pendingReview.length}</span>}</b><small>{data.pendingReview.length ? t("{count} propuneri de confirmat", { count: data.pendingReview.length }) : t("import și confirmări")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
              <button type="button" className="bf-settings-row" onClick={() => setTab("catalog")}><Search size={20} /><span className="bf-settings-copy"><b>{t("Catalog")}</b><small>{t("caută un articol din listele online")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
              <button type="button" className="bf-settings-row" onClick={() => setTab("recurring")}><CalendarClock size={20} /><span className="bf-settings-copy"><b>{t("Scadențe")}</b><small>{t("facturi și abonamente")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
              <button type="button" className="bf-settings-row" onClick={() => setTab("sync")}><Cloud size={20} /><span className="bf-settings-copy"><b>{t("Sync")}</b><small>{t("opțională între telefoane")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
              <button type="button" className="bf-settings-row" onClick={() => setTab("settings")}><Download size={20} /><span className="bf-settings-copy"><b>{t("Backup / Export")}</b><small>{t("în Setări, pe acest telefon")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
              <button type="button" className="bf-settings-row" onClick={() => setTab("guide")}><BookOpen size={20} /><span className="bf-settings-copy"><b>{t("Tutorial")}</b><small>{t("tutorial de folosire")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
            </div>
          </section>
          <button type="button" className="bf-primary bf-simple-mode-exit" onClick={() => { setSimpleMode(false); setSimpleModeState(false); }}>{t("Arată instrumentele avansate")}</button>
        </>
      ) : (
        <>
      <section className="bf-more-group" aria-labelledby="more-daily-title">
        <p className="bf-kicker bf-more-section-label" id="more-daily-title">{t("ZILNIC")}</p>
        <div className="bf-more-grid bf-settings-group">
          <button type="button" className={data.pendingReview.length ? "bf-settings-row has-badge" : "bf-settings-row"} onClick={() => setTab("review")}><Inbox size={20} /><span className="bf-settings-copy"><b>{t("De verificat")}{data.pendingReview.length > 0 && <span className="bf-nav-count">{data.pendingReview.length}</span>}</b><small>{data.pendingReview.length ? t("{count} propuneri de confirmat", { count: data.pendingReview.length }) : t("import și confirmări")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("catalog")}><Search size={20} /><span className="bf-settings-copy"><b>{t("Catalog")}</b><small>{t("caută Napolact, Ariel, lapte — liste online")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("receipts")}><ReceiptText size={20} /><span className="bf-settings-copy"><b>{t("Bonuri")}</b><small>{t("produse, catalog și alimente vs nealimentare")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("recurring")}><CalendarClock size={20} /><span className="bf-settings-copy"><b>{t("Scadențe")}</b><small>{countLabel(data.recurring.length, { one: "{count} programată", few: "{count} programate", many: "{count} de programate" })}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={onOpenCalendar}><CalendarDays size={20} /><span className="bf-settings-copy"><b>{t("Calendar")}</b><small>{t("scadențe și obiective")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
        </div>
      </section>
      <section className="bf-more-group" aria-labelledby="more-money-title">
        <p className="bf-kicker bf-more-section-label" id="more-money-title">{t("BANI PE TERMEN LUNG")}</p>
        <div className="bf-more-grid bf-settings-group">
          <button type="button" className="bf-settings-row" onClick={() => setTab("debts")}><BellRing size={20} /><span className="bf-settings-copy"><b>{t("Datorii")}</b><small>{countLabel(data.debts.length, { one: "{count} activă", few: "{count} active", many: "{count} de active" })}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("savings")}><PiggyBank size={20} /><span className="bf-settings-copy"><b>{t("Economii")}</b><small>{countLabel(data.savings.length, { one: "{count} obiectiv", few: "{count} obiective", many: "{count} de obiective" })}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("events")}><Gift size={20} /><span className="bf-settings-copy"><b>{t("Evenimente viitoare")}</b><small>{eventsHint}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("prices")}><ShoppingBasket size={20} /><span className="bf-settings-copy"><b>{t("Prețuri")}</b><small>{t("istoric și coșul etalon")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("learned")}><BrainCircuit size={20} /><span className="bf-settings-copy"><b>{t("Ce am învățat")}</b><small>{t("regulile după care îți propun")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          {data.settings.members.some((item) => item.kind === "child") && <button type="button" className="bf-settings-row" onClick={() => setTab("pocket")}><PiggyBankIcon size={20} /><span className="bf-settings-copy"><b>{t("Buzunar")}</b><small>{t("banii copilului")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>}
        </div>
      </section>
      <section className="bf-more-group" aria-labelledby="more-house-title">
        <p className="bf-kicker bf-more-section-label" id="more-house-title">{t("CASĂ ȘI TELEFOANE")}</p>
        <div className="bf-more-grid bf-settings-group">
          <button type="button" className="bf-settings-row" onClick={() => setTab("settings")}><Settings size={20} /><span className="bf-settings-copy"><b>{isCollaborative ? t("Setări familie") : t("Setări profil")}</b><small>{isCollaborative ? t("membri și surse") : t("surse și categorii")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => { setTab("settings"); window.setTimeout(() => document.getElementById("bf-merchant-rules")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40); }}><Store size={20} /><span className="bf-settings-copy"><b>{t("Reguli comerciant")}</b><small>{t("categorie și plic după magazin")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("sync")}><Cloud size={20} /><span className="bf-settings-copy"><b>{t("Sincronizare")}</b><small>{isCollaborative ? t("spațiu conectat") : t("opțională între telefoane")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("reports")}><LayoutDashboard size={20} /><span className="bf-settings-copy"><b>{t("Statistici")}</b><small>{t("istoric și categorii")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("assistant")}><Bot size={20} /><span className="bf-settings-copy"><b>{t("Asistent")}</b><small>{t("explică datele")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("guide")}><BookOpen size={20} /><span className="bf-settings-copy"><b>{t("Tutorial")}</b><small>{t("cum notezi, cum citești cifra")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => window.dispatchEvent(new CustomEvent("buget-familie:open-theme"))}><Palette size={20} /><span className="bf-settings-copy"><b>{t("Aspect")}</b><small>{t("teme și texturi")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
        </div>
      </section>
        </>
      )}
    </div>;
    if (tab === "debts") return <div className="bf-more-list"><button className="bf-primary bf-inline-add" onClick={onOpenDebt}><Plus size={16} /> {t("Adaugă datorie")}</button>{data.debts.map((debt) => <article key={debt.id}><button type="button" className="bf-more-list-main" onClick={() => onEditDebt?.(debt)}><span><b>{debt.name}</b><small>{debt.due}</small></span><strong>{money(debt.remaining)}</strong><em>{t("Rată {amount}/lună", { amount: money(debt.monthly) })}</em></button>{debt.remaining > 0 && onPayDebt ? <button type="button" className="bf-more-list-pay" onClick={() => onPayDebt(debt)}><Check size={16} /> {t("Plătește")}</button> : null}</article>)}{!data.debts.length && <div className="bf-empty-state slim"><BellRing size={23} /><h2>{t("Nicio datorie")}</h2></div>}</div>;
    if (tab === "savings") return <div className="bf-more-list"><button className="bf-primary bf-inline-add" onClick={onOpenSaving}><Plus size={16} /> {t("Creează obiectiv")}</button>{data.savings.map((saving) => <article key={saving.id} role="button" tabIndex={0} onClick={() => onEditSaving?.(saving)} onKeyDown={(event) => { if (event.key === "Enter") onEditSaving?.(saving); }}><span><b>{saving.name}</b><small>{saving.due}</small></span><strong>{money(saving.current)}</strong><BudgetBar used={saving.current} total={saving.target} tone="gold" /></article>)}{!data.savings.length && <div className="bf-empty-state slim"><PiggyBank size={23} /><h2>{t("Niciun obiectiv")}</h2></div>}</div>;
    if (tab === "receipts") return <div>{receiptStorageNotice && <p className="bf-notice" role="status"><ShieldCheck size={15} /> {receiptStorageNotice}</p>}<ReceiptsStudio data={data} onAddReceipt={onAddReceipt} /><div className="bf-receipt-list">{data.receipts.map((receipt) => <article key={receipt.id}><ReceiptThumbnail receipt={receipt} /><div><b>{receipt.vendor}</b><small>{dateText(receipt.date)} · {receipt.lines?.length || 1} {t("produse")}</small><p>{receipt.lines?.map((line) => `${line.label || line.category}: ${money(line.amount)}`).join(" · ") || receipt.note || t("Fără detalii")}</p>{(receipt.imageKeys?.length || (receipt.imageData2 ? 2 : receipt.imageData ? 1 : 0)) > 1 && <small>{t("Bon în două fotografii")}</small>}</div><strong>{money(receipt.amount)}</strong><button aria-label={`Șterge bonul ${receipt.vendor}`} onClick={() => onDeleteReceipt(receipt.id)}><Trash2 size={16} /></button></article>)}{!data.receipts.length && <div className="bf-empty-state slim"><ReceiptText size={23} /><h2>{t("Niciun bon")}</h2><p>{t("Fotografiază un bon din ghid sau de aici, ori caută un produs în catalog.")}</p></div>}</div></div>;
    if (tab === "catalog") return <ProductCatalogPanel data={data} onSaveReceipt={onSaveReceipt} onOpenReceiptForm={onAddReceipt} />;
    if (tab === "review") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim revizuirea…")}</div>}><ReviewCenterPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "prices") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim prețurile…")}</div>}><PriceWatchPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "pocket") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim buzunarul…")}</div>}><PocketPanel data={data} /></Suspense>;
    if (tab === "events") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim evenimentele…")}</div>}><PlannedEventsPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "recurring") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim scadențele…")}</div>}><RecurringPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "reports") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim statisticile…")}</div>}><ReportsPanel data={data} onGo={onGo} /></Suspense>;
    if (tab === "assistant") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim asistentul…")}</div>}><AdvisorPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "learned") return <LearnedRulesPanel data={data} onChange={onChange} />;
    if (tab === "settings") return <SettingsPanel data={data} onChange={onChange} onReset={() => { if (!window.confirm(t("Ștergi toate datele locale de pe acest dispozitiv?"))) return; void clearReceiptImageStorage(); onChange(createEmptyAppData()); }} />;
    if (tab === "guide") return <FamilyGuide onGo={onGo} onOpenReview={() => setTab("review")} onOpenSync={() => setTab("sync")} />;
    return <SyncPanel {...sync} />;
  };
  return <div className="bf-page bf-utilities-workspace"><header className="bf-topline compact"><div><h1>{t("Mai mult")}</h1></div></header>{tab !== "overview" && <div className="bf-more-back-row"><button type="button" className="bf-more-back" onClick={() => setTab("overview")}><ChevronLeft size={18} aria-hidden="true" /> {t("Înapoi la instrumente")}</button></div>}{content()}</div>;
}

