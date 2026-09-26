import { useMemo, useState } from "react";
import { FileDown, History, RotateCcw } from "lucide-react";
import { AllocationHistoryChart } from "@/components/AllocationHistoryChart";
import { allocationHistorySnapshot, downloadAllocationHistoryCsv } from "@/lib/allocation-history";
import { type AllocationHistoryEntry, type AppData } from "@/lib/finance-data";
import { getLocale, t } from "@/lib/i18n";
import { RoDateInput } from "@/components/RoDateInput";
import { lei } from "@/lib/money-format";

const money = lei;
const dateTime = (value: string) => new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const kindLabel: Record<AllocationHistoryEntry["kind"] | "all", string> = { all: t("Toate acțiunile"), created: t("Plic creat"), updated: t("Plic modificat"), deleted: t("Plic șters"), "income-applied": t("Repartizare din venit"), "income-reverted": t("Repartizare anulată"), "envelope-transfer": t("Între plicuri"), "week-transfer": t("Între săptămâni") };
const kindTone = (kind: AllocationHistoryEntry["kind"]) => kind === "deleted" || kind === "income-reverted" ? "danger" : kind === "created" || kind === "income-applied" ? "positive" : "neutral";

function entryAllocationIds(entry: AllocationHistoryEntry) {
  return [entry.allocationId, entry.fromAllocationId, entry.toAllocationId].filter((value): value is string => Boolean(value));
}

/**
 * Textele de sistem din istoric se traduc aici, la afișare: istoricul se sincronizează, iar un
 * partener cu aplicația în engleză nu trebuie să vadă „Plic eliminat” în română. Numele date de
 * familie (plicuri, venituri) rămân exact cum au fost scrise.
 */
const SYSTEM_TEXT = new Set(["Plic eliminat", "Plăți rare", "Repartizarea a fost anulată."]);
const shown = (value: string | undefined, fallback: string) => {
  if (!value) return t(fallback);
  return value.split(", ").map((part) => (SYSTEM_TEXT.has(part) ? t(part) : part)).join(", ");
};
const shownNote = (note: string) => {
  if (SYSTEM_TEXT.has(note)) return t(note);
  const legacyIncome = /^Venit de ([\d.,]+) RON$/.exec(note);
  return legacyIncome ? t("Venit de {amount}", { amount: `${legacyIncome[1]} RON` }) : note;
};

function entryTitle(entry: AllocationHistoryEntry) {
  const label = shown(entry.allocationLabel, "Plic");
  if (entry.kind === "created") return t("A fost creat plicul „{label}”.", { label: shown(entry.allocationLabel, "Plic nou") });
  if (entry.kind === "updated") return entry.previousAmount !== undefined || entry.newAmount !== undefined ? t("„{label}”: {before} → {after}.", { label, before: money(entry.previousAmount || 0), after: money(entry.newAmount || 0) }) : t("Plicul „{label}” a fost actualizat.", { label });
  if (entry.kind === "deleted") return t("Plicul „{label}” a fost șters.", { label: shown(entry.allocationLabel, "Plic eliminat") });
  if (entry.kind === "income-applied") return t("{amount} repartizați din venitul „{income}”.", { amount: money(entry.amount || 0), income: entry.incomeTitle || t("Venit") });
  if (entry.kind === "income-reverted") return t("Repartizarea din venitul „{income}” a fost anulată: {amount}.", { income: entry.incomeTitle || t("Venit"), amount: money(entry.amount || 0) });
  if (entry.kind === "envelope-transfer") return t("{amount} realocați: „{from}” → „{to}”.", { amount: money(entry.amount || 0), from: shown(entry.fromAllocationLabel, "Plic sursă"), to: shown(entry.toAllocationLabel, "Plic destinație") });
  return t("{amount} mutați în „{label}”: S{from} → S{to}.", { amount: money(entry.amount || 0), label, from: String(entry.fromWeekIndex ?? ""), to: String(entry.toWeekIndex ?? "") });
}

export function AllocationHistoryPanel({ data }: { data: AppData }) {
  const [allocationFilter, setAllocationFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | AllocationHistoryEntry["kind"]>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const entries = useMemo(() => allocationHistorySnapshot(data), [data]);
  const allocationOptions = useMemo(() => Array.from(new Map(entries.flatMap((entry) => entryAllocationIds(entry).map((id) => [id, entry.allocationId === id ? entry.allocationLabel : id] as const))).entries()).map(([id, label]) => ({ id, label: label || data.settings.salaryPlan.allocations.find((item) => item.id === id)?.label || t("Plic eliminat") })).sort((left, right) => left.label.localeCompare(right.label, "ro")), [data, entries]);
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesAllocation = !allocationFilter || entryAllocationIds(entry).includes(allocationFilter);
    const date = entry.createdAt.slice(0, 10);
    const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    return matchesAllocation && (kindFilter === "all" || entry.kind === kindFilter) && matchesDate;
  }), [allocationFilter, entries, fromDate, kindFilter, toDate]);
  const resetFilters = () => { setAllocationFilter(""); setKindFilter("all"); setFromDate(""); setToDate(""); };
  return <section className="bf-allocation-history" aria-labelledby="allocation-history-title"><div className="bf-allocation-history-heading"><div><p className="bf-kicker">{t("URMĂRIREA DECIZIILOR")}</p><h2 id="allocation-history-title">{t("Istoric repartizări")}</h2><p>{t("Vezi cum s-au schimbat limitele plicurilor, fără a confunda o realocare cu o plată bancară.")}</p></div><History size={24} aria-hidden="true" /></div><div className="bf-allocation-history-toolbar"><label><span>Plic</span><select value={allocationFilter} onChange={(event) => setAllocationFilter(event.target.value)}><option value="">{t("Toate plicurile")}</option>{allocationOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label><span>{t("Acțiune")}</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>{t("De la")}</span><RoDateInput value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label><span>{t("Până la")}</span><RoDateInput value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label><div className="bf-allocation-history-actions"><button type="button" onClick={resetFilters}><RotateCcw size={15} /> {t("Resetează")}</button><button type="button" className="bf-primary" disabled={!filteredEntries.length} onClick={() => downloadAllocationHistoryCsv(data, filteredEntries)}><FileDown size={15} /> {t("Exportă CSV")}</button></div></div><AllocationHistoryChart entries={filteredEntries} allocationFilter={allocationFilter || undefined} /><div className="bf-allocation-history-meta"><span>{filteredEntries.length} {filteredEntries.length === 1 ? t("înregistrare") : t("înregistrări")}</span>{entries.length > filteredEntries.length && <small>{t("din {count} în total", { count: entries.length })}</small>}</div>{filteredEntries.length ? <div className="bf-allocation-history-list" aria-live="polite">{filteredEntries.map((entry) => <article key={entry.id} className={`bf-allocation-history-entry ${kindTone(entry.kind)}`}><span className="bf-allocation-history-dot" aria-hidden="true" /><div><div className="bf-allocation-history-entry-top"><strong>{kindLabel[entry.kind]}</strong><time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time></div><p>{entryTitle(entry)}</p>{entry.note && <small>{shownNote(entry.note)}</small>}</div></article>)}</div> : <div className="bf-allocation-history-empty"><History size={21} /><strong>{entries.length ? t("Nicio repartizare pentru filtrele alese") : t("Istoricul începe la următoarea schimbare")}</strong><p>{entries.length ? t("Lărgește perioada sau alege toate acțiunile pentru a vedea alte înregistrări.") : t("Modificările viitoare ale plicurilor și transferurile săptămânale vor apărea aici. Intrările vechi care nu au fost jurnalizate nu pot fi reconstruite retroactiv.")}</p></div>}</section>;
}
