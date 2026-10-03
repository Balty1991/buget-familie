/**
 * Tendințe și obiceiuri (Mai mult → Planificare): anul pe luni, ce crește și ce scade, cum arată
 * săptămâna, categoriile cu linia lor, magazinele de bază și abonamentele care se repetă
 * fără să fie urmărite (cu „Urmărește” le treceți la scadențe).
 */
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, Repeat } from "lucide-react";
import { formatDate, isoToday, type AppData } from "@/lib/finance-data";
import { categoryColor } from "@/lib/category-color";
import { recurringFromDetection } from "@/lib/household-insights";
import { spendingTrends, type CategoryTrend } from "@/lib/spending-trends";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { CARD, CountLei, Hero, MUTED, NUM, ROW, Spark } from "@/components/plan-ui";

const WEEKDAYS = ["L", "Ma", "Mi", "J", "V", "S", "D"];
const weekdayName = (index: number) => new Intl.DateTimeFormat(getLocale(), { weekday: "long" }).format(new Date(Date.UTC(2026, 2, 2 + index, 12)));
const shortMonth = (key: string) => new Intl.DateTimeFormat(getLocale(), { month: "short" }).format(new Date(`${key}-15T12:00:00Z`)).replace(".", "");

function Move({ row, up }: { row: CategoryTrend; up: boolean }) {
  const color = up ? "var(--cf-danger)" : "var(--cf-primary)";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return <li style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
    <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 12, background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}><Icon size={20} /></span>
    <span style={{ display: "grid", minWidth: 0 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(row.name)}</b><small style={MUTED}>{t("{before} → {recent} pe lună", { before: lei(Math.round(row.before)), recent: lei(Math.round(row.recent)) })}</small></span>
    <b style={{ color, ...NUM }}>{row.change !== undefined ? `${row.change > 0 ? "+" : ""}${Math.round(row.change * 100)}%` : ""}</b>
  </li>;
}

export function TrendsPanel({ data, onChange }: { data: AppData; onChange?: (next: AppData) => void }) {
  const today = isoToday();
  const trends = useMemo(() => spendingTrends(data, today), [data, today]);
  const [added, setAdded] = useState<string[]>([]);
  if (!trends) return <section className="bf-scenario-card" style={CARD}><p className="bf-kicker">{t("TENDINȚE ȘI OBICEIURI")}</p><p className="bf-helper" style={{ margin: 0 }}>{t("Tendințele apar după două luni întregi notate. Până atunci, fiecare cheltuială notată ajută.")}</p></section>;

  const total = trends.months.reduce((sum, row) => sum + row.total, 0);
  const average = total / trends.months.length;
  const topMonth = Math.max(1, ...trends.months.map((row) => row.total));
  const topDay = Math.max(1, ...trends.weekdays);
  const last = trends.months[trends.months.length - 1];
  const follow = (index: number) => {
    const item = trends.forgotten[index];
    const draft = item && recurringFromDetection(data, item.detection);
    if (!draft || !onChange) return;
    onChange({ ...data, recurring: [...data.recurring, draft] });
    setAdded((list) => [...list, item.name]);
  };

  return <div style={{ display: "grid", gap: 14 }}>
    <Hero kicker={t("ULTIMELE {count} LUNI", { count: trends.months.length })} value={<CountLei value={average} />} sub={t("cheltuiți în medie pe lună · {last} luna trecută", { last: lei(Math.round(last.total)) })}>
      <div role="img" aria-label={t("Cheltuielile pe fiecare lună")} style={{ display: "grid", gridTemplateColumns: `repeat(${trends.months.length}, minmax(0, 1fr))`, alignItems: "end", gap: 4, height: 84, marginTop: 10 }}>
        {trends.months.map((row, n) => <span key={row.key} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, height: "100%" }}>
          <i style={{ display: "block", height: `${Math.max(4, (row.total / topMonth) * 64)}px`, borderRadius: 6, background: n === trends.months.length - 1 ? "var(--cf-on-primary, #fff)" : "color-mix(in srgb, var(--cf-on-primary, #fff) 45%, transparent)" }} />
          <small style={{ fontSize: 10, textAlign: "center", opacity: 0.85, overflow: "hidden", whiteSpace: "nowrap" }}>{shortMonth(row.key)}</small>
        </span>)}
      </div>
    </Hero>

    {(trends.rising.length > 0 || trends.falling.length > 0) && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CE SE SCHIMBĂ")}</p>
      <small className="bf-helper" style={{ margin: 0 }}>{t("Ultimele 3 luni față de cele 3 dinainte.")}</small>
      <ul style={{ display: "grid", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>
        {trends.rising.map((row) => <Move key={row.name} row={row} up />)}
        {trends.falling.map((row) => <Move key={row.name} row={row} up={false} />)}
      </ul>
    </section>}

    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("SĂPTĂMÂNA VOASTRĂ")}</p>
      <div role="heading" aria-level={3} style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{t("Cea mai scumpă zi: {day}", { day: weekdayName(trends.priciestDay) })}</div>
      <div role="img" aria-label={t("Media cheltuită pe fiecare zi a săptămânii")} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", alignItems: "end", gap: 6, height: 110 }}>
        {trends.weekdays.map((value, n) => <span key={n} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, height: "100%", textAlign: "center" }}>
          <small style={{ fontSize: 10, ...MUTED, ...NUM }}>{Math.round(value)}</small>
          <i style={{ display: "block", height: `${Math.max(4, (value / topDay) * 70)}px`, borderRadius: 8, background: n === trends.priciestDay ? "var(--cf-primary)" : n >= 5 ? "color-mix(in srgb, var(--cf-primary) 45%, var(--cf-surface-alt))" : "color-mix(in srgb, var(--cf-primary) 22%, var(--cf-surface-alt))" }} />
          <small style={{ fontSize: 12, fontWeight: 600 }}>{WEEKDAYS[n]}</small>
        </span>)}
      </div>
      <p style={{ margin: 0 }}>{t("Weekendul adună {share}% din cheltuieli, în 2 zile din 7.", { share: Math.round(trends.weekendShare * 100) })}</p>
    </section>

    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CATEGORIILE, LUNĂ CU LUNĂ")}</p>
      <ul style={{ display: "grid", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>
        {trends.categories.map((row) => <li key={row.name} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
          <span style={{ display: "grid", minWidth: 0 }}>
            <b style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><i aria-hidden="true" style={{ flex: "none", width: 10, height: 10, borderRadius: 3, background: categoryColor(row.name) }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(row.name)}</span></b>
            <small style={{ ...MUTED, ...NUM }}>{t("{total} în total · {avg} pe lună", { total: lei(Math.round(row.total)), avg: lei(Math.round(row.total / trends.months.length)) })}</small>
          </span>
          <Spark values={row.monthly} color={categoryColor(row.name)} label={row.trend === "up" ? t("în creștere") : row.trend === "down" ? t("în scădere") : t("stabil")} />
        </li>)}
      </ul>
    </section>

    {trends.places.length > 0 && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("MAGAZINELE DE BAZĂ")}</p>
      <ol style={{ display: "grid", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
        {trends.places.map((place, n) => <li key={place.name} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
          <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: n === 0 ? "var(--cf-primary)" : "var(--cf-surface-alt)", color: n === 0 ? "var(--cf-on-primary, #fff)" : "var(--cf-ink)", fontWeight: 700, fontSize: 13 }}>{n + 1}</span>
          <span style={{ display: "grid", minWidth: 0 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</b><small style={MUTED}>{t("{visits} vizite · bon mediu {avg}", { visits: place.visits, avg: lei(Math.round(place.average)) })}</small></span>
          <b style={NUM}>{lei(Math.round(place.total))}</b>
        </li>)}
      </ol>
    </section>}

    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("ABONAMENTE")}</p>
      <div style={ROW}><span>{t("Pe an, cu tot ce se repetă")}</span><b style={NUM}>{lei(Math.round(trends.subscriptionsYearly))}</b></div>
      {trends.forgotten.length ? <>
        <small className="bf-helper" style={{ margin: 0 }}>{t("Plăți care se repetă, dar nu sunt în scadențe. Merită verificat dacă le mai folosiți.")}</small>
        <ul style={{ display: "grid", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
          {trends.forgotten.map((item, n) => <li key={item.name} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
            <span style={{ display: "grid", minWidth: 0 }}><b style={{ display: "flex", gap: 6, alignItems: "center" }}><Repeat size={15} aria-hidden="true" />{item.name}</b><small style={MUTED}>{t("{amount} · {yearly} pe an · ultima pe {date}", { amount: lei(item.amount), yearly: lei(Math.round(item.yearly)), date: formatDate(item.lastDate, { day: "numeric", month: "short" }) })}</small></span>
            {onChange && (added.includes(item.name) ? <small style={{ color: "var(--cf-primary-strong)", fontWeight: 600 }}>{t("Urmărit")}</small> : <button type="button" className="bf-secondary" onClick={() => follow(n)} style={{ minHeight: 40 }}><Plus size={15} aria-hidden="true" /> {t("Urmărește")}</button>)}
          </li>)}
        </ul>
      </> : <small className="bf-helper" style={{ margin: 0 }}>{t("Nu am găsit plăți repetate neurmărite.")}</small>}
    </section>

    {trends.largest.length > 0 && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("CELE MAI MARI CHELTUIELI")}</p>
      {trends.largest.map((item) => <div key={`${item.date}-${item.title}-${item.amount}`} style={ROW}><span style={{ display: "grid", minWidth: 0 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</b><small style={MUTED}>{t(item.category)} · {formatDate(item.date, { day: "numeric", month: "long" })}</small></span><b style={NUM}>{lei(item.amount)}</b></div>)}
    </section>}
  </div>;
}
