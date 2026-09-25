/**
 * „Ce plătim lunar”: veniturile așteptate și cheltuielile știute ale familiei, o singură dată.
 * Din ele, la fiecare salariu, aplicația propune repartizarea (IncomeSplitCard).
 */
import "../monthly-needs.css";
import { Plus, Trash2 } from "lucide-react";
import { expenseCategories, isoToday, newId, parseRomanianAmount, type AppData, type ExpectedIncome, type MonthlyNeed } from "@/lib/finance-data";
import { activeIncomes, activeNeeds, expectedMonthlyIncome, expectedMonthlyNeeds, pendingSplitIncome } from "@/lib/monthly-needs";
import { IncomeSplitCard } from "@/components/IncomeSplitCard";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const money = lei;

/** Rândurile cele mai des întâlnite; sumele le completează fiecare familie. */
const PRESETS: Array<Pick<MonthlyNeed, "label" | "category" | "cadence" | "priority">> = [
  { label: "Mâncare", category: "Alimente", cadence: "weekly", priority: "flex" },
  { label: "Chirie", category: "Casă & facturi", cadence: "monthly", priority: "fixed" },
  { label: "Rate bancă", category: "Rate produse", cadence: "monthly", priority: "fixed" },
  { label: "Rate fără dobândă", category: "Rate produse", cadence: "monthly", priority: "fixed" },
  { label: "Lumină", category: "Casă & facturi", cadence: "monthly", priority: "fixed" },
  { label: "Gaz", category: "Casă & facturi", cadence: "monthly", priority: "fixed" },
  { label: "Apă", category: "Casă & facturi", cadence: "monthly", priority: "fixed" },
  { label: "Abonamente", category: "Abonamente", cadence: "monthly", priority: "fixed" },
  { label: "Grădiniță", category: "Consumabile copil", cadence: "monthly", priority: "fixed" },
  { label: "Taxi / transport", category: "Transport", cadence: "monthly", priority: "flex" },
];

/** O linie scurtă: „300–400 RON / lună · rezervă maximul · doar din venitul Soției”. */
function needSummary(need: MonthlyNeed, members: AppData["settings"]["members"]) {
  if (need.max <= 0) return t("completează suma");
  const range = need.min && need.min !== need.max ? `${money(need.min)}–${money(need.max)}` : money(need.max);
  const parts = [`${range} ${need.cadence === "weekly" ? t("/ săptămână") : t("/ lună")}`];
  if (need.min !== need.max) parts.push(need.reserve === "min" ? t("rezervă minimul") : need.reserve === "avg" ? t("rezervă media") : t("rezervă maximul"));
  const payer = members.find((item) => item.id === need.payerId);
  if (payer) parts.push(t("doar din venitul lui {name}", { name: payer.name }));
  if (need.priority === "flex") parts.push(t("după obligații"));
  return parts.join(" · ");
}

export function MonthlyNeedsPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const plan = data.settings.salaryPlan;
  const needs = activeNeeds(data);
  const incomes = activeIncomes(data);
  const members = data.settings.members;
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const now = () => new Date().toISOString();
  const save = (patch: { needs?: MonthlyNeed[]; incomes?: ExpectedIncome[] }) => onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, ...patch, updatedAt: now() } } });
  const updateNeed = (id: string, patch: Partial<MonthlyNeed>) => save({ needs: (plan.needs || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: now() } : item) });
  const updateIncome = (id: string, patch: Partial<ExpectedIncome>) => save({ incomes: (plan.incomes || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: now() } : item) });
  const addNeed = (preset: (typeof PRESETS)[number]) => save({ needs: [...(plan.needs || []), { id: newId("need"), ...preset, min: 0, max: 0, reserve: "max", updatedAt: now() }] });
  const addIncome = () => save({ incomes: [...(plan.incomes || []), { id: newId("income"), memberId: members[incomes.length % Math.max(1, members.length)]?.id || members[0]?.id || "", label: t("Salariu"), amount: 0, day: 10, updatedAt: now() }] });
  const amount = (raw: string) => Math.max(0, parseRomanianAmount(raw) || 0);
  const monthlyIn = expectedMonthlyIncome(incomes);
  const monthlyOut = expectedMonthlyNeeds(needs);
  const pending = pendingSplitIncome(data, isoToday());
  const recurring = data.recurring.filter((item) => item.active);
  const usedPresets = new Set(needs.map((item) => item.label));

  return (
    <section className="bf-needs" aria-labelledby="bf-needs-title">
      <div>
        <p className="bf-kicker">{t("CE PLĂTIM LUNAR")}</p>
        <h2 id="bf-needs-title">{t("Cheltuielile știute ale familiei")}</h2>
        <p className="bf-needs-intro">{t("Scrie o dată ce intră și ce plătiți de obicei. Când notezi un salariu, aplicația propune singură cât merge în fiecare plic: obligațiile întâi, restul cât ajung banii. Tichetele de masă nu intră.")}</p>
      </div>

      <h3>{t("Veniturile")}</h3>
      {incomes.map((income) => (
        <div className="bf-needs-row bf-needs-income" key={`${income.id}-${income.updatedAt || ""}`}>
          <select aria-label={t("Al cui venit")} value={income.memberId} onChange={(event) => updateIncome(income.id, { memberId: event.target.value })}>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <input aria-label={t("Numele venitului")} defaultValue={income.label} onBlur={(event) => event.target.value.trim() !== income.label && updateIncome(income.id, { label: event.target.value.trim() || t("Salariu") })} />
          <label><span>{t("Sumă")}</span><input inputMode="decimal" defaultValue={income.amount || ""} placeholder="0" onBlur={(event) => amount(event.target.value) !== income.amount && updateIncome(income.id, { amount: amount(event.target.value) })} /></label>
          <label><span>{t("Ziua")}</span><input inputMode="numeric" defaultValue={income.day} onBlur={(event) => { const day = Math.min(31, Math.max(1, Math.round(Number(event.target.value)) || income.day)); if (day !== income.day) updateIncome(income.id, { day }); }} /></label>
          <button type="button" className="bf-needs-remove" aria-label={t("Șterge {name}", { name: income.label })} onClick={() => updateIncome(income.id, { archived: true })}><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" className="bf-secondary bf-needs-add" onClick={addIncome}><Plus size={15} /> {t("Adaugă un venit")}</button>

      <h3>{t("Cheltuielile")}</h3>
      {needs.map((need) => (
        <details className="bf-needs-item" key={`${need.id}-${need.updatedAt || ""}`} open={need.max <= 0 ? true : undefined}>
        <summary>
          <b>{need.label}</b>
          <span>{needSummary(need, members)}</span>
        </summary>
        <div className="bf-needs-row">
          <input className="bf-needs-label" aria-label={t("Numele cheltuielii")} defaultValue={need.label} onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== need.label && updateNeed(need.id, { label: event.target.value.trim() })} />
          <label><span>{t("De la")}</span><input inputMode="decimal" defaultValue={need.min || ""} placeholder="0" onBlur={(event) => { const min = amount(event.target.value); if (min !== need.min) updateNeed(need.id, { min, max: Math.max(min, need.max) }); }} /></label>
          <label><span>{t("Până la")}</span><input inputMode="decimal" defaultValue={need.max || ""} placeholder="0" onBlur={(event) => { const max = amount(event.target.value); if (max !== need.max) updateNeed(need.id, { max, min: need.min > max ? max : need.min || max }); }} /></label>
          <select aria-label={t("Cât de des")} value={need.cadence} onChange={(event) => updateNeed(need.id, { cadence: event.target.value === "weekly" ? "weekly" : "monthly" })}>
            <option value="monthly">{t("pe lună")}</option>
            <option value="weekly">{t("pe săptămână")}</option>
          </select>
          <select aria-label={t("Cât rezervăm")} value={need.reserve || "max"} onChange={(event) => updateNeed(need.id, { reserve: event.target.value as MonthlyNeed["reserve"] })}>
            <option value="max">{t("rezervă maximul")}</option>
            <option value="avg">{t("rezervă media")}</option>
            <option value="min">{t("rezervă minimul")}</option>
          </select>
          <select aria-label={t("Din ce venit")} value={need.payerId || ""} onChange={(event) => updateNeed(need.id, { payerId: event.target.value || undefined })}>
            <option value="">{t("din orice venit")}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{t("doar din venitul lui {name}", { name: member.name })}</option>)}
          </select>
          <select aria-label={t("Prioritate")} value={need.priority || "fixed"} onChange={(event) => updateNeed(need.id, { priority: event.target.value === "flex" ? "flex" : "fixed" })}>
            <option value="fixed">{t("obligație (întâi)")}</option>
            <option value="flex">{t("variabil (după obligații)")}</option>
          </select>
          <select aria-label={t("Categorie")} value={need.category} onChange={(event) => updateNeed(need.id, { category: event.target.value })}>
            {categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}
          </select>
          <button type="button" className="bf-needs-remove" aria-label={t("Șterge {name}", { name: need.label })} onClick={() => updateNeed(need.id, { archived: true })}><Trash2 size={15} /></button>
        </div>
        </details>
      ))}
      <div className="bf-needs-presets" role="group" aria-label={t("Adaugă o cheltuială")}>
        {PRESETS.filter((preset) => !usedPresets.has(preset.label)).map((preset) => (
          <button type="button" key={preset.label} onClick={() => addNeed(preset)}><Plus size={13} /> {t(preset.label)}</button>
        ))}
        <button type="button" onClick={() => addNeed({ label: t("Altă cheltuială"), category: "Altele", cadence: "monthly", priority: "fixed" })}><Plus size={13} /> {t("Altă cheltuială")}</button>
      </div>

      {(monthlyIn > 0 || monthlyOut > 0) && (
        <p className={`bf-needs-total${monthlyOut > monthlyIn && monthlyIn > 0 ? " is-over" : ""}`}>
          {t("Într-o lună obișnuită: intră {income}, pleacă ~{needs} (mâncarea socotită pe 4,33 săptămâni).", { income: money(monthlyIn), needs: money(monthlyOut) })}{" "}
          {monthlyIn > 0 ? (monthlyOut > monthlyIn ? t("Lipsesc ~{amount}: revizuiește cheltuielile sau rezervă media.", { amount: money(monthlyOut - monthlyIn) }) : t("Rămân ~{amount} liberi.", { amount: money(monthlyIn - monthlyOut) })) : ""}
        </p>
      )}
      {recurring.length > 0 && (
        <p className="bf-needs-note">{t("În Scadențe ai deja: {list}. Sunt rezervate separat — nu le adăuga și aici, ca să nu se numere de două ori.", { list: recurring.slice(0, 6).map((item) => `${item.name} ${money(item.amount)}`).join(", ") })}</p>
      )}
      {pending && <IncomeSplitCard data={data} incomeId={pending.id} onChange={onChange} />}
    </section>
  );
}
