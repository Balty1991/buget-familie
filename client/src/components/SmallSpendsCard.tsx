/** Analiză: sumele mici care se repetă, cu cât fac pe un an. Apare doar dacă există așa ceva. */
import { useMemo } from "react";
import { isoToday, type AppData } from "@/lib/finance-data";
import { smallSpends } from "@/lib/small-spends";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function SmallSpendsCard({ data }: { data: AppData }) {
  const { rows, yearly } = useMemo(() => smallSpends(data.transactions, isoToday()), [data.transactions]);
  if (!rows.length) return null;
  const goal = data.savings.find((item) => item.current < item.target);
  const half = Math.round(yearly / 2);
  return (
    <section className="bf-month-vs-average bf-small-spends" aria-labelledby="bf-small-title">
      <p className="bf-kicker" id="bf-small-title">{t("BANII MĂRUNȚI")}</p>
      <p className="bf-mva-note">{t("Sumele mici care se repetă, din ultimele 30 de zile.")}</p>
      <ul>
        {rows.map((row) => <li key={row.key}><span className="bf-mva-label"><b>{row.label}</b><small>{t("{count} × ~{avg} = {total}", { count: row.count, avg: lei(row.average), total: lei(row.total) })}</small></span></li>)}
      </ul>
      <p className="bf-mva-note">{goal ? t("Pe un an fac ~{yearly}. Jumătate ar însemna {half} pentru „{goal}”.", { yearly: lei(yearly), half: lei(half), goal: goal.name }) : t("Pe un an fac ~{yearly}. Jumătate ar însemna {half} puși deoparte.", { yearly: lei(yearly), half: lei(half) })}</p>
    </section>
  );
}
