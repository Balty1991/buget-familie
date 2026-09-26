/**
 * Graficul plicului pe ciclu: linia ideală (de la limită la zero până la salariu), linia reală
 * și, punctat, unde duce ritmul de până acum. Un singur SVG, fără bibliotecă.
 */
import type { EnvelopeBurndown } from "@/lib/household-insights";
import { formatDate } from "@/lib/finance-data";
import { t } from "@/lib/i18n";

const W = 300;
const H = 96;
const PAD = 6;

export function EnvelopeBurndownChart({ chart }: { chart: EnvelopeBurndown }) {
  const top = Math.max(chart.budget, ...chart.actual);
  const bottom = Math.min(0, ...chart.actual);
  const x = (index: number) => PAD + (index / Math.max(1, chart.days - 1)) * (W - PAD * 2);
  const y = (value: number) => PAD + ((top - value) / Math.max(1, top - bottom)) * (H - PAD * 2);
  const actual = chart.actual.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const last = chart.actual[chart.actual.length - 1] ?? chart.budget;
  const projectionEnd = chart.runOutIndex !== undefined ? { i: chart.runOutIndex, v: 0 } : { i: chart.days - 1, v: Math.max(0, last - (chart.budget - last) / Math.max(1, chart.todayIndex + 1) * (chart.days - 1 - chart.todayIndex)) };
  const runOutDay = chart.runOutIndex !== undefined && chart.runOutIndex < chart.days - 1
    ? formatDate(new Date(Date.parse(`${chart.start}T12:00:00Z`) + chart.runOutIndex * 86_400_000).toISOString().slice(0, 10), { day: "numeric", month: "long" })
    : "";
  return (
    <figure className="bf-burndown">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={runOutDay ? t("La ritmul de acum, plicul se golește pe {date}, înainte de salariu.", { date: runOutDay }) : t("La ritmul de acum, plicul ajunge până la salariu.")}>
        <line className="bf-burndown-zero" x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} />
        <line className="bf-burndown-ideal" x1={x(0)} y1={y(chart.budget)} x2={x(chart.days - 1)} y2={y(0)} />
        <line className="bf-burndown-projection" x1={x(chart.todayIndex)} y1={y(last)} x2={x(projectionEnd.i)} y2={y(projectionEnd.v)} />
        <polyline className={`bf-burndown-actual${last < 0 ? " is-over" : ""}`} points={actual} />
        <circle className="bf-burndown-today" cx={x(chart.todayIndex)} cy={y(last)} r={3.5} />
      </svg>
      <figcaption>
        <span><i className="ideal" aria-hidden="true" /> {t("ideal până la salariu")}</span>
        <span><i className="actual" aria-hidden="true" /> {t("real")}</span>
        <span><i className="projection" aria-hidden="true" /> {runOutDay ? t("se golește pe {date}", { date: runOutDay }) : t("ajunge")}</span>
      </figcaption>
    </figure>
  );
}
