/** Luna aceasta față de media ultimelor luni, pe categorii: bară pentru acum, linie pentru medie. */
import { monthVsAverage } from "@/lib/household-insights";
import type { AppData } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

export function MonthVsAverage({ data }: { data: AppData }) {
  const { rows, months } = monthVsAverage(data);
  if (!rows.length) return null;
  const top = Math.max(1, ...rows.flatMap((row) => [row.thisMonth, row.average]));
  return (
    <section className="bf-month-vs-average" aria-labelledby="bf-mva-title">
      <p className="bf-kicker" id="bf-mva-title">{t("LUNA ACEASTA FAȚĂ DE MEDIE")}</p>
      <p className="bf-mva-note">{t("Media ultimelor {count} luni, socotită până în aceeași zi a lunii.", { count: months })}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.category}>
            <span className="bf-mva-label"><b>{t(row.category)}</b><small className={row.delta > 0 ? "up" : "down"}>{row.delta > 0 ? "+" : row.delta < 0 ? "−" : ""}{lei(Math.abs(row.delta))}</small></span>
            <span className="bf-mva-bar" aria-label={t("{now} acum, media {avg}", { now: lei(row.thisMonth), avg: lei(row.average) })}>
              <i style={{ width: `${Math.round(row.thisMonth / top * 100)}%` }} className={row.delta > 0 ? "up" : ""} />
              <em style={{ left: `${Math.round(row.average / top * 100)}%` }} aria-hidden="true" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
