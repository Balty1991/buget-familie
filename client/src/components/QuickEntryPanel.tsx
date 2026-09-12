/**
 * Atelier Financiar — captură rapidă locală care respectă plicul compatibil și tranșa activă.
 * Filosofie: sursa plății poate aparține unui alt membru; plicul se alege după categoria și sursa reală.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, BookmarkPlus, Check, Plus, Trash2, X } from "lucide-react";
import { BASE_CURRENCY, allocationStatus, allocationWeekStatus, exchangeRateFor, expenseCategories, formatDate, isoToday, matchingAllocationsForExpense, newId, parseRomanianAmount, sourceBalance, sourceCurrency, toBaseAmount, type AppData, type QuickTransactionTemplate, type Transaction, type TransactionKind } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { getLocale, t } from "@/lib/i18n";

const money = new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 });

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
  const captureIdRef = useRef(newId("tx"));
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

  /** Sursa aleasă dă valuta; fără marcaj vizibil utilizatorul ar tasta euro crezând că sunt lei. */
  const entryCurrency = sourceCurrency(data, sourceId);
  const isForeign = entryCurrency !== BASE_CURRENCY;
  const entryRate = exchangeRateFor(data, entryCurrency);
  const convertedPreview = isForeign ? toBaseAmount(parseRomanianAmount(amount), entryRate) : undefined;
  const chooseManual = () => { setTemplateId(""); setTemplateLabel(""); setError(""); };
  const selectTemplate = (template: QuickTransactionTemplate) => {
    setTemplateId(template.id); setKind(template.kind); setCategory(template.category); setAmount(template.amount ? String(template.amount) : "");
    if (template.memberId) setMemberId(template.memberId); if (template.sourceId) setSourceId(template.sourceId); setTemplateLabel(template.label); setIncomeLabel(template.kind === "income" ? template.label : ""); setAllocationChoiceTouched(false); setError("");
  };
  const save = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    if (numeric <= 0) return setError(t("Introdu o sumă mai mare decât zero."));
    if (!member || !source) return setError(t("Alege un membru și o sursă de plată."));
    // Suma tastată este în valuta sursei; fără curs nu o putem trece în registru, care e în lei.
    const foreign = source.currency && source.currency !== BASE_CURRENCY ? source.currency : undefined;
    const rate = exchangeRateFor(data, foreign);
    const stored = foreign ? toBaseAmount(numeric, rate) : numeric;
    if (foreign && !stored) return setError(t("Adaugă în Setări cursul pentru {currency} înainte de a folosi această sursă.", { currency: foreign }));
    if (kind === "expense" && allocationId !== "outside" && !matchedAllocation) return setError(t("Plicul nu mai corespunde categoriei sau sursei. Alege din nou."));
    onSave({ id: captureIdRef.current, title: activeTemplate?.label || (kind === "expense" ? t("Cheltuială rapidă · {category}", { category: t(category) }) : incomeLabel.trim() || t("Venit rapid")), amount: stored || numeric, originalAmount: foreign ? numeric : undefined, originalCurrency: foreign, exchangeRate: foreign ? rate : undefined, kind, category: kind === "expense" ? category : "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: isoToday(), allocationId: kind === "expense" ? allocationId : undefined, createdAt: new Date().toISOString() });
    onClose();
  };
  const remember = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId); const label = templateLabel.trim() || (kind === "expense" ? category : incomeLabel.trim() || t("Venit rapid"));
    if (!member || !source) return setError(t("Alege membrul și sursa înainte de salvarea șablonului."));
    onSaveTemplate({ id: templateId || newId("quick-template"), label, kind, category: kind === "expense" ? category : "Venit", amount: Math.max(0, numeric), memberId: member.id, sourceId: source.id, updatedAt: new Date().toISOString() });
    setTemplateLabel(label); setError("");
  };
  const archive = () => { if (!templateId || !activeTemplate) return; if (!window.confirm(t("Arhivezi șablonul local „{label}”? Îl poți restaura ulterior; tranzacțiile rămân neschimbate.", { label: activeTemplate.label }))) return; onArchiveTemplate(templateId); chooseManual(); };
  const remove = () => { if (!templateId) return; if (!window.confirm(t("Ștergi definitiv șablonul local „{label}”? Tranzacțiile rămân neschimbate.", { label: activeTemplate?.label || t("acesta") }))) return; onDeleteTemplate(templateId); chooseManual(); };
  const removeArchived = (id: string, label: string) => { if (window.confirm(t("Ștergi definitiv șablonul arhivat „{label}”? Tranzacțiile rămân neschimbate.", { label }))) onDeleteArchivedTemplate(id); };
  const sourceOwner = (id: string) => data.settings.members.find((member) => member.id === data.settings.paymentSources.find((source) => source.id === id)?.memberId)?.name || "Familie / comun";
  const recentCategories = Array.from(new Set(data.transactions.filter((item) => item.kind === "expense" && item.category !== "Venit").map((item) => item.category))).slice(0, 4);
  const recentAmounts = useMemo(() => [...data.transactions].filter((item) => item.kind === kind && item.amount > 0).sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || "")).map((item) => item.amount).filter((amount, index, all) => all.indexOf(amount) === index).slice(0, 4), [data.transactions, kind]);
  const parsedAmount = parseRomanianAmount(amount);
  const selectedSourceBalance = sourceId ? sourceBalance(data, sourceId) : 0;
  const projectedSourceBalance = selectedSourceBalance + (kind === "income" ? parsedAmount : -parsedAmount);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);

  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (event.target === event.currentTarget) onClose();
  };

  return <div className="bf-modal-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
    <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-quick-entry-panel" role="dialog" aria-modal="true" aria-label={t("Înregistrare rapidă")} onPointerDown={(event) => event.stopPropagation()}>
      <header><div><p className="bf-kicker">{t("CAPTURĂ ÎN CÂTEVA SECUNDE")}</p><h2>{t("Înregistrare rapidă")}</h2></div><button className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={19} /></button></header>
      <p className="bf-quick-entry-intro">{t("Salvezi o mișcare reală cu data de azi. Dacă există un plic pentru categoria și sursa aleasă, el este selectat automat.")}</p>
      <div className="bf-template-header-actions"><span>{t("{count} șabloane active", { count: data.settings.quickTemplates.length })}</span><button type="button" onClick={() => setShowArchive((value) => !value)}><Archive size={15} /> {t("Arhivă")}{data.settings.archivedQuickTemplates.length ? ` (${data.settings.archivedQuickTemplates.length})` : ""}</button></div>
      {showArchive && <section className="bf-template-archive" aria-label={t("Arhiva lunară a șabloanelor")}><p className="bf-kicker">{t("ARHIVĂ LOCALĂ")}</p>{archiveGroups.map(([month, items]) => <div key={month}><h3>{formatDate(`${month}-01`, { month: "long", year: "numeric" })}</h3>{items.map((item) => <article key={item.id}><div><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : t("sumă liberă")} · arhivat {formatDate(item.archivedAt)}</small></div><div className="bf-template-archive-actions"><button type="button" onClick={() => onRestoreTemplate(item.id)}><ArchiveRestore size={15} /> {t("Restaurează")}</button><button type="button" className="danger" aria-label={`Șterge definitiv ${item.label}`} onClick={() => removeArchived(item.id, item.label)}><Trash2 size={15} /></button></div></article>)}</div>)}{!archiveGroups.length && <p className="bf-empty-inline">{t("Nu ai șabloane arhivate. Arhivează un șablon activ pentru a-l păstra în istoricul local.")}</p>}</section>}
      {data.settings.quickTemplates.length > 0 && <div className="bf-quick-template-rail" role="list" aria-label={t("Șabloane locale")}><button role="listitem" className={!templateId ? "active" : ""} onClick={chooseManual}>Manual</button>{data.settings.quickTemplates.map((item) => <button role="listitem" key={item.id} className={templateId === item.id ? "active" : ""} onClick={() => selectTemplate(item)}><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : t("sumă liberă")}</small></button>)}</div>}
      <div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>{t("Cheltuială")}</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>Venit</button></div>
      {kind === "expense" && recentCategories.length > 0 && <div className="bf-quick-category-picks" aria-label="Categorii folosite recent"><span>Folosite recent</span>{recentCategories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setAllocationChoiceTouched(false); }}>{item}</button>)}</div>}
      <div className="bf-quick-entry-grid"><label className="bf-field bf-amount-field"><span>{t("Sumă ({currency})", { currency: isForeign ? entryCurrency : t("lei") })}</span><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} inputMode="decimal" placeholder="0,00" aria-describedby="bf-quick-amount-hint" />{recentAmounts.length > 0 && <span className="bf-amount-suggestions" id="bf-quick-amount-hint"><span>{t("Folosit recent")}</span>{recentAmounts.map((value) => <button type="button" key={value} onClick={() => { setAmount(String(value)); setError(""); }}>{money.format(value)}</button>)}</span>}</label>{kind === "expense" ? <label className="bf-field"><span>{t("Categorie")}</span><select value={category} onChange={(event) => { setCategory(event.target.value); setAllocationChoiceTouched(false); }}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label> : <label className="bf-field"><span>{t("Ce venit?")}</span><input value={incomeLabel} onChange={(event) => setIncomeLabel(event.target.value)} placeholder={t("ex. Salariu, Bonus")} /></label>}<label className="bf-field"><span>{t("Cine a înregistrat")}</span><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setAllocationChoiceTouched(false); }}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="bf-field"><span>{kind === "expense" ? t("Plătit din") : t("Încasat în")}</span><select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setAllocationChoiceTouched(false); }}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}{data.settings.members.length > 1 && source.memberId ? ` · ${sourceOwner(source.id)}` : ""} · {money.format(sourceBalance(data, source.id))}{source.currency ? ` (${source.currency})` : ""}</option>)}</select></label></div>{isForeign && <section className={`bf-currency-preview ${convertedPreview ? "" : "pending"}`}><p className="bf-kicker">{t("SE ÎNREGISTREAZĂ ÎN LEI")}</p>{convertedPreview ? <><b>{money.format(convertedPreview)}</b><span>La cursul de {entryRate?.toLocaleString(getLocale(), { maximumFractionDigits: 4 })} {t("lei pentru 1")} {entryCurrency}{t(", salvat în Setări.")}</span></> : <span>{entryRate ? t("Completează suma în {currency}.", { currency: entryCurrency }) : t("Adaugă în Setări cursul pentru {currency} înainte de a folosi această sursă.", { currency: entryCurrency })}</span>}</section>}
      {parsedAmount > 0 && <p className={`bf-quick-source-preview ${projectedSourceBalance < 0 ? "over" : ""}`} aria-live="polite">{kind === "expense" ? t("După această plată") : t("După această încasare")}: <b>{money.format(Math.max(0, projectedSourceBalance))}</b> rămân în {data.settings.paymentSources.find((source) => source.id === sourceId)?.name || t("sursa aleasă")}{projectedSourceBalance < 0 ? t(" — suma depășește soldul curent") : ""}.</p>}
      {kind === "expense" && <section className="bf-quick-envelope"><p className="bf-kicker">{t("PLICUL SĂPTĂMÂNII")}</p><label className="bf-field"><span>{t("Se consumă din")}</span><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}><option value="outside">{t("În afara plicurilor")}</option>{candidates.map((allocation) => { const activeWeek = allocation.weeklyPace === false ? undefined : allocationWeekStatus(data, allocation); const totalRemaining = allocation.weeklyPace === false ? allocationStatus(data, allocation).remaining : undefined; return <option key={allocation.id} value={allocation.id}>{allocation.label} · {activeWeek ? t("{amount} în S{index}", { amount: money.format(Math.max(0, activeWeek.remaining)), index: activeWeek.index }) : totalRemaining !== undefined ? t("{amount} rămași", { amount: money.format(Math.max(0, totalRemaining)) }) : t("fără tranșă activă")}</option>; })}</select></label>{matchedAllocation && <p className={(week && week.remaining - parseRomanianAmount(amount) < 0) || (matchedTotal && matchedTotal.remaining - parseRomanianAmount(amount) < 0) ? "over" : ""}>{week ? t("S{index}: {remaining} rămași din {budget}{after}", { index: week.index, remaining: money.format(Math.max(0, week.remaining)), budget: money.format(week.budget), after: parseRomanianAmount(amount) > 0 ? t(" · după plată {left}", { left: money.format(Math.max(0, week.remaining - parseRomanianAmount(amount))) }) : "" }) : matchedTotal ? t("{remaining} rămași din {budget}{after}", { remaining: money.format(Math.max(0, matchedTotal.remaining)), budget: money.format(matchedTotal.budget), after: parseRomanianAmount(amount) > 0 ? t(" · după plată {left}", { left: money.format(Math.max(0, matchedTotal.remaining - parseRomanianAmount(amount))) }) : "" }) : t("Plic selectat; încă nu este activă o tranșă calendaristică.")}</p>}{!candidates.length && <p>{t("Nu există plic pentru această categorie și sursă. Poți salva în afara plicurilor.")}</p>}</section>}
      <details className="bf-template-save"><summary><BookmarkPlus size={16} /> {templateId ? t("Editează șablonul selectat") : t("Salvează combinația ca șablon local")}</summary><label className="bf-field"><span>{t("Nume șablon")}</span><input value={templateLabel} onChange={(event) => setTemplateLabel(event.target.value)} placeholder="ex. Taxi serviciu" /></label><div className="bf-template-actions"><button type="button" onClick={remember}>{templateId ? t("Actualizează șablonul") : t("Păstrează pe acest telefon")}</button>{templateId && <><button type="button" onClick={archive}><Archive size={15} /> {t("Arhivează")}</button><button type="button" className="danger" onClick={remove}><Trash2 size={15} /> {t("Șterge")}</button></>}</div></details>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      <button className="bf-primary full" onClick={save}><Check size={17} /> {t("Salvează acum")}</button><button className="bf-quick-entry-more" onClick={onMore}><Plus size={16} /> {t("Adaugă notiță, altă dată sau corectează")}</button>
    </section>
  </div>;
}
