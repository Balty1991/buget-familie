/**
 * „Ce plătim lunar”: veniturile așteptate și cheltuielile știute ale familiei, o singură dată.
 * Din ele, la fiecare salariu, aplicația propune repartizarea (IncomeSplitCard).
 */
import "../monthly-needs.css";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { appendAllocationHistory, expenseCategories, formatDate, isoToday, newId, parseRomanianAmount, revertSalaryAllocationApplication, addIsoDays, paydayWindow, recurringNextDue, type AppData, type ExpectedIncome, type MonthlyNeed, type SalaryPlan } from "@/lib/finance-data";
import { askConfirm } from "@/lib/confirm-dialog";
import { activeIncomes, activeNeeds, expectedMonthlyIncome, needAdjustments, nextPaydayAfter, rarePlan, expectedMonthlyNeeds, pendingSplitIncome, reserveOf } from "@/lib/monthly-needs";
import { IncomeSplitCard } from "@/components/IncomeSplitCard";
import { RoDateInput } from "@/components/RoDateInput";
import { eventTraits, plannedEventStatus, type PlannedEvent } from "@/lib/planned-events";
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

/** Un câmp de sumă care arată mereu ce e salvat, dar nu te întrerupe cât scrii. */
function AmountField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value ? String(value).replace(".", ",") : "");
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value ? String(value).replace(".", ",") : ""); }, [value]);
  return (
    <label><span>{label}</span><input inputMode="decimal" value={draft} placeholder="0" onFocus={() => { editing.current = true; }} onChange={(event) => setDraft(event.target.value)} onBlur={() => { editing.current = false; const next = Math.max(0, parseRomanianAmount(draft) || 0); if (next !== value) onCommit(next); }} /></label>
  );
}

/**
 * Un rând din listă. Starea (deschis, ce scrii) e a lui: salvarea nu-l mai închide și nu-l
 * mai recreează, ca după „De la” să apuci și „Până la”.
 */
function NeedRow({ need, members, categories, startOpen, onSave, onDelete }: { need: MonthlyNeed; members: AppData["settings"]["members"]; categories: string[]; startOpen: boolean; onSave: (patch: Partial<MonthlyNeed>) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(startOpen);
  const [label, setLabel] = useState(need.label);
  const per = need.cadence === "weekly" ? t("pe săptămână") : t("pe lună");
  return (
    <details className="bf-needs-item" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="bf-needs-summary-text">
          <b>{need.label}</b>
          <span>{needSummary(need, members)}</span>
        </span>
        <span className="bf-needs-summary-actions">
          <button type="button" aria-label={t("Modifică {name}", { name: need.label })} onClick={(event) => { event.preventDefault(); setOpen(!open); }}><Pencil size={15} /></button>
          <button type="button" className="danger" aria-label={t("Șterge {name}", { name: need.label })} onClick={(event) => { event.preventDefault(); onDelete(); }}><Trash2 size={15} /></button>
        </span>
      </summary>
      <div className="bf-needs-row">
        <input className="bf-needs-label" aria-label={t("Numele cheltuielii")} value={label} onChange={(event) => setLabel(event.target.value)} onBlur={() => { const next = label.trim(); if (next && next !== need.label) onSave({ label: next }); else setLabel(need.label); }} />
        <select aria-label={t("Cât de des")} value={need.cadence} onChange={(event) => onSave({ cadence: event.target.value === "weekly" ? "weekly" : "monthly" })}>
          <option value="monthly">{t("Suma e pe lună")}</option>
          <option value="weekly">{t("Suma e pe săptămână")}</option>
        </select>
        <AmountField label={t("De la ({per})", { per })} value={need.min} onCommit={(min) => onSave({ min, max: Math.max(min, need.max) })} />
        <AmountField label={t("Până la (opțional)")} value={need.max === need.min ? 0 : need.max} onCommit={(max) => onSave(max ? { max: Math.max(max, need.min), min: need.min || max } : { max: need.min })} />
        {need.cadence === "weekly" && need.max > 0 && (
          <p className="bf-needs-hint">{t("Pe lună ≈ {amount} (4,33 săptămâni). Dacă {typed} e suma pe lună, alege „Suma e pe lună”.", { amount: money(reserveOf(need) * 52 / 12), typed: money(reserveOf(need)) })}</p>
        )}
        {need.min !== need.max && (
          <select aria-label={t("Cât rezervăm")} value={need.reserve || "max"} onChange={(event) => onSave({ reserve: event.target.value as MonthlyNeed["reserve"] })}>
            <option value="max">{t("rezervă maximul")}</option>
            <option value="avg">{t("rezervă media")}</option>
            <option value="min">{t("rezervă minimul")}</option>
          </select>
        )}
        <select aria-label={t("Din ce venit")} value={need.payerId || ""} onChange={(event) => onSave({ payerId: event.target.value || undefined })}>
          <option value="">{t("din orice venit")}</option>
          {members.map((member) => <option key={member.id} value={member.id}>{t("doar din venitul lui {name}", { name: member.name })}</option>)}
        </select>
        <select aria-label={t("Prioritate")} value={need.priority || "fixed"} onChange={(event) => onSave({ priority: event.target.value === "flex" ? "flex" : "fixed" })}>
          <option value="fixed">{t("obligație (întâi)")}</option>
          <option value="flex">{t("variabil (după obligații)")}</option>
        </select>
        <select aria-label={t("Categorie")} value={need.category} onChange={(event) => onSave({ category: event.target.value })}>
          {categories.map((item) => <option key={item} value={item}>{t(item)}</option>)}
        </select>
      </div>
    </details>
  );
}

export function MonthlyNeedsPanel({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const plan = data.settings.salaryPlan;
  const needs = activeNeeds(data);
  const incomes = activeIncomes(data);
  const members = data.settings.members;
  const categories = [...expenseCategories, ...data.settings.customCategories];
  const now = () => new Date().toISOString();
  const save = (patch: Partial<SalaryPlan>) => onChange({ ...data, settings: { ...data.settings, salaryPlan: { ...plan, ...patch, updatedAt: now() } } });
  const updateNeed = (id: string, patch: Partial<MonthlyNeed>) => save({ needs: (plan.needs || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: now() } : item) });
  const updateIncome = (id: string, patch: Partial<ExpectedIncome>) => save({ incomes: (plan.incomes || []).map((item) => item.id === id ? { ...item, ...patch, updatedAt: now() } : item) });
  const [openNew, setOpenNew] = useState("");
  /**
   * Ștergerea unei cheltuieli: plicul ei pleacă odată cu ea dacă n-a primit nicio cheltuială;
   * altfel rămâne în Plan, cu istoricul lui, și se poate șterge de acolo.
   */
  const deleteNeed = async (need: MonthlyNeed) => {
    const envelope = plan.allocations.find((item) => item.id === need.allocationId);
    const used = Boolean(envelope && data.transactions.some((tx) => tx.allocationId === envelope.id));
    const message = !envelope
      ? t("Ștergi „{name}” din cheltuielile lunare?", { name: need.label })
      : used
        ? t("Ștergi „{name}” din cheltuielile lunare? Plicul „{envelope}” rămâne în Plan, fiindcă are cheltuieli; îl poți șterge de acolo.", { name: need.label, envelope: envelope.label })
        : t("Ștergi „{name}” din cheltuielile lunare? Plicul lui, încă fără cheltuieli, se șterge și el.", { name: need.label });
    if (!await askConfirm(message, { danger: true, confirmLabel: t("Șterge") })) return;
    const stamp = now();
    const nextNeeds = (plan.needs || []).map((item) => item.id === need.id ? { ...item, archived: true, updatedAt: stamp } : item);
    const removeEnvelope = envelope && !used;
    const next: AppData = { ...data, settings: { ...data.settings, salaryPlan: { ...plan, needs: nextNeeds, allocations: removeEnvelope ? plan.allocations.filter((item) => item.id !== envelope.id) : plan.allocations, updatedAt: stamp } } };
    onChange(removeEnvelope ? appendAllocationHistory(next, { kind: "deleted", allocationId: envelope.id, allocationLabel: envelope.label, previousAmount: envelope.amount }) : next);
  };
  const deleteIncome = async (income: ExpectedIncome) => {
    if (!await askConfirm(t("Ștergi venitul „{name}”? Salariile deja notate rămân în registru.", { name: income.label }), { danger: true, confirmLabel: t("Șterge") })) return;
    updateIncome(income.id, { archived: true });
  };
  /** Repartizările făcute din listă, cele mai noi primele: fiecare se poate anula. */
  const applications = (plan.salaryAllocationApplications || []).filter((item) => item.origin === "needs").slice(0, 6);
  const undoApplication = async (id: string, title: string) => {
    if (!await askConfirm(t("Anulezi repartizarea „{title}”? Plicurile revin la sumele de dinainte, iar cele create acum, încă fără cheltuieli, se șterg. Venitul rămâne în registru și îl poți împărți din nou.", { title }), { confirmLabel: t("Anulează repartizarea") })) return;
    onChange(revertSalaryAllocationApplication(data, id));
  };
  const addNeed = (preset: (typeof PRESETS)[number]) => { const id = newId("need"); setOpenNew(id); save({ needs: [...(plan.needs || []), { id, ...preset, min: 0, max: 0, reserve: "max", updatedAt: now() }] }); };
  const addIncome = () => save({ incomes: [...(plan.incomes || []), { id: newId("income"), memberId: members[incomes.length % Math.max(1, members.length)]?.id || members[0]?.id || "", label: t("Salariu"), amount: 0, day: 10, updatedAt: now() }] });
  const monthlyIn = expectedMonthlyIncome(incomes);
  const monthlyOut = expectedMonthlyNeeds(needs);
  const pending = pendingSplitIncome(data, isoToday());
  const adjustments = needAdjustments(data, isoToday());
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
        <div className="bf-needs-row bf-needs-income" key={income.id}>
          <select aria-label={t("Al cui venit")} value={income.memberId} onChange={(event) => updateIncome(income.id, { memberId: event.target.value })}>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <input aria-label={t("Numele venitului")} defaultValue={income.label} onBlur={(event) => event.target.value.trim() !== income.label && updateIncome(income.id, { label: event.target.value.trim() || t("Salariu") })} />
          <AmountField label={t("Sumă")} value={income.amount} onCommit={(value) => updateIncome(income.id, { amount: value })} />
          <label><span>{t("Ziua")}</span><input inputMode="numeric" defaultValue={income.day} onBlur={(event) => { const day = Math.min(31, Math.max(1, Math.round(Number(event.target.value)) || income.day)); if (day !== income.day) updateIncome(income.id, { day }); }} /></label>
          <button type="button" className="bf-needs-remove" aria-label={t("Șterge {name}", { name: income.label })} onClick={() => void deleteIncome(income)}><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" className="bf-secondary bf-needs-add" onClick={addIncome}><Plus size={15} /> {t("Adaugă un venit")}</button>
      {incomes.length > 0 && !plan.horizonDays && <NextPayday plan={plan} incomes={incomes} onSave={save} />}

      <h3>{t("Cheltuielile")}</h3>
      {needs.map((need) => (
        <NeedRow key={need.id} need={need} members={members} categories={categories} startOpen={need.max <= 0 || openNew === need.id} onSave={(patch) => updateNeed(need.id, patch)} onDelete={() => void deleteNeed(need)} />
      ))}
      <div className="bf-needs-presets" role="group" aria-label={t("Adaugă o cheltuială")}>
        {PRESETS.filter((preset) => !usedPresets.has(preset.label)).map((preset) => (
          <button type="button" key={preset.label} onClick={() => addNeed(preset)}><Plus size={13} /> {t(preset.label)}</button>
        ))}
        <button type="button" onClick={() => addNeed({ label: t("Altă cheltuială"), category: "Altele", cadence: "monthly", priority: "fixed" })}><Plus size={13} /> {t("Altă cheltuială")}</button>
      </div>

      <RarePayments data={data} onChange={onChange} />

      {adjustments.length > 0 && (
        <div className="bf-needs-adjust">
          <h3>{t("Din ce ați plătit de fapt")}</h3>
          {adjustments.map((item) => {
            const per = item.need.cadence === "weekly" ? t("pe săptămână") : t("pe lună");
            const range = (min: number, max: number) => min === max ? money(max) : `${money(min)} – ${money(max)}`;
            return (
              <div className="bf-needs-adjust-row" key={item.need.id}>
                <p>
                  <b>{item.need.label}</b>
                  <span>{t("În ultimele luni: {list} ({per}). Acum ai trecut {declared}.", { list: item.months.map((entry) => money(entry.amount)).join(", "), per, declared: range(item.need.min, item.need.max) })}</span>
                  <span>{item.direction === "up" ? t("Plătiți mai mult decât ai scris. Pun {range}?", { range: range(item.min, item.max) }) : t("Plătiți mai puțin decât ai scris. Pun {range}? Banii rămași pot merge în altă parte.", { range: range(item.min, item.max) })}</span>
                </p>
                <div>
                  <button type="button" className="bf-secondary" onClick={() => updateNeed(item.need.id, { reviewedMonth: isoToday().slice(0, 7) })}>{t("Lasă cum e")}</button>
                  <button type="button" className="bf-primary" onClick={() => updateNeed(item.need.id, { min: item.min, max: item.max, reviewedMonth: isoToday().slice(0, 7) })}>{t("Pune {range}", { range: range(item.min, item.max) })}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
      {applications.length > 0 && (
        <div className="bf-needs-applied">
          <h3>{t("Repartizări făcute")}</h3>
          {applications.map((item) => (
            <div key={item.id} className="bf-needs-applied-row">
              <span><b>{item.incomeTitle} · {money(item.incomeAmount)}</b><small>{formatDate(item.appliedAt.slice(0, 10), { day: "numeric", month: "long" })} · {t("{count} plicuri", { count: item.allocations.length })}</small></span>
              <button type="button" className="bf-secondary" onClick={() => void undoApplication(item.id, item.incomeTitle)}><RotateCcw size={14} /> {t("Anulează")}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Secțiunea din Plan. Starea deschis/închis e a ei: calculată din date, se închidea singură
 * la prima cheltuială adăugată, iar omul nu mai apuca să scrie suma.
 */
export function MonthlyNeedsSection({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const [open, setOpen] = useState(() => Boolean(pendingSplitIncome(data, isoToday())) || needAdjustments(data, isoToday()).length > 0);
  const count = activeNeeds(data).length;
  return (
    <details className="bf-plan-tools bf-needs-details" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary>{count ? t("Ce plătim lunar · {count} cheltuieli · {incomes} venituri", { count, incomes: activeIncomes(data).length }) : t("Ce plătim lunar — repartizare automată la salariu")}</summary>
      {open && <MonthlyNeedsPanel data={data} onChange={onChange} />}
    </details>
  );
}

/**
 * Data aproximativă a următorului salariu și cât poate varia. Tranșele merg până la data
 * obișnuită, iar plicurile acoperă și zilele în care salariul poate întârzia.
 */
export function NextPayday({ plan, incomes, onSave }: { plan: SalaryPlan; incomes: ExpectedIncome[]; onSave: (patch: Partial<SalaryPlan>) => void }) {
  const today = isoToday();
  const active = Boolean(plan.nextPayday && plan.nextPayday >= today);
  const flex = plan.paydayFlexDays ?? 3;
  const guess = [...incomes].map((item) => nextPaydayAfter(today, item.day)).sort()[0] || "";
  const shown = active ? plan.nextPayday : guess;
  const range = paydayWindow({ ...plan, nextPayday: shown, periodStart: active ? plan.periodStart : today, earliestPayday: undefined, paydayFlexDays: flex });
  const day = (iso: string) => formatDate(iso, { day: "numeric", month: "long" });
  const setDate = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso <= today || iso === plan.nextPayday) return;
    const periodStart = active && plan.periodStart && plan.periodStart < iso ? plan.periodStart : today;
    const earliest = addIsoDays(iso, -flex);
    onSave({ periodStart, nextPayday: iso, paydayFlexDays: flex, earliestPayday: earliest > periodStart ? earliest : periodStart });
  };
  const setFlex = (value: number) => {
    if (!active) return onSave({ paydayFlexDays: value });
    const earliest = addIsoDays(plan.nextPayday, -value);
    onSave({ paydayFlexDays: value, earliestPayday: earliest > plan.periodStart ? earliest : plan.periodStart });
  };
  return (
    <div className="bf-needs-payday">
      <p>
        <b>{shown ? t("Următorul salariu: ~{date}", { date: day(shown) }) : t("Când vine următorul salariu?")}</b>
        {!shown && <span>{t("Alege data aproximativă: plicurile se împart pe săptămâni până atunci.")}</span>}
        {shown && <span>{flex > 0
          ? t("Poate veni între {from} și {to}. Săptămânile merg până pe {date}, iar plicurile ajung și dacă întârzie.", { from: day(range.earliest), to: day(range.latest), date: day(shown) })
          : t("Vine fix în ziua asta.")}</span>}
        {!active && shown && <span>{t("Se stabilește singur din ziua declarată când notezi salariul. Îl poți alege și acum.")}</span>}
      </p>
      <label><span>{t("Data aproximativă")}</span><RoDateInput min={addIsoDays(today, 1)} value={shown} onChange={(event) => setDate(event.target.value)} /></label>
      <label><span>{t("Poate varia cu")}</span>
        <select value={flex} onChange={(event) => setFlex(Number(event.target.value))}>
          <option value={0}>{t("Nu variază")}</option>
          {[1, 2, 3, 4, 5].map((days) => <option key={days} value={days}>{days === 1 ? t("± 1 zi") : t("± {days} zile", { days })}</option>)}
        </select>
      </label>
    </div>
  );
}

const RARE_PRESETS = ["RCA", "Impozit casă", "Impozit mașină", "Rovinietă", "ITP", "Crăciun", "Haine de sezon", "Rechizite"];

/**
 * Plățile care vin o dată pe an: se strâng puțin câte puțin din fiecare salariu, ca luna lor
 * să nu fie o lovitură. Sunt evenimentele planificate ale familiei; aici doar se adaugă repede.
 */
function RarePayments({ data, onChange }: { data: AppData; onChange: (next: AppData) => void }) {
  const today = isoToday();
  const [draft, setDraft] = useState<{ name: string; amount: string; date: string } | null>(null);
  const [error, setError] = useState("");
  const events = data.settings.plannedEvents || [];
  const plan = rarePlan(data, today);
  const perCycle = new Map(plan.events.map((item) => [item.event.id, item.perCycle]));
  const shown = events.map((event) => plannedEventStatus(event, today)).filter((status) => status.date && !status.passed && status.estimate > 0).sort((a, b) => a.date.localeCompare(b.date));
  const names = new Set(events.map((event) => event.name.trim().toLocaleLowerCase("ro-RO")));
  const yearly = data.recurring.filter((item) => item.active && item.frequency === "yearly" && !names.has(item.name.trim().toLocaleLowerCase("ro-RO")));
  const day = (iso: string) => formatDate(iso, { day: "numeric", month: "long" });
  const write = (next: PlannedEvent[]) => onChange({ ...data, settings: { ...data.settings, plannedEvents: next } });
  const create = (name: string, amount: number, date: string) => {
    const traits = eventTraits(name, today);
    write([...events, { id: newId("event"), name, date, estimate: amount, kind: traits.kind, repeat: "yearly", ...(traits.anchor ? { anchor: traits.anchor } : {}), updatedAt: new Date().toISOString() }]);
  };
  const save = () => {
    if (!draft) return;
    const amount = parseRomanianAmount(draft.amount);
    if (!draft.name.trim()) return setError(t("Scrie ce plată e."));
    if (amount <= 0) return setError(t("Scrie cât costă."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date <= today) return setError(t("Alege data următoarei plăți."));
    create(draft.name.trim(), amount, draft.date);
    setDraft(null); setError("");
  };
  const remove = async (event: PlannedEvent) => {
    if (!await askConfirm(t("Ștergi „{name}” din plățile rare? Banii notați ca puși deoparte pentru ea se șterg și ei din jurnal.", { name: event.name }), { danger: true, confirmLabel: t("Șterge") })) return;
    write(events.filter((item) => item.id !== event.id));
  };
  return (
    <div className="bf-needs-rare">
      <h3>{t("Plăți rare (o dată pe an)")}</h3>
      <p className="bf-needs-intro">{t("RCA, impozite, Crăciunul: la fiecare salariu se pune deoparte o parte, ca în luna lor banii să fie gata. Intră la urmă în repartizare, după traiul lunii.")}</p>
      {shown.map((status) => (
        <div className="bf-needs-rare-row" key={status.event.id}>
          <span>
            <b>{status.event.name} · {money(status.estimate)}</b>
            <small>{t("{date} · strânși {saved} · ~{per} pe lună", { date: day(status.date), saved: money(status.saved), per: money(perCycle.get(status.event.id) || 0) })}</small>
          </span>
          <button type="button" className="bf-needs-remove" aria-label={t("Șterge {name}", { name: status.event.name })} onClick={() => void remove(status.event)}><Trash2 size={15} /></button>
        </div>
      ))}
      {yearly.map((item) => {
        const due = recurringNextDue(item, today);
        return due ? (
          <p className="bf-needs-note" key={item.id}>
            {t("În Scadențe ai „{name}” {amount} pe an, pe {date}.", { name: item.name, amount: money(item.amount), date: day(due) })}{" "}
            <button type="button" className="bf-link-button" onClick={() => create(item.name, item.amount, due)}>{t("Strânge lunar pentru ea")}</button>
          </p>
        ) : null;
      })}
      {draft ? (
        <div className="bf-needs-row">
          <input aria-label={t("Ce plată")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <label><span>{t("Cât costă")}</span><input inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
          <label><span>{t("Când (data)")}</span><RoDateInput min={addIsoDays(today, 1)} value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          {error && <p className="bf-form-error" role="alert">{error}</p>}
          <div className="bf-needs-rare-actions">
            <button type="button" className="bf-secondary" onClick={() => { setDraft(null); setError(""); }}>{t("Renunță")}</button>
            <button type="button" className="bf-primary" onClick={save}>{t("Adaugă")}</button>
          </div>
        </div>
      ) : (
        <div className="bf-needs-presets" role="group" aria-label={t("Adaugă o plată rară")}>
          {RARE_PRESETS.filter((name) => !names.has(name.toLocaleLowerCase("ro-RO"))).map((name) => (
            <button type="button" key={name} onClick={() => setDraft({ name: t(name), amount: "", date: "" })}><Plus size={13} /> {t(name)}</button>
          ))}
          <button type="button" onClick={() => setDraft({ name: "", amount: "", date: "" })}><Plus size={13} /> {t("Altă plată rară")}</button>
        </div>
      )}
    </div>
  );
}
