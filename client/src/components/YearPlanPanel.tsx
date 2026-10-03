/**
 * Planul pe 12 luni (Mai mult → Planificare): graficul lunilor, scenariile „ce-ar fi dacă”
 * și fiecare lună desfăcută pe venit, trai, facturi, rate, obiective și evenimente.
 * Scenariile rămân pe telefon: sunt încercări, nu planul familiei.
 */
import { Fragment, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { isoToday, newId, parseRomanianAmount, type AppData } from "@/lib/finance-data";
import { yearPlan, type PlanMonth, type Scenario } from "@/lib/year-plan";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { safeSetItem } from "@/lib/safe-storage";

/** O singură coloană care se poate strânge: un rând lat nu mai împinge cifrele afară din card. */
const CARD = { gridTemplateColumns: "minmax(0, 1fr)" } as const;

const KEY = "buget-familie:year-scenarios";
const readScenarios = (): Scenario[] => { try { const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]"); return Array.isArray(raw) ? raw.slice(0, 8) : []; } catch { return []; } };
const monthLabel = (key: string, long = false) => new Intl.DateTimeFormat(getLocale(), { month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}) }).format(new Date(`${key}-15T12:00:00`));
const W = 320, H = 150;

function Chart({ months, baseline }: { months: PlanMonth[]; baseline?: PlanMonth[] }) {
  const values = [...months.map((m) => m.balance), ...(baseline || []).map((m) => m.balance), ...months.map((m) => m.net), 0];
  const top = Math.max(...values), bottom = Math.min(...values), span = Math.max(1, top - bottom);
  const y = (value: number) => 8 + ((top - value) / span) * (H - 26);
  const step = (W - 8) / months.length;
  const x = (index: number) => 4 + step * index + step / 2;
  const line = (list: PlanMonth[]) => list.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m.balance).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Banii, lună cu lună, pe 12 luni")} style={{ width: "100%", height: "auto", display: "block" }}>
    <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--cf-line)" />
    {months.map((m, i) => <rect key={m.key} x={x(i) - step * 0.3} width={step * 0.6} y={Math.min(y(0), y(m.net))} height={Math.max(1, Math.abs(y(m.net) - y(0)))} rx="3" fill={m.net >= 0 ? "var(--cf-primary)" : "var(--cf-danger)"} opacity="0.35" />)}
    {baseline && <path d={line(baseline)} fill="none" stroke="var(--cf-muted)" strokeWidth="2" strokeDasharray="4 4" />}
    <path d={line(months)} fill="none" stroke="var(--cf-primary-strong)" strokeWidth="2.5" strokeLinejoin="round" />
    {months.map((m, i) => <circle key={m.key} cx={x(i)} cy={y(m.balance)} r="3" fill={m.balance < 0 ? "var(--cf-danger)" : "var(--cf-primary-strong)"} />)}
    {months.map((m, i) => i % 2 === 0 ? <text key={m.key} x={x(i)} y={H - 2} fontSize="9" textAnchor="middle" fill="var(--cf-muted)">{monthLabel(m.key)}</text> : null)}
  </svg>;
}

type Draft = { kind: Scenario["kind"]; label: string; amount: string; monthly: string; months: string; at: string; incomeId: string };

export function YearPlanPanel({ data }: { data: AppData }) {
  const today = isoToday();
  const [scenarios, setScenarios] = useState<Scenario[]>(readScenarios);
  const [draft, setDraft] = useState<Draft | undefined>(undefined);
  const [open, setOpen] = useState<string>("");
  const plan = useMemo(() => yearPlan(data, today, scenarios), [data, today, scenarios]);
  const baseline = useMemo(() => (scenarios.length ? yearPlan(data, today).months : undefined), [data, today, scenarios.length]);
  const incomes = (data.settings.salaryPlan.incomes || []).filter((item) => !item.archived && item.amount > 0);
  const save = (next: Scenario[]) => { setScenarios(next); try { safeSetItem(window.localStorage, KEY, JSON.stringify(next)); } catch { /* rămâne cât e deschisă pagina */ } };
  const startDraft = (kind: Scenario["kind"]) => setDraft({ kind, label: kind === "expense" ? t("Chirie mai mare") : kind === "one-off" ? t("Reparație mașină") : kind === "loan" ? t("Credit nou") : "", amount: kind === "expense" ? "300" : kind === "one-off" ? "5000" : kind === "loan" ? "20000" : "", monthly: "600", months: kind === "loan" ? "48" : "3", at: "0", incomeId: incomes[0]?.id || "all" });
  const addDraft = () => {
    if (!draft) return;
    const at = Math.min(11, Math.max(0, Number(draft.at) || 0));
    const amount = parseRomanianAmount(draft.amount);
    const id = newId("scenario");
    const next: Scenario | undefined = draft.kind === "income-loss" ? { id, kind: "income-loss", incomeId: draft.incomeId, share: 1, from: at, months: Math.max(1, Number(draft.months) || 1) }
      : draft.kind === "expense" && amount > 0 ? { id, kind: "expense", label: draft.label.trim() || t("Cheltuială nouă"), amount, from: at }
      : draft.kind === "one-off" && amount > 0 ? { id, kind: "one-off", label: draft.label.trim() || t("Cheltuială mare"), amount, at }
      : draft.kind === "loan" && amount > 0 ? { id, kind: "loan", label: draft.label.trim() || t("Credit nou"), principal: amount, monthly: parseRomanianAmount(draft.monthly), months: Math.max(1, Number(draft.months) || 1), at }
      : undefined;
    if (!next) return;
    save([...scenarios, next]); setDraft(undefined);
  };
  const describe = (item: Scenario) => item.kind === "income-loss" ? t("Fără {income}, {months} luni din {month}", { income: item.incomeId === "all" ? t("niciun venit") : incomes.find((income) => income.id === item.incomeId)?.label || t("un venit"), months: item.months, month: monthLabel(plan.months[item.from]?.key || plan.months[0].key, true) })
    : item.kind === "expense" ? t("{label}: +{amount}/lună din {month}", { label: item.label, amount: lei(item.amount), month: monthLabel(plan.months[item.from]?.key || plan.months[0].key, true) })
    : item.kind === "one-off" ? t("{label}: {amount} în {month}", { label: item.label, amount: lei(item.amount), month: monthLabel(plan.months[item.at]?.key || plan.months[0].key, true) })
    : t("{label}: {principal}, rată {monthly} × {months}", { label: item.label, principal: lei(item.principal), monthly: lei(item.monthly), months: item.months });
  const end = plan.months[plan.months.length - 1];
  const short = plan.firstShort !== undefined ? plan.months[plan.firstShort] : undefined;
  const monthOptions = plan.months.map((m, i) => <option key={m.key} value={i}>{monthLabel(m.key, true)}</option>);
  return <div style={{ display: "grid", gap: 14 }}>
    <section className="bf-scenario-card" style={CARD}>
      <div className="bf-scenario-heading"><div>
        <p className="bf-kicker">{t("PLANUL PE 12 LUNI")}</p>
        <h2>{short ? t("În {month} banii nu mai ajung.", { month: monthLabel(short.key, true) }) : t("Anul se încheie cu ~{amount}.", { amount: lei(end.balance) })}</h2>
        <p>{t("Pornim de la {start} azi. Venit {income} pe lună, trai obișnuit ~{living} ({basis}).", { start: lei(plan.start), income: lei((baseline || plan.months)[0].income), living: lei(plan.living), basis: plan.livingBasis === "spending" ? t("din ultimele luni") : t("din plan") })}</p>
      </div></div>
      <Chart months={plan.months} baseline={baseline} />
      <small className="bf-helper" style={{ margin: 0 }}>{baseline ? t("Linia plină: cu scenariile. Linia punctată: fără ele. Barele: cât rămâne sau lipsește în fiecare lună.") : t("Linia: banii la sfârșitul fiecărei luni. Barele: cât rămâne sau lipsește în lună.")}</small>
      {plan.lowest.balance < plan.start && <p style={{ margin: 0 }}>{t("Cel mai strâns: {month}, cu {amount}.", { month: monthLabel(plan.months[plan.lowest.index].key, true), amount: lei(plan.lowest.balance) })}</p>}
    </section>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CE-AR FI DACĂ")}</p>
      {scenarios.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span>{describe(item)}</span><button type="button" className="bf-icon-button" aria-label={t("Scoate scenariul")} onClick={() => save(scenarios.filter((other) => other.id !== item.id))}><X size={16} /></button></div>)}
      {!draft && <div className="bf-hero-chips" style={{ margin: 0 }}>
        {incomes.length > 0 && <button type="button" className="bf-hero-chip" onClick={() => startDraft("income-loss")}><Plus size={14} aria-hidden="true" /> {t("Pierd un venit")}</button>}
        <button type="button" className="bf-hero-chip" onClick={() => startDraft("expense")}><Plus size={14} aria-hidden="true" /> {t("Cheltuială lunară nouă")}</button>
        <button type="button" className="bf-hero-chip" onClick={() => startDraft("one-off")}><Plus size={14} aria-hidden="true" /> {t("Cheltuială mare o dată")}</button>
        <button type="button" className="bf-hero-chip" onClick={() => startDraft("loan")}><Plus size={14} aria-hidden="true" /> {t("Credit nou")}</button>
      </div>}
      {draft && <form style={{ display: "grid", gap: 10 }} onSubmit={(event) => { event.preventDefault(); addDraft(); }}>
        {draft.kind === "income-loss" ? <label className="bf-field"><span>{t("Ce venit")}</span><select value={draft.incomeId} onChange={(event) => setDraft({ ...draft, incomeId: event.target.value })}>{incomes.map((income) => <option key={income.id} value={income.id}>{income.label}</option>)}<option value="all">{t("Toate veniturile")}</option></select></label>
          : <label className="bf-field"><span>{t("Ce")}</span><input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} maxLength={40} /></label>}
        {draft.kind !== "income-loss" && <label className="bf-field"><span>{draft.kind === "loan" ? t("Suma primită (lei)") : draft.kind === "expense" ? t("În plus pe lună (lei)") : t("Cât (lei)")}</span><input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} inputMode="decimal" /></label>}
        {draft.kind === "loan" && <label className="bf-field"><span>{t("Rata lunară (lei)")}</span><input value={draft.monthly} onChange={(event) => setDraft({ ...draft, monthly: event.target.value })} inputMode="decimal" /></label>}
        {(draft.kind === "loan" || draft.kind === "income-loss") && <label className="bf-field"><span>{draft.kind === "loan" ? t("Câte rate") : t("Câte luni")}</span><input value={draft.months} onChange={(event) => setDraft({ ...draft, months: event.target.value })} inputMode="numeric" /></label>}
        <label className="bf-field"><span>{draft.kind === "one-off" || draft.kind === "loan" ? t("În ce lună") : t("Din ce lună")}</span><select value={draft.at} onChange={(event) => setDraft({ ...draft, at: event.target.value })}>{monthOptions}</select></label>
        <div style={{ display: "flex", gap: 10 }}><button type="submit" className="bf-primary">{t("Adaugă în plan")}</button><button type="button" className="bf-ghost" onClick={() => setDraft(undefined)}>{t("Renunță")}</button></div>
      </form>}
    </section>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("LUNĂ CU LUNĂ")}</p>
      <ul style={{ display: "grid", gap: 0, margin: 0, padding: 0, listStyle: "none" }}>
        {plan.months.map((m) => <li key={m.key} style={{ borderBottom: "1px solid var(--cf-line)" }}>
          <button type="button" aria-expanded={open === m.key} onClick={() => setOpen(open === m.key ? "" : m.key)} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", width: "100%", minHeight: 48, padding: "6px 0", border: 0, background: "none", color: "var(--cf-ink)", font: "inherit", textAlign: "left" }}>
            <span><b>{monthLabel(m.key, true)}</b>{m.notes.length > 0 && <small style={{ display: "block", color: "var(--cf-muted)" }}>{m.notes.join(" · ")}</small>}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: m.net < 0 ? "var(--cf-danger)" : "var(--cf-primary-strong)" }}>{m.net >= 0 ? "+" : "−"}{lei(Math.abs(m.net))}</span>
            <b style={{ fontVariantNumeric: "tabular-nums", color: m.balance < 0 ? "var(--cf-danger)" : "var(--cf-ink)" }}>{lei(m.balance)}</b>
          </button>
          {open === m.key && <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", margin: "0 0 10px", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
            {([[t("Venit"), m.income], [t("Trai obișnuit"), -m.living], [t("Facturi"), -m.bills], [t("Rate"), -m.debts], [t("Obiective"), -m.goals], [t("Evenimente"), -m.events], [t("Scenarii"), m.scenario]] as Array<[string, number]>).filter(([, value]) => Math.abs(value) >= 0.5).map(([label, value]) => <Fragment key={label}><dt style={{ color: "var(--cf-muted)" }}>{label}</dt><dd style={{ margin: 0 }}>{value >= 0 ? "+" : "−"}{lei(Math.abs(value))}</dd></Fragment>)}
          </dl>}
        </li>)}
      </ul>
    </section>
  </div>;
}
