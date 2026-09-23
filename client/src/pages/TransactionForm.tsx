/**
 * Formularul de mișcare. Scos din home-secondary. Salvarea rămâne aceeași.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { BASE_CURRENCY, allocationBudget, allocationSpent, allocationWeekStatus, allocationWeeksStatus, exchangeRateFor, expenseCategories, isoToday, isWeeklyPaced, matchingAllocationsForExpense, newId, parseRomanianAmount, pickerAllocationsForExpense, planAllocationMath, resolveReceiptLines, sourceBalance, sourceCurrency, toBaseAmount, transactionShareScope, type AppData, type ShareScope, type Transaction, type TransactionKind } from "@/lib/finance-data";
import { Field, Modal, fmtExact, money } from "@/pages/home-kit";
import { getLocale, t } from "@/lib/i18n";

export function TransactionForm({ data, initial, onSave, onClose }: { data: AppData; initial?: Transaction; onSave: (item: Transaction | Transaction[], meta?: { fromWeekIndex?: number }) => void; onClose: () => void }) {
  const [kind, setKind] = useState<TransactionKind>(initial?.kind || "expense");
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date || isoToday());
  const [memberId, setMemberId] = useState(initial?.memberId || data.settings.members.find((member) => member.name === initial?.person)?.id || data.settings.members[0]?.id || "");
  const [shareScope, setShareScope] = useState<ShareScope>(transactionShareScope(initial));
  const [sourceId, setSourceId] = useState(initial?.sourceId || data.settings.paymentSources.find((source) => source.name === initial?.source)?.id || data.settings.paymentSources[0]?.id || "");
  const [category, setCategory] = useState(initial?.category || "Alimente");
  const [allocationId, setAllocationId] = useState(initial?.allocationId || "outside");
  const [fromWeekIndex, setFromWeekIndex] = useState<number | undefined>();
  const [allocationChoiceTouched, setAllocationChoiceTouched] = useState(Boolean(initial));
  const [note, setNote] = useState(initial?.note || "");
  const [error, setError] = useState("");
  const captureIdRef = useRef(initial?.id || newId("tx"));
  const [originalAmountInput, setOriginalAmountInput] = useState(initial?.originalAmount ? String(initial.originalAmount) : "");
  const [splitOpen, setSplitOpen] = useState(false);
  const [lines, setLines] = useState<Array<{ id: string; category: string; amount: string; label: string }>>([
    { id: newId("split-line"), category: initial?.category || "Alimente", amount: initial ? String(initial.amount) : "", label: "" },
  ]);
  const entryCurrency = sourceCurrency(data, sourceId);
  const isForeign = entryCurrency !== BASE_CURRENCY;
  const savedRate = exchangeRateFor(data, entryCurrency);
  const [rateInput, setRateInput] = useState(initial?.exchangeRate ? String(initial.exchangeRate) : "");
  const activeRate = parseRomanianAmount(rateInput) || savedRate || 0;
  const typedAmount = parseRomanianAmount(amount);
  const baseAmount = isForeign ? toBaseAmount(typedAmount, activeRate) : typedAmount;
  const envelopeMatched = kind === "expense" ? matchingAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const envelopeCandidates = kind === "expense" ? pickerAllocationsForExpense(data, { category, memberId, sourceId }) : [];
  const envelopeCandidateIds = envelopeCandidates.map((item) => item.id).join("|");
  const matchedEnvelope = allocationId === "outside" ? undefined : envelopeCandidates.find((allocation) => allocation.id === allocationId);
  const sourceOwner = (source: AppData["settings"]["paymentSources"][number]) => data.settings.members.find((member) => member.id === source.memberId)?.name || t("Comun");
  const allocationMember = matchedEnvelope ? data.settings.members.find((member) => member.id === matchedEnvelope.memberId)?.name || t("Familie / comun") : "";
  const editedAlreadyInEnvelope = Boolean(matchedEnvelope && initial?.id && initial.allocationId === matchedEnvelope.id);
  const envelopeSpent = matchedEnvelope ? Math.max(0, allocationSpent(data, matchedEnvelope) - (editedAlreadyInEnvelope ? initial?.amount || 0 : 0)) : 0;
  const envelopeRemaining = matchedEnvelope ? allocationBudget(data, matchedEnvelope) - envelopeSpent : 0;
  const pacedEnvelope = Boolean(matchedEnvelope && isWeeklyPaced(matchedEnvelope, data.settings.salaryPlan));
  const matchedWeek = pacedEnvelope ? allocationWeekStatus(data, matchedEnvelope!, date) : undefined;
  const envelopeWeeks = pacedEnvelope ? allocationWeeksStatus(data, matchedEnvelope!) : [];
  const initialInsideMatchedWeek = Boolean(initial && initial.date && matchedWeek && initial.date >= matchedWeek.start && initial.date <= matchedWeek.end);
  const adjustedWeekSpent = matchedWeek ? Math.max(0, matchedWeek.spent - (editedAlreadyInEnvelope && initialInsideMatchedWeek ? initial?.amount || 0 : 0)) : 0;
  const weekRemaining = matchedWeek ? matchedWeek.budget - adjustedWeekSpent : 0;
  const proposedAmount = baseAmount || 0;
  const envelopeAfter = envelopeRemaining - proposedAmount;
  const weekAfter = weekRemaining - proposedAmount;
  const unrepartized = planAllocationMath(data).unrepartized;
  const hideUnallocated = kind === "expense" && envelopeMatched.length > 0 && unrepartized < Math.max(0.005, proposedAmount);
  const canSplit = kind === "expense" && !initial && !isForeign;
  const resolvedSplit = canSplit && splitOpen ? resolveReceiptLines(lines, typedAmount) : [];
  const splitTotal = resolvedSplit.reduce((sum, line) => sum + line.amount, 0);
  useEffect(() => { setRateInput(savedRate && savedRate !== 1 ? String(savedRate) : ""); }, [entryCurrency]);
  useEffect(() => {
    if (kind !== "expense") { if (allocationId !== "outside") setAllocationId("outside"); return; }
    if (hideUnallocated && allocationId === "outside" && envelopeMatched[0]) {
      setAllocationId(envelopeMatched[0].id);
      return;
    }
    const currentIsValid = allocationId !== "outside" && envelopeCandidates.some((allocation) => allocation.id === allocationId);
    if (!currentIsValid && allocationId !== "outside") setAllocationId(envelopeCandidates[0]?.id || "outside");
    if (!allocationChoiceTouched && allocationId === "outside") {
      const fallback = envelopeMatched[0] || (envelopeCandidates.length === 1 ? envelopeCandidates[0] : undefined);
      if (fallback) setAllocationId(fallback.id);
    }
  }, [allocationChoiceTouched, allocationId, envelopeCandidateIds, hideUnallocated, kind]);
  useEffect(() => {
    setFromWeekIndex(matchedWeek?.index);
  }, [allocationId, matchedWeek?.index]);
  const updateLine = (id: string, patch: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const save = () => {
    const numeric = parseRomanianAmount(amount);
    const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    const member = data.settings.members.find((item) => item.id === memberId);
    if (!title.trim()) return setError(t("Scrie o denumire pentru mișcare."));
    if (!numeric || numeric <= 0) return setError(t("Introdu o sumă mai mare decât zero."));
    if (!source || !member || !date) return setError(t("Alege data, membrul și sursa de plată."));
    if (isForeign && !(activeRate > 0)) return setError(t("Introdu cursul pentru {currency}: câți lei face o unitate.", { currency: entryCurrency }));
    const stored = isForeign ? toBaseAmount(numeric, activeRate) : numeric;
    if (!stored || stored <= 0) return setError(t("Suma convertită în lei nu este validă. Verifică suma și cursul."));
    if (canSplit && splitOpen) {
      const normalized = resolveReceiptLines(lines, numeric);
      const total = normalized.reduce((sum, line) => sum + line.amount, 0);
      if (!normalized.length || Math.abs(numeric - total) > 0.01) {
        return setError(t("Repartizarea este {split}, dar totalul este {total}. Corectează liniile.", { split: fmtExact.format(total), total: fmtExact.format(numeric) }));
      }
      const now = new Date().toISOString();
      const batch = normalized.map((line, index) => {
        const matched = matchingAllocationsForExpense(data, { category: line.category, memberId: member.id, sourceId: source.id })[0];
        return {
          id: index === 0 ? captureIdRef.current : newId("tx"),
          title: `${title.trim()}${line.label ? ` · ${line.label}` : ""}`,
          amount: line.amount,
          kind: "expense" as const,
          category: line.category,
          sourceId: source.id,
          source: source.name,
          memberId: member.id,
          person: member.name,
          date,
          note: note.trim() || undefined,
          allocationId: matched?.id || "outside",
          shareScope,
          createdAt: now,
          updatedAt: now,
        };
      });
      try {
        onSave(batch);
        onClose();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
      }
      return;
    }
    if (kind === "expense" && allocationId !== "outside" && !matchedEnvelope) return setError(t("Plicul ales nu mai corespunde categoriei, membrului sau sursei. Alege din nou."));
    const originalTyped = isForeign ? (parseRomanianAmount(originalAmountInput) || numeric) : undefined;
    try {
      onSave({ id: captureIdRef.current, title: title.trim(), amount: stored, originalAmount: isForeign ? originalTyped : undefined, originalCurrency: isForeign ? entryCurrency : undefined, exchangeRate: isForeign ? activeRate : undefined, kind, category: kind === "income" ? "Venit" : category, sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date, note: note.trim() || undefined, allocationId: kind === "expense" ? allocationId : undefined, shareScope, createdAt: initial?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), receiptId: initial?.receiptId }, { fromWeekIndex: kind === "expense" && pacedEnvelope ? fromWeekIndex : undefined });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Nu am putut salva mișcarea."));
    }
  };
  return <Modal title={initial ? t("Corectează mișcarea") : t("Adaugă mișcare")} onClose={onClose}><div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>{t("Cheltuială")}</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>{t("Venit")}</button></div><div className="bf-form-grid"><Field label={t("Denumire")}><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("ex. Cumpărături Lidl")} /></Field><Field label={t("Sumă ({currency})", { currency: isForeign ? entryCurrency : "lei" })}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></Field>{isForeign && <Field label={t("Curs: 1 {currency} = ? lei", { currency: entryCurrency })} hint={savedRate ? t("Cursul salvat în Setări este {rate}. Îl poți schimba doar pentru această mișcare.", { rate: savedRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) }) : t("Nu ai încă un curs salvat pentru această valută. Îl poți pune o dată, în Setări.")}><input value={rateInput} onChange={(event) => setRateInput(event.target.value)} inputMode="decimal" placeholder="ex. 4,97" /></Field>}{isForeign && initial && !initial.originalAmount && <Field label={t("Sumă originală ({currency})", { currency: entryCurrency })} hint={t("Mișcarea a fost salvată doar în lei. Completează suma din extras ca soldul valutar să nu mai fie aproximativ.")}><input value={originalAmountInput} onChange={(event) => setOriginalAmountInput(event.target.value)} inputMode="decimal" placeholder="ex. 20,00" /></Field>}<Field label={t("Data")}><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label={t("Cine a făcut mișcarea")}><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label={t("Perspectivă")} hint={t("Personal rămâne la membru; comun intră în bilanțul familiei.")}><select value={shareScope} onChange={(event) => setShareScope(event.target.value as ShareScope)}><option value="shared">{t("Comun (familie)")}</option><option value="personal">{t("Personal")}</option></select></Field><Field label={kind === "income" ? t("Încasat în") : t("Plătit din (sursa reală)")}><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name}{data.settings.members.length > 1 && source.memberId ? ` · ${sourceOwner(source)}` : ""} · {money(sourceBalance(data, source.id))}{source.currency ? ` (${source.currency})` : ""}</option>)}</select></Field>{kind === "expense" && !splitOpen && <Field label={t("Categorie")}><select value={category} onChange={(event) => setCategory(event.target.value)}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></Field>}</div>{isForeign && <section className={`bf-currency-preview ${baseAmount ? "" : "pending"}`}><p className="bf-kicker">{t("SE ÎNREGISTREAZĂ ÎN LEI")}</p>{baseAmount ? <><b>{fmtExact.format(baseAmount)}</b><span>{t("{original} × {rate} lei. Suma originală și cursul rămân salvate lângă mișcare.", { original: fmtExact.format(typedAmount).replace("RON", entryCurrency), rate: activeRate.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) })}</span></> : <span>{t("Completează suma și cursul ca să vezi echivalentul în lei.")}</span>}</section>}{canSplit && <section className="bf-receipt-split bf-tx-split"><div className="bf-split-heading"><div><p className="bf-kicker">{t("ÎMPARTE CHELTUIALA")}</p><h3>{splitOpen ? `${fmtExact.format(splitTotal)} / ${amount ? fmtExact.format(typedAmount) : "0,00 RON"}` : t("Pe categorii sau plicuri")}</h3></div><button type="button" className="bf-secondary" onClick={() => setSplitOpen((value) => !value)}>{splitOpen ? t("O singură categorie") : t("Împarte pe linii")}</button></div>{splitOpen && <>{lines.map((line) => <div className="bf-split-line" key={line.id}><select aria-label={t("Categorie")} value={line.category} onChange={(event) => updateLine(line.id, { category: event.target.value })}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select><input aria-label={t("Sumă")} value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} inputMode="decimal" placeholder="lei" /><input aria-label={t("Detaliu")} value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} placeholder={t("ex. lapte")} />{lines.length > 1 && <button type="button" aria-label={t("Elimină linia")} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button>}</div>)}<button type="button" className="bf-secondary" onClick={() => setLines((current) => [...current, { id: newId("split-line"), category: "Alimente", amount: "", label: "" }])}><Plus size={16} /> {t("Adaugă linie")}</button><small>{t("Fiecare linie creează o mișcare separată, cu plicul potrivit categoriei.")}</small></>}</section>}{kind === "expense" && !splitOpen && <section className="bf-envelope-choice"><div><p className="bf-kicker">{t("BUGET REPARTIZAT")}</p><h3>{t("Plicul compatibil este ales automat.")}</h3><p>{t("Categoria, membrul și sursa reală găsesc plicul potrivit. Poți alege alt plic sau plată în afara plicurilor.")}</p></div><Field label={t("Plic de consum")}><select value={allocationId} onChange={(event) => { setAllocationId(event.target.value); setAllocationChoiceTouched(true); }}>{(!hideUnallocated || allocationId === "outside") && <option value="outside">{t("În afara plicurilor — nu consumă buget repartizat")}</option>}{envelopeCandidates.map((allocation) => { const owner = data.settings.members.find((member) => member.id === allocation.memberId)?.name || t("Familie / comun"); const remaining = Math.max(0, allocationBudget(data, allocation) - allocationSpent(data, allocation)); const week = isWeeklyPaced(allocation, data.settings.salaryPlan) ? allocationWeekStatus(data, allocation, date) : undefined; return <option key={allocation.id} value={allocation.id}>{allocation.label}{data.settings.members.length > 1 ? ` · ${owner}` : ""} · {week ? `${money(Math.max(0, week.remaining))} în S${week.index}` : money(remaining)}</option>; })}</select></Field>{envelopeWeeks.length > 1 && <Field label={t("Din ce săptămână")}><select value={String(fromWeekIndex || matchedWeek?.index || "")} onChange={(event) => setFromWeekIndex(Number(event.target.value) || undefined)}>{envelopeWeeks.map((item) => <option key={item.index} value={item.index}>{t("S{index}: {remaining} rămași din {budget}{after}", { index: item.index, remaining: money(Math.max(0, item.remaining)), budget: money(item.budget), after: "" })}</option>)}</select></Field>}{!envelopeCandidates.length && <small className="bf-envelope-empty">{t("Nu există un plic pentru această combinație de categorie, membru și sursă. Poți înregistra cheltuiala în afara plicurilor sau crea unul în Plan.")}</small>}</section>}{!splitOpen && matchedEnvelope ? <section className={`bf-envelope-match ${envelopeAfter < 0 || (matchedWeek && weekAfter < 0) ? "over" : ""}`}><p>{matchedWeek ? t("SE VA LUA DIN PLICUL SĂPTĂMÂNII ACTIVE") : t("SE VA LUA DIN PLIC")}</p><b>{matchedEnvelope.label} · {allocationMember} · {data.settings.paymentSources.find((source) => source.id === matchedEnvelope.sourceId)?.name || t("sursa aleasă")}</b>{matchedWeek ? <span>S{matchedWeek.index}: {money(Math.max(0, weekRemaining))} {t("rămași")} din {money(matchedWeek.budget)}</span> : <span>{money(Math.max(0, envelopeRemaining))} {t("rămași")} din {money(allocationBudget(data, matchedEnvelope))}</span>}</section> : kind === "expense" && !splitOpen && <section className="bf-envelope-match outside"><p>{t("PLATĂ ÎN AFARA PLICURILOR")}</p><b>{t("Va scădea doar soldul sursei reale de plată.")}</b><span>{t("Nu consumă nicio limită repartizată pentru categorii.")}</span></section>}<Field label={t("Notiță opțională")}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("ex. cursă taxi, traseu, persoană, motiv")} /></Field>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> {t("Salvează mișcarea")}</button></Modal>;
}
