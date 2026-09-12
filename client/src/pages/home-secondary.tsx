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
import "../atelier-review-final.css";
import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BellRing, ClipboardPaste, BookOpen, Bot, CalendarClock, CalendarDays, Camera, Check, Images, Inbox, ChevronLeft, ChevronRight, Cloud, Download, Goal, LayoutDashboard, LockKeyhole, Search, Upload, MoreHorizontal, Palette, Pencil, PiggyBank, Plus, ReceiptText, RotateCcw, Settings, ShieldCheck, ShoppingBasket, SlidersHorizontal, Store, PiggyBank as PiggyBankIcon, Trash2, Users, WalletCards, X , Smartphone, KeyRound, ShieldAlert } from "lucide-react";
import { BASE_CURRENCY, activeCurrencies, currenciesMissingRate, supportedCurrencies, addIsoDays, allocationBudget, allocationSpent, allocationWeekStatus, createEmptyAppData, exchangeRateFor, sourceBalanceInCurrency, sourceCurrency, toBaseAmount, createFamilyCode, debtPaymentHistory, debtSnowball, expenseCategories, formatDate, isoDate, isoToday, matchingAllocationsForExpense, newId, normalizeAppData, parseRomanianAmount, pendingRecurringInPlan, recordDebtPayment, guessCategoryFromText, resolveReceiptLines, sourceBalance, type AppData, type Debt, type PaymentKind, type Receipt, type SavingsGoal, type Transaction, type TransactionKind, type ShareScope, transactionShareScope} from "@/lib/finance-data";
import { downloadBackup, parseBackup, type SyncJournalEntry } from "@/lib/app-storage";
import { checkFamilyPassword, generateFamilyPassword } from "@/lib/family-password";
import { acquireReceiptObjectUrl, acquireReceiptPreviewUrl, clearReceiptImageStorage, releaseReceiptObjectUrl, storeReceiptImages } from "@/lib/receipt-storage";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { EnvelopeStack } from "@/components/EnvelopeMark";
import { DebtSnowballCard } from "@/components/DebtSnowballCard";
import { requestNotificationPermission, setNotificationsEnabled } from "@/lib/local-notifications";
import { disableAppLock, hasAppLockPin, isAppLockEnabled, isValidPin, setAppLockPin } from "@/lib/app-lock";
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
  sourceKindName,
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
import { getLocale, languages, t } from "@/lib/i18n";
import { useLanguage } from "@/hooks/use-language";
import { matchCommandQuery, searchLedgerHits, writeJournalQuery } from "@/lib/command-search";
import { safeSetItem } from "@/lib/safe-storage";

const ReportsPanel = lazy(() => import("@/components/ReportsPanel").then((module) => ({ default: module.ReportsPanel })));
const RecurringPanel = lazy(() => import("@/components/RecurringPanel").then((module) => ({ default: module.RecurringPanel })));
const ReviewCenterPanel = lazy(() => import("@/components/ReviewCenterPanel").then((module) => ({ default: module.ReviewCenterPanel })));
const PriceWatchPanel = lazy(() => import("@/components/PriceWatchPanel").then((module) => ({ default: module.PriceWatchPanel })));
const PocketPanel = lazy(() => import("@/components/PocketPanel").then((module) => ({ default: module.PocketPanel })));
const AdvisorPanel = lazy(() => import("@/components/AdvisorPanel").then((module) => ({ default: module.AdvisorPanel })));
const HouseholdStudio = lazy(() => import("@/components/HouseholdStudio").then((module) => ({ default: module.HouseholdStudio })));
const TrustCenter = lazy(() => import("@/components/TrustCenter").then((module) => ({ default: module.TrustCenter })));
const PremiumStudio = lazy(() => import("@/components/PremiumStudio").then((module) => ({ default: module.PremiumStudio })));

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
      <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-theme-picker" role="dialog" aria-modal="true" aria-label="Alege aspectul" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("ASPECTUL APLICAȚIEI")}</p>
            <h2>{t("Alege o atmosferă, nu doar o culoare.")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide alegerea temei")} onClick={onClose}><X size={19} /></button>
        </header>
        <p className="bf-theme-picker-intro">{t("Previzualizezi tema înainte de aplicare. Verdele rămâne progres, mierea înseamnă revizuire, iar coralul atrage atenția.")}</p>
        <section className={`bf-theme-preview ${preview} background-preview-${previewBackground}`} aria-label={`Previzualizare ${previewOption.name}`}>
          <div className="bf-theme-preview-top"><span>{previewOption.mood}</span><b>{previewOption.name}</b></div>
          <div className="bf-theme-preview-value"><small>{t("RĂMAS ÎN PLICURI")}</small><strong>1.480 RON</strong><i /></div>
          <div className="bf-theme-preview-stats"><span>{t("SURSE UTILIZABILE")} <b>4.830 RON</b></span><span>{t("PUS DEOPARTE")} <b>780 RON</b></span></div>
          <div className="bf-theme-preview-nav"><i /><i /><i /><i /></div>
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
        <button type="button" className="bf-theme-apply" onClick={applyPreview}><Check size={17} /> {t("Aplică {name}", { name: previewOption.name })}</button>
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

export function CalmOnboarding({ onClose, onAdd, onGo }: { onClose: () => void; onAdd: () => void; onGo: (view: MainView) => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const steps = [
    { kicker: t("ÎNCREDERE"), title: t("Date pe telefon."), emphasis: t("Sync opțional. Fără login bancar."), detail: t("Registrul rămâne local. Sync-ul de familie e criptat cu o parolă pe care o alegeți voi — fără cont bancar și fără reclame pe ecranele financiare."), icon: WalletCards, tone: "calm" },
    { kicker: t("01 · ÎMPĂRȚIM"), title: t("Punem banii în locul potrivit."), emphasis: "Pas cu pas.", detail: t("Un plic este o sumă pusă deoparte pentru un scop: mâncare, facturi, transport sau orice contează pentru tine."), icon: Goal, tone: "envelope" },
    { kicker: "02 · AZI", title: t("Vezi ce poți folosi azi."), emphasis: t("Fără presupuneri."), detail: t("Ecranul Astăzi îți arată cât a mai rămas în plicuri, ce plăți urmează și care este următorul pas simplu."), icon: CalendarClock, tone: "rhythm" },
    { kicker: "03 · PRIMUL PAS", title: t("Începe cu o singură"), emphasis: t("cheltuială sau încasare."), detail: t("Nu trebuie să completezi totul acum. Adaugă un singur lucru și construim de acolo."), icon: Plus, tone: "start" },
  ];
  const current = steps[step]; const Icon = current.icon;
  const skipTour = () => {
    // Doar turul: FirstRunSetup (3 intenții) trebuie să rămână vizibil.
    safeSetItem(window.localStorage, "buget-familie:onboarding-complete", "true");
    onClose();
  };
  const startSetup = () => {
    safeSetItem(window.localStorage, "buget-familie:onboarding-complete", "true");
    onClose();
  };
  return <div className="bf-modal-backdrop bf-onboarding-backdrop" role="presentation"><section ref={dialogRef} tabIndex={-1} className={`bf-onboarding ${current.tone}`} role="dialog" aria-modal="true" aria-labelledby="bf-onboarding-title"><button type="button" className="bf-onboarding-skip" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); skipTour(); }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); skipTour(); }}>{t("Sari peste")}</button><div className="bf-onboarding-visual" aria-hidden="true"><EnvelopeStack fill={(step + 1) / 4} /><span className="bf-onboarding-orbit orbit-one" /><span className="bf-onboarding-orbit orbit-two" /><span className="bf-onboarding-icon"><Icon size={34} /></span><span className="bf-onboarding-number">0{step + 1}</span></div><div className="bf-onboarding-copy"><p className="bf-kicker">{current.kicker}</p><h2 id="bf-onboarding-title">{current.title}<em>{current.emphasis}</em></h2><p>{current.detail}</p></div><div className="bf-onboarding-progress" aria-label={`Pasul ${step + 1} din ${steps.length}`}>{steps.map((item, index) => <span key={item.kicker} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>{step < steps.length - 1 ? <div className="bf-onboarding-actions"><button type="button" className="bf-primary" onClick={() => setStep((value) => value + 1)}>{t("Continuă")} <ChevronRight size={17} /></button></div> : <div className="bf-onboarding-actions"><button type="button" className="bf-primary" onClick={startSetup}>{t("Începem configurarea")} <ChevronRight size={17} /></button></div>}<small className="bf-onboarding-footnote">{t("Poți relua acest tur oricând din")} <b>{t("Instrumente → Ghid")}</b>.</small></section></div>;
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

export function TransactionForm({ data, initial, onSave, onClose }: { data: AppData; initial?: Transaction; onSave: (item: Transaction | Transaction[]) => void; onClose: () => void }) {
  const [kind, setKind] = useState<TransactionKind>(initial?.kind || "expense");
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date || isoToday());
  const [memberId, setMemberId] = useState(initial?.memberId || data.settings.members.find((member) => member.name === initial?.person)?.id || data.settings.members[0]?.id || "");
  const [shareScope, setShareScope] = useState<ShareScope>(transactionShareScope(initial));
  const [sourceId, setSourceId] = useState(initial?.sourceId || data.settings.paymentSources.find((source) => source.name === initial?.source)?.id || data.settings.paymentSources[0]?.id || "");
  const [category, setCategory] = useState(initial?.category || "Alimente");
  const [allocationId, setAllocationId] = useState(initial?.allocationId || "outside");
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
  const envelopeCandidates = kind === "expense" ? matchingAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const envelopeCandidateIds = envelopeCandidates.map((item) => item.id).join("|");
  const matchedEnvelope = allocationId === "outside" ? undefined : envelopeCandidates.find((allocation) => allocation.id === allocationId);
  const sourceOwner = (source: AppData["settings"]["paymentSources"][number]) => data.settings.members.find((member) => member.id === source.memberId)?.name || t("Comun");
  const allocationMember = matchedEnvelope ? data.settings.members.find((member) => member.id === matchedEnvelope.memberId)?.name || t("Familie / comun") : "";
  const editedAlreadyInEnvelope = Boolean(matchedEnvelope && initial?.id && initial.allocationId === matchedEnvelope.id);
  const envelopeSpent = matchedEnvelope ? Math.max(0, allocationSpent(data, matchedEnvelope) - (editedAlreadyInEnvelope ? initial?.amount || 0 : 0)) : 0;
  const envelopeRemaining = matchedEnvelope ? allocationBudget(data, matchedEnvelope) - envelopeSpent : 0;
  const matchedWeek = matchedEnvelope && matchedEnvelope.weeklyPace !== false ? allocationWeekStatus(data, matchedEnvelope, date) : undefined;
  const initialInsideMatchedWeek = Boolean(initial && initial.date && matchedWeek && initial.date >= matchedWeek.start && initial.date <= matchedWeek.end);
  const adjustedWeekSpent = matchedWeek ? Math.max(0, matchedWeek.spent - (editedAlreadyInEnvelope && initialInsideMatchedWeek ? initial?.amount || 0 : 0)) : 0;
  const weekRemaining = matchedWeek ? matchedWeek.budget - adjustedWeekSpent : 0;
  const proposedAmount = baseAmount || 0;
  const envelopeAfter = envelopeRemaining - proposedAmount;
  const weekAfter = weekRemaining - proposedAmount;
  const canSplit = kind === "expense" && !initial && !isForeign;
  const resolvedSplit = canSplit && splitOpen ? resolveReceiptLines(lines, typedAmount) : [];
  const splitTotal = resolvedSplit.reduce((sum, line) => sum + line.amount, 0);
  useEffect(() => { setRateInput(savedRate && savedRate !== 1 ? String(savedRate) : ""); }, [entryCurrency]);
  useEffect(() => {
    if (kind !== "expense") { if (allocationId !== "outside") setAllocationId("outside"); return; }
    const currentIsValid = allocationId !== "outside" && envelopeCandidates.some((allocation) => allocation.id === allocationId);
    if (!currentIsValid && allocationId !== "outside") setAllocationId(envelopeCandidates[0]?.id || "outside");
    if (!allocationChoiceTouched && allocationId === "outside" && envelopeCandidates[0]) setAllocationId(envelopeCandidates[0].id);
  }, [allocationChoiceTouched, allocationId, envelopeCandidateIds, kind]);
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
      onSave(batch);
      onClose();
      return;
    }
    if (kind === "expense" && allocationId !== "outside" && !matchedEnvelope) return setError(t("Plicul ales nu mai corespunde categoriei, membrului sau sursei. Alege din nou."));
    const originalTyped = isForeign ? (parseRomanianAmount(originalAmountInput) || numeric) : undefined;
    onSave({ id: captureIdRef.current, title: title.trim(), amount: stored, originalAmount: isForeign ? originalTyped : undefined, originalCurrency: isForeign ? entryCurrency : undefined, exchangeRate: isForeign ? activeRate : undefined, kind, category: kind === "income" ? "Venit" : category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date, note: note.trim() || undefined, allocationId: kind === "expense" ? allocationId : undefined, shareScope, createdAt: initial?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), receiptId: initial?.receiptId });
    onClose();
  };
  return <Modal title={initial ? t("Corectează mișcarea") : t("Adaugă mișcare")} onClose={onClose}><div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>{t("Cheltuială")}</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>{t("Venit")}</button></div><div className="bf-form-grid"><Field label={t("Denumire")}><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("ex. Cumpărături Lidl")} /></Field><Field label={t("Sumă ({currency})", { currency: isForeign ? entryCurrency : "lei" })}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>{isForeign && <Field label={t("Curs: 1 {currency} = ? lei", { currency: entryCurrency })} hint={savedRate ? t("Cursul salvat în Setări este {rate}. Îl poți schimba doar pentru această mișcare.", { rate: savedRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) }) : t("Nu ai încă un curs salvat pentru această valută. Îl poți pune o dată, în Setări.")}><input value={rateInput} onChange={(event) => setRateInput(event.target.value)} inputMode="decimal" placeholder="ex. 4,97" /></Field>}{isForeign && initial && !initial.originalAmount && <Field label={t("Sumă originală ({currency})", { currency: entryCurrency })} hint={t("Mișcarea a fost salvată doar în lei. Completează suma din extras ca soldul valutar să nu mai fie aproximativ.")}><input value={originalAmountInput} onChange={(event) => setOriginalAmountInput(event.target.value)} inputMode="decimal" placeholder="ex. 20,00" /></Field>}<Field label={t("Data")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label={t("Cine a făcut mișcarea")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={t("Perspectivă")} hint={t("Personal rămâne la membru; comun intră în bilanțul familiei.")}><select value={shareScope} onChange={(event) => setShareScope(event.target.value as ShareScope)}><option value="shared">{t("Comun (familie)")}</option><option value="personal">{t("Personal")}</option></select></Field><Field label={kind === "income" ? t("Încasat în") : t("Plătit din (sursa reală)")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}{data.settings.members.length > 1 && source.memberId ? ` · ${sourceOwner(source)}` : ""} · {money(sourceBalance(data, source.id))}{source.currency ? ` (${source.currency})` : ""}</option>)}</select></Field>{kind === "expense" && !splitOpen && <Field label={t("Categorie")}><select value={category} onChange={(event) => setCategory(event.target.value)}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></Field>}</div>{isForeign && <section className={`bf-currency-preview ${baseAmount ? "" : "pending"}`}><p className="bf-kicker">{t("SE ÎNREGISTREAZĂ ÎN LEI")}</p>{baseAmount ? <><b>{fmtExact.format(baseAmount)}</b><span>{t("{original} × {rate} lei. Suma originală și cursul rămân salvate lângă mișcare.", { original: fmtExact.format(typedAmount).replace("RON", entryCurrency), rate: activeRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) })}</span></> : <span>{t("Completează suma și cursul ca să vezi echivalentul în lei.")}</span>}</section>}{canSplit && <section className="bf-receipt-split bf-tx-split"><div className="bf-split-heading"><div><p className="bf-kicker">{t("ÎMPARTE CHELTUIALA")}</p><h3>{splitOpen ? `${fmtExact.format(splitTotal)} / ${amount ? fmtExact.format(typedAmount) : "0,00 RON"}` : t("Pe categorii sau plicuri")}</h3></div><button type="button" className="bf-secondary" onClick={() => setSplitOpen((value) => !value)}>{splitOpen ? t("O singură categorie") : t("Împarte pe linii")}</button></div>{splitOpen && <>{lines.map((line) => <div className="bf-split-line" key={line.id}><select aria-label={t("Categorie")} value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select><input aria-label={t("Sumă")} value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" /><input aria-label={t("Detaliu")} value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder={t("ex. lapte")} />{lines.length > 1 && <button type="button" aria-label={t("Elimină linia")} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}</div>)}<button type="button" className="bf-secondary" onClick={() => setLines((current) => [...current, { id: newId("split-line"), category: "Alimente", amount: "", label: "" }])}><Plus size={16} /> {t("Adaugă linie")}</button><small>{t("Fiecare linie creează o mișcare separată, cu plicul potrivit categoriei.")}</small></>}</section>}{kind === "expense" && !splitOpen && <section className="bf-envelope-choice"><div><p className="bf-kicker">{t("BUGET REPARTIZAT")}</p><h3>{t("Plicul compatibil este ales automat.")}</h3><p>{t("Categoria, membrul și sursa reală găsesc plicul potrivit. Poți alege alt plic sau plată în afara plicurilor.")}</p></div><Field label={t("Plic de consum")}><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}><option value="outside">{t("În afara plicurilor — nu consumă buget repartizat")}</option>{envelopeCandidates.map((allocation) => { const owner = data.settings.members.find((member) => member.id === allocation.memberId)?.name || t("Familie / comun"); const remaining = Math.max(0, allocationBudget(data, allocation) - allocationSpent(data, allocation)); const week = allocation.weeklyPace === false ? undefined : allocationWeekStatus(data, allocation, date); return <option key={allocation.id} value={allocation.id}>{allocation.label}{data.settings.members.length > 1 ? ` · ${owner}` : ""} · {week ? `${money(Math.max(0, week.remaining))} în S${week.index}` : money(remaining)}</option>; })}</select></Field>{!envelopeCandidates.length && <small className="bf-envelope-empty">{t("Nu există un plic pentru această combinație de categorie, membru și sursă. Poți înregistra cheltuiala în afara plicurilor sau crea unul în Plan.")}</small>}</section>}{!splitOpen && matchedEnvelope ? <section className={`bf-envelope-match ${envelopeAfter < 0 || (matchedWeek && weekAfter < 0) ? "over" : ""}`}><p>{matchedWeek ? t("SE VA LUA DIN PLICUL SĂPTĂMÂNII ACTIVE") : t("SE VA LUA DIN PLIC")}</p><b>{matchedEnvelope.label} · {allocationMember} · {data.settings.paymentSources.find((source) => source.id === matchedEnvelope.sourceId)?.name || t("sursa aleasă")}</b>{matchedWeek ? <span>S{matchedWeek.index}: {money(Math.max(0, weekRemaining))} {t("rămași")} din {money(matchedWeek.budget)}</span> : <span>{money(Math.max(0, envelopeRemaining))} {t("rămași")} din {money(allocationBudget(data, matchedEnvelope))}</span>}</section> : kind === "expense" && !splitOpen && <section className="bf-envelope-match outside"><p>{t("PLATĂ ÎN AFARA PLICURILOR")}</p><b>{t("Va scădea doar soldul sursei reale de plată.")}</b><span>{t("Nu consumă nicio limită repartizată pentru categorii.")}</span></section>}<Field label={t("Notiță opțională")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. cursă taxi, traseu, persoană, motiv")} /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> {t("Salvează mișcarea")}</button></Modal>;
}

export function GoalForm({ data, type, item, onSave, onClose }: { data: AppData; type: "debt" | "saving"; item?: Debt | SavingsGoal; onSave: (item: Debt | SavingsGoal) => void; onClose: () => void }) {
  const saving = type === "saving"; const old = item as SavingsGoal | undefined; const oldDebt = item as Debt | undefined;
  const [name, setName] = useState(item?.name || ""); const [one, setOne] = useState(item ? String(saving ? old?.current ?? 0 : oldDebt?.remaining ?? 0) : ""); const [two, setTwo] = useState(item ? String(saving ? old?.target ?? 0 : oldDebt?.monthly ?? 0) : ""); const [date, setDate] = useState(item?.dueDate || ""); const [memberId, setMemberId] = useState(item?.memberId || ""); const [error, setError] = useState("");
  /** `updatedAt` decide ce versiune câștigă la unirea a două telefoane; fără el modificarea mai nouă putea fi ignorată. */
  const save = () => { const first = parseRomanianAmount(one); const second = parseRomanianAmount(two); if (!name.trim() || first < 0 || second < 0 || (saving && second <= 0)) return setError(t("Completează numele și sumele corecte.")); const now = new Date().toISOString(); if (saving) onSave({ id: item?.id || newId("goal"), name: name.trim(), current: first, target: second, due: date ? dateText(date, true) : t("Fără termen"), dueDate: date || undefined, memberId: memberId || undefined, tone: old?.tone || "honey", updatedAt: now }); else onSave({ id: item?.id || newId("debt"), name: name.trim(), remaining: first, monthly: second, due: date ? dateText(date, true) : "Nespecificat", dueDate: date || undefined, memberId: memberId || undefined, tone: oldDebt?.tone || "coral", updatedAt: now }); onClose(); };
  return <Modal title={saving ? t("Obiectiv de economisire") : t("Datorie sau rată")} onClose={onClose}><div className="bf-form-grid"><Field label={saving ? t("Pentru ce economisiți?") : t("Denumire")}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={saving ? t("ex. Fond de siguranță") : "ex. Credit bancar"} /></Field><Field label={t("Aparține de")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Familie / comun</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={saving ? t("Strâns până acum (lei)") : t("Sold rămas (lei)")}><input value={one} onChange={(event) => setOne(event.target.value)} inputMode="decimal" /></Field><Field label={saving ? t("Țintă (lei)") : t("Rată lunară (lei)")}><input value={two} onChange={(event) => setTwo(event.target.value)} inputMode="decimal" /></Field><Field label={saving ? t("Data țintă") : t("Scadență")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> {t("Salvează")}</button></Modal>;
}

export function DebtPaymentForm({ data, debt, onSave, onClose }: { data: AppData; debt: Debt; onSave: (data: AppData) => void; onClose: () => void }) {
  const defaultMemberId = debt.memberId || data.settings.members[0]?.id || ""; const [amount, setAmount] = useState(String(Math.min(debt.monthly || debt.remaining, debt.remaining))); const [date, setDate] = useState(isoToday()); const [memberId, setMemberId] = useState(defaultMemberId); const paymentSources = data.settings.paymentSources.filter((source) => !source.memberId || source.memberId === memberId); const [sourceId, setSourceId] = useState(data.settings.paymentSources.find((source) => source.memberId === defaultMemberId)?.id || data.settings.paymentSources.find((source) => !source.memberId)?.id || data.settings.paymentSources[0]?.id || ""); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const pay = () => { const value = parseRomanianAmount(amount); if (value <= 0) return setError(t("Introdu o sumă mai mare decât zero.")); if (value > debt.remaining) return setError(`Poți plăti cel mult ${money(debt.remaining)} pentru această datorie.`); const next = recordDebtPayment(data, { debtId: debt.id, amount: value, sourceId, memberId, date, note }); if (!next) return setError(t("Alege un membru și o sursă de plată valide.")); if (!window.confirm(`Confirmi plata de ${money(value)} pentru „${debt.name}”? Soldul datoriei va deveni ${money(debt.remaining - value)}.`)) return; onSave(next); onClose(); };
  const ownerName = (sourceId: string) => data.settings.members.find((member) => member.id === data.settings.paymentSources.find((source) => source.id === sourceId)?.memberId)?.name || "Comun";
  return <Modal title={`Plătește rata · ${debt.name}`} onClose={onClose}><section className="bf-debt-payment-intro"><p className="bf-kicker">{t("MIȘCARE REALĂ + DATORIE")}</p><p>{t("Plata este adăugată în Jurnal și scade aceeași sumă din soldul rămas. Nu pornește plăți bancare automate.")}</p><strong>{money(debt.remaining)} rămași</strong></section><div className="bf-form-grid"><Field label={t("Sumă plătită (lei)")}><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></Field><Field label={t("Data plății")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label={t("Membru")}><select value={memberId} onChange={(event) => { const nextMember = event.target.value; setMemberId(nextMember); const firstSource = data.settings.paymentSources.find((source) => !source.memberId || source.memberId === nextMember); if (firstSource) setSourceId(firstSource.id); }}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={t("Plătit din")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {ownerName(source.id)} · {money(sourceBalance(data, source.id))}</option>)}</select></Field></div><Field label={t("Notiță opțională")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. rata august, plată parțială")} /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={pay}><Check size={17} /> {t("Confirmă plata ratei")}</button></Modal>;
}
export function DebtPaymentHistory({ data, debt }: { data: AppData; debt: Debt }) { const history = debtPaymentHistory(data, debt.id); if (!history.length) return <p className="bf-debt-history empty">{t("Nu există încă plăți confirmate pentru această datorie.")}</p>; return <div className="bf-debt-history"><p>{t("PLĂȚI ÎNREGISTRATE")}</p>{history.slice(0, 4).map((payment) => <div key={payment.id}><span><b>{payment.title.includes("achitată integral") ? t("Achitată integral") : t("Plată parțială")}</b><small>{dateText(payment.date, true)} · {payment.source}</small></span><span><strong>{money(payment.amount)}</strong><small>rămân {money(payment.debtRemainingAfter ?? debt.remaining)}</small></span></div>)}</div>; }

/** Atelierul Financiar 3.0 — obligațiile devin o axă de protejat: datorii, plăți confirmate, economii și scadențe. */
export function SpendingHabitsView({ data }: { data: AppData }) { const [period, setPeriod] = useState<30 | 90>(90); const [memberId, setMemberId] = useState("family"); const today = isoToday(); const start = addIsoDays(today, -(period - 1)); const recentStart = addIsoDays(today, -13); const expenses = data.transactions.filter((item) => item.kind === "expense" && item.date >= start && (memberId === "family" || item.memberId === memberId)); const categories = Object.entries(expenses.reduce<Record<string, { total: number; count: number; small: number; recent: number; prior: number }>>((all, item) => { const current = all[item.category] || { total: 0, count: 0, small: 0, recent: 0, prior: 0 }; const amount = Math.max(0, item.amount); const isSmall = amount <= 75; const isRecent = item.date >= recentStart; return { ...all, [item.category]: { total: current.total + amount, count: current.count + 1, small: current.small + (isSmall ? 1 : 0), recent: current.recent + (isRecent ? amount : 0), prior: current.prior + (!isRecent ? amount : 0) } }; }, {})).map(([name, stats]) => ({ name, ...stats, average: stats.total / stats.count, smallShare: stats.count ? stats.small / stats.count : 0, momentum: stats.prior > 0 ? (stats.recent - stats.prior / Math.max(1, period - 14) * 14) / (stats.prior / Math.max(1, period - 14) * 14) : stats.recent > 0 ? 1 : 0 })).sort((a, b) => b.total - a.total); const signals = categories.filter((item) => item.count >= 3 && item.smallShare >= .55).sort((a, b) => (b.smallShare * b.count) - (a.smallShare * a.count)).slice(0, 4); const biggest = categories[0]; const recentTotal = expenses.filter((item) => item.date >= recentStart).reduce((sum, item) => sum + item.amount, 0); const previousTotal = expenses.filter((item) => item.date < recentStart).reduce((sum, item) => sum + item.amount, 0); const change = previousTotal > 0 ? Math.round((recentTotal - previousTotal) / previousTotal * 100) : 0; const members = data.settings.members; return <div className="bf-page bf-habits-workspace"><header className="bf-habits-header"><div><p className="bf-kicker">{t("OBICEIURI DE CHELTUIRE")}</p><h1>{t("Observă,")} <em>{t("nu te judeca.")}</em></h1><p>{t("Tiparele sunt informații. Alege o ajustare mică, nu o pedeapsă mare.")}</p></div><span><WalletCards size={26} /></span></header><section className="bf-habits-controls"><div className="bf-habits-period" role="group" aria-label={t("Perioada analizei")}><button className={period === 30 ? "active" : ""} onClick={() => setPeriod(30)}>{t("30 zile")}</button><button className={period === 90 ? "active" : ""} onClick={() => setPeriod(90)}>{t("90 zile")}</button></div>{members.length > 1 && <select value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label={t("Perspectiva analizei")}><option value="family">{t("Familie")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}</section><section className="bf-habits-pulse"><article><span>{t("Mișcări analizate")}</span><b>{expenses.length}</b><small>{t("în ultimele {period} de zile", { period })}</small></article><article><span>{t("Cheltuieli recente")}</span><b>{money(recentTotal)}</b><small>{change > 0 ? t("+{change}% față de ritmul anterior", { change }) : change < 0 ? t("{change}% față de ritmul anterior", { change }) : t("ritm apropiat de perioada anterioară")}</small></article><article><span>{t("Semnale blânde")}</span><b>{signals.length}</b><small>{t("tipare care merită observate")}</small></article></section><section className="bf-habits-guidance"><div><p className="bf-kicker">{t("O PERSPECTIVĂ MAI BLÂNDĂ")}</p><h2>{signals.length ? t("Nu orice cumpărătură mică este impulsivă.") : t("Ai nevoie de puțin istoric.")}</h2><p>{signals.length ? t("Am marcat doar tipare care combină frecvența cu multe sume mici. Verifică-le cu contextul tău înainte să schimbi ceva.") : t("După câteva mișcări, vei vedea frecvența, categoriile și ritmul fără să fie nevoie de presupuneri.")}</p></div><span><Check size={20} /></span></section><section className="bf-habits-signals"><div className="bf-section-heading"><div><p className="bf-kicker">{t("POSIBILE CUMPĂRĂTURI IMPULSIVE")}</p><h2>{t("Ce merită observat")}</h2></div><AlertTriangle size={19} /></div>{signals.length ? <div className="bf-habits-signal-list">{signals.map((item) => { const gentleCut = Math.round(item.total * .1); return <article key={item.name}><span className="bf-habits-signal-icon"><AlertTriangle size={16} /></span><div><b>{item.name}</b><small>{t("{count} mișcări · {percent}% sume mici · medie {average}", { count: item.count, percent: Math.round(item.smallShare * 100), average: money(item.average) })}</small><p>{t("Încearcă un plafon de")} <strong>{money(Math.max(0, item.total - gentleCut))}</strong> {t("pentru următoarea perioadă, doar dacă se potrivește realității tale.")}</p></div><strong>{money(item.total)}</strong></article>; })}</div> : <div className="bf-habits-empty"><Check size={22} /><p>{t("Nu am găsit tipare suficient de clare pentru a sugera o ajustare. Asta este un rezultat bun: nu forțăm o concluzie.")}</p></div>}</section><section className="bf-habits-adjustments"><div className="bf-section-heading"><div><p className="bf-kicker">{t("AJUSTĂRI BLÂNDE")}</p><h2>{t("Idei de încercat")}</h2></div><PiggyBank size={19} /></div><div className="bf-habits-adjustment-grid"><article><span>01</span><div><b>{t("Pauza de o zi")}</b><p>{t("Pentru cumpărăturile neplanificate, salvează ideea și revino mâine. Nu este interdicție; este spațiu pentru o alegere mai liniștită.")}</p></div></article><article><span>02</span><div><b>{t("Un plafon flexibil")}</b><p>{t("Alege o sumă mică pentru categoria care apare des și verifică săptămânal cum te simți cu ea.")}</p></div></article><article><span>03</span><div><b>{t("Mută, nu tăia")}</b><p>{t("Dacă o categorie este importantă, mută bani dintr-un plic mai puțin folosit în loc să elimini complet plăcerea.")}</p></div></article></div></section><p className="bf-habits-privacy">{t("Analiza se face local, din mișcările introduse de tine. Este un instrument orientativ, nu un diagnostic și nu modifică automat bugetul.")}</p></div>; }

export function SavingsScenarioSimulator({ data }: { data: AppData }) { const goals = data.savings; const [goalId, setGoalId] = useState(goals[0]?.id || ""); const selected = goals.find((item) => item.id === goalId) || goals[0]; const [inflation, setInflation] = useState(3); const [incomeChange, setIncomeChange] = useState(0); const [months, setMonths] = useState(24); const referenceIncome = Math.max(0, data.transactions.filter((item) => item.kind === "income" && item.date >= addIsoDays(isoToday(), -89)).reduce((sum, item) => sum + item.amount, 0) / 3); const current = selected?.current || 0; const target = selected?.target || 0; const baseRemaining = Math.max(0, target - current); const adjustedTarget = target * Math.pow(1 + Math.max(-99, inflation) / 100, months / 12); const scenarioIncome = referenceIncome * (1 + incomeChange / 100); const requiredMonthly = Math.max(0, adjustedTarget - current) / Math.max(1, months); const coverage = scenarioIncome > 0 ? Math.min(100, Math.round((requiredMonthly / scenarioIncome) * 100)) : 0; const status = requiredMonthly === 0 ? t("Obiectiv atins") : scenarioIncome <= 0 ? t("Adaugă un venit de referință") : coverage <= 15 ? t("Ritm confortabil") : coverage <= 30 ? t("Ritm de urmărit") : t("Ritm ambițios"); if (!goals.length) return null; return <section className="bf-scenario-card" aria-labelledby="scenario-title"><div className="bf-scenario-heading"><div><p className="bf-kicker">{t("SCENARIU DE ECONISIRE")}</p><h2 id="scenario-title">{t("Privește înainte,")} <em>{t("fără presiune.")}</em></h2><p>{t("Testează un posibil viitor fără să schimbi planul real.")}</p></div><span><Goal size={21} /></span></div><div className="bf-scenario-fields"><label><span>{t("Obiectiv")}</span><select value={selected?.id || ""} onChange={(event) => setGoalId(event.target.value)}>{goals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{t("Inflație anuală")}</span><input type="number" min="-10" max="30" step="0.5" value={inflation} onChange={(event) => setInflation(Math.max(-10, Math.min(30, Number(event.target.value) || 0)))} /><small>{t("Scumpește ținta în timp")}</small></label><label><span>{t("Schimbare venit")}</span><input type="number" min="-90" max="200" step="1" value={incomeChange} onChange={(event) => setIncomeChange(Math.max(-90, Math.min(200, Number(event.target.value) || 0)))} /><small>{t("Față de media locală")}</small></label><label><span>{t("Orizont")}</span><input type="number" min="1" max="240" step="1" value={months} onChange={(event) => setMonths(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} /><small>{t("luni până la țintă")}</small></label></div><div className="bf-scenario-result"><div><p className="bf-kicker">{t("PROIECȚIA SCENARIULUI")}</p><strong>{money(requiredMonthly)}</strong><span>{t("contribuție lunară estimată")}</span></div><div className="bf-scenario-metrics"><span><b>{money(adjustedTarget)}</b><small>{t("țintă ajustată")}</small></span><span><b>{money(scenarioIncome)}</b><small>{t("venit scenariu")}</small></span><span><b>{coverage}%</b><small>{t("din venit")}</small></span></div></div><div className={`bf-scenario-status ${coverage > 30 ? "watch" : coverage > 15 ? "attention" : "calm"}`}><span><Check size={15} /></span><div><b>{status}</b><small>{baseRemaining > 0 ? `Pentru „${selected?.name}”, inflația de ${inflation}% ar ridica ținta cu ${money(Math.max(0, adjustedTarget - target))} în acest orizont.` : t("Nu mai există sumă de construit pentru acest obiectiv.")}</small></div></div><p className="bf-scenario-note">{t("Calcul orientativ, fără randament sau dobândă. Simularea este temporară și nu modifică obiectivul, veniturile sau tranzacțiile reale.")}</p></section>; }

export function LongTermGoalsView({ data, onOpen, onEdit, onDelete }: { data: AppData; onOpen: () => void; onEdit: (item: SavingsGoal) => void; onDelete: (id: string) => void }) { const goals = data.savings; const totalTarget = goals.reduce((sum, item) => sum + Math.max(0, item.target), 0); const totalCurrent = goals.reduce((sum, item) => sum + Math.min(Math.max(0, item.current), Math.max(0, item.target)), 0); const totalRemaining = Math.max(0, totalTarget - totalCurrent); const activeGoals = goals.filter((item) => item.target > item.current); const datedGoals = activeGoals.filter((item) => item.dueDate); const suggestedMonthly = datedGoals.reduce((sum, item) => { const months = Math.max(1, Math.ceil((new Date(item.dueDate!).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))); return sum + Math.max(0, item.target - item.current) / months; }, 0); return <div className="bf-page bf-goals-workspace"><header className="bf-goals-header"><div><p className="bf-kicker">{t("OBIECTIVE PE TERMEN LUNG")}</p><h1>{t("Construiește")} <em>{t("cu liniște.")}</em></h1><p>{t("Un obiectiv bun îți arată direcția, nu îți cere să te grăbești.")}</p></div><span><PiggyBank size={26} /></span></header><section className="bf-goals-overview"><div><p className="bf-kicker">{t("PROGRESUL CASEI")}</p><strong>{totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%</strong><span>{t("{current} strânși din {target}", { current: money(totalCurrent), target: money(totalTarget) })}</span></div><div className="bf-goals-overview-stats"><span><b>{money(totalRemaining)}</b><small>{t("de construit")}</small></span><span><b>{money(suggestedMonthly)}</b><small>{t("recomandat / lună")}</small></span></div></section><section className="bf-goals-guidance"><span><Check size={17} /></span><div><b>{activeGoals.length ? t("Un ritm mic ține direcția vie.") : t("Alege un obiectiv care contează.")}</b><small>{activeGoals.length ? t("Nu trebuie să alimentezi toate obiectivele în fiecare lună. Prioritizează ce este cel mai aproape de tine.") : t("Fond de siguranță, o vacanță, o casă sau un plan personal — începe cu ce îți aduce claritate.")}</small></div></section><SavingsScenarioSimulator data={data} /><section className="bf-goals-list"><div className="bf-section-heading"><div><p className="bf-kicker">{t("OBIECTIVELE TALE")}</p><h2>{t("Pas cu pas")}</h2></div><button className="bf-primary" onClick={onOpen}><Plus size={16} /> {t("Obiectiv nou")}</button></div>{goals.length ? <div className="bf-goals-grid">{goals.map((goal) => { const progress = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0; const remaining = Math.max(0, goal.target - goal.current); const months = goal.dueDate ? Math.max(1, Math.ceil((new Date(goal.dueDate).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))) : undefined; const monthly = months ? remaining / months : undefined; return <article className={`bf-goal-card ${goal.tone}`} key={goal.id}><div className="bf-goal-card-top"><span className="bf-goal-mark"><PiggyBank size={17} /></span><span><b>{goal.name}</b><small>{goal.dueDate ? t("Până la {date}", { date: formatDate(goal.dueDate, { day: "2-digit", month: "short" }) }) : goal.due || t("Fără termen ales")}</small></span><strong>{progress}%</strong></div><div className="bf-goal-progress"><i style={{ width: `${progress}%` }} /></div><div className="bf-goal-card-values"><span><b>{money(goal.current)}</b><small>{t("strânși")}</small></span><span><b>{money(remaining)}</b><small>{t("rămași")}</small></span>{monthly !== undefined && <span><b>{money(monthly)}</b><small>{t("ritm lunar")}</small></span>}</div><div className="bf-goal-card-actions"><button onClick={() => onEdit(goal)}><Pencil size={14} /> {t("Editează")}</button><button className="delete" aria-label={`Șterge obiectivul ${goal.name}`} onClick={() => onDelete(goal.id)}><Trash2 size={15} /></button></div></article>; })}</div> : <div className="bf-goals-empty"><PiggyBank size={28} /><h2>{t("Nu ai încă un obiectiv pe termen lung.")}</h2><p>{t("Începe cu o țintă simplă și lasă aplicația să-ți arate un ritm posibil.")}</p><button className="bf-primary" onClick={onOpen}><Plus size={16} /> {t("Creează primul obiectiv")}</button></div>}</section></div>; }

type ScheduleRow = { index: number; date: string; amount: number; paid?: Transaction };
function debtScheduleRows(data: AppData, debt: Debt): ScheduleRow[] {
  const monthly = Math.max(0, debt.monthly);
  if (!monthly) return [];
  const history = debtPaymentHistory(data, debt.id).slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = debt.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(debt.dueDate) ? new Date(debt.dueDate + "T12:00:00") : new Date();
  const original = Math.max(debt.remaining + history.reduce((sum, item) => sum + item.amount, 0), monthly);
  const count = Math.min(120, Math.max(1, Math.ceil(original / monthly)));
  return Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const dateObject = new Date(first.getFullYear(), first.getMonth() + offset, Math.min(first.getDate(), new Date(first.getFullYear(), first.getMonth() + offset + 1, 0).getDate()), 12);
    const date = isoDate(dateObject);
    const paid = history.find((item) => item.date.slice(0, 7) === date.slice(0, 7));
    return { index, date, amount: Math.min(monthly, Math.max(0, original - offset * monthly)), paid };
  });
}
function DebtSchedule({ data, debt, onPay }: { data: AppData; debt: Debt; onPay: () => void }) {
  const rows = debtScheduleRows(data, debt);
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) return null;
  const visible = expanded ? rows : rows.slice(0, 6);
  const paidCount = rows.filter((row) => row.paid).length;
  return <div className="bf-debt-schedule"><div className="bf-debt-schedule-head"><div><p>{t("SCADENȚAR COMPLET")}</p><b>{paidCount} din {rows.length} rate bifate</b></div><span>{money(debt.remaining)} rămas</span></div><div className="bf-debt-schedule-list">{visible.map((row) => <div className={"bf-debt-schedule-row " + (row.paid ? "paid" : "")} key={row.date}><button type="button" className="bf-schedule-check" aria-label={row.paid ? "Rata " + row.index + t(" achitată") : t("Confirmă rata ") + row.index} onClick={row.paid ? undefined : onPay}>{row.paid ? <Check size={15} /> : <span />}</button><span><b>Rata {String(row.index).padStart(2, "0")}</b><small>{dateText(row.date, true)}{row.paid ? t(" · plătită la ") + dateText(row.paid.date, true) : t(" · neplătită")}</small></span><strong>{money(row.paid?.amount || row.amount)}</strong></div>)}</div>{rows.length > 6 && <button type="button" className="bf-schedule-more" onClick={() => setExpanded((value) => !value)}>{expanded ? t("Arată mai puține") : t("Arată toate cele ") + rows.length + " rate"}</button>}</div>;
}
function DebtPayoffPlan({ data }: { data: AppData }) {
  const openDebts = data.debts.filter((debt) => debt.remaining > 0);
  if (!openDebts.length) return <section className="bf-debt-plan complete"><div className="bf-debt-plan-mark"><Check size={22} /></div><div><p className="bf-kicker">{t("PLANUL DE IEȘIRE")}</p><h2>{t("Nu mai ai datorii active.")}</h2><span>{t("Ai închis toate obligațiile înregistrate. Următorul pas poate fi un fond de siguranță.")}</span></div></section>;
  const total = openDebts.reduce((sum, debt) => sum + debt.remaining, 0);
  const monthly = openDebts.reduce((sum, debt) => sum + Math.max(0, debt.monthly), 0);
  const months = monthly > 0 ? Math.max(1, Math.ceil(total / monthly)) : undefined;
  const payments = data.transactions.filter((item) => item.debtId && item.kind === "expense");
  const paidTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const originalTotal = total + paidTotal;
  const progress = originalTotal > 0 ? Math.min(100, Math.round((paidTotal / originalTotal) * 100)) : 0;
  const finish = months ? new Date(new Date().getFullYear(), new Date().getMonth() + months, 1) : undefined;
  const finishText = finish ? finish.toLocaleDateString(getLocale(), { month: "long", year: "numeric" }) : t("adaugă rate lunare");
  return <section className="bf-debt-plan"><div className="bf-debt-plan-top"><div><p className="bf-kicker">{t("PLANUL DE IEȘIRE")}</p><h2>{t("Mai sunt aproximativ")} <em>{months ?? "—"} luni</em>.</h2><span>{t("La ritmul minim actual, datoriile pot fi închise până în")} <b>{finishText}</b>.</span></div><div className="bf-debt-plan-total"><strong>{money(total)}</strong><small>{t("sold total")}</small></div></div><div className="bf-debt-plan-progress"><div><span>{t("Progres real")}</span><b>{progress}%</b></div><i><em style={{ width: progress + "%" }} /></i></div><div className="bf-debt-plan-stats"><span><b>{money(monthly)}</b><small>{t("rate / lună")}</small></span><span><b>{openDebts.length}</b><small>{t("datorii active")}</small></span><span><b>{money(paidTotal)}</b><small>{t("achitat până acum")}</small></span></div></section>;
}
function DebtPayoffSimulator({ data }: { data: AppData }) {
  const [extra, setExtra] = useState(0);
  const active = data.debts.filter((debt) => debt.remaining > 0);
  const total = active.reduce((sum, debt) => sum + debt.remaining, 0);
  const minimum = active.reduce((sum, debt) => sum + Math.max(0, debt.monthly), 0);
  if (!total || !minimum) return null;
  const baseMonths = Math.ceil(total / minimum);
  const simulatedMonths = Math.ceil(total / (minimum + extra));
  const savedMonths = Math.max(0, baseMonths - simulatedMonths);
  const maxExtra = Math.max(100, Math.ceil(minimum * 1.5 / 100) * 100);
  return <section className="bf-debt-simulator"><div className="bf-debt-simulator-head"><div><p className="bf-kicker">{t("SIMULATOR DE DECIZIE")}</p><h2>{t("Dacă plătești")} <em>{t("în plus")}</em>?</h2><span>{t("Testează un efort lunar suplimentar. Nu schimbă datele tale, doar îți arată scenariul.")}</span></div><div className="bf-debt-simulator-result"><strong>{savedMonths ? "−" + savedMonths : "0"}</strong><small>{t("luni câștigate")}</small></div></div><div className="bf-debt-slider"><div><span>{t("Sumă extra / lună")}</span><b>{money(extra)}</b></div><input type="range" min="0" max={maxExtra} step="50" value={extra} onChange={(event) => setExtra(Number(event.target.value))} aria-label={t("Sumă suplimentară lunară")} /><div className="bf-debt-slider-labels"><small>0 RON</small><small>{money(maxExtra)}</small></div></div><div className="bf-debt-simulator-summary"><span><b>{baseMonths}</b><small>{t("luni acum")}</small></span><span><b>{simulatedMonths}</b><small>{t("luni cu extra")}</small></span><span><b>{money(minimum + extra)}</b><small>{t("efort lunar")}</small></span></div></section>;
}
export function ObjectivesView({ data, onEditDebt, onEditSaving, onPayDebt, onDeleteDebt, onDeleteSaving, openDebt, openSaving, onOpenRecurring, onPayRecurring, onOpenGoals, onOpenCalendar, onOpenAssistant }: { data: AppData; onEditDebt: (item: Debt) => void; onEditSaving: (item: SavingsGoal) => void; onPayDebt: (item: Debt) => void; onDeleteDebt: (id: string) => void; onDeleteSaving: (id: string) => void; openDebt: () => void; openSaving: () => void; onOpenRecurring: () => void; onPayRecurring: (id: string) => void; onOpenGoals: () => void; onOpenCalendar: () => void; onOpenAssistant: () => void }) {
  const totalDebt = data.debts.reduce((sum, item) => sum + item.remaining, 0); const totalSavings = data.savings.reduce((sum, item) => sum + item.current, 0); const monthlyRates = data.debts.reduce((sum, item) => sum + item.monthly, 0); const snowball = debtSnowball(data); const rankedDebts = snowball.order.length ? [...snowball.order.map((item) => item.debt), ...data.debts.filter((item) => item.remaining <= 0)] : data.debts;
  const upcoming = [
    ...data.debts.filter((item) => item.dueDate).map((item) => ({ id: `debt-${item.id}`, date: item.dueDate!, label: item.name, detail: t("Rată {amount}/lună", { amount: money(item.monthly) }), amount: item.remaining, onConfirm: () => onPayDebt(item) })),
    ...data.savings.filter((item) => item.dueDate).map((item) => ({ id: `saving-${item.id}`, date: item.dueDate!, label: item.name, detail: "Obiectiv", amount: item.target, onConfirm: onOpenGoals })),
    ...pendingRecurringInPlan(data).map((item) => ({ id: `recurring-${item.id}`, date: item.dueDate, label: item.name, detail: item.category, amount: item.amount, onConfirm: () => onPayRecurring(item.id) })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  return <div className="bf-page bf-obligations-workspace"><header className="bf-obligations-header"><div><p className="bf-kicker">{t("OBLIGAȚII ȘI REZERVE")}</p><h1>{t("Ce trebuie")} <em>{t("protejat.")}</em></h1><p>{t("Ratele devin mișcări doar după confirmare. Economiile rămân distincte de soldurile surselor.")}</p></div><div className="bf-obligations-links"><button className="bf-goals-link" onClick={onOpenGoals}><PiggyBank size={16} /> {t("Obiective pe termen lung")}</button><button className="bf-goals-link" onClick={onOpenCalendar}><CalendarDays size={16} /> {t("Calendar de scadențe")}</button></div></header><DebtSnowballCard data={data} onPay={onPayDebt} /><DebtPayoffPlan data={data} /><DebtPayoffSimulator data={data} /><section className="bf-obligation-ai"><div className="bf-obligation-ai-icon"><Bot size={22} /></div><div><p className="bf-kicker">{t("GHIDUL TĂU PENTRU OBLIGAȚII")}</p><h2>{t("Îți urmăresc ratele, pas cu pas.")}</h2><p>{t("Spune-mi ce datorie ai, ce rată ai plătit și îți arăt imediat ce urmează și cât mai rămâne.")}</p></div><button type="button" onClick={onOpenAssistant} className="bf-primary">{t("Deschide ghidul")} <ChevronRight size={16} /></button></section><section className="bf-obligation-timeline"><div className="bf-section-heading"><div><p className="bf-kicker">{t("URMEAZĂ")}</p><h2>{t("Următoarele scadențe")}</h2></div></div>{upcoming.length ? <div className="bf-obligation-timeline-list">{upcoming.map((entry) => <article className="bf-obligation-entry" key={entry.id}><div className="bf-obligation-entry-main"><span><BellRing size={17} /></span><div><b>{entry.label}</b><small>{dateText(entry.date, true)} · {entry.detail}</small></div><strong>{money(entry.amount)}</strong></div><div className="bf-obligation-entry-actions"><button className="pay" onClick={entry.onConfirm}><Check size={16} /> {t("Confirmă plata")}</button></div></article>)}</div> : <div className="bf-obligation-empty"><span><b>{t("Nu ai scadențe apropiate.")}</b><small>{t("Adaugă o dată la datorii sau o scadență recurentă pentru a le vedea aici.")}</small></span></div>}</section><section className="bf-obligation-ledger"><article className="debt"><span>{t("Sold datorii")}</span><b>{money(totalDebt)}</b><small>{t("{amount} rate declarate / lună", { amount: money(monthlyRates) })}</small></article><article className="savings"><span>{t("Economii urmărite")}</span><b>{money(totalSavings)}</b><small>{t("{count} obiective înregistrate", { count: data.savings.length })}</small></article><button onClick={onOpenRecurring}><CalendarClock size={18} /><span>{t("Scadențe programate")}</span><b>{data.recurring.length}</b><ChevronRight size={16} /></button></section><section className="bf-obligation-actions"><button onClick={openDebt}><Plus size={17} /> {t("Adaugă datorie")}</button><button onClick={openSaving}><Plus size={17} /> {t("Creează economisire")}</button></section><div className="bf-obligation-lanes"><section className="bf-obligation-lane debt"><header><div><p className="bf-kicker">{t("DE PLĂTIT")}</p><h2>{t("Rate și împrumuturi")}</h2></div><span>{data.debts.length}</span></header>{rankedDebts.map((debt) => <article className={`bf-obligation-entry${snowball.next?.debt.id === debt.id ? " next" : ""}`} key={debt.id}><div className="bf-obligation-entry-main"><span><BellRing size={17} /></span><div><b>{debt.name}</b>{snowball.next?.debt.id === debt.id ? <em className="bf-snowball-tag">{t("01 · următoarea")}</em> : null}<small>{debt.due} · {t("rată {amount}/lună", { amount: money(debt.monthly) })}</small></div><strong>{money(debt.remaining)}</strong></div><DebtPaymentHistory data={data} debt={debt} /><DebtSchedule data={data} debt={debt} onPay={() => onPayDebt(debt)} /><div className="bf-obligation-entry-actions"><button className="pay" onClick={() => onPayDebt(debt)}><Check size={16} /> {t("Confirmă plata")}</button><button onClick={() => onEditDebt(debt)}><Pencil size={15} /> {t("Editează")}</button><button className="delete" aria-label={`Șterge ${debt.name}`} onClick={() => onDeleteDebt(debt.id)}><Trash2 size={16} /></button></div></article>)}{!data.debts.length && <div className="bf-obligation-empty"><BellRing size={21} /><span><b>{t("Nu ai datorii înregistrate.")}</b><small>{t("Adaugă doar obligațiile pe care vrei să le rezervi în plan.")}</small></span><button onClick={openDebt}>{t("Adaugă")}</button></div>}</section><section className="bf-obligation-lane savings"><header><div><p className="bf-kicker">{t("DE CONSTRUIT")}</p><h2>{t("Economii și obiective")}</h2></div><span>{data.savings.length}</span></header>{data.savings.map((saving) => <article className="bf-obligation-entry" key={saving.id}><div className="bf-obligation-entry-main"><span><PiggyBank size={17} /></span><div><b>{saving.name}</b><small>{saving.due}</small></div><strong>{money(saving.current)}</strong></div><div className="bf-obligation-progress"><BudgetBar used={saving.current} total={saving.target} tone="gold" /><small>{t("{left} rămași până la {target}", { left: money(Math.max(0, saving.target - saving.current)), target: money(saving.target) })}</small></div><div className="bf-obligation-entry-actions"><button onClick={() => onEditSaving(saving)}><Pencil size={15} /> {t("Editează")}</button><button className="delete" aria-label={`Șterge ${saving.name}`} onClick={() => onDeleteSaving(saving.id)}><Trash2 size={16} /></button></div></article>)}{!data.savings.length && <div className="bf-obligation-empty"><PiggyBank size={21} /><span><b>{t("Nu ai obiective de economisire.")}</b><small>{t("Începe cu fondul de siguranță sau un obiectiv concret.")}</small></span><button onClick={openSaving}>{t("Creează")}</button></div>}</section></div></div>;
}


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
    if (images.length + selected.length > 2) return setError(t("Un bon poate avea maximum două fotografii. Elimină una înainte de a adăuga alta."));
    try {
      setBusy(true);
      setError("");
      const { compressReceiptImage } = await import("@/lib/receipt-utils");
      const compressed: string[] = [];
      for (const file of selected) {
        compressed.push(await Promise.race([
          compressReceiptImage(file),
          new Promise<string>((_, reject) => window.setTimeout(() => reject(new Error(t("Poza a durat prea mult. Încearcă din galerie sau salvează bonul fără fotografie."))), 20000)),
        ]));
      }
      setImages((current) => [...current, ...compressed].slice(0, 2));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Poza bonului nu a putut fi procesată. Poți salva cumpărăturile fără fotografie."));
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => {
    try {
      setBusy(true);
      setError("");
      setOcrSummary("");
      setProgress(0);
      const { readReceiptLocally, ocrTextLooksUseful } = await import("@/lib/receipt-utils");
      const result = await readReceiptLocally(images, setProgress);
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
        setOcrSummary(t("Am citit {who}{count} produs(e) după reduceri ({total}). Verifică categoriile înainte de salvare.", { who, count: result.items.length, total: fmtExact.format(detectedTotal) }));
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
    if (!normalizedLines.length || Math.abs(numeric - splitTotal) > 0.01) return setError(`Repartizarea este ${fmtExact.format(splitTotal)}, dar totalul bonului este ${fmtExact.format(numeric)}. Corectează liniile înainte de salvare.`);
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
          <p className="bf-receipt-photo-hint">{t("Pozele rămân pe telefon. Nu sunt obligatorii — poți salva magazinul și totalul fără ele.")}</p>
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

export function MoreView({ tab, setTab, data, onChange, onAddReceipt, onDeleteReceipt, onOpenDebt, onOpenSaving, onOpenCalendar, receiptStorageNotice, sync }: { tab: MoreView; setTab: (value: MoreView) => void; data: AppData; onChange: (value: AppData) => void; onAddReceipt: () => void; onDeleteReceipt: (id: string) => void; onOpenDebt: () => void; onOpenSaving: () => void; onOpenCalendar: () => void; receiptStorageNotice?: string; sync: SyncPanelProps }) {
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
  const isCollaborative = data.settings.members.length > 1;
  const allTabs: { id: MoreView; label: string; icon: typeof SlidersHorizontal; advanced?: boolean }[] = [
    { id: "overview", label: t("Instrumente"), icon: MoreHorizontal },
    { id: "review", label: t("De verificat"), icon: Inbox },
    { id: "sync", label: "Sync", icon: Cloud },
    { id: "receipts", label: t("Bonuri"), icon: ReceiptText },
    { id: "recurring", label: t("Scadențe"), icon: CalendarDays },
    { id: "settings", label: t("Setări"), icon: Settings },
    { id: "guide", label: t("Ghid"), icon: BookOpen },
    { id: "prices", label: t("Prețuri"), icon: ShoppingBasket, advanced: true },
    ...(data.settings.members.some((item) => item.kind === "child") ? [{ id: "pocket" as const, label: t("Buzunar"), icon: PiggyBankIcon, advanced: true }] : []),
    { id: "debts", label: t("Datorii"), icon: BellRing, advanced: true },
    { id: "savings", label: t("Economii"), icon: PiggyBank, advanced: true },
    { id: "reports", label: t("Statistici"), icon: LayoutDashboard, advanced: true },
    { id: "assistant", label: t("Asistent"), icon: Bot, advanced: true },
  ];
  const tabs = simpleMode ? allTabs.filter((item) => !item.advanced || item.id === tab) : allTabs;
  const setSettings = (patch: Partial<AppData["settings"]>) => onChange({ ...data, settings: { ...data.settings, ...patch } });
  const content = () => {
    if (tab === "overview") return <div className="bf-more-overview">
      {simpleMode && <p className="bf-helper bf-simple-mode-banner" role="status">{t("Mod simplu: vezi esențialul. Activezi totul din Setări → Mod simplu.")}</p>}
      <section className="bf-more-group" aria-labelledby="more-daily-title">
        <p className="bf-kicker bf-more-section-label" id="more-daily-title">{t("ZILNIC")}</p>
        <div className="bf-more-grid bf-settings-group">
          <button type="button" className={data.pendingReview.length ? "bf-settings-row has-badge" : "bf-settings-row"} onClick={() => setTab("review")}><Inbox size={20} /><span className="bf-settings-copy"><b>{t("De verificat")}{data.pendingReview.length > 0 && <span className="bf-nav-count">{data.pendingReview.length}</span>}</b><small>{data.pendingReview.length ? t("{count} propuneri de confirmat", { count: data.pendingReview.length }) : t("import și confirmări")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("receipts")}><ReceiptText size={20} /><span className="bf-settings-copy"><b>{t("Bonuri")}</b><small>{data.receipts.length} {t("salvate")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("recurring")}><CalendarClock size={20} /><span className="bf-settings-copy"><b>{t("Scadențe")}</b><small>{data.recurring.length} {t("programate")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          {!simpleMode && <button type="button" className="bf-settings-row" onClick={onOpenCalendar}><CalendarDays size={20} /><span className="bf-settings-copy"><b>{t("Calendar")}</b><small>{t("scadențe și obiective")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>}
        </div>
      </section>
      {!simpleMode && <section className="bf-more-group" aria-labelledby="more-money-title">
        <p className="bf-kicker bf-more-section-label" id="more-money-title">{t("BANI PE TERMEN LUNG")}</p>
        <div className="bf-more-grid bf-settings-group">
          <button type="button" className="bf-settings-row" onClick={() => setTab("debts")}><BellRing size={20} /><span className="bf-settings-copy"><b>{t("Datorii")}</b><small>{data.debts.length} {t("active")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("savings")}><PiggyBank size={20} /><span className="bf-settings-copy"><b>{t("Economii")}</b><small>{data.savings.length} {t("obiective")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => setTab("prices")}><ShoppingBasket size={20} /><span className="bf-settings-copy"><b>{t("Prețuri")}</b><small>{t("istoric și coșul etalon")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          {data.settings.members.some((item) => item.kind === "child") && <button type="button" className="bf-settings-row" onClick={() => setTab("pocket")}><PiggyBankIcon size={20} /><span className="bf-settings-copy"><b>{t("Buzunar")}</b><small>{t("banii copilului")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>}
        </div>
      </section>}
      <section className="bf-more-group" aria-labelledby="more-house-title">
        <p className="bf-kicker bf-more-section-label" id="more-house-title">{t("CASĂ ȘI TELEFOANE")}</p>
        <div className="bf-more-grid bf-settings-group">
          <button type="button" className="bf-settings-row" onClick={() => setTab("settings")}><Settings size={20} /><span className="bf-settings-copy"><b>{isCollaborative ? t("Setări familie") : t("Setări profil")}</b><small>{isCollaborative ? t("membri și surse") : t("surse și categorii")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          {!simpleMode && <button type="button" className="bf-settings-row" onClick={() => { setTab("settings"); window.setTimeout(() => document.getElementById("bf-merchant-rules")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40); }}><Store size={20} /><span className="bf-settings-copy"><b>{t("Reguli comerciant")}</b><small>{t("categorie și plic după magazin")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>}
          <button type="button" className="bf-settings-row" onClick={() => setTab("sync")}><Cloud size={20} /><span className="bf-settings-copy"><b>{t("Sincronizare")}</b><small>{isCollaborative ? t("spațiu conectat") : t("opțională între telefoane")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          {!simpleMode && <button type="button" className="bf-settings-row" onClick={() => setTab("reports")}><LayoutDashboard size={20} /><span className="bf-settings-copy"><b>{t("Statistici")}</b><small>{t("istoric și categorii")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>}
          {!simpleMode && <button type="button" className="bf-settings-row" onClick={() => setTab("assistant")}><Bot size={20} /><span className="bf-settings-copy"><b>{t("Asistent")}</b><small>{t("explică datele")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>}
          <button type="button" className="bf-settings-row" onClick={() => setTab("guide")}><BookOpen size={20} /><span className="bf-settings-copy"><b>{t("Manual")}</b><small>{t("configurare și utilizare")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
          <button type="button" className="bf-settings-row" onClick={() => window.dispatchEvent(new CustomEvent("buget-familie:open-theme"))}><Palette size={20} /><span className="bf-settings-copy"><b>{t("Aspect")}</b><small>{t("teme și texturi")}</small></span><ChevronRight className="bf-settings-chevron" size={18} aria-hidden="true" /></button>
        </div>
      </section>
      {simpleMode && <button type="button" className="bf-secondary bf-simple-mode-exit" onClick={() => { try { window.localStorage.removeItem("buget-familie:simple-mode"); } catch { /* ignore */ } setSimpleModeState(false); window.dispatchEvent(new CustomEvent("buget-familie:ui-prefs", { detail: { simpleMode: false } })); }}>{t("Arată instrumentele avansate")}</button>}
    </div>;
    if (tab === "debts") return <div className="bf-more-list"><button className="bf-primary bf-inline-add" onClick={onOpenDebt}><Plus size={16} /> {t("Adaugă datorie")}</button>{data.debts.map((debt) => <article key={debt.id}><span><b>{debt.name}</b><small>{debt.due}</small></span><strong>{money(debt.remaining)}</strong><em>{money(debt.monthly)}/lună</em></article>)}{!data.debts.length && <div className="bf-empty-state slim"><BellRing size={23} /><h2>{t("Nicio datorie")}</h2></div>}</div>;
    if (tab === "savings") return <div className="bf-more-list"><button className="bf-primary bf-inline-add" onClick={onOpenSaving}><Plus size={16} /> {t("Creează obiectiv")}</button>{data.savings.map((saving) => <article key={saving.id}><span><b>{saving.name}</b><small>{saving.due}</small></span><strong>{money(saving.current)}</strong><BudgetBar used={saving.current} total={saving.target} tone="gold" /></article>)}{!data.savings.length && <div className="bf-empty-state slim"><PiggyBank size={23} /><h2>{t("Niciun obiectiv")}</h2></div>}</div>;
    if (tab === "receipts") return <div>{receiptStorageNotice && <p className="bf-notice" role="status"><ShieldCheck size={15} /> {receiptStorageNotice}</p>}<button className="bf-primary bf-inline-add" onClick={onAddReceipt}><ReceiptText size={17} /> {t("Adaugă bon")}</button><div className="bf-receipt-list">{data.receipts.map((receipt) => <article key={receipt.id}><ReceiptThumbnail receipt={receipt} /><div><b>{receipt.vendor}</b><small>{dateText(receipt.date)} · {receipt.lines?.length || 1} categorie{(receipt.lines?.length || 1) === 1 ? "" : "i"}</small><p>{receipt.lines?.map((line) => `${line.category}: ${money(line.amount)}`).join(" · ") || receipt.note || t("Fără detalii")}</p>{(receipt.imageKeys?.length || (receipt.imageData2 ? 2 : receipt.imageData ? 1 : 0)) > 1 && <small>{t("Bon în două fotografii")}</small>}</div><strong>{money(receipt.amount)}</strong><button aria-label={`Șterge bonul ${receipt.vendor}`} onClick={() => onDeleteReceipt(receipt.id)}><Trash2 size={16} /></button></article>)}{!data.receipts.length && <div className="bf-empty-state slim"><ReceiptText size={23} /><h2>{t("Niciun bon")}</h2><p>{t("Adaugă magazinul și totalul. Fotografiile sunt opționale; fiecare categorie creează o cheltuială legată de același bon.")}</p></div>}</div></div>;
    if (tab === "review") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim revizuirea…")}</div>}><ReviewCenterPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "prices") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim prețurile…")}</div>}><PriceWatchPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "pocket") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim buzunarul…")}</div>}><PocketPanel data={data} /></Suspense>;
    if (tab === "recurring") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim scadențele…")}</div>}><RecurringPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "reports") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim statisticile…")}</div>}><ReportsPanel data={data} /></Suspense>;
    if (tab === "assistant") return <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim asistentul…")}</div>}><AdvisorPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "settings") return <SettingsPanel data={data} onChange={onChange} onReset={() => { if (!window.confirm(t("Ștergi toate datele locale de pe acest dispozitiv?"))) return; void clearReceiptImageStorage(); onChange(createEmptyAppData()); }} />;
    if (tab === "guide") return <FamilyGuide />;
    return <SyncPanel {...sync} />;
  };
  return <div className="bf-page bf-utilities-workspace"><header className="bf-topline compact"><div><p className="bf-kicker">{t("MAI MULT")}</p><h1>{t("Tot ce nu e zilnic,")} <em>{t("la un loc.")}</em></h1><p className="bf-helper">{t("Sync, setări, bonuri și scadențe — fără să înghesuim bara de jos.")}</p></div></header><div className="bf-more-tab-region"><p className="bf-more-swipe-hint" aria-hidden="true">{t("Glisează pentru mai multe")}</p><div className="bf-more-tabs" role="tablist" aria-label={t("Categorii de instrumente")}>{tabs.map((item) => { const Icon = item.icon; const reviewCount = item.id === "review" ? data.pendingReview.length : 0; return <button role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon size={16} /> {item.label}{reviewCount > 0 && <span className="bf-nav-count">{reviewCount}</span>}</button>; })}</div></div>{content()}</div>;
}

/**
 * Cursurile sunt introduse manual, cu data la care au fost puse. Aplicația nu întreabă
 * niciun serviciu extern și nu recalculează retroactiv mișcările deja salvate: fiecare
 * mișcare valutară păstrează cursul cu care a fost înregistrată.
 */
/**
 * Un rând de sursă, editabil complet. Soldul inițial se ține într-un câmp liber până
 * la ieșirea din el: dacă l-am fi trecut prin parser la fiecare tastă, virgula
 * zecimală ar fi dispărut imediat, iar ștergerea ultimei cifre ar fi resetat la zero —
 * exact motivul pentru care câmpul părea că nu se poate edita.
 */
function SourceRow({ data, source, settings, change }: { data: AppData; source: AppData["settings"]["paymentSources"][number]; settings: AppData["settings"]; change: (patch: Partial<AppData["settings"]>) => void }) {
  const [name, setName] = useState(source.name);
  const [balance, setBalance] = useState(String(source.openingBalance));
  useEffect(() => { setName(source.name); }, [source.name]);
  useEffect(() => { setBalance(String(source.openingBalance)); }, [source.openingBalance]);
  const own = sourceBalanceInCurrency(data, source.id);
  const patchSource = (patch: Partial<typeof source>) => change({ paymentSources: settings.paymentSources.map((item) => item.id === source.id ? { ...item, ...patch } : item) });
  const used = data.transactions.filter((item) => item.sourceId === source.id).length;
  const remove = () => {
    if (settings.paymentSources.length <= 1) { window.alert(t("Păstrează cel puțin o sursă de plată.")); return; }
    const question = used
      ? t("Ștergi sursa „{name}”? Cele {count} mișcări înregistrate pe ea rămân în registru, dar nu vor mai avea o sursă.", { name: source.name, count: used })
      : t("Ștergi sursa „{name}”?", { name: source.name });
    if (!window.confirm(question)) return;
    change({
      paymentSources: settings.paymentSources.filter((item) => item.id !== source.id),
      salaryPlan: { ...settings.salaryPlan, sourceIds: settings.salaryPlan.sourceIds.filter((id) => id !== source.id), allocations: settings.salaryPlan.allocations.map((item) => item.sourceId === source.id ? { ...item, sourceId: undefined } : item) },
    });
  };
  return <div className="bf-source-edit rich">
    <label className="bf-source-name"><small>{t("Denumire")}</small><input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { const clean = name.trim(); if (clean && clean !== source.name) patchSource({ name: clean }); else setName(source.name); }} /></label>
    <label><small>{t("Sold inițial")} ({source.currency || t("lei")})</small><input inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} onBlur={() => patchSource({ openingBalance: Math.max(0, parseRomanianAmount(balance)) })} /></label>
    <label><small>{t("Valută")}</small><select value={source.currency || BASE_CURRENCY} onChange={(event) => patchSource({ currency: event.target.value === BASE_CURRENCY ? undefined : event.target.value })}>{supportedCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
    <label><small>{t("Aparține de")}</small><select value={source.memberId || ""} onChange={(event) => patchSource({ memberId: event.target.value || undefined })}><option value="">{t("Familie / comun")}</option>{settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <div className="bf-source-edit-foot">
      <span><b>{money(sourceBalance(data, source.id))}</b><small>{sourceKindName[source.kind]}{own ? <> · {own.amount.toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {own.currency}{own.exact ? null : <em className="bf-fx-approx">{t("aproximativ")}</em>}</> : null} · {t("{count} mișcări", { count: used })}</small></span>
      <button type="button" aria-label={t("Șterge sursa {name}", { name: source.name })} onClick={remove}><Trash2 size={15} /></button>
    </div>
  </div>;
}

/** Selectorul de limbă. Schimbarea are efect imediat, fără reîncărcarea aplicației. */
function LanguageSection() {
  const [lang, setLang] = useLanguage();
  return <section><p className="bf-kicker">{t("LIMBĂ")}</p><h2>{t("Limba aplicației")}</h2><p>{t("Se schimbă doar afișarea. Datele, categoriile și notele rămân exact cum le-ai scris.")}</p><div className="bf-language-switch" role="group" aria-label={t("Limba aplicației")}>{languages.map((item) => <button key={item.id} type="button" aria-pressed={lang === item.id} className={lang === item.id ? "active" : ""} onClick={() => setLang(item.id)}>{item.label}</button>)}</div></section>;
}

function ExchangeRatesSection({ data, settings, change }: { data: AppData; settings: AppData["settings"]; change: (patch: Partial<AppData["settings"]>) => void }) {
  const used = activeCurrencies(data);
  const missing = currenciesMissingRate(data);
  const [code, setCode] = useState(missing[0] || supportedCurrencies.find((item) => item !== BASE_CURRENCY) || "EUR");
  const [rate, setRate] = useState("");
  if (!used.length && !settings.exchangeRates.length) return null;
  const save = () => {
    const value = parseRomanianAmount(rate);
    if (!value || value <= 0) return;
    const next = [...settings.exchangeRates.filter((item) => item.currency !== code), { currency: code, rate: value, updatedAt: new Date().toISOString() }];
    change({ exchangeRates: next });
    setRate("");
  };
  return <section><p className="bf-kicker">{t("CURSURI VALUTARE")}</p><h2>{t("Cât face un leu")}</h2><p>{t("Se folosesc doar la înregistrarea unei mișcări noi și la soldul inițial al unei surse valutare. Mișcările deja salvate păstrează cursul cu care au fost introduse.")}</p>
    {missing.length > 0 && <p className="bf-form-error" role="alert">{t("Lipsește cursul pentru {codes}. Până îl adaugi, soldul inițial al acestor surse este socotit zero, ca să nu apară o cifră inventată.", { codes: missing.join(", ") })}</p>}
    {settings.exchangeRates.map((item) => <div className="bf-source-edit" key={item.currency}><span><b>1 {item.currency}</b><small>pus pe {dateText(String(item.updatedAt).slice(0, 10), true)}{used.includes(item.currency) ? "" : t(" · nefolosit de nicio sursă")}</small></span><label><small>Lei</small><input inputMode="decimal" value={String(item.rate)} onChange={(event) => change({ exchangeRates: settings.exchangeRates.map((entry) => entry.currency === item.currency ? { ...entry, rate: Math.max(0, parseRomanianAmount(event.target.value)), updatedAt: new Date().toISOString() } : entry) })} /></label><button aria-label={`Șterge cursul pentru ${item.currency}`} onClick={() => change({ exchangeRates: settings.exchangeRates.filter((entry) => entry.currency !== item.currency) })}><X size={14} /></button></div>)}
    <div className="bf-source-builder"><select value={code} onChange={(event) => setCode(event.target.value)} aria-label="Valuta">{supportedCurrencies.filter((item) => item !== BASE_CURRENCY).map((item) => <option key={item} value={item}>{item}</option>)}</select><input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" placeholder="ex. 4,97" aria-label={t("Lei per unitate")} /><button onClick={save}>{t("Salvează cursul")}</button></div>
  </section>;
}

function AppLockSettings() {
  const [enabled, setEnabled] = useState(() => isAppLockEnabled() && hasAppLockPin());
  const [mode, setMode] = useState<"idle" | "create" | "confirm">("idle");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState("");

  const startCreate = () => { setMode("create"); setPin(""); setFirstPin(""); setNotice(""); };
  const cancel = () => { setMode("idle"); setPin(""); setFirstPin(""); };

  const submitFirst = () => {
    if (!isValidPin(pin)) return setNotice(t("PIN-ul trebuie să aibă exact 4 cifre."));
    setFirstPin(pin);
    setPin("");
    setMode("confirm");
    setNotice("");
  };

  const submitConfirm = () => {
    if (pin !== firstPin) {
      setNotice(t("PIN-urile nu coincid. Încearcă din nou."));
      setPin("");
      setFirstPin("");
      setMode("create");
      return;
    }
    void setAppLockPin(pin).then(() => {
      setEnabled(true);
      setMode("idle");
      setPin("");
      setFirstPin("");
      setNotice(t("Blocarea cu PIN este activă pe acest telefon."));
    });
  };

  const turnOff = () => {
    if (!window.confirm(t("Dezactivezi blocarea cu PIN pe acest telefon?"))) return;
    disableAppLock();
    setEnabled(false);
    setNotice(t("Blocarea a fost dezactivată."));
  };

  return (
    <section className="bf-settings-lock">
      <p className="bf-kicker">{t("SECURITATE")}</p>
      <h2>{t("Blocare cu PIN")}</h2>
      <p>{t("Un PIN de 4 cifre, doar pe acest telefon. Nu se salvează în clar, nu intră în backup și nu se sincronizează cu celelalte telefoane.")}</p>
      {mode === "idle" && (
        enabled ? (
          <div className="bf-notification-actions">
            <button type="button" onClick={startCreate}>{t("Schimbă PIN-ul")}</button>
            <button type="button" onClick={turnOff}>{t("Dezactivează")}</button>
          </div>
        ) : (
          <button type="button" className="bf-primary" onClick={startCreate}><LockKeyhole size={16} /> {t("Activează blocarea")}</button>
        )
      )}
      {(mode === "create" || mode === "confirm") && (
        <div className="bf-app-lock-setup">
          <Field label={mode === "create" ? "PIN nou (4 cifre)" : t("Confirmă PIN-ul")}>
            <input inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" autoFocus />
          </Field>
          <div className="bf-notification-actions">
            <button type="button" onClick={cancel}>{t("Anulează")}</button>
            <button type="button" className="bf-primary" disabled={pin.length !== 4} onClick={mode === "create" ? submitFirst : submitConfirm}>{mode === "create" ? t("Continuă") : t("Confirmă")}</button>
          </div>
        </div>
      )}
      {notice && <p className="bf-notice" role="status">{notice}</p>}
    </section>
  );
}

function MerchantRulesSection({ data, onChange }: { data: AppData; onChange: (value: AppData) => void }) {
  const rules = data.settings.merchantRules || [];
  const [match, setMatch] = useState("");
  const [category, setCategory] = useState("Alimente");
  const [allocationId, setAllocationId] = useState("");
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const add = () => {
    const needle = match.trim();
    if (needle.length < 2) return;
    const rule = {
      id: newId("merchant-rule"),
      match: needle.slice(0, 80),
      category: category || undefined,
      allocationId: allocationId || undefined,
      updatedAt: new Date().toISOString(),
    };
    onChange({
      ...data,
      settings: {
        ...data.settings,
        merchantRules: [rule, ...rules.filter((item) => item.match.toLocaleLowerCase("ro-RO") !== needle.toLocaleLowerCase("ro-RO"))].slice(0, 80),
      },
    });
    setMatch("");
    setAllocationId("");
  };
  const remove = (id: string) => onChange({
    ...data,
    settings: { ...data.settings, merchantRules: rules.filter((item) => item.id !== id) },
  });
  return (
    <section id="bf-merchant-rules" className="bf-merchant-rules">
      <p className="bf-kicker">{t("REGULI COMERCIANT")}</p>
      <h2>{t("Dacă titlul conține…")}</h2>
      <p>{t("Propune categorie sau plic la import, OCR și asistent. Nu salvează nimic fără confirmarea ta.")}</p>
      <div className="bf-merchant-rule-form">
        <Field label={t("Text în titlu")}><input value={match} onChange={(event) => setMatch(event.target.value)} placeholder={t("ex. Glovo, ENEL, Starbucks")} /></Field>
        <Field label={t("Categorie propusă")}><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></Field>
        <Field label={t("Plic propus (opțional)")}><select value={allocationId} onChange={(event) => setAllocationId(event.target.value)}><option value="">{t("Fără plic preferat")}</option>{data.settings.salaryPlan.allocations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
        <button type="button" className="bf-primary" onClick={add}>{t("Adaugă regula")}</button>
      </div>
      <ul className="bf-merchant-rule-list">
        {rules.map((rule) => {
          const envelope = data.settings.salaryPlan.allocations.find((item) => item.id === rule.allocationId);
          return (
            <li key={rule.id}>
              <div>
                <b>„{rule.match}”</b>
                <small>{rule.category ? t(rule.category) : t("fără categorie")}{envelope ? ` → ${envelope.label}` : ""}</small>
              </div>
              <button type="button" aria-label={t("Șterge regula {match}", { match: rule.match })} onClick={() => remove(rule.id)}><X size={14} /></button>
            </li>
          );
        })}
      </ul>
      {!rules.length && <small className="bf-helper">{t("Nicio regulă încă. Exemplu: „detergent” → Casă & facturi.")}</small>}
    </section>
  );
}

export function SettingsPanel({ data, onChange, onReset }: { data: AppData; onChange: (value: AppData) => void; onReset: () => void }) {
  const [backupPreview, setBackupPreview] = useState<{ data: AppData; exportedAt: string; fileName: string } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false); const [pasted, setPasted] = useState("");
  const importBackup = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; void file.text().then((raw) => { acceptBackupText(raw, file.name); }).catch(() => window.alert(t("Nu am putut citi fișierul ales. Încearcă „Lipește text”."))); event.target.value = ""; };
  const acceptBackupText = (raw: string, fileName: string) => { try { const backup = parseBackup(raw); setBackupPreview({ data: normalizeAppData(backup.data), exportedAt: backup.exportedAt, fileName }); setPasteOpen(false); setPasted(""); return true; } catch (reason) { window.alert(reason instanceof Error ? reason.message : t("Backup-ul nu a putut fi importat.")); return false; } };
  const confirmBackupImport = () => { if (!backupPreview) return; onChange(backupPreview.data); setBackupPreview(null); };
  const [member, setMember] = useState(""); const [source, setSource] = useState(""); const [kind, setKind] = useState<PaymentKind>("card"); const [owner, setOwner] = useState(data.settings.members[0]?.id || ""); const [category, setCategory] = useState("");
  const settings = data.settings; const change = (patch: Partial<typeof settings>) => onChange({ ...data, settings: { ...settings, ...patch } });
  const [currency, setCurrency] = useState(BASE_CURRENCY);
  const addMember = () => { if (!member.trim()) return; if (settings.members.some((item) => item.name.toLowerCase() === member.trim().toLowerCase())) return; change({ members: [...settings.members, { id: newId("member"), name: member.trim() }] }); setMember(""); };
  const addSource = () => { if (!source.trim()) return; change({ paymentSources: [...settings.paymentSources, { id: newId("source"), name: source.trim(), kind, memberId: kind === "transfer" ? undefined : owner, openingBalance: 0, currency: currency === BASE_CURRENCY ? undefined : currency }] }); setSource(""); setCurrency(BASE_CURRENCY); };
  const [simpleMode, setSimpleModeState] = useState(() => { try { return window.localStorage.getItem("buget-familie:simple-mode") === "1"; } catch { return false; } });
  const toggleSimple = () => {
    const next = !simpleMode;
    try {
      if (next) window.localStorage.setItem("buget-familie:simple-mode", "1");
      else window.localStorage.removeItem("buget-familie:simple-mode");
    } catch { /* ignore */ }
    setSimpleModeState(next);
    window.dispatchEvent(new CustomEvent("buget-familie:ui-prefs", { detail: { simpleMode: next } }));
  };
  return <div className="bf-settings"><LanguageSection /><section className="bf-guide-glossary compact" aria-labelledby="bf-settings-glossary"><p className="bf-kicker">{t("PE ROMÂNEȘTE")}</p><h2 id="bf-settings-glossary">{t("Plic ≠ cont · Reper ≠ sold")}</h2><p>{t("Plicul e o limită pe categorie, nu un cont. Reperul e ritmul zilei din plan, nu soldul din bancă. Detalii în Ghid.")}</p></section><section className="bf-simple-mode-card" aria-labelledby="bf-simple-mode-title"><p className="bf-kicker">{t("MOD SIMPLU")}</p><h2 id="bf-simple-mode-title">{t("Doar jurnal și esențialul")}</h2><p>{t("Ascunde instrumentele avansate din Mai mult (statistici, asistent, datorii, prețuri) până le activezi.")}</p><button type="button" className={simpleMode ? "bf-primary" : "bf-secondary"} onClick={toggleSimple}>{simpleMode ? t("Mod simplu activ — arată tot") : t("Activează modul simplu")}</button></section><section><p className="bf-kicker">{t("FAMILIE")}</p><Field label={t("Numele familiei")}><input value={settings.familyName} onChange={(event) => change({ familyName: event.target.value })} /></Field><Field label={t("Numele tău")}><input value={settings.memberName} onChange={(event) => change({ memberName: event.target.value })} /></Field><Field label={t("Cod local de familie")} hint={t("Nu leagă telefoanele. E doar un semn în backup-ul exportat, ca să recunoști fișierul. Conectarea se face din Sync, cu parola de 12+ caractere.")}><input value={settings.familyCode} onChange={(event) => change({ familyCode: event.target.value.toUpperCase() })} /><button className="bf-link-button" onClick={() => change({ familyCode: createFamilyCode() })}><RotateCcw size={14} /> {t("Cod nou")}</button></Field></section><section><p className="bf-kicker">{t("MEMBRI")}</p><div className="bf-member-rows">{settings.members.map((item) => <div className="bf-member-row" key={item.id}><b>{item.name}</b><label><input type="checkbox" checked={item.kind === "child"} onChange={(event) => change({ members: settings.members.map((memberItem) => memberItem.id === item.id ? { ...memberItem, kind: event.target.checked ? "child" as const : undefined } : memberItem) })} /> {t("Copil")}</label>{settings.members.length > 1 && <button aria-label={`Șterge membrul ${item.name}`} onClick={() => change({ members: settings.members.filter((memberItem) => memberItem.id !== item.id) })}><X size={14} /></button>}</div>)}</div><small className="bf-helper">{t("Un membru marcat drept copil primește un ecran simplu de buzunar. Dă-i un plic pe numele lui, din Plan.")}</small><div className="bf-mini-form"><input value={member} onChange={(event) => setMember(event.target.value)} placeholder={t("ex. Soția")} /><button onClick={addMember}>{t("Adaugă")}</button></div></section><section><p className="bf-kicker">{t("SURSE ȘI SOLD INITIAL")}</p>{settings.paymentSources.map((item) => <SourceRow key={item.id} data={data} source={item} settings={settings} change={change} />)}<div className="bf-source-builder"><input value={source} onChange={(event) => setSource(event.target.value)} placeholder={t("ex. Card soție")} /><select value={kind} onChange={(event) => setKind(event.target.value as PaymentKind)}>{Object.entries(sourceKindName).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={owner} disabled={kind === "transfer"} onChange={(event) => setOwner(event.target.value)}>{settings.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Valuta sursei">{supportedCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}</select><button onClick={addSource}>{t("Adaugă")}</button></div></section><ExchangeRatesSection data={data} settings={settings} change={change} /><section><p className="bf-kicker">{t("CATEGORII PROPRII")}</p><div className="bf-chip-list">{settings.customCategories.map((item) => <span key={item}>{item}<button onClick={() => change({ customCategories: settings.customCategories.filter((categoryItem) => categoryItem !== item) })}><X size={14} /></button></span>)}</div><div className="bf-mini-form"><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="ex. Taxi" /><button onClick={() => { if (category.trim() && !settings.customCategories.includes(category.trim())) { change({ customCategories: [...settings.customCategories, category.trim()] }); setCategory(""); } }}>{t("Adaugă")}</button></div></section><MerchantRulesSection data={data} onChange={onChange} /><section className="bf-settings-notifications"><p className="bf-kicker">{t("ALERTE LOCALE")}</p><h2>{t("Reamintiri pe telefon")}</h2><p>{t("Scadențe, plicuri aproape de limită și un check-in calm. Rămân pe dispozitiv; nu se trimit pe server.")}</p><div className="bf-notification-actions"><button type="button" className="bf-primary" onClick={() => void (async () => { const status = await requestNotificationPermission(); setNotificationsEnabled(status === "granted"); if (status === "granted") window.alert(t("Alertele sunt active pe acest dispozitiv.")); else if (status === "denied") window.alert(t("Permisiunea a fost refuzată. O poți reactiva din setările telefonului.")); else window.alert(t("Notificările nu sunt disponibile în acest browser.")); })()}>{t("Activează alertele")}</button><button type="button" onClick={() => { setNotificationsEnabled(false); window.alert(t("Alertele au fost oprite pe acest dispozitiv.")); }}>{t("Oprește alertele")}</button></div><small className="bf-helper">{t("Pe Android nativ:")} <code>pnpm install && npx cap sync</code>.</small></section><AppLockSettings /><section><p className="bf-kicker">{t("BACKUP ȘI RECUPERARE")}</p><h2>{t("Protejează registrul local")}</h2><p>{t("Backup-ul este un fișier local JSON. Nu este trimis automat în rețea și poate fi importat pe un alt dispozitiv.")}</p><div className="bf-backup-actions"><button onClick={() => void downloadBackup(data).then((result) => { if (result.how === "shared") window.alert(t("Backupul a fost trimis către aplicația aleasă.")); else if (result.how === "saved") window.alert(t("Backupul a fost scris în {path}. Îl găsești cu aplicația Fișiere.", { path: result.path })); else if (result.how === "downloaded") window.alert(t("Backupul a fost salvat în descărcări.")); else if (result.how === "failed") window.alert(t("Nu am putut salva fișierul: {reason}", { reason: result.reason || t("motiv necunoscut") })); })}><Download size={16} /> {t("Exportă backup")}</button><label className="bf-file-button"><Upload size={16} /> {t("Alege backup")}<input type="file" accept=".json,application/json,text/plain,application/octet-stream" onChange={importBackup} /></label><button type="button" onClick={() => setPasteOpen((value) => !value)}><ClipboardPaste size={16} /> {t("Lipește text")}</button></div>{pasteOpen && <div className="bf-backup-paste"><label htmlFor="backup-paste">{t("Dacă selectorul de fișiere nu se deschide, deschide backupul cu orice aplicație de fișiere, copiază tot textul și lipește-l aici.")}</label><textarea id="backup-paste" value={pasted} onChange={(event) => setPasted(event.target.value)} rows={5} placeholder={`{"kind":"buget-familie-backup",…`} /><div className="bf-backup-paste-actions"><button type="button" onClick={() => { setPasteOpen(false); setPasted(""); }}>{t("Anulează")}</button><button type="button" className="bf-primary" disabled={!pasted.trim()} onClick={() => acceptBackupText(pasted.trim(), t("text lipit"))}>{t("Citește textul")}</button></div></div>}{backupPreview && <div className="bf-backup-preview" role="alert" aria-live="polite"><div><p className="bf-kicker">{t("PREVIZUALIZARE ÎNAINTE DE IMPORT")}</p><h3>{backupPreview.fileName}</h3><p>{t("Exportat la {when}.", { when: new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(backupPreview.exportedAt)) })}</p><div className="bf-backup-preview-stats"><span><b>{backupPreview.data.transactions.length}</b><small>{t("mișcări")}</small></span><span><b>{backupPreview.data.receipts.length}</b><small>{t("bonuri")}</small></span><span><b>{backupPreview.data.settings.members.length}</b><small>{t("membri")}</small></span></div></div><p className="bf-backup-warning">{t("Importul va înlocui datele locale actuale. Nimic nu se schimbă până nu confirmi.")}</p><div className="bf-backup-preview-actions"><button type="button" onClick={() => setBackupPreview(null)}>{t("Anulează")}</button><button type="button" className="bf-primary" onClick={confirmBackupImport}><Check size={16} /> {t("Confirmă importul")}</button></div></div>}</section><Suspense fallback={null}><TrustCenter /></Suspense><Suspense fallback={null}><PremiumStudio /></Suspense><section className="bf-danger"><p className="bf-kicker">{t("RESETARE")}</p><h2>{t("Începe curat pe acest dispozitiv")}</h2><p>{t("Șterge numai datele locale. O copie sincronizată sau exportată nu este afectată.")}</p><button onClick={onReset}><Trash2 size={16} /> {t("Resetează datele locale")}</button></section></div>;
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

export function SyncPanel({ connected, busy, online, password, setPassword, notice, lastSync, journal, devices, thisDeviceId, onConnect, onDisconnect, onClearJournal, onRevokeDevice, passwordRevealOnce, clearPasswordReveal }: SyncPanelProps) {
  const [showGenerated, setShowGenerated] = useState(Boolean(passwordRevealOnce));
  const [generatedOnce, setGeneratedOnce] = useState(passwordRevealOnce || "");
  useEffect(() => {
    if (!passwordRevealOnce) return;
    setPassword(passwordRevealOnce);
    setGeneratedOnce(passwordRevealOnce);
    setShowGenerated(true);
    clearPasswordReveal?.();
  }, [passwordRevealOnce, setPassword, clearPasswordReveal]);
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

  return <div className="bf-sync">
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
      <p className="bf-kicker">{connected ? "CONECTAT" : t("CONECTEAZĂ FAMILIA")}</p>
      {connected ? <>
        <p><b>{t("Actualizare live, fără reîmprospătare manuală")}</b><br />{t("Cât aplicația rămâne deschisă pe orice telefon din familie, mișcările apar automat pe toate celelalte în câteva secunde.")}</p>
        <button className="bf-link-button" onClick={onDisconnect}>{t("Închide sesiunea acestui telefon")}</button>
      </> : <>
        <div className="bf-sync-backup-reminder" role="note">
          <ShieldAlert size={16} aria-hidden="true" />
          <p>{t("Înainte de reinstalare sau de schimbarea telefonului: exportă un backup din Setări. Parola de familie nu se salvează pe aparat.")}</p>
        </div>
        <Field label={t("Parola familiei")} hint={t("Orice parolă inventată de voi. O propoziție scurtă e mai bună decât un cuvânt cu simboluri: „pisicaVerdeSareGardul7”. Trebuie să fie identică, literă cu literă, pe toate telefoanele.")}>
          <input type={showGenerated ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setShowGenerated(false); }} placeholder="minimum 12 caractere" autoComplete="new-password" />
          {password.length > 0 && <PasswordMeter value={password} />}
        </Field>
        <div className="bf-sync-generate">
          <button type="button" className="bf-secondary" onClick={generateOnce}><KeyRound size={16} /> {t("Generează o parolă")}</button>
          {showGenerated && generatedOnce && (
            <p className="bf-notice" role="status">
              <KeyRound size={14} /> {t("Arată-o o singură dată partenerului, apoi noteaz-o în afara telefonului:")} <code className="bf-sync-password-once">{generatedOnce}</code>
            </p>
          )}
        </div>
        <p className="bf-helper">{t("Nu ai nevoie de niciun cont sau token. Parola nu se salvează pe telefon și nu este trimisă niciodată necriptată.")}</p>
        <button className="bf-primary full" disabled={busy || !online} onClick={onConnect}><Users size={17} /> {t("Conectează acest telefon")}</button>
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
        {devices.length ? (
          <ul className="bf-sync-device-list">
            {devices.map((device) => (
              <li key={device.id}>
                <Smartphone size={16} aria-hidden="true" />
                <div>
                  <b>{device.label}{device.id === thisDeviceId ? ` · ${t("acest telefon")}` : ""}</b>
                  <small>{t("Ultima dată văzut")}: {new Intl.DateTimeFormat(getLocale(), { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastSeenAt))}</small>
                </div>
                <button type="button" className="bf-link-button" onClick={() => onRevokeDevice(device.id)}>
                  {device.id === thisDeviceId ? t("Revocă acest telefon") : t("Revocă")}
                </button>
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


export function FamilyGuide() { return <div className="bf-guide"><section className="bf-guide-hero"><BookOpen size={25} /><p className="bf-kicker">{t("MANUAL RAPID")}</p><h2>{t("Doar tu sau împreună.")}</h2><p>{t("Poți urmări banii proprii de la prima deschidere. Membrii și conectarea telefoanelor sunt opționale.")}</p><button className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-onboarding"))}><BookOpen size={16} /> {t("Reia turul „Calm financiar”")}</button><button className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-setup"))}><WalletCards size={16} /> {t("Reia configurarea casei")}</button></section><section><p className="bf-kicker">{t("1. PORNEȘTE CU TINE")}</p><h3>{t("Configurează profilul și banii reali")}</h3><p>{t("În")} <b>{t("Setări familie")}</b>{t(", păstrează un singur membru pentru monitorizare personală sau adaugă mai mulți membri când aveți un buget comun. Configurează sursele și soldurile inițiale, apoi creează planul până la următorul venit.")}</p></section><section><p className="bf-kicker">{t("2. CONECTEAZĂ OPȚIONAL")}</p><h3>{t("O parolă de familie, în loc de conturi și tokenuri")}</h3><p>{t("Dacă vrei același registru pe mai multe telefoane, mergi în")} <b>{t("Mai mult → Sincronizare")}</b> {t("și alegeți împreună o parolă de familie de minimum 12 caractere. Introduceți exact aceeași parolă pe fiecare telefon, apoi apăsați „Conectează acest telefon”. De acolo, mișcările apar automat, în timp real, pe toate telefoanele conectate.")}</p></section><section><p className="bf-kicker">{t("3. LUCREAZĂ ZILNIC")}</p><h3>{t("Înregistrează, verifică, decide")}</h3><p>{t("Adaugă mișcările la momentul plății. Pentru cumpărături, un bon se salvează cu magazin și total; pozele sunt opționale. Verifică zilnic punctul de decizie și confirmă scadențele când sunt plătite.")}</p></section><section><p className="bf-kicker">{t("4. PROTEJEAZĂ DATELE")}</p><h3>{t("Parola de familie rămâne la voi")}</h3><p>{t("Parola de sincronizare nu este salvată. Nu o pune în conversații, bonuri sau capturi de ecran. Dacă un telefon se pierde, schimbați parola pe telefoanele rămase — camera veche nu mai decriptează pachetul. Pozele bonurilor nu părăsesc telefonul. Politica, termenii și ștergerea datelor sunt în Setări → Încredere.")}</p></section><section className="bf-guide-glossary" aria-labelledby="bf-glossary-title"><p className="bf-kicker">{t("PE ROMÂNEȘTE")}</p><h3 id="bf-glossary-title">{t("Cuvinte scurte, fără confuzie")}</h3><dl className="bf-glossary-list"><div><dt>{t("Plic")}</dt><dd>{t("Nu e un cont bancar. E o limită pe care ți-o pui singur pentru o categorie (mâncare, transport). Banii stau în surse; plicul spune cât poți cheltui din ele pe acel scop.")}</dd></div><div><dt>{t("Reper")}</dt><dd>{t("Nu e soldul din bancă. E ritmul zilei din plan — cât e prudent să folosești azi ca să ajungi la următorul venit fără să golești plicurile.")}</dd></div><div><dt>{t("Sursă")}</dt><dd>{t("Unde stau banii reali: card, cash, bonuri de masă. Soldul se calculează aici.")}</dd></div><div><dt>{t("Ciclu")}</dt><dd>{t("De la începutul planului până la următorul salariu, nu neapărat luna calendaristică.")}</dd></div></dl></section></div>; }

/** Atelierul Financiar 3.0 — Analiza este o destinație de lucru, cu rapoarte și asistent separat încărcate la cerere. */
export function InsightsView({ data, onChange, onGo }: { data: AppData; onChange: (next: AppData) => void; onGo?: (view: MainView) => void }) {
  const [panel, setPanel] = useState<"reports" | "household" | "assistant">("reports");
  return <div className="bf-page bf-insights-workspace"><header className="bf-insights-header"><div><p className="bf-kicker">{t("ANALIZĂ FINANCIARĂ")}</p><h1>{t("Înțelege")} <em>{t("schimbarea.")}</em></h1><p>{t("Compară lunile, închide ritualul gospodăriei și cere o explicație locală.")}</p></div><span><LayoutDashboard size={25} /></span></header><div className="bf-insights-switch bf-segment" role="tablist" aria-label={t("Tip analiză")}><button role="tab" aria-selected={panel === "reports"} className={panel === "reports" ? "active" : ""} onClick={() => setPanel("reports")}><LayoutDashboard size={16} /> {t("Istoric")}</button><button role="tab" aria-selected={panel === "household"} className={panel === "household" ? "active" : ""} onClick={() => setPanel("household")}><Users size={16} /> {t("Gospodărie")}</button><button role="tab" aria-selected={panel === "assistant"} className={panel === "assistant" ? "active" : ""} onClick={() => setPanel("assistant")}><Bot size={16} /> {t("Asistent")}</button></div>{panel === "reports" ? <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim analiza…")}</div>}><ReportsPanel data={data} onGo={onGo} /></Suspense> : panel === "household" ? <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim gospodăria…")}</div>}><HouseholdStudio data={data} onChange={onChange} /></Suspense> : <Suspense fallback={<div className="bf-lazy-panel">{t("Pregătim asistentul…")}</div>}><AdvisorPanel data={data} onChange={onChange} /></Suspense>}</div>;
}
