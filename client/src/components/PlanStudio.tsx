/**
 * Atelierul Financiar — Plan Studio: perioadă prudentă, plicuri și reguli locale explicabile.
 * Regulile cresc limitele după confirmarea utilizatorului; nu mută bani între surse și nu scriu în registru.
 */
import { useState } from "react";
import { CalendarDays, Check, ChevronRight, Plus, Trash2, WalletCards } from "lucide-react";
import { applySalaryAllocationRules, allocationStatus, eligibleSalaryAllocationRules, expenseCategories, newId, parseRomanianAmount, planEndDate, revertSalaryAllocationApplication, sourceBalance, type AppData } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const thresholdOptions = [50, 60, 70, 80, 90, 95];

function PlanField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="bf-plan-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function PlanStudio({ data, onChange }: { data: AppData; onChange: (data: AppData) => void }) {
  const plan = data.settings.salaryPlan;
  const [mode, setMode] = useState<"member" | "category">("category");
  const [target, setTarget] = useState(expenseCategories[0]);
  const [allocationMemberId, setAllocationMemberId] = useState("");
  const [sourceId, setSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [ruleAllocationId, setRuleAllocationId] = useState("");
  const [ruleMode, setRuleMode] = useState<"fixed" | "percent">("fixed");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleLabel, setRuleLabel] = useState("");
  const [selectedIncomeId, setSelectedIncomeId] = useState("");
  const [ruleError, setRuleError] = useState("");

  const planEnd = planEndDate(plan);
  const sourceIds = plan.sourceIds.length ? plan.sourceIds : data.settings.paymentSources.map((source) => source.id);
  const activeSources = data.settings.paymentSources.filter((source) => sourceIds.includes(source.id));
  const availableSources = activeSources.reduce((sum, source) => sum + sourceBalance(data, source.id), 0);
  const plannedExpenses = data.transactions.filter((item) => item.kind === "expense" && item.date >= plan.periodStart && (!planEnd || item.date <= planEnd)).reduce((sum, item) => sum + item.amount, 0);
  const budget = plan.totalLimit || Math.max(0, availableSources);
  const days = planEnd ? Math.max(1, Math.floor((new Date(`${planEnd}T12:00:00`).valueOf() - new Date(`${plan.periodStart}T12:00:00`).valueOf()) / 86_400_000) + 1) : 7;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const weekly = plan.weeklyLimit || budget / weeks;
  const remaining = budget - plannedExpenses;
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const targets = mode === "category" ? categories : data.settings.members.map((item) => item.id);
  const envelopes = plan.allocations.map((item) => ({ item, ...allocationStatus(data, item) }));
  const salaryRules = plan.salaryAllocationRules || [];
  const salaryApplications = plan.salaryAllocationApplications || [];
  const incomes = data.transactions.filter((item) => item.kind === "income").sort((left, right) => right.date.localeCompare(left.date) || String(right.createdAt || "").localeCompare(String(left.createdAt || ""))).slice(0, 12);
  const selectedIncome = incomes.find((item) => item.id === selectedIncomeId) || incomes[0];
  const eligibleRules = selectedIncome ? eligibleSalaryAllocationRules(data, selectedIncome) : [];
  const plannedFromIncome = selectedIncome ? eligibleRules.reduce((sum, rule) => sum + (rule.mode === "percent" ? selectedIncome.amount * rule.value / 100 : rule.value), 0) : 0;

  const updatePlan = (patch: Partial<typeof plan>) => onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, ...patch, updatedAt: new Date().toISOString() } } });
  const updateEstimatedPayday = (nextPayday: string) => updatePlan({ nextPayday, earliestPayday: plan.earliestPayday && plan.earliestPayday <= nextPayday ? plan.earliestPayday : undefined });
  const toggleSource = (id: string) => {
    const all = data.settings.paymentSources.map((source) => source.id);
    const selected = plan.sourceIds.length ? plan.sourceIds : all;
    const next = selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
    updatePlan({ sourceIds: next.length === all.length ? [] : next });
  };
  const addEnvelope = () => {
    const numeric = parseRomanianAmount(amount);
    const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    if (numeric <= 0 || !source) return;
    const member = mode === "category" ? data.settings.members.find((item) => item.id === allocationMemberId) : data.settings.members.find((item) => item.id === target);
    const category = mode === "category" ? target : undefined;
    updatePlan({ allocations: [...plan.allocations, { id: newId("allocation"), label: category ? `${category}${member ? ` · ${member.name}` : ""}` : member?.name || "Membru", amount: numeric, category, memberId: member?.id, sourceId: source.id, note: note.trim() || undefined, alertThreshold }] });
    setAmount(""); setNote(""); setAlertThreshold(80);
  };
  const updateEnvelopeThreshold = (id: string, value: number) => updatePlan({ allocations: plan.allocations.map((item) => item.id === id ? { ...item, alertThreshold: Math.min(95, Math.max(50, value)) } : item) });
  const addSalaryRule = () => {
    const value = parseRomanianAmount(ruleValue);
    const allocation = plan.allocations.find((item) => item.id === ruleAllocationId);
    if (!allocation || value <= 0 || (ruleMode === "percent" && value > 100)) return setRuleError(ruleMode === "percent" ? "Alege un plic și un procent între 1 și 100." : "Alege un plic și o sumă mai mare decât zero.");
    const label = ruleLabel.trim() || `${allocation.label} · ${ruleMode === "percent" ? `${value}% din venit` : `${money(value)} din venit`}`;
    updatePlan({ salaryAllocationRules: [{ id: newId("salary-rule"), label, allocationId: allocation.id, mode: ruleMode, value, active: true, updatedAt: new Date().toISOString() }, ...salaryRules].slice(0, 24) });
    setRuleValue(""); setRuleLabel(""); setRuleError("");
  };
  const updateSalaryRule = (id: string, patch: Partial<(typeof salaryRules)[number]>) => updatePlan({ salaryAllocationRules: salaryRules.map((rule) => rule.id === id ? { ...rule, ...patch, updatedAt: new Date().toISOString() } : rule) });
  const applyRulesToIncome = () => {
    if (!selectedIncome) return setRuleError("Înregistrează mai întâi un venit real în Jurnal.");
    const result = applySalaryAllocationRules(data, selectedIncome.id);
    if (result.error) return setRuleError(result.error);
    onChange(result.data); setRuleError("");
  };
  const revokeApplication = (applicationId: string) => {
    if (window.confirm("Anulezi această repartizare? Se vor reduce numai limitele plicurilor majorate prin această aplicare; registrul și soldurile surselor rămân neschimbate.")) onChange(revertSalaryAllocationApplication(data, applicationId));
  };

  return <div className="bf-page bf-plan-workspace">
    <header className="bf-plan-studio-header">
      <div><p className="bf-kicker">PLAN PÂNĂ LA URMĂTORUL VENIT</p><h1>Alocă înainte <em>de cheltuială.</em></h1><p>Perioada și limitele pornesc din banii pe care alegi să îi folosești, nu din estimări ascunse.</p></div>
      <span><CalendarDays size={25} /></span>
    </header>
    <section className={`bf-plan-resource-band ${remaining < 0 ? "risk" : ""}`}>
      <div><p>{remaining < 0 ? "Limita trebuie revizuită" : "Disponibil de planificat"}</p><strong>{money(Math.max(0, remaining))}</strong><span>{plan.nextPayday ? `${days} zile · ${weeks} săptămâni · ${money(weekly)}/săptămână` : "setează data următorului venit"}</span></div>
      <div className="bf-plan-resource-stats"><span><b>{money(budget)}</b> limită activă</span><span><b>{money(plannedExpenses)}</b> cheltuit în perioadă</span><span><b>{money(availableSources)}</b> în sursele alese</span></div>
    </section>
    <section className="bf-plan-sheet">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">1. CADRUL PLANULUI</p><h2>Perioadă și limite</h2></div><span>se salvează automat</span></div>
      <div className="bf-plan-fields">
        <PlanField label="Începe la"><input type="date" value={plan.periodStart} onChange={(event) => updatePlan({ periodStart: event.target.value })} /></PlanField>
        <PlanField label="De regulă intră la"><input type="date" min={plan.periodStart} value={plan.nextPayday} onChange={(event) => updateEstimatedPayday(event.target.value)} /></PlanField>
        <PlanField label="Poate intra cel mai devreme" hint="Calcul prudent până la această dată."><input type="date" min={plan.periodStart} max={plan.nextPayday || undefined} value={plan.earliestPayday || ""} onChange={(event) => updatePlan({ earliestPayday: event.target.value || undefined })} /></PlanField>
        <PlanField label="Limită totală"><input value={plan.totalLimit ? String(plan.totalLimit) : ""} onChange={(event) => updatePlan({ totalLimit: Math.max(0, parseRomanianAmount(event.target.value)) })} inputMode="decimal" placeholder={money(availableSources)} /></PlanField>
        <PlanField label="Limită săptămânală"><input value={plan.weeklyLimit ? String(plan.weeklyLimit) : ""} onChange={(event) => updatePlan({ weeklyLimit: Math.max(0, parseRomanianAmount(event.target.value)) })} inputMode="decimal" placeholder={money(weekly)} /></PlanField>
      </div>
    </section>
    <section className="bf-plan-sources">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">2. RESURSE FOLOSITE</p><h2>Alege banii incluși</h2></div><WalletCards size={19} /></div>
      <div>{data.settings.paymentSources.map((source) => { const active = !plan.sourceIds.length || plan.sourceIds.includes(source.id); const owner = data.settings.members.find((member) => member.id === source.memberId)?.name || "Comun"; return <label key={source.id} className={active ? "active" : ""}><input type="checkbox" checked={active} onChange={() => toggleSource(source.id)} /><span><b>{source.name}</b><small>{owner}</small></span><strong>{money(sourceBalance(data, source.id))}</strong><i>{active && <Check size={14} />}</i></label>; })}</div>
    </section>
    <section className="bf-plan-envelope-workbench">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">3. PLICURI LUNARE ȘI DE PERIOADĂ</p><h2>Limite care pot fi folosite</h2></div><span>{envelopes.length} active</span></div>
      <p className="bf-plan-envelope-intro">Un plic reprezintă o limită de buget. Cheltuiala din jurnal îl consumă numai când îl selectezi explicit; mutarea între plicuri nu mișcă bani între carduri sau cash.</p>
      <div className="bf-plan-envelope-builder">
        <PlanField label="Tip"><select value={mode} onChange={(event) => { const next = event.target.value as typeof mode; setMode(next); setTarget(next === "category" ? categories[0] : data.settings.members[0]?.id || ""); setAllocationMemberId(""); }}><option value="category">Categorie</option><option value="member">Membru</option></select></PlanField>
        <PlanField label={mode === "category" ? "Categorie" : "Membru"}><select value={target} onChange={(event) => setTarget(event.target.value)}>{targets.map((item) => <option key={item} value={item}>{mode === "member" ? data.settings.members.find((member) => member.id === item)?.name : item}</option>)}</select></PlanField>
        {mode === "category" && <PlanField label="Pentru"><select value={allocationMemberId} onChange={(event) => setAllocationMemberId(event.target.value)}><option value="">Familie / comun</option>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></PlanField>}
        <PlanField label="Sursă"><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{data.settings.paymentSources.map((source) => <option key={source.id} value={source.id}>{source.name} · {money(sourceBalance(data, source.id))}</option>)}</select></PlanField>
        <PlanField label="Limită"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="lei" /></PlanField>
        <PlanField label="Alertă la" hint="100% înseamnă depășit."><select value={alertThreshold} onChange={(event) => setAlertThreshold(Number(event.target.value))}>{thresholdOptions.map((value) => <option key={value} value={value}>{value}%</option>)}</select></PlanField>
        <PlanField label="Detaliu"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="opțional" /></PlanField>
        <button onClick={addEnvelope}><Plus size={17} /> Creează plic</button>
      </div>
      <div className="bf-plan-envelope-list">
        {envelopes.map(({ item, budget: limit, remaining: remainingEnvelope, usage, state, alertThreshold: envelopeThreshold }) => { const memberName = data.settings.members.find((member) => member.id === item.memberId)?.name || "Familie"; const sourceName = data.settings.paymentSources.find((source) => source.id === item.sourceId)?.name || "Orice sursă"; const usagePercent = Math.round(Math.max(0, usage) * 100); return <article className={state} key={item.id}><div><span className="bf-plan-envelope-state">{state === "over" ? "Depășit" : state === "watch" ? "Aproape de limită" : "În limite"}</span><b>{item.label}</b><small>{memberName} · {sourceName}{item.note ? ` · ${item.note}` : ""}</small></div><div><strong>{money(Math.max(0, remainingEnvelope))}</strong><small>rămași din {money(limit)}</small></div><span className="bf-plan-envelope-track"><i style={{ width: `${Math.min(100, usagePercent)}%` }} /></span><label className="bf-envelope-threshold">Alertă la <select aria-label={`Prag de alertă pentru ${item.label}`} value={envelopeThreshold} onChange={(event) => updateEnvelopeThreshold(item.id, Number(event.target.value))}>{thresholdOptions.map((value) => <option key={value} value={value}>{value}%</option>)}</select></label><button aria-label={`Șterge ${item.label}`} onClick={() => updatePlan({ allocations: plan.allocations.filter((entry) => entry.id !== item.id), transfers: plan.transfers.filter((transfer) => transfer.fromAllocationId !== item.id && transfer.toAllocationId !== item.id), salaryAllocationRules: salaryRules.filter((rule) => rule.allocationId !== item.id) })}><Trash2 size={16} /></button></article>; })}
        {!envelopes.length && <div className="bf-plan-envelope-empty"><p>Începe cu o limită clară, de exemplu Transport, Alimente sau Taxi.</p><ChevronRight size={18} /></div>}
      </div>
    </section>
    <section className="bf-salary-rules">
      <div className="bf-plan-sheet-heading"><div><p className="bf-kicker">4. REGULI PENTRU VENIT</p><h2>Repartizează salariul cu control</h2></div><span>{salaryRules.length} reguli</span></div>
      <p>Regulile propun o majorare a limitelor din plicuri pentru un venit real deja înregistrat. Nu transferă bani între surse și nu schimbă registrul.</p>
      {envelopes.length ? <>
        <div className="bf-salary-rule-builder">
          <PlanField label="Plic"><select value={ruleAllocationId} onChange={(event) => setRuleAllocationId(event.target.value)}><option value="">Alege plicul</option>{envelopes.map(({ item }) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></PlanField>
          <PlanField label="Regulă"><select value={ruleMode} onChange={(event) => setRuleMode(event.target.value as typeof ruleMode)}><option value="fixed">Sumă fixă</option><option value="percent">Procent</option></select></PlanField>
          <PlanField label={ruleMode === "percent" ? "Procent" : "Sumă"}><input value={ruleValue} onChange={(event) => setRuleValue(event.target.value)} inputMode="decimal" placeholder={ruleMode === "percent" ? "ex. 20" : "ex. 500"} /></PlanField>
          <PlanField label="Nume opțional"><input value={ruleLabel} onChange={(event) => setRuleLabel(event.target.value)} placeholder="ex. Transport după salariu" /></PlanField>
          <button onClick={addSalaryRule}><Plus size={17} /> Adaugă regulă</button>
        </div>
        {ruleError && <p className="bf-form-error" role="alert">{ruleError}</p>}
        <div className="bf-salary-rule-list">
          {salaryRules.map((rule) => { const allocation = plan.allocations.find((item) => item.id === rule.allocationId); return <article key={rule.id}><label><input type="checkbox" checked={rule.active} onChange={(event) => updateSalaryRule(rule.id, { active: event.target.checked })} /><span><b>{rule.label}</b><small>{allocation?.label || "Plic șters"}</small></span></label><select aria-label={`Plic pentru ${rule.label}`} value={rule.allocationId} onChange={(event) => updateSalaryRule(rule.id, { allocationId: event.target.value })}>{envelopes.map(({ item }) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label={`Tip regulă pentru ${rule.label}`} value={rule.mode} onChange={(event) => updateSalaryRule(rule.id, { mode: event.target.value as "fixed" | "percent" })}><option value="fixed">RON</option><option value="percent">%</option></select><input aria-label={`Valoare pentru ${rule.label}`} value={rule.value} inputMode="decimal" onChange={(event) => { const next = parseRomanianAmount(event.target.value); updateSalaryRule(rule.id, { value: rule.mode === "percent" ? Math.min(100, Math.max(0, next)) : Math.max(0, next) }); }} /><button aria-label={`Șterge regula ${rule.label}`} onClick={() => updatePlan({ salaryAllocationRules: salaryRules.filter((item) => item.id !== rule.id) })}><Trash2 size={16} /></button></article>; })}
          {!salaryRules.length && <p className="bf-empty-inline">Adaugă reguli pentru plicurile existente, de exemplu 500 RON către Alimente sau 15% către Transport.</p>}
        </div>
        <div className="bf-salary-apply">
          <div><p className="bf-kicker">APLICĂ DUPĂ ÎNREGISTRAREA VENITULUI</p><h3>Previzualizează înainte să confirmi</h3><p>Aplicarea crește numai limitele plicurilor compatibile cu membrul și sursa venitului selectat.</p></div>
          <PlanField label="Venit real"><select value={selectedIncome?.id || ""} onChange={(event) => setSelectedIncomeId(event.target.value)} disabled={!incomes.length}><option value="">{incomes.length ? "Alege venitul" : "Nu ai venituri înregistrate"}</option>{incomes.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.title} · {money(item.amount)}</option>)}</select></PlanField>
          <div className="bf-salary-preview"><span>Reguli compatibile <b>{eligibleRules.length}</b></span><span>De repartizat <b>{money(plannedFromIncome)}</b></span><span>Rămâne nealocat <b>{money(Math.max(0, (selectedIncome?.amount || 0) - plannedFromIncome))}</b></span></div>
          <button className="bf-primary" disabled={!selectedIncome || !eligibleRules.length || plannedFromIncome > (selectedIncome?.amount || 0)} onClick={applyRulesToIncome}><Check size={17} /> Aplică repartizarea</button>
        </div>
        <div className="bf-salary-application-list">
          {salaryApplications.slice(0, 4).map((application) => <article key={application.id}><div><b>{application.incomeTitle}</b><small>{application.appliedAt.slice(0, 10)} · {money(application.allocations.reduce((sum, item) => sum + item.amount, 0))} repartizați în {application.allocations.length} plicuri</small></div><button onClick={() => revokeApplication(application.id)}>Anulează</button></article>)}
          {!salaryApplications.length && <p>Nu ai aplicat încă reguli la un venit.</p>}
        </div>
      </> : <div className="bf-plan-envelope-empty"><p>Creează întâi un plic; regulile repartizează numai către limite existente.</p><ChevronRight size={18} /></div>}
    </section>
  </div>;
}
