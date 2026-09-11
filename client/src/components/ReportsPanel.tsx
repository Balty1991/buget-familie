/**
 * Atelierul Financiar — Analiză istorică calculată exclusiv din registrul local real.
 * Graficul de distribuție este o hartă de decizie: categorie, valoare și pondere rămân accesibile și verificabile.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Download, Landmark, PiggyBank, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { allocationStatus, categoryColors, financialBalance, formatDate, isoDate, type AppData } from "@/lib/finance-data";
import { downloadMonthlyBalancePdf } from "@/lib/monthly-balance-pdf";
import type { MainView } from "@/pages/home-kit";
import { getLocale, t } from "@/lib/i18n";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
const months = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];
/** `toISOString()` pe o dată locală de miezul nopții pierdea ultima zi a lunii în România (UTC+2/+3). */
const monthRange = (month: string) => { const [year, index] = month.split("-").map(Number); const start = `${year}-${String(index).padStart(2, "0")}-01`; const end = isoDate(new Date(year, index, 0)); return { start, end }; };
const previousMonth = (month: string) => { const [year, index] = month.split("-").map(Number); const date = new Date(year, index - 2, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const titleFor = (month: string) => { const [year, index] = month.split("-").map(Number); return new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(new Date(year, index - 1, 1)); };

export function ReportsPanel({ data, onGo }: { data: AppData; onGo?: (view: MainView) => void }) {
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
  const change = (value: number, base: number) => base === 0 ? (value === 0 ? t("fără mișcări comparabile") : t("prima lună cu date")) : t("{change} față de luna anterioară", { change: `${value >= 0 ? "+" : ""}${money(value)}` });
  /**
   * Aplicația este construită pe cicluri de salariu, dar acest ecran compară luni
   * calendaristice. O casă plătită pe 25 avea deci „cheltuielile au depășit veniturile”
   * de la 1 până la 24 în fiecare lună — o alarmă falsă prin construcție. Când în luna
   * aleasă nu a intrat niciun venit, dar planul spune că salariul vine mai târziu,
   * spunem asta în loc să dăm alarma.
   */
  const plannedPayday = data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday;
  const awaitingIncome = current.income === 0 && current.expense > 0 && Boolean(plannedPayday) && plannedPayday! >= range.start && plannedPayday! <= range.end;

  const snapshot = !selected.length && !previous.length
    ? { tone: "empty", eyebrow: "PUNCT DE PLECARE", title: t("Începe cu prima mișcare."), detail: t("După câteva înregistrări, aici vei vedea ce s-a schimbat și ce merită urmărit.") }
    : !selected.length
      ? { tone: "empty", eyebrow: t("LUNA ALEASĂ"), title: t("Nu există mișcări în această lună."), detail: t("Poți alege o altă lună din ritmul anual sau poți înregistra prima mișcare.") }
      : alerts.some((entry) => entry.state === "over")
        ? { tone: "risk", eyebrow: t("DECIZIE NECESARĂ"), title: t("Un plic a trecut peste limită."), detail: `${alerts.filter((entry) => entry.state === "over").length} ${alerts.filter((entry) => entry.state === "over").length === 1 ? "limită cere" : "limite cer"} o revizuire înainte de următoarea plată.` }
        : awaitingIncome
          ? { tone: "empty", eyebrow: t("VENIT ÎNCĂ NEÎNREGISTRAT"), title: t("Salariul lunii nu a intrat încă."), detail: t("În luna aleasă sunt {expense} în cheltuieli și niciun venit — următorul venit este așteptat pe {date}, iar comparația devine corectă după ce intră banii.", { expense: money(current.expense), date: formatDate(plannedPayday || "") }) }
        : currentFlow < 0
          ? { tone: "watch", eyebrow: t("RITM DE URMĂRIT"), title: t("Cheltuielile au depășit veniturile."), detail: `${selected.length} ${selected.length === 1 ? "mișcare este" : "mișcări sunt"} înregistrate; verifică distribuția pe categorii înainte de a ajusta planul.` }
          : { tone: "good", eyebrow: t("SITUAȚIE LUNARĂ"), title: t("Luna rămâne pe plus."), detail: `${selected.length} ${selected.length === 1 ? "mișcare" : "mișcări"} și ${categories.length} ${categories.length === 1 ? "categorie urmărită" : "categorii urmărite"}; folosește comparația pentru următorul pas.` };
  const snapshotIcon = snapshot.tone === "risk" ? <AlertTriangle size={18} /> : snapshot.tone === "watch" ? <TrendingDown size={18} /> : snapshot.tone === "good" ? <TrendingUp size={18} /> : <CalendarDays size={18} />;
  const exportPdf = async () => { setExporting(true); try { await downloadMonthlyBalancePdf(data, focusMonth, memberId); } finally { setExporting(false); } };
  const nextStep = awaitingIncome
    ? { title: t("Așteaptă venitul înainte de a trage concluzii"), detail: t("Gospodăriile plătite la mijlocul sau la finalul lunii au mereu cheltuieli înaintea încasării. Compară pe ciclul de salariu, în Plan."), label: t("Deschide Planul"), view: "plan" as MainView }
    : alerts.some((entry) => entry.state === "over")
    ? { title: t("Revizuiește plicurile depășite"), detail: t("Un plic a trecut peste limita ajustată. Verifică suma și mută doar ce este necesar."), label: "Deschide Planul", view: "plan" as MainView }
    : currentFlow < 0
      ? { title: t("Verifică ritmul până la următorul venit"), detail: t("Cheltuielile lunii au depășit veniturile înregistrate. O ajustare în Plan poate preveni o surpriză la final de perioadă."), label: t("Verifică Planul"), view: "plan" as MainView }
      : categories[0]
        ? { title: `Urmărește ${categories[0][0]}`, detail: `${money(categories[0][1])} reprezintă categoria principală din luna aleasă. Deschide registrul pentru a verifica mișcările care au format suma.`, label: t("Vezi Mișcările"), view: "journal" as MainView }
        : { title: t("Înregistrează prima mișcare"), detail: t("Analiza devine mai utilă după ce există date reale în registru."), label: "Deschide Registrul", view: "journal" as MainView };

  return <div className="bf-analysis">
    <section className="bf-analysis-control"><div><p className="bf-kicker">{t("CITEȘTE LUNA")}</p><h2>{titleFor(focusMonth)}</h2><p>{t("Perspectivele și valorile se calculează din mișcările înregistrate, nu dintr-un extras bancar.")}</p></div><label>{t("Luna analizată")}<input type="month" value={focusMonth} onChange={(event) => setFocusMonth(event.target.value)} /></label></section>
    {isCollaborative && <div className="bf-analysis-scope" role="group" aria-label="Perspectiva analizei"><button className={scope === "family" ? "active" : ""} onClick={() => setScope("family")}>Familie</button>{data.settings.members.map((member) => <button key={member.id} className={scope === member.id ? "active" : ""} onClick={() => setScope(member.id)}>{member.name}</button>)}</div>}
    <section className={`bf-analysis-snapshot ${snapshot.tone}`} aria-labelledby="bf-analysis-snapshot-title"><div className="bf-analysis-snapshot-copy"><span className="bf-analysis-snapshot-icon" aria-hidden="true">{snapshotIcon}</span><div><p className="bf-kicker">{snapshot.eyebrow}</p><h2 id="bf-analysis-snapshot-title">{snapshot.title}</h2><p>{snapshot.detail}</p></div></div><div className="bf-analysis-snapshot-stats"><span><small>{t("MIȘCĂRI")}</small><b>{selected.length}</b></span><span><small>CHELTUIELI</small><b>{money(current.expense)}</b></span><span><small>{t("DE REVIZUIT")}</small><b>{alerts.length}</b></span></div></section>
    <section className="bf-analysis-next-step" aria-labelledby="bf-analysis-next-step-title"><div><p className="bf-kicker">{t("URMĂTORUL PAS")}</p><h2 id="bf-analysis-next-step-title">{nextStep.title}</h2><p>{nextStep.detail}</p></div>{onGo && <button type="button" onClick={() => onGo(nextStep.view)}>{nextStep.label} <ArrowDownRight size={16} /></button>}</section>
    <section className="bf-analysis-month"><div className="bf-analysis-month-heading"><div><p className="bf-kicker">REZULTATUL LUNII · {perspective.toUpperCase()}</p><h2>{currentFlow < 0 ? t("Au ieșit mai mulți bani decât au intrat.") : t("Luna rămâne în echilibru.")}</h2></div><span className={currentFlow < 0 ? "negative" : ""}>{money(currentFlow)}</span></div><div className="bf-analysis-flow"><article><span className="income"><ArrowDownRight size={16} /></span><div><small>Venituri</small><b>{money(current.income)}</b><em>{change(current.income - prior.income, prior.income)}</em></div></article><article><span className="expense"><ArrowUpRight size={16} /></span><div><small>Cheltuieli</small><b>{money(current.expense)}</b><em>{change(current.expense - prior.expense, prior.expense)}</em></div></article><article><span className="balance"><WalletCards size={16} /></span><div><small>{t("Bilanț înregistrat")}</small><b>{money(balance.cashflow)}</b><em>{change(currentFlow - priorFlow, priorFlow)}</em></div></article></div></section>
    <section className="bf-analysis-year"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">ANUL CURENT · {year}</p><h2>{t("Ritm lună cu lună")}</h2></div><span>{t("atinge o lună pentru analiză")}</span></div><div className="bf-analysis-chart" aria-label={`Evoluția lunară pentru ${year}`}>{monthly.map((item, index) => <button key={item.label} className={item.isFocus ? "active" : ""} onClick={() => { setFocusMonth(`${year}-${String(index + 1).padStart(2, "0")}`); setSelectedCategory(""); }} aria-label={`${item.label}: venituri ${money(item.income)}, cheltuieli ${money(item.expense)}`}><span><i className="income" style={{ height: `${Math.max(3, item.income / maxMonthly * 100)}%` }} /><i className="expense" style={{ height: `${Math.max(3, item.expense / maxMonthly * 100)}%` }} /></span><b>{item.label}</b></button>)}</div><div className="bf-analysis-legend"><span><i className="income" /> Venituri</span><span><i className="expense" /> Cheltuieli</span><strong>Ritm anual: {money(monthly.reduce((sum, item) => sum + item.flow, 0))}</strong></div></section>
    <section className="bf-spend-compass"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">{t("DISTRIBUȚIE INTERACTIVĂ")}</p><h2>Unde au mers banii</h2></div><TrendingDown size={19} /></div>{categorySlices.length ? <><div className="bf-spend-compass-layout"><div className="bf-spend-donut" style={{ background: categoryGradient }} role="img" aria-label={`Distribuția cheltuielilor: ${categorySlices.map((slice) => `${slice.name} ${Math.round(slice.share)}%`).join(", ")}`}><div><small>CHELTUIELI</small><b>{money(categoryTotal)}</b><span>{titleFor(focusMonth)}</span></div></div><div className="bf-spend-category-pills" role="list" aria-label={t("Categorii de cheltuieli")}>{categorySlices.map((slice) => <button key={slice.name} role="listitem" className={activeCategory?.name === slice.name ? "active" : ""} onClick={() => setSelectedCategory(slice.name)}><i style={{ backgroundColor: slice.color }} /><span><b>{slice.name}</b><small>{Math.round(slice.share)}% · {money(slice.value)}</small></span></button>)}</div></div>{activeCategory && <article className="bf-spend-focus" style={{ borderLeftColor: activeCategory.color }}><span style={{ backgroundColor: activeCategory.color }} /><div><small>{t("CATEGORIA SELECTATĂ")}</small><b>{activeCategory.name}</b><p>{money(activeCategory.value)} · {Math.round(activeCategory.share)}% din cheltuielile acestei luni.</p></div></article>}<div className="bf-analysis-category-rows">{categories.map(([name, value]) => <button key={name} className={activeCategory?.name === name ? "active" : ""} onClick={() => setSelectedCategory(name)}><span>{name}</span><b>{money(value)}</b><i><em style={{ width: `${value / maxCategory * 100}%`, background: categoryColors[name] || "#73847b" }} /></i></button>)}</div></> : <p className="bf-analysis-empty">{t("Nu există cheltuieli în această lună pentru perspectiva aleasă.")}</p>}</section>
    <section className="bf-analysis-watch"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">{t("PLICURI CARE CER ATENȚIE")}</p><h2>{t("Limite de revizuit")}</h2></div><AlertTriangle size={19} /></div>{alerts.length ? <div>{alerts.map((entry) => <article className={entry.state} key={entry.item.id}><span><AlertTriangle size={17} /></span><div><b>{entry.item.label}</b><small>{entry.state === "over" ? `${money(Math.abs(entry.remaining))} peste limită` : `${Math.round(entry.usage * 100)}% consumat · ${money(Math.max(0, entry.remaining))} rămași`}</small></div><strong>{money(entry.budget)}</strong></article>)}</div> : <p className="bf-analysis-empty">{t("Nu există plicuri aproape sau peste limită în perspectiva aleasă.")}</p>}</section>
    <section className="bf-analysis-balance"><div><p className="bf-kicker">{t("POZIȚIE LA MOMENTUL GENERĂRII")}</p><h2>{t("Solduri, datorii și economii")}</h2><p>{t("Poziția de mai jos este curentă; fluxul lunar de sus rămâne filtrat la luna aleasă.")}</p></div><div><article><WalletCards size={17} /><span><small>{t("Poziție lichidă netă")}</small><b className={totalBalance.netLiquidPosition < 0 ? "negative" : ""}>{money(totalBalance.netLiquidPosition)}</b></span></article><article><Landmark size={17} /><span><small>{t("Datorii rămase")}</small><b>{money(totalBalance.debtRemaining)}</b></span></article><article><PiggyBank size={17} /><span><small>{t("Economii urmărite")}</small><b>{money(totalBalance.savingsCurrent)}</b></span></article></div><button disabled={exporting} onClick={exportPdf}><Download size={17} /> {exporting ? t("Generăm PDF-ul…") : t("Descarcă PDF · {month}", { month: titleFor(focusMonth) })}</button></section>
  </div>;
}
