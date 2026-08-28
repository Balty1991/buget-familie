/**
 * Atelier Financiar — Plan pe ciclu salarial: suma, perioada, plicurile și tranșa activă.
 * Filosofie: o familie împarte bani reali pe o perioadă aleasă manual; plicurile nu mută solduri.
 */
import { useState } from "react";
import { BookmarkPlus, CalendarDays, Check, ChevronDown, FileDown, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { calendarBudget } from "@/lib/calendar-budget";
import { downloadCalendarPlanPdf } from "@/lib/calendar-plan-pdf";
import { allocationBudget, allocationStatus, allocationWeekStatus, expenseCategories, formatDate, isoToday, newId, parseRomanianAmount, planEndDate, sourceBalance, type AppData, type BudgetAllocation } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const thresholdOptions = [50, 60, 70, 80, 90, 95];

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
  const [cycleAmount, setCycleAmount] = useState(plan.totalLimit ? String(plan.totalLimit) : "");
  const [cycleStart, setCycleStart] = useState(plan.periodStart);
  const [cycleEnd, setCycleEnd] = useState(planEnd || "");
  const [cycleIncomeId, setCycleIncomeId] = useState("");
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

  const enteredCycle = calendarBudget(parseRomanianAmount(cycleAmount), cycleStart, cycleEnd);
  const incomes = data.transactions.filter((item) => item.kind === "income").sort((left, right) => right.date.localeCompare(left.date) || String(right.createdAt || "").localeCompare(String(left.createdAt || ""))).slice(0, 12);
  const activeCycle = planEnd ? calendarBudget(plan.totalLimit, plan.periodStart, planEnd) : undefined;
  const activeWeek = activeCycle?.weeks.find((week) => isoToday() >= week.start && isoToday() <= week.end);
  const envelopes = plan.allocations.map((item) => ({ item, ...allocationStatus(data, item), week: item.weeklyPace === false ? undefined : allocationWeekStatus(data, item) }));
  const allocated = envelopes.reduce((sum, envelope) => sum + envelope.budget, 0);
  const unallocated = Math.round((plan.totalLimit - allocated) * 100) / 100;
  const allocationPreview = planEnd ? calendarBudget(parseRomanianAmount(allocationAmount), plan.periodStart, planEnd) : undefined;
  const allocationRatio = plan.totalLimit > 0 ? Math.min(1, Math.max(0, allocated / plan.totalLimit)) : 0;
  const nextDecision = !planEnd ? "Completează perioada și suma salariului." : unallocated < 0 ? `Redu plicurile cu ${money(Math.abs(unallocated))}.` : unallocated > 0 ? `Repartizează sau păstrează ${money(unallocated)}.` : activeWeek ? `Înregistrează cheltuielile din tranșa S${activeWeek.index}.` : "Verifică plicurile înainte de cheltuială.";
  const sourceIds = plan.sourceIds.length ? plan.sourceIds : data.settings.paymentSources.map((source) => source.id);
  const availableSources = data.settings.paymentSources.filter((source) => sourceIds.includes(source.id)).reduce((sum, source) => sum + sourceBalance(data, source.id), 0);
  const currentSourceOptions = data.settings.paymentSources.filter((source) => !allocationMemberId || !source.memberId || source.memberId === allocationMemberId);

  const updatePlan = (patch: Partial<typeof plan>) => onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, ...patch, updatedAt: new Date().toISOString() } } });
  const addDays = (start: string, amount: number) => { const date = new Date(`${start || isoToday()}T12:00:00`); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };
  const resetAllocationBuilder = () => { setAllocationLabel(""); setAllocationCategory(categories[0] || "Alimente"); setAllocationAmount(""); setAllocationMemberId(""); setAllocationSourceId(data.settings.paymentSources[0]?.id || ""); setAllocationNote(""); setAllocationThreshold(80); setAllocationWeeklyPace(true); setEditingAllocationId(""); setAllocationError(""); };

  const applyCycle = () => {
    if (!enteredCycle) return setCycleError("Introdu suma salariului și intervalul ales de tine. Data finală trebuie să fie după data de început.");
    updatePlan({ periodStart: enteredCycle.start, nextPayday: enteredCycle.end, earliestPayday: undefined, totalLimit: enteredCycle.total, weeklyLimit: enteredCycle.weeklyAmount });
    setCycleError("");
  };
  const chooseIncome = (id: string) => {
    setCycleIncomeId(id);
    const income = incomes.find((item) => item.id === id);
    if (!income) return;
    setCycleAmount(String(income.amount));
    setCycleStart(income.date || cycleStart);
    setCycleError("");
  };
  const saveCycleTemplate = () => {
    if (!enteredCycle) return setCycleError("Completează întâi suma și perioada pentru acest ciclu.");
    const label = cycleTemplateLabel.trim() || `Ciclu de ${enteredCycle.days} zile`;
    const now = new Date().toISOString();
    const duplicate = data.settings.salaryCycleTemplates.find((item) => item.label.toLocaleLowerCase("ro-RO") === label.toLocaleLowerCase("ro-RO"));
    const template = { id: duplicate?.id || newId("salary-cycle"), label, amount: enteredCycle.total, durationDays: enteredCycle.days, updatedAt: now };
    onChange({ ...data, settings: { ...data.settings, salaryCycleTemplates: [template, ...data.settings.salaryCycleTemplates.filter((item) => item.id !== duplicate?.id)].slice(0, 12) } });
    setCycleTemplateLabel("");
  };
  const applyCycleTemplate = (template: AppData["settings"]["salaryCycleTemplates"][number]) => {
    const start = cycleStart || isoToday(); setCycleAmount(String(template.amount)); setCycleStart(start); setCycleEnd(addDays(start, template.durationDays - 1)); setCycleError("");
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
    if (amount <= 0) return setAllocationError("Introdu suma rezervată pentru întregul ciclu salarial.");
    if (!source) return setAllocationError("Alege sursa din care vei plăti această categorie.");
    const label = allocationLabel.trim() || `${allocationCategory}${member ? ` · ${member.name}` : ""}`;
    const next: BudgetAllocation = { id: editingAllocationId || newId("allocation"), label, amount, category: allocationCategory, memberId: member?.id, sourceId: source.id, note: allocationNote.trim() || undefined, alertThreshold: allocationThreshold, weeklyPace: allocationWeeklyPace ? undefined : false };
    updatePlan({ allocations: editingAllocationId ? plan.allocations.map((item) => item.id === editingAllocationId ? next : item) : [...plan.allocations, next] });
    resetAllocationBuilder();
  };
  const editAllocation = (item: BudgetAllocation) => { setEditingAllocationId(item.id); setAllocationLabel(item.label); setAllocationCategory(item.category || categories[0] || "Alimente"); setAllocationAmount(String(item.amount)); setAllocationMemberId(item.memberId || ""); setAllocationSourceId(item.sourceId || data.settings.paymentSources[0]?.id || ""); setAllocationNote(item.note || ""); setAllocationThreshold(item.alertThreshold || 80); setAllocationWeeklyPace(item.weeklyPace !== false); setAllocationError(""); window.setTimeout(() => document.getElementById("bf-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  const deleteAllocation = (id: string, label: string) => { if (window.confirm(`Ștergi plicul „${label}”? Cheltuielile deja înregistrate rămân în jurnal.`)) updatePlan({ allocations: plan.allocations.filter((item) => item.id !== id), transfers: plan.transfers.filter((transfer) => transfer.fromAllocationId !== id && transfer.toAllocationId !== id), salaryAllocationRules: (plan.salaryAllocationRules || []).filter((rule) => rule.allocationId !== id) }); };
  const exportCyclePdf = async () => { if (!enteredCycle) return; try { await downloadCalendarPlanPdf(enteredCycle, data.settings.familyName); } catch { setCycleError("PDF-ul nu a putut fi generat local. Încearcă din nou."); } };

  return <div className="bf-page bf-plan-workspace bf-salary-cycle-plan">
    <header className="bf-plan-studio-header">
      <div><p className="bf-kicker">PLANUL FAMILIEI, PE SALARIU</p><h1>Împarte banii <em>ca acasă.</em></h1><p>Introdu banii disponibili, apoi împarte-i pe categorii — unele cu ritm săptămânal, altele doar cu un total.</p></div>
      <span><WalletCards size={25} /></span>
    </header>

    <section className="bf-cycle-overview" aria-labelledby="cycle-overview-title">
      <div className="bf-cycle-overview-main"><p className="bf-kicker">CICLUL ACTIV</p><h2 id="cycle-overview-title">{planEnd ? `${formatDate(plan.periodStart)} – ${formatDate(planEnd)}` : "Setează perioada salariului"}</h2><strong>{money(plan.totalLimit)}</strong><span>{activeCycle ? `${activeCycle.days} zile · ${activeCycle.weeks.length} tranșe · ritm ${money(activeCycle.weeklyAmount)}/săptămână` : "Alege începutul, următorul salariu și suma disponibilă."}</span></div>
      <div className="bf-cycle-ruler" role="progressbar" aria-label="Salariu repartizat în plicuri" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(allocationRatio * 100)}><i style={{ width: `${allocationRatio * 100}%` }} />{activeCycle?.weeks.map((week) => <span key={week.index} style={{ left: `${week.index / activeCycle.weeks.length * 100}%` }} />)}</div>
      <div className="bf-cycle-overview-ledger"><span><small>ALOCAT ÎN PLICURI</small><b>{money(allocated)}</b></span><span className={unallocated < 0 ? "over" : ""}><small>{unallocated < 0 ? "PESTE SALARIU" : "BANI NEALOCAȚI"}</small><b>{money(Math.abs(unallocated))}</b></span><span><small>SOLDURI ÎNREGISTRATE</small><b>{money(availableSources)}</b></span></div>
      <div className={`bf-cycle-next ${unallocated < 0 ? "over" : unallocated > 0 ? "review" : "ready"}`}><span>ACUM DECIDEȚI</span><b>{nextDecision}</b></div>
      <p className="bf-cycle-overview-note">Plicurile sunt limite de planificare. Ele nu mută bani între carduri sau cash și nu creează cheltuieli.</p>
    </section>

    <section className="bf-cycle-setup" aria-labelledby="cycle-setup-title">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">BANI DISPONIBILI</p><h2 id="cycle-setup-title">Câți bani ai de împărțit</h2></div><CalendarDays size={20} /></div>
      <p>Suma și perioada sunt orientative — servesc doar la calculul ritmului săptămânal al categoriilor care îl folosesc.</p>
      <div className="bf-cycle-setup-fields">
        <PlanField label="Bani disponibili de repartizat"><input value={cycleAmount} onChange={(event) => { setCycleAmount(event.target.value); setCycleError(""); }} inputMode="decimal" placeholder="ex. 2400" /></PlanField>
        <PlanField label="Venit înregistrat (opțional)" hint="Doar precompletează suma și începutul; tu alegi perioada."><select value={cycleIncomeId} onChange={(event) => chooseIncome(event.target.value)}><option value="">Introduc salariul manual</option>{incomes.map((income) => <option key={income.id} value={income.id}>{income.date} · {income.title} · {money(income.amount)}</option>)}</select></PlanField>
        <PlanField label="Prima zi a ciclului"><input type="date" value={cycleStart} onChange={(event) => { setCycleStart(event.target.value); setCycleError(""); }} /></PlanField>
        <PlanField label="Ziua următorului salariu"><input type="date" min={cycleStart || undefined} value={cycleEnd} onChange={(event) => { setCycleEnd(event.target.value); setCycleError(""); }} /></PlanField>
      </div>
      {enteredCycle && <div className="bf-cycle-tranches"><div><span>RITM ORIENTATIV</span><b>{money(enteredCycle.weeklyAmount)} / săptămână</b></div><details className="bf-cycle-tools"><summary><span>Vezi cele {enteredCycle.weeks.length} tranșe</span><ChevronDown size={17} /></summary><ol>{enteredCycle.weeks.map((week) => <li key={week.index}><span>S{week.index}</span><b>{formatDate(week.start)} – {formatDate(week.end)}</b><small>{week.days} zile</small><strong>{money(week.amount)}</strong></li>)}</ol></details></div>}
      {cycleError && <p className="bf-form-error" role="alert">{cycleError}</p>}
      <div className="bf-cycle-setup-actions"><button className="bf-primary" disabled={!enteredCycle} onClick={applyCycle}><Check size={17} /> Salvează ciclul</button><button disabled={!enteredCycle} onClick={() => void exportCyclePdf()}><FileDown size={17} /> PDF plan</button></div>
    </section>

    {activeWeek && <section className="bf-active-week" aria-labelledby="active-week-title"><div><p className="bf-kicker">ACUM · TRANȘA S{activeWeek.index}</p><h2 id="active-week-title">{formatDate(activeWeek.start)} – {formatDate(activeWeek.end)}</h2><span>Aceasta este săptămâna din care se vor scădea cheltuielile repartizate.</span></div><strong>{money(activeWeek.amount)}<small>ritm total</small></strong></section>}

    <section className="bf-allocation-studio" aria-labelledby="allocation-title">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">CATEGORII</p><h2 id="allocation-title">Unde merge fiecare leu</h2></div><span>{envelopes.length} plicuri</span></div>
      <p className="bf-allocation-intro">Creează o categorie pentru fiecare parte a banilor: alimente, taxi, abonamente, consumabile copil. La o cheltuială reală, alegi categoria și aplicația scade automat din plicul potrivit.</p>
      <div id="bf-allocation-builder" className="bf-allocation-builder">
        <PlanField label="Ce plătește plicul"><select value={allocationCategory} onChange={(event) => setAllocationCategory(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></PlanField>
        <PlanField label="Nume plic" hint="Poți scrie «Taxi soție» sau lăsa automat."><input value={allocationLabel} onChange={(event) => setAllocationLabel(event.target.value)} placeholder="ex. Alimente · card soție" /></PlanField>
        <PlanField label="Membru"><select value={allocationMemberId} onChange={(event) => { const memberId = event.target.value; setAllocationMemberId(memberId); const firstCompatible = data.settings.paymentSources.find((source) => !source.memberId || source.memberId === memberId); if (firstCompatible) setAllocationSourceId(firstCompatible.id); }}><option value="">Familie / comun</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></PlanField>
        <PlanField label="Plătit din"><select value={allocationSourceId} onChange={(event) => setAllocationSourceId(event.target.value)}>{currentSourceOptions.map((source) => <option key={source.id} value={source.id}>{source.name} · {personName(data, source.memberId)} · {money(sourceBalance(data, source.id))}</option>)}</select></PlanField>
        <PlanField label="Suma pentru întregul ciclu" hint={allocationPreview ? `În fiecare săptămână: aproximativ ${money(allocationPreview.weeklyAmount)} din acest plic.` : "Exemplu: 1.200 RON înseamnă 300 RON/săptămână într-un ciclu de 28 zile."}><input value={allocationAmount} onChange={(event) => { setAllocationAmount(event.target.value); setAllocationError(""); }} inputMode="decimal" placeholder="ex. 1200" /></PlanField>
        <PlanField label="Avertizează la"><select value={allocationThreshold} onChange={(event) => setAllocationThreshold(Number(event.target.value))}>{thresholdOptions.map((value) => <option key={value} value={value}>{value}%</option>)}</select></PlanField>
        <PlanField label="Detaliu liber"><input value={allocationNote} onChange={(event) => setAllocationNote(event.target.value)} placeholder="ex. telefon, cablu și aplicații" /></PlanField>
        <label className="bf-plan-toggle"><input type="checkbox" checked={allocationWeeklyPace} onChange={(event) => setAllocationWeeklyPace(event.target.checked)} /><span><b>Împarte pe săptămâni</b><small>Dezactivează pentru plicuri fără ritm fix — taxi, cheltuieli ocazionale: rămâne doar totalul din ciclu, fără presiune pe săptămână.</small></span></label>
        <div className="bf-allocation-builder-actions"><button className="bf-primary" onClick={saveAllocation}><Plus size={17} /> {editingAllocationId ? "Salvează plicul" : "Adaugă plicul"}</button>{editingAllocationId && <button onClick={resetAllocationBuilder}>Renunță</button>}</div>
      </div>
      {allocationError && <p className="bf-form-error" role="alert">{allocationError}</p>}
      <div className="bf-allocation-list" aria-live="polite">
        {envelopes.map(({ item, budget, remaining, usage, state, week }) => <article key={item.id} className={state}>
          <div className="bf-allocation-list-heading"><span className={`bf-allocation-state ${state}`}>{state === "over" ? "depășit" : state === "watch" ? "aproape de limită" : "în plan"}</span><b>{item.label}</b><small>{personName(data, item.memberId)} · {sourceName(data, item.sourceId)}{item.note ? ` · ${item.note}` : ""}</small></div>
          <div className="bf-allocation-list-total"><strong>{money(Math.max(0, remaining))}</strong><small>rămași din {money(budget)}</small></div>
          {week && <div className={`bf-allocation-week ${week.state === "over" ? "over" : ""}`}><span>S{week.index} · {formatDate(week.start)} – {formatDate(week.end)}</span><b>{money(Math.max(0, week.remaining))}</b><small>{money(week.spent)} cheltuiți din {money(week.budget)} în această tranșă</small></div>}
          <div className="bf-allocation-track" aria-label={`${Math.round(usage * 100)}% consumat`}><i style={{ width: `${Math.min(100, Math.max(0, usage * 100))}%` }} /></div>
          <div className="bf-allocation-actions"><button aria-label={`Editează ${item.label}`} onClick={() => editAllocation(item)}><Pencil size={15} /> Editează</button><button aria-label={`Șterge ${item.label}`} onClick={() => deleteAllocation(item.id, item.label)}><Trash2 size={15} /> Șterge</button></div>
        </article>)}
        {!envelopes.length && <div className="bf-allocation-empty"><b>Încă nu ai repartizat salariul.</b><span>Începe cu Alimente, apoi adaugă Taxi, Abonamente, Rate produse și Consumabile copil.</span></div>}
      </div>
    </section>

    <section className="bf-plan-unallocated" aria-label="Banii nealocați"><div><p className="bf-kicker">SEPAREU DE SIGURANȚĂ</p><h2>Bani încă nealocați</h2><p>Rămân intenționat în afara plicurilor până decizi ce faci cu ei. Nu sunt cheltuiți și nu se mută din nicio sursă.</p></div><strong className={unallocated < 0 ? "over" : ""}>{unallocated < 0 ? "−" : ""}{money(Math.abs(unallocated))}</strong></section>

    <details className="bf-cycle-tools"><summary><span><BookmarkPlus size={17} /> Instrumente pentru cicluri repetate</span><ChevronDown size={17} /></summary><div className="bf-cycle-tools-body"><p>Un șablon reține doar suma și durata; începi mereu următorul ciclu cu data aleasă de tine. PDF-ul se generează local pe dispozitiv.</p><div className="bf-cycle-template-save"><input value={cycleTemplateLabel} onChange={(event) => setCycleTemplateLabel(event.target.value)} maxLength={42} placeholder={enteredCycle ? `ex. Salariu ${enteredCycle.days} zile` : "Completează mai întâi ciclul"} disabled={!enteredCycle} /><button disabled={!enteredCycle} onClick={saveCycleTemplate}>Salvează șablonul</button></div><div className="bf-cycle-template-list">{data.settings.salaryCycleTemplates.map((template) => <article key={template.id}>{templateRenameId === template.id ? <div className="bf-cycle-template-rename"><input autoFocus value={templateRename} maxLength={42} onChange={(event) => setTemplateRename(event.target.value)} /><button onClick={() => renameCycleTemplate(template.id)}>Salvează</button><button onClick={() => { setTemplateRenameId(""); setTemplateRename(""); }}>Anulează</button></div> : <><button type="button" onClick={() => applyCycleTemplate(template)}><b>{template.label}</b><small>{money(template.amount)} · {template.durationDays} zile</small></button><div><button type="button" aria-label={`Redenumește șablonul ${template.label}`} onClick={() => { setTemplateRenameId(template.id); setTemplateRename(template.label); }}><Pencil size={15} /></button><button type="button" aria-label={`Șterge șablonul ${template.label}`} onClick={() => deleteCycleTemplate(template.id, template.label)}><Trash2 size={15} /></button></div></>}</article>)}{!data.settings.salaryCycleTemplates.length && <span>Nu ai șabloane salvate încă.</span>}</div></div></details>
  </div>;
}
