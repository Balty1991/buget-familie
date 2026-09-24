/**
 * Atelier Financiar — captură rapidă locală care respectă plicul compatibil și tranșa activă.
 * Filosofie: sursa plății poate aparține unui alt membru; plicul se alege după categoria și sursa reală.
 */
import "../currency.css";
import "../transaction-envelope-picker.css";
import "../mobile-capture-pass.css";
import "../receipt-form-fix.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, Baby, BookmarkPlus, Bus, Check, CreditCard, Ellipsis, HeartPulse, House, Plus, ShoppingCart, Ticket, Trash2, X } from "lucide-react";
import { amountError, BASE_CURRENCY, allocationStatus, allocationWeeksStatus, allocationWeekStatus, exchangeRateFor, expenseCategories, formatDate, guessCategoryFromText, isoToday, isWeeklyPaced, matchingAllocationsForExpense, pickerAllocationsForExpense, planAllocationMath, newId, parseRomanianAmount, sourceBalance, sourceCurrency, toBaseAmount, type AppData, type QuickTransactionTemplate, type Transaction, type TransactionKind } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { getLocale, t } from "@/lib/i18n";
import { selfMemberIdOf } from "@/lib/member-identity";
import { askConfirm } from "@/lib/confirm-dialog";
import { lei } from "@/lib/money-format";

const money = { format: lei };

/**
 * Registrul și soldul sursei sunt în lei. Pe o sursă în euro, cifra tastată nu e deja lei —
 * fără curs nu inventăm impactul, ca previzualizarea să nu scadă 10 când se salvează 50.
 */
export function entryLedgerAmount(typed: number, isForeign: boolean, rate?: number): number | undefined {
  if (!Number.isFinite(typed) || typed <= 0) return 0;
  if (!isForeign) return typed;
  return toBaseAmount(typed, rate);
}

const CAPTURE_CATEGORIES: Array<[string, typeof ShoppingCart]> = [
  ["Alimente", ShoppingCart],
  ["Casă & facturi", House],
  ["Transport", Bus],
  ["Consumabile copil", Baby],
  ["Sănătate", HeartPulse],
  ["Timp liber", Ticket],
  ["Abonamente", CreditCard],
  ["Altele", Ellipsis],
];

type Props = { data: AppData; onSave: (item: Transaction, meta?: { fromWeekIndex?: number }) => void; onClose: () => void; onMore: (draft: Transaction) => void; onSaveTemplate: (item: QuickTransactionTemplate) => void; onDeleteTemplate: (id: string) => void; onArchiveTemplate: (id: string) => void; onRestoreTemplate: (id: string) => void; onDeleteArchivedTemplate: (id: string) => void; initialTemplateId?: string; };

export function QuickEntryPanel({ data, onSave, onClose, onMore, onSaveTemplate, onDeleteTemplate, onArchiveTemplate, onRestoreTemplate, onDeleteArchivedTemplate, initialTemplateId }: Props) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimente");
  const [incomeLabel, setIncomeLabel] = useState("");
  const [merchant, setMerchant] = useState("");
  const [memberId, setMemberId] = useState(selfMemberIdOf(data));
  const [sourceId, setSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [allocationId, setAllocationId] = useState("outside");
  const [fromWeekIndex, setFromWeekIndex] = useState<number | undefined>();
  const [allocationChoiceTouched, setAllocationChoiceTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const initialTemplateApplied = useRef(false);
  const [templateLabel, setTemplateLabel] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [error, setError] = useState("");
  const captureIdRef = useRef(newId("tx"));
  const activeTemplate = data.settings.quickTemplates.find((item) => item.id === templateId);
  const matched = kind === "expense" ? matchingAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const candidates = kind === "expense" ? pickerAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const candidateIds = candidates.map((item) => item.id).join("|");
  const matchedAllocation = candidates.find((item) => item.id === allocationId);
  const paced = Boolean(matchedAllocation && isWeeklyPaced(matchedAllocation, data.settings.salaryPlan));
  const week = paced ? allocationWeekStatus(data, matchedAllocation!) : undefined;
  const weeks = paced ? allocationWeeksStatus(data, matchedAllocation!) : [];
  const matchedTotal = matchedAllocation && !paced ? allocationStatus(data, matchedAllocation) : undefined;
  const unrepartized = planAllocationMath(data).unrepartized;
  const entryCurrency = sourceCurrency(data, sourceId);
  const isForeign = entryCurrency !== BASE_CURRENCY;
  const entryRate = exchangeRateFor(data, entryCurrency);
  const typedAmount = parseRomanianAmount(amount);
  const ledgerAmount = entryLedgerAmount(typedAmount, isForeign, entryRate);
  const hideUnallocated = kind === "expense" && matched.length > 0 && ledgerAmount != null && unrepartized < Math.max(0.005, ledgerAmount || 0);
  const archiveGroups = useMemo(() => Object.entries(data.settings.archivedQuickTemplates.reduce<Record<string, typeof data.settings.archivedQuickTemplates>>((all, item) => {
    const month = item.archivedAt.slice(0, 7); return { ...all, [month]: [...(all[month] || []), item] };
  }, {})).sort(([left], [right]) => right.localeCompare(left)), [data.settings.archivedQuickTemplates]);

  useEffect(() => {
    if (!data.settings.paymentSources.some((source) => source.id === sourceId)) setSourceId(data.settings.paymentSources[0]?.id || "");
  }, [data.settings.paymentSources, sourceId]);
  useEffect(() => {
    if (kind !== "expense") { if (allocationId !== "outside") setAllocationId("outside"); return; }
    if (hideUnallocated && allocationId === "outside" && matched[0]) {
      setAllocationId(matched[0].id);
      return;
    }
    const currentIsValid = allocationId !== "outside" && candidates.some((item) => item.id === allocationId);
    if (!currentIsValid && allocationId !== "outside") setAllocationId(candidates[0]?.id || "outside");
    if (!allocationChoiceTouched && allocationId === "outside") {
      const fallback = matched[0] || (candidates.length === 1 ? candidates[0] : undefined);
      if (fallback) setAllocationId(fallback.id);
    }
  }, [allocationChoiceTouched, allocationId, candidateIds, hideUnallocated, kind]);
  useEffect(() => {
    setFromWeekIndex(week?.index);
  }, [allocationId, week?.index]);

  /** Sursa aleasă dă valuta; fără marcaj vizibil utilizatorul ar tasta euro crezând că sunt lei. */
  const convertedPreview = isForeign && typedAmount > 0 ? ledgerAmount : undefined;
  const chooseManual = () => { setTemplateId(""); setTemplateLabel(""); setError(""); };
  const selectTemplate = (template: QuickTransactionTemplate) => {
    setTemplateId(template.id); setKind(template.kind); setCategory(template.category); setAmount(template.amount ? String(template.amount) : "");
    if (template.memberId) setMemberId(template.memberId); if (template.sourceId) setSourceId(template.sourceId); setTemplateLabel(template.label); setIncomeLabel(template.kind === "income" ? template.label : ""); setAllocationChoiceTouched(false); setCategoryTouched(false); setError("");
  };
  useEffect(() => {
    if (initialTemplateApplied.current || !initialTemplateId) return;
    const template = data.settings.quickTemplates.find((item) => item.id === initialTemplateId && item.kind !== "income");
    if (!template) return;
    initialTemplateApplied.current = true;
    selectTemplate(template);
  }, [data.settings.quickTemplates, initialTemplateId]);
  const draftFromForm = (): Transaction => {
    const member = data.settings.members.find((item) => item.id === memberId) || data.settings.members[0];
    const source = data.settings.paymentSources.find((item) => item.id === sourceId) || data.settings.paymentSources[0];
    const numeric = parseRomanianAmount(amount);
    const foreign = source?.currency && source.currency !== BASE_CURRENCY ? source.currency : undefined;
    const rate = exchangeRateFor(data, foreign);
    const stored = foreign ? toBaseAmount(numeric, rate) : numeric;
    return {
      id: captureIdRef.current,
      title: activeTemplate?.label || (kind === "expense" ? (merchant.trim() || (numeric > 0 ? t("Cheltuială rapidă · {category}", { category: t(category) }) : "")) : incomeLabel.trim()),
      amount: stored || numeric,
      originalAmount: foreign ? numeric || undefined : undefined,
      originalCurrency: foreign,
      exchangeRate: foreign ? rate : undefined,
      kind,
      category: kind === "expense" ? category : "Venit",
      sourceId: source?.id || "",
      source: source?.name || "",
      memberId: member?.id || "",
      person: member?.name || "",
      date: isoToday(),
      allocationId: kind === "expense" ? allocationId : undefined,
      createdAt: new Date().toISOString(),
    };
  };
  const save = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    if (numeric <= 0) return setError(amountError(amount) || t("Introdu o sumă mai mare decât zero."));
    if (!member || !source) return setError(t("Alege un membru și o sursă de plată."));
    // Suma tastată este în valuta sursei; fără curs nu o putem trece în registru, care e în lei.
    const foreign = source.currency && source.currency !== BASE_CURRENCY ? source.currency : undefined;
    const rate = exchangeRateFor(data, foreign);
    const stored = foreign ? toBaseAmount(numeric, rate) : numeric;
    if (foreign && !stored) return setError(t("Adaugă în Setări cursul pentru {currency} înainte de a folosi această sursă.", { currency: foreign }));
    if (kind === "expense" && allocationId !== "outside" && !matchedAllocation) return setError(t("Plicul nu mai corespunde categoriei sau sursei. Alege din nou."));
    try {
      onSave({ id: captureIdRef.current, title: activeTemplate?.label || (kind === "expense" ? (merchant.trim() || t("Cheltuială rapidă · {category}", { category: t(category) })) : incomeLabel.trim() || t("Venit rapid")), amount: stored || numeric, originalAmount: foreign ? numeric : undefined, originalCurrency: foreign, exchangeRate: foreign ? rate : undefined, kind, category: kind === "expense" ? category : "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: isoToday(), allocationId: kind === "expense" ? allocationId : undefined, createdAt: new Date().toISOString() }, { fromWeekIndex: kind === "expense" && paced ? fromWeekIndex : undefined });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
    }
  };
  const remember = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId); const label = templateLabel.trim() || (kind === "expense" ? category : incomeLabel.trim() || t("Venit rapid"));
    if (!member || !source) return setError(t("Alege membrul și sursa înainte de salvarea șablonului."));
    onSaveTemplate({ id: templateId || newId("quick-template"), label, kind, category: kind === "expense" ? category : "Venit", amount: Math.max(0, numeric), memberId: member.id, sourceId: source.id, updatedAt: new Date().toISOString() });
    setTemplateLabel(label); setError("");
  };
  const archive = async () => { if (!templateId || !activeTemplate) return; if (!await askConfirm(t("Arhivezi șablonul local „{label}”? Îl poți restaura ulterior; tranzacțiile rămân neschimbate.", { label: activeTemplate.label }))) return; onArchiveTemplate(templateId); chooseManual(); };
  const remove = async () => { if (!templateId) return; if (!await askConfirm(t("Ștergi definitiv șablonul local „{label}”? Tranzacțiile rămân neschimbate.", { label: activeTemplate?.label || t("acesta") }))) return; onDeleteTemplate(templateId); chooseManual(); };
  const removeArchived = async (id: string, label: string) => { if (await askConfirm(t("Ștergi definitiv șablonul arhivat „{label}”? Tranzacțiile rămân neschimbate.", { label }))) onDeleteArchivedTemplate(id); };
  const sourceOwner = (id: string) => data.settings.members.find((member) => member.id === data.settings.paymentSources.find((source) => source.id === id)?.memberId)?.name || t("Familie / comun");
  const recentCategories = Array.from(new Set(data.transactions.filter((item) => item.kind === "expense" && item.category !== "Venit").map((item) => item.category))).slice(0, 4);
  const recentAmounts = useMemo(() => [...data.transactions].filter((item) => item.kind === kind && item.amount > 0).sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || "")).map((item) => item.amount).filter((amount, index, all) => all.indexOf(amount) === index).slice(0, 4), [data.transactions, kind]);
  const parsedAmount = typedAmount;
  const selectedSourceBalance = sourceId ? sourceBalance(data, sourceId) : 0;
  const projectedSourceBalance = ledgerAmount == null ? undefined : selectedSourceBalance + (kind === "income" ? ledgerAmount : -ledgerAmount);
  const dialogRef = useFocusTrap<HTMLElement>(onClose);

  const closeIfBackdrop = (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (event.target === event.currentTarget) onClose();
  };

  return <div className="bf-modal-backdrop" role="presentation" onPointerDown={closeIfBackdrop}>
    <section ref={dialogRef} tabIndex={-1} className="bf-modal bf-quick-entry-panel" role="dialog" aria-modal="true" aria-label={t("Cât ai dat?")} onPointerDown={(event) => event.stopPropagation()}>
      <header><div><p className="bf-kicker">{t("NOTEAZĂ")}</p><h2>{kind === "income" ? t("Cât a intrat?") : t("Cât ai dat?")}</h2></div><button className="bf-icon-button" aria-label={t("Închide")} onClick={onClose}><X size={19} /></button></header>
      <div className="bf-quick-entry-scroll">
      <p className="bf-quick-entry-intro">{kind === "income" ? t("Suma și de unde vine: salariu, bonus, o încasare.") : t("Suma, magazinul, gata. Plicul se alege singur dacă există unul pe categorie.")}</p>
      {(data.settings.quickTemplates.length > 0 || data.settings.archivedQuickTemplates.length > 0) && <div className="bf-template-header-actions"><span>{t("{count} șabloane active", { count: data.settings.quickTemplates.length })}</span><button type="button" onClick={() => setShowArchive((value) => !value)}><Archive size={15} /> {t("Arhivă")}{data.settings.archivedQuickTemplates.length ? ` (${data.settings.archivedQuickTemplates.length})` : ""}</button></div>}
      {showArchive && <section className="bf-template-archive" aria-label={t("Arhiva lunară a șabloanelor")}><p className="bf-kicker">{t("ARHIVĂ LOCALĂ")}</p>{archiveGroups.map(([month, items]) => <div key={month}><h3>{formatDate(`${month}-01`, { month: "long", year: "numeric" })}</h3>{items.map((item) => <article key={item.id}><div><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : t("sumă liberă")} · arhivat {formatDate(item.archivedAt)}</small></div><div className="bf-template-archive-actions"><button type="button" onClick={() => onRestoreTemplate(item.id)}><ArchiveRestore size={15} /> {t("Restaurează")}</button><button type="button" className="danger" aria-label={`Șterge definitiv ${item.label}`} onClick={() => removeArchived(item.id, item.label)}><Trash2 size={15} /></button></div></article>)}</div>)}{!archiveGroups.length && <p className="bf-empty-inline">{t("Nu ai șabloane arhivate. Arhivează un șablon activ pentru a-l păstra în istoricul local.")}</p>}</section>}
      {data.settings.quickTemplates.length > 0 && <div className="bf-quick-template-rail" role="list" aria-label={t("Șabloane locale")}><button role="listitem" className={!templateId ? "active" : ""} onClick={chooseManual}>{t("Manual")}</button>{data.settings.quickTemplates.map((item) => <button role="listitem" key={item.id} className={templateId === item.id ? "active" : ""} onClick={() => selectTemplate(item)}><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : t("sumă liberă")}</small></button>)}</div>}
      <div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>{t("Cheltuială")}</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>{t("Venit")}</button></div>
      {kind === "expense" && <div className="bf-cat-grid" role="listbox" aria-label={t("Categorii rapide")}>{CAPTURE_CATEGORIES.map(([name, Icon]) => <button type="button" key={name} role="option" aria-selected={category === name} className={category === name ? "is-on" : ""} onClick={() => { setCategory(name); setCategoryTouched(true); setAllocationChoiceTouched(false); }}><Icon size={18} aria-hidden="true" /><span>{t(name)}</span></button>)}</div>}
      {kind === "expense" && recentCategories.length > 0 && <div className="bf-quick-category-picks" aria-label={t("Categorii folosite recent")}><span>{t("Folosite recent")}</span>{recentCategories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setCategoryTouched(true); setAllocationChoiceTouched(false); }}>{item}</button>)}</div>}
      <div className="bf-quick-entry-grid"><label className="bf-field bf-amount-field"><span>{t("Sumă ({currency})", { currency: isForeign ? entryCurrency : t("lei") })}</span><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} inputMode="decimal" placeholder="0,00" aria-describedby="bf-quick-amount-hint" />{recentAmounts.length > 0 && <span className="bf-amount-suggestions" id="bf-quick-amount-hint"><span>{t("Folosit recent")}</span>{recentAmounts.map((value) => { const filled = !isForeign ? value : entryRate ? Math.round((value / entryRate) * 100) / 100 : undefined; if (filled == null) return null; return <button type="button" key={value} onClick={() => { setAmount(String(filled)); setError(""); }}>{isForeign ? `${filled.toLocaleString(getLocale(), { maximumFractionDigits: 2 })} ${entryCurrency}` : money.format(value)}</button>; })}</span>}</label>{kind === "expense" ? <label className="bf-field"><span>{t("Magazin sau denumire")}</span><input value={merchant} onChange={(event) => {
        const next = event.target.value;
        setMerchant(next);
        if (categoryTouched) return;
        const guessed = guessCategoryFromText(next, [...expenseCategories, ...data.settings.customCategories], data.settings.merchantRules || []);
        if (guessed && guessed !== category) { setCategory(guessed); setAllocationChoiceTouched(false); }
      }} placeholder={t("ex. Lidl")} /></label> : null}{kind === "expense" ? <label className="bf-field"><span>{t("Sau altă categorie")}</span><select value={category} onChange={(event) => { setCategory(event.target.value); setCategoryTouched(true); setAllocationChoiceTouched(false); }}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label> : <label className="bf-field"><span>{t("Ce venit?")}</span><input value={incomeLabel} onChange={(event) => setIncomeLabel(event.target.value)} placeholder={t("ex. Salariu, Bonus")} /></label>}{data.settings.members.length > 1 && <label className="bf-field"><span>{t("Cine a înregistrat")}</span><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setAllocationChoiceTouched(false); }}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}<label className="bf-field"><span>{kind === "expense" ? t("Plătit din") : t("Încasat în")}</span><select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setAllocationChoiceTouched(false); }}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}{data.settings.members.length > 1 && source.memberId ? ` · ${sourceOwner(source.id)}` : ""} · {money.format(sourceBalance(data, source.id))}{source.currency ? ` (${source.currency})` : ""}</option>)}</select></label></div>{isForeign && <section className={`bf-currency-preview ${convertedPreview ? "" : "pending"}`}><p className="bf-kicker">{t("SE ÎNREGISTREAZĂ ÎN LEI")}</p>{convertedPreview ? <><b>{money.format(convertedPreview)}</b><span>La cursul de {entryRate?.toLocaleString(getLocale(), { maximumFractionDigits: 4 })} {t("lei pentru 1")} {entryCurrency}{t(", salvat în Setări.")}</span></> : <span>{entryRate ? t("Completează suma în {currency}.", { currency: entryCurrency }) : t("Adaugă în Setări cursul pentru {currency} înainte de a folosi această sursă.", { currency: entryCurrency })}</span>}</section>}
      {parsedAmount > 0 && projectedSourceBalance != null && selectedSourceBalance > 0 && <p className={`bf-quick-source-preview ${projectedSourceBalance < 0 ? "over" : ""}`} aria-live="polite">{kind === "expense" ? t("După această plată") : t("După această încasare")}: <b>{money.format(Math.max(0, projectedSourceBalance))}</b> {t("rămân în")} {data.settings.paymentSources.find((source) => source.id === sourceId)?.name || t("sursa aleasă")}{projectedSourceBalance < 0 ? t(" — suma depășește soldul curent") : ""}.</p>}
      {kind === "expense" && data.settings.salaryPlan.allocations.length > 0 && <section className="bf-quick-envelope"><p className="bf-kicker">{t("PLICUL SĂPTĂMÂNII")}</p><label className="bf-field"><span>{t("Se consumă din")}</span><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}>{(!hideUnallocated || allocationId === "outside") && <option value="outside">{t("În afara plicurilor")}{unrepartized > 0 ? ` · ${money.format(unrepartized)}` : ""}</option>}{candidates.map((allocation) => { const activeWeek = isWeeklyPaced(allocation, data.settings.salaryPlan) ? allocationWeekStatus(data, allocation) : undefined; const totalRemaining = isWeeklyPaced(allocation, data.settings.salaryPlan) ? undefined : allocationStatus(data, allocation).remaining; return <option key={allocation.id} value={allocation.id}>{allocation.label} · {activeWeek ? t("{amount} în S{index}", { amount: money.format(Math.max(0, activeWeek.remaining)), index: activeWeek.index }) : totalRemaining !== undefined ? t("{amount} rămași", { amount: money.format(Math.max(0, totalRemaining)) }) : t("fără tranșă activă")}</option>; })}</select></label>{weeks.length > 1 && <label className="bf-field"><span>{t("Din ce săptămână")}</span><select value={String(fromWeekIndex || week?.index || "")} onChange={(event) => setFromWeekIndex(Number(event.target.value) || undefined)}>{weeks.map((item) => <option key={item.index} value={item.index}>{t("S{index}: {remaining} rămași din {budget}{after}", { index: item.index, remaining: money.format(Math.max(0, item.remaining)), budget: money.format(item.budget), after: "" })}</option>)}</select></label>}{matchedAllocation && <p className={(week && ledgerAmount != null && week.remaining - ledgerAmount < 0) || (matchedTotal && ledgerAmount != null && matchedTotal.remaining - ledgerAmount < 0) ? "over" : ""}>{week ? t("S{index}: {remaining} rămași din {budget}{after}", { index: week.index, remaining: money.format(Math.max(0, week.remaining)), budget: money.format(week.budget), after: ledgerAmount != null && ledgerAmount > 0 ? t(" · după plată {left}", { left: money.format(Math.max(0, week.remaining - ledgerAmount)) }) : "" }) : matchedTotal ? t("{remaining} rămași din {budget}{after}", { remaining: money.format(Math.max(0, matchedTotal.remaining)), budget: money.format(matchedTotal.budget), after: ledgerAmount != null && ledgerAmount > 0 ? t(" · după plată {left}", { left: money.format(Math.max(0, matchedTotal.remaining - ledgerAmount)) }) : "" }) : t("Plic selectat; încă nu este activă o tranșă calendaristică.")}</p>}{!candidates.length && <p>{t("Nu există plic pentru această categorie și sursă. Poți salva în afara plicurilor.")}</p>}</section>}
      <details className="bf-template-save"><summary><BookmarkPlus size={16} /> {templateId ? t("Editează șablonul selectat") : t("Salvează combinația ca șablon local")}</summary><label className="bf-field"><span>{t("Nume șablon")}</span><input value={templateLabel} onChange={(event) => setTemplateLabel(event.target.value)} placeholder="ex. Taxi serviciu" /></label><div className="bf-template-actions"><button type="button" onClick={remember}>{templateId ? t("Actualizează șablonul") : t("Păstrează pe acest telefon")}</button>{templateId && <><button type="button" onClick={archive}><Archive size={15} /> {t("Arhivează")}</button><button type="button" className="danger" onClick={remove}><Trash2 size={15} /> {t("Șterge")}</button></>}</div></details>
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      </div>
      <div className="bf-quick-entry-footer">
      <button className="bf-primary full" onClick={save}><Check size={17} /> {t("Gata")}</button><button className="bf-quick-entry-more" onClick={() => onMore(draftFromForm())}><Plus size={16} /> {t("Adaugă notiță, altă dată sau corectează")}</button>
      </div>
    </section>
  </div>;
}
