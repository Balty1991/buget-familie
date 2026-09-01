/**
 * Atelier Financiar — captură rapidă locală care respectă plicul compatibil și tranșa activă.
 * Filosofie: sursa plății poate aparține unui alt membru; plicul se alege după categoria și sursa reală.
 */
import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, BookmarkPlus, Check, Plus, Trash2, X } from "lucide-react";
import { allocationStatus, allocationWeekStatus, expenseCategories, formatDate, isoToday, matchingAllocationsForExpense, newId, parseRomanianAmount, sourceBalance, type AppData, type QuickTransactionTemplate, type Transaction, type TransactionKind } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";

const money = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });

type Props = { data: AppData; onSave: (item: Transaction) => void; onClose: () => void; onMore: () => void; onSaveTemplate: (item: QuickTransactionTemplate) => void; onDeleteTemplate: (id: string) => void; onArchiveTemplate: (id: string) => void; onRestoreTemplate: (id: string) => void; onDeleteArchivedTemplate: (id: string) => void; };

export function QuickEntryPanel({ data, onSave, onClose, onMore, onSaveTemplate, onDeleteTemplate, onArchiveTemplate, onRestoreTemplate, onDeleteArchivedTemplate }: Props) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimente");
  const [incomeLabel, setIncomeLabel] = useState("");
  const [memberId, setMemberId] = useState(data.settings.members[0]?.id || "");
  const [sourceId, setSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [allocationId, setAllocationId] = useState("outside");
  const [allocationChoiceTouched, setAllocationChoiceTouched] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [templateLabel, setTemplateLabel] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [error, setError] = useState("");
  const activeTemplate = data.settings.quickTemplates.find((item) => item.id === templateId);
  const candidates = kind === "expense" ? matchingAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const candidateIds = candidates.map((item) => item.id).join("|");
  const matchedAllocation = candidates.find((item) => item.id === allocationId);
  const week = matchedAllocation && matchedAllocation.weeklyPace !== false ? allocationWeekStatus(data, matchedAllocation) : undefined;
  const matchedTotal = matchedAllocation && matchedAllocation.weeklyPace === false ? allocationStatus(data, matchedAllocation) : undefined;
  const archiveGroups = useMemo(() => Object.entries(data.settings.archivedQuickTemplates.reduce<Record<string, typeof data.settings.archivedQuickTemplates>>((all, item) => {
    const month = item.archivedAt.slice(0, 7); return { ...all, [month]: [...(all[month] || []), item] };
  }, {})).sort(([left], [right]) => right.localeCompare(left)), [data.settings.archivedQuickTemplates]);

  useEffect(() => {
    if (!data.settings.paymentSources.some((source) => source.id === sourceId)) setSourceId(data.settings.paymentSources[0]?.id || "");
  }, [data.settings.paymentSources, sourceId]);
  useEffect(() => {
    if (kind !== "expense") { if (allocationId !== "outside") setAllocationId("outside"); return; }
    const currentIsValid = allocationId !== "outside" && candidates.some((item) => item.id === allocationId);
    if (!currentIsValid && allocationId !== "outside") setAllocationId(candidates[0]?.id || "outside");
    if (!allocationChoiceTouched && allocationId === "outside" && candidates[0]) setAllocationId(candidates[0].id);
  }, [allocationChoiceTouched, allocationId, candidateIds, kind]);

  const chooseManual = () => { setTemplateId(""); setTemplateLabel(""); setError(""); };
  const selectTemplate = (template: QuickTransactionTemplate) => {
    setTemplateId(template.id); setKind(template.kind); setCategory(template.category); setAmount(template.amount ? String(template.amount) : "");
    if (template.memberId) setMemberId(template.memberId); if (template.sourceId) setSourceId(template.sourceId); setTemplateLabel(template.label); setIncomeLabel(template.kind === "income" ? template.label : ""); setAllocationChoiceTouched(false); setError("");
  };
  const save = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    if (numeric <= 0) return setError("Introdu o sumă mai mare decât zero.");
    if (!member || !source) return setError("Alege un membru și o sursă de plată.");
    if (kind === "expense" && allocationId !== "outside" && !matchedAllocation) return setError("Plicul nu mai corespunde categoriei sau sursei. Alege din nou.");
    onSave({ id: newId("tx"), title: activeTemplate?.label || (kind === "expense" ? `Cheltuială rapidă · ${category}` : incomeLabel.trim() || "Venit rapid"), amount: numeric, kind, category: kind === "expense" ? category : "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: isoToday(), allocationId: kind === "expense" ? allocationId : undefined, createdAt: new Date().toISOString() });
    onClose();
  };
  const remember = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId); const label = templateLabel.trim() || (kind === "expense" ? category : incomeLabel.trim() || "Venit rapid");
    if (!member || !source) return setError("Alege membrul și sursa înainte de salvarea șablonului.");
    onSaveTemplate({ id: templateId || newId("quick-template"), label, kind, category: kind === "expense" ? category : "Venit", amount: Math.max(0, numeric), memberId: member.id, sourceId: source.id, updatedAt: new Date().toISOString() });
    setTemplateLabel(label); setError("");
  };
  const archive = () => { if (!templateId || !activeTemplate) return; if (!window.confirm(`Arhivezi șablonul local „${activeTemplate.label}”? Îl poți restaura ulterior; tranzacțiile rămân neschimbate.`)) return; onArchiveTemplate(templateId); chooseManual(); };
  const remove = () => { if (!templateId) return; if (!window.confirm(`Ștergi definitiv șablonul local „${activeTemplate?.label || "acesta"}”? Tranzacțiile rămân neschimbate.`)) return; onDeleteTemplate(templateId); chooseManual(); };
  const removeArchived = (id: string, label: string) => { if (window.confirm(`Ștergi definitiv șablonul arhivat „${label}”? Tranzacțiile rămân neschimbate.`)) onDeleteArchivedTemplate(id); };
  const sourceOwner = (id: string) => data.settings.members.find((member) => member.id === data.settings.paymentSources.find((source) => source.id === id)?.memberId)?.name || "Familie / comun";
  const recentCategories = Array.from(new Set(data.transactions.filter((item) => item.kind === "expense" && item.category !== "Venit").map((item) => item.category))).slice(0, 4);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);

  return <div className="bf-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-quick-entry-panel" role="dialog" aria-modal="true" aria-label="Înregistrare rapidă" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="bf-kicker">CAPTURĂ ÎN CÂTEVA SECUNDE</p><h2>Înregistrare rapidă</h2></div><button className="bf-icon-button" aria-label="Închide" onClick={onClose}><X size={19} /></button></header>
      <p className="bf-quick-entry-intro">Salvezi o mișcare reală cu data de azi. Dacă există un plic pentru categoria și sursa aleasă, el este selectat automat.</p>
      <div className="bf-template-header-actions"><span>{data.settings.quickTemplates.length} șabloane active</span><button type="button" onClick={() => setShowArchive((value) => !value)}><Archive size={15} /> Arhivă{data.settings.archivedQuickTemplates.length ? ` (${data.settings.archivedQuickTemplates.length})` : ""}</button></div>
      {showArchive && <section className="bf-template-archive" aria-label="Arhiva lunară a șabloanelor"><p className="bf-kicker">ARHIVĂ LOCALĂ</p>{archiveGroups.map(([month, items]) => <div key={month}><h3>{formatDate(`${month}-01`, { month: "long", year: "numeric" })}</h3>{items.map((item) => <article key={item.id}><div><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : "sumă liberă"} · arhivat {formatDate(item.archivedAt)}</small></div><div className="bf-template-archive-actions"><button type="button" onClick={() => onRestoreTemplate(item.id)}><ArchiveRestore size={15} /> Restaurează</button><button type="button" className="danger" aria-label={`Șterge definitiv ${item.label}`} onClick={() => removeArchived(item.id, item.label)}><Trash2 size={15} /></button></div></article>)}</div>)}{!archiveGroups.length && <p className="bf-empty-inline">Nu ai șabloane arhivate. Arhivează un șablon activ pentru a-l păstra în istoricul local.</p>}</section>}
      {data.settings.quickTemplates.length > 0 && <div className="bf-quick-template-rail" role="list" aria-label="Șabloane locale"><button role="listitem" className={!templateId ? "active" : ""} onClick={chooseManual}>Manual</button>{data.settings.quickTemplates.map((item) => <button role="listitem" key={item.id} className={templateId === item.id ? "active" : ""} onClick={() => selectTemplate(item)}><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : "sumă liberă"}</small></button>)}</div>}
      <div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>Cheltuială</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>Venit</button></div>
      {kind === "expense" && recentCategories.length > 0 && <div className="bf-quick-category-picks" aria-label="Categorii folosite recent"><span>Folosite recent</span>{recentCategories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setAllocationChoiceTouched(false); }}>{item}</button>)}</div>}
      <div className="bf-quick-entry-grid"><label className="bf-field"><span>Sumă (lei)</span><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} inputMode="decimal" placeholder="0,00" /></label>{kind === "expense" ? <label className="bf-field"><span>Categorie</span><select value={category} onChange={(event) => { setCategory(event.target.value); setAllocationChoiceTouched(false); }}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item}>{item}</option>)}</select></label> : <label className="bf-field"><span>Ce venit?</span><input value={incomeLabel} onChange={(event) => setIncomeLabel(event.target.value)} placeholder="ex. Salariu, Bonus" /></label>}<label className="bf-field"><span>Cine a înregistrat</span><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setAllocationChoiceTouched(false); }}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="bf-field"><span>{kind === "expense" ? "Plătit din" : "Încasat în"}</span><select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setAllocationChoiceTouched(false); }}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {sourceOwner(source.id)} · {money.format(sourceBalance(data, source.id))}</option>)}</select></label></div>
      {kind === "expense" && <section className="bf-quick-envelope"><p className="bf-kicker">PLICUL SĂPTĂMÂNII</p><label className="bf-field"><span>Se consumă din</span><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}><option value="outside">În afara plicurilor — doar soldul sursei</option>{candidates.map((allocation) => { const activeWeek = allocation.weeklyPace === false ? undefined : allocationWeekStatus(data, allocation); const totalRemaining = allocation.weeklyPace === false ? allocationStatus(data, allocation).remaining : undefined; return <option key={allocation.id} value={allocation.id}>{allocation.label} · {activeWeek ? `${money.format(Math.max(0, activeWeek.remaining))} în S${activeWeek.index}` : totalRemaining !== undefined ? `${money.format(Math.max(0, totalRemaining))} rămași` : "fără tranșă activă"}</option>; })}</select></label>{matchedAllocation && <p className={(week && week.remaining - parseRomanianAmount(amount) < 0) || (matchedTotal && matchedTotal.remaining - parseRomanianAmount(amount) < 0) ? "over" : ""}>{week ? `S${week.index}: ${money.format(Math.max(0, week.remaining))} rămași din ${money.format(week.budget)}${parseRomanianAmount(amount) > 0 ? ` · după plată ${money.format(Math.max(0, week.remaining - parseRomanianAmount(amount)))}` : ""}` : matchedTotal ? `${money.format(Math.max(0, matchedTotal.remaining))} rămași din ${money.format(matchedTotal.budget)}${parseRomanianAmount(amount) > 0 ? ` · după plată ${money.format(Math.max(0, matchedTotal.remaining - parseRomanianAmount(amount)))}` : ""}` : "Plic selectat; încă nu este activă o tranșă calendaristică."}</p>}{!candidates.length && <p>Nu există plic pentru această categorie și sursă. Poți salva în afara plicurilor.</p>}</section>}
      <details className="bf-template-save"><summary><BookmarkPlus size={16} /> {templateId ? "Editează șablonul selectat" : "Salvează combinația ca șablon local"}</summary><label className="bf-field"><span>Nume șablon</span><input value={templateLabel} onChange={(event) => setTemplateLabel(event.target.value)} placeholder="ex. Taxi serviciu" /></label><div className="bf-template-actions"><button type="button" onClick={remember}>{templateId ? "Actualizează șablonul" : "Păstrează pe acest telefon"}</button>{templateId && <><button type="button" onClick={archive}><Archive size={15} /> Arhivează</button><button type="button" className="danger" onClick={remove}><Trash2 size={15} /> Șterge</button></>}</div></details>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      <button className="bf-primary full" onClick={save}><Check size={17} /> Salvează acum</button><button className="bf-quick-entry-more" onClick={onMore}><Plus size={16} /> Adaugă notiță, altă dată sau corectează</button>
    </section>
  </div>;
}
