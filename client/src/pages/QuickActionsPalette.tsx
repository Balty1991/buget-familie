/** Acțiuni rapide și primul tur. Scos din home-secondary. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, BookOpen, CalendarClock, CalendarDays, ChevronRight, Goal, LayoutDashboard, Search, PiggyBank, Plus, ReceiptText, WalletCards, X } from "lucide-react";
import { type AppData } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { EnvelopeStack } from "@/components/EnvelopeMark";
import { type MainView } from "@/pages/home-kit";
import { t } from "@/lib/i18n";
import { matchCommandQuery, searchLedgerHits, writeJournalQuery } from "@/lib/command-search";
import { completeOnboardingTourOnly } from "@/lib/first-week-tour";

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
  const dockDuplicates = new Set(["plan", "goals", "journal", "obligations", "insights", "habits", "calendar"]);
  const visible = actions.filter((action) => matchCommandQuery(`${action.label} ${action.detail}`, query) && (query.trim() || !dockDuplicates.has(action.id)));
  const ledgerHits = query.trim()
    ? searchLedgerHits(data?.transactions || [], query, 6)
    : (data?.transactions || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((item) => ({ id: item.id, title: item.title, category: item.category, person: item.person }));
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
            <p className="bf-kicker">{t("CĂUTARE")}</p>
            <h2 id="bf-command-title">{query.trim() ? t("Ce vrei să faci?") : t("Caută o mișcare")}</h2>
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
          {ledgerHits.length > 0 && <p className="bf-command-section">{query.trim() ? t("Mișcări din registru") : t("Mișcări recente")}</p>}
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
    { kicker: t("ÎNCREDERE"), title: t("Date pe telefon."), emphasis: t("Sync opțional. Fără login bancar."), detail: t("Registrul rămâne local. Sync-ul de familie e criptat pe telefon, iar partenerul intră cu invitație — fără cont bancar și fără reclame pe ecranele financiare."), icon: WalletCards, tone: "calm" },
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
