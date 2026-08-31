import { useState } from "react";
import { Banknote, Check, RotateCcw, Trash2 } from "lucide-react";
import { applySalaryAllocationRules, eligibleSalaryAllocationRules, formatDate, newId, parseRomanianAmount, revertSalaryAllocationApplication, unappliedSalaryIncomes, type AppData, type SalaryAllocationRule } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

/**
 * Ritual de salariu: reguli de umplere a plicurilor când un venit e deja în registru.
 * Crește numai limitele; nu mută bani între surse. Idempotent pe incomeId.
 */
export function SalaryRitualPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const plan = data.settings.salaryPlan;
  const rules = plan.salaryAllocationRules || [];
  const applications = plan.salaryAllocationApplications || [];
  const pending = unappliedSalaryIncomes(data).filter((item) => eligibleSalaryAllocationRules(data, item).length > 0).slice(0, 4);
  const [label, setLabel] = useState("");
  const [allocationId, setAllocationId] = useState(plan.allocations[0]?.id || "");
  const [mode, setMode] = useState<"fixed" | "percent">("percent");
  const [value, setValue] = useState("10");
  const [error, setError] = useState("");

  if (!plan.allocations.length) return null;

  const saveRule = () => {
    const amount = parseRomanianAmount(value);
    const name = label.trim() || (mode === "percent" ? `${amount}% ${plan.allocations.find((item) => item.id === allocationId)?.label || "plic"}` : `${money(amount)} ${plan.allocations.find((item) => item.id === allocationId)?.label || "plic"}`);
    if (!allocationId) return setError("Alege plicul care primește din venit.");
    if (amount <= 0) return setError("Introdu o valoare mai mare decât zero.");
    if (mode === "percent" && amount > 100) return setError("Procentul nu poate depăși 100%.");
    const rule: SalaryAllocationRule = { id: newId("salary-rule"), label: name.slice(0, 42), allocationId, mode, value: mode === "percent" ? Math.min(100, amount) : amount, active: true, updatedAt: new Date().toISOString() };
    onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, salaryAllocationRules: [rule, ...rules].slice(0, 24), updatedAt: rule.updatedAt } } });
    setLabel("");
    setError("");
  };
  const toggleRule = (id: string) => {
    onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, salaryAllocationRules: rules.map((item) => item.id === id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item), updatedAt: new Date().toISOString() } } });
  };
  const deleteRule = (id: string, name: string) => {
    if (!window.confirm(`Ștergi regula „${name}”? Veniturile deja repartizate rămân neschimbate.`)) return;
    onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, salaryAllocationRules: rules.filter((item) => item.id !== id), updatedAt: new Date().toISOString() } } });
  };
  const applyIncome = (incomeId: string) => {
    const result = applySalaryAllocationRules(data, incomeId);
    if (result.error) return setError(result.error);
    onChange(result.data);
    setError("");
  };
  const revert = (applicationId: string) => {
    if (!window.confirm("Anulezi umplerea plicurilor din acest venit? Limitele revin, registrul rămâne neschimbat.")) return;
    onChange(revertSalaryAllocationApplication(data, applicationId));
  };

  return (
    <section className="bf-salary-ritual" aria-labelledby="salary-ritual-title">
      <div className="bf-section-heading">
        <div>
          <p className="bf-kicker">RITUAL DE SALARIU</p>
          <h2 id="salary-ritual-title">A venit salariul? Umple plicurile.</h2>
          <p>Regulile cresc limitele plicurilor dintr-un venit deja înregistrat. Nu mută bani din card sau cash.</p>
        </div>
        <Banknote size={22} aria-hidden="true" />
      </div>

      {pending.length > 0 && (
        <div className="bf-salary-pending">
          {pending.map((income) => {
            const eligible = eligibleSalaryAllocationRules(data, income);
            const preview = eligible.map((rule) => ({ rule, amount: Math.round((rule.mode === "percent" ? income.amount * rule.value / 100 : rule.value) * 100) / 100 })).filter((item) => item.amount > 0);
            const total = preview.reduce((sum, item) => sum + item.amount, 0);
            return (
              <article key={income.id}>
                <div>
                  <b>{income.title}</b>
                  <small>{formatDate(income.date)} · {money(income.amount)} · {preview.length} reguli · {money(total)} spre plicuri</small>
                </div>
                <button type="button" className="bf-primary" onClick={() => applyIncome(income.id)}><Check size={15} /> Umple plicurile</button>
              </article>
            );
          })}
        </div>
      )}

      <div className="bf-salary-rule-form">
        <label><span>Plic</span><select value={allocationId} onChange={(event) => setAllocationId(event.target.value)}>{plan.allocations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Mod</span><select value={mode} onChange={(event) => setMode(event.target.value as "fixed" | "percent")}><option value="percent">Procent din venit</option><option value="fixed">Sumă fixă</option></select></label>
        <label><span>{mode === "percent" ? "Procent" : "Sumă"}</span><input value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} inputMode="decimal" placeholder={mode === "percent" ? "ex. 10" : "ex. 400"} /></label>
        <label><span>Nume (opțional)</span><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={42} placeholder="ex. 10% alimente" /></label>
        <button type="button" className="bf-primary" onClick={saveRule}>Adaugă regula</button>
      </div>
      {error && <p className="bf-form-error" role="alert">{error}</p>}

      <div className="bf-salary-rules">
        {rules.map((rule) => {
          const envelope = plan.allocations.find((item) => item.id === rule.allocationId);
          return (
            <article key={rule.id} className={rule.active ? "" : "paused"}>
              <div>
                <b>{rule.label}</b>
                <small>{envelope?.label || "Plic eliminat"} · {rule.mode === "percent" ? `${rule.value}% din venit` : money(rule.value)}</small>
              </div>
              <div>
                <button type="button" onClick={() => toggleRule(rule.id)}>{rule.active ? "Pauză" : "Activează"}</button>
                <button type="button" className="delete" aria-label={`Șterge regula ${rule.label}`} onClick={() => deleteRule(rule.id, rule.label)}><Trash2 size={15} /></button>
              </div>
            </article>
          );
        })}
        {!rules.length && <p className="bf-salary-empty">Nicio regulă încă. Adaugă un procent sau o sumă fixă pentru fiecare plic pe care vrei să-l umpli la salariu.</p>}
      </div>

      {applications.length > 0 && (
        <div className="bf-salary-applied">
          <p className="bf-kicker">APLICATE</p>
          {applications.slice(0, 5).map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.incomeTitle}</b>
                <small>{formatDate(item.appliedAt.slice(0, 10))} · {money(item.allocations.reduce((sum, entry) => sum + entry.amount, 0))} în {item.allocations.length} plicuri</small>
              </div>
              <button type="button" onClick={() => revert(item.id)}><RotateCcw size={14} /> Anulează</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
