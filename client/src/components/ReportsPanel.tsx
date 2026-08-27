/**
 * Atelierul Financiar — Analiză istorică calculată exclusiv din registrul local real.
 * Graficul de distribuție este o hartă de decizie: categorie, valoare și pondere rămân accesibile și verificabile.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Download, Landmark, PiggyBank, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { allocationStatus, categoryColors, financialBalance, type AppData } from "@/lib/finance-data";
import { downloadMonthlyBalancePdf } from "@/lib/monthly-balance-pdf";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const months = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];
const monthRange = (month: string) => { const [year, index] = month.split("-").map(Number); const start = `${year}-${String(index).padStart(2, "0")}-01`; const end = new Date(year, index, 0).toISOString().slice(0, 10); return { start, end }; };
const previousMonth = (month: string) => { const [year, index] = month.split("-").map(Number); const date = new Date(year, index - 2, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const titleFor = (month: string) => { const [year, index] = month.split("-").map(Number); return new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(new Date(year, index - 1, 1)); };

export function ReportsPanel({ data }: { data: AppData }) {
  const year = new Date().getFullYear();
  const currentMonth = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [scope, setScope] = useState("family");
  const [focusMonth, setFocusMonth] = useState(currentMonth);
  const [exporting, setExporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const isCollaborative = data.settings.members.length > 1;
  const selectedMember = data.settings.members.find((member) => member.id === scope);
  const perspective = selectedMember?.name || (isCollaborative ? "Familie" : "Personal");
  const memberId = selectedMember?.id;
  const scopedTransactions = useMemo(() => data.transactions.filter((item) => !memberId || item.memberId === memberId), [data.transactions, memberId]);
  const range = monthRange(focusMonth);
  const priorRange = monthRange(previousMonth(focusMonth));
  const selected = scopedTransactions.filter((item) => item.date >= range.start && item.date <= range.end);
  const previous = scopedTransactions.filter((item) => item.date >= priorRange.start && item.date <= priorRange.end);
  const summarize = (entries: typeof selected) => ({ income: entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0), expense: entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0) });
  const current = summarize(selected);
  const prior = summarize(previous);
  const currentFlow = current.income - current.expense;
  const priorFlow = prior.income - prior.expense;
  const balance = financialBalance(data, range.start, range.end, memberId);
  const totalBalance = financialBalance(data, undefined, undefined, memberId);
  const monthly = months.map((label, index) => { const prefix = `${year}-${String(index + 1).padStart(2, "0")}`; const summary = summarize(scopedTransactions.filter((item) => item.date.startsWith(prefix))); return { label, ...summary, flow: summary.income - summary.expense, isFocus: prefix === focusMonth }; });
  const maxMonthly = Math.max(1, ...monthly.flatMap((item) => [item.income, item.expense]));
  const categories = Object.entries(selected.filter((item) => item.kind === "expense").reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categories.map(([, value]) => value));
  const categoryTotal = categories.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  const categorySlices = categories.map(([name, value]) => { const share = categoryTotal ? value / categoryTotal * 100 : 0; const start = cursor; cursor += share; return { name, value, share, start, end: cursor, color: categoryColors[name] || "#73847b" }; });
  const categoryGradient = categorySlices.length ? `conic-gradient(${categorySlices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(", ")})` : "conic-gradient(var(--cf-line) 0 100%)";
  const activeCategory = categorySlices.find((slice) => slice.name === selectedCategory) || categorySlices[0];
  const alerts = data.settings.salaryPlan.allocations.map((item) => ({ item, ...allocationStatus(data, item) })).filter((entry) => entry.state !== "healthy" && (!memberId || entry.item.memberId === memberId));
  const change = (value: number, base: number) => base === 0 ? (value === 0 ? "fără mișcări comparabile" : "prima lună cu date") : `${value >= 0 ? "+" : ""}${money(value)} față de luna anterioară`;
  const exportPdf = async () => { setExporting(true); try { await downloadMonthlyBalancePdf(data, focusMonth, memberId); } finally { setExporting(false); } };

  return <div className="bf-analysis">
    <section className="bf-analysis-control"><div><p className="bf-kicker">CITEȘTE LUNA</p><h2>{titleFor(focusMonth)}</h2><p>Perspectivele și valorile se calculează din mișcările înregistrate, nu dintr-un extras bancar.</p></div><label>Luna analizată<input type="month" value={focusMonth} onChange={(event) => setFocusMonth(event.target.value)} /></label></section>
    {isCollaborative && <div className="bf-analysis-scope" role="group" aria-label="Perspectiva analizei"><button className={scope === "family" ? "active" : ""} onClick={() => setScope("family")}>Familie</button>{data.settings.members.map((member) => <button key={member.id} className={scope === member.id ? "active" : ""} onClick={() => setScope(member.id)}>{member.name}</button>)}</div>}
    <section className="bf-analysis-month"><div className="bf-analysis-month-heading"><div><p className="bf-kicker">REZULTATUL LUNII · {perspective.toUpperCase()}</p><h2>{currentFlow < 0 ? "Au ieșit mai mulți bani decât au intrat." : "Luna rămâne în echilibru."}</h2></div><span className={currentFlow < 0 ? "negative" : ""}>{money(currentFlow)}</span></div><div className="bf-analysis-flow"><article><span className="income"><ArrowDownRight size={16} /></span><div><small>Venituri</small><b>{money(current.income)}</b><em>{change(current.income - prior.income, prior.income)}</em></div></article><article><span className="expense"><ArrowUpRight size={16} /></span><div><small>Cheltuieli</small><b>{money(current.expense)}</b><em>{change(current.expense - prior.expense, prior.expense)}</em></div></article><article><span className="balance"><WalletCards size={16} /></span><div><small>Bilanț înregistrat</small><b>{money(balance.cashflow)}</b><em>{change(currentFlow - priorFlow, priorFlow)}</em></div></article></div></section>
    <section className="bf-analysis-year"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">ANUL CURENT · {year}</p><h2>Ritm lună cu lună</h2></div><span>atinge o lună pentru analiză</span></div><div className="bf-analysis-chart" aria-label={`Evoluția lunară pentru ${year}`}>{monthly.map((item, index) => <button key={item.label} className={item.isFocus ? "active" : ""} onClick={() => { setFocusMonth(`${year}-${String(index + 1).padStart(2, "0")}`); setSelectedCategory(""); }} aria-label={`${item.label}: venituri ${money(item.income)}, cheltuieli ${money(item.expense)}`}><span><i className="income" style={{ height: `${Math.max(3, item.income / maxMonthly * 100)}%` }} /><i className="expense" style={{ height: `${Math.max(3, item.expense / maxMonthly * 100)}%` }} /></span><b>{item.label}</b></button>)}</div><div className="bf-analysis-legend"><span><i className="income" /> Venituri</span><span><i className="expense" /> Cheltuieli</span><strong>Ritm anual: {money(monthly.reduce((sum, item) => sum + item.flow, 0))}</strong></div></section>
    <section className="bf-spend-compass"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">DISTRIBUȚIE INTERACTIVĂ</p><h2>Unde au mers banii</h2></div><TrendingDown size={19} /></div>{categorySlices.length ? <><div className="bf-spend-compass-layout"><div className="bf-spend-donut" style={{ background: categoryGradient }} role="img" aria-label={`Distribuția cheltuielilor: ${categorySlices.map((slice) => `${slice.name} ${Math.round(slice.share)}%`).join(", ")}`}><div><small>CHELTUIELI</small><b>{money(categoryTotal)}</b><span>{titleFor(focusMonth)}</span></div></div><div className="bf-spend-category-pills" role="list" aria-label="Categorii de cheltuieli">{categorySlices.map((slice) => <button key={slice.name} role="listitem" className={activeCategory?.name === slice.name ? "active" : ""} onClick={() => setSelectedCategory(slice.name)}><i style={{ backgroundColor: slice.color }} /><span><b>{slice.name}</b><small>{Math.round(slice.share)}% · {money(slice.value)}</small></span></button>)}</div></div>{activeCategory && <article className="bf-spend-focus" style={{ borderLeftColor: activeCategory.color }}><span style={{ backgroundColor: activeCategory.color }} /><div><small>CATEGORIA SELECTATĂ</small><b>{activeCategory.name}</b><p>{money(activeCategory.value)} · {Math.round(activeCategory.share)}% din cheltuielile acestei luni.</p></div></article>}<div className="bf-analysis-category-rows">{categories.map(([name, value]) => <button key={name} className={activeCategory?.name === name ? "active" : ""} onClick={() => setSelectedCategory(name)}><span>{name}</span><b>{money(value)}</b><i><em style={{ width: `${value / maxCategory * 100}%`, background: categoryColors[name] || "#73847b" }} /></i></button>)}</div></> : <p className="bf-analysis-empty">Nu există cheltuieli în această lună pentru perspectiva aleasă.</p>}</section>
    <section className="bf-analysis-watch"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">PLICURI CARE CER ATENȚIE</p><h2>Limite de revizuit</h2></div><AlertTriangle size={19} /></div>{alerts.length ? <div>{alerts.map((entry) => <article className={entry.state} key={entry.item.id}><span><AlertTriangle size={17} /></span><div><b>{entry.item.label}</b><small>{entry.state === "over" ? `${money(Math.abs(entry.remaining))} peste limită` : `${Math.round(entry.usage * 100)}% consumat · ${money(Math.max(0, entry.remaining))} rămași`}</small></div><strong>{money(entry.budget)}</strong></article>)}</div> : <p className="bf-analysis-empty">Nu există plicuri aproape sau peste limită în perspectiva aleasă.</p>}</section>
    <section className="bf-analysis-balance"><div><p className="bf-kicker">POZIȚIE LA MOMENTUL GENERĂRII</p><h2>Solduri, datorii și economii</h2><p>Poziția de mai jos este curentă; fluxul lunar de sus rămâne filtrat la luna aleasă.</p></div><div><article><WalletCards size={17} /><span><small>Poziție lichidă netă</small><b className={totalBalance.netLiquidPosition < 0 ? "negative" : ""}>{money(totalBalance.netLiquidPosition)}</b></span></article><article><Landmark size={17} /><span><small>Datorii rămase</small><b>{money(totalBalance.debtRemaining)}</b></span></article><article><PiggyBank size={17} /><span><small>Economii urmărite</small><b>{money(totalBalance.savingsCurrent)}</b></span></article></div><button disabled={exporting} onClick={exportPdf}><Download size={17} /> {exporting ? "Generăm PDF-ul…" : `Descarcă PDF · ${titleFor(focusMonth)}`}</button></section>
  </div>;
}
