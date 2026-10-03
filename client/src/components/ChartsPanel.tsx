/**
 * Atelierul de grafice (Mai mult → Planificare): fluxul banilor pe perioada aleasă, categoriile
 * ca dreptunghiuri, lunile anului cu venitul peste cheltuieli, ritmul lunii față de luna trecută
 * și harta anului. Toate graficele se pot „citi cu degetul”.
 */
import { useMemo, useState } from "react";
import { addIsoDays, isBalanceAdjustment, isoToday, type AppData } from "@/lib/finance-data";
import { moneyFlow, yearHeat } from "@/lib/chart-data";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { MoneyFlowChart, ScrubChart, Treemap, YearHeatmap, type ChartPoint } from "@/components/charts";
import { CARD, CountLei, Hero, MUTED, Segmented } from "@/components/plan-ui";

type Range = "month" | "prev" | "quarter" | "year";
const shift = (key: string, offset: number) => { const date = new Date(`${key.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7); };
const monthEnd = (key: string) => { const date = new Date(`${key}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1, 0); return date.toISOString().slice(0, 10); };
const monthShort = (key: string) => new Intl.DateTimeFormat(getLocale(), { month: "short" }).format(new Date(`${key}-15T12:00:00Z`)).replace(".", "");
const monthLong = (key: string) => new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(new Date(`${key}-15T12:00:00Z`));

export function ChartsPanel({ data }: { data: AppData }) {
  const today = isoToday();
  const thisMonth = today.slice(0, 7);
  const [range, setRange] = useState<Range>("month");
  const [start, end] = range === "month" ? [`${thisMonth}-01`, today] : range === "prev" ? [`${shift(thisMonth, -1)}-01`, monthEnd(shift(thisMonth, -1))] : range === "quarter" ? [`${shift(thisMonth, -2)}-01`, today] : [addIsoDays(today, -364), today];
  const labels = useMemo(() => ({ other: t("Altele"), kept: t("Rămas"), savings: t("Din economii") }), []);
  const flow = useMemo(() => moneyFlow(data, start, end, labels), [data, start, end, labels]);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data.transactions) if (item.kind === "expense" && !item.transferId && !isBalanceAdjustment(item) && item.date >= start && item.date <= end) map.set(item.category, (map.get(item.category) || 0) + item.amount);
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
  }, [data.transactions, start, end]);
  const months = useMemo<ChartPoint[]>(() => {
    const out: ChartPoint[] = [];
    for (let k = 11; k >= 0; k -= 1) {
      const key = shift(thisMonth, -k);
      let spent = 0, income = 0;
      for (const item of data.transactions) {
        if (!item.date.startsWith(key) || item.transferId || isBalanceAdjustment(item)) continue;
        if (item.kind === "expense") spent += item.amount; else if (item.kind === "income") income += item.amount;
      }
      out.push({ label: monthShort(key), long: monthLong(key), value: Math.round(spent), ref: Math.round(income) });
    }
    // Lunile de dinainte de prima notare nu spun nimic: le tăiem din față.
    const first = out.findIndex((p) => p.value > 0 || (p.ref || 0) > 0);
    return first > 0 ? out.slice(first) : out;
  }, [data.transactions, thisMonth]);
  // În primele zile ale lunii nu e ce compara: arătăm luna trecută, întreagă, față de cea dinainte.
  const paceMonth = Number(today.slice(8)) < 7 ? shift(thisMonth, -1) : thisMonth;
  const pace = useMemo<ChartPoint[]>(() => {
    const prev = shift(paceMonth, -1);
    const days = Number(monthEnd(paceMonth).slice(8));
    const daily = (key: string) => { const sums = new Array(32).fill(0); for (const item of data.transactions) if (item.kind === "expense" && !item.transferId && !isBalanceAdjustment(item) && item.date.startsWith(key)) sums[Number(item.date.slice(8))] += item.amount; return sums; };
    const now = daily(paceMonth), before = daily(prev);
    const todayDay = paceMonth === thisMonth ? Number(today.slice(8)) : days;
    let a = 0, b = 0;
    const out: ChartPoint[] = [];
    for (let d = 1; d <= Math.min(days, todayDay); d += 1) { a += now[d]; b += before[d]; out.push({ label: String(d), long: t("ziua {day}", { day: d }), value: Math.round(a), ref: Math.round(b) }); }
    return out;
  }, [data.transactions, paceMonth, thisMonth, today]);
  const heat = useMemo(() => yearHeat(data, today), [data, today]);
  const paceDiff = pace.length ? (pace[pace.length - 1].value - (pace[pace.length - 1].ref || 0)) : 0;

  return <div style={{ display: "grid", gap: 14 }}>
    <Segmented label={t("Perioada")} value={range} onChange={setRange} options={[["month", t("Luna asta")], ["prev", t("Trecută")], ["quarter", t("3 luni")], ["year", t("12 luni")]]} />
    <Hero kicker={t("FLUXUL BANILOR")} value={<CountLei value={flow.total} />} sub={flow.fromSavings > 0 ? t("au circulat; {amount} au venit din economii", { amount: lei(Math.round(flow.fromSavings)) }) : flow.kept > 0 ? t("au circulat; {amount} au rămas ({share}%)", { amount: lei(Math.round(flow.kept)), share: Math.round((flow.kept / Math.max(1, flow.total)) * 100) }) : t("au circulat în perioada aleasă")} />
    {flow.total > 0 ? <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("DE UNDE VIN, UNDE SE DUC")}</p>
      <MoneyFlowChart flow={flow} keptName={labels.kept} savingsName={labels.savings} />
    </section> : <section className="bf-scenario-card" style={CARD}><p className="bf-helper" style={{ margin: 0 }}>{t("Nimic notat în perioada aleasă.")}</p></section>}
    {categories.length > 0 && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("PE CATEGORII")}</p>
      <Treemap items={categories} />
    </section>}
    {months.length > 1 && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("LUNĂ CU LUNĂ")}</p>
      <small style={MUTED}>{t("Barele: cheltuieli. Linia punctată: venituri.")}</small>
      <ScrubChart points={months} label={t("Cheltuielile și veniturile pe luni")} refLabel={t("venituri")} />
    </section>}
    {pace.length > 1 && <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{paceMonth === thisMonth ? t("RITMUL LUNII") : t("RITMUL LUNII TRECUTE")}</p>
      <div role="heading" aria-level={3} style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: paceDiff > 0 ? "var(--cf-danger)" : "var(--cf-primary-strong)" }}>{paceMonth !== thisMonth ? (paceDiff > 0 ? t("{month}: cu {amount} peste luna dinainte", { month: monthLong(paceMonth), amount: lei(Math.round(paceDiff)) }) : t("{month}: cu {amount} sub luna dinainte", { month: monthLong(paceMonth), amount: lei(Math.round(-paceDiff)) })) : paceDiff > 0 ? t("Cu {amount} peste luna trecută, la aceeași dată", { amount: lei(Math.round(paceDiff)) }) : t("Cu {amount} sub luna trecută, la aceeași dată", { amount: lei(Math.round(-paceDiff)) })}</div>
      <ScrubChart kind="line" points={pace} label={t("Cheltuit de la începutul lunii, zi cu zi")} refLabel={paceMonth === thisMonth ? t("luna trecută") : t("luna dinainte")} />
      <small style={MUTED}>{paceMonth === thisMonth ? t("Linia plină: luna asta. Linia punctată: luna trecută.") : t("Linia plină: luna trecută. Linia punctată: luna dinainte.")}</small>
    </section>}
    <section className="bf-scenario-card" style={CARD}>
      <p className="bf-kicker">{t("HARTA ANULUI")}</p>
      <small style={MUTED}>{t("{days} zile cu cheltuieli în ultimul an · {amount}", { days: heat.activeDays, amount: lei(Math.round(heat.total)) })}</small>
      <YearHeatmap heat={heat} />
    </section>
  </div>;
}
