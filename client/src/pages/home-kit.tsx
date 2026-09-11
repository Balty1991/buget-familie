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
export type ThemeId = "snow" | "ivory" | "sand" | "sage" | "slate" | "lagoon" | "forest" | "midnight" | "navy" | "graphite" | "copper" | "plum" | "rosewood";
export type ThemeSchedule = "manual" | "auto";
export type ThemeScheduleTimes = { dayStart: string; eveningStart: string; nightStart: string };
export type BackgroundId = "plain" | "paper" | "grid" | "aurora" | "dots";
export const LIGHT_THEMES: ThemeId[] = ["snow", "ivory", "sand", "sage", "slate", "lagoon"];

export const backgroundOptions: Array<{ id: BackgroundId; name: string; detail: string }> = [
  { id: "plain", name: t("Lumină curată"), detail: t("Halo-uri moi, fără grilă") },
  { id: "paper", name: "In de registru", detail: t("Fibre calde, ca o coală") },
  { id: "grid", name: t("Hartă discretă"), detail: t("Grilă largă, aproape invizibilă") },
  { id: "aurora", name: t("Auroră profundă"), detail: t("Trei pete de lumină") },
  { id: "dots", name: t("Ceață fină"), detail: t("Puncte moi, adâncime") },
];
export const themeOptions: Array<{ id: ThemeId; name: string; detail: string; mood: string }> = [
  { id: "snow", name: "Studio Alb", detail: t("Alb curat, cerneală cărbune și accent teal. Fundal alb, citire de zi."), mood: "ZI · ALB" },
  { id: "ivory", name: "Porcelain Studio", detail: t("Porțelan rece, teal dens și linii de cobalt pentru citire luminoasă."), mood: "ZI · EDITORIAL" },
  { id: "sand", name: t("Hârtie Caldă"), detail: t("Cremă de studio, espresso și teracotă. Calm, ca un dosar de hârtie."), mood: "ZI · CALD" },
  { id: "sage", name: "Salvie", detail: t("Verde-salvie deschis, alb mineral, accent pădure. Lin, profesional."), mood: t("ZI · LINIȘTE") },
  { id: "slate", name: "Nordic Slate", detail: t("Gri-albăstrui de birou, accent auriu discret și alb cald pentru claritate profesională."), mood: "ZI · PROFESIONAL" },
  { id: "lagoon", name: "Lagoon Glass", detail: t("Turcoaz marin, alb mineral și accente de coral pentru un aer proaspăt."), mood: "ZI · LUMINOS" },
  { id: "forest", name: "Mint OLED", detail: "Negru OLED, mint, cifre Fraunces. Household OS de noapte.", mood: "NOAPTE · MINT" },
  { id: "midnight", name: "Ultraviolet Grid", detail: t("Indigo profund, violet controlat și semnale cyan pentru focus nocturn."), mood: "NOAPTE · DIGITAL" },
  { id: "navy", name: "Navy Cabinet", detail: t("Bleumarin de birou, crem și auriu discret. Serios, de cabinet."), mood: "NOAPTE · BIROU" },
  { id: "graphite", name: "Grafit", detail: t("Negru grafit, accent albastru de ecran. Neutru, fără verde."), mood: "NOAPTE · NEUTRU" },
  { id: "copper", name: "Ember Ledger", detail: t("Cărbune cald, cupru ars și hârtie fumurie pentru un ton tactil."), mood: "CALD · TACTIL" },
  { id: "plum", name: "Velvet Plum", detail: t("Prună catifelată, accent auriu cald și contrast rafinat pentru seri elegante."), mood: "NOAPTE · RAFINAT" },
  { id: "rosewood", name: "Rosewood Night", detail: t("Cărbune prună, roz prăfuit și cupru pentru o atmosferă calmă de seară."), mood: "NOAPTE · CALM" },
];
export const defaultScheduleTimes: ThemeScheduleTimes = { dayStart: "06:00", eveningStart: "17:00", nightStart: "21:00" };
export const timeToMinutes = (value: string, fallback: number) => { const [hours, minutes] = value.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : fallback; };
export const currentLocalMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
export const automaticTheme = (minutes: number, times: ThemeScheduleTimes): ThemeId => { const dayStart = timeToMinutes(times.dayStart, 360); const eveningStart = timeToMinutes(times.eveningStart, 1020); const nightStart = timeToMinutes(times.nightStart, 1260); if (dayStart < eveningStart && eveningStart < nightStart) return minutes >= dayStart && minutes < eveningStart ? "ivory" : minutes >= eveningStart && minutes < nightStart ? "forest" : "midnight"; return minutes >= 6 * 60 && minutes < 17 * 60 ? "ivory" : minutes >= 17 * 60 && minutes < 21 * 60 ? "forest" : "midnight"; };
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

export type SyncPanelProps = { connected: boolean; busy: boolean; password: string; setPassword: (value: string) => void; notice: string; lastSync: string; journal: SyncJournalEntry[]; onConnect: () => void; onDisconnect: () => void; onClearJournal: () => void };

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

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="bf-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }

export function BudgetBar({ used, total, tone = "green" }: { used: number; total: number; tone?: "green" | "gold" | "coral" }) { const percent = total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : 0; return <div className={`bf-progress ${tone}`} aria-label={`${Math.round(percent)}% utilizat`}><span style={{ width: `${percent}%` }} /></div>; }
