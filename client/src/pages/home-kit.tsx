/**
 * Tipuri, tokeni și piese partajate de ecranul Astăzi și de ecranele încărcate la cerere.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { formatDate } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { type SyncJournalEntry } from "@/lib/app-storage";
import { moneyFormat, t } from "@/lib/i18n";

export type MainView = "today" | "journal" | "plan" | "obligations" | "goals" | "habits" | "calendar" | "insights" | "utilities";
export type MoreView = "overview" | "review" | "prices" | "pocket" | "debts" | "savings" | "receipts" | "recurring" | "reports" | "assistant" | "settings" | "sync" | "guide";
export type ThemeId = "white" | "dark" | "aurora" | "navy" | "cyber";
export type ThemeSchedule = "manual" | "auto";
export type ThemeScheduleTimes = { dayStart: string; eveningStart: string; nightStart: string };
export type BackgroundId = "plain" | "paper" | "grid" | "aurora" | "dots";
export const LIGHT_THEMES: ThemeId[] = ["white"];

export const backgroundOptions: Array<{ id: BackgroundId; name: string; detail: string }> = [
  { id: "plain", name: t("Lumină curată"), detail: t("Halo-uri moi, fără grilă") },
  { id: "paper", name: "In de registru", detail: t("Fibre calde, ca o coală") },
  { id: "grid", name: t("Hartă discretă"), detail: t("Grilă largă, aproape invizibilă") },
  { id: "aurora", name: t("Auroră profundă"), detail: t("Trei pete de lumină") },
  { id: "dots", name: t("Ceață fină"), detail: t("Puncte moi, adâncime") },
];
export const themeOptions: Array<{ id: ThemeId; name: string; detail: string; mood: string }> = [
  { id: "white", name: t("Alb"), detail: t("Atelier Platinum — suprafețe moi, pin cald, citire de zi. Implicit."), mood: "ZI · ATELIER" },
  { id: "dark", name: t("Întunecat"), detail: t("Negru profesional, accent argintiu. Pentru noapte, fără mint."), mood: "NOAPTE · GRAFIT" },
  { id: "aurora", name: t("Aurora Glass"), detail: t("Sticlă ultravioletă, cyan controlat — futurist, clar nocturn."), mood: "NOAPTE · DIGITAL" },
  { id: "navy", name: t("Navy OLED"), detail: t("Bleumarin profund, auriu discret. Cabinet modern."), mood: "NOAPTE · OLED" },
  { id: "cyber", name: t("Cyber Teal"), detail: t("OLED mint/teal neon, cifre clare. Futurist, distinct."), mood: "NOAPTE · CYBER" },
];
export const defaultScheduleTimes: ThemeScheduleTimes = { dayStart: "06:00", eveningStart: "17:00", nightStart: "21:00" };
export const timeToMinutes = (value: string, fallback: number) => { const [hours, minutes] = value.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : fallback; };
export const currentLocalMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
export const automaticTheme = (minutes: number, times: ThemeScheduleTimes): ThemeId => { const dayStart = timeToMinutes(times.dayStart, 360); const eveningStart = timeToMinutes(times.eveningStart, 1020); const nightStart = timeToMinutes(times.nightStart, 1260); if (dayStart < eveningStart && eveningStart < nightStart) return minutes >= dayStart && minutes < eveningStart ? "white" : minutes >= eveningStart && minutes < nightStart ? "cyber" : "dark"; return minutes >= 6 * 60 && minutes < 17 * 60 ? "white" : minutes >= 17 * 60 && minutes < 21 * 60 ? "cyber" : "dark"; };
/**
 * Formatarea se face la fiecare apel, nu o dată la încărcarea modulului: altfel
 * schimbarea limbii nu s-ar vedea până la reîncărcarea aplicației. `.format()` rămâne
 * aceeași interfață, deci niciun apel existent nu se schimbă.
 */
export const fmt = { format: (value: number) => moneyFormat(value, { maximumFractionDigits: 0 }) };
export const fmtExact = { format: (value: number) => moneyFormat(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
export const sourceKindName: Record<"card" | "cash" | "meal" | "transfer", string> = { get card() { return t("Card"); }, get cash() { return t("Cash"); }, get meal() { return t("Bonuri de masă"); }, get transfer() { return t("Transfer"); } };
export const money = (value: number) => fmt.format(Number.isFinite(value) ? value : 0);
export const dateText = (value: string, full = false) => formatDate(value, full ? { day: "2-digit", month: "long", year: "numeric" } : { day: "2-digit", month: "short" });

export type SyncPanelProps = {
  connected: boolean;
  busy: boolean;
  password: string;
  setPassword: (value: string) => void;
  notice: string;
  lastSync: string;
  journal: SyncJournalEntry[];
  devices: import("@/lib/finance-data").SyncDevice[];
  thisDeviceId: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onClearJournal: () => void;
  onRevokeDevice: (deviceId: string) => void;
  /** Parolă arătată o dată (ex. din FirstRun familie). */
  passwordRevealOnce?: string;
  clearPasswordReveal?: () => void;
};

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
    if (event.target === event.currentTarget) onClose();
  };
  return <div className="bf-modal-backdrop" role="presentation" onPointerDown={closeIfBackdrop}><section ref={dialogRef} tabIndex={-1} className="bf-modal" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(event) => event.stopPropagation()}><header><div><p className="bf-kicker">{t("ÎNREGISTRARE RAPIDĂ")}</p><h2>{title}</h2></div><button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={19} /></button></header>{children}</section></div>;
}

export function DeferBelowFold({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || ready) return;
    if (typeof IntersectionObserver !== "function") { setReady(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: "240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);
  return <div ref={ref}>{ready ? children : <div className="bf-below-fold-slot" aria-hidden="true" />}</div>;
}


export function WhatsNewSheet({ onClose, onOpenTheme, onOpenMore }: { onClose: () => void; onOpenTheme: () => void; onOpenMore: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
    if (event.target === event.currentTarget) onClose();
  };
  return (
    <div className="bf-modal-backdrop bf-whats-new-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
      <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-whats-new" role="dialog" aria-modal="true" aria-labelledby="bf-whats-new-title" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="bf-kicker">{t("ACTUALIZARE")}</p>
            <h2 id="bf-whats-new-title">{t("Ce e nou")}</h2>
          </div>
          <button type="button" className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={19} /></button>
        </header>
        <p>{t("Funcții deja în aplicație, scoase la vedere. O singură dată.")}</p>
        <ul className="bf-whats-new-list">
          <li>{t("De verificat — confirmă bonuri și CSV înainte de registru.")}</li>
          <li>{t("Personale vs comune — separă ce e al tău de ce e al casei.")}</li>
          <li>{t("Reguli comerciant — categorie și plic propuse după magazin.")}</li>
          <li>{t("Temă Alb Atelier — suprafețe moi, pin cald (fără look-ul ink stark).")}</li>
          <li>{t("Împarte o cheltuială pe categorii sau plicuri.")}</li>
          <li>{t("Plan săptămânal din scadențe și obiective, nu doar ultimele 7 zile.")}</li>
          <li>{t("Scor de sănătate pe cicluri salariale și ce l-a mișcat.")}</li>
        </ul>
        <div className="bf-whats-new-actions">
          <button type="button" className="bf-primary" onClick={onOpenTheme}>{t("Alege tema")}</button>
          <button type="button" className="bf-secondary" onClick={onOpenMore}>{t("Deschide Mai mult")}</button>
          <button type="button" className="bf-link-button" onClick={onClose}>{t("Am înțeles")}</button>
        </div>
      </section>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="bf-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }

export function BudgetBar({ used, total, tone = "green" }: { used: number; total: number; tone?: "green" | "gold" | "coral" }) { const percent = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0; return <div className={`bf-progress ${tone}`} aria-label={`${Math.round(percent)}% utilizat`}><span style={{ width: `${percent}%` }} /></div>; }
