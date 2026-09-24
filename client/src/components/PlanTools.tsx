/**
 * Uneltele din Plan care lucrează pe o copie a sumelor, cu starea lor proprie: propunerea din
 * fluxul real (ultimele 7 zile + scadențe + obiective) și simulatorul. Nimic nu se schimbă în plan
 * până la „Aplică”, care trimite doar sumele modificate.
 */
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { parseRomanianAmount, suggestWeeklyAllocationsFromCashflow, type AppData, type BudgetAllocation } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

type Change = { id: string; amount: number };
const money = lei;
/** Doar sumele care diferă de plan, citite cu aceleași reguli ca în restul aplicației. */
const changedAmounts = (allocations: BudgetAllocation[], draft: Record<string, string>, fallback: (id: string) => number): Change[] =>
  Object.keys(draft).map((id) => ({ id, amount: Math.max(0, parseRomanianAmount(draft[id] ?? String(fallback(id)))) }))
    .filter((change) => change.amount !== allocations.find((item) => item.id === change.id)?.amount);

export function PlanCashflowSuggest({ data, allocations, onApply }: { data: AppData; allocations: BudgetAllocation[]; onApply: (changes: Change[]) => void }) {
  const [cashflowOpen, setCashflowOpen] = useState(false);
  const [cashflowDraft, setCashflowDraft] = useState<Record<string, string>>({});
  const cashflowHint = suggestWeeklyAllocationsFromCashflow(data);
  const openCashflowSuggest = () => {
    setCashflowDraft(Object.fromEntries(cashflowHint.suggestions.map((item) => [item.allocationId, String(item.suggestedAmount)])));
    setCashflowOpen(true);
  };
  const applyCashflowSuggest = () => {
    const changes = changedAmounts(allocations, cashflowDraft, (id) => cashflowHint.suggestions.find((item) => item.allocationId === id)?.suggestedAmount ?? 0);
    if (changes.length) onApply(changes);
    setCashflowOpen(false);
  };
  return <>
      <section className="bf-plan-cashflow-suggest" aria-labelledby="bf-cashflow-suggest-title">
        <div>
          <p className="bf-kicker">{t("DIN FLUXUL REAL")}</p>
          <h2 id="bf-cashflow-suggest-title">{t("Propunere pentru următoarele 7 zile")}</h2>
          <p>{t("Combină ultimele 7 zile de cheltuieli cu scadențele și obiectivele din săptămâna următoare. Tu confirmi fiecare sumă.")}</p>
        </div>
        <button type="button" className="bf-secondary" disabled={!allocations.length || !cashflowHint.suggestions.length} onClick={openCashflowSuggest}>
          <Sparkles size={16} /> {t("Vezi propunerea")}
        </button>
      </section>
      {cashflowOpen && (
        <section className="bf-plan-simulation bf-plan-cashflow-panel" role="dialog" aria-modal="true" aria-labelledby="bf-cashflow-panel-title">
          <div className="bf-plan-simulation-heading">
            <div>
              <p className="bf-kicker">{t("SUGESTIE EDITABILĂ")}</p>
              <h2 id="bf-cashflow-panel-title">{t("Cheltuieli, scadențe și obiective → 7 zile")}</h2>
              <p>{t("Ajustează sumele, apoi aplică doar ce confirmi. Nimic nu se schimbă automat.")}</p>
            </div>
            <button type="button" className="bf-link-button" onClick={() => setCashflowOpen(false)}>{t("Închide")}</button>
          </div>
          <div className="bf-plan-simulation-list">
            {cashflowHint.suggestions.map((item) => (
              <label key={item.allocationId}>
                <span>
                  <b>{item.label}</b>
                  <small>{t("acum {current} · propus {actual}{dues}{goals}", { current: money(item.currentAmount), actual: money(item.suggestedAmount), dues: item.fromDues ? t(" · scadențe {amount}", { amount: money(item.fromDues) }) : "", goals: item.fromGoals ? t(" · obiective {amount}", { amount: money(item.fromGoals) }) : "" })}</small>
                </span>
                <input
                  value={cashflowDraft[item.allocationId] ?? String(item.suggestedAmount)}
                  onChange={(event) => setCashflowDraft((current) => ({ ...current, [item.allocationId]: event.target.value }))}
                  inputMode="decimal"
                  aria-label={t("Sumă propusă pentru {label}", { label: item.label })}
                />
              </label>
            ))}
          </div>
          {cashflowHint.unallocated.length > 0 && (
            <p className="bf-plan-simulation-note">
              {t("Categorii fără plic în ultimele 7 zile")}: {cashflowHint.unallocated.map((item) => `${item.category} ${money(item.amount)}`).join(" · ")}
            </p>
          )}
          <footer>
            <button type="button" onClick={() => setCashflowOpen(false)}>{t("Renunță")}</button>
            <button type="button" className="bf-primary" onClick={applyCashflowSuggest}><Check size={16} /> {t("Aplică sumele confirmate")}</button>
          </footer>
        </section>
      )}
  </>;
}

export function PlanSimulator({ allocations, available, onApply }: { allocations: BudgetAllocation[]; available: number; onApply: (changes: Change[]) => void }) {
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationAmounts, setSimulationAmounts] = useState<Record<string, string>>({});
  const simulationTotal = allocations.reduce((sum, item) => sum + Math.max(0, parseRomanianAmount(simulationAmounts[item.id] ?? String(item.amount))), 0);
  const simulationRemainder = available - simulationTotal;
  const openSimulation = () => { setSimulationAmounts(Object.fromEntries(allocations.map((item) => [item.id, String(item.amount)]))); setSimulationOpen(true); };
  const applySimulation = () => { onApply(changedAmounts(allocations, simulationAmounts, (id) => allocations.find((item) => item.id === id)?.amount ?? 0)); setSimulationOpen(false); };
  return <>
      <section className="bf-plan-simulator" aria-labelledby="bf-plan-simulator-title"><div className="bf-plan-simulator-copy"><p className="bf-kicker">{t("SCENARIU FĂRĂ RISC")}</p><h2 id="bf-plan-simulator-title">{t("Testează planul înainte să-l schimbi.")}</h2><p>{t("Modifică sumele într-o copie temporară. Registrul și planul real rămân intacte până când confirmi.")}</p></div><button type="button" className="bf-secondary bf-plan-simulator-action" onClick={openSimulation} disabled={!allocations.length}><Sparkles size={16} aria-hidden="true" /> {t("Deschide simularea")}</button></section>
      {simulationOpen && <section className="bf-plan-simulation" role="dialog" aria-modal="true" aria-labelledby="bf-plan-simulation-title"><div className="bf-plan-simulation-heading"><div><p className="bf-kicker">{t("SIMULARE LOCALĂ")}</p><h2 id="bf-plan-simulation-title">{t("Cum ar arăta o altă repartizare?")}</h2><p>{t("Aceste valori sunt temporare și nu sunt salvate automat.")}</p></div><button type="button" className="bf-link-button" onClick={() => setSimulationOpen(false)}>{t("Închide")}</button></div><div className="bf-plan-simulation-list">{allocations.map((item) => <label key={item.id}><span><b>{item.label}</b><small>{item.category || "Categorie"} · acum {money(item.amount)}</small></span><input value={simulationAmounts[item.id] ?? String(item.amount)} onChange={(event) => setSimulationAmounts((current) => ({ ...current, [item.id]: event.target.value }))} inputMode="decimal" aria-label={`Suma simulată pentru ${item.label}`} /></label>)}</div><div className={`bf-plan-simulation-result ${simulationRemainder < 0 ? "negative" : "positive"}`}><span><small>{t("Total simulat")}</small><b>{money(simulationTotal)}</b></span><span><small>{t("Rămâne după scadențe")}</small><b>{money(simulationRemainder)}</b></span><span><small>{t("Interpretare")}</small><b>{simulationRemainder < 0 ? t("Peste disponibil") : simulationRemainder === 0 ? t("Echilibru") : t("Bani nealocați")}</b></span></div><p className="bf-plan-simulation-note">{simulationRemainder < 0 ? t("Scenariul depășește banii disponibili. Redu una dintre sume înainte de aplicare.") : simulationRemainder > 0 ? t("După repartizare rămân {amount} nealocați, disponibili pentru o nevoie viitoare.", { amount: money(simulationRemainder) }) : t("Scenariul acoperă disponibilul și scadențele fără surplus.")}</p><footer><button type="button" className="bf-ghost" onClick={() => setSimulationOpen(false)}>{t("Renunță")}</button><button type="button" className="bf-primary" disabled={simulationRemainder < 0} onClick={applySimulation}><Check size={16} /> {t("Aplică scenariul")}</button></footer></section>}
  </>;
}
