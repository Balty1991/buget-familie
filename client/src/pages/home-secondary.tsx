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
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BellRing, BrainCircuit, BookOpen, Bot, CalendarClock, CalendarDays, Camera, Check, Copy, Gift, Images, Inbox, ChevronLeft, ChevronRight, Cloud, Download, Goal, LayoutDashboard, Search, Palette, Pencil, PiggyBank, Plus, ReceiptText, RotateCcw, Settings, ShieldCheck, ShoppingBasket, Store, PiggyBank as PiggyBankIcon, Trash2, Users, WalletCards, X , Smartphone, KeyRound, ShieldAlert } from "lucide-react";
import { BASE_CURRENCY, addIsoDays, allocationBudget, allocationSpent, allocationWeekStatus, allocationWeeksStatus, createEmptyAppData, exchangeRateFor, sourceCurrency, toBaseAmount, expenseCategories, formatDate, isoToday, isWeeklyPaced, matchingAllocationsForExpense, pickerAllocationsForExpense, planAllocationMath, newId, parseRomanianAmount, recordDebtPayment, guessCategoryFromText, resolveReceiptLines, sourceBalance, type AppData, type Debt, type Receipt, type SavingsGoal, type Transaction, type TransactionKind, type ShareScope, transactionShareScope} from "@/lib/finance-data";
import { checkFamilyPassword, generateFamilyPassword } from "@/lib/family-password";
import { acquireReceiptObjectUrl, acquireReceiptPreviewUrl, clearReceiptImageStorage, releaseReceiptObjectUrl, storeReceiptImages } from "@/lib/receipt-storage";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { EnvelopeStack } from "@/components/EnvelopeMark";
import { setSimpleMode } from "@/lib/ui-prefs";
import {
  BudgetBar,
  Field,
  Modal,
  automaticTheme,
  backgroundOptions,
  currentLocalMinutes,
  dateText,
  fmtExact,
  money,
  themeOptions,
  timeToMinutes,
  type BackgroundId,
  type MainView,
  type MoreView,
  type SyncPanelProps,
  type ThemeId,
  type ThemeSchedule,
  type ThemeScheduleTimes,
} from "@/pages/home-kit";
import { getLocale, t, countLabel } from "@/lib/i18n";
import { canUseFamilySync } from "@/lib/entitlements";
import { FamilieUpgrade } from "@/components/FamilieUpgrade";
import { plannedEventsPressure } from "@/lib/planned-events";
import { UsageTutorial } from "@/components/UsageTutorial";
import { ReceiptsStudio } from "@/components/ReceiptsStudio";
import { LearnedRulesPanel } from "@/components/LearnedRulesPanel";
import { ProductCatalogPanel } from "@/components/ProductCatalogPanel";
import { matchCommandQuery, searchLedgerHits, writeJournalQuery } from "@/lib/command-search";
import { completeOnboardingTourOnly } from "@/lib/first-week-tour";
import { SettingsPanel } from "./SettingsPanel";
export { SettingsPanel };

const ReportsPanel = lazy(() => import("@/components/ReportsPanel").then((module) => ({ default: module.ReportsPanel })));
const RecurringPanel = lazy(() => import("@/components/RecurringPanel").then((module) => ({ default: module.RecurringPanel })));
const ReviewCenterPanel = lazy(() => import("@/components/ReviewCenterPanel").then((module) => ({ default: module.ReviewCenterPanel })));
const PriceWatchPanel = lazy(() => import("@/components/PriceWatchPanel").then((module) => ({ default: module.PriceWatchPanel })));
const PocketPanel = lazy(() => import("@/components/PocketPanel").then((module) => ({ default: module.PocketPanel })));
const PlannedEventsPanel = lazy(() => import("@/components/PlannedEventsPanel").then((module) => ({ default: module.PlannedEventsPanel })));
const AdvisorPanel = lazy(() => import("@/components/AdvisorPanel").then((module) => ({ default: module.AdvisorPanel })));
const HouseholdStudio = lazy(() => import("@/components/HouseholdStudio").then((module) => ({ default: module.HouseholdStudio })));

export function ThemePicker({ theme, schedule, scheduleTimes, highContrast, background, onChange, onScheduleChange, onScheduleTimesChange, onContrastChange, onBackgroundChange, onClose }: { theme: ThemeId; schedule: ThemeSchedule; scheduleTimes: ThemeScheduleTimes; highContrast: boolean; background: BackgroundId; onChange: (theme: ThemeId) => void; onScheduleChange: (schedule: ThemeSchedule) => void; onScheduleTimesChange: (times: ThemeScheduleTimes) => void; onContrastChange: (active: boolean) => void; onBackgroundChange: (background: BackgroundId) => void; onClose: () => void }) {
  const [preview, setPreview] = useState<ThemeId>(theme);
  const [previewBackground, setPreviewBackground] = useState<BackgroundId>(background);
  const previewOption = themeOptions.find((option) => option.id === preview) || themeOptions[0];
  const scheduleIsValid = timeToMinutes(scheduleTimes.dayStart, -1) < timeToMinutes(scheduleTimes.eveningStart, -1) && timeToMinutes(scheduleTimes.eveningStart, -1) < timeToMinutes(scheduleTimes.nightStart, -1);
  const applyPreview = () => { onChange(preview); onBackgroundChange(previewBackground); onScheduleChange(schedule); onClose(); };
  const selectBackground = (id: BackgroundId) => {
    setPreviewBackground(id);
    onBackgroundChange(id);
  };
  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (event.target === event.currentTarget) onClose();
  };
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  return createPortal(
    <div className="bf-modal-backdrop bf-theme-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
      <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-theme-picker" role="dialog" aria-modal="true" aria-label={t("Alege aspectul")} onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("ASPECTUL APLICAȚIEI")}</p>
            <h2>{t("Alege o atmosferă, nu doar o culoare.")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide alegerea temei")} onClick={onClose}><X size={19} /></button>
        </header>
        <div className="bf-theme-picker-body">
        <p className="bf-theme-picker-intro">{t("Previzualizezi tema înainte de aplicare. Verdele rămâne progres, mierea înseamnă revizuire, iar coralul atrage atenția.")}</p>
        <section className={`bf-theme-preview ${preview} background-preview-${previewBackground}`} aria-label={`Previzualizare ${previewOption.name}`}>
          <div className="bf-theme-preview-top"><span>{previewOption.mood}</span><b>{previewOption.name}</b></div>
          <div className="bf-theme-preview-value"><small>{t("RĂMAS ÎN PLICURI")}</small><strong>1.480 lei</strong><i /></div>
          <div className="bf-theme-preview-stats"><span>{t("SURSE UTILIZABILE")} <b>4.830 lei</b></span><span>{t("PUS DEOPARTE")} <b>780 lei</b></span></div>
          <div className="bf-theme-preview-cta"><span>{t("Înregistrează")}</span></div>
          <div className="bf-theme-preview-nav"><i /><i /><i /><i /><i /></div>
        </section>
        <p className="bf-theme-preview-note">{t("Tema se aplică din butonul de jos. Textura suprafeței se schimbă imediat, la atingere.")}</p>
        <div className="bf-theme-grid">
          {themeOptions.map((option) => (
            <button key={option.id} type="button" className={`bf-theme-option ${option.id} ${preview === option.id ? "selected" : ""}`} aria-pressed={preview === option.id} onClick={() => setPreview(option.id)}>
              <span className="bf-theme-swatch" aria-hidden="true"><span /></span>
              <span><em>{option.mood}</em><b>{option.name}</b><small>{option.detail}</small></span>
              <i>{preview === option.id && <Check size={14} />}</i>
            </button>
          ))}
        </div>
        <section className="bf-background-preferences" aria-labelledby="bf-background-title">
          <div>
            <p className="bf-kicker">{t("FUNDAL")}</p>
            <h3 id="bf-background-title">{t("Alege textura suprafeței")}</h3>
            <p>{t("Atinge o dală — se aplică imediat, cu inel și bifă, fără să atingă cifrele.")}</p>
          </div>
          <div className="bf-background-grid" role="listbox" aria-label={t("Textura suprafeței")}>
            {backgroundOptions.map((option) => {
              const selected = previewBackground === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  aria-selected={selected}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    selectBackground(option.id);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectBackground(option.id);
                  }}
                >
                  <span className={`bf-background-swatch ${option.id}`} aria-hidden="true" />
                  <span className="bf-background-copy">
                    <b>{option.name}</b>
                    <small>{option.detail}</small>
                  </span>
                  {selected ? <i aria-hidden="true"><Check size={12} /></i> : null}
                </button>
              );
            })}
          </div>
        </section>
        <section className="bf-theme-preferences" aria-label={t("Preferințe temă")}>
          <button type="button" className={schedule === "auto" ? "active" : ""} role="switch" aria-checked={schedule === "auto"} onClick={() => onScheduleChange(schedule === "auto" ? "manual" : "auto")}>
            <span>
              <b>{t("Comută automat zi/noapte")}</b>
              <small>{schedule === "auto" ? `Activ acum: ${themeOptions.find((item) => item.id === automaticTheme(currentLocalMinutes(), scheduleTimes))?.name || "tema automată"}. Zi ${scheduleTimes.dayStart}–${scheduleTimes.eveningStart} · seară ${scheduleTimes.eveningStart}–${scheduleTimes.nightStart} · noapte ${scheduleTimes.nightStart}–${scheduleTimes.dayStart}.` : t("Folosește Alb ziua, Cyber Teal seara și Întunecat noaptea.")}</small>
            </span>
            <i aria-hidden="true" />
          </button>
          <div className="bf-theme-schedule-fields" aria-label="Intervale automate">
            <label><span>{t("Ziua începe")}</span><input type="time" value={scheduleTimes.dayStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, dayStart: event.target.value })} /></label>
            <label><span>{t("Seara începe")}</span><input type="time" value={scheduleTimes.eveningStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, eveningStart: event.target.value })} /></label>
            <label><span>{t("Noaptea începe")}</span><input type="time" value={scheduleTimes.nightStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, nightStart: event.target.value })} /></label>
          </div>
          {!scheduleIsValid && <small className="bf-theme-schedule-error">{t("Ordinea trebuie să fie zi → seară → noapte. Până la corectare se folosesc temporar valorile standard: 06:00, 17:00 și 21:00.")}</small>}
          <button type="button" className={highContrast ? "active" : ""} role="switch" aria-checked={highContrast} onClick={() => onContrastChange(!highContrast)}>
            <span>
              <b>{t("Contrast extra-ridicat")}</b>
              <small>{t("Contururi, texte secundare și stări active mai puternice, fără a schimba culorile banilor.")}</small>
            </span>
            <i aria-hidden="true" />
          </button>
        </section>
        </div>
        <div className="bf-theme-picker-footer">
        <button type="button" className="bf-primary bf-theme-apply" onClick={applyPreview}><Check size={17} /> {t("Aplică {name}", { name: previewOption.name })}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function QuickActionsPalette({ data, onClose, onAdd, onGo }: { data?: AppData; onClose: () => void; onAdd: () => void; onGo: (view: MainView) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const actions = [
    { id: "expense", label: t("Înregistrează o mișcare"), detail: t("Adaugă rapid o cheltuială sau un venit"), icon: ReceiptText, run: onAdd },
    { id: "plan", label: t("Verifică plicurile"), detail: t("Vezi repartizarea și soldurile planului"), icon: Goal, run: () => onGo("plan") },
    { id: "goals", label: "Deschide obiectivele", detail: t("Construiește planurile pe termen lung"), icon: PiggyBank, run: () => onGo("goals") },
    { id: "journal", label: "Deschide registrul", detail: t("Caută și corectează mișcări"), icon: WalletCards, run: () => onGo("journal") },
    { id: "obligations", label: t("Verifică obligațiile"), detail: t("Urmărește ratele, economiile și scadențele"), icon: BellRing, run: () => onGo("obligations") },
    { id: "insights", label: t("Vezi analiza"), detail: t("Înțelege ritmul și tendințele casei"), icon: LayoutDashboard, run: () => onGo("insights") },
    { id: "habits", label: t("Înțelege obiceiurile"), detail: t("Observă tipare fără judecată"), icon: WalletCards, run: () => onGo("habits") },
    { id: "calendar", label: "Deschide calendarul", detail: t("Vezi veniturile, scadențele și obiectivele"), icon: CalendarDays, run: () => onGo("calendar") },
    { id: "guide", label: t("Tutorial de folosire"), detail: t("Cum notezi, cum citești plicul și cifra de azi"), icon: BookOpen, run: () => { window.dispatchEvent(new Event("buget-familie:open-usage-tutorial")); } },
  ];
  const visible = actions.filter((action) => matchCommandQuery(`${action.label} ${action.detail}`, query));
  const ledgerHits = searchLedgerHits(data?.transactions || [], query, 6);
  const openLedger = (term: string) => {
    writeJournalQuery(window.sessionStorage, term);
    onGo("journal");
    onClose();
  };
  useEffect(() => {
    const desktop = window.matchMedia("(pointer: fine)").matches;
    if (desktop) inputRef.current?.focus();
    else dialogRef.current?.focus();
  }, []);
  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (event.target === event.currentTarget) onClose();
  };
  return createPortal(
    <div className="bf-modal-backdrop bf-command-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
      <section ref={dialogRef} tabIndex={-1} className="bf-command-palette" role="dialog" aria-modal="true" aria-labelledby="bf-command-title" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("NAVIGARE RAPIDĂ")}</p>
            <h2 id="bf-command-title">{t("Ce vrei să faci?")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={19} /></button>
        </header>
        <label className="bf-command-search">
          <Search size={17} aria-hidden="true" />
          <input ref={inputRef} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Caută o mișcare sau o acțiune…")} aria-label={t("Caută o mișcare sau o acțiune")} />
        </label>
        <div className="bf-command-list" role="listbox" aria-label={t("Acțiuni disponibile")}>
          {visible.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id} type="button" role="option" className={action.id === "expense" ? "is-primary" : undefined} onClick={() => { action.run(); onClose(); }}>
                <span className="bf-command-icon"><Icon size={17} /></span>
                <span><b>{action.label}</b><small>{action.detail}</small></span>
                <ChevronRight size={16} />
              </button>
            );
          })}
          {ledgerHits.length > 0 && <p className="bf-command-section">{t("Mișcări din registru")}</p>}
          {ledgerHits.map((item) => (
            <button key={item.id} type="button" role="option" onClick={() => openLedger(item.title)}>
              <span className="bf-command-icon"><ReceiptText size={17} /></span>
              <span><b>{item.title}</b><small>{item.category}{item.person ? ` · ${item.person}` : ""}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
          {query.trim() && !visible.length && !ledgerHits.length && <p className="bf-command-empty">{t("Nu am găsit o mișcare sau o acțiune pentru „{query}”.", { query })}</p>}
        </div>
        <p className="bf-command-hint">{t("Scurtătură:")} <kbd>Ctrl</kbd><span>+</span><kbd>K</kbd> {t("sau")} <kbd>⌘</kbd><span>+</span><kbd>K</kbd></p>
      </section>
    </div>,
    document.body,
  );
}

export function CalmOnboarding({ onClose, onAdd: _onAdd, onGo: _onGo }: { onClose: () => void; onAdd: () => void; onGo: (view: MainView) => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const steps = [
    { kicker: t("ÎNCREDERE"), title: t("Date pe telefon."), emphasis: t("Sync opțional. Fără login bancar."), detail: t("Registrul rămâne local. Sync-ul de familie e criptat cu o parolă pe care o alegeți voi — fără cont bancar și fără reclame pe ecranele financiare."), icon: WalletCards, tone: "calm" },
    { kicker: t("01 · ÎMPĂRȚIM"), title: t("Punem banii în locul potrivit."), emphasis: t("Pas cu pas."), detail: t("Un plic este o sumă pusă deoparte pentru un scop: mâncare, facturi, transport sau orice contează pentru tine."), icon: Goal, tone: "envelope" },
    { kicker: t("02 · AZI"), title: t("Vezi ce poți folosi azi."), emphasis: t("Fără presupuneri."), detail: t("Ecranul Astăzi îți arată cât a mai rămas în plicuri, ce plăți urmează și care este următorul pas simplu."), icon: CalendarClock, tone: "rhythm" },
    { kicker: t("03 · PRIMUL PAS"), title: t("Începe cu o singură"), emphasis: t("cheltuială sau încasare."), detail: t("Nu trebuie să completezi totul acum. Adaugă un singur lucru și construim de acolo."), icon: Plus, tone: "start" },
  ];
  const current = steps[step]; const Icon = current.icon;
  const skipTour = () => {
    // Doar turul: FirstRunSetup (3 intenții) trebuie să rămână vizibil.
    completeOnboardingTourOnly(window.localStorage);
    onClose();
  };
  const startSetup = () => {
    completeOnboardingTourOnly(window.localStorage);
    onClose();
  };
  return <div className="bf-modal-backdrop bf-onboarding-backdrop" role="presentation"><section ref={dialogRef} tabIndex={-1} className={`bf-onboarding ${current.tone}`} role="dialog" aria-modal="true" aria-labelledby="bf-onboarding-title"><button type="button" className="bf-onboarding-skip" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); skipTour(); }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); skipTour(); }}>{t("Sari peste")}</button><div className="bf-onboarding-visual" aria-hidden="true"><EnvelopeStack fill={(step + 1) / 4} /><span className="bf-onboarding-orbit orbit-one" /><span className="bf-onboarding-orbit orbit-two" /><span className="bf-onboarding-icon"><Icon size={34} /></span><span className="bf-onboarding-number">0{step + 1}</span></div><div className="bf-onboarding-copy"><p className="bf-kicker">{current.kicker}</p><h2 id="bf-onboarding-title">{current.title}<em>{current.emphasis}</em></h2><p>{current.detail}</p></div><div className="bf-onboarding-progress" aria-label={t("Pasul {current} din {total}", { current: step + 1, total: steps.length })}>{steps.map((item, index) => <span key={item.kicker} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>{step < steps.length - 1 ? <div className="bf-onboarding-actions"><button type="button" className="bf-primary" onClick={() => setStep((value) => value + 1)}>{t("Continuă")} <ChevronRight size={17} /></button></div> : <div className="bf-onboarding-actions"><button type="button" className="bf-primary" onClick={startSetup}>{t("Începem configurarea")} <ChevronRight size={17} /></button></div>}<small className="bf-onboarding-footnote">{t("Poți relua acest tur oricând din")} <b>{t("Mai mult → Tutorial")}</b>.</small></section></div>;
}
export function ReceiptThumbnail({ receipt }: { receipt: Receipt }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | undefined>();
  const photoCount = receipt.imageKeys?.length || (receipt.imageData2 ? 2 : receipt.imageData ? 1 : 0);
  const hasPhoto = photoCount > 0;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver !== "function") { setVisible(true); return; }
    let leaveTimer: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      const onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen) {
        if (leaveTimer) window.clearTimeout(leaveTimer);
        setVisible(true);
        return;
      }
      leaveTimer = window.setTimeout(() => setVisible(false), 480);
    }, { rootMargin: "180px 0px" });
    observer.observe(node);
    return () => { observer.disconnect(); if (leaveTimer) window.clearTimeout(leaveTimer); };
  }, []);
  useEffect(() => {
    if (!visible) { setUrl(undefined); return; }
    if (receipt.imageData) { setUrl(receipt.imageData); return; }
    const key = receipt.imageKeys?.[0];
    if (!key) { setUrl(undefined); return; }
    let active = true;
    let cacheKey: string | undefined;
    void acquireReceiptPreviewUrl(key).then((next) => {
      if (!active) { if (next) releaseReceiptObjectUrl(next.cacheKey); return; }
      cacheKey = next?.cacheKey;
      setUrl(next?.url);
    }).catch(() => { if (active) setUrl(undefined); });
    return () => { active = false; releaseReceiptObjectUrl(cacheKey); setUrl(undefined); };
  }, [visible, receipt.imageData, receipt.imageKeys?.[0]]);
  return (
    <>
      <span ref={ref} className="bf-receipt-thumb">
        <button type="button" disabled={!hasPhoto} aria-label={hasPhoto ? `Deschide fotografia bonului ${receipt.vendor}` : undefined} onClick={() => { if (hasPhoto) setOpen(true); }}>
          {url ? <img src={url} alt="" width={54} height={54} sizes="54px" loading="lazy" decoding="async" fetchPriority="low" /> : <span className="bf-receipt-icon"><ReceiptText size={21} /></span>}
          {photoCount > 1 ? <i className="bf-receipt-count">{photoCount}</i> : null}
        </button>
      </span>
      {open ? <ReceiptPhotoViewer receipt={receipt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function receiptPhotoSources(receipt: Receipt): Array<{ id: string; key?: string; dataUrl?: string }> {
  if (receipt.imageKeys?.length) return receipt.imageKeys.map((key) => ({ id: key, key }));
  return [receipt.imageData, receipt.imageData2].filter((image): image is string => Boolean(image)).map((dataUrl, index) => ({ id: `inline-${index}`, dataUrl }));
}

function ReceiptPhotoViewer({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const sources = receiptPhotoSources(receipt);
  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState<string | undefined>();
  const current = sources[index];
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  useEffect(() => {
    if (!current) { setUrl(undefined); return; }
    if (current.dataUrl) { setUrl(current.dataUrl); return; }
    if (!current.key) { setUrl(undefined); return; }
    let active = true;
    let cacheKey: string | undefined;
    void acquireReceiptObjectUrl(current.key).then((next) => {
      if (!active) { if (next) releaseReceiptObjectUrl(current.key); return; }
      if (next) cacheKey = current.key;
      setUrl(next);
    }).catch(() => { if (active) setUrl(undefined); });
    return () => { active = false; releaseReceiptObjectUrl(cacheKey); setUrl(undefined); };
  }, [current?.id, current?.key, current?.dataUrl]);
  if (!current) return null;
  return createPortal(
    <div className="bf-modal-backdrop bf-receipt-photo-sheet" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} tabIndex={-1} className="bf-receipt-photo-card" role="dialog" aria-modal="true" aria-label={`Fotografie bon ${receipt.vendor}`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("BON LOCAL")}</p>
            <h2>{receipt.vendor}</h2>
          </div>
          <button className="bf-icon-button" aria-label={t("Închide fotografia")} onClick={onClose}><X size={19} /></button>
        </header>
        <div className="bf-receipt-photo-frame">
          {url ? <img src={url} alt={`Bon ${receipt.vendor}, partea ${index + 1}`} decoding="async" /> : <span>{t("Pregătim fotografia…")}</span>}
        </div>
        {sources.length > 1 ? (
          <div className="bf-receipt-photo-switch" role="tablist" aria-label={t("Părțile bonului")}>
            <button type="button" disabled={index === 0} aria-label={t("Partea anterioară")} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={17} /></button>
            {sources.map((source, photoIndex) => (
              <button key={source.id} type="button" role="tab" aria-selected={photoIndex === index} className={photoIndex === index ? "active" : ""} onClick={() => setIndex(photoIndex)}>Partea {photoIndex + 1}</button>
            ))}
            <button type="button" disabled={index === sources.length - 1} aria-label={t("Partea următoare")} onClick={() => setIndex((value) => Math.min(sources.length - 1, value + 1))}><ChevronRight size={17} /></button>
          </div>
        ) : null}
        <p>{t("Fotografia rămâne pe telefon. Nu este trimisă în sincronizarea familiei.")}</p>
      </section>
    </div>,
    document.body,
  );
}

export function TransactionForm({ data, initial, onSave, onClose }: { data: AppData; initial?: Transaction; onSave: (item: Transaction | Transaction[], meta?: { fromWeekIndex?: number }) => void; onClose: () => void }) {
  const [kind, setKind] = useState<TransactionKind>(initial?.kind || "expense");
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date || isoToday());
  const [memberId, setMemberId] = useState(initial?.memberId || data.settings.members.find((member) => member.name === initial?.person)?.id || data.settings.members[0]?.id || "");
  const [shareScope, setShareScope] = useState<ShareScope>(transactionShareScope(initial));
  const [sourceId, setSourceId] = useState(initial?.sourceId || data.settings.paymentSources.find((source) => source.name === initial?.source)?.id || data.settings.paymentSources[0]?.id || "");
  const [category, setCategory] = useState(initial?.category || "Alimente");
  const [allocationId, setAllocationId] = useState(initial?.allocationId || "outside");
  const [fromWeekIndex, setFromWeekIndex] = useState<number | undefined>();
  const [allocationChoiceTouched, setAllocationChoiceTouched] = useState(Boolean(initial));
  const [note, setNote] = useState(initial?.note || "");
  const [error, setError] = useState("");
  const captureIdRef = useRef(initial?.id || newId("tx"));
  const [originalAmountInput, setOriginalAmountInput] = useState(initial?.originalAmount ? String(initial.originalAmount) : "");
  const [splitOpen, setSplitOpen] = useState(false);
  const [lines, setLines] = useState<Array<{ id: string; category: string; amount: string; label: string }>>([
    { id: newId("split-line"), category: initial?.category || "Alimente", amount: initial ? String(initial.amount) : "", label: "" },
  ]);
  const entryCurrency = sourceCurrency(data, sourceId);
  const isForeign = entryCurrency !== BASE_CURRENCY;
  const savedRate = exchangeRateFor(data, entryCurrency);
  const [rateInput, setRateInput] = useState(initial?.exchangeRate ? String(initial.exchangeRate) : "");
  const activeRate = parseRomanianAmount(rateInput) || savedRate || 0;
  const typedAmount = parseRomanianAmount(amount);
  const baseAmount = isForeign ? toBaseAmount(typedAmount, activeRate) : typedAmount;
  const envelopeMatched = kind === "expense" ? matchingAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const envelopeCandidates = kind === "expense" ? pickerAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const envelopeCandidateIds = envelopeCandidates.map((item) => item.id).join("|");
  const matchedEnvelope = allocationId === "outside" ? undefined : envelopeCandidates.find((allocation) => allocation.id === allocationId);
  const sourceOwner = (source: AppData["settings"]["paymentSources"][number]) => data.settings.members.find((member) => member.id === source.memberId)?.name || t("Comun");
  const allocationMember = matchedEnvelope ? data.settings.members.find((member) => member.id === matchedEnvelope.memberId)?.name || t("Familie / comun") : "";
  const editedAlreadyInEnvelope = Boolean(matchedEnvelope && initial?.id && initial.allocationId === matchedEnvelope.id);
  const envelopeSpent = matchedEnvelope ? Math.max(0, allocationSpent(data, matchedEnvelope) - (editedAlreadyInEnvelope ? initial?.amount || 0 : 0)) : 0;
  const envelopeRemaining = matchedEnvelope ? allocationBudget(data, matchedEnvelope) - envelopeSpent : 0;
  const pacedEnvelope = Boolean(matchedEnvelope && isWeeklyPaced(matchedEnvelope, data.settings.salaryPlan));
  const matchedWeek = pacedEnvelope ? allocationWeekStatus(data, matchedEnvelope!, date) : undefined;
  const envelopeWeeks = pacedEnvelope ? allocationWeeksStatus(data, matchedEnvelope!) : [];
  const initialInsideMatchedWeek = Boolean(initial && initial.date && matchedWeek && initial.date >= matchedWeek.start && initial.date <= matchedWeek.end);
  const adjustedWeekSpent = matchedWeek ? Math.max(0, matchedWeek.spent - (editedAlreadyInEnvelope && initialInsideMatchedWeek ? initial?.amount || 0 : 0)) : 0;
  const weekRemaining = matchedWeek ? matchedWeek.budget - adjustedWeekSpent : 0;
  const proposedAmount = baseAmount || 0;
  const envelopeAfter = envelopeRemaining - proposedAmount;
  const weekAfter = weekRemaining - proposedAmount;
  const unrepartized = planAllocationMath(data).unrepartized;
  const hideUnallocated = kind === "expense" && envelopeMatched.length > 0 && unrepartized < Math.max(0.005, proposedAmount);
  const canSplit = kind === "expense" && !initial && !isForeign;
  const resolvedSplit = canSplit && splitOpen ? resolveReceiptLines(lines, typedAmount) : [];
  const splitTotal = resolvedSplit.reduce((sum, line) => sum + line.amount, 0);
  useEffect(() => { setRateInput(savedRate && savedRate !== 1 ? String(savedRate) : ""); }, [entryCurrency]);
  useEffect(() => {
    if (kind !== "expense") { if (allocationId !== "outside") setAllocationId("outside"); return; }
    if (hideUnallocated && allocationId === "outside" && envelopeMatched[0]) {
      setAllocationId(envelopeMatched[0].id);
      return;
    }
    const currentIsValid = allocationId !== "outside" && envelopeCandidates.some((allocation) => allocation.id === allocationId);
    if (!currentIsValid && allocationId !== "outside") setAllocationId(envelopeCandidates[0]?.id || "outside");
    if (!allocationChoiceTouched && allocationId === "outside") {
      const fallback = envelopeMatched[0] || (envelopeCandidates.length === 1 ? envelopeCandidates[0] : undefined);
      if (fallback) setAllocationId(fallback.id);
    }
  }, [allocationChoiceTouched, allocationId, envelopeCandidateIds, hideUnallocated, kind]);
  useEffect(() => {
    setFromWeekIndex(matchedWeek?.index);
  }, [allocationId, matchedWeek?.index]);
  const updateLine = (id: string, patch: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const save = () => {
    const numeric = parseRomanianAmount(amount);
    const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    const member = data.settings.members.find((item) => item.id === memberId);
    if (!title.trim()) return setError(t("Scrie o denumire pentru mișcare."));
    if (!numeric || numeric <= 0) return setError(t("Introdu o sumă mai mare decât zero."));
    if (!source || !member || !date) return setError(t("Alege data, membrul și sursa de plată."));
    if (isForeign && !(activeRate > 0)) return setError(t("Introdu cursul pentru {currency}: câți lei face o unitate.", { currency: entryCurrency }));
    const stored = isForeign ? toBaseAmount(numeric, activeRate) : numeric;
    if (!stored || stored <= 0) return setError(t("Suma convertită în lei nu este validă. Verifică suma și cursul."));
    if (canSplit && splitOpen) {
      const normalized = resolveReceiptLines(lines, numeric);
      const total = normalized.reduce((sum, line) => sum + line.amount, 0);
      if (!normalized.length || Math.abs(numeric - total) > 0.01) {
        return setError(t("Repartizarea este {split}, dar totalul este {total}. Corectează liniile.", { split: fmtExact.format(total), total: fmtExact.format(numeric) }));
      }
      const now = new Date().toISOString();
      const batch = normalized.map((line, index) => {
        const matched = matchingAllocationsForExpense(data, { category: line.category, memberId: member.id, sourceId: source.id })[0];
        return {
          id: index === 0 ? captureIdRef.current : newId("tx"),
          title: `${title.trim()}${line.label ? ` · ${line.label}` : ""}`,
          amount: line.amount,
          kind: "expense" as const,
          category: line.category,
          sourceId: source.id,
          source: source.name,
          memberId: member.id,
          person: member.name,
          date,
          note: note.trim() || undefined,
          allocationId: matched?.id || "outside",
          shareScope,
          createdAt: now,
          updatedAt: now,
        };
      });
      try {
        onSave(batch);
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
      }
      return;
    }
    if (kind === "expense" && allocationId !== "outside" && !matchedEnvelope) return setError(t("Plicul ales nu mai corespunde categoriei, membrului sau sursei. Alege din nou."));
    const originalTyped = isForeign ? (parseRomanianAmount(originalAmountInput) || numeric) : undefined;
    try {
      onSave({ id: captureIdRef.current, title: title.trim(), amount: stored, originalAmount: isForeign ? originalTyped : undefined, originalCurrency: isForeign ? entryCurrency : undefined, exchangeRate: isForeign ? activeRate : undefined, kind, category: kind === "income" ? "Venit" : category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date, note: note.trim() || undefined, allocationId: kind === "expense" ? allocationId : undefined, shareScope, createdAt: initial?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), receiptId: initial?.receiptId }, { fromWeekIndex: kind === "expense" && pacedEnvelope ? fromWeekIndex : undefined });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
    }
  };
  return <Modal title={initial ? t("Corectează mișcarea") : t("Adaugă mișcare")} onClose={onClose}><div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>{t("Cheltuială")}</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>{t("Venit")}</button></div><div className="bf-form-grid"><Field label={t("Denumire")}><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("ex. Cumpărături Lidl")} /></Field><Field label={t("Sumă ({currency})", { currency: isForeign ? entryCurrency : "lei" })}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>{isForeign && <Field label={t("Curs: 1 {currency} = ? lei", { currency: entryCurrency })} hint={savedRate ? t("Cursul salvat în Setări este {rate}. Îl poți schimba doar pentru această mișcare.", { rate: savedRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) }) : t("Nu ai încă un curs salvat pentru această valută. Îl poți pune o dată, în Setări.")}><input value={rateInput} onChange={(event) => setRateInput(event.target.value)} inputMode="decimal" placeholder="ex. 4,97" /></Field>}{isForeign && initial && !initial.originalAmount && <Field label={t("Sumă originală ({currency})", { currency: entryCurrency })} hint={t("Mișcarea a fost salvată doar în lei. Completează suma din extras ca soldul valutar să nu mai fie aproximativ.")}><input value={originalAmountInput} onChange={(event) => setOriginalAmountInput(event.target.value)} inputMode="decimal" placeholder="ex. 20,00" /></Field>}<Field label={t("Data")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label={t("Cine a făcut mișcarea")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={t("Perspectivă")} hint={t("Personal rămâne la membru; comun intră în bilanțul familiei.")}><select value={shareScope} onChange={(event) => setShareScope(event.target.value as ShareScope)}><option value="shared">{t("Comun (familie)")}</option><option value="personal">{t("Personal")}</option></select></Field><Field label={kind === "income" ? t("Încasat în") : t("Plătit din (sursa reală)")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}{data.settings.members.length > 1 && source.memberId ? ` · ${sourceOwner(source)}` : ""} · {money(sourceBalance(data, source.id))}{source.currency ? ` (${source.currency})` : ""}</option>)}</select></Field>{kind === "expense" && !splitOpen && <Field label={t("Categorie")}><select value={category} onChange={(event) => setCategory(event.target.value)}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></Field>}</div>{isForeign && <section className={`bf-currency-preview ${baseAmount ? "" : "pending"}`}><p className="bf-kicker">{t("SE ÎNREGISTREAZĂ ÎN LEI")}</p>{baseAmount ? <><b>{fmtExact.format(baseAmount)}</b><span>{t("{original} × {rate} lei. Suma originală și cursul rămân salvate lângă mișcare.", { original: fmtExact.format(typedAmount).replace("RON", entryCurrency), rate: activeRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) })}</span></> : <span>{t("Completează suma și cursul ca să vezi echivalentul în lei.")}</span>}</section>}{canSplit && <section className="bf-receipt-split bf-tx-split"><div className="bf-split-heading"><div><p className="bf-kicker">{t("ÎMPARTE CHELTUIALA")}</p><h3>{splitOpen ? `${fmtExact.format(splitTotal)} / ${amount ? fmtExact.format(typedAmount) : "0,00 RON"}` : t("Pe categorii sau plicuri")}</h3></div><button type="button" className="bf-secondary" onClick={() => setSplitOpen((value) => !value)}>{splitOpen ? t("O singură categorie") : t("Împarte pe linii")}</button></div>{splitOpen && <>{lines.map((line) => <div className="bf-split-line" key={line.id}><select aria-label={t("Categorie")} value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select><input aria-label={t("Sumă")} value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" /><input aria-label={t("Detaliu")} value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder={t("ex. lapte")} />{lines.length > 1 && <button type="button" aria-label={t("Elimină linia")} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}</div>)}<button type="button" className="bf-secondary" onClick={() => setLines((current) => [...current, { id: newId("split-line"), category: "Alimente", amount: "", label: "" }])}><Plus size={16} /> {t("Adaugă linie")}</button><small>{t("Fiecare linie creează o mișcare separată, cu plicul potrivit categoriei.")}</small></>}</section>}{kind === "expense" && !splitOpen && <section className="bf-envelope-choice"><div><p className="bf-kicker">{t("BUGET REPARTIZAT")}</p><h3>{t("Plicul compatibil este ales automat.")}</h3><p>{t("Categoria, membrul și sursa reală găsesc plicul potrivit. Poți alege alt plic sau plată în afara plicurilor.")}</p></div><Field label={t("Plic de consum")}><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}>{(!hideUnallocated || allocationId === "outside") && <option value="outside">{t("În afara plicurilor — nu consumă buget repartizat")}</option>}{envelopeCandidates.map((allocation) => { const owner = data.settings.members.find((member) => member.id === allocation.memberId)?.name || t("Familie / comun"); const remaining = Math.max(0, allocationBudget(data, allocation) - allocationSpent(data, allocation)); const week = isWeeklyPaced(allocation, data.settings.salaryPlan) ? allocationWeekStatus(data, allocation, date) : undefined; return <option key={allocation.id} value={allocation.id}>{allocation.label}{data.settings.members.length > 1 ? ` · ${owner}` : ""} · {week ? `${money(Math.max(0, week.remaining))} în S${week.index}` : money(remaining)}</option>; })}</select></Field>{envelopeWeeks.length > 1 && <Field label={t("Din ce săptămână")}><select value={String(fromWeekIndex || matchedWeek?.index || "")} onChange={(event) => setFromWeekIndex(Number(event.target.value) || undefined)}>{envelopeWeeks.map((item) => <option key={item.index} value={item.index}>{t("S{index}: {remaining} rămași din {budget}{after}", { index: item.index, remaining: money(Math.max(0, item.remaining)), budget: money(item.budget), after: "" })}</option>)}</select></Field>}{!envelopeCandidates.length && <small className="bf-envelope-empty">{t("Nu există un plic pentru această combinație de categorie, membru și sursă. Poți înregistra cheltuiala în afara plicurilor sau crea unul în Plan.")}</small>}</section>}{!splitOpen && matchedEnvelope ? <section className={`bf-envelope-match ${envelopeAfter < 0 || (matchedWeek && weekAfter < 0) ? "over" : ""}`}><p>{matchedWeek ? t("SE VA LUA DIN PLICUL SĂPTĂMÂNII ACTIVE") : t("SE VA LUA DIN PLIC")}</p><b>{matchedEnvelope.label} · {allocationMember} · {data.settings.paymentSources.find((source) => source.id === matchedEnvelope.sourceId)?.name || t("sursa aleasă")}</b>{matchedWeek ? <span>S{matchedWeek.index}: {money(Math.max(0, weekRemaining))} {t("rămași")} din {money(matchedWeek.budget)}</span> : <span>{money(Math.max(0, envelopeRemaining))} {t("rămași")} din {money(allocationBudget(data, matchedEnvelope))}</span>}</section> : kind === "expense" && !splitOpen && <section className="bf-envelope-match outside"><p>{t("PLATĂ ÎN AFARA PLICURILOR")}</p><b>{t("Va scădea doar soldul sursei reale de plată.")}</b><span>{t("Nu consumă nicio limită repartizată pentru categorii.")}</span></section>}<Field label={t("Notiță opțională")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. cursă taxi, traseu, persoană, motiv")} /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> {t("Salvează mișcarea")}</button></Modal>;
}

export function GoalForm({ data, type, item, onSave, onClose }: { data: AppData; type: "debt" | "saving"; item?: Debt | SavingsGoal; onSave: (item: Debt | SavingsGoal) => void; onClose: () => void }) {
  const saving = type === "saving"; const old = item as SavingsGoal | undefined; const oldDebt = item as Debt | undefined;
  const [name, setName] = useState(item?.name || ""); const [one, setOne] = useState(item ? String(saving ? old?.current ?? 0 : oldDebt?.remaining ?? 0) : ""); const [two, setTwo] = useState(item ? String(saving ? old?.target ?? 0 : oldDebt?.monthly ?? 0) : ""); const [date, setDate] = useState(item?.dueDate || ""); const [memberId, setMemberId] = useState(item?.memberId || ""); const [error, setError] = useState("");
  /** `updatedAt` decide ce versiune câștigă la unirea a două telefoane; fără el modificarea mai nouă putea fi ignorată. */
  const save = () => { const first = parseRomanianAmount(one); const second = parseRomanianAmount(two); if (!name.trim() || first < 0 || second < 0 || (saving && second <= 0)) return setError(t("Completează numele și sumele corecte.")); const now = new Date().toISOString(); if (saving) onSave({ id: item?.id || newId("goal"), name: name.trim(), current: first, target: second, due: date ? dateText(date, true) : t("Fără termen"), dueDate: date || undefined, memberId: memberId || undefined, tone: old?.tone || "honey", updatedAt: now }); else onSave({ id: item?.id || newId("debt"), name: name.trim(), remaining: first, monthly: second, due: date ? dateText(date, true) : t("Nespecificat"), dueDate: date || undefined, memberId: memberId || undefined, tone: oldDebt?.tone || "coral", updatedAt: now }); onClose(); };
  return <Modal title={saving ? t("Obiectiv de economisire") : t("Datorie sau rată")} onClose={onClose}><div className="bf-form-grid"><Field label={saving ? t("Pentru ce economisiți?") : t("Denumire")}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={saving ? t("ex. Fond de siguranță") : t("ex. Credit bancar")} /></Field><Field label={t("Aparține de")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">{t("Familie / comun")}</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={saving ? t("Strâns până acum (lei)") : t("Sold rămas (lei)")}><input value={one} onChange={(event) => setOne(event.target.value)} inputMode="decimal" /></Field><Field label={saving ? t("Țintă (lei)") : t("Rată lunară (lei)")}><input value={two} onChange={(event) => setTwo(event.target.value)} inputMode="decimal" /></Field><Field label={saving ? t("Data țintă") : t("Scadență")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> {t("Salvează")}</button></Modal>;
}

export function DebtPaymentForm({ data, debt, onSave, onClose }: { data: AppData; debt: Debt; onSave: (data: AppData) => void; onClose: () => void }) {
  const defaultMemberId = debt.memberId || data.settings.members[0]?.id || ""; const [amount, setAmount] = useState(String(Math.min(debt.monthly || debt.remaining, debt.remaining))); const [date, setDate] = useState(isoToday()); const [memberId, setMemberId] = useState(defaultMemberId); const paymentSources = data.settings.paymentSources.filter((source) => !source.memberId || source.memberId === memberId); const [sourceId, setSourceId] = useState(data.settings.paymentSources.find((source) => source.memberId === defaultMemberId)?.id || data.settings.paymentSources.find((source) => !source.memberId)?.id || data.settings.paymentSources[0]?.id || ""); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const pay = () => { const value = parseRomanianAmount(amount); if (value <= 0) return setError(t("Introdu o sumă mai mare decât zero.")); if (value > debt.remaining) return setError(t("Poți plăti cel mult {amount} pentru această datorie.", { amount: money(debt.remaining) })); const next = recordDebtPayment(data, { debtId: debt.id, amount: value, sourceId, memberId, date, note }); if (!next) return setError(t("Alege un membru și o sursă de plată valide.")); if (!window.confirm(t("Confirmi plata de {amount} pentru „{name}”? Soldul datoriei va deveni {remaining}.", { amount: money(value), name: debt.name, remaining: money(debt.remaining - value) }))) return; onSave(next); onClose(); };
  const ownerName = (sourceId: string) => data.settings.members.find((member) => member.id === data.settings.paymentSources.find((source) => source.id === sourceId)?.memberId)?.name || t("Comun");
  return <Modal title={t("Plătește rata · {name}", { name: debt.name })} onClose={onClose}><section className="bf-debt-payment-intro"><p className="bf-kicker">{t("MIȘCARE REALĂ + DATORIE")}</p><p>{t("Plata este adăugată în Jurnal și scade aceeași sumă din soldul rămas. Nu pornește plăți bancare automate.")}</p><strong>{t("{amount} rămași", { amount: money(debt.remaining) })}</strong></section><div className="bf-form-grid"><Field label={t("Sumă plătită (lei)")}><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></Field><Field label={t("Data plății")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label={t("Membru")}><select value={memberId} onChange={(event) => { const nextMember = event.target.value; setMemberId(nextMember); const firstSource = data.settings.paymentSources.find((source) => !source.memberId || source.memberId === nextMember); if (firstSource) setSourceId(firstSource.id); }}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={t("Plătit din")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {ownerName(source.id)} · {money(sourceBalance(data, source.id))}</option>)}</select></Field></div><Field label={t("Notiță opțională")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. rata august, plată parțială")} /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={pay}><Check size={17} /> {t("Confirmă plata ratei")}</button></Modal>;
}
/** Atelierul Financiar 3.0 — obligațiile devin o axă de protejat: datorii, plăți confirmate, economii și scadențe. */
export function SpendingHabitsView({ data }: { data: AppData }) { const [period, setPeriod] = useState<30 | 90>(90); const [memberId, setMemberId] = useState("family"); const today = isoToday(); const start = addIsoDays(today, -(period - 1)); const recentStart = addIsoDays(today, -13); const expenses = data.transactions.filter((item) => item.kind === "expense" && item.date >= start && (memberId === "family" || item.memberId === memberId)); const categories = Object.entries(expenses.reduce<Record<string, { total: number; count: number; small: number; recent: number; prior: number }>>((all, item) => { const current = all[item.category] || { total: 0, count: 0, small: 0, recent: 0, prior: 0 }; const amount = Math.max(0, item.amount); const isSmall = amount <= 75; const isRecent = item.date >= recentStart; return { ...all, [item.category]: { total: current.total + amount, count: current.count + 1, small: current.small + (isSmall ? 1 : 0), recent: current.recent + (isRecent ? amount : 0), prior: current.prior + (!isRecent ? amount : 0) } }; }, {})).map(([name, stats]) => ({ name, ...stats, average: stats.total / stats.count, smallShare: stats.count ? stats.small / stats.count : 0, momentum: stats.prior > 0 ? (stats.recent - stats.prior / Math.max(1, period - 14) * 14) / (stats.prior / Math.max(1, period - 14) * 14) : stats.recent > 0 ? 1 : 0 })).sort((a, b) => b.total - a.total); const signals = categories.filter((item) => item.count >= 3 && item.smallShare >= .55).sort((a, b) => (b.smallShare * b.count) - (a.smallShare * a.count)).slice(0, 4); const recentTotal = expenses.filter((item) => item.date >= recentStart).reduce((sum, item) => sum + item.amount, 0); const previousTotal = expenses.filter((item) => item.date < recentStart).reduce((sum, item) => sum + item.amount, 0); const change = previousTotal > 0 ? Math.round((recentTotal - previousTotal) / previousTotal * 100) : 0; const members = data.settings.members; return <div className="bf-page bf-habits-workspace"><header className="bf-habits-header"><div><p className="bf-kicker">{t("OBICEIURI DE CHELTUIRE")}</p><h1>{t("Observă,")} <em>{t("nu te judeca.")}</em></h1><p>{t("Tiparele sunt informații. Alege o ajustare mică, nu o pedeapsă mare.")}</p></div><span><WalletCards size={26} /></span></header><section className="bf-habits-controls"><div className="bf-habits-period" role="group" aria-label={t("Perioada analizei")}><button className={period === 30 ? "active" : ""} onClick={() => setPeriod(30)}>{t("30 zile")}</button><button className={period === 90 ? "active" : ""} onClick={() => setPeriod(90)}>{t("90 zile")}</button></div>{members.length > 1 && <select value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label={t("Perspectiva analizei")}><option value="family">{t("Familie")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}</section><section className="bf-habits-pulse"><article><span>{t("Mișcări analizate")}</span><b>{expenses.length}</b><small>{t("în ultimele {period} de zile", { period })}</small></article><article><span>{t("Cheltuieli recente")}</span><b>{money(recentTotal)}</b><small>{change > 0 ? t("+{change}% față de ritmul anterior", { change }) : change < 0 ? t("{change}% față de ritmul anterior", { change }) : t("ritm apropiat de perioada anterioară")}</small></article><article><span>{t("Semnale blânde")}</span><b>{signals.length}</b><small>{t("tipare care merită observate")}</small></article></section><section className="bf-habits-guidance"><div><p className="bf-kicker">{t("O PERSPECTIVĂ MAI BLÂNDĂ")}</p><h2>{signals.length ? t("Nu orice cumpărătură mică este impulsivă.") : t("Ai nevoie de puțin istoric.")}</h2><p>{signals.length ? t("Am marcat doar tipare care combină frecvența cu multe sume mici. Verifică-le cu contextul tău înainte să schimbi ceva.") : t("După câteva mișcări, vei vedea frecvența, categoriile și ritmul fără să fie nevoie de presupuneri.")}</p></div><span><Check size={20} /></span></section><section className="bf-habits-signals"><div className="bf-section-heading"><div><p className="bf-kicker">{t("POSIBILE CUMPĂRĂTURI IMPULSIVE")}</p><h2>{t("Ce merită observat")}</h2></div><AlertTriangle size={19} /></div>{signals.length ? <div className="bf-habits-signal-list">{signals.map((item) => { const gentleCut = Math.round(item.total * .1); return <article key={item.name}><span className="bf-habits-signal-icon"><AlertTriangle size={16} /></span><div><b>{item.name}</b><small>{t("{count} mișcări · {percent}% sume mici · medie {average}", { count: item.count, percent: Math.round(item.smallShare * 100), average: money(item.average) })}</small><p>{t("Încearcă un plafon de")} <strong>{money(Math.max(0, item.total - gentleCut))}</strong> {t("pentru următoarea perioadă, doar dacă se potrivește realității tale.")}</p></div><strong>{money(item.total)}</strong></article>; })}</div> : <div className="bf-habits-empty"><Check size={22} /><p>{t("Nu am găsit tipare suficient de clare pentru a sugera o ajustare. Asta este un rezultat bun: nu forțăm o concluzie.")}</p></div>}</section><section className="bf-habits-adjustments"><div className="bf-section-heading"><div><p className="bf-kicker">{t("AJUSTĂRI BLÂNDE")}</p><h2>{t("Idei de încercat")}</h2></div><PiggyBank size={19} /></div><div className="bf-habits-adjustment-grid"><article><span>01</span><div><b>{t("Pauza de o zi")}</b><p>{t("Pentru cumpărăturile neplanificate, salvează ideea și revino mâine. Nu este interdicție; este spațiu pentru o alegere mai liniștită.")}</p></div></article><article><span>02</span><div><b>{t("Un plafon flexibil")}</b><p>{t("Alege o sumă mică pentru categoria care apare des și verifică săptămânal cum te simți cu ea.")}</p></div></article><article><span>03</span><div><b>{t("Mută, nu tăia")}</b><p>{t("Dacă o categorie este importantă, mută bani dintr-un plic mai puțin folosit în loc să elimini complet plăcerea.")}</p></div></article></div></section><p className="bf-habits-privacy">{t("Analiza se face local, din mișcările introduse de tine. Este un instrument orientativ, nu un diagnostic și nu modifică automat bugetul.")}</p></div>; }

export function SavingsScenarioSimulator({ data }: { data: AppData }) { const goals = data.savings; const [goalId, setGoalId] = useState(goals[0]?.id || ""); const selected = goals.find((item) => item.id === goalId) || goals[0]; const [inflation, setInflation] = useState(3); const [incomeChange, setIncomeChange] = useState(0); const [months, setMonths] = useState(24); const referenceIncome = Math.max(0, data.transactions.filter((item) => item.kind === "income" && item.date >= addIsoDays(isoToday(), -89)).reduce((sum, item) => sum + item.amount, 0) / 3); const current = selected?.current || 0; const target = selected?.target || 0; const baseRemaining = Math.max(0, target - current); const adjustedTarget = target * Math.pow(1 + Math.max(-99, inflation) / 100, months / 12); const scenarioIncome = referenceIncome * (1 + incomeChange / 100); const requiredMonthly = Math.max(0, adjustedTarget - current) / Math.max(1, months); const coverage = scenarioIncome > 0 ? Math.min(100, Math.round((requiredMonthly / scenarioIncome) * 100)) : 0; const status = requiredMonthly === 0 ? t("Obiectiv atins") : scenarioIncome <= 0 ? t("Adaugă un venit de referință") : coverage <= 15 ? t("Ritm confortabil") : coverage <= 30 ? t("Ritm de urmărit") : t("Ritm ambițios"); if (!goals.length) return null; return <section className="bf-scenario-card" aria-labelledby="scenario-title"><div className="bf-scenario-heading"><div><p className="bf-kicker">{t("SCENARIU DE ECONISIRE")}</p><h2 id="scenario-title">{t("Privește înainte,")} <em>{t("fără presiune.")}</em></h2><p>{t("Testează un posibil viitor fără să schimbi planul real.")}</p></div><span><Goal size={21} /></span></div><div className="bf-scenario-fields"><label><span>{t("Obiectiv")}</span><select value={selected?.id || ""} onChange={(event) => setGoalId(event.target.value)}>{goals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Inflație anuală")}</span><input type="number" min="-10" max="30" step="0.5" value={inflation} onChange={(event) => setInflation(Math.max(-10, Math.min(30, Number(event.target.value) || 0)))} /><small>{t("Scumpește ținta în timp")}</small></label><label><span>{t("Schimbare venit")}</span><input type="number" min="-90" max="200" step="1" value={incomeChange} onChange={(event) => setIncomeChange(Math.max(-90, Math.min(200, Number(event.target.value) || 0)))} /><small>{t("Față de media locală")}</small></label><label><span>{t("Orizont")}</span><input type="number" min="1" max="240" step="1" value={months} onChange={(event) => setMonths(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} /><small>{t("luni până la țintă")}</small></label></div><div className="bf-scenario-result"><div><p className="bf-kicker">{t("PROIECȚIA SCENARIULUI")}</p><strong>{money(requiredMonthly)}</strong><span>{t("contribuție lunară estimată")}</span></div><div className="bf-scenario-metrics"><span><b>{money(adjustedTarget)}</b><small>{t("țintă ajustată")}</small></span><span><b>{money(scenarioIncome)}</b><small>{t("venit scenariu")}</small></span><span><b>{coverage}%</b><small>{t("din venit")}</small></span></div></div><div className={`bf-scenario-status ${coverage > 30 ? "watch" : coverage > 15 ? "attention" : "calm"}`}><span><Check size={15} /></span><div><b>{status}</b><small>{baseRemaining > 0 ? `Pentru „${selected?.name}”, inflația de ${inflation}% ar ridica ținta cu ${money(Math.max(0, adjustedTarget - target))} în acest orizont.` : t("Nu mai există sumă de construit pentru acest obiectiv.")}</small></div></div><p className="bf-scenario-note">{t("Calcul orientativ, fără randament sau dobândă. Simularea este temporară și nu modifică obiectivul, veniturile sau tranzacțiile reale.")}</p></section>; }

export function LongTermGoalsView({ data, onOpen, onEdit, onDelete }: { data: AppData; onOpen: () => void; onEdit: (item: SavingsGoal) => void; onDelete: (id: string) => void }) { const goals = data.savings; const totalTarget = goals.reduce((sum, item) => sum + Math.max(0, item.target), 0); const totalCurrent = goals.reduce((sum, item) => sum + Math.min(Math.max(0, item.current), Math.max(0, item.target)), 0); const totalRemaining = Math.max(0, totalTarget - totalCurrent); const activeGoals = goals.filter((item) => item.target > item.current); const datedGoals = activeGoals.filter((item) => item.dueDate); const suggestedMonthly = datedGoals.reduce((sum, item) => { const months = Math.max(1, Math.ceil((new Date(`${item.dueDate}T12:00:00`).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))); return sum + Math.max(0, item.target - item.current) / months; }, 0); return <div className="bf-page bf-goals-workspace"><header className="bf-goals-header"><div><p className="bf-kicker">{t("OBIECTIVE PE TERMEN LUNG")}</p><h1>{t("Construiește")} <em>{t("cu liniște.")}</em></h1><p>{t("Un obiectiv bun îți arată direcția, nu îți cere să te grăbești.")}</p></div><span><PiggyBank size={26} /></span></header><section className="bf-goals-overview"><div><p className="bf-kicker">{t("PROGRESUL CASEI")}</p><strong>{totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%</strong><span>{t("{current} strânși din {target}", { current: money(totalCurrent), target: money(totalTarget) })}</span></div><div className="bf-goals-overview-stats"><span><b>{money(totalRemaining)}</b><small>{t("de construit")}</small></span><span><b>{money(suggestedMonthly)}</b><small>{t("recomandat / lună")}</small></span></div></section><section className="bf-goals-guidance"><span><Check size={17} /></span><div><b>{activeGoals.length ? t("Un ritm mic ține direcția vie.") : t("Alege un obiectiv care contează.")}</b><small>{activeGoals.length ? t("Nu trebuie să alimentezi toate obiectivele în fiecare lună. Prioritizează ce este cel mai aproape de tine.") : t("Fond de siguranță, o vacanță, o casă sau un plan personal — începe cu ce îți aduce claritate.")}</small></div></section><SavingsScenarioSimulator data={data} /><section className="bf-goals-list"><div className="bf-section-heading"><div><p className="bf-kicker">{t("OBIECTIVELE TALE")}</p><h2>{t("Pas cu pas")}</h2></div><button className="bf-primary" onClick={onOpen}><Plus size={16} /> {t("Obiectiv nou")}</button></div>{goals.length ? <div className="bf-goals-grid">{goals.map((goal) => { const progress = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0; const remaining = Math.max(0, goal.target - goal.current); const months = goal.dueDate ? Math.max(1, Math.ceil((new Date(`${goal.dueDate}T12:00:00`).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))) : undefined; const monthly = months ? remaining / months : undefined; return <article className={`bf-goal-card ${goal.tone}`} key={goal.id}><div className="bf-goal-card-top"><span className="bf-goal-mark"><PiggyBank size={17} /></span><span><b>{goal.name}</b><small>{goal.dueDate ? t("Până la {date}", { date: formatDate(goal.dueDate, { day: "2-digit", month: "short" }) }) : goal.due || t("Fără termen ales")}</small></span><strong>{progress}%</strong></div><div className="bf-goal-progress"><i style={{ width: `${progress}%` }} /></div><div className="bf-goal-card-values"><span><b>{money(goal.current)}</b><small>{t("strânși")}</small></span><span><b>{money(remaining)}</b><small>{t("rămași")}</small></span>{monthly !== undefined && <span><b>{money(monthly)}</b><small>{t("ritm lunar")}</small></span>}</div><div className="bf-goal-card-actions"><button onClick={() => onEdit(goal)}><Pencil size={14} /> {t("Editează")}</button><button className="delete" aria-label={`Șterge obiectivul ${goal.name}`} onClick={() => onDelete(goal.id)}><Trash2 size={15} /></button></div></article>; })}</div> : <div className="bf-goals-empty"><PiggyBank size={28} /><h2>{t("Nu ai încă un obiectiv pe termen lung.")}</h2><p>{t("Începe cu o țintă simplă și lasă aplicația să-ți arate un ritm posibil.")}</p><button className="bf-primary" onClick={onOpen}><Plus size={16} /> {t("Creează primul obiectiv")}</button></div>}</section></div>; }

export { DebtPaymentHistory, ObjectivesView } from "./ObjectivesView";




const RECEIPT_DRAFT_KEY = "buget-familie:receipt-draft";
type ReceiptFormDraft = {
  vendor: string;
  amount: string;
  date: string;
  sourceId: string;
  memberId: string;
  note: string;
  images: string[];
  lines: Array<{ id: string; category: string; amount: string; label: string }>;
  ocrText: string;
  ocrSummary: string;
};
function readReceiptDraft(): ReceiptFormDraft | undefined {
  try {
    const raw = sessionStorage.getItem(RECEIPT_DRAFT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ReceiptFormDraft;
    if (!parsed || typeof parsed.vendor !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
function writeReceiptDraft(draft: ReceiptFormDraft) {
  try {
    sessionStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    try { sessionStorage.setItem(RECEIPT_DRAFT_KEY, JSON.stringify({ ...draft, images: [] })); } catch { /* quota */ }
  }
}
function clearReceiptDraft() {
  try { sessionStorage.removeItem(RECEIPT_DRAFT_KEY); } catch { /* ignore */ }
}

export function ReceiptForm({ data, onSave, onClose }: { data: AppData; onSave: (item: Receipt) => void | Promise<void>; onClose: () => void }) {
  const [draft] = useState(() => readReceiptDraft());
  const [vendor, setVendor] = useState(draft?.vendor ?? "");
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [date, setDate] = useState(draft?.date || isoToday());
  const [sourceId, setSourceId] = useState(draft?.sourceId || data.settings.paymentSources[0]?.id || "");
  const [memberId, setMemberId] = useState(draft?.memberId || data.settings.members[0]?.id || "");
  const [note, setNote] = useState(draft?.note ?? "");
  const [images, setImages] = useState<string[]>(draft?.images ?? []);
  const [lines, setLines] = useState<Array<{ id: string; category: string; amount: string; label: string }>>(draft?.lines?.length ? draft.lines : [{ id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }]);
  const [ocrText, setOcrText] = useState(draft?.ocrText ?? "");
  const [ocrSummary, setOcrSummary] = useState(draft?.ocrSummary ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const lastSyncedTotal = useRef(draft?.amount ?? "");
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const numericTotal = parseRomanianAmount(amount);
  const resolvedPreview = resolveReceiptLines(lines, numericTotal);
  const lineTotal = resolvedPreview.reduce((sum, line) => sum + line.amount, 0);
  const photosFull = images.length >= 2;

  useEffect(() => {
    setLines((current) => {
      if (current.length !== 1) return current;
      const lineAmount = current[0].amount.trim();
      if (lineAmount && lineAmount !== lastSyncedTotal.current) return current;
      lastSyncedTotal.current = amount;
      if (current[0].amount === amount) return current;
      return [{ ...current[0], amount }];
    });
  }, [amount]);

  useEffect(() => {
    const persist = () => writeReceiptDraft({ vendor, amount, date, sourceId, memberId, note, images, lines, ocrText, ocrSummary });
    persist();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [vendor, amount, date, sourceId, memberId, note, images, lines, ocrText, ocrSummary]);

  const pick = async (files?: FileList | null) => {
    const selected = files ? Array.from(files) : [];
    if (!selected.length) return;
    const room = 2 - images.length;
    if (room <= 0) return setError(t("Un bon poate avea maximum două fotografii. Elimină una înainte de a adăuga alta."));
    const take = selected.slice(0, room);
    try {
      setBusy(true);
      setError("");
      const { compressReceiptImage } = await import("@/lib/receipt-utils");
      const compressed: string[] = [];
      for (const file of take) {
        compressed.push(await Promise.race([
          compressReceiptImage(file),
          new Promise<string>((_, reject) => window.setTimeout(() => reject(new Error(t("Poza a durat prea mult. Încearcă din galerie sau salvează bonul fără fotografie."))), 20000)),
        ]));
      }
      const next = [...images, ...compressed].slice(0, 2);
      setImages(next);
      await scanImages(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Poza bonului nu a putut fi procesată. Poți salva cumpărăturile fără fotografie."));
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => { await scanImages(images); };
  const scanImages = async (photos: string[]) => {
    if (!photos.length) return;
    try {
      setBusy(true);
      setError("");
      setOcrSummary("");
      setProgress(0);
      const { readReceiptLocally, ocrTextLooksUseful, receiptReadIsReconciled } = await import("@/lib/receipt-utils");
      const result = await readReceiptLocally(photos, setProgress);
      setOcrText(result.text);
      if (result.vendor && !vendor.trim()) setVendor(result.vendor);
      if (result.amount) setAmount(String(result.amount).replace(".", ","));
      if (result.date) setDate(result.date);
      if (result.text && !note.trim() && ocrTextLooksUseful(result.text)) setNote(result.text.slice(0, 1400));
      if (result.items.length) {
        const suggestedLines = result.items.map((item) => {
          const ruled = guessCategoryFromText(item.label || item.raw || "", categories, data.settings.merchantRules || []);
          const category = ruled && categories.includes(ruled) ? ruled : categories.includes(item.category) ? item.category : "Alimente";
          return { id: newId("receipt-line"), category, amount: String(item.amount).replace(".", ","), label: item.label };
        });
        setLines(suggestedLines);
        const detectedTotal = result.items.reduce((sum, item) => sum + item.amount, 0);
        const who = result.vendor ? `${result.vendor}, ` : "";
        if (result.amount && !receiptReadIsReconciled(result)) {
          setOcrSummary(t("Am citit totalul {total} la {who}dar produsele însumează {sum}. Verifică liniile înainte de salvare.", { total: fmtExact.format(result.amount), who, sum: fmtExact.format(detectedTotal) }));
        } else {
          setOcrSummary(t("Am citit {who}{count} produs(e) după reduceri ({total}). Verifică categoriile înainte de salvare.", { who, count: result.items.length, total: fmtExact.format(detectedTotal) }));
        }
      } else if (result.amount) {
        setOcrSummary(t("Am citit totalul {total}{vendor}, dar produsele nu sunt sigure. Completează magazinul dacă lipsește — fotografia rămâne atașată.", { total: fmtExact.format(result.amount), vendor: result.vendor ? ` la ${result.vendor}` : "" }));
      } else {
        setOcrSummary(t("Nu am citit clar textul de pe bon. Scrie magazinul și totalul; fotografia rămâne atașată și poți salva fără produse separate."));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Textul de pe bon nu a putut fi citit."));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };
  const updateLine = (id: string, patch: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const save = async () => {
    const numeric = parseRomanianAmount(amount);
    const normalizedLines = resolveReceiptLines(lines, numeric);
    const splitTotal = normalizedLines.reduce((sum, line) => sum + line.amount, 0);
    if (!vendor.trim() || numeric <= 0 || !sourceId || !memberId) return setError(t("Completează magazinul, totalul, membrul și sursa. Fotografiile nu sunt obligatorii."));
    if (!normalizedLines.length || Math.abs(numeric - splitTotal) > 0.01) return setError(t("Repartizarea este {split}, dar totalul bonului este {total}. Corectează liniile înainte de salvare.", { split: fmtExact.format(splitTotal), total: fmtExact.format(numeric) }));
    try {
      setBusy(true);
      setError("");
      const id = newId("receipt");
      const imageKeys = images.length ? await storeReceiptImages(id, images) : [];
      await onSave({ id, vendor: vendor.trim(), amount: numeric, date, category: normalizedLines[0].category, lines: normalizedLines, sourceId, memberId, note: note.trim() || undefined, imageKeys: imageKeys.length ? imageKeys : undefined, ocrText: ocrText || undefined });
      clearReceiptDraft();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Bonul nu a putut fi salvat pe telefon."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t("Adaugă bon")} onClose={onClose}>
      <div className="bf-receipt-body">
        <div className="bf-receipt-intro">
          <p className="bf-kicker">{t("CUMPĂRĂTURI")}</p>
          <p>{t("Scrie magazinul și totalul, apoi apasă Salvează. Pozele sunt opționale: din galerie sau cu aparatul foto.")}</p>
        </div>
        <div className="bf-form-grid">
          <Field label={t("Magazin")}><input autoFocus value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="ex. Lidl" /></Field>
          <Field label={t("Total (lei)")}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          <Field label={t("Data")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label={t("Membru")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
          <Field label={t("Plătit din")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
        </div>
        <section className="bf-receipt-split">
          <div className="bf-split-heading">
            <div>
              <p className="bf-kicker">{t("PRODUSE ȘI CATEGORII")}</p>
              <h3>{fmtExact.format(lineTotal)} din {amount ? fmtExact.format(numericTotal) : "0,00 RON"}</h3>
            </div>
            <button type="button" className="bf-secondary" onClick={() => setLines((current) => [...current, { id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }])}><Plus size={16} /> {t("Produs")}</button>
          </div>
          {lines.map((line) => (
            <div className="bf-split-line" key={line.id}>
              <select aria-label={t("Categorie bon")} value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select>
              <input aria-label={t("Preț produs")} value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" />
              <input aria-label={t("Produs")} value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder="ex. fructe" />
              {lines.length > 1 && <button type="button" aria-label={t("Elimină produsul")} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}
            </div>
          ))}
          <small>{t("Dacă lași un singur produs gol, totalul se pune automat pe el. Mai multe linii trebuie să însumeze exact totalul bonului.")}</small>
          {resolvedPreview.length > 0 && (
            <div className="bf-receipt-envelope-preview" aria-label={t("Plicuri propuse")}>
              <p className="bf-kicker">{t("PLICURI PROPUSE")}</p>
              <ul>
                {resolvedPreview.map((line) => {
                  const matched = matchingAllocationsForExpense(data, { category: line.category, memberId, sourceId })[0];
                  return (
                    <li key={line.id}>
                      <b>{line.label || t(line.category)}</b>
                      <span>{t(line.category)} → {matched ? matched.label : t("în afara plicurilor")}</span>
                    </li>
                  );
                })}
              </ul>
              <small>{t("La salvare, liniile intră la De verificat. Confirmă înainte să atingă registrul.")}</small>
            </div>
          )}
        </section>
        <section className="bf-receipt-images">
          <div>
            <p className="bf-kicker">{t("FOTOGRAFII OPȚIONALE")}</p>
            <strong>{images.length}/2 imagini</strong>
          </div>
          <p className="bf-receipt-photo-hint">{t("Pozele rămân pe telefon. După ce adaugi o fotografie, citesc magazinul, produsele și totalul. Poți corecta înainte să salvezi.")}</p>
          <div className="bf-receipt-photo-actions">
            <label className="bf-upload-control gallery">
              <Images size={18} /> {busy && !progress ? t("Comprimăm…") : t("Din galerie")}
              <input type="file" accept="image/*" multiple disabled={busy || photosFull} onChange={(event) => { void pick(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            <label className="bf-upload-control camera">
              <Camera size={18} /> {t("Fotografiază")}
              <input type="file" accept="image/*" capture="environment" disabled={busy || photosFull} onChange={(event) => { void pick(event.target.files); event.currentTarget.value = ""; }} />
            </label>
          </div>
          {images.length > 0 && <button type="button" className="bf-ocr-button" disabled={busy} onClick={() => void scan()}><Bot size={17} /> {busy && progress ? `Citim ${progress}%` : t("Citește produsele și prețurile local")}</button>}
          <div className="bf-receipt-preview-grid">{images.map((image, index) => <figure key={`${index}-${image.slice(-24)}`}><img src={image} alt={`Previzualizare bon partea ${index + 1}`} width={280} height={140} loading="lazy" decoding="async" /><button type="button" aria-label={`Elimină fotografia ${index + 1}`} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}><X size={15} /></button></figure>)}</div>
          {ocrSummary && <p className="bf-ocr-info" role="status"><Bot size={16} /> {ocrSummary}</p>}
        </section>
        {ocrText ? <Field label={t("Text citit local (verifică înainte de salvare)")}><textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field> : <Field label={t("Produse / notiță")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. apă, fructe, detergent")} /></Field>}
      </div>
      <div className="bf-receipt-save">
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <button type="button" className="bf-primary full" disabled={busy} onClick={() => void save()}><Check size={17} /> {t("Salvează bonul")}</button>
      </div>
    </Modal>
  );
}

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


/** Prezentare pură: starea de conectare live trăiește în Home, ca să reziste la schimbarea de tab. */
/**
 * Cât de greu e de ghicit parola de familie, spus pe loc.
 * Din ea se derivă identificatorul camerei de sincronizare, deci o parolă slabă
 * nu înseamnă doar „cineva citește”, ci „cineva poate suprascrie”.
 */
function PasswordMeter({ value }: { value: string }) {
  const verdict = checkFamilyPassword(value);
  return (
    <div className={`bf-password-meter s${verdict.score}`} role="status" aria-live="polite">
      <div className="bf-password-bars" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <i key={index} className={index < verdict.score ? "on" : ""} />)}
      </div>
      <b>{verdict.label}</b>
      {verdict.advice.length > 0 && <small>{verdict.advice[0]}</small>}
    </div>
  );
}

export function SyncPanel({ connected, busy, online, password, setPassword, notice, lastSync, journal, devices, thisDeviceId, onConnect, onDisconnect, onClearJournal, onRevokeDevice, onRestoreDevice, passwordRevealOnce, clearPasswordReveal, recoveryRevealOnce, clearRecoveryReveal, recoveryIssued, onRecoverPassword, onIssueRecovery }: SyncPanelProps) {
  const [showGenerated, setShowGenerated] = useState(Boolean(passwordRevealOnce));
  const [generatedOnce, setGeneratedOnce] = useState(passwordRevealOnce || "");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryShown, setRecoveryShown] = useState(recoveryRevealOnce || "");
  const [showSessionPassword, setShowSessionPassword] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState("");
  useEffect(() => {
    if (!passwordRevealOnce) return;
    setPassword(passwordRevealOnce);
    setGeneratedOnce(passwordRevealOnce);
    setShowGenerated(true);
    clearPasswordReveal?.();
  }, [passwordRevealOnce, setPassword, clearPasswordReveal]);
  useEffect(() => {
    if (!recoveryRevealOnce) return;
    setRecoveryShown(recoveryRevealOnce);
    clearRecoveryReveal?.();
  }, [recoveryRevealOnce, clearRecoveryReveal]);
  const latest = journal[0];
  const pendingMerge = connected && latest?.status === "detected";
  const failedMerge = connected && latest?.status === "failed";
  const stateLabel = busy
    ? t("Se conectează…")
    : !online
      ? (connected ? t("Offline — sesiune activă, fără rețea") : t("Fără conexiune"))
    : !connected
      ? t("Nu este conectat")
      : pendingMerge
        ? t("Conectat — unire în așteptare")
        : failedMerge
          ? t("Conectat — ultima unire a eșuat")
          : lastSync
            ? t("Conectat — sincronizat")
            : t("Conectat — așteptăm prima confirmare");
  const stateClass = busy ? "busy" : !online ? "offline" : !connected ? "idle" : pendingMerge || failedMerge ? "busy" : "connected";
  const stateDetail = !online
    ? t("Rețeaua lipsește. Registrul local rămâne intact; sync-ul se reia automat la reconectare.")
    : lastSync
    ? t("Ultima confirmare: {time}", { time: new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastSync)) })
    : connected
      ? t("Așteptăm prima confirmare de la spațiul familiei.")
      : t("Conectează acest telefon pentru a vedea actualizările celorlalte dispozitive.");

  const generateOnce = () => {
    const next = generateFamilyPassword();
    setPassword(next);
    setGeneratedOnce(next);
    setShowGenerated(true);
  };

  const copySecret = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecret(value);
      window.setTimeout(() => setCopiedSecret((current) => current === value ? "" : current), 2500);
      return;
    } catch { /* fallback below */ }
    try {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      if (!ok) throw new Error("copy");
      setCopiedSecret(value);
      window.setTimeout(() => setCopiedSecret((current) => current === value ? "" : current), 2500);
    } catch {
      window.alert(t("Nu am putut copia. Selectează codul și copiază-l tu."));
    }
  };

  return <div className="bf-sync">
    {!canUseFamilySync() ? <FamilieUpgrade reason="sync" /> : null}
    <div className="bf-sync-hero"><Users size={25} /><p className="bf-kicker">{t("FAMILIE CONECTATĂ")}</p><h2>{connected ? t("Sesiunea familiei este activă.") : t("Sincronizare criptată, în timp real, între telefoane.")}</h2><p>{t("Serverul de sincronizare vede doar un pachet AES-GCM. Pozele bonurilor și parola rămân pe telefon.")}</p></div>
    <aside className="bf-sync-local-only" role="note">
      <p className="bf-kicker">{t("CE SE SINCRONIZEAZĂ")}</p>
      <ul>
        <li>{t("Mișcări, plicuri, scadențe, datorii, economii")}</li>
        <li>{t("Membri, surse și planul până la salariu")}</li>
        <li>{t("Rezumatul cozii De verificat (titlu, sumă, dată — fără poze)")}</li>
      </ul>
      <p className="bf-kicker">{t("CE NU SE SINCRONIZEAZĂ")}</p>
      <p>{t("Rămân doar pe acest telefon — partenerul nu le vede automat:")}</p>
      <ul>
        <li>{t("Fotografiile bonurilor")}</li>
        <li>{t("Confirmarea din De verificat (doar pe telefonul care a creat propunerea)")}</li>
        <li>{t("Regulile de comerciant")}</li>
        <li>{t("Șabloanele rapide")}</li>
        <li>{t("Cache-ul de curs valutar (FX)")}</li>
      </ul>
      <p>{t("Pe sume de plic și pe aceeași mișcare editată pe două telefoane: alegi tu local/remote — nu unificăm tăcut banii. Pentru alte câmpuri (notițe, etichete), ultima scriere câștigă.")}</p>
    </aside>
    <div className={`bf-sync-state ${stateClass}`} role="status"><span aria-hidden="true">{connected && !busy && !pendingMerge && !failedMerge ? <Check size={15} /> : busy || pendingMerge ? <RotateCcw size={15} /> : <Cloud size={15} />}</span><div><b>{stateLabel}</b><small>{stateDetail}</small></div></div>

    <section className="bf-sync-session">
      <p className="bf-kicker">{connected ? t("CONECTAT") : t("CONECTEAZĂ FAMILIA")}</p>
      {connected ? <>
        <p><b>{t("Actualizare live, fără reîmprospătare manuală")}</b><br />{t("Cât aplicația rămâne deschisă pe orice telefon din familie, mișcările apar automat pe toate celelalte în câteva secunde.")}</p>
        {recoveryShown && (
          <div className="bf-notice bf-sync-secret" role="status">
            <p><KeyRound size={14} /> {t("Notează acest cod o dată, pe hârtie, nu în telefon. Cu el poți scoate parola dacă o uiți.")}</p>
            <code className="bf-sync-password-once">{recoveryShown}</code>
            <button type="button" className="bf-secondary" onClick={() => void copySecret(recoveryShown)}>
              <Copy size={16} /> {copiedSecret === recoveryShown ? t("Copiat în clipboard") : t("Copiază codul")}
            </button>
          </div>
        )}
        <div className="bf-sync-recovery-actions">
          <button type="button" className="bf-link-button" onClick={() => setShowSessionPassword((value) => !value)}>
            {showSessionPassword ? t("Ascunde parola acestei sesiuni") : t("Arată parola acestei sesiuni")}
          </button>
          <button type="button" className="bf-link-button" onClick={onIssueRecovery} disabled={busy}>
            {recoveryIssued ? t("Cod nou de recuperare") : t("Creează cod de recuperare")}
          </button>
        </div>
        {showSessionPassword && password && (
          <div className="bf-notice bf-sync-secret" role="status">
            <p>{t("Parola acestei sesiuni (doar cât ești conectat):")}</p>
            <code className="bf-sync-password-once">{password}</code>
            <button type="button" className="bf-secondary" onClick={() => void copySecret(password)}>
              <Copy size={16} /> {copiedSecret === password ? t("Copiat în clipboard") : t("Copiază parola")}
            </button>
          </div>
        )}
        {recoveryIssued && !recoveryShown && (
          <p className="bf-helper">{t("Un cod de recuperare există deja. E cel notat la prima conectare. Poți emite altul — cel vechi rămâne valabil până schimbați parola.")}</p>
        )}
        <button className="bf-link-button" onClick={onDisconnect}>{t("Închide sesiunea acestui telefon")}</button>
      </> : <>
        <div className="bf-sync-backup-reminder" role="note">
          <ShieldAlert size={16} aria-hidden="true" />
          <p>{t("Înainte de reinstalare sau de schimbarea telefonului: exportă un backup din Setări. Parola de familie nu se salvează pe aparat.")}</p>
        </div>
        <Field label={t("Parola familiei")} hint={t("Orice parolă inventată de voi. O propoziție scurtă e mai bună decât un cuvânt cu simboluri: „pisicaVerdeSareGardul7”. Trebuie să fie identică, literă cu literă, pe toate telefoanele.")}>
          <input type={showGenerated ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setShowGenerated(false); }} placeholder={t("minimum 12 caractere")} autoComplete="new-password" />
          {password.length > 0 && <PasswordMeter value={password} />}
        </Field>
        <div className="bf-sync-generate">
          <button type="button" className="bf-secondary" onClick={generateOnce}><KeyRound size={16} /> {t("Generează o parolă")}</button>
          {showGenerated && generatedOnce && (
            <div className="bf-notice bf-sync-secret" role="status">
              <p><KeyRound size={14} /> {t("Arată-o o singură dată partenerului, apoi noteaz-o în afara telefonului:")}</p>
              <code className="bf-sync-password-once">{generatedOnce}</code>
              <button type="button" className="bf-secondary" onClick={() => void copySecret(generatedOnce)}>
                <Copy size={16} /> {copiedSecret === generatedOnce ? t("Copiat în clipboard") : t("Copiază parola")}
              </button>
            </div>
          )}
        </div>
        <p className="bf-helper">{t("Dacă ai registrul pe acest telefon, poți pune o parolă nouă — camera veche rămâne. Recuperarea e pentru când telefonul e gol și ai notat codul.")}</p>
        <p className="bf-helper">{t("Nu ai nevoie de niciun cont sau token. Parola nu se salvează pe telefon și nu este trimisă niciodată necriptată.")}</p>
        <button className="bf-primary full" disabled={busy || !online} onClick={onConnect}><Users size={17} /> {t("Conectează acest telefon")}</button>
        <button type="button" className="bf-link-button" onClick={() => setForgotOpen((value) => !value)}>{t("Am uitat parola")}</button>
        {forgotOpen && (
          <div className="bf-sync-forgot">
            <p className="bf-kicker">{t("AM UITAT PAROLA")}</p>
            <Field label={t("Cod de recuperare")} hint={t("Introdu codul notat la prima conectare. Nu e parola familiei.")}>
              <input value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} />
            </Field>
            <button type="button" className="bf-secondary" disabled={busy || !online || recoveryInput.replace(/[^A-Z0-9]/gi, "").length < 16} onClick={() => onRecoverPassword(recoveryInput)}>
              {t("Recuperează parola")}
            </button>
          </div>
        )}
      </>}
    </section>

    {(connected || devices.length > 0) && (
      <section className="bf-sync-devices" aria-labelledby="sync-devices-title">
        <div className="bf-sync-journal-heading">
          <div>
            <p className="bf-kicker">{t("DISPOZITIVE")}</p>
            <h3 id="sync-devices-title">{t("Telefoane în cameră")}</h3>
          </div>
        </div>
        <p className="bf-helper">{t("Revocarea scoate sesiunea de pe acel telefon. Dacă telefonul e pierdut și cineva știe parola, schimbați parola familiei — e singura încuietoare reală.")}</p>
        {devices.length ? (
          <ul className="bf-sync-device-list">
            {devices.map((device) => (
              <li key={device.id} className={device.revokedAt ? "is-revoked" : undefined}>
                <Smartphone size={16} aria-hidden="true" />
                <div>
                  <b>{device.label}{device.id === thisDeviceId ? ` · ${t("acest telefon")}` : ""}{device.revokedAt ? ` · ${t("revocat")}` : ""}</b>
                  <small>{t("Ultima dată văzut")}: {new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastSeenAt))}</small>
                </div>
                {device.revokedAt ? (
                  <button type="button" className="bf-link-button" onClick={() => onRestoreDevice(device.id)}>
                    {t("Reactivează")}
                  </button>
                ) : (
                  <button type="button" className="bf-link-button" onClick={() => onRevokeDevice(device.id)}>
                    {device.id === thisDeviceId ? t("Revocă acest telefon") : t("Revocă")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="bf-helper">{t("După conectare, telefoanele apar aici cu ultima dată văzută.")}</p>
        )}
      </section>
    )}

    {lastSync && <p className="bf-helper">Ultima actualizare: {new Intl.DateTimeFormat(getLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastSync))}</p>}
    {notice && <p className="bf-notice" role="status"><Check size={15} /> {notice}</p>}
    <section className="bf-sync-journal" aria-labelledby="sync-journal-title">
      <div className="bf-sync-journal-heading">
        <div>
          <p className="bf-kicker">{t("ISTORIC DE ACTUALIZĂRI")}</p>
          <h3 id="sync-journal-title">{t("Ce s-a întâmplat la sincronizare")}</h3>
        </div>
        {journal.length > 0 && <button className="bf-link-button" onClick={onClearJournal}>{t("Curăță istoricul")}</button>}
      </div>
      {journal.length ? (
        <div className="bf-sync-journal-list">
          {journal.map((entry) => (
            <article key={entry.id} className={`bf-sync-journal-entry ${entry.status}`}>
              <div className="bf-sync-journal-icon" aria-hidden="true">{entry.status === "resolved" ? <Check size={15} /> : entry.status === "failed" ? <X size={15} /> : <RotateCcw size={15} />}</div>
              <div>
                <strong>{entry.status === "resolved" ? t("Actualizare reunită") : entry.status === "failed" ? t("Actualizare eșuată") : t("Actualizare detectată")}</strong>
                <p>{entry.message}</p>
                <small>{new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))} · {entry.action}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="bf-helper">{t("Nu există actualizări înregistrate pe acest dispozitiv. Când un alt telefon trimite mișcări noi, aici vei vedea ce a fost reunit automat.")}</p>
      )}
    </section>
  </div>;
}


export function FamilyGuide({ onGo, onOpenReview, onOpenSync }: { onGo?: (view: MainView) => void; onOpenReview?: () => void; onOpenSync?: () => void }) {
  return <UsageTutorial onGo={onGo} onOpenReview={onOpenReview} onOpenSync={onOpenSync} />;
}

/** Atelierul Financiar 3.0 — Analiza este o destinație de lucru, cu rapoarte și asistent separat încărcate la cerere. */
export function InsightsView({ data, onChange, onGo }: { data: AppData; onChange: (next: AppData) => void; onGo?: (view: MainView) => void }) {
  const [panel, setPanel] = useState<"reports" | "household" | "assistant">("reports");
  return <div className="bf-page bf-insights-workspace"><header className="bf-insights-header"><div><p className="bf-kicker">{t("ANALIZĂ FINANCIARĂ")}</p><h1>{t("Înțelege")} <em>{t("schimbarea.")}</em></h1><p>{t("Compară lunile, închide ritualul gospodăriei și cere o explicație locală.")}</p></div><span><LayoutDashboard size={25} /></span></header><div className="bf-insights-switch bf-segment" role="tablist" aria-label={t("Tip analiză")}><button role="tab" aria-selected={panel === "reports"} className={panel === "reports" ? "active" : ""} onClick={() => setPanel("reports")}><LayoutDashboard size={16} /> {t("Istoric")}</button><button role="tab" aria-selected={panel === "household"} className={panel === "household" ? "active" : ""} onClick={() => setPanel("household")}><Users size={16} /> {t("Gospodărie")}</button><button role="tab" aria-selected={panel === "assistant"} className={panel === "assistant" ? "active" : ""} onClick={() => setPanel("assistant")}><Bot size={16} /> {t("Asistent")}</button></div>{panel === "reports" ? <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim analiza…")}</div>}><ReportsPanel data={data} onGo={onGo} /></Suspense> : panel === "household" ? <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim gospodăria…")}</div>}><HouseholdStudio data={data} onChange={onChange} /></Suspense> : <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim asistentul…")}</div>}><AdvisorPanel data={data} onChange={onChange} /></Suspense>}</div>;
}
