/**
 * Raportul lunii (Mai mult → Planificare, și de pe Astăzi în primele zile ale lunii): cifrele
 * lunii trecute, categoriile față de media lor, ce a mers, ce nu, trei recomandări cu sume și
 * închiderea lunii. Se poate răsfoi înapoi până la șase luni.
 */
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Lightbulb } from "lucide-react";
import { formatDate, isoToday, type AppData } from "@/lib/finance-data";
import { monthAdvice } from "@/lib/month-advisor";
import { closeMonthLocally, monthlyRecap, monthTitle, readClosedMonths } from "@/lib/household-insights";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

/** O singură coloană care se poate strânge: un rând lat nu mai împinge cifrele afară din card. */
const CARD = { gridTemplateColumns: "minmax(0, 1fr)" } as const;

const shift = (key: string, offset: number) => { const date = new Date(`${key.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };

export function MonthAdvisorPanel({ data }: { data: AppData }) {
  const today = isoToday();
  const [back, setBack] = useState(1);
  const month = shift(today, -back);
  const advice = useMemo(() => monthAdvice(data, month, today), [data, month, today]);
  const [closed, setClosed] = useState(() => readClosedMonths());
  const nav = <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
    <button type="button" className="bf-icon-button" aria-label={t("Luna dinainte")} disabled={back >= 6} onClick={() => setBack(back + 1)}><ChevronLeft size={18} /></button>
    <b style={{ textTransform: "capitalize" }}>{monthTitle(month)}</b>
    <button type="button" className="bf-icon-button" aria-label={t("Luna următoare")} disabled={back <= 1} onClick={() => setBack(back - 1)}><ChevronRight size={18} /></button>
  </div>;
  if (!advice) return <section className="bf-scenario-card" style={CARD}><p className="bf-kicker">{t("RAPORTUL LUNII")}</p>{nav}<p className="bf-helper" style={{ margin: 0 }}>{t("Prea puține mișcări în luna aceasta pentru un raport. Notați câteva zile și revine aici.")}</p></section>;
  const top = Math.max(1, ...advice.categories.map((row) => Math.max(row.amount, row.average)));
  const list = (items: string[], Icon: typeof Check, color: string) => <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>{items.map((line) => <li key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><Icon size={18} color={color} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} /><span>{line}</span></li>)}</ul>;
  return <div style={{ display: "grid", gap: 14 }}>
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("RAPORTUL LUNII")}</p>
      {nav}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
        {([[t("Intrat"), advice.income, "var(--cf-primary-strong)"], [t("Ieșit"), advice.expense, "var(--cf-ink)"], [advice.saved >= 0 ? t("Rămas") : t("Lipsă"), Math.abs(advice.saved), advice.saved >= 0 ? "var(--cf-primary-strong)" : "var(--cf-danger)"]] as Array<[string, number, string]>).map(([label, value, color]) => <div key={label} style={{ padding: "10px 4px", borderRadius: 14, background: "color-mix(in srgb, var(--cf-ink) 4%, var(--cf-surface))" }}><small style={{ color: "var(--cf-muted)" }}>{label}</small><b style={{ display: "block", color, fontVariantNumeric: "tabular-nums" }}>{lei(Math.round(value))}</b></div>)}
      </div>
      {advice.partialFrom && <small className="bf-helper" style={{ margin: 0 }}>{t("Notat de pe {date}: luna nu e completă, așa că cifrele sunt orientative.", { date: formatDate(advice.partialFrom, { day: "numeric", month: "long" }) })}</small>}
      {advice.income > 0 && <p style={{ margin: 0 }}>{advice.saved >= 0 ? t("Rata de economisire: {rate}% din venit.", { rate: advice.rate }) : t("Luna s-a încheiat pe minus.")}</p>}
    </section>
    {advice.tips.length > 0 && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CE SĂ FACEȚI LUNA ASTA")}</p>
      <ol style={{ display: "grid", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
        {advice.tips.map((tip, index) => <li key={tip.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><span style={{ display: "grid", placeItems: "center", flex: "none", width: 28, height: 28, borderRadius: "50%", background: "var(--cf-primary)", color: "#fff", fontWeight: 700 }}>{index + 1}</span><span>{tip.text}</span></li>)}
      </ol>
    </section>}
    {(advice.wins.length > 0 || advice.issues.length > 0) && <section className="bf-scenario-card" style={CARD}>
      {advice.wins.length > 0 && <><p className="bf-kicker">{t("CE A MERS")}</p>{list(advice.wins, Check, "var(--cf-primary)")}</>}
      {advice.issues.length > 0 && <><p className="bf-kicker" style={{ marginTop: 6 }}>{t("DE URMĂRIT")}</p>{list(advice.issues, CircleAlert, "var(--cf-warning, #b7791f)")}</>}
    </section>}
    {advice.categories.length > 0 && <section className="bf-month-vs-average" aria-label={t("Categoriile lunii față de medie")}>
      <p className="bf-kicker">{t("PE CE S-AU DUS BANII")}</p>
      <p className="bf-mva-note">{t("Bara: luna aceasta. Linia: media celor trei luni dinainte.")}</p>
      <ul>{advice.categories.map((row) => <li key={row.category}>
        <span className="bf-mva-label"><b>{t(row.category)}</b><small>{lei(row.amount)}</small></span>
        <span className="bf-mva-bar" role="img" aria-label={t("{now} acum, media {avg}", { now: lei(row.amount), avg: lei(row.average) })}><i style={{ width: `${Math.round((row.amount / top) * 100)}%` }} className={row.average > 0 && row.amount > row.average * 1.2 ? "up" : ""} />{row.average > 0 && <em style={{ left: `${Math.round((row.average / top) * 100)}%` }} aria-hidden="true" />}</span>
      </li>)}</ul>
    </section>}
    <section className="bf-scenario-card" style={CARD}>
      {closed[month] ? <p style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}><Check size={18} color="var(--cf-primary)" aria-hidden="true" /> {t("Luna e închisă.")}</p>
        : <><p style={{ margin: 0, display: "flex", gap: 8, alignItems: "flex-start" }}><Lightbulb size={18} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} /> {t("Ați citit raportul? Închideți luna: rămâne în istoric, iar raportul nu mai apare pe Astăzi.")}</p>
          <button type="button" className="bf-primary" onClick={() => { closeMonthLocally(monthlyRecap(data, month)); setClosed(readClosedMonths()); window.dispatchEvent(new Event("buget-familie:month-closed")); }}>{t("Închide luna {month}", { month: monthTitle(month) })}</button></>}
    </section>
  </div>;
}
