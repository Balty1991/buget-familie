import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { type AllocationHistoryEntry } from "@/lib/finance-data";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const monthLabel = (key: string) => new Intl.DateTimeFormat("ro-RO", { month: "short" }).format(new Date(`${key}-01T12:00:00`)).replace(".", "");
const monthKey = (value: string) => value.slice(0, 7);
const monthSequence = (endKey: string, count: number) => {
  const end = new Date(`${endKey}-01T12:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setMonth(end.getMonth() - (count - index - 1));
    return date.toISOString().slice(0, 7);
  });
};

const eventDelta = (entry: AllocationHistoryEntry) => {
  if (entry.kind === "created" || entry.kind === "income-applied") return entry.amount || 0;
  if (entry.kind === "deleted" || entry.kind === "income-reverted") return -(entry.amount || entry.previousAmount || 0);
  if (entry.kind === "updated") return entry.previousAmount !== undefined && entry.newAmount !== undefined ? entry.newAmount - entry.previousAmount : entry.amount || 0;
  if (entry.kind === "envelope-transfer") return entry.amount || 0;
  return 0;
};

const eventSeries = (entry: AllocationHistoryEntry) => {
  if (entry.kind === "envelope-transfer") return entry.toAllocationLabel || entry.toAllocationId || "Realocări";
  return entry.allocationLabel || entry.incomeTitle || "Alte repartizări";
};

export function AllocationHistoryChart({ entries, allocationFilter }: { entries: AllocationHistoryEntry[]; allocationFilter?: string }) {
  const chart = useMemo(() => {
    const relevant = entries.filter((entry) => {
      if (!allocationFilter) return true;
      return [entry.allocationId, entry.fromAllocationId, entry.toAllocationId].includes(allocationFilter);
    }).filter((entry) => entry.kind !== "week-transfer");
    if (!relevant.length) return undefined;
    const lastEntryMonth = relevant.reduce((latest, entry) => entry.createdAt.slice(0, 7) > latest ? entry.createdAt.slice(0, 7) : latest, new Date().toISOString().slice(0, 7));
    const months = monthSequence(lastEntryMonth, 12);
    const labels = Array.from(new Set(relevant.map(eventSeries))).filter(Boolean);
    const ranked = labels.map((label) => ({ label, total: relevant.filter((entry) => eventSeries(entry) === label).reduce((sum, entry) => sum + Math.abs(eventDelta(entry)), 0) })).sort((left, right) => right.total - left.total);
    const visibleLabels = ranked.slice(0, 5).map((item) => item.label);
    const values = visibleLabels.map((label) => months.map((month) => relevant.filter((entry) => eventSeries(entry) === label && monthKey(entry.createdAt) === month).reduce((sum, entry) => sum + eventDelta(entry), 0)));
    const maxAbs = Math.max(1, ...values.flat().map((value) => Math.abs(value)));
    return { months, visibleLabels, values, maxAbs, total: relevant.reduce((sum, entry) => sum + eventDelta(entry), 0), omitted: Math.max(0, labels.length - visibleLabels.length) };
  }, [allocationFilter, entries]);
  if (!chart) return <div className="bf-allocation-chart-empty"><TrendingUp size={20} /><strong>Graficul va apărea după prima repartizare</strong><p>Înregistrările noi vor fi grupate lunar și comparate pe plicuri.</p></div>;
  const width = 720; const height = 250; const left = 48; const right = 18; const top = 24; const bottom = 38; const plotWidth = width - left - right; const plotHeight = height - top - bottom; const zeroY = top + plotHeight / 2;
  const x = (index: number) => left + (index / Math.max(1, chart.months.length - 1)) * plotWidth;
  const y = (value: number) => zeroY - (value / chart.maxAbs) * (plotHeight / 2 - 8);
  const colors = ["var(--cf-primary-strong)", "var(--cf-warning)", "var(--cf-danger)", "var(--cf-info)", "var(--cf-muted)"];
  const pointsFor = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const lastMonthTotal = chart.values.reduce((sum, values) => sum + (values[values.length - 1] || 0), 0);
  return <div className="bf-allocation-chart"><div className="bf-allocation-chart-summary"><div><p className="bf-kicker">EVOLUȚIE LUNARĂ</p><h3>Repartizări pe plicuri</h3><p>Modificarea netă a sumelor repartizate în fiecare lună. Valorile negative indică reduceri sau anulări.</p></div><strong>{money(lastMonthTotal)}<small>luna afișată</small></strong></div><div className="bf-allocation-chart-canvas"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Evoluția lunară a repartizărilor pentru ${chart.visibleLabels.join(", ")}`}><line x1={left} x2={width - right} y1={zeroY} y2={zeroY} className="bf-chart-zero" />{[-1, -0.5, 0.5, 1].map((factor) => <line key={factor} x1={left} x2={width - right} y1={zeroY - factor * (plotHeight / 2 - 8)} y2={zeroY - factor * (plotHeight / 2 - 8)} className="bf-chart-grid" />)}<text x={left - 8} y={top + 6} textAnchor="end">{money(chart.maxAbs)}</text><text x={left - 8} y={zeroY + 4} textAnchor="end">0</text><text x={left - 8} y={height - bottom + 2} textAnchor="end">-{money(chart.maxAbs)}</text>{chart.visibleLabels.map((label, seriesIndex) => <g key={label}><polyline points={pointsFor(chart.values[seriesIndex])} fill="none" stroke={colors[seriesIndex]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{chart.values[seriesIndex].map((value, index) => <circle key={`${label}-${chart.months[index]}`} cx={x(index)} cy={y(value)} r="3.5" fill={colors[seriesIndex]}><title>{`${label}, ${monthLabel(chart.months[index])}: ${money(value)}`}</title></circle>)}</g>)}{chart.months.map((month, index) => <text key={month} x={x(index)} y={height - 11} textAnchor="middle">{monthLabel(month)}</text>)}</svg></div><div className="bf-allocation-chart-legend">{chart.visibleLabels.map((label, index) => <span key={label}><i style={{ backgroundColor: colors[index] }} />{label}</span>)}{chart.omitted > 0 && <small>+{chart.omitted} alte categorii în total</small>}</div><p className="bf-allocation-chart-footnote">Total net pe cele 12 luni: <b>{money(chart.total)}</b>. Graficul folosește doar repartizările care au fost jurnalizate; nu reconstruiește modificări vechi care nu aveau istoric.</p></div>;
}
