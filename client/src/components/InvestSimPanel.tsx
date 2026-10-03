/**
 * Simulatorul de investiții și pensie (Mai mult → Planificare). „Creștere”: cât ajung depunerile
 * lunare în trei scenarii, cu comision, inflație și depunere care crește în fiecare an, plus
 * „cât să pun lunar pentru o țintă”. „Pensie”: golul dintre pensia de stat și venitul dorit,
 * capitalul care îl acoperă, depunerea lunară și până la ce vârstă ajung banii.
 * Valorile alese rămân pe telefon. E o simulare educativă, nu o recomandare.
 */
import { useEffect, useMemo, useState } from "react";
import { isoToday, type AppData } from "@/lib/finance-data";
import { monthlySurplus } from "@/lib/household-insights";
import { growth, monthlyFor, retirement, RETURNS, type ScenarioId } from "@/lib/invest-sim";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { safeSetItem } from "@/lib/safe-storage";
import { CARD, CountLei, Hero, MUTED, NUM, NumberField, RANGE, ROW, Segmented } from "@/components/plan-ui";

const KEY = "buget-familie:invest-sim";
type State = { mode: "growth" | "pension"; monthly: number; years: number; start: number; fee: number; raise: number; inflation: number; real: boolean; target: number; age: number; retireAge: number; untilAge: number; desired: number; pension: number; saved: number; saving: number; scenario: ScenarioId };
const DEFAULTS: State = { mode: "growth", monthly: 500, years: 20, start: 0, fee: 0.5, raise: 0, inflation: 4, real: false, target: 100000, age: 35, retireAge: 65, untilAge: 85, desired: 5000, pension: 3000, saved: 0, saving: 300, scenario: "medium" };
const read = (): State => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; } };
const W = 320, H = 150;
const COLORS: Record<ScenarioId, string> = { prudent: "var(--cf-info)", medium: "var(--cf-primary)", optimist: "var(--cf-warning, #b17814)" };

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (next: number) => void; format: (value: number) => string }) {
  return <label style={{ display: "grid", gap: 2, fontWeight: 600 }}>
    <span style={ROW}><span>{label}</span><span style={{ color: "var(--cf-primary-strong)", ...NUM }}>{format(value)}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} style={RANGE} />
  </label>;
}

/** Evantaiul: banda dintre prudent și optimist, linia scenariului mediu și linia banilor depuși. */
function Fan({ series, contributed, label }: { series: Record<ScenarioId, number[]>; contributed: number[]; label: string }) {
  const n = contributed.length - 1;
  const top = Math.max(1, ...series.optimist, ...contributed);
  const x = (i: number) => 6 + (i / Math.max(1, n)) * (W - 12);
  const y = (v: number) => H - 18 - (v / top) * (H - 30);
  const line = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const band = `${line(series.optimist)} ${series.prudent.map((v, i) => `L${x(n - i).toFixed(1)},${y(series.prudent[n - i]).toFixed(1)}`).join(" ")} Z`;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block" }}>
    {[0.25, 0.5, 0.75].map((share) => <line key={share} x1={6} x2={W - 6} y1={y(top * share)} y2={y(top * share)} stroke="var(--cf-line)" strokeDasharray="2 4" />)}
    <path d={band} fill="var(--cf-primary)" opacity={0.14} />
    <path d={line(series.optimist)} fill="none" stroke={COLORS.optimist} strokeWidth={1.5} />
    <path d={line(series.prudent)} fill="none" stroke={COLORS.prudent} strokeWidth={1.5} />
    <path d={line(contributed)} fill="none" stroke="var(--cf-muted)" strokeWidth={1.5} strokeDasharray="4 4" />
    <path d={line(series.medium)} fill="none" stroke={COLORS.medium} strokeWidth={3} strokeLinejoin="round" />
    <circle cx={x(n)} cy={y(series.medium[n])} r={4.5} fill={COLORS.medium} />
    <text x={6} y={H - 3} fontSize={11} fill="var(--cf-muted)">{t("azi")}</text>
    <text x={W - 6} y={H - 3} fontSize={11} fill="var(--cf-muted)" textAnchor="end">{t("{years} ani", { years: n })}</text>
  </svg>;
}

export function InvestSimPanel({ data }: { data: AppData }) {
  const [s, setS] = useState<State>(read);
  const set = (patch: Partial<State>) => setS((current) => ({ ...current, ...patch }));
  useEffect(() => { try { safeSetItem(localStorage, KEY, JSON.stringify(s)); } catch { /* fără stocare */ } }, [s]);
  const surplus = useMemo(() => monthlySurplus(data, isoToday()), [data]);

  const runs = useMemo(() => {
    const out = {} as Record<ScenarioId, ReturnType<typeof growth>>;
    for (const id of Object.keys(RETURNS) as ScenarioId[]) out[id] = growth({ start: s.start, monthly: s.monthly, years: s.years, annualReturn: RETURNS[id], fee: s.fee, raise: s.raise, inflation: s.inflation });
    return out;
  }, [s.start, s.monthly, s.years, s.fee, s.raise, s.inflation]);
  const pick = (id: ScenarioId) => runs[id].map((point) => (s.real ? point.real : point.value));
  const end = runs.medium[runs.medium.length - 1];
  const endValue = s.real ? end.real : end.value;
  const forTarget = useMemo(() => monthlyFor(s.target, { start: s.start, years: s.years, annualReturn: RETURNS.medium, fee: s.fee }), [s.target, s.start, s.years, s.fee]);
  const plan = useMemo(() => retirement({ age: s.age, retireAge: Math.max(s.age + 1, s.retireAge), untilAge: Math.max(s.retireAge + 1, s.untilAge), desired: s.desired, pension: s.pension, saved: s.saved, monthly: s.saving, annualReturn: RETURNS[s.scenario], fee: s.fee, inflation: s.inflation }), [s]);

  const tabs = <Segmented label={t("Ce simulăm")} value={s.mode} onChange={(mode) => set({ mode })} options={[["growth", t("Creștere")], ["pension", t("Pensie")]]} />;
  const note = <small className="bf-helper" style={{ margin: 0 }}>{t("Simulare educativă, nu recomandare de investiții. Randamentele ({prudent}% / {medium}% / {optimist}% pe an) sunt orientative; piețele pot scădea, iar ce a fost nu garantează ce va fi.", { prudent: RETURNS.prudent, medium: RETURNS.medium, optimist: RETURNS.optimist })}</small>;

  if (s.mode === "pension") {
    const maxAge = Math.max(plan.path[plan.path.length - 1]?.age || s.untilAge, s.untilAge);
    const top = Math.max(1, ...plan.path.map((p) => p.value), plan.needed);
    const x = (age: number) => 6 + ((age - s.age) / Math.max(1, maxAge - s.age)) * (W - 12);
    const y = (v: number) => H - 18 - (v / top) * (H - 30);
    const ok = plan.gap === 0 || plan.lastsUntil >= s.untilAge;
    return <div style={{ display: "grid", gap: 14 }}>
      {tabs}
      <Hero kicker={t("PENSIA VOASTRĂ")} value={plan.gap === 0 ? t("Acoperit") : <><CountLei value={plan.monthlyNeeded} />{t("/lună")}</>} sub={plan.gap === 0 ? t("Pensia estimată acoperă venitul dorit.") : t("de pus deoparte de acum până la {age} ani, ca să aveți {desired} pe lună (bani de azi).", { age: s.retireAge, desired: lei(s.desired) })} />
      <section className="bf-scenario-card" style={CARD}>
        <p className="bf-kicker">{t("CE LIPSEȘTE")}</p>
        <div style={ROW}><span>{t("Pe lună, peste pensia de stat")}</span><b style={NUM}>{lei(plan.gap)}</b></div>
        <div style={ROW}><span>{t("Capital necesar la {age} ani", { age: s.retireAge })}</span><b style={NUM}>{lei(plan.needed)}</b></div>
        <small style={MUTED}>{t("În lei de atunci: {amount}, cu inflația de {inflation}%.", { amount: lei(plan.neededNominal), inflation: s.inflation })}</small>
        <Slider label={t("Puneți deoparte lunar")} value={s.saving} min={0} max={Math.max(3000, Math.ceil(plan.monthlyNeeded / 100) * 100)} step={50} onChange={(saving) => set({ saving })} format={lei} />
        <p style={{ margin: 0, fontWeight: 600, color: ok ? "var(--cf-primary-strong)" : "var(--cf-danger)" }}>{ok ? t("Cu {amount} pe lună, banii ajung până după {age} ani.", { amount: lei(s.saving), age: s.untilAge }) : t("Cu {amount} pe lună, banii ajung până la {age} ani.", { amount: lei(s.saving), age: plan.lastsUntil })}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Capitalul pe ani de vârstă")} style={{ width: "100%", height: "auto", display: "block" }}>
          <line x1={x(s.retireAge)} x2={x(s.retireAge)} y1={8} y2={H - 18} stroke="var(--cf-line)" strokeDasharray="3 3" />
          {plan.needed > 0 && <line x1={6} x2={W - 6} y1={y(plan.needed)} y2={y(plan.needed)} stroke="var(--cf-muted)" strokeDasharray="4 4" />}
          <path d={`${plan.path.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")} L${x(plan.path[plan.path.length - 1].age)},${H - 18} L${x(s.age)},${H - 18} Z`} fill={ok ? "var(--cf-primary)" : "var(--cf-danger)"} opacity={0.16} />
          <path d={plan.path.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")} fill="none" stroke={ok ? "var(--cf-primary)" : "var(--cf-danger)"} strokeWidth={2.5} strokeLinejoin="round" />
          <text x={6} y={H - 3} fontSize={11} fill="var(--cf-muted)">{s.age}</text>
          <text x={x(s.retireAge)} y={H - 3} fontSize={11} fill="var(--cf-muted)" textAnchor="middle">{t("pensie {age}", { age: s.retireAge })}</text>
          <text x={W - 6} y={H - 3} fontSize={11} fill="var(--cf-muted)" textAnchor="end">{maxAge}</text>
        </svg>
        <small className="bf-helper" style={{ margin: 0 }}>{t("Linia punctată orizontală: capitalul necesar. Totul în bani de azi.")}</small>
      </section>
      <section className="bf-scenario-card" style={CARD}>
        <p className="bf-kicker">{t("DATELE VOASTRE")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <NumberField label={t("Vârsta de azi")} value={s.age} min={18} max={80} onChange={(age) => set({ age })} />
          <NumberField label={t("Pensionare la")} value={s.retireAge} min={40} max={80} onChange={(retireAge) => set({ retireAge })} />
          <NumberField label={t("Venit dorit pe lună")} value={s.desired} step={100} onChange={(desired) => set({ desired })} />
          <NumberField label={t("Pensia de stat estimată")} value={s.pension} step={100} onChange={(pension) => set({ pension })} />
          <NumberField label={t("Strâns deja")} value={s.saved} step={1000} onChange={(saved) => set({ saved })} />
          <NumberField label={t("Banii să ajungă până la")} value={s.untilAge} min={60} max={100} onChange={(untilAge) => set({ untilAge })} />
        </div>
        <Segmented label={t("Scenariul")} value={s.scenario} onChange={(scenario) => set({ scenario })} options={[["prudent", t("Prudent")], ["medium", t("Mediu")], ["optimist", t("Optimist")]]} />
        <Slider label={t("Inflația pe an")} value={s.inflation} min={0} max={10} step={0.5} onChange={(inflation) => set({ inflation })} format={(value) => `${value}%`} />
        <small className="bf-helper" style={{ margin: 0 }}>{t("Pensia de stat estimată o găsiți în extrasul de la Casa de Pensii; Pilonul II se adaugă la „Strâns deja”.")}</small>
      </section>
      {note}
    </div>;
  }

  return <div style={{ display: "grid", gap: 14 }}>
    {tabs}
    <Hero kicker={t("ÎN {years} ANI, SCENARIUL MEDIU", { years: s.years })} value={<CountLei value={endValue} />} sub={t("{contributed} puși de voi, {gain} adus de dobânda compusă{real}.", { contributed: lei(end.contributed), gain: lei(Math.max(0, end.value - end.contributed)), real: s.real ? t(", în bani de azi") : "" })} />
    <section className="bf-scenario-card" style={CARD}>
      <Fan series={{ prudent: pick("prudent"), medium: pick("medium"), optimist: pick("optimist") }} contributed={runs.medium.map((p) => p.contributed)} label={t("Cum cresc banii în trei scenarii")} />
      <div style={{ display: "grid", gap: 6 }}>
        {(["optimist", "medium", "prudent"] as ScenarioId[]).map((id) => { const last = runs[id][runs[id].length - 1]; return <div key={id} style={{ ...ROW, alignItems: "center", padding: "8px 12px", borderRadius: 12, background: id === "medium" ? "color-mix(in srgb, var(--cf-primary) 10%, var(--cf-surface))" : "var(--cf-surface-alt)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}><i aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 4, background: COLORS[id] }} />{id === "prudent" ? t("Prudent") : id === "medium" ? t("Mediu") : t("Optimist")} <small style={MUTED}>{RETURNS[id]}%</small></span>
          <b style={NUM}>{lei(s.real ? last.real : last.value)}</b>
        </div>; })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontWeight: 600 }}><input type="checkbox" checked={s.real} onChange={(event) => set({ real: event.target.checked })} style={{ width: 22, height: 22, minHeight: 22, accentColor: "var(--cf-primary)" }} />{t("Arată în bani de azi (fără inflație)")}</label>
    </section>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CE PUNEȚI")}</p>
      <Slider label={t("Pe lună")} value={s.monthly} min={0} max={5000} step={50} onChange={(monthly) => set({ monthly })} format={lei} />
      <Slider label={t("Câți ani")} value={s.years} min={1} max={40} step={1} onChange={(years) => set({ years })} format={(value) => t("{years} ani", { years: value })} />
      <Slider label={t("Depunerea crește în fiecare an cu")} value={s.raise} min={0} max={10} step={1} onChange={(raise) => set({ raise })} format={(value) => `${value}%`} />
      <Slider label={t("Comision anual")} value={s.fee} min={0} max={2.5} step={0.1} onChange={(fee) => set({ fee: Math.round(fee * 10) / 10 })} format={(value) => `${value}%`} />
      <Slider label={t("Inflația pe an")} value={s.inflation} min={0} max={10} step={0.5} onChange={(inflation) => set({ inflation })} format={(value) => `${value}%`} />
      <NumberField label={t("Porniți cu")} value={s.start} step={1000} onChange={(start) => set({ start })} suffix="lei" />
      {surplus !== undefined && surplus > 100 && <button type="button" className="bf-secondary" onClick={() => set({ monthly: Math.round(surplus / 2 / 50) * 50 })} style={{ minHeight: 44, justifySelf: "start" }}>{t("Jumătate din ce vă rămâne lunar: {amount}", { amount: lei(Math.round(surplus / 2 / 50) * 50) })}</button>}
      {s.fee >= 1.5 && <small style={{ color: "var(--cf-danger)", fontWeight: 600 }}>{t("Un comision de {fee}% pe an mănâncă {amount} în {years} ani.", { fee: s.fee, years: s.years, amount: lei(Math.max(0, growth({ start: s.start, monthly: s.monthly, years: s.years, annualReturn: RETURNS.medium, raise: s.raise }).slice(-1)[0].value - end.value)) })}</small>}
    </section>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("O ȚINTĂ")}</p>
      <NumberField label={t("Vreau să am")} value={s.target} step={5000} onChange={(target) => set({ target })} suffix="lei" />
      <p style={{ margin: 0, fontWeight: 600 }}>{forTarget === 0 ? t("Ajungeți acolo doar cu ce aveți acum.") : t("Pentru {target} în {years} ani: {monthly} pe lună, în scenariul mediu.", { target: lei(s.target), years: s.years, monthly: lei(forTarget) })}</p>
      {forTarget > 0 && forTarget !== s.monthly && <button type="button" className="bf-secondary" onClick={() => set({ monthly: forTarget })} style={{ minHeight: 44, justifySelf: "start" }}>{t("Folosește {amount} pe lună", { amount: lei(forTarget) })}</button>}
    </section>
    {note}
  </div>;
}
