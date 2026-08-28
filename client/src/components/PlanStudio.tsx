/**
 * Atelier Financiar — Plan pe categorii: fiecare plic își declară o singură dată suma; totalul e suma lor.
 * Filosofie: o familie adaugă bani direct pe categorii, unele cu ritm săptămânal, altele doar cu un total.
 * Perioada e opțională și comună — servește doar categoriilor cu ritm săptămânal; nu există o sumă „generală” separată.
 */
import { useState } from "react";
import { BookmarkPlus, ChevronDown, FileDown, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { calendarBudget } from "@/lib/calendar-budget";
import { downloadCalendarPlanPdf } from "@/lib/calendar-plan-pdf";
import { allocationStatus, allocationWeekStatus, allocationWeeksStatus, expenseCategories, formatDate, isoToday, newId, parseRomanianAmount, pendingRecurringInPlan, planEndDate, sourceBalance, transferBetweenWeeks, type AppData, type BudgetAllocation } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const thresholdOptions = [50, 60, 70, 80, 90, 95];
const daysBetween = (start: string, end: string) => Math.floor((new Date(`${end}T12:00:00`).valueOf() - new Date(`${start}T12:00:00`).valueOf()) / 86_400_000) + 1;

function PlanField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="bf-plan-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function personName(data: AppData, memberId?: string) {
  return data.settings.members.find((member) => member.id === memberId)?.name || "Familie / comun";
}

function sourceName(data: AppData, sourceId?: string) {
  return data.settings.paymentSources.find((source) => source.id === sourceId)?.name || "Orice sursă";
}

export function PlanStudio({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const plan = data.settings.salaryPlan;
  const planEnd = planEndDate(plan);
  const categories = [...expenseCategories, ...data.settings.customCategories.filter((category) => !expenseCategories.includes(category))];
  const [cycleStart, setCycleStart] = useState(plan.periodStart);
  const [cycleEnd, setCycleEnd] = useState(planEnd || "");
  const [cycleError, setCycleError] = useState("");
  const [cycleTemplateLabel, setCycleTemplateLabel] = useState("");
  const [templateRenameId, setTemplateRenameId] = useState("");
  const [templateRename, setTemplateRename] = useState("");
  const [allocationLabel, setAllocationLabel] = useState("");
  const [allocationCategory, setAllocationCategory] = useState(categories[0] || "Alimente");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationMemberId, setAllocationMemberId] = useState("");
  const [allocationSourceId, setAllocationSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [allocationNote, setAllocationNote] = useState("");
  const [allocationThreshold, setAllocationThreshold] = useState(80);
  const [allocationWeeklyPace, setAllocationWeeklyPace] = useState(true);
  const [editingAllocationId, setEditingAllocationId] = useState("");
  const [allocationError, setAllocationError] = useState("");
  const [weekTransferAllocationId, setWeekTransferAllocationId] = useState("");
  const [weekTransferFromIndex, setWeekTransferFromIndex] = useState("");
  const [weekTransferAmount, setWeekTransferAmount] = useState("");
  const [weekTransferError, setWeekTransferError] = useState("");

  const periodValid = Boolean(cycleStart && cycleEnd && cycleEnd >= cycleStart);
  const weeklyPacedTotal = plan.allocations.filter((item) => item.weeklyPace !== false).reduce((sum, item) => sum + item.amount, 0);
  const activeCycle = planEnd ? calendarBudget(weeklyPacedTotal, plan.periodStart, planEnd) : undefined;
  const activeWeek = activeCycle?.weeks.find((week) => isoToday() >= week.start && isoToday() <= week.end);
  const envelopes = plan.allocations.map((item) => ({ item, ...allocationStatus(data, item), week: item.weeklyPace === false ? undefined : allocationWeekStatus(data, item), weeks: item.weeklyPace === false ? [] : allocationWeeksStatus(data, item) }));
  const allocated = envelopes.reduce((sum, envelope) => sum + envelope.budget, 0);
  const weekSpentByIndex = envelopes.reduce((all, envelope) => { envelope.weeks.forEach((week) => all.set(week.index, (all.get(week.index) || 0) + week.spent)); return all; }, new Map<number, number>());
  const sourceIds = plan.sourceIds.length ? plan.sourceIds : data.settings.paymentSources.map((source) => source.id);
  const availableSources = data.settings.paymentSources.filter((source) => sourceIds.includes(source.id)).reduce((sum, source) => sum + sourceBalance(data, source.id), 0);
  const scheduled = pendingRecurringInPlan(data).reduce((sum, item) => sum + item.amount, 0);
  const reservedInEnvelopes = envelopes.reduce((sum, envelope) => sum + envelope.remaining, 0);
  const unrepartized = availableSources - reservedInEnvelopes - scheduled;
  const allocationPreview = planEnd ? calendarBudget(parseRomanianAmount(allocationAmount), plan.periodStart, planEnd) : undefined;
  const currentSourceOptions = data.settings.paymentSources.filter((source) => !allocationMemberId || !source.memberId || source.memberId === allocationMemberId);

  const updatePlan = (patch: Partial<typeof plan>) => onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, ...patch, updatedAt: new Date().toISOString() } } });
  const addDays = (start: string, amount: number) => { const date = new Date(`${start || isoToday()}T12:00:00`); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };
  const resetAllocationBuilder = () => { setAllocationLabel(""); setAllocationCategory(categories[0] || "Alimente"); setAllocationAmount(""); setAllocationMemberId(""); setAllocationSourceId(data.settings.paymentSources[0]?.id || ""); setAllocationNote(""); setAllocationThreshold(80); setAllocationWeeklyPace(true); setEditingAllocationId(""); setAllocationError(""); };

  /** Perioada e comună tuturor categoriilor cu ritm săptămânal; se aplică automat, fără buton separat. */
  const autoApplyPeriod = () => {
    if (!periodValid) return;
    if (plan.periodStart === cycleStart && plan.nextPayday === cycleEnd) return;
    updatePlan({ periodStart: cycleStart, nextPayday: cycleEnd, earliestPayday: undefined });
    setCycleError("");
  };
  const saveCycleTemplate = () => {
    if (!periodValid) return setCycleError("Alege perioada înainte de a salva șablonul.");
    const days = daysBetween(cycleStart, cycleEnd);
    const label = cycleTemplateLabel.trim() || `Ciclu de ${days} zile`;
    const now = new Date().toISOString();
    const duplicate = data.settings.salaryCycleTemplates.find((item) => item.label.toLocaleLowerCase("ro-RO") === label.toLocaleLowerCase("ro-RO"));
    const template = { id: duplicate?.id || newId("salary-cycle"), label, amount: 0, durationDays: days, updatedAt: now };
    onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: [template, ...data.settings.salaryCycleTemplates.filter((item) => item.id !== duplicate?.id)].slice(0, 12) } });
    setCycleTemplateLabel("");
  };
  const applyCycleTemplate = (template: AppData["settings"]["salaryCycleTemplates"][number]) => {
    const start = cycleStart || isoToday(); const end = addDays(start, template.durationDays - 1);
    setCycleStart(start); setCycleEnd(end); setCycleError("");
    updatePlan({ periodStart: start, nextPayday: end, earliestPayday: undefined });
  };
  const renameCycleTemplate = (id: string) => {
    const label = templateRename.trim(); if (!label) return;
    onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: data.settings.salaryCycleTemplates.map((item) => item.id === id ? { ...item, label: label.slice(0, 42), updatedAt: new Date().toISOString() } : item) } });
    setTemplateRenameId(""); setTemplateRename("");
  };
  const deleteCycleTemplate = (id: string, label: string) => { if (window.confirm(`Ștergi șablonul local „${label}”?`)) onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: data.settings.salaryCycleTemplates.filter((item) => item.id !== id) } }); };

  const saveAllocation = () => {
    const amount = parseRomanianAmount(allocationAmount);
    const source = data.settings.paymentSources.find((item) => item.id === allocationSourceId);
    const member = data.settings.members.find((item) => item.id === allocationMemberId);
    if (amount <= 0) return setAllocationError("Introdu suma pentru această categorie.");
    if (!source) return setAllocationError("Alege sursa din care vei plăti această categorie.");
    const label = allocationLabel.trim() || `${allocationCategory}${member ? ` · ${member.name}` : ""}`;
    const next: BudgetAllocation = { id: editingAllocationId || newId("allocation"), label, amount, category: allocationCategory, memberId: member?.id, sourceId: source.id, note: allocationNote.trim() || undefined, alertThreshold: allocationThreshold, weeklyPace: allocationWeeklyPace ? undefined : false };
    const nextAllocations = editingAllocationId ? plan.allocations.map((item) => item.id === editingAllocationId ? next : item) : [...plan.allocations, next];
    updatePlan({ allocations: nextAllocations, totalLimit: nextAllocations.reduce((sum, item) => sum + item.amount, 0) });
    resetAllocationBuilder();
  };
  const editAllocation = (item: BudgetAllocation) => { setEditingAllocationId(item.id); setAllocationLabel(item.label); setAllocationCategory(item.category || categories[0] || "Alimente"); setAllocationAmount(String(item.amount)); setAllocationMemberId(item.memberId || ""); setAllocationSourceId(item.sourceId || data.settings.paymentSources[0]?.id || ""); setAllocationNote(item.note || ""); setAllocationThreshold(item.alertThreshold || 80); setAllocationWeeklyPace(item.weeklyPace !== false); setAllocationError(""); window.setTimeout(() => document.getElementById("bf-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  const deleteAllocation = (id: string, label: string) => {
    if (!window.confirm(`Ștergi plicul „${label}”? Cheltuielile deja înregistrate rămân în jurnal.`)) return;
    const nextAllocations = plan.allocations.filter((item) => item.id !== id);
    updatePlan({ allocations: nextAllocations, totalLimit: nextAllocations.reduce((sum, item) => sum + item.amount, 0), transfers: plan.transfers.filter((transfer) => transfer.fromAllocationId !== id && transfer.toAllocationId !== id), salaryAllocationRules: (plan.salaryAllocationRules || []).filter((rule) => rule.allocationId !== id) });
  };
  const exportCyclePdf = async () => { if (!activeCycle) return; try { await downloadCalendarPlanPdf(activeCycle, data.settings.familyName); } catch { setCycleError("PDF-ul nu a putut fi generat local. Încearcă din nou."); } };

  const openWeekTransfer = (allocationId: string) => { setWeekTransferAllocationId(allocationId); setWeekTransferFromIndex(""); setWeekTransferAmount(""); setWeekTransferError(""); };
  const closeWeekTransfer = () => { setWeekTransferAllocationId(""); setWeekTransferFromIndex(""); setWeekTransferAmount(""); setWeekTransferError(""); };
  const applyWeekTransfer = (allocationId: string, toWeekIndex: number) => {
    const fromWeekIndex = Number(weekTransferFromIndex);
    const amount = parseRomanianAmount(weekTransferAmount);
    if (!fromWeekIndex) return setWeekTransferError("Alege săptămâna din care muți bani.");
    if (amount <= 0) return setWeekTransferError("Introdu o sumă mai mare decât zero.");
    const next = transferBetweenWeeks(data, { allocationId, fromWeekIndex, toWeekIndex, amount });
    if (!next) return setWeekTransferError("Suma depășește ce a mai rămas în săptămâna aleasă.");
    onChange(next);
    closeWeekTransfer();
  };

  return <div className="bf-page bf-plan-workspace bf-salary-cycle-plan">
    <header className="bf-plan-studio-header">
      <div><p className="bf-kicker">PLANUL FAMILIEI, PE CATEGORII</p><h1>Fiecare leu <em>are un loc.</em></h1><p>Adaugă câte o categorie cu suma ei. Totalul e suma categoriilor — nu introduci nicio sumă generală separat.</p></div>
      <div className="bf-plan-header-stat"><span><WalletCards size={20} /></span><small>NEREPARTIZAȚI</small><b>{money(unrepartized)}</b></div>
    </header>

    {activeWeek && <section className="bf-active-week" aria-labelledby="active-week-title"><div><p className="bf-kicker">ACUM · TRANȘA S{activeWeek.index}</p><h2 id="active-week-title">{formatDate(activeWeek.start)} – {formatDate(activeWeek.end)}</h2><span>Aceasta este săptămâna din care se vor scădea cheltuielile repartizate.</span></div><strong>{money(activeWeek.amount)}<small>ritm total</small></strong></section>}

    <section className="bf-cycle-setup" aria-labelledby="cycle-setup-title">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">CATEGORII</p><h2 id="cycle-setup-title">Unde merge fiecare leu</h2></div><span>{envelopes.length} plicuri · {money(allocated)}</span></div>
      <p>Perioada e opțională — o folosesc doar categoriile cu ritm săptămânal, ca Alimente. Se salvează automat.</p>
      <div className="bf-cycle-setup-fields">
        <PlanField label="Prima zi a perioadei (opțional)"><input type="date" value={cycleStart} onChange={(event) => { setCycleStart(event.target.value); setCycleError(""); }} onBlur={autoApplyPeriod} /></PlanField>
        <PlanField label="Ultima zi a perioadei (opțional)"><input type="date" min={cycleStart || undefined} value={cycleEnd} onChange={(event) => { setCycleEnd(event.target.value); setCycleError(""); }} onBlur={autoApplyPeriod} /></PlanField>
      </div>
      {activeCycle && <div className="bf-cycle-tranches"><div><span>RITM ORIENTATIV, DOAR CATEGORIILE CU RITM SĂPTĂMÂNAL</span><b>{money(activeCycle.weeklyAmount)} / săptămână</b></div><details className="bf-cycle-tools"><summary><span>Vezi cele {activeCycle.weeks.length} tranșe</span><ChevronDown size={17} /></summary><ol>{activeCycle.weeks.map((week) => { const spent = weekSpentByIndex.get(week.index) || 0; return <li key={week.index}><span>S{week.index}</span><b>{formatDate(week.start)} – {formatDate(week.end)}</b><small>{money(spent)} cheltuiți din {money(week.amount)}</small><strong>{money(Math.max(0, week.amount - spent))}</strong></li>; })}</ol></details></div>}
      {cycleError && <p className="bf-form-error" role="alert">{cycleError}</p>}
      <div className="bf-cycle-setup-actions"><button disabled={!activeCycle} onClick={() => void exportCyclePdf()}><FileDown size={17} /> PDF plan</button></div>

      <p className="bf-allocation-intro">Adaugă o categorie pentru fiecare parte a banilor: alimente, taxi, abonamente, consumabile copil. La o cheltuială reală, alegi categoria și aplicația scade automat din plicul potrivit.</p>
      <div id="bf-allocation-builder" className="bf-allocation-builder">
        <PlanField label="Ce plătește plicul"><select value={allocationCategory} onChange={(event) => setAllocationCategory(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></PlanField>
        <PlanField label="Nume plic" hint="Poți scrie «Taxi soție» sau lăsa automat."><input value={allocationLabel} onChange={(event) => setAllocationLabel(event.target.value)} placeholder="ex. Alimente · card soție" /></PlanField>
        <PlanField label="Membru"><select value={allocationMemberId} onChange={(event) => { const memberId = event.target.value; setAllocationMemberId(memberId); const firstCompatible = data.settings.paymentSources.find((source) => !source.memberId || source.memberId === memberId); if (firstCompatible) setAllocationSourceId(firstCompatible.id); }}><option value="">Familie / comun</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></PlanField>
        <PlanField label="Plătit din"><select value={allocationSourceId} onChange={(event) => setAllocationSourceId(event.target.value)}>{currentSourceOptions.map((source) => <option key={source.id} value={source.id}>{source.name} · {personName(data, source.memberId)} · {money(sourceBalance(data, source.id))}</option>)}</select></PlanField>
        <PlanField label="Suma acestei categorii" hint={allocationWeeklyPace ? (allocationPreview ? `În fiecare săptămână: aproximativ ${money(allocationPreview.weeklyAmount)} din acest plic.` : "Alege perioada mai sus ca să vezi ritmul săptămânal.") : "Fără ritm săptămânal — contează doar totalul."}><input value={allocationAmount} onChange={(event) => { setAllocationAmount(event.target.value); setAllocationError(""); }} inputMode="decimal" placeholder="ex. 1200" /></PlanField>
        <PlanField label="Avertizează la"><select value={allocationThreshold} onChange={(event) => setAllocationThreshold(Number(event.target.value))}>{thresholdOptions.map((value) => <option key={value} value={value}>{value}%</option>)}</select></PlanField>
        <PlanField label="Detaliu liber"><input value={allocationNote} onChange={(event) => setAllocationNote(event.target.value)} placeholder="ex. telefon, cablu și aplicații" /></PlanField>
        <label className="bf-plan-toggle"><input type="checkbox" checked={allocationWeeklyPace} onChange={(event) => setAllocationWeeklyPace(event.target.checked)} /><span><b>Împarte pe săptămâni</b><small>Dezactivează pentru plicuri fără ritm fix — taxi, cheltuieli ocazionale: rămâne doar totalul, fără presiune pe săptămână.</small></span></label>
        <div className="bf-allocation-builder-actions"><button className="bf-primary" onClick={saveAllocation}><Plus size={17} /> {editingAllocationId ? "Salvează plicul" : "Adaugă plicul"}</button>{editingAllocationId && <button onClick={resetAllocationBuilder}>Renunță</button>}</div>
      </div>
      {allocationError && <p className="bf-form-error" role="alert">{allocationError}</p>}
      <div className="bf-allocation-list" aria-live="polite">
        {envelopes.map(({ item, budget, remaining, usage, state, week, weeks }) => <article key={item.id} className={state}>
          <div className="bf-allocation-list-heading"><span className={`bf-allocation-state ${state}`}>{state === "over" ? "depășit" : state === "watch" ? "aproape de limită" : "în plan"}</span><b>{item.label}</b><small>{personName(data, item.memberId)} · {sourceName(data, item.sourceId)}{item.note ? ` · ${item.note}` : ""}</small></div>
          <div className="bf-allocation-list-total"><strong>{money(Math.max(0, remaining))}</strong><small>rămași din {money(budget)}</small></div>
          {week && <div className={`bf-allocation-week ${week.state === "over" ? "over" : ""}`}><span>S{week.index} · {formatDate(week.start)} – {formatDate(week.end)}</span><b>{money(Math.max(0, week.remaining))}</b><small>{money(week.spent)} cheltuiți din {money(week.budget)} în această tranșă</small></div>}
          {week && weeks.length > 1 && <div className="bf-week-transfer">
            {weekTransferAllocationId === item.id ? <div className="bf-week-transfer-form">
              <select value={weekTransferFromIndex} onChange={(event) => { setWeekTransferFromIndex(event.target.value); setWeekTransferError(""); }}>
                <option value="">Din ce săptămână?</option>
                {weeks.filter((other) => other.index !== week.index).map((other) => <option key={other.index} value={other.index}>S{other.index} · {formatDate(other.start)}–{formatDate(other.end)} · {money(other.remaining)} rămași</option>)}
              </select>
              <input value={weekTransferAmount} onChange={(event) => { setWeekTransferAmount(event.target.value); setWeekTransferError(""); }} inputMode="decimal" placeholder="ex. 100" />
              <div><button className="bf-primary" onClick={() => applyWeekTransfer(item.id, week.index)}>Transferă în S{week.index}</button><button onClick={closeWeekTransfer}>Renunță</button></div>
              {weekTransferError && <p className="bf-form-error" role="alert">{weekTransferError}</p>}
            </div> : <button type="button" className="bf-week-transfer-toggle" onClick={() => openWeekTransfer(item.id)}>Mută bani dintr-o altă săptămână</button>}
          </div>}
          <div className="bf-allocation-track" aria-label={`${Math.round(usage * 100)}% consumat`}><i style={{ width: `${Math.min(100, Math.max(0, usage * 100))}%` }} /></div>
          <div className="bf-allocation-actions"><button aria-label={`Editează ${item.label}`} onClick={() => editAllocation(item)}><Pencil size={15} /> Editează</button><button aria-label={`Șterge ${item.label}`} onClick={() => deleteAllocation(item.id, item.label)}><Trash2 size={15} /> Șterge</button></div>
        </article>)}
        {!envelopes.length && <div className="bf-allocation-empty"><b>Încă nu ai nicio categorie.</b><span>Începe cu Alimente, apoi adaugă Taxi, Abonamente, Rate produse și Consumabile copil.</span></div>}
      </div>
    </section>

    <details className="bf-cycle-tools"><summary><span><BookmarkPlus size={17} /> Instrumente pentru perioade repetate</span><ChevronDown size={17} /></summary><div className="bf-cycle-tools-body"><p>Un șablon reține doar durata perioadei; începi mereu următorul ciclu cu data aleasă de tine.</p><div className="bf-cycle-template-save"><input value={cycleTemplateLabel} onChange={(event) => setCycleTemplateLabel(event.target.value)} maxLength={42} placeholder={periodValid ? `ex. Salariu ${daysBetween(cycleStart, cycleEnd)} zile` : "Completează mai întâi perioada"} disabled={!periodValid} /><button disabled={!periodValid} onClick={saveCycleTemplate}>Salvează șablonul</button></div><div className="bf-cycle-template-list">{data.settings.salaryCycleTemplates.map((template) => <article key={template.id}>{templateRenameId === template.id ? <div className="bf-cycle-template-rename"><input autoFocus value={templateRename} maxLength={42} onChange={(event) => setTemplateRename(event.target.value)} /><button onClick={() => renameCycleTemplate(template.id)}>Salvează</button><button onClick={() => { setTemplateRenameId(""); setTemplateRename(""); }}>Anulează</button></div> : <><button type="button" onClick={() => applyCycleTemplate(template)}><b>{template.label}</b><small>{template.durationDays} zile</small></button><div><button type="button" aria-label={`Redenumește șablonul ${template.label}`} onClick={() => { setTemplateRenameId(template.id); setTemplateRename(template.label); }}><Pencil size={15} /></button><button type="button" aria-label={`Șterge șablonul ${template.label}`} onClick={() => deleteCycleTemplate(template.id, template.label)}><Trash2 size={15} /></button></div></>}</article>)}{!data.settings.salaryCycleTemplates.length && <span>Nu ai șabloane salvate încă.</span>}</div></div></details>
  </div>;
}
