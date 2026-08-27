/**
 * Ledger Flow — recapitulare săptămânală verticală pentru telefon, calculată numai din registrul local real.
 * Fiecare sumă are propria zonă de lectură; nu folosim o grilă îngustă care concurează cu textul.
 */
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronRight } from "lucide-react";
import { formatDate, weeklySummary, type AppData } from "@/lib/finance-data";

const money = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });

export function WeeklySummaryPanel({ data, onOpenJournal }: { data: AppData; onOpenJournal: () => void }) {
  const collaborative = data.settings.members.length > 1;
  const [scope, setScope] = useState("family");
  const member = data.settings.members.find((item) => item.id === scope);
  const summary = weeklySummary(data, undefined, member?.id);
  const label = member ? member.name : collaborative ? "Familie" : "Personal";
  const range = `${formatDate(summary.start, { day: "2-digit", month: "short" })} – ${formatDate(summary.end, { day: "2-digit", month: "short" })}`;
  return <section className="bf-weekly-summary" aria-label={`Recapitularea săptămânii pentru ${label}`}>
    <div className="bf-weekly-summary-heading"><div><p className="bf-kicker">SĂPTĂMÂNA CURENTĂ · {label.toUpperCase()}</p><h2>Ultimele șapte zile</h2><span className="bf-weekly-range"><CalendarDays size={14} /> {range}</span></div><button onClick={onOpenJournal}>Jurnal <ChevronRight size={15} /></button></div>
    {collaborative && <div className="bf-weekly-scope" role="group" aria-label="Perspectiva recapitulării săptămânale"><button className={scope === "family" ? "active" : ""} onClick={() => setScope("family")}>Familie</button>{data.settings.members.map((item) => <button key={item.id} className={scope === item.id ? "active" : ""} onClick={() => setScope(item.id)}>{item.name}</button>)}</div>}
    <div className="bf-weekly-summary-values"><article className="income"><span><ArrowDownRight size={17} /></span><div><small>Venituri înregistrate</small><b>{money.format(summary.income)}</b></div></article><article className="expense"><span><ArrowUpRight size={17} /></span><div><small>Cheltuieli înregistrate</small><b>{money.format(summary.expense)}</b></div></article><article className={`balance ${summary.cashflow < 0 ? "negative" : ""}`}><div><small>Diferență săptămânală</small><b>{summary.cashflow >= 0 ? "+" : "−"}{money.format(Math.abs(summary.cashflow))}</b></div><em>{summary.transactionCount} mișcări</em></article></div>
    {summary.categories.length ? <div className="bf-weekly-categories">{summary.categories.map(([category, amount], index) => <article key={category}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{category}</b><small>categorie urmărită săptămânal</small></div><strong>{money.format(amount)}</strong></article>)}</div> : <p className="bf-weekly-empty">Nu există încă mișcări în această săptămână pentru perspectiva aleasă.</p>}
  </section>;
}
