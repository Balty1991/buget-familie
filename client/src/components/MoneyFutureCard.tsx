/**
 * Obiective: glisezi cât puneți deoparte pe lună și vezi pe loc curba economiilor pe 3 ani,
 * cu un steguleț în luna în care se atinge fiecare obiectiv.
 */
import { useMemo, useState } from "react";
import { Flag } from "lucide-react";
import { isoToday, type AppData } from "@/lib/finance-data";
import { moneyFuture } from "@/lib/money-future";
import { savingsSuggestion } from "@/lib/household-insights";
import { getLocale, monthsLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const HORIZON = 36;
const W = 320, H = 150, PAD = 8;

export function MoneyFutureCard({ data }: { data: AppData }) {
  const today = isoToday();
  const suggested = useMemo(() => {
    const sum = data.savings.filter((goal) => goal.current < goal.target).reduce((acc, goal) => acc + (savingsSuggestion(data, goal, today)?.monthly || 0), 0);
    return Math.min(5000, Math.max(50, Math.round((sum || 300) / 50) * 50));
  }, [data, today]);
  const [monthly, setMonthly] = useState(suggested);
  const future = useMemo(() => moneyFuture(data.savings, monthly, HORIZON), [data.savings, monthly]);
  const faster = useMemo(() => moneyFuture(data.savings, monthly + 100, HORIZON), [data.savings, monthly]);
  if (!data.savings.some((goal) => goal.target > 0)) return null;
  const top = Math.max(1, future.points[HORIZON], data.savings.reduce((sum, goal) => sum + goal.target, 0));
  const x = (month: number) => PAD + ((W - 2 * PAD) * month) / HORIZON;
  const y = (value: number) => H - PAD - ((H - 2 * PAD - 18) * value) / top;
  const line = future.points.map((value, month) => `${month ? "L" : "M"}${x(month).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const when = (month: number) => { const date = new Date(`${today.slice(0, 7)}-15T12:00:00`); date.setMonth(date.getMonth() + month); return new Intl.DateTimeFormat(getLocale(), { month: "short", year: "numeric" }).format(date); };
  const reached = future.goals.filter((goal) => goal.month !== undefined && goal.month > 0);
  const saved = future.doneMonth !== undefined && faster.doneMonth !== undefined ? future.doneMonth - faster.doneMonth : 0;
  return (
    <section className="bf-scenario-card" aria-labelledby="bf-future-title">
      <div className="bf-scenario-heading"><div><p className="bf-kicker">{t("VIITORUL BANILOR")}</p><h2 id="bf-future-title">{t("Dacă puneți deoparte {amount} pe lună", { amount: lei(monthly) })}</h2></div><span><Flag size={21} /></span></div>
      <input type="range" min={0} max={Math.max(2000, suggested * 3)} step={50} value={monthly} onChange={(event) => setMonthly(Number(event.target.value))} aria-label={t("Cât puneți deoparte pe lună")} style={{ width: "100%", accentColor: "var(--cf-primary)" }} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Economiile cresc la {amount} în 3 ani", { amount: lei(future.points[HORIZON]) })} style={{ width: "100%", height: "auto", display: "block" }}>
        <path d={`${line} L${x(HORIZON)},${H - PAD} L${x(0)},${H - PAD} Z`} fill="var(--cf-primary)" opacity="0.14" />
        <path d={line} fill="none" stroke="var(--cf-primary)" strokeWidth="2.5" strokeLinejoin="round" />
        {reached.map((goal, index) => <g key={goal.id}>
          <line x1={x(goal.month!)} x2={x(goal.month!)} y1={y(future.points[goal.month!])} y2={H - PAD} stroke="var(--cf-primary-strong)" strokeDasharray="3 3" />
          <circle cx={x(goal.month!)} cy={y(future.points[goal.month!])} r="5" fill="var(--cf-surface)" stroke="var(--cf-primary-strong)" strokeWidth="2.5" />
          {index < 3 && <text x={Math.min(W - 4, Math.max(4, x(goal.month!)))} y={Math.max(12, y(future.points[goal.month!]) - 10 - index * 12)} textAnchor={x(goal.month!) > W * 0.7 ? "end" : x(goal.month!) < W * 0.3 ? "start" : "middle"} fontSize="10" fontWeight="700" fill="var(--cf-ink)">{goal.name.slice(0, 18)}</text>}
        </g>)}
        <text x={x(HORIZON)} y={Math.max(11, y(future.points[HORIZON]) - 6)} fontSize="11" fontWeight="700" fill="var(--cf-primary-strong)" textAnchor="end">{lei(future.points[HORIZON])}</text>
        <text x={x(0)} y={H - 1} fontSize="9" fill="var(--cf-muted)">{t("azi")}</text>
        <text x={x(HORIZON)} y={H - 1} fontSize="9" fill="var(--cf-muted)" textAnchor="end">{t("peste 3 ani")}</text>
      </svg>
      <ul style={{ display: "grid", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
        {future.goals.map((goal) => <li key={goal.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{goal.name}</span><b>{goal.month === 0 ? t("atins") : goal.month !== undefined ? t("{date} · în {months}", { date: when(goal.month), months: monthsLabel(goal.month) }) : t("după 3 ani")}</b></li>)}
      </ul>
      {saved > 0 && <p className="bf-helper" style={{ margin: 0 }}>{t("Cu 100 de lei în plus pe lună, ajungeți la toate cu {months} mai devreme.", { months: monthsLabel(saved) })}</p>}
    </section>
  );
}
