/**
 * Ecrane și formulare încărcate după Astăzi — nu intra în first paint.
 */
import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BellRing, BookOpen, Bot, CalendarClock, CalendarDays, Camera, Check, Images, ChevronLeft, ChevronRight, Cloud, Command, Download, Goal, LayoutDashboard, Search, Upload, MoreHorizontal, Pencil, PiggyBank, Plus, ReceiptText, RotateCcw, Settings, ShieldCheck, SlidersHorizontal, Trash2, Users, WalletCards, X } from "lucide-react";
import { allocationBudget, allocationSpent, allocationWeekStatus, createEmptyAppData, createFamilyCode, debtPaymentHistory, debtSnowball, expenseCategories, formatDate, isoToday, matchingAllocationsForExpense, newId, normalizeAppData, parseRomanianAmount, pendingRecurringInPlan, recordDebtPayment, resolveReceiptLines, sourceBalance, type AppData, type Debt, type PaymentKind, type Receipt, type SavingsGoal, type Transaction, type TransactionKind } from "@/lib/finance-data";
import { downloadBackup, parseBackup, type SyncJournalEntry } from "@/lib/app-storage";
import { acquireReceiptObjectUrl, acquireReceiptPreviewUrl, clearReceiptImageStorage, releaseReceiptObjectUrl, storeReceiptImages } from "@/lib/receipt-storage";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { EnvelopeStack } from "@/components/EnvelopeMark";
import { DebtSnowballCard } from "@/components/DebtSnowballCard";
import { requestNotificationPermission, setNotificationsEnabled } from "@/lib/local-notifications";
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

const ReportsPanel = lazy(() => import("@/components/ReportsPanel").then((module) => ({ default: module.ReportsPanel })));
const RecurringPanel = lazy(() => import("@/components/RecurringPanel").then((module) => ({ default: module.RecurringPanel })));
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
            <p className="bf-kicker">ASPECTUL APLICAȚIEI</p>
            <h2>Alege o atmosferă, nu doar o culoare.</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label="Închide alegerea temei" onClick={onClose}><X size={19} /></button>
        </header>
        <p className="bf-theme-picker-intro">Previzualizezi tema înainte de aplicare. Verdele rămâne progres, mierea înseamnă revizuire, iar coralul atrage atenția.</p>
        <section className={`bf-theme-preview ${preview} background-preview-${previewBackground}`} aria-label={`Previzualizare ${previewOption.name}`}>
          <div className="bf-theme-preview-top"><span>{previewOption.mood}</span><b>{previewOption.name}</b></div>
          <div className="bf-theme-preview-value"><small>BANI NEREPARTIZAȚI</small><strong>1.480 RON</strong><i /></div>
          <div className="bf-theme-preview-stats"><span>DISPONIBIL <b>4.830 RON</b></span><span>REZERVAT <b>780 RON</b></span></div>
          <div className="bf-theme-preview-nav"><i /><i /><i /><i /></div>
        </section>
        <p className="bf-theme-preview-note">Tema se aplică din butonul de jos. Textura suprafeței se schimbă imediat, la atingere.</p>
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
            <p className="bf-kicker">FUNDAL</p>
            <h3 id="bf-background-title">Alege textura suprafeței</h3>
            <p>Atinge o dală — se aplică imediat, cu inel și bifă, fără să atingă cifrele.</p>
          </div>
          <div className="bf-background-grid" role="listbox" aria-label="Textura suprafeței">
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
        <section className="bf-theme-preferences" aria-label="Preferințe temă">
          <button type="button" className={schedule === "auto" ? "active" : ""} role="switch" aria-checked={schedule === "auto"} onClick={() => onScheduleChange(schedule === "auto" ? "manual" : "auto")}>
            <span>
              <b>Comută automat zi/noapte</b>
              <small>{schedule === "auto" ? `Activ acum: ${themeOptions.find((item) => item.id === automaticTheme(currentLocalMinutes(), scheduleTimes))?.name || "tema automată"}. Zi ${scheduleTimes.dayStart}–${scheduleTimes.eveningStart} · seară ${scheduleTimes.eveningStart}–${scheduleTimes.nightStart} · noapte ${scheduleTimes.nightStart}–${scheduleTimes.dayStart}.` : "Folosește Porcelain ziua, Aurora seara și Ultraviolet noaptea."}</small>
            </span>
            <i aria-hidden="true" />
          </button>
          <div className="bf-theme-schedule-fields" aria-label="Intervale automate">
            <label><span>Ziua începe</span><input type="time" value={scheduleTimes.dayStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, dayStart: event.target.value })} /></label>
            <label><span>Seara începe</span><input type="time" value={scheduleTimes.eveningStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, eveningStart: event.target.value })} /></label>
            <label><span>Noaptea începe</span><input type="time" value={scheduleTimes.nightStart} onChange={(event) => onScheduleTimesChange({ ...scheduleTimes, nightStart: event.target.value })} /></label>
          </div>
          {!scheduleIsValid && <small className="bf-theme-schedule-error">Ordinea trebuie să fie zi → seară → noapte. Până la corectare se folosesc temporar valorile standard: 06:00, 17:00 și 21:00.</small>}
          <button type="button" className={highContrast ? "active" : ""} role="switch" aria-checked={highContrast} onClick={() => onContrastChange(!highContrast)}>
            <span>
              <b>Contrast extra-ridicat</b>
              <small>Contururi, texte secundare și stări active mai puternice, fără a schimba culorile banilor.</small>
            </span>
            <i aria-hidden="true" />
          </button>
        </section>
        <button type="button" className="bf-theme-apply" onClick={applyPreview}><Check size={17} /> Aplică {previewOption.name}</button>
      </section>
    </div>,
    document.body,
  );
}

export function QuickActionsPalette({ onClose, onAdd, onGo }: { onClose: () => void; onAdd: () => void; onGo: (view: MainView) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const actions = [
    { id: "expense", label: "Înregistrează o mișcare", detail: "Adaugă rapid o cheltuială sau un venit", icon: ReceiptText, run: onAdd },
    { id: "plan", label: "Verifică plicurile", detail: "Vezi repartizarea și soldurile planului", icon: Goal, run: () => onGo("plan") },
    { id: "goals", label: "Deschide obiectivele", detail: "Construiește planurile pe termen lung", icon: PiggyBank, run: () => onGo("goals") },
    { id: "journal", label: "Deschide registrul", detail: "Caută și corectează mișcări", icon: WalletCards, run: () => onGo("journal") },
    { id: "obligations", label: "Verifică obligațiile", detail: "Urmărește ratele, economiile și scadențele", icon: BellRing, run: () => onGo("obligations") },
    { id: "insights", label: "Vezi analiza", detail: "Înțelege ritmul și tendințele casei", icon: LayoutDashboard, run: () => onGo("insights") },
    { id: "habits", label: "Înțelege obiceiurile", detail: "Observă tipare fără judecată", icon: WalletCards, run: () => onGo("habits") },
    { id: "calendar", label: "Deschide calendarul", detail: "Vezi veniturile, scadențele și obiectivele", icon: CalendarDays, run: () => onGo("calendar") },
  ];
  const visible = actions.filter((action) => `${action.label} ${action.detail}`.toLocaleLowerCase("ro-RO").includes(query.toLocaleLowerCase("ro-RO")));
  useEffect(() => { inputRef.current?.focus(); }, []);
  return <div className="bf-modal-backdrop bf-command-backdrop" role="presentation" onMouseDown={onClose}><section className="bf-command-palette" role="dialog" aria-modal="true" aria-labelledby="bf-command-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="bf-kicker">NAVIGARE RAPIDĂ</p><h2 id="bf-command-title">Ce vrei să faci?</h2></div><span className="bf-command-shortcut"><Command size={12} /> K</span></header><label className="bf-command-search"><Search size={17} aria-hidden="true" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută o acțiune…" aria-label="Caută o acțiune" /></label><div className="bf-command-list" role="listbox" aria-label="Acțiuni disponibile">{visible.length ? visible.map((action) => { const Icon = action.icon; return <button key={action.id} role="option" onClick={() => { action.run(); onClose(); }}><span className="bf-command-icon"><Icon size={17} /></span><span><b>{action.label}</b><small>{action.detail}</small></span><ChevronRight size={16} /></button>; }) : <p className="bf-command-empty">Nu am găsit o acțiune pentru „{query}”.</p>}</div><p className="bf-command-hint">Scurtătură: <kbd>Ctrl</kbd><span>+</span><kbd>K</kbd> sau <kbd>⌘</kbd><span>+</span><kbd>K</kbd></p></section></div>;
}

export function CalmOnboarding({ onClose, onAdd, onGo }: { onClose: () => void; onAdd: () => void; onGo: (view: MainView) => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const steps = [
    { kicker: "CALM FINANCIAL", title: "Banii nu trebuie ghiciți.", emphasis: "Doar așezați.", detail: "Bugetul tău devine mai ușor de trăit când fiecare sumă are un loc și fiecare decizie este vizibilă.", icon: WalletCards, tone: "calm" },
    { kicker: "01 · PLICURI", title: "Dă fiecărui leu", emphasis: "un loc clar.", detail: "Plicurile separă ce este necesar, ce urmează și ce poate aștepta. Nu trebuie să controlezi totul deodată.", icon: Goal, tone: "envelope" },
    { kicker: "02 · RITM", title: "Urmărește ritmul,", emphasis: "nu perfecțiunea.", detail: "Ecranul Astăzi îți arată ce contează acum: ce ai disponibil, ce urmează și care este următoarea acțiune simplă.", icon: CalendarClock, tone: "rhythm" },
    { kicker: "03 · PRIMUL PAS", title: "Începe cu o singură", emphasis: "mișcare bună.", detail: "Poți crea planul până la următorul venit sau poți înregistra prima încasare. Restul se așază pe parcurs.", icon: Plus, tone: "start" },
  ];
  const current = steps[step]; const Icon = current.icon;
  const finish = (action?: () => void) => { window.localStorage.setItem("buget-familie:onboarding-complete", "true"); onClose(); action?.(); };
  return <div className="bf-modal-backdrop bf-onboarding-backdrop" role="presentation"><section ref={dialogRef} tabIndex={-1} className={`bf-onboarding ${current.tone}`} role="dialog" aria-modal="true" aria-labelledby="bf-onboarding-title"><button className="bf-onboarding-skip" onClick={() => finish()}>Sari peste</button><div className="bf-onboarding-visual"><EnvelopeStack fill={(step + 1) / 4} /><span className="bf-onboarding-orbit orbit-one" /><span className="bf-onboarding-orbit orbit-two" /><span className="bf-onboarding-icon"><Icon size={34} /></span><span className="bf-onboarding-number">0{step + 1}</span></div><div className="bf-onboarding-copy"><p className="bf-kicker">{current.kicker}</p><h2 id="bf-onboarding-title">{current.title}<em>{current.emphasis}</em></h2><p>{current.detail}</p></div><div className="bf-onboarding-progress" aria-label={`Pasul ${step + 1} din ${steps.length}`}>{steps.map((item, index) => <span key={item.kicker} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>{step < steps.length - 1 ? <div className="bf-onboarding-actions"><button className="bf-primary" onClick={() => setStep((value) => value + 1)}>Continuă <ChevronRight size={17} /></button></div> : <div className="bf-onboarding-actions"><button className="bf-primary" onClick={() => finish()}>Configurează casa <ChevronRight size={17} /></button></div>}<small className="bf-onboarding-footnote">Poți relua acest tur oricând din <b>Instrumente → Ghid</b>.</small></section></div>;
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
            <p className="bf-kicker">BON LOCAL</p>
            <h2>{receipt.vendor}</h2>
          </div>
          <button className="bf-icon-button" aria-label="Închide fotografia" onClick={onClose}><X size={19} /></button>
        </header>
        <div className="bf-receipt-photo-frame">
          {url ? <img src={url} alt={`Bon ${receipt.vendor}, partea ${index + 1}`} decoding="async" /> : <span>Pregătim fotografia…</span>}
        </div>
        {sources.length > 1 ? (
          <div className="bf-receipt-photo-switch" role="tablist" aria-label="Părțile bonului">
            <button type="button" disabled={index === 0} aria-label="Partea anterioară" onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={17} /></button>
            {sources.map((source, photoIndex) => (
              <button key={source.id} type="button" role="tab" aria-selected={photoIndex === index} className={photoIndex === index ? "active" : ""} onClick={() => setIndex(photoIndex)}>Partea {photoIndex + 1}</button>
            ))}
            <button type="button" disabled={index === sources.length - 1} aria-label="Partea următoare" onClick={() => setIndex((value) => Math.min(sources.length - 1, value + 1))}><ChevronRight size={17} /></button>
          </div>
        ) : null}
        <p>Fotografia rămâne pe telefon. Nu este trimisă în sincronizarea familiei.</p>
      </section>
    </div>,
    document.body,
  );
}

export function TransactionForm({ data, initial, onSave, onClose }: { data: AppData; initial?: Transaction; onSave: (item: Transaction) => void; onClose: () => void }) {
  const [kind, setKind] = useState<TransactionKind>(initial?.kind || "expense");
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date || isoToday());
  const [memberId, setMemberId] = useState(initial?.memberId || data.settings.members.find((member) => member.name === initial?.person)?.id || data.settings.members[0]?.id || "");
  const [sourceId, setSourceId] = useState(initial?.sourceId || data.settings.paymentSources.find((source) => source.name === initial?.source)?.id || data.settings.paymentSources[0]?.id || "");
  const [category, setCategory] = useState(initial?.category || "Alimente");
  const [allocationId, setAllocationId] = useState(initial?.allocationId || "outside");
  const [allocationChoiceTouched, setAllocationChoiceTouched] = useState(Boolean(initial));
  const [note, setNote] = useState(initial?.note || "");
  const [error, setError] = useState(""); const envelopeCandidates = kind === "expense" ? matchingAllocationsForExpense(data, { category, memberId, sourceId }) : []; const envelopeCandidateIds = envelopeCandidates.map((item) => item.id).join("|"); const matchedEnvelope = allocationId === "outside" ? undefined : envelopeCandidates.find((allocation) => allocation.id === allocationId); const sourceOwner = (source: AppData["settings"]["paymentSources"][number]) => data.settings.members.find((member) => member.id === source.memberId)?.name || "Comun"; const allocationMember = matchedEnvelope ? data.settings.members.find((member) => member.id === matchedEnvelope.memberId)?.name || "Familie / comun" : ""; const editedAlreadyInEnvelope = Boolean(matchedEnvelope && initial?.id && initial.allocationId === matchedEnvelope.id); const envelopeSpent = matchedEnvelope ? Math.max(0, allocationSpent(data, matchedEnvelope) - (editedAlreadyInEnvelope ? initial?.amount || 0 : 0)) : 0; const envelopeRemaining = matchedEnvelope ? allocationBudget(data, matchedEnvelope) - envelopeSpent : 0; const matchedWeek = matchedEnvelope && matchedEnvelope.weeklyPace !== false ? allocationWeekStatus(data, matchedEnvelope, date) : undefined; const initialInsideMatchedWeek = Boolean(initial && initial.date && matchedWeek && initial.date >= matchedWeek.start && initial.date <= matchedWeek.end); const adjustedWeekSpent = matchedWeek ? Math.max(0, matchedWeek.spent - (editedAlreadyInEnvelope && initialInsideMatchedWeek ? initial?.amount || 0 : 0)) : 0; const weekRemaining = matchedWeek ? matchedWeek.budget - adjustedWeekSpent : 0; const proposedAmount = parseRomanianAmount(amount); const envelopeAfter = envelopeRemaining - proposedAmount; const weekAfter = weekRemaining - proposedAmount;
  useEffect(() => {
    if (kind !== "expense") { if (allocationId !== "outside") setAllocationId("outside"); return; }
    const currentIsValid = allocationId !== "outside" && envelopeCandidates.some((allocation) => allocation.id === allocationId);
    if (!currentIsValid && allocationId !== "outside") setAllocationId(envelopeCandidates[0]?.id || "outside");
    if (!allocationChoiceTouched && allocationId === "outside" && envelopeCandidates[0]) setAllocationId(envelopeCandidates[0].id);
  }, [allocationChoiceTouched, allocationId, envelopeCandidateIds, kind]);
  const save = () => {
    const numeric = parseRomanianAmount(amount);
    const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    const member = data.settings.members.find((item) => item.id === memberId);
    if (!title.trim()) return setError("Scrie o denumire pentru mișcare.");
    if (!numeric || numeric <= 0) return setError("Introdu o sumă mai mare decât zero.");
    if (!source || !member || !date) return setError("Alege data, membrul și sursa de plată.");
    if (kind === "expense" && allocationId !== "outside" && !matchedEnvelope) return setError("Plicul ales nu mai corespunde categoriei, membrului sau sursei. Alege din nou.");
    onSave({ id: initial?.id || newId("tx"), title: title.trim(), amount: numeric, kind, category: kind === "income" ? "Venit" : category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date, note: note.trim() || undefined, allocationId: kind === "expense" ? allocationId : undefined, createdAt: initial?.createdAt || new Date().toISOString(), receiptId: initial?.receiptId });
    onClose();
  };
  return <Modal title={initial ? "Corectează mișcarea" : "Adaugă mișcare"} onClose={onClose}><div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>Cheltuială</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>Venit</button></div><div className="bf-form-grid"><Field label="Denumire"><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ex. Cumpărături Lidl" /></Field><Field label="Sumă (lei)"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field><Field label="Data"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Cine a făcut mișcarea"><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={kind === "income" ? "Încasat în" : "Plătit din (sursa reală)"}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {sourceOwner(source)} · {money(sourceBalance(data, source.id))}</option>)}</select></Field>{kind === "expense" && <Field label="Categorie"><select value={category} onChange={(event) => setCategory(event.target.value)}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item}>{item}</option>)}</select></Field>}</div>{kind === "expense" && <section className="bf-envelope-choice"><div><p className="bf-kicker">BUGET REPARTIZAT</p><h3>Plicul compatibil este ales automat.</h3><p>Categoria, membrul și sursa reală găsesc plicul potrivit. Poți alege alt plic sau plată în afara plicurilor.</p></div><Field label="Plic de consum"><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}><option value="outside">În afara plicurilor — nu consumă buget repartizat</option>{envelopeCandidates.map((allocation) => { const owner = data.settings.members.find((member) => member.id === allocation.memberId)?.name || "Familie / comun"; const source = data.settings.paymentSources.find((item) => item.id === allocation.sourceId); const remaining = Math.max(0, allocationBudget(data, allocation) - allocationSpent(data, allocation)); const week = allocation.weeklyPace === false ? undefined : allocationWeekStatus(data, allocation, date); return <option key={allocation.id} value={allocation.id}>{allocation.label} · {owner} · {source?.name || "orice sursă"} · {week ? `${money(Math.max(0, week.remaining))} în S${week.index}` : money(remaining)}</option>; })}</select></Field>{!envelopeCandidates.length && <small className="bf-envelope-empty">Nu există un plic pentru această combinație de categorie, membru și sursă. Poți înregistra cheltuiala în afara plicurilor sau crea unul în Plan.</small>}</section>}{matchedEnvelope ? <section className={`bf-envelope-match ${envelopeAfter < 0 || (matchedWeek && weekAfter < 0) ? "over" : ""}`}><p>{matchedWeek ? "SE VA LUA DIN PLICUL SĂPTĂMÂNII ACTIVE" : "SE VA LUA DIN PLIC"}</p><b>{matchedEnvelope.label} · {allocationMember} · {data.settings.paymentSources.find((source) => source.id === matchedEnvelope.sourceId)?.name || "sursa aleasă"}</b>{matchedWeek ? <span>S{matchedWeek.index}: {money(Math.max(0, weekRemaining))} rămași din {money(matchedWeek.budget)}{proposedAmount > 0 ? weekAfter < 0 ? ` · depășești tranșa cu ${money(Math.abs(weekAfter))}` : ` · după plată rămân ${money(weekAfter)}` : ""}</span> : <span>{money(Math.max(0, envelopeRemaining))} rămași din limita ajustată de {money(allocationBudget(data, matchedEnvelope))}</span>}{matchedEnvelope.note && <small>{matchedEnvelope.note}</small>}</section> : kind === "expense" && <section className="bf-envelope-match outside"><p>PLATĂ ÎN AFARA PLICURILOR</p><b>Va scădea doar soldul sursei reale de plată.</b><span>Nu consumă nicio limită repartizată pentru categorii.</span></section>}<Field label="Notiță opțională"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ex. cursă taxi, traseu, persoană, motiv" /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> Salvează mișcarea</button></Modal>;
}

export function GoalForm({ data, type, item, onSave, onClose }: { data: AppData; type: "debt" | "saving"; item?: Debt | SavingsGoal; onSave: (item: Debt | SavingsGoal) => void; onClose: () => void }) {
  const saving = type === "saving"; const old = item as SavingsGoal | undefined; const oldDebt = item as Debt | undefined;
  const [name, setName] = useState(item?.name || ""); const [one, setOne] = useState(item ? String(saving ? old?.current ?? 0 : oldDebt?.remaining ?? 0) : ""); const [two, setTwo] = useState(item ? String(saving ? old?.target ?? 0 : oldDebt?.monthly ?? 0) : ""); const [date, setDate] = useState(item?.dueDate || ""); const [memberId, setMemberId] = useState(item?.memberId || ""); const [error, setError] = useState("");
  const save = () => { const first = parseRomanianAmount(one); const second = parseRomanianAmount(two); if (!name.trim() || first < 0 || second < 0 || (saving && second <= 0)) return setError("Completează numele și sumele corecte."); if (saving) onSave({ id: item?.id || newId("goal"), name: name.trim(), current: first, target: second, due: date ? dateText(date, true) : "Fără termen", dueDate: date || undefined, memberId: memberId || undefined, tone: old?.tone || "honey" }); else onSave({ id: item?.id || newId("debt"), name: name.trim(), remaining: first, monthly: second, due: date ? dateText(date, true) : "Nespecificat", dueDate: date || undefined, memberId: memberId || undefined, tone: oldDebt?.tone || "coral" }); onClose(); };
  return <Modal title={saving ? "Obiectiv de economisire" : "Datorie sau rată"} onClose={onClose}><div className="bf-form-grid"><Field label={saving ? "Pentru ce economisiți?" : "Denumire"}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={saving ? "ex. Fond de siguranță" : "ex. Credit bancar"} /></Field><Field label="Aparține de"><select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Familie / comun</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={saving ? "Strâns până acum (lei)" : "Sold rămas (lei)"}><input value={one} onChange={(event) => setOne(event.target.value)} inputMode="decimal" /></Field><Field label={saving ? "Țintă (lei)" : "Rată lunară (lei)"}><input value={two} onChange={(event) => setTwo(event.target.value)} inputMode="decimal" /></Field><Field label={saving ? "Data țintă" : "Scadență"}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> Salvează</button></Modal>;
}

export function DebtPaymentForm({ data, debt, onSave, onClose }: { data: AppData; debt: Debt; onSave: (data: AppData) => void; onClose: () => void }) {
  const defaultMemberId = debt.memberId || data.settings.members[0]?.id || ""; const [amount, setAmount] = useState(String(Math.min(debt.monthly || debt.remaining, debt.remaining))); const [date, setDate] = useState(isoToday()); const [memberId, setMemberId] = useState(defaultMemberId); const paymentSources = data.settings.paymentSources.filter((source) => !source.memberId || source.memberId === memberId); const [sourceId, setSourceId] = useState(data.settings.paymentSources.find((source) => source.memberId === defaultMemberId)?.id || data.settings.paymentSources.find((source) => !source.memberId)?.id || data.settings.paymentSources[0]?.id || ""); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const pay = () => { const value = parseRomanianAmount(amount); if (value <= 0) return setError("Introdu o sumă mai mare decât zero."); if (value > debt.remaining) return setError(`Poți plăti cel mult ${money(debt.remaining)} pentru această datorie.`); const next = recordDebtPayment(data, { debtId: debt.id, amount: value, sourceId, memberId, date, note }); if (!next) return setError("Alege un membru și o sursă de plată valide."); if (!window.confirm(`Confirmi plata de ${money(value)} pentru „${debt.name}”? Soldul datoriei va deveni ${money(debt.remaining - value)}.`)) return; onSave(next); onClose(); };
  const ownerName = (sourceId: string) => data.settings.members.find((member) => member.id === data.settings.paymentSources.find((source) => source.id === sourceId)?.memberId)?.name || "Comun";
  return <Modal title={`Plătește rata · ${debt.name}`} onClose={onClose}><section className="bf-debt-payment-intro"><p className="bf-kicker">MIȘCARE REALĂ + DATORIE</p><p>Plata este adăugată în Jurnal și scade aceeași sumă din soldul rămas. Nu pornește plăți bancare automate.</p><strong>{money(debt.remaining)} rămași</strong></section><div className="bf-form-grid"><Field label="Sumă plătită (lei)"><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></Field><Field label="Data plății"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Membru"><select value={memberId} onChange={(event) => { const nextMember = event.target.value; setMemberId(nextMember); const firstSource = data.settings.paymentSources.find((source) => !source.memberId || source.memberId === nextMember); if (firstSource) setSourceId(firstSource.id); }}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Plătit din"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {ownerName(source.id)} · {money(sourceBalance(data, source.id))}</option>)}</select></Field></div><Field label="Notiță opțională"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ex. rata august, plată parțială" /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={pay}><Check size={17} /> Confirmă plata ratei</button></Modal>;
}
export function DebtPaymentHistory({ data, debt }: { data: AppData; debt: Debt }) { const history = debtPaymentHistory(data, debt.id); if (!history.length) return <p className="bf-debt-history empty">Nu există încă plăți confirmate pentru această datorie.</p>; return <div className="bf-debt-history"><p>PLĂȚI ÎNREGISTRATE</p>{history.slice(0, 4).map((payment) => <div key={payment.id}><span><b>{payment.title.includes("achitată integral") ? "Achitată integral" : "Plată parțială"}</b><small>{dateText(payment.date, true)} · {payment.source}</small></span><span><strong>{money(payment.amount)}</strong><small>rămân {money(payment.debtRemainingAfter ?? debt.remaining)}</small></span></div>)}</div>; }

/** Atelierul Financiar 3.0 — obligațiile devin o axă de protejat: datorii, plăți confirmate, economii și scadențe. */
export function SpendingHabitsView({ data }: { data: AppData }) { const [period, setPeriod] = useState<30 | 90>(90); const [memberId, setMemberId] = useState("family"); const start = new Date(Date.now() - (period - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); const expenses = data.transactions.filter((item) => item.kind === "expense" && item.date >= start && (memberId === "family" || item.memberId === memberId)); const categories = Object.entries(expenses.reduce<Record<string, { total: number; count: number; small: number; recent: number; prior: number }>>((all, item) => { const current = all[item.category] || { total: 0, count: 0, small: 0, recent: 0, prior: 0 }; const amount = Math.max(0, item.amount); const isSmall = amount <= 75; const isRecent = item.date >= new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); return { ...all, [item.category]: { total: current.total + amount, count: current.count + 1, small: current.small + (isSmall ? 1 : 0), recent: current.recent + (isRecent ? amount : 0), prior: current.prior + (!isRecent ? amount : 0) } }; }, {})).map(([name, stats]) => ({ name, ...stats, average: stats.total / stats.count, smallShare: stats.count ? stats.small / stats.count : 0, momentum: stats.prior > 0 ? (stats.recent - stats.prior / Math.max(1, period - 14) * 14) / (stats.prior / Math.max(1, period - 14) * 14) : stats.recent > 0 ? 1 : 0 })).sort((a, b) => b.total - a.total); const signals = categories.filter((item) => item.count >= 3 && item.smallShare >= .55).sort((a, b) => (b.smallShare * b.count) - (a.smallShare * a.count)).slice(0, 4); const biggest = categories[0]; const recentTotal = expenses.filter((item) => item.date >= new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).reduce((sum, item) => sum + item.amount, 0); const previousTotal = expenses.filter((item) => item.date < new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).reduce((sum, item) => sum + item.amount, 0); const change = previousTotal > 0 ? Math.round((recentTotal - previousTotal) / previousTotal * 100) : 0; const members = data.settings.members; return <div className="bf-page bf-habits-workspace"><header className="bf-habits-header"><div><p className="bf-kicker">OBICEIURI DE CHELTUIRE</p><h1>Observă, <em>nu te judeca.</em></h1><p>Tiparele sunt informații. Alege o ajustare mică, nu o pedeapsă mare.</p></div><span><WalletCards size={26} /></span></header><section className="bf-habits-controls"><div className="bf-habits-period" role="group" aria-label="Perioada analizei"><button className={period === 30 ? "active" : ""} onClick={() => setPeriod(30)}>30 zile</button><button className={period === 90 ? "active" : ""} onClick={() => setPeriod(90)}>90 zile</button></div>{members.length > 1 && <select value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label="Perspectiva analizei"><option value="family">Familie</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}</section><section className="bf-habits-pulse"><article><span>Mișcări analizate</span><b>{expenses.length}</b><small>în ultimele {period} de zile</small></article><article><span>Cheltuieli recente</span><b>{money(recentTotal)}</b><small>{change > 0 ? `+${change}% față de ritmul anterior` : change < 0 ? `${change}% față de ritmul anterior` : "ritm apropiat de perioada anterioară"}</small></article><article><span>Semnale blânde</span><b>{signals.length}</b><small>tipare care merită observate</small></article></section><section className="bf-habits-guidance"><div><p className="bf-kicker">O PERSPECTIVĂ MAI BLÂNDĂ</p><h2>{signals.length ? "Nu orice cumpărătură mică este impulsivă." : "Ai nevoie de puțin istoric."}</h2><p>{signals.length ? "Am marcat doar tipare care combină frecvența cu multe sume mici. Verifică-le cu contextul tău înainte să schimbi ceva." : "După câteva mișcări, vei vedea frecvența, categoriile și ritmul fără să fie nevoie de presupuneri."}</p></div><span><Check size={20} /></span></section><section className="bf-habits-signals"><div className="bf-section-heading"><div><p className="bf-kicker">POSIBILE CUMPĂRĂTURI IMPULSIVE</p><h2>Ce merită observat</h2></div><AlertTriangle size={19} /></div>{signals.length ? <div className="bf-habits-signal-list">{signals.map((item) => { const gentleCut = Math.round(item.total * .1); return <article key={item.name}><span className="bf-habits-signal-icon"><AlertTriangle size={16} /></span><div><b>{item.name}</b><small>{item.count} mișcări · {Math.round(item.smallShare * 100)}% sume mici · medie {money(item.average)}</small><p>Încearcă un plafon de <strong>{money(Math.max(0, item.total - gentleCut))}</strong> pentru următoarea perioadă, doar dacă se potrivește realității tale.</p></div><strong>{money(item.total)}</strong></article>; })}</div> : <div className="bf-habits-empty"><Check size={22} /><p>Nu am găsit tipare suficient de clare pentru a sugera o ajustare. Asta este un rezultat bun: nu forțăm o concluzie.</p></div>}</section><section className="bf-habits-adjustments"><div className="bf-section-heading"><div><p className="bf-kicker">AJUSTĂRI BLÂNDE</p><h2>Idei de încercat</h2></div><PiggyBank size={19} /></div><div className="bf-habits-adjustment-grid"><article><span>01</span><div><b>Pauza de o zi</b><p>Pentru cumpărăturile neplanificate, salvează ideea și revino mâine. Nu este interdicție; este spațiu pentru o alegere mai liniștită.</p></div></article><article><span>02</span><div><b>Un plafon flexibil</b><p>Alege o sumă mică pentru categoria care apare des și verifică săptămânal cum te simți cu ea.</p></div></article><article><span>03</span><div><b>Mută, nu tăia</b><p>Dacă o categorie este importantă, mută bani dintr-un plic mai puțin folosit în loc să elimini complet plăcerea.</p></div></article></div></section><p className="bf-habits-privacy">Analiza se face local, din mișcările introduse de tine. Este un instrument orientativ, nu un diagnostic și nu modifică automat bugetul.</p></div>; }

export function SavingsScenarioSimulator({ data }: { data: AppData }) { const goals = data.savings; const [goalId, setGoalId] = useState(goals[0]?.id || ""); const selected = goals.find((item) => item.id === goalId) || goals[0]; const [inflation, setInflation] = useState(3); const [incomeChange, setIncomeChange] = useState(0); const [months, setMonths] = useState(24); const referenceIncome = Math.max(0, data.transactions.filter((item) => item.kind === "income" && item.date >= new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).reduce((sum, item) => sum + item.amount, 0) / 3); const current = selected?.current || 0; const target = selected?.target || 0; const baseRemaining = Math.max(0, target - current); const adjustedTarget = target * Math.pow(1 + Math.max(-99, inflation) / 100, months / 12); const scenarioIncome = referenceIncome * (1 + incomeChange / 100); const requiredMonthly = Math.max(0, adjustedTarget - current) / Math.max(1, months); const coverage = scenarioIncome > 0 ? Math.min(100, Math.round((requiredMonthly / scenarioIncome) * 100)) : 0; const status = requiredMonthly === 0 ? "Obiectiv atins" : scenarioIncome <= 0 ? "Adaugă un venit de referință" : coverage <= 15 ? "Ritm confortabil" : coverage <= 30 ? "Ritm de urmărit" : "Ritm ambițios"; if (!goals.length) return null; return <section className="bf-scenario-card" aria-labelledby="scenario-title"><div className="bf-scenario-heading"><div><p className="bf-kicker">SCENARIU DE ECONISIRE</p><h2 id="scenario-title">Privește înainte, <em>fără presiune.</em></h2><p>Testează un posibil viitor fără să schimbi planul real.</p></div><span><Goal size={21} /></span></div><div className="bf-scenario-fields"><label><span>Obiectiv</span><select value={selected?.id || ""} onChange={(event) => setGoalId(event.target.value)}>{goals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Inflație anuală</span><input type="number" min="-10" max="30" step="0.5" value={inflation} onChange={(event) => setInflation(Math.max(-10, Math.min(30, Number(event.target.value) || 0)))} /><small>Scumpește ținta în timp</small></label><label><span>Schimbare venit</span><input type="number" min="-90" max="200" step="1" value={incomeChange} onChange={(event) => setIncomeChange(Math.max(-90, Math.min(200, Number(event.target.value) || 0)))} /><small>Față de media locală</small></label><label><span>Orizont</span><input type="number" min="1" max="240" step="1" value={months} onChange={(event) => setMonths(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} /><small>luni până la țintă</small></label></div><div className="bf-scenario-result"><div><p className="bf-kicker">PROIECȚIA SCENARIULUI</p><strong>{money(requiredMonthly)}</strong><span>contribuție lunară estimată</span></div><div className="bf-scenario-metrics"><span><b>{money(adjustedTarget)}</b><small>țintă ajustată</small></span><span><b>{money(scenarioIncome)}</b><small>venit scenariu</small></span><span><b>{coverage}%</b><small>din venit</small></span></div></div><div className={`bf-scenario-status ${coverage > 30 ? "watch" : coverage > 15 ? "attention" : "calm"}`}><span><Check size={15} /></span><div><b>{status}</b><small>{baseRemaining > 0 ? `Pentru „${selected?.name}”, inflația de ${inflation}% ar ridica ținta cu ${money(Math.max(0, adjustedTarget - target))} în acest orizont.` : "Nu mai există sumă de construit pentru acest obiectiv."}</small></div></div><p className="bf-scenario-note">Calcul orientativ, fără randament sau dobândă. Simularea este temporară și nu modifică obiectivul, veniturile sau tranzacțiile reale.</p></section>; }

export function LongTermGoalsView({ data, onOpen, onEdit, onDelete }: { data: AppData; onOpen: () => void; onEdit: (item: SavingsGoal) => void; onDelete: (id: string) => void }) { const goals = data.savings; const totalTarget = goals.reduce((sum, item) => sum + Math.max(0, item.target), 0); const totalCurrent = goals.reduce((sum, item) => sum + Math.min(Math.max(0, item.current), Math.max(0, item.target)), 0); const totalRemaining = Math.max(0, totalTarget - totalCurrent); const activeGoals = goals.filter((item) => item.target > item.current); const datedGoals = activeGoals.filter((item) => item.dueDate); const suggestedMonthly = datedGoals.reduce((sum, item) => { const months = Math.max(1, Math.ceil((new Date(item.dueDate!).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))); return sum + Math.max(0, item.target - item.current) / months; }, 0); return <div className="bf-page bf-goals-workspace"><header className="bf-goals-header"><div><p className="bf-kicker">OBIECTIVE PE TERMEN LUNG</p><h1>Construiește <em>cu liniște.</em></h1><p>Un obiectiv bun îți arată direcția, nu îți cere să te grăbești.</p></div><span><PiggyBank size={26} /></span></header><section className="bf-goals-overview"><div><p className="bf-kicker">PROGRESUL CASEI</p><strong>{totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%</strong><span>{money(totalCurrent)} strânși din {money(totalTarget)}</span></div><div className="bf-goals-overview-stats"><span><b>{money(totalRemaining)}</b><small>de construit</small></span><span><b>{money(suggestedMonthly)}</b><small>recomandat / lună</small></span></div></section><section className="bf-goals-guidance"><span><Check size={17} /></span><div><b>{activeGoals.length ? "Un ritm mic ține direcția vie." : "Alege un obiectiv care contează."}</b><small>{activeGoals.length ? "Nu trebuie să alimentezi toate obiectivele în fiecare lună. Prioritizează ce este cel mai aproape de tine." : "Fond de siguranță, o vacanță, o casă sau un plan personal — începe cu ce îți aduce claritate."}</small></div></section><SavingsScenarioSimulator data={data} /><section className="bf-goals-list"><div className="bf-section-heading"><div><p className="bf-kicker">OBIECTIVELE TALE</p><h2>Pas cu pas</h2></div><button className="bf-primary" onClick={onOpen}><Plus size={16} /> Obiectiv nou</button></div>{goals.length ? <div className="bf-goals-grid">{goals.map((goal) => { const progress = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0; const remaining = Math.max(0, goal.target - goal.current); const months = goal.dueDate ? Math.max(1, Math.ceil((new Date(goal.dueDate).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))) : undefined; const monthly = months ? remaining / months : undefined; return <article className={`bf-goal-card ${goal.tone}`} key={goal.id}><div className="bf-goal-card-top"><span className="bf-goal-mark"><PiggyBank size={17} /></span><span><b>{goal.name}</b><small>{goal.dueDate ? `Până la ${formatDate(goal.dueDate, { day: "2-digit", month: "short" })}` : goal.due || "Fără termen ales"}</small></span><strong>{progress}%</strong></div><div className="bf-goal-progress"><i style={{ width: `${progress}%` }} /></div><div className="bf-goal-card-values"><span><b>{money(goal.current)}</b><small>strânși</small></span><span><b>{money(remaining)}</b><small>rămași</small></span>{monthly !== undefined && <span><b>{money(monthly)}</b><small>ritm lunar</small></span>}</div><div className="bf-goal-card-actions"><button onClick={() => onEdit(goal)}><Pencil size={14} /> Editează</button><button className="delete" aria-label={`Șterge obiectivul ${goal.name}`} onClick={() => onDelete(goal.id)}><Trash2 size={15} /></button></div></article>; })}</div> : <div className="bf-goals-empty"><PiggyBank size={28} /><h2>Nu ai încă un obiectiv pe termen lung.</h2><p>Începe cu o țintă simplă și lasă aplicația să-ți arate un ritm posibil.</p><button className="bf-primary" onClick={onOpen}><Plus size={16} /> Creează primul obiectiv</button></div>}</section></div>; }

export function ObjectivesView({ data, onEditDebt, onEditSaving, onPayDebt, onDeleteDebt, onDeleteSaving, openDebt, openSaving, onOpenRecurring, onPayRecurring, onOpenGoals, onOpenCalendar }: { data: AppData; onEditDebt: (item: Debt) => void; onEditSaving: (item: SavingsGoal) => void; onPayDebt: (item: Debt) => void; onDeleteDebt: (id: string) => void; onDeleteSaving: (id: string) => void; openDebt: () => void; openSaving: () => void; onOpenRecurring: () => void; onPayRecurring: (id: string) => void; onOpenGoals: () => void; onOpenCalendar: () => void }) {
  const totalDebt = data.debts.reduce((sum, item) => sum + item.remaining, 0); const totalSavings = data.savings.reduce((sum, item) => sum + item.current, 0); const monthlyRates = data.debts.reduce((sum, item) => sum + item.monthly, 0); const snowball = debtSnowball(data); const rankedDebts = snowball.order.length ? [...snowball.order.map((item) => item.debt), ...data.debts.filter((item) => item.remaining <= 0)] : data.debts;
  const upcoming = [
    ...data.debts.filter((item) => item.dueDate).map((item) => ({ id: `debt-${item.id}`, date: item.dueDate!, label: item.name, detail: `Rată ${money(item.monthly)}/lună`, amount: item.remaining, onConfirm: () => onPayDebt(item) })),
    ...data.savings.filter((item) => item.dueDate).map((item) => ({ id: `saving-${item.id}`, date: item.dueDate!, label: item.name, detail: "Obiectiv", amount: item.target, onConfirm: onOpenGoals })),
    ...pendingRecurringInPlan(data).map((item) => ({ id: `recurring-${item.id}`, date: item.dueDate, label: item.name, detail: item.category, amount: item.amount, onConfirm: () => onPayRecurring(item.id) })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  return <div className="bf-page bf-obligations-workspace"><header className="bf-obligations-header"><div><p className="bf-kicker">OBLIGAȚII ȘI REZERVE</p><h1>Ce trebuie <em>protejat.</em></h1><p>Ratele devin mișcări doar după confirmare. Economiile rămân distincte de soldurile surselor.</p></div><div className="bf-obligations-links"><button className="bf-goals-link" onClick={onOpenGoals}><PiggyBank size={16} /> Obiective pe termen lung</button><button className="bf-goals-link" onClick={onOpenCalendar}><CalendarDays size={16} /> Calendar de scadențe</button></div></header><DebtSnowballCard data={data} onPay={onPayDebt} /><section className="bf-obligation-timeline"><div className="bf-section-heading"><div><p className="bf-kicker">URMEAZĂ</p><h2>Următoarele scadențe</h2></div></div>{upcoming.length ? <div className="bf-obligation-timeline-list">{upcoming.map((entry) => <article className="bf-obligation-entry" key={entry.id}><div className="bf-obligation-entry-main"><span><BellRing size={17} /></span><div><b>{entry.label}</b><small>{dateText(entry.date, true)} · {entry.detail}</small></div><strong>{money(entry.amount)}</strong></div><div className="bf-obligation-entry-actions"><button className="pay" onClick={entry.onConfirm}><Check size={16} /> Confirmă plata</button></div></article>)}</div> : <div className="bf-obligation-empty"><span><b>Nu ai scadențe apropiate.</b><small>Adaugă o dată la datorii sau o scadență recurentă pentru a le vedea aici.</small></span></div>}</section><section className="bf-obligation-ledger"><article className="debt"><span>Sold datorii</span><b>{money(totalDebt)}</b><small>{money(monthlyRates)} rate declarate / lună</small></article><article className="savings"><span>Economii urmărite</span><b>{money(totalSavings)}</b><small>{data.savings.length} obiective înregistrate</small></article><button onClick={onOpenRecurring}><CalendarClock size={18} /><span>Scadențe programate</span><b>{data.recurring.length}</b><ChevronRight size={16} /></button></section><section className="bf-obligation-actions"><button onClick={openDebt}><Plus size={17} /> Adaugă datorie</button><button onClick={openSaving}><Plus size={17} /> Creează economisire</button></section><div className="bf-obligation-lanes"><section className="bf-obligation-lane debt"><header><div><p className="bf-kicker">DE PLĂTIT</p><h2>Rate și împrumuturi</h2></div><span>{data.debts.length}</span></header>{rankedDebts.map((debt) => <article className={`bf-obligation-entry${snowball.next?.debt.id === debt.id ? " next" : ""}`} key={debt.id}><div className="bf-obligation-entry-main"><span><BellRing size={17} /></span><div><b>{debt.name}</b>{snowball.next?.debt.id === debt.id ? <em className="bf-snowball-tag">01 · următoarea</em> : null}<small>{debt.due} · rată {money(debt.monthly)}/lună</small></div><strong>{money(debt.remaining)}</strong></div><DebtPaymentHistory data={data} debt={debt} /><div className="bf-obligation-entry-actions"><button className="pay" onClick={() => onPayDebt(debt)}><Check size={16} /> Confirmă plata</button><button onClick={() => onEditDebt(debt)}><Pencil size={15} /> Editează</button><button className="delete" aria-label={`Șterge ${debt.name}`} onClick={() => onDeleteDebt(debt.id)}><Trash2 size={16} /></button></div></article>)}{!data.debts.length && <div className="bf-obligation-empty"><BellRing size={21} /><span><b>Nu ai datorii înregistrate.</b><small>Adaugă doar obligațiile pe care vrei să le rezervi în plan.</small></span><button onClick={openDebt}>Adaugă</button></div>}</section><section className="bf-obligation-lane savings"><header><div><p className="bf-kicker">DE CONSTRUIT</p><h2>Economii și obiective</h2></div><span>{data.savings.length}</span></header>{data.savings.map((saving) => <article className="bf-obligation-entry" key={saving.id}><div className="bf-obligation-entry-main"><span><PiggyBank size={17} /></span><div><b>{saving.name}</b><small>{saving.due}</small></div><strong>{money(saving.current)}</strong></div><div className="bf-obligation-progress"><BudgetBar used={saving.current} total={saving.target} tone="gold" /><small>{money(Math.max(0, saving.target - saving.current))} rămași până la {money(saving.target)}</small></div><div className="bf-obligation-entry-actions"><button onClick={() => onEditSaving(saving)}><Pencil size={15} /> Editează</button><button className="delete" aria-label={`Șterge ${saving.name}`} onClick={() => onDeleteSaving(saving.id)}><Trash2 size={16} /></button></div></article>)}{!data.savings.length && <div className="bf-obligation-empty"><PiggyBank size={21} /><span><b>Nu ai obiective de economisire.</b><small>Începe cu fondul de siguranță sau un obiectiv concret.</small></span><button onClick={openSaving}>Creează</button></div>}</section></div></div>;
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
    if (images.length + selected.length > 2) return setError("Un bon poate avea maximum două fotografii. Elimină una înainte de a adăuga alta.");
    try {
      setBusy(true);
      setError("");
      const { compressReceiptImage } = await import("@/lib/receipt-utils");
      const compressed: string[] = [];
      for (const file of selected) {
        compressed.push(await Promise.race([
          compressReceiptImage(file),
          new Promise<string>((_, reject) => window.setTimeout(() => reject(new Error("Poza a durat prea mult. Încearcă din galerie sau salvează bonul fără fotografie.")), 20000)),
        ]));
      }
      setImages((current) => [...current, ...compressed].slice(0, 2));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Poza bonului nu a putut fi procesată. Poți salva cumpărăturile fără fotografie.");
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
        const suggestedLines = result.items.map((item) => ({ id: newId("receipt-line"), category: categories.includes(item.category) ? item.category : "Alimente", amount: String(item.amount).replace(".", ","), label: item.label }));
        setLines(suggestedLines);
        const detectedTotal = result.items.reduce((sum, item) => sum + item.amount, 0);
        const who = result.vendor ? `${result.vendor}, ` : "";
        setOcrSummary(`Am citit ${who}${result.items.length} produs${result.items.length === 1 ? "" : "e"} după reduceri (${fmtExact.format(detectedTotal)}). Verifică categoriile înainte de salvare.`);
      } else if (result.amount) {
        setOcrSummary(`Am citit totalul ${fmtExact.format(result.amount)}${result.vendor ? ` la ${result.vendor}` : ""}, dar produsele nu sunt sigure. Completează magazinul dacă lipsește — fotografia rămâne atașată.`);
      } else {
        setOcrSummary("Nu am citit clar textul de pe bon. Scrie magazinul și totalul; fotografia rămâne atașată și poți salva fără produse separate.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Textul de pe bon nu a putut fi citit.");
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
    if (!vendor.trim() || numeric <= 0 || !sourceId || !memberId) return setError("Completează magazinul, totalul, membrul și sursa. Fotografiile nu sunt obligatorii.");
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
      setError(reason instanceof Error ? reason.message : "Bonul nu a putut fi salvat pe telefon.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Adaugă bon" onClose={onClose}>
      <div className="bf-receipt-body">
        <div className="bf-receipt-intro">
          <p className="bf-kicker">CUMPĂRĂTURI</p>
          <p>Scrie magazinul și totalul, apoi apasă Salvează. Pozele sunt opționale: din galerie sau cu aparatul foto.</p>
        </div>
        <div className="bf-form-grid">
          <Field label="Magazin"><input autoFocus value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="ex. Lidl" /></Field>
          <Field label="Total (lei)"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          <Field label="Data"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Membru"><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
          <Field label="Plătit din"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
        </div>
        <section className="bf-receipt-split">
          <div className="bf-split-heading">
            <div>
              <p className="bf-kicker">PRODUSE ȘI CATEGORII</p>
              <h3>{fmtExact.format(lineTotal)} din {amount ? fmtExact.format(numericTotal) : "0,00 RON"}</h3>
            </div>
            <button type="button" className="bf-secondary" onClick={() => setLines((current) => [...current, { id: newId("receipt-line"), category: "Alimente", amount: "", label: "" }])}><Plus size={16} /> Produs</button>
          </div>
          {lines.map((line) => (
            <div className="bf-split-line" key={line.id}>
              <select aria-label="Categorie bon" value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
              <input aria-label="Preț produs" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" />
              <input aria-label="Produs" value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder="ex. fructe" />
              {lines.length > 1 && <button type="button" aria-label="Elimină produsul" onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}
            </div>
          ))}
          <small>Dacă lași un singur produs gol, totalul se pune automat pe el. Mai multe linii trebuie să însumeze exact totalul bonului.</small>
        </section>
        <section className="bf-receipt-images">
          <div>
            <p className="bf-kicker">FOTOGRAFII OPȚIONALE</p>
            <strong>{images.length}/2 imagini</strong>
          </div>
          <p className="bf-receipt-photo-hint">Pozele rămân pe telefon. Nu sunt obligatorii — poți salva magazinul și totalul fără ele.</p>
          <div className="bf-receipt-photo-actions">
            <label className="bf-upload-control gallery">
              <Images size={18} /> {busy && !progress ? "Comprimăm…" : "Din galerie"}
              <input type="file" accept="image/*" multiple disabled={busy || photosFull} onChange={(event) => { void pick(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            <label className="bf-upload-control camera">
              <Camera size={18} /> Fotografiază
              <input type="file" accept="image/*" capture="environment" disabled={busy || photosFull} onChange={(event) => { void pick(event.target.files); event.currentTarget.value = ""; }} />
            </label>
          </div>
          {images.length > 0 && <button type="button" className="bf-ocr-button" disabled={busy} onClick={() => void scan()}><Bot size={17} /> {busy && progress ? `Citim ${progress}%` : "Citește produsele și prețurile local"}</button>}
          <div className="bf-receipt-preview-grid">{images.map((image, index) => <figure key={`${index}-${image.slice(-24)}`}><img src={image} alt={`Previzualizare bon partea ${index + 1}`} width={280} height={140} loading="lazy" decoding="async" /><button type="button" aria-label={`Elimină fotografia ${index + 1}`} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}><X size={15} /></button></figure>)}</div>
          {ocrSummary && <p className="bf-ocr-info" role="status"><Bot size={16} /> {ocrSummary}</p>}
        </section>
        {ocrText ? <Field label="Text citit local (verifică înainte de salvare)"><textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field> : <Field label="Produse / notiță"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ex. apă, fructe, detergent" /></Field>}
      </div>
      <div className="bf-receipt-save">
        {error && <p className="bf-form-error" role="alert">{error}</p>}
        <button type="button" className="bf-primary full" disabled={busy} onClick={() => void save()}><Check size={17} /> Salvează bonul</button>
      </div>
    </Modal>
  );
}

export function MoreView({ tab, setTab, data, onChange, onAddReceipt, onDeleteReceipt, onOpenDebt, onOpenSaving, onOpenCalendar, receiptStorageNotice, sync }: { tab: MoreView; setTab: (value: MoreView) => void; data: AppData; onChange: (value: AppData) => void; onAddReceipt: () => void; onDeleteReceipt: (id: string) => void; onOpenDebt: () => void; onOpenSaving: () => void; onOpenCalendar: () => void; receiptStorageNotice?: string; sync: SyncPanelProps }) {
  const isCollaborative = data.settings.members.length > 1; const tabs: { id: MoreView; label: string; icon: typeof SlidersHorizontal }[] = [{ id: "overview", label: "Instrumente", icon: MoreHorizontal }, { id: "debts", label: "Datorii", icon: BellRing }, { id: "savings", label: "Economii", icon: PiggyBank }, { id: "receipts", label: "Bonuri", icon: ReceiptText }, { id: "recurring", label: "Scadențe", icon: CalendarDays }, { id: "reports", label: "Statistici", icon: LayoutDashboard }, { id: "assistant", label: "Asistent", icon: Bot }, { id: "settings", label: "Setări", icon: Settings }, { id: "sync", label: "Sync", icon: Cloud }, { id: "guide", label: "Ghid", icon: BookOpen }];
  const setSettings = (patch: Partial<AppData["settings"]>) => onChange({ ...data, settings: { ...data.settings, ...patch } });
  const content = () => {
    if (tab === "overview") return <div className="bf-more-grid"><button onClick={() => setTab("debts")}><BellRing size={20} /><b>Datorii</b><span>{data.debts.length} active</span></button><button onClick={() => setTab("savings")}><PiggyBank size={20} /><b>Economii</b><span>{data.savings.length} obiective</span></button><button onClick={() => setTab("receipts")}><ReceiptText size={20} /><b>Bonuri</b><span>{data.receipts.length} salvate</span></button><button onClick={() => setTab("recurring")}><CalendarClock size={20} /><b>Scadențe</b><span>{data.recurring.length} programate</span></button><button onClick={() => setTab("reports")}><LayoutDashboard size={20} /><b>Statistici</b><span>istoric și categorii</span></button><button onClick={() => setTab("assistant")}><Bot size={20} /><b>Asistent</b><span>explică datele</span></button><button onClick={() => setTab("settings")}><Settings size={20} /><b>{isCollaborative ? "Setări familie" : "Setări profil"}</b><span>{isCollaborative ? "membri și surse" : "surse și categorii"}</span></button><button onClick={() => setTab("sync")}><Cloud size={20} /><b>Sincronizare</b><span>{isCollaborative ? "spațiu conectat" : "opțională între telefoane"}</span></button><button onClick={() => setTab("guide")}><BookOpen size={20} /><b>Manual</b><span>configurare și utilizare</span></button><button onClick={onOpenCalendar}><CalendarDays size={20} /><b>Calendar</b><span>scadențe și obiective</span></button></div>;
    if (tab === "debts") return <div className="bf-more-list"><button className="bf-primary bf-inline-add" onClick={onOpenDebt}><Plus size={16} /> Adaugă datorie</button>{data.debts.map((debt) => <article key={debt.id}><span><b>{debt.name}</b><small>{debt.due}</small></span><strong>{money(debt.remaining)}</strong><em>{money(debt.monthly)}/lună</em></article>)}{!data.debts.length && <div className="bf-empty-state slim"><BellRing size={23} /><h2>Nicio datorie</h2></div>}</div>;
    if (tab === "savings") return <div className="bf-more-list"><button className="bf-primary bf-inline-add" onClick={onOpenSaving}><Plus size={16} /> Creează obiectiv</button>{data.savings.map((saving) => <article key={saving.id}><span><b>{saving.name}</b><small>{saving.due}</small></span><strong>{money(saving.current)}</strong><BudgetBar used={saving.current} total={saving.target} tone="gold" /></article>)}{!data.savings.length && <div className="bf-empty-state slim"><PiggyBank size={23} /><h2>Niciun obiectiv</h2></div>}</div>;
    if (tab === "receipts") return <div>{receiptStorageNotice && <p className="bf-notice" role="status"><ShieldCheck size={15} /> {receiptStorageNotice}</p>}<button className="bf-primary bf-inline-add" onClick={onAddReceipt}><ReceiptText size={17} /> Adaugă bon</button><div className="bf-receipt-list">{data.receipts.map((receipt) => <article key={receipt.id}><ReceiptThumbnail receipt={receipt} /><div><b>{receipt.vendor}</b><small>{dateText(receipt.date)} · {receipt.lines?.length || 1} categorie{(receipt.lines?.length || 1) === 1 ? "" : "i"}</small><p>{receipt.lines?.map((line) => `${line.category}: ${money(line.amount)}`).join(" · ") || receipt.note || "Fără detalii"}</p>{(receipt.imageKeys?.length || (receipt.imageData2 ? 2 : receipt.imageData ? 1 : 0)) > 1 && <small>Bon în două fotografii</small>}</div><strong>{money(receipt.amount)}</strong><button aria-label={`Șterge bonul ${receipt.vendor}`} onClick={() => onDeleteReceipt(receipt.id)}><Trash2 size={16} /></button></article>)}{!data.receipts.length && <div className="bf-empty-state slim"><ReceiptText size={23} /><h2>Niciun bon</h2><p>Adaugă magazinul și totalul. Fotografiile sunt opționale; fiecare categorie creează o cheltuială legată de același bon.</p></div>}</div></div>;
    if (tab === "recurring") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim scadențele…</div>}><RecurringPanel data={data} onChange={onChange} /></Suspense>;
    if (tab === "reports") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim statisticile…</div>}><ReportsPanel data={data} /></Suspense>;
    if (tab === "assistant") return <Suspense fallback={<div className="bf-lazy-panel">Pregătim asistentul…</div>}><AdvisorPanel data={data} /></Suspense>;
    if (tab === "settings") return <SettingsPanel data={data} onChange={onChange} onReset={() => { if (!window.confirm("Ștergi toate datele locale de pe acest dispozitiv?")) return; void clearReceiptImageStorage(); onChange(createEmptyAppData()); }} />;
    if (tab === "guide") return <FamilyGuide />;
    return <SyncPanel {...sync} />;
  };
  return <div className="bf-page bf-utilities-workspace"><header className="bf-topline compact"><div><p className="bf-kicker">INSTRUMENTE</p><h1>Alege un <em>instrument.</em></h1></div></header><div className="bf-more-tab-region"><p className="bf-more-swipe-hint" aria-hidden="true">Glisează pentru mai multe</p><div className="bf-more-tabs" role="tablist" aria-label="Categorii de instrumente">{tabs.map((item) => { const Icon = item.icon; return <button role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon size={16} /> {item.label}</button>; })}</div></div>{content()}</div>;
}

export function SettingsPanel({ data, onChange, onReset }: { data: AppData; onChange: (value: AppData) => void; onReset: () => void }) {
  const importBackup = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; void file.text().then((raw) => { const backup = parseBackup(raw); if (!window.confirm(`Înlocuiești datele locale cu backup-ul din ${new Date(backup.exportedAt).toLocaleDateString("ro-RO")}?`)) return; onChange(normalizeAppData(backup.data)); }).catch((reason) => window.alert(reason instanceof Error ? reason.message : "Backup-ul nu a putut fi importat.")); event.target.value = ""; };
  const [member, setMember] = useState(""); const [source, setSource] = useState(""); const [kind, setKind] = useState<PaymentKind>("card"); const [owner, setOwner] = useState(data.settings.members[0]?.id || ""); const [category, setCategory] = useState("");
  const settings = data.settings; const change = (patch: Partial<typeof settings>) => onChange({ ...data, settings: { ...settings, ...patch } });
  const addMember = () => { if (!member.trim()) return; if (settings.members.some((item) => item.name.toLowerCase() === member.trim().toLowerCase())) return; change({ members: [...settings.members, { id: newId("member"), name: member.trim() }] }); setMember(""); };
  const addSource = () => { if (!source.trim()) return; change({ paymentSources: [...settings.paymentSources, { id: newId("source"), name: source.trim(), kind, memberId: kind === "transfer" ? undefined : owner, openingBalance: 0 }] }); setSource(""); };
  return <div className="bf-settings"><section><p className="bf-kicker">FAMILIE</p><Field label="Numele familiei"><input value={settings.familyName} onChange={(event) => change({ familyName: event.target.value })} /></Field><Field label="Numele tău"><input value={settings.memberName} onChange={(event) => change({ memberName: event.target.value })} /></Field><Field label="Cod local de familie" hint="Codul ajută la verificarea exportului manual."><input value={settings.familyCode} onChange={(event) => change({ familyCode: event.target.value.toUpperCase() })} /><button className="bf-link-button" onClick={() => change({ familyCode: createFamilyCode() })}><RotateCcw size={14} /> Cod nou</button></Field></section><section><p className="bf-kicker">MEMBRI</p><div className="bf-chip-list">{settings.members.map((item) => <span key={item.id}>{item.name}{settings.members.length > 1 && <button onClick={() => change({ members: settings.members.filter((memberItem) => memberItem.id !== item.id) })}><X size={14} /></button>}</span>)}</div><div className="bf-mini-form"><input value={member} onChange={(event) => setMember(event.target.value)} placeholder="ex. Soția" /><button onClick={addMember}>Adaugă</button></div></section><section><p className="bf-kicker">SURSE ȘI SOLD INITIAL</p>{settings.paymentSources.map((item) => <div className="bf-source-edit" key={item.id}><span><b>{item.name}</b><small>{sourceKindName[item.kind]} · {settings.members.find((memberItem) => memberItem.id === item.memberId)?.name || "Comun"}</small></span><label><small>Sold inițial</small><input inputMode="decimal" value={String(item.openingBalance)} onChange={(event) => change({ paymentSources: settings.paymentSources.map((sourceItem) => sourceItem.id === item.id ? { ...sourceItem, openingBalance: Math.max(0, parseRomanianAmount(event.target.value)) } : sourceItem) })} /></label><strong>{money(sourceBalance(data, item.id))}</strong></div>)}<div className="bf-source-builder"><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="ex. Card soție" /><select value={kind} onChange={(event) => setKind(event.target.value as PaymentKind)}>{Object.entries(sourceKindName).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={owner} disabled={kind === "transfer"} onChange={(event) => setOwner(event.target.value)}>{settings.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button onClick={addSource}>Adaugă</button></div></section><section><p className="bf-kicker">CATEGORII PROPRII</p><div className="bf-chip-list">{settings.customCategories.map((item) => <span key={item}>{item}<button onClick={() => change({ customCategories: settings.customCategories.filter((categoryItem) => categoryItem !== item) })}><X size={14} /></button></span>)}</div><div className="bf-mini-form"><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="ex. Taxi" /><button onClick={() => { if (category.trim() && !settings.customCategories.includes(category.trim())) { change({ customCategories: [...settings.customCategories, category.trim()] }); setCategory(""); } }}>Adaugă</button></div></section><section className="bf-settings-notifications"><p className="bf-kicker">ALERTE LOCALE</p><h2>Reamintiri pe telefon</h2><p>Scadențe, plicuri aproape de limită și un check-in calm. Rămân pe dispozitiv; nu se trimit pe server.</p><div className="bf-notification-actions"><button type="button" className="bf-primary" onClick={() => void (async () => { const status = await requestNotificationPermission(); setNotificationsEnabled(status === "granted"); if (status === "granted") window.alert("Alertele sunt active pe acest dispozitiv."); else if (status === "denied") window.alert("Permisiunea a fost refuzată. O poți reactiva din setările telefonului."); else window.alert("Notificările nu sunt disponibile în acest browser."); })()}>Activează alertele</button><button type="button" onClick={() => { setNotificationsEnabled(false); window.alert("Alertele au fost oprite pe acest dispozitiv."); }}>Oprește alertele</button></div><small className="bf-helper">Pe Android nativ: <code>pnpm install && npx cap sync</code>.</small></section><section><p className="bf-kicker">BACKUP ȘI RECUPERARE</p><h2>Protejează registrul local</h2><p>Backup-ul este un fișier local JSON. Nu este trimis automat în rețea și poate fi importat pe un alt dispozitiv.</p><div className="bf-backup-actions"><button onClick={() => downloadBackup(data)}><Download size={16} /> Exportă backup</button><label className="bf-file-button"><Upload size={16} /> Importă backup<input type="file" accept="application/json,.json" onChange={importBackup} /></label></div></section><Suspense fallback={null}><TrustCenter /></Suspense><Suspense fallback={null}><PremiumStudio /></Suspense><section className="bf-danger"><p className="bf-kicker">RESETARE</p><h2>Începe curat pe acest dispozitiv</h2><p>Șterge numai datele locale. O copie sincronizată sau exportată nu este afectată.</p><button onClick={onReset}><Trash2 size={16} /> Resetează datele locale</button></section></div>;
}

/** Prezentare pură: starea de conectare live trăiește în Home, ca să reziste la schimbarea de tab. */
export function SyncPanel({ connected, busy, password, setPassword, notice, lastSync, journal, onConnect, onDisconnect, onClearJournal }: SyncPanelProps) {
  return <div className="bf-sync"><div className="bf-sync-hero"><Users size={25} /><p className="bf-kicker">FAMILIE CONECTATĂ</p><h2>{connected ? "Sesiunea familiei este activă." : "Sincronizare criptată, în timp real, între telefoane."}</h2><p>Serverul de sincronizare vede doar un pachet AES-GCM. Pozele bonurilor și parola rămân pe telefon.</p></div><section className="bf-sync-session"><p className="bf-kicker">{connected ? "CONECTAT" : "CONECTEAZĂ FAMILIA"}</p>{connected ? <><p><b>Actualizare live, fără reîmprospătare manuală</b><br />Cât aplicația rămâne deschisă pe orice telefon din familie, mișcările apar automat pe toate celelalte în câteva secunde.</p><button className="bf-link-button" onClick={onDisconnect}>Închide sesiunea acestui telefon</button></> : <><Field label="Parola familiei" hint="Orice parolă inventată de voi, de cel puțin 12 caractere. Trebuie să fie identică, literă cu literă, pe toate telefoanele."><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="minimum 12 caractere" autoComplete="new-password" /></Field><p className="bf-helper">Nu ai nevoie de niciun cont sau token. Parola nu se salvează pe telefon și nu este trimisă niciodată necriptată.</p><button className="bf-primary full" disabled={busy} onClick={onConnect}><Users size={17} /> Conectează acest telefon</button></>}</section>{lastSync && <p className="bf-helper">Ultima actualizare: {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastSync))}</p>}{notice && <p className="bf-notice" role="status"><Check size={15} /> {notice}</p>}<section className="bf-sync-journal" aria-labelledby="sync-journal-title"><div className="bf-sync-journal-heading"><div><p className="bf-kicker">ISTORIC DE ACTUALIZĂRI</p><h3 id="sync-journal-title">Ce s-a întâmplat la sincronizare</h3></div>{journal.length > 0 && <button className="bf-link-button" onClick={onClearJournal}>Curăță istoricul</button>}</div>{journal.length ? <div className="bf-sync-journal-list">{journal.map((entry) => <article key={entry.id} className={`bf-sync-journal-entry ${entry.status}`}><div className="bf-sync-journal-icon" aria-hidden="true">{entry.status === "resolved" ? <Check size={15} /> : entry.status === "failed" ? <X size={15} /> : <RotateCcw size={15} />}</div><div><strong>{entry.status === "resolved" ? "Actualizare reunită" : entry.status === "failed" ? "Actualizare eșuată" : "Actualizare detectată"}</strong><p>{entry.message}</p><small>{new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))} · {entry.action}</small></div></article>)}</div> : <p className="bf-helper">Nu există actualizări înregistrate pe acest dispozitiv. Când un alt telefon trimite mișcări noi, aici vei vedea ce a fost reunit automat.</p>}</section></div>;
}

export function FamilyGuide() { return <div className="bf-guide"><section className="bf-guide-hero"><BookOpen size={25} /><p className="bf-kicker">MANUAL RAPID</p><h2>Doar tu sau împreună.</h2><p>Poți urmări banii proprii de la prima deschidere. Membrii și conectarea telefoanelor sunt opționale.</p><button className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-onboarding"))}><BookOpen size={16} /> Reia turul „Calm financiar”</button><button className="bf-guide-replay" onClick={() => window.dispatchEvent(new Event("buget-familie:replay-setup"))}><WalletCards size={16} /> Reia configurarea casei</button></section><section><p className="bf-kicker">1. PORNEȘTE CU TINE</p><h3>Configurează profilul și banii reali</h3><p>În <b>Setări familie</b>, păstrează un singur membru pentru monitorizare personală sau adaugă mai mulți membri când aveți un buget comun. Configurează sursele și soldurile inițiale, apoi creează planul până la următorul venit.</p></section><section><p className="bf-kicker">2. CONECTEAZĂ OPȚIONAL</p><h3>O parolă de familie, în loc de conturi și tokenuri</h3><p>Dacă vrei același registru pe mai multe telefoane, mergi în <b>Mai mult → Sincronizare</b> și alegeți împreună o parolă de familie de minimum 12 caractere. Introduceți exact aceeași parolă pe fiecare telefon, apoi apăsați „Conectează acest telefon". De acolo, mișcările apar automat, în timp real, pe toate telefoanele conectate.</p></section><section><p className="bf-kicker">3. LUCREAZĂ ZILNIC</p><h3>Înregistrează, verifică, decide</h3><p>Adaugă mișcările la momentul plății. Pentru cumpărături, un bon se salvează cu magazin și total; pozele sunt opționale. Verifică zilnic punctul de decizie și confirmă scadențele când sunt plătite.</p></section><section><p className="bf-kicker">4. PROTEJEAZĂ DATELE</p><h3>Parola de familie rămâne la voi</h3><p>Parola de sincronizare nu este salvată. Nu o pune în conversații, bonuri sau capturi de ecran. Dacă un telefon se pierde, schimbați parola pe telefoanele rămase — camera veche nu mai decriptează pachetul. Pozele bonurilor nu părăsesc telefonul. Politica, termenii și ștergerea datelor sunt în Setări → Încredere.</p></section></div>; }

/** Atelierul Financiar 3.0 — Analiza este o destinație de lucru, cu rapoarte și asistent separat încărcate la cerere. */
export function InsightsView({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const [panel, setPanel] = useState<"reports" | "household" | "assistant">("reports");
  return <div className="bf-page bf-insights-workspace"><header className="bf-insights-header"><div><p className="bf-kicker">ANALIZĂ FINANCIARĂ</p><h1>Înțelege <em>schimbarea.</em></h1><p>Compară lunile, închide ritualul gospodăriei și cere o explicație locală.</p></div><span><LayoutDashboard size={25} /></span></header><div className="bf-insights-switch" role="tablist" aria-label="Tip analiză"><button role="tab" aria-selected={panel === "reports"} className={panel === "reports" ? "active" : ""} onClick={() => setPanel("reports")}><LayoutDashboard size={16} /> Istoric</button><button role="tab" aria-selected={panel === "household"} className={panel === "household" ? "active" : ""} onClick={() => setPanel("household")}><Users size={16} /> Gospodărie</button><button role="tab" aria-selected={panel === "assistant"} className={panel === "assistant" ? "active" : ""} onClick={() => setPanel("assistant")}><Bot size={16} /> Asistent</button></div>{panel === "reports" ? <Suspense fallback={<div className="bf-lazy-panel">Pregătim analiza…</div>}><ReportsPanel data={data} /></Suspense> : panel === "household" ? <Suspense fallback={<div className="bf-lazy-panel">Pregătim gospodăria…</div>}><HouseholdStudio data={data} onChange={onChange} /></Suspense> : <Suspense fallback={<div className="bf-lazy-panel">Pregătim asistentul…</div>}><AdvisorPanel data={data} /></Suspense>}</div>;
}
