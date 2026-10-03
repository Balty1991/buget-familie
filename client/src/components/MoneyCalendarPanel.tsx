/**
 * Calendarul banilor (Mai mult → Planificare): luna ca o hartă de culori. Zilele trecute se
 * colorează după cât s-a cheltuit, zilele care vin arată ce plătiți sau încasați și soldul
 * estimat. Atingeți o zi și vedeți tot ce s-a întâmplat sau urmează în ea.
 */
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Gift } from "lucide-react";
import { formatDate, isBalanceAdjustment, isoToday, type AppData } from "@/lib/finance-data";
import { monthTitle } from "@/lib/household-insights";
import { moneyCalendar, type CalendarDay } from "@/lib/money-calendar";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { CARD, CountLei, Hero, MUTED, NUM, ROW } from "@/components/plan-ui";

const WEEKDAYS = ["L", "Ma", "Mi", "J", "V", "S", "D"];
/** Culoarea zilei: de la verde pal (puțin) la corai (mult). */
const HEAT = ["transparent", "color-mix(in srgb, var(--cf-primary) 16%, var(--cf-surface))", "color-mix(in srgb, var(--cf-primary) 38%, var(--cf-surface))", "color-mix(in srgb, var(--cf-warning, #b17814) 45%, var(--cf-surface))", "color-mix(in srgb, var(--cf-danger) 62%, var(--cf-surface))"];
const shift = (key: string, offset: number) => { const date = new Date(`${key}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
const capital = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);
const short = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".0", "")}k` : String(Math.round(value)));

function dayLabel(day: CalendarDay) {
  const date = formatDate(day.date, { day: "numeric", month: "long" });
  if (day.future) return day.upcoming.length ? t("{date}: {count} plăți sau încasări", { date, count: day.upcoming.length }) : date;
  return day.spent > 0 ? t("{date}: {amount} cheltuiți", { date, amount: lei(day.spent) }) : t("{date}: fără cheltuieli", { date });
}

export function MoneyCalendarPanel({ data }: { data: AppData }) {
  const today = isoToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(today);
  const cal = useMemo(() => moneyCalendar(data, month, today), [data, month, today]);
  const day = cal.days.find((item) => item.date === picked);
  const moves = useMemo(() => data.transactions.filter((item) => item.date === picked && !isBalanceAdjustment(item) && !item.transferId).sort((a, b) => b.amount - a.amount), [data.transactions, picked]);
  const topWeek = Math.max(1, ...cal.weeks.map((week) => (week.future ? week.due : week.spent)));
  const go = (offset: number) => { const next = shift(month, offset); setMonth(next); setPicked(next === today.slice(0, 7) ? today : `${next}-01`); };
  const isNow = month === today.slice(0, 7);

  return <div style={{ display: "grid", gap: 14 }}>
    <Hero kicker={t("CALENDARUL BANILOR")} value={<CountLei value={cal.spent} />} sub={isNow ? t("cheltuiți luna aceasta · {perDay} pe zi · {free} zile fără cheltuieli", { perDay: lei(Math.round(cal.perDay)), free: cal.noSpendDays }) : t("cheltuiți în {month} · {perDay} pe zi · {free} zile fără cheltuieli", { month: monthTitle(month), perDay: lei(Math.round(cal.perDay)), free: cal.noSpendDays })} />

    <section className="bf-scenario-card" style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button type="button" className="bf-icon-button" aria-label={t("Luna anterioară")} onClick={() => go(-1)} disabled={month <= shift(today.slice(0, 7), -24)}><ChevronLeft size={18} /></button>
        <b style={{ textTransform: "capitalize" }}>{monthTitle(month)}</b>
        <button type="button" className="bf-icon-button" aria-label={t("Luna următoare")} onClick={() => go(1)} disabled={month >= shift(today.slice(0, 7), 2)}><ChevronRight size={18} /></button>
      </div>
      <div role="group" aria-label={t("Zilele lunii")} style={{ display: "grid", gap: 4 }}>
        <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>{WEEKDAYS.map((label) => <span key={label} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, ...MUTED }}>{label}</span>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
          {Array.from({ length: cal.offset }, (_, n) => <span key={`e${n}`} aria-hidden="true" />)}
          {cal.days.map((item) => {
            const isToday = item.date === today;
            const on = item.date === picked;
            const bills = item.upcoming.filter((entry) => entry.kind !== "income").length;
            const pay = item.upcoming.some((entry) => entry.kind === "income") || item.income > 0;
            return <button key={item.date} type="button" aria-pressed={on} aria-label={dayLabel(item)} onClick={() => setPicked(item.date)} style={{
              position: "relative", display: "grid", alignContent: "space-between", justifyItems: "start", minWidth: 0, minHeight: 50, padding: "5px 4px 4px 6px", borderRadius: 12,
              border: on ? "2px solid var(--cf-ink)" : isToday ? "2px solid var(--cf-primary)" : "1px solid var(--cf-line)",
              background: item.heat ? HEAT[item.heat] : "var(--cf-surface)", borderStyle: item.future && !on ? "dashed" : "solid",
              color: "var(--cf-ink)", textAlign: "left", transition: "transform .15s",
            }}>
              <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, lineHeight: 1 }}>{Number(item.date.slice(8))}</span>
              <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1, opacity: 0.85, ...NUM }}>{item.future ? (bills ? `−${short(item.upcoming.filter((entry) => entry.kind !== "income").reduce((sum, entry) => sum + entry.amount, 0))}` : "") : item.spent > 0 ? short(item.spent) : ""}</span>
              {(pay || bills > 0) && <span aria-hidden="true" style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 2 }}>
                {pay && <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cf-primary-strong)" }} />}
                {bills > 0 && <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cf-danger)" }} />}
              </span>}
            </button>;
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", fontSize: 12, ...MUTED }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{t("puțin")}{HEAT.slice(1).map((color) => <i key={color} style={{ width: 14, height: 14, borderRadius: 4, background: color, border: "1px solid var(--cf-line)" }} />)}{t("mult")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cf-primary-strong)" }} />{t("venit")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cf-danger)" }} />{t("de plătit")}</span>
      </div>
    </section>

    {day && <section className="bf-scenario-card" style={CARD} aria-live="polite">
      <p className="bf-kicker">{day.future ? t("URMEAZĂ") : day.date === today ? t("AZI") : t("ZIUA")}</p>
      <div role="heading" aria-level={3} style={{ fontSize: 18, fontWeight: 700 }}>{capital(formatDate(day.date, { weekday: "long", day: "numeric", month: "long" }))}</div>
      {day.balance !== undefined && <div style={ROW}><span>{t("Sold estimat la final de zi")}</span><b style={{ color: day.balance < 0 ? "var(--cf-danger)" : "var(--cf-primary-strong)", ...NUM }}>{lei(day.balance)}</b></div>}
      {day.upcoming.map((entry, n) => <div key={`${entry.title}-${n}`} style={ROW}><span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>{entry.kind === "income" ? <ArrowUpRight size={16} color="var(--cf-primary)" aria-hidden="true" /> : entry.kind === "event" ? <Gift size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.title}</span></span><b style={NUM}>{entry.kind === "income" ? "+" : "−"}{lei(entry.amount)}</b></div>)}
      {!day.future && moves.map((item) => <div key={item.id} style={ROW}><span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>{item.kind === "income" ? <ArrowUpRight size={16} color="var(--cf-primary)" aria-hidden="true" /> : <ArrowDownRight size={16} aria-hidden="true" />}<span style={{ display: "grid", minWidth: 0 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span><small style={MUTED}>{t(item.category)}</small></span></span><b style={NUM}>{item.kind === "income" ? "+" : "−"}{lei(item.amount)}</b></div>)}
      {!day.upcoming.length && (day.future || !moves.length) && <small className="bf-helper" style={{ margin: 0 }}>{day.future ? t("Nimic programat. Soldul scade doar cu traiul obișnuit (~{amount} pe zi).", { amount: lei(cal.dailyLiving) }) : t("O zi fără cheltuieli.")}</small>}
    </section>}

    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("SĂPTĂMÂNILE LUNII")}</p>
      {cal.weeks.map((week) => { const value = week.future ? week.due : week.spent; return <div key={week.label} style={{ display: "grid", gridTemplateColumns: "52px minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
        <small style={{ fontWeight: 600, ...MUTED, ...NUM }}>{week.label}</small>
        <i style={{ display: "block", height: 10, borderRadius: 6, background: "var(--cf-surface-alt)", overflow: "hidden" }}><em style={{ display: "block", height: "100%", width: `${(value / topWeek) * 100}%`, borderRadius: 6, background: week.future ? "repeating-linear-gradient(90deg, var(--cf-danger) 0 6px, transparent 6px 9px)" : value === topWeek ? "var(--cf-primary-strong)" : "var(--cf-primary)" }} /></i>
        <b style={{ minWidth: 72, textAlign: "right", color: week.future ? "var(--cf-muted)" : undefined, ...NUM }}>{week.future ? (week.due > 0 ? t("{amount} de plătit", { amount: lei(Math.round(week.due)) }) : "—") : lei(Math.round(week.spent))}</b>
      </div>; })}
      {cal.priciest && <small className="bf-helper" style={{ margin: 0 }}>{t("Ziua cea mai scumpă: {date}, {amount}.", { date: formatDate(cal.priciest.date, { weekday: "long", day: "numeric", month: "long" }), amount: lei(Math.round(cal.priciest.spent)) })}</small>}
    </section>
  </div>;
}
