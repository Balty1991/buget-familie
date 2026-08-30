import { useMemo, useState } from "react";
import { FileDown, History, RotateCcw } from "lucide-react";
import { AllocationHistoryChart } from "@/components/AllocationHistoryChart";
import { allocationHistorySnapshot, downloadAllocationHistoryCsv } from "@/lib/allocation-history";
import { type AllocationHistoryEntry, type AppData } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const dateTime = (value: string) => new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const kindLabel: Record<AllocationHistoryEntry["kind"] | "all", string> = { all: "Toate acțiunile", created: "Plic creat", updated: "Plic modificat", deleted: "Plic șters", "income-applied": "Repartizare din venit", "income-reverted": "Repartizare anulată", "envelope-transfer": "Realocare între plicuri", "week-transfer": "Transfer între săptămâni" };
const kindTone = (kind: AllocationHistoryEntry["kind"]) => kind === "deleted" || kind === "income-reverted" ? "danger" : kind === "created" || kind === "income-applied" ? "positive" : "neutral";

function entryAllocationIds(entry: AllocationHistoryEntry) {
  return [entry.allocationId, entry.fromAllocationId, entry.toAllocationId].filter((value): value is string => Boolean(value));
}

function entryTitle(entry: AllocationHistoryEntry) {
  if (entry.kind === "created") return `A fost creat plicul „${entry.allocationLabel || "Plic nou"}”.`;
  if (entry.kind === "updated") return entry.previousAmount !== undefined || entry.newAmount !== undefined ? `„${entry.allocationLabel || "Plic"}”: ${money(entry.previousAmount || 0)} → ${money(entry.newAmount || 0)}.` : `Plicul „${entry.allocationLabel || "Plic"}” a fost actualizat.`;
  if (entry.kind === "deleted") return `Plicul „${entry.allocationLabel || "Plic eliminat"}” a fost șters.`;
  if (entry.kind === "income-applied") return `${money(entry.amount || 0)} repartizați din venitul „${entry.incomeTitle || "Venit"}”.`;
  if (entry.kind === "income-reverted") return `Repartizarea din venitul „${entry.incomeTitle || "Venit"}” a fost anulată: ${money(entry.amount || 0)}.`;
  if (entry.kind === "envelope-transfer") return `${money(entry.amount || 0)} realocați: „${entry.fromAllocationLabel || "Plic sursă"}” → „${entry.toAllocationLabel || "Plic destinație"}”.`;
  return `${money(entry.amount || 0)} mutați în „${entry.allocationLabel || "Plic"}”: S${entry.fromWeekIndex} → S${entry.toWeekIndex}.`;
}

export function AllocationHistoryPanel({ data }: { data: AppData }) {
  const [allocationFilter, setAllocationFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | AllocationHistoryEntry["kind"]>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const entries = useMemo(() => allocationHistorySnapshot(data), [data]);
  const allocationOptions = useMemo(() => Array.from(new Map(entries.flatMap((entry) => entryAllocationIds(entry).map((id) => [id, entry.allocationId === id ? entry.allocationLabel : id] as const))).entries()).map(([id, label]) => ({ id, label: label || data.settings.salaryPlan.allocations.find((item) => item.id === id)?.label || "Plic eliminat" })).sort((left, right) => left.label.localeCompare(right.label, "ro")), [data, entries]);
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const matchesAllocation = !allocationFilter || entryAllocationIds(entry).includes(allocationFilter);
    const date = entry.createdAt.slice(0, 10);
    const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    return matchesAllocation && (kindFilter === "all" || entry.kind === kindFilter) && matchesDate;
  }), [allocationFilter, entries, fromDate, kindFilter, toDate]);
  const resetFilters = () => { setAllocationFilter(""); setKindFilter("all"); setFromDate(""); setToDate(""); };
  return <section className="bf-allocation-history" aria-labelledby="allocation-history-title"><div className="bf-allocation-history-heading"><div><p className="bf-kicker">URMĂRIREA DECIZIILOR</p><h2 id="allocation-history-title">Istoric repartizări</h2><p>Vezi cum s-au schimbat limitele plicurilor, fără a confunda o realocare cu o plată bancară.</p></div><History size={24} aria-hidden="true" /></div><div className="bf-allocation-history-toolbar"><label><span>Plic</span><select value={allocationFilter} onChange={(event) => setAllocationFilter(event.target.value)}><option value="">Toate plicurile</option>{allocationOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label><span>Acțiune</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>De la</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label><span>Până la</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label><div className="bf-allocation-history-actions"><button type="button" onClick={resetFilters}><RotateCcw size={15} /> Resetează</button><button type="button" className="bf-primary" disabled={!filteredEntries.length} onClick={() => downloadAllocationHistoryCsv(data, filteredEntries)}><FileDown size={15} /> Exportă CSV</button></div></div><AllocationHistoryChart entries={filteredEntries} allocationFilter={allocationFilter || undefined} /><div className="bf-allocation-history-meta"><span>{filteredEntries.length} {filteredEntries.length === 1 ? "înregistrare" : "înregistrări"}</span>{entries.length > filteredEntries.length && <small>din {entries.length} în total</small>}</div>{filteredEntries.length ? <div className="bf-allocation-history-list" aria-live="polite">{filteredEntries.map((entry) => <article key={entry.id} className={`bf-allocation-history-entry ${kindTone(entry.kind)}`}><span className="bf-allocation-history-dot" aria-hidden="true" /><div><div className="bf-allocation-history-entry-top"><strong>{kindLabel[entry.kind]}</strong><time dateTime={entry.createdAt}>{dateTime(entry.createdAt)}</time></div><p>{entryTitle(entry)}</p>{entry.note && <small>{entry.note}</small>}</div></article>)}</div> : <div className="bf-allocation-history-empty"><History size={21} /><strong>{entries.length ? "Nicio repartizare pentru filtrele alese" : "Istoricul începe la următoarea schimbare"}</strong><p>{entries.length ? "Lărgește perioada sau alege toate acțiunile pentru a vedea alte înregistrări." : "Modificările viitoare ale plicurilor și transferurile săptămânale vor apărea aici. Intrările vechi care nu au fost jurnalizate nu pot fi reconstruite retroactiv."}</p></div>}</section>;
}
