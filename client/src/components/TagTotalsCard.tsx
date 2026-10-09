/** Analiză: cât s-a cheltuit pe fiecare etichetă (Serviciu, Copil…) în luna de salariu, față de cea dinainte. */
import { useMemo } from "react";
import { addIsoDays, formatDate, isoToday, type AppData } from "@/lib/finance-data";
import { tagTotals } from "@/lib/tags";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function TagTotalsCard({ data }: { data: AppData }) {
  const today = isoToday();
  const start = data.settings.salaryPlan.periodStart && data.settings.salaryPlan.periodStart <= today ? data.settings.salaryPlan.periodStart : addIsoDays(today, -29);
  const days = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1;
  const rows = useMemo(() => tagTotals(data, start, today), [data, start, today]);
  const before = useMemo(() => new Map(tagTotals(data, addIsoDays(start, -days), addIsoDays(start, -1)).map((row) => [row.tag, row.total])), [data, start, days]);
  if (!rows.length) return null;
  return (
    <section className="bf-month-vs-average" aria-labelledby="bf-tags-title">
      <p className="bf-kicker" id="bf-tags-title">{t("PE ETICHETE")}</p>
      <p className="bf-mva-note">{t("De la {date} încoace. Eticheta o pui la notare, la „Pentru”.", { date: formatDate(start, { day: "numeric", month: "long" }) })}</p>
      <ul>
        {rows.map((row) => {
          const prev = before.get(row.tag);
          return (
            <li key={row.tag}>
              <span className="bf-mva-label">
                <b>{t(row.tag)} · {lei(row.total)}</b>
                <small>{[
                  row.count === 1 ? t("o cheltuială") : t("{count} cheltuieli", { count: row.count }),
                  row.categories.slice(0, 3).map(([name, amount]) => `${t(name)} ${lei(amount)}`).join(", "),
                  prev != null ? t("în aceleași zile de dinainte: {amount}", { amount: lei(prev) }) : "",
                ].filter(Boolean).join(" · ")}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
