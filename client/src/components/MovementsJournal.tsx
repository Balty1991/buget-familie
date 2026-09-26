/**
 * Atelierul Financiar / Ledger Flow — Mișcările sunt mai întâi cronologia zilei,
 * iar căutarea, filtrele și exportul rămân un sertar secundar, accesibil.
 */
import "../mobile-movements-pass.css";
import "../movements-flat.css";
import { swipeToDelete } from "@/lib/swipe-delete";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, Download, FileUp, Pencil, Plus, ReceiptText, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { formatDate, isoDate, isoToday, newId, transactionShareScope, type AppData, type ShareScope, type Transaction, type TransactionKind } from "@/lib/finance-data";
import { downloadJournalCsv } from "@/lib/journal-csv";
import { countLabel, getLocale, t } from "@/lib/i18n";
import { MovementConflictBanner } from "@/components/EnvelopeConflictBanner";
import { CategoryGlyph } from "@/components/CategoryGlyph";
import { colorFor } from "@/lib/member-color";
import { takeJournalQuery } from "@/lib/command-search";
import { RoDateInput } from "@/components/RoDateInput";
import { askConfirm } from "@/lib/confirm-dialog";
import { lei } from "@/lib/money-format";

const money = lei;
const exactFormats = new Map<string, Intl.NumberFormat>();
/** Un formatter pe limbă, nu unul pe fiecare rând la fiecare randare. */
const exactMoney = (value: number) => {
  const locale = getLocale();
  let format = exactFormats.get(locale);
  if (!format) { format = new Intl.NumberFormat(locale, { style: "currency", currency: "RON", minimumFractionDigits: 2, maximumFractionDigits: 2 }); exactFormats.set(locale, format); }
  return format.format(value);
};
const dateText = (value: string) => formatDate(value, { day: "2-digit", month: "long", year: "numeric" });

/** Câte zile de registru se arată dintr-o dată; restul, la cerere (30 de zile însemnau ~280 de rânduri). */
const DAYS_PER_PAGE = 10;

/** Luni–duminică în jurul unei zile, fără calendar lunar. */
function weekAround(anchor: string) {
  const date = new Date(`${anchor}T12:00:00`);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(date.getDate() + index);
    return isoDate(day);
  });
}

/** O mișcare nouă (mereu cu data ei) nu trebuie să rămână în afara zilei sau a intervalului deja ales. */
export function revealAddedMovement(filters: { focusDay: string; fromDate: string; toDate: string }, added: Array<{ date: string }>) {
  if (!added.length) return filters;
  const dropDay = Boolean(filters.focusDay) && added.some((item) => item.date !== filters.focusDay);
  const dropRange = added.some((item) => (filters.fromDate && item.date < filters.fromDate) || (filters.toDate && item.date > filters.toDate));
  if (!dropDay && !dropRange) return filters;
  return { focusDay: dropDay ? "" : filters.focusDay, fromDate: dropRange ? "" : filters.fromDate, toDate: dropRange ? "" : filters.toDate };
}

export function MovementsJournal({ data, onEdit, onDelete, onAdd, onOpenReview, onChange }: { data: AppData; onEdit: (item: Transaction) => void; onDelete: (id: string) => void; onAdd: () => void; onOpenReview?: () => void; onChange?: (next: AppData) => void }) {
  const [kind, setKind] = useState<"all" | TransactionKind>("all"); const [member, setMember] = useState("all"); const [source, setSource] = useState("all"); const [shareScope, setShareScope] = useState<"all" | ShareScope>("all"); const [query, setQuery] = useState(() => (typeof window === "undefined" ? "" : takeJournalQuery(window.sessionStorage))); const [fromDate, setFromDate] = useState(""); const [toDate, setToDate] = useState(""); const [focusDay, setFocusDay] = useState(""); const [filtersOpen, setFiltersOpen] = useState(false); const [showSaved, setShowSaved] = useState(false); const [saveName, setSaveName] = useState(""); const [renamingId, setRenamingId] = useState<string | null>(null); const [renameValue, setRenameValue] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ro-RO"); const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const matchesQuery = (item: Transaction) => !normalizedQuery || [item.title, item.category, item.source, item.person, String(item.amount), item.note || ""].join(" ").toLocaleLowerCase("ro-RO").includes(normalizedQuery);
  const clearFilters = () => { setKind("all"); setMember("all"); setSource("all"); setShareScope("all"); setQuery(""); setFromDate(""); setToDate(""); setFocusDay(""); };
  // Pe telefon filtrele sunt o foaie peste listă; Escape o închide ca pe orice foaie.
  useEffect(() => { if (!filtersOpen) return; const root = document.documentElement; root.classList.add("bf-journal-sheet-open"); const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); }; window.addEventListener("keydown", onKey); return () => { root.classList.remove("bf-journal-sheet-open"); window.removeEventListener("keydown", onKey); }; }, [filtersOpen]);
  const filtersActive = [kind !== "all", member !== "all", source !== "all", shareScope !== "all", Boolean(query), Boolean(fromDate), Boolean(toDate), Boolean(focusDay)].filter(Boolean).length;
  const narrowed = useMemo(() => data.transactions.filter((item) => (kind === "all" || item.kind === kind) && (member === "all" || item.memberId === member) && (source === "all" || item.sourceId === source) && (shareScope === "all" || transactionShareScope(item) === shareScope) && (!fromDate || item.date >= fromDate) && (!toDate || item.date <= toDate) && matchesQuery(item)).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), [data.transactions, fromDate, kind, member, normalizedQuery, shareScope, source, toDate]);
  const list = useMemo(() => focusDay ? narrowed.filter((item) => item.date === focusDay) : narrowed, [focusDay, narrowed]);
  const today = isoToday(); const todayMoves = data.transactions.filter((item) => item.date === today && (kind === "all" || item.kind === kind) && (member === "all" || item.memberId === member) && (source === "all" || item.sourceId === source) && (shareScope === "all" || transactionShareScope(item) === shareScope) && matchesQuery(item)); const todayIncome = todayMoves.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0); const todayExpense = todayMoves.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const knownIds = useRef("");
  useEffect(() => {
    const signature = data.transactions.map((item) => item.id).join("\n");
    const previous = knownIds.current;
    knownIds.current = signature;
    if (!previous) return;
    const seen = new Set(previous.split("\n").filter(Boolean));
    const added = data.transactions.filter((item) => !seen.has(item.id));
    if (!added.length) return;
    const next = revealAddedMovement({ focusDay, fromDate, toDate }, added);
    if (next.focusDay !== focusDay) setFocusDay(next.focusDay);
    if (next.fromDate !== fromDate) setFromDate(next.fromDate);
    if (next.toDate !== toDate) setToDate(next.toDate);
  }, [data.transactions, focusDay, fromDate, toDate]);

  /**
   * Gruparea pe zile era scrisă cu `reduce` și `{ ...all }`, deci copia un obiect
   * din ce în ce mai mare pentru fiecare mișcare: pătratic, și recalculat la
   * fiecare randare. Cu trei ani de registru, singurul ecran devenea de nefolosit.
   */
  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const item of list) {
      const day = byDay.get(item.date);
      if (day) day.push(item); else byDay.set(item.date, [item]);
    }
    return Array.from(byDay.entries());
  }, [list]);

  /**
   * Registrul unei familii crește la mii de mișcări. Randate toate deodată,
   * ajungeau la peste o sută de mii de noduri în pagină — ecranul se deschidea
   * greu și derularea se poticnea. Arătăm zilele pe porții; restul, la cerere.
   */
  const daysWithMoves = useMemo(() => new Set(data.transactions.map((item) => item.date)), [data.transactions]);
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);
  useEffect(() => setVisibleDays(DAYS_PER_PAGE), [list]);
  const shownGroups = groups.slice(0, visibleDays);
  const hiddenMoves = groups.slice(visibleDays).reduce((sum, [, moves]) => sum + moves.length, 0);
  const saveLocalFilters = (savedJournalFilters: AppData["settings"]["savedJournalFilters"]) => window.dispatchEvent(new CustomEvent("buget-familie:local-settings", { detail: { savedJournalFilters } }));
  const applyFilter = (filter: AppData["settings"]["savedJournalFilters"][number]) => { setKind(filter.kind); setMember(filter.memberId && data.settings.members.some((item) => item.id === filter.memberId) ? filter.memberId : "all"); setSource(filter.sourceId && data.settings.paymentSources.some((item) => item.id === filter.sourceId) ? filter.sourceId : "all"); setShareScope(filter.shareScope === "personal" || filter.shareScope === "shared" ? filter.shareScope : "all"); setQuery(filter.query || ""); setFromDate(filter.fromDate || ""); setToDate(filter.toDate || ""); setShowSaved(false); setFiltersOpen(false); };
  const saveCurrentFilter = () => { const label = saveName.trim(); if (!label || invalidRange) return; const now = new Date().toISOString(); const existing = data.settings.savedJournalFilters.find((item) => item.label.toLocaleLowerCase("ro-RO") === label.toLocaleLowerCase("ro-RO")); const draft = { id: existing?.id || newId("saved-filter"), label, kind, memberId: member === "all" ? undefined : member, sourceId: source === "all" ? undefined : source, shareScope: shareScope === "all" ? undefined : shareScope, query: query.trim() || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, updatedAt: now }; saveLocalFilters([draft, ...data.settings.savedJournalFilters.filter((item) => item.id !== draft.id)].slice(0, 8)); setSaveName(""); setShowSaved(true); };
  const renameFilter = (filter: AppData["settings"]["savedJournalFilters"][number]) => { setRenamingId(filter.id); setRenameValue(filter.label); };
  const commitRename = () => {
    const label = renameValue.trim();
    if (!renamingId || !label) { setRenamingId(null); return; }
    saveLocalFilters(data.settings.savedJournalFilters.map((item) => item.id === renamingId ? { ...item, label, updatedAt: new Date().toISOString() } : item));
    setRenamingId(null);
  };
  const deleteFilter = async (filter: AppData["settings"]["savedJournalFilters"][number]) => { if (await askConfirm(t("Ștergi filtrul local „{label}”?", { label: filter.label }))) saveLocalFilters(data.settings.savedJournalFilters.filter((item) => item.id !== filter.id)); };
  const envelopeCaption = (item: Transaction) => {
    if (!item.allocationId) return "";
    if (item.allocationId === "outside") return t("în afara plicurilor");
    return data.settings.salaryPlan.allocations.find((entry) => entry.id === item.allocationId)?.label || t("plic alocat");
  };
  return <div className="bf-page bf-movements-ledger">{onChange ? <MovementConflictBanner data={data} onChange={onChange} /> : null}<header className="bf-movements-header is-compact"><div><h1>{t("Ce s-a mișcat")} <em>{t("astăzi.")}</em></h1><p className="bf-movements-today-line">{todayMoves.length ? countLabel(todayMoves.length, { one: "{count} mișcare", few: "{count} mișcări", many: "{count} de mișcări" }) : t("Nicio mișcare încă")}{todayIncome > 0 ? ` · +${money(todayIncome)}` : ""}{todayExpense > 0 ? ` · −${money(todayExpense)}` : ""}</p></div><button type="button" className="bf-movement-add" aria-label={t("Adaugă mișcare")} title={t("Adaugă mișcare")} onClick={onAdd}><Plus size={20} aria-hidden="true" /></button></header><div className="bf-week-strip" role="tablist" aria-label={t("Săptămâna asta")}>{weekAround(today).map((day) => { const letter = new Intl.DateTimeFormat(getLocale(), { weekday: "narrow" }).format(new Date(`${day}T12:00:00`)); const has = daysWithMoves.has(day); return <button key={day} type="button" role="tab" aria-selected={focusDay === day} className={`${focusDay === day ? "is-on" : ""}${day === today ? " is-today" : ""}${has ? " has-moves" : ""}`} onClick={() => setFocusDay((current) => current === day ? "" : day)}><small>{letter}</small><b>{Number(day.slice(8))}</b></button>; })}</div><section className="bf-journal-quickbar"><div className="bf-movement-kind" role="group" aria-label={t("Tip mișcare")}><button className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>{t("Toate")}</button><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>{t("Ieșiri")}</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>{t("Intrări")}</button></div><label className="bf-journal-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Caută mișcarea")} aria-label={t("Caută în jurnal")} />{query && <button onClick={() => setQuery("")} aria-label={t("Șterge căutarea")}><X size={16} /></button>}<small>{list.length}</small></label><button className={`bf-journal-filter-toggle ${filtersOpen ? "active" : ""}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={16} /> {t("Filtre")}{filtersActive ? ` · ${filtersActive}` : ""}</button></section>{data.settings.members.length > 1 && <div className="bf-movement-scope" role="group" aria-label={t("Perspectivă: personale sau comune")}><button type="button" className={shareScope === "all" ? "active" : ""} onClick={() => setShareScope("all")}>{t("Toate")}</button><button type="button" className={shareScope === "shared" ? "active" : ""} onClick={() => setShareScope("shared")}>{t("Comune")}</button><button type="button" className={shareScope === "personal" ? "active" : ""} onClick={() => setShareScope("personal")}>{t("Personale")}</button></div>}{filtersOpen && <><button type="button" className="bf-journal-filter-backdrop" aria-label={t("Închide filtrele")} onClick={() => setFiltersOpen(false)} /><section className="bf-journal-filter-sheet" role="dialog" aria-label={t("Filtre, export și filtre locale")}><div className="bf-journal-filter-head"><b>{t("Filtre")}{filtersActive ? ` · ${filtersActive}` : ""}</b><button type="button" onClick={() => setFiltersOpen(false)}>{t("Gata")} · {list.length}</button></div><div className="bf-journal-date-range"><label>{t("De la")}<RoDateInput value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>{t("Până la")}<RoDateInput min={fromDate || undefined} value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div><div className="bf-movement-filter-selects"><label>{t("Persoană")}<select value={member} onChange={(event) => setMember(event.target.value)}><option value="all">{t("Toți membrii")}</option>{data.settings.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t("Sursă")}<select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">{t("Toate sursele")}</option>{data.settings.paymentSources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{t("Perspectivă")}<select value={shareScope} onChange={(event) => setShareScope(event.target.value as "all" | ShareScope)}><option value="all">{t("Toate")}</option><option value="shared">{t("Comun (familie)")}</option><option value="personal">{t("Personal")}</option></select></label></div>{invalidRange && <p className="bf-form-error">{t("Data finală trebuie să fie după data de început.")}</p>}{onOpenReview && <button type="button" className="bf-journal-bank-import" onClick={onOpenReview}><FileUp size={17} /> {t("Adu extrasul băncii")}<small>{t("CSV → De verificat")}</small></button>}<div className="bf-journal-export-actions"><button className="bf-journal-export" type="button" disabled={!list.length || invalidRange} onClick={() => downloadJournalCsv(list, `jurnal-${fromDate || "toate"}-${toDate || "prezent"}.csv`, data)}><Download size={16} /> {t("Exportă CSV")} · {list.length}</button>{filtersActive > 0 && <button className="bf-journal-clear" onClick={clearFilters}>{t("Resetează")}</button>}<button type="button" className="saved-list" onClick={() => setShowSaved((value) => !value)}>{t("Filtre salvate")} · {data.settings.savedJournalFilters.length}</button></div><div className="bf-journal-save-filter"><input value={saveName} onChange={(event) => setSaveName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCurrentFilter(); }} maxLength={42} placeholder={t("Nume pentru filtrul local")} /><button type="button" disabled={!saveName.trim() || invalidRange} onClick={saveCurrentFilter}>{t("Salvează")}</button></div>{showSaved && <div className="bf-journal-saved-list" aria-label={t("Filtre locale salvate")}>{data.settings.savedJournalFilters.map((filter) => <article key={filter.id}>{renamingId === filter.id ? <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commitRename(); if (event.key === "Escape") setRenamingId(null); }} onBlur={commitRename} autoFocus maxLength={42} aria-label={t("Nume nou pentru filtrul local")} /> : <button type="button" className="apply" onClick={() => applyFilter(filter)}><b>{filter.label}</b><small>{filter.kind === "income" ? t("Intrări") : filter.kind === "expense" ? t("Ieșiri") : t("Toate")}{filter.query ? ` · ${filter.query}` : ""}</small></button>}<button type="button" aria-label={t("Redenumește {label}", { label: filter.label })} onClick={() => renamingId === filter.id ? commitRename() : renameFilter(filter)}><Pencil size={15} /></button><button type="button" aria-label={t("Șterge {label}", { label: filter.label })} onClick={() => deleteFilter(filter)}><Trash2 size={15} /></button></article>)}{!data.settings.savedJournalFilters.length && <p>{t("Nu ai filtre salvate pe acest telefon.")}</p>}</div>}</section></>}<section className="bf-movement-timeline" aria-label={t("Cronologia mișcărilor")}>{shownGroups.map(([date, moves]) => { const inflow = moves.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0); const outflow = moves.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0); return <section key={date} className="bf-movement-day"><header><time dateTime={date}>{date === today ? t("Astăzi") : dateText(date)}</time><span>{inflow > 0 && <b className="income">+{money(inflow)}</b>}{outflow > 0 && <b className="expense">−{money(outflow)}</b>}</span></header><div>{moves.map((item) => <article key={item.id} className="bf-movement-row" {...swipeToDelete(() => onDelete(item.id))}><button type="button" className="bf-movement-open" onClick={() => onEdit(item)}><span className={`bf-tx-icon ${item.kind}`}>{item.kind === "income" ? <ArrowDownRight size={17} /> : <CategoryGlyph category={item.category} size={17} />}</span><span className="bf-movement-copy"><b>{item.title}</b><small>{colorFor(data, item.memberId) && <i className="bf-member-dot" style={{ background: colorFor(data, item.memberId) }} aria-hidden="true" />}{item.person} · {item.source}{transactionShareScope(item) === "personal" ? ` · ${t("Personal")}` : ""} · {t(item.category)}{envelopeCaption(item) ? ` · ${envelopeCaption(item)}` : ""}</small></span><strong className={item.kind}>{item.kind === "income" ? "+" : "−"}{exactMoney(item.amount)}</strong></button><div className="bf-movement-actions"><button type="button" aria-label={t("Șterge {title}", { title: item.title })} onClick={async () => await askConfirm(t("Ștergi mișcarea „{title}”?", { title: item.title })) && onDelete(item.id)}><Trash2 size={15} /></button></div></article>)}</div></section>; })}{hiddenMoves > 0 && <button type="button" className="bf-journal-more" onClick={() => setVisibleDays((value) => value + DAYS_PER_PAGE)}>{t("Arată mișcările mai vechi")} · {hiddenMoves}</button>}{!list.length && <div className="bf-empty-state"><ReceiptText size={24} /><h2>{t("Nu sunt mișcări pentru această selecție")}</h2><p>{filtersActive ? t("Resetează filtrele sau schimbă perspectiva pentru alte intrări.") : t("Înregistrează prima intrare sau ieșire din zi.")}</p><button className="bf-primary" onClick={onAdd}><Plus size={16} /> {t("Adaugă mișcare")}</button></div>}</section></div>;
}
