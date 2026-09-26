/**
 * Atelierul Financiar — Analiză istorică calculată exclusiv din registrul local real.
 * Graficul de distribuție este o hartă de decizie: categorie, valoare și pondere rămân accesibile și verificabile.
 */
import { categoryColor } from "@/lib/category-color";
import "../report-balance.css";
import "../balance-scope.css";
import "../reports.css";
import "../analysis-studio.css";
import "../mobile-analysis-pass.css";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, Info, ArrowUpRight, CalendarDays, Download, Landmark, PiggyBank, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { allocationStatus, categoryColors, financialBalance, formatDate, isoToday, transactionShareScope, type AppData, type ShareScope } from "@/lib/finance-data";
import { analysisCompareWindow } from "@/lib/household-insights";
import { EmptyMark } from "@/components/LedgerArt";
import { ChartEmpty, ChartTip, ChartYAxis } from "@/components/ChartFrame";
import { chartBarHeight, hasChartValues, leiAxisTicks, leiLabel } from "@/lib/chart-ui";
import { downloadMonthlyBalancePdf } from "@/lib/monthly-balance-pdf";
import type { MainView } from "@/pages/home-kit";
import { getLocale, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const money = lei;
const months = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];
const titleFor = (month: string) => { const [year, index] = month.split("-").map(Number); return new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(new Date(year, index - 1, 1)); };

export function ReportsPanel({ data, onGo }: { data: AppData; onGo?: (view: MainView) => void }) {
  // Luna familiei (fusul ales în Setări), aceeași ca „azi” din restul aplicației.
  const currentMonth = isoToday().slice(0, 7);
  const year = Number(currentMonth.slice(0, 4));
  /**
   * Lunile de ales: de la prima mișcare (cel mult 5 ani în urmă) până la luna curentă. Un <select>
   * cu numele lunilor în limba aplicației, nu <input type="month">, pe care unele telefoane îl
   * afișează în limba sistemului („September 2026”).
   */
  const monthChoices = useMemo(() => {
    const first = data.transactions.reduce((min, item) => (item.date && item.date.slice(0, 7) < min ? item.date.slice(0, 7) : min), currentMonth);
    const out: string[] = [];
    const cursor = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 1, 1);
    for (let i = 0; i < 60; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      out.push(key);
      // Doar lunile de la prima mișcare încoace: 12 luni goale înapoi arătau „noiembrie 2025” fără date.
      if (key <= first) break;
      cursor.setMonth(cursor.getMonth() - 1);
    }
    return out;
  }, [data.transactions, currentMonth]);
  const [scope, setScope] = useState("family");
  const [shareScope, setShareScope] = useState<"all" | ShareScope>("all");
  const [focusMonth, setFocusMonth] = useState(currentMonth);
  const [exporting, setExporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const cycleReady = Boolean(data.settings.salaryPlan.periodStart && (data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday));
  const [windowMode, setWindowMode] = useState<"calendar" | "cycle">(cycleReady ? "cycle" : "calendar");
  /** Pe telefon un buton dezactivat nu spune de ce: îl lăsăm apăsabil și arătăm ce lipsește. */
  const [cycleHint, setCycleHint] = useState(false);
  const isCollaborative = data.settings.members.length > 1;
  const selectedMember = data.settings.members.find((member) => member.id === scope);
  const perspective = selectedMember?.name || (isCollaborative ? t("Familie") : t("Personal"));
  const memberId = selectedMember?.id;
  const scopedTransactions = useMemo(() => data.transactions.filter((item) => (!memberId || item.memberId === memberId) && (shareScope === "all" || transactionShareScope(item) === shareScope)), [data.transactions, memberId, shareScope]);
  const compare = analysisCompareWindow(data.settings.salaryPlan, focusMonth, cycleReady && windowMode === "cycle" ? "cycle" : "calendar");
  const range = { start: compare.start, end: compare.end };
  const selected = scopedTransactions.filter((item) => item.date >= compare.start && item.date <= compare.end);
  const previous = scopedTransactions.filter((item) => item.date >= compare.priorStart && item.date <= compare.priorEnd);
  const summarize = (entries: typeof selected) => ({ income: entries.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0), expense: entries.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0) });
  const current = summarize(selected);
  const prior = summarize(previous);
  const currentFlow = current.income - current.expense;
  const priorFlow = prior.income - prior.expense;
  const totalBalance = financialBalance(data, undefined, undefined, memberId);
  const monthly = months.map((label, index) => { const prefix = `${year}-${String(index + 1).padStart(2, "0")}`; const summary = summarize(scopedTransactions.filter((item) => item.date.startsWith(prefix))); return { label, key: prefix, ...summary, flow: summary.income - summary.expense, isFocus: prefix === focusMonth }; });
  const chartMonths = monthly.filter((item) => item.income > 0 || item.expense > 0 || item.isFocus);
  const maxMonthly = Math.max(1, ...monthly.flatMap((item) => [item.income, item.expense]));
  const yearHasData = hasChartValues(monthly.flatMap((item) => [item.income, item.expense]));
  const focusMonthRow = monthly.find((item) => item.isFocus);
  const categories = Object.entries(selected.filter((item) => item.kind === "expense").reduce<Record<string, number>>((all, item) => ({ ...all, [item.category]: (all[item.category] || 0) + item.amount }), {})).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categories.map(([, value]) => value));
  const categoryTotal = categories.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  // Cel mult 6 felii: primele 5 categorii și „Altele” pentru rest, ca donutul să rămână lizibil.
  const donutCategories: Array<[string, number]> = categories.length > 6
    ? [...categories.slice(0, 5), ["Altele", categories.slice(5).reduce((sum, [, value]) => sum + value, 0)]]
    : categories;
  const categorySlices = donutCategories.map(([name, value]) => { const share = categoryTotal ? value / categoryTotal * 100 : 0; const start = cursor; cursor += share; return { name, value, share, start, end: cursor, color: categoryColor(name) }; });
  const categoryGradient = categorySlices.length ? `conic-gradient(${categorySlices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(", ")})` : "conic-gradient(var(--cf-line) 0 100%)";
  const activeCategory = categorySlices.find((slice) => slice.name === selectedCategory) || categorySlices[0];
  const alerts = data.settings.salaryPlan.allocations.map((item) => ({ item, ...allocationStatus(data, item) })).filter((entry) => entry.state !== "healthy" && (!memberId || entry.item.memberId === memberId));
  const change = (value: number, base: number) => base === 0 ? (value === 0 ? t("fără mișcări comparabile") : compare.mode === "cycle" ? t("primul ciclu cu date") : t("prima lună cu date")) : compare.mode === "cycle" ? t("{change} față de ciclul anterior", { change: `${value >= 0 ? "+" : ""}${money(value)}` }) : t("{change} față de luna anterioară", { change: `${value >= 0 ? "+" : ""}${money(value)}` });
  /**
   * Aplicația este construită pe cicluri de salariu, dar acest ecran compară luni
   * calendaristice. O casă plătită pe 25 avea deci „cheltuielile au depășit veniturile”
   * de la 1 până la 24 în fiecare lună — o alarmă falsă prin construcție. Când în luna
   * aleasă nu a intrat niciun venit, dar planul spune că salariul vine mai târziu,
   * spunem asta în loc să dăm alarma.
   */
  const plannedPayday = data.settings.salaryPlan.nextPayday || data.settings.salaryPlan.earliestPayday;
  const awaitingIncome = current.income === 0 && current.expense > 0 && Boolean(plannedPayday) && plannedPayday! >= range.start && plannedPayday! <= range.end;

  const windowEmpty = {
    tone: "empty" as const,
    eyebrow: compare.mode === "cycle" ? t("CICLUL ALES") : t("LUNA ALEASĂ"),
    title: compare.mode === "cycle" ? t("Nu există mișcări în acest ciclu.") : t("Nu există mișcări în această lună."),
    detail: t("Poți alege o altă lună din ritmul anual sau poți înregistra prima mișcare."),
  };
  const snapshot = !data.transactions.length
    ? { tone: "empty", eyebrow: t("PUNCT DE PLECARE"), title: t("Începe cu prima mișcare."), detail: t("După câteva înregistrări, aici vei vedea ce s-a schimbat și ce merită urmărit.") }
    : !selected.length
      ? windowEmpty
      : alerts.some((entry) => entry.state === "over")
        ? { tone: "risk", eyebrow: t("DECIZIE NECESARĂ"), title: t("Un plic a trecut peste limită."), detail: t("{count} {word} o revizuire înainte de următoarea plată.", { count: alerts.filter((entry) => entry.state === "over").length, word: alerts.filter((entry) => entry.state === "over").length === 1 ? t("limită cere") : t("limite cer") }) }
        : awaitingIncome
          ? { tone: "empty", eyebrow: t("VENIT ÎNCĂ NEÎNREGISTRAT"), title: t("Salariul lunii nu a intrat încă."), detail: t("În luna aleasă sunt {expense} în cheltuieli și niciun venit — următorul venit este așteptat pe {date}, iar comparația devine corectă după ce intră banii.", { expense: money(current.expense), date: formatDate(plannedPayday || "") }) }
        : currentFlow < 0
          ? { tone: "watch", eyebrow: t("RITM DE URMĂRIT"), title: t("Cheltuielile au depășit veniturile."), detail: t("{count} {word} înregistrate; verifică distribuția pe categorii înainte de a ajusta planul.", { count: selected.length, word: selected.length === 1 ? t("mișcare este") : t("mișcări sunt") }) }
          : { tone: "good", eyebrow: t("SITUAȚIE LUNARĂ"), title: t("Luna rămâne pe plus."), detail: t("{moves} și {cats}; folosește comparația pentru următorul pas.", { moves: `${selected.length} ${selected.length === 1 ? t("mișcare") : t("mișcări")}`, cats: `${categories.length} ${categories.length === 1 ? t("categorie urmărită") : t("categorii urmărite")}` }) };
  const snapshotIcon = snapshot.tone === "risk" ? <AlertTriangle size={18} /> : snapshot.tone === "watch" ? <TrendingDown size={18} /> : snapshot.tone === "good" ? <TrendingUp size={18} /> : <CalendarDays size={18} />;
  const exportPdf = async () => { setExporting(true); try { await downloadMonthlyBalancePdf(data, focusMonth, memberId); } finally { setExporting(false); } };
  const nextStep = awaitingIncome
    ? { title: t("Așteaptă venitul înainte de a trage concluzii"), detail: t("Gospodăriile plătite la mijlocul sau la finalul lunii au mereu cheltuieli înaintea încasării. Compară pe ciclul de salariu, în Plan."), label: t("Deschide Planul"), view: "plan" as MainView }
    : alerts.some((entry) => entry.state === "over")
    ? { title: t("Revizuiește plicurile depășite"), detail: t("Un plic a trecut peste limita ajustată. Verifică suma și mută doar ce este necesar."), label: t("Deschide Planul"), view: "plan" as MainView }
    : currentFlow < 0
      ? { title: t("Verifică ritmul până la următorul venit"), detail: t("Cheltuielile lunii au depășit veniturile înregistrate. O ajustare în Plan poate preveni o surpriză la final de perioadă."), label: t("Verifică Planul"), view: "plan" as MainView }
      : categories[0]
        ? { title: t("Urmărește {category}", { category: categories[0][0] }), detail: t("{amount} reprezintă categoria principală din luna aleasă. Deschide registrul pentru a verifica mișcările care au format suma.", { amount: money(categories[0][1]) }), label: t("Vezi Mișcările"), view: "journal" as MainView }
        : { title: t("Înregistrează prima mișcare"), detail: t("Analiza devine mai utilă după ce există date reale în registru."), label: t("Deschide Registrul"), view: "journal" as MainView };

  return <div className="bf-analysis">
    <section className="bf-analysis-control"><div><p className="bf-kicker">{compare.mode === "cycle" ? t("CITEȘTE CICLUL") : t("CITEȘTE LUNA")}</p><h2>{compare.mode === "cycle" ? compare.title : titleFor(focusMonth)}</h2></div><label>{t("Luna analizată")}<select value={focusMonth} onChange={(event) => { setFocusMonth(event.target.value); setWindowMode("calendar"); }}>{(monthChoices.includes(focusMonth) ? monthChoices : [...monthChoices, focusMonth].sort().reverse()).map((month) => <option key={month} value={month}>{titleFor(month)}</option>)}</select></label></section>
    <div className="bf-analysis-scope bf-analysis-window" role="group" aria-label={t("Fereastra de comparație")}><button type="button" className={compare.mode === "calendar" ? "active" : ""} onClick={() => setWindowMode("calendar")}>{t("Lună calendar")}</button><button type="button" className={`${compare.mode === "cycle" ? "active" : ""}${cycleReady ? "" : " is-unavailable"}${!cycleReady && cycleHint ? " is-asking" : ""}`} aria-expanded={cycleReady ? undefined : cycleHint} title={cycleReady ? t("Compară pe ciclul de salariu") : undefined} onClick={() => { if (cycleReady) setWindowMode("cycle"); else setCycleHint((open) => !open); }}>{!cycleReady && <Info size={15} aria-hidden="true" />}{t("Ciclu salariu")}</button></div>
    {!cycleReady && cycleHint && <div className="bf-analysis-cycle-hint" role="status"><Info size={18} aria-hidden="true" /><div><b>{t("Ciclul de salariu are nevoie de data venitului")}</b><p>{t("Spune în Plan când vine salariul; apoi comparația merge de la un salariu la altul, nu pe luna calendaristică.")}</p>{onGo && <button type="button" className="bf-primary" onClick={() => onGo("plan")}>{t("Setează data salariului")}</button>}</div></div>}
    {isCollaborative && <div className="bf-analysis-scope" role="group" aria-label={t("Perspectiva analizei")}><button className={scope === "family" ? "active" : ""} onClick={() => setScope("family")}>{t("Familie")}</button>{data.settings.members.map((member) => <button key={member.id} className={scope === member.id ? "active" : ""} onClick={() => setScope(member.id)}>{member.name}</button>)}</div>}
    {data.settings.members.length > 1 && <div className="bf-analysis-scope bf-share-scope" role="group" aria-label={t("Perspectivă comună sau personală")}><button className={shareScope === "all" ? "active" : ""} onClick={() => setShareScope("all")}>{t("Toate")}</button><button className={shareScope === "shared" ? "active" : ""} onClick={() => setShareScope("shared")}>{t("Comun (familie)")}</button><button className={shareScope === "personal" ? "active" : ""} onClick={() => setShareScope("personal")}>{t("Personal")}</button></div>}
    <section className={`bf-analysis-snapshot ${snapshot.tone}`} aria-labelledby="bf-analysis-snapshot-title"><div className="bf-analysis-snapshot-copy"><span className="bf-analysis-snapshot-icon" aria-hidden="true">{snapshotIcon}</span><div><p className="bf-kicker">{snapshot.eyebrow}</p><h2 id="bf-analysis-snapshot-title">{snapshot.title}</h2><p>{snapshot.detail}</p></div></div><div className="bf-analysis-snapshot-stats"><span><small>{t("MIȘCĂRI")}</small><b>{selected.length}</b></span><span><small>{t("CHELTUIELI")}</small><b>{money(current.expense)}</b></span><span><small>{t("PLICURI DE REVIZUIT")}</small><b>{alerts.length}</b></span></div></section>
    <section className="bf-analysis-next-step" aria-labelledby="bf-analysis-next-step-title"><div><p className="bf-kicker">{t("URMĂTORUL PAS")}</p><h2 id="bf-analysis-next-step-title">{nextStep.title}</h2><p>{nextStep.detail}</p></div>{onGo && <button type="button" className="bf-primary bf-analysis-empty-cta" onClick={() => onGo(nextStep.view)}>{nextStep.label} <ArrowDownRight size={16} /></button>}</section>
    <section className="bf-analysis-month"><div className="bf-analysis-month-heading"><div><p className="bf-kicker">{t("REZULTATUL LUNII · {perspective}", { perspective: perspective.toUpperCase() })}</p><h2>{currentFlow < -0.5 ? t("Au ieșit mai mulți bani decât au intrat.") : currentFlow > 0.5 ? t("Luna rămâne pe plus.") : t("Luna e în echilibru.")}</h2></div><span className={currentFlow < 0 ? "negative" : ""}>{money(currentFlow)}</span></div><div className="bf-analysis-flow"><article><span className="income"><ArrowDownRight size={16} /></span><div><small>{t("Venituri")}</small><b>{money(current.income)}</b><em>{change(current.income - prior.income, prior.income)}</em></div></article><article><span className="expense"><ArrowUpRight size={16} /></span><div><small>{t("Cheltuieli")}</small><b>{money(current.expense)}</b><em>{change(current.expense - prior.expense, prior.expense)}</em></div></article><article><span className="balance"><WalletCards size={16} /></span><div><small>{t("Bilanț înregistrat")}</small><b>{money(currentFlow)}</b><em>{change(currentFlow - priorFlow, priorFlow)}</em></div></article></div></section>
    <section className="bf-spend-compass"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">{t("DISTRIBUȚIE INTERACTIVĂ")}</p><h2>{t("Unde au mers banii")}</h2></div><TrendingDown size={19} /></div>{categorySlices.length ? <><div className="bf-spend-compass-layout"><div className={categorySlices.length < 2 ? "bf-spend-donut is-thin" : "bf-spend-donut"} style={{ background: categoryGradient }} role="img" aria-label={t("Distribuția cheltuielilor: {list}", { list: categorySlices.map((slice) => `${t(slice.name)} ${Math.round(slice.share)}%`).join(", ") })}><div><small>{t("CHELTUIELI")}</small><b>{money(categoryTotal)}</b><span>{compare.mode === "cycle" ? compare.title : titleFor(focusMonth)}</span></div></div><div className="bf-spend-category-pills" role="list" aria-label={t("Categorii de cheltuieli")}>{categorySlices.map((slice) => <button key={slice.name} role="listitem" className={activeCategory?.name === slice.name ? "active" : ""} onClick={() => setSelectedCategory(slice.name)}><i style={{ backgroundColor: slice.color }} /><span><b>{t(slice.name)}</b><small>{Math.round(slice.share)}% · {money(slice.value)}</small></span></button>)}</div></div>{activeCategory && <article className="bf-spend-focus" style={{ borderLeftColor: activeCategory.color }}><span style={{ backgroundColor: activeCategory.color }} /><div><small>{t("CATEGORIA SELECTATĂ")}</small><b>{t(activeCategory.name)}</b><p>{t("{amount} · {share}% din cheltuielile acestei luni.", { amount: money(activeCategory.value), share: Math.round(activeCategory.share) })}</p></div></article>}<div className="bf-analysis-category-rows">{categories.map(([name, value]) => <button key={name} className={activeCategory?.name === name ? "active" : ""} onClick={() => setSelectedCategory(name)}><span>{t(name)}</span><b>{money(value)}</b><i><em style={{ width: `${value / maxCategory * 100}%`, background: categoryColors[name] || "#73847b" }} /></i></button>)}</div></> : <div className="bf-empty-soft"><EmptyMark /><p>{t("Nu există cheltuieli în această fereastră pentru perspectiva aleasă.")}</p></div>}</section>
    <section className="bf-analysis-year"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">{t("ANUL CURENT · {year}", { year })}</p><h2>{t("Ritm lună cu lună")}</h2></div><span>{t("atinge o lună pentru analiză")}</span></div>{yearHasData ? <><div className="bf-chart-frame"><ChartYAxis ticks={leiAxisTicks(maxMonthly).map((value) => leiLabel(value, true))} /><div className="bf-analysis-chart" aria-label={t("Evoluția lunară pentru {year}", { year })}>{chartMonths.map((item) => { const empty = item.income <= 0 && item.expense <= 0; return <button key={item.key} type="button" className={`${item.isFocus ? "active" : ""}${empty ? " is-empty" : ""}`} onClick={() => { setFocusMonth(item.key); setWindowMode("calendar"); setSelectedCategory(""); }} aria-label={t("{label}: venituri {income}, cheltuieli {expense}", { label: item.label, income: leiLabel(item.income), expense: leiLabel(item.expense) })}><span><i className="income" style={{ height: `${chartBarHeight(item.income, maxMonthly)}%` }} /><i className="expense" style={{ height: `${chartBarHeight(item.expense, maxMonthly)}%` }} /></span><b>{item.label}</b></button>; })}</div></div>{focusMonthRow && <ChartTip><b>{focusMonthRow.label}</b><span>{t("Venituri {income} · Cheltuieli {expense}", { income: leiLabel(focusMonthRow.income), expense: leiLabel(focusMonthRow.expense) })}</span></ChartTip>}<div className="bf-analysis-legend"><span><i className="income" /> {t("Venituri")}</span><span><i className="expense" /> {t("Cheltuieli")}</span><strong>{t("Soldul anului (venituri minus cheltuieli): {amount}", { amount: leiLabel(monthly.reduce((sum, item) => sum + item.flow, 0)) })}</strong></div></> : <ChartEmpty title={t("Nu există mișcări în acest an.")} detail={t("Alege o lună după ce înregistrezi venituri sau cheltuieli — atunci apar barele.")} />}</section>
    <section className="bf-analysis-watch"><div className="bf-analysis-section-heading"><div><p className="bf-kicker">{t("PLICURI CARE CER ATENȚIE")}</p><h2>{t("Limite de revizuit")}</h2></div><AlertTriangle size={19} /></div>{alerts.length ? <div>{alerts.map((entry) => <article className={entry.state} key={entry.item.id}><span><AlertTriangle size={17} /></span><div><b>{entry.item.label}</b><small>{entry.state === "over" ? t("{amount} peste limită", { amount: money(Math.abs(entry.remaining)) }) : t("{percent}% consumat · {remaining} rămași", { percent: Math.round(entry.usage * 100), remaining: money(Math.max(0, entry.remaining)) })}</small></div><strong>{money(entry.budget)}</strong></article>)}</div> : <p className="bf-analysis-empty">{t("Nu există plicuri aproape sau peste limită în perspectiva aleasă.")}</p>}</section>
    <section className="bf-analysis-balance"><div><p className="bf-kicker">{t("POZIȚIE LA MOMENTUL GENERĂRII")}</p><h2>{t("Solduri, datorii și economii")}</h2><p>{t("Poziția de mai jos este curentă; fluxul lunar de sus rămâne filtrat la luna aleasă.")}</p></div><div><article><WalletCards size={17} /><span><small>{t("Poziție lichidă netă")}</small><b className={totalBalance.netLiquidPosition < 0 ? "negative" : ""}>{money(totalBalance.netLiquidPosition)}</b></span></article><article><Landmark size={17} /><span><small>{t("Datorii rămase")}</small><b>{money(totalBalance.debtRemaining)}</b></span></article><article><PiggyBank size={17} /><span><small>{t("Economii urmărite")}</small><b>{money(totalBalance.savingsCurrent)}</b></span></article></div><button type="button" className="bf-primary" disabled={exporting} onClick={exportPdf}><Download size={17} /> {exporting ? t("Generăm PDF-ul…") : t("Descarcă PDF · {month}", { month: titleFor(focusMonth) })}</button></section>
  </div>;
}
