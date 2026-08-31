/**
 * Tipuri, tokeni și piese partajate de ecranul Astăzi și de ecranele încărcate la cerere.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { formatDate } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { type SyncJournalEntry } from "@/lib/app-storage";

export type MainView = "today" | "journal" | "plan" | "obligations" | "goals" | "habits" | "calendar" | "insights" | "utilities";
export type MoreView = "overview" | "debts" | "savings" | "receipts" | "recurring" | "reports" | "assistant" | "settings" | "sync" | "guide";
export type ThemeId = "ivory" | "forest" | "midnight" | "copper" | "slate" | "plum" | "lagoon" | "rosewood";
export type ThemeSchedule = "manual" | "auto";
export type ThemeScheduleTimes = { dayStart: string; eveningStart: string; nightStart: string };
export type BackgroundId = "plain" | "paper" | "grid" | "aurora" | "dots";

export const backgroundOptions: Array<{ id: BackgroundId; name: string; detail: string }> = [
  { id: "plain", name: "Lumină curată", detail: "Halo-uri moi, fără grilă" },
  { id: "paper", name: "In de registru", detail: "Fibre calde, ca o coală" },
  { id: "grid", name: "Hartă discretă", detail: "Grilă largă, aproape invizibilă" },
  { id: "aurora", name: "Auroră profundă", detail: "Trei pete de lumină" },
  { id: "dots", name: "Ceață fină", detail: "Puncte moi, adâncime" },
];
export const themeOptions: Array<{ id: ThemeId; name: string; detail: string; mood: string }> = [
  { id: "ivory", name: "Porcelain Studio", detail: "Porțelan rece, teal dens și linii de cobalt pentru citire luminoasă.", mood: "ZI · EDITORIAL" },
  { id: "forest", name: "Aurora Moss", detail: "Verde de mușchi, reflexe aurora și suprafețe mate pentru seară.", mood: "SEARĂ · ORGANIC" },
  { id: "midnight", name: "Ultraviolet Grid", detail: "Indigo profund, violet controlat și semnale cyan pentru focus nocturn.", mood: "NOAPTE · DIGITAL" },
  { id: "copper", name: "Ember Ledger", detail: "Cărbune cald, cupru ars și hârtie fumurie pentru un ton tactil.", mood: "CALD · TACTIL" },
  { id: "slate", name: "Nordic Slate", detail: "Gri-albăstrui de birou, accent auriu discret și alb cald pentru claritate profesională.", mood: "ZI · PROFESIONAL" },
  { id: "plum", name: "Velvet Plum", detail: "Prună catifelată, accent auriu cald și contrast rafinat pentru seri elegante.", mood: "NOAPTE · RAFINAT" },
  { id: "lagoon", name: "Lagoon Glass", detail: "Turcoaz marin, alb mineral și accente de coral pentru un aer proaspăt.", mood: "ZI · LUMINOS" },
  { id: "rosewood", name: "Rosewood Night", detail: "Cărbune prună, roz prăfuit și cupru pentru o atmosferă calmă de seară.", mood: "NOAPTE · CALM" },
];
export const defaultScheduleTimes: ThemeScheduleTimes = { dayStart: "06:00", eveningStart: "17:00", nightStart: "21:00" };
export const timeToMinutes = (value: string, fallback: number) => { const [hours, minutes] = value.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : fallback; };
export const currentLocalMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
export const automaticTheme = (minutes: number, times: ThemeScheduleTimes): ThemeId => { const dayStart = timeToMinutes(times.dayStart, 360); const eveningStart = timeToMinutes(times.eveningStart, 1020); const nightStart = timeToMinutes(times.nightStart, 1260); if (dayStart < eveningStart && eveningStart < nightStart) return minutes >= dayStart && minutes < eveningStart ? "ivory" : minutes >= eveningStart && minutes < nightStart ? "forest" : "midnight"; return minutes >= 6 * 60 && minutes < 17 * 60 ? "ivory" : minutes >= 17 * 60 && minutes < 21 * 60 ? "forest" : "midnight"; };
export const fmt = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });
export const fmtExact = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const sourceKindName: Record<"card" | "cash" | "meal" | "transfer", string> = { card: "Card", cash: "Cash", meal: "Bonuri de masă", transfer: "Transfer" };
export const money = (value: number) => fmt.format(Number.isFinite(value) ? value : 0);
export const dateText = (value: string, full = false) => formatDate(value, full ? { day: "2-digit", month: "long", year: "numeric" } : { day: "2-digit", month: "short" });

export type SyncPanelProps = { connected: boolean; busy: boolean; password: string; setPassword: (value: string) => void; notice: string; lastSync: string; journal: SyncJournalEntry[]; onConnect: () => void; onDisconnect: () => void; onClearJournal: () => void };

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
    if (event.target === event.currentTarget) onClose();
  };
  return <div className="bf-modal-backdrop" role="presentation" onPointerDown={closeIfBackdrop}><section ref={dialogRef} tabIndex={-1} className="bf-modal" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(event) => event.stopPropagation()}><header><div><p className="bf-kicker">ÎNREGISTRARE RAPIDĂ</p><h2>{title}</h2></div><button type="button" className="bf-icon-button" aria-label="Închide" onClick={onClose}><X size={19} /></button></header>{children}</section></div>;
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

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="bf-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }

export function BudgetBar({ used, total, tone = "green" }: { used: number; total: number; tone?: "green" | "gold" | "coral" }) { const percent = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0; return <div className={`bf-progress ${tone}`} aria-label={`${Math.round(percent)}% utilizat`}><span style={{ width: `${percent}%` }} /></div>; }
