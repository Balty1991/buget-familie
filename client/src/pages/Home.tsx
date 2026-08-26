/**
 * Atelierul Financiar — pagină principală cu suprafețe de hârtie caldă, măsurători clare și colaborare discretă.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bot,
  Camera,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Goal,
  Home as HomeIcon,
  LayoutDashboard,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingDown,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { categoryBudgets, debts, expenseCategories, initialTransactions, weeklyTrend, type Transaction, type TransactionKind } from "@/lib/finance-data";

const logoUrl = "/manus-storage/buget-familie-logo_f5f9de00.png";
const deskUrl = "/manus-storage/buget-familie-family-desk_416ad39d.jpg";
const receiptUrl = "/manus-storage/buget-familie-receipt-capture_2fbc0af7.jpg";
const savingsUrl = "/manus-storage/buget-familie-savings-goal_2dad940c.jpg";

type View = "Panou" | "Mișcări" | "Plan săptămânal" | "Datorii" | "Economii" | "Bonuri" | "Asistent";

const navigation: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: "Panou", icon: LayoutDashboard },
  { label: "Mișcări", icon: WalletCards },
  { label: "Plan săptămânal", icon: Goal },
  { label: "Datorii", icon: CircleDollarSign },
  { label: "Economii", icon: PiggyBank },
  { label: "Bonuri", icon: ReceiptText },
  { label: "Asistent", icon: Bot },
];

const money = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });
const exactMoney = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Metric({ label, value, delta, tone = "forest", icon: Icon }: { label: string; value: string; delta: string; tone?: "forest" | "coral" | "honey"; icon: typeof WalletCards }) {
  const toneStyles = {
    forest: "bg-[#E4EEE9] text-[#143C36]",
    coral: "bg-[#F9E4DE] text-[#A74B37]",
    honey: "bg-[#FBF0D2] text-[#8B6214]",
  };
  return (
    <section className="paper-card metric-card">
      <div className={cn("metric-icon", toneStyles[tone])}><Icon size={18} strokeWidth={2.2} /></div>
      <p className="eyebrow">{label}</p>
      <p className="metric-value">{value}</p>
      <p className={cn("metric-delta", tone === "coral" ? "text-[#A74B37]" : "text-[#527269]")}>{delta}</p>
    </section>
  );
}

function BudgetRibbon({ spent, budget, color }: { spent: number; budget: number; color: string }) {
  const percentage = Math.min(100, (spent / budget) * 100);
  return (
    <div className="ribbon-track" aria-label={`${Math.round(percentage)}% utilizat`}>
      <div className="ribbon-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
      <span className="ribbon-notch" style={{ left: "50%" }} />
      <span className="ribbon-notch" style={{ left: "75%" }} />
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (transaction: Transaction) => void }) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimente");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const save = () => {
    const numeric = Number(amount.replace(",", "."));
    if (!title.trim() || Number.isNaN(numeric) || numeric <= 0) return;
    onAdd({ id: `t-${Date.now()}`, title: title.trim(), amount: numeric, kind, category: kind === "income" ? "Venit" : category, source: "Card", person: "Tu", date: "Acum", note: note.trim() || undefined });
    setTitle(""); setAmount(""); setNote(""); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="quick-add"><Plus size={17} /> Adaugă mișcare</Button>
      </DialogTrigger>
      <DialogContent className="add-dialog">
        <DialogHeader><DialogTitle>Înregistrează o mișcare</DialogTitle></DialogHeader>
        <div className="kind-switch" role="group" aria-label="Tip mișcare">
          <button onClick={() => setKind("expense")} className={cn(kind === "expense" && "is-active")}>Cheltuială</button>
          <button onClick={() => setKind("income")} className={cn(kind === "income" && "is-active income")}>Venit</button>
        </div>
        <label className="field-label">Ce ai înregistrat?<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ex. Cumpărături la magazin" autoFocus /></label>
        <label className="field-label">Sumă (lei)<Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>
        {kind === "expense" && <label className="field-label">Categorie<select value={category} onChange={(event) => setCategory(event.target.value)}>{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select></label>}
        <label className="field-label">Notiță opțională<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Cum ai plătit sau alte detalii" /></label>
        <Button onClick={save} className="save-transaction"><Plus size={16} /> Salvează mișcarea</Button>
      </DialogContent>
    </Dialog>
  );
}

function AssistantCard() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("Săptămâna aceasta, cheltuielile pentru alimente sunt în grafic: ai folosit 70% din suma alocată și mai ai 358 lei pentru 5 zile.");
  const answer = () => {
    if (!question.trim()) return;
    setResponse("Am notat întrebarea. Pentru a răspunde corect, asistentul folosește doar tranzacțiile familiei, intervalul selectat și bugetele alocate. În versiunea conectată, răspunsul va indica mereu datele pe care se bazează.");
    setQuestion("");
  };
  return (
    <section className="assistant-card">
      <div className="assistant-orbit"><Sparkles size={17} /></div>
      <div><p className="eyebrow text-[#DDEAE4]">ASISTENT DE FAMILIE</p><h2>O privire calmă înainte de următoarea decizie.</h2></div>
      <p className="assistant-response">{response}</p>
      <div className="assistant-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && answer()} placeholder="Întreabă despre bani..." /><button aria-label="Trimite întrebare" onClick={answer}><Send size={16} /></button></div>
      <p className="assistant-disclaimer">Orientare financiară, nu consultanță de investiții sau credit.</p>
    </section>
  );
}

function Dashboard({ transactions, onAdd }: { transactions: Transaction[]; onAdd: (transaction: Transaction) => void }) {
  const income = useMemo(() => transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0), [transactions]);
  const expenses = useMemo(() => transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0), [transactions]);
  const balance = 18432 + income - expenses;
  return (
    <>
      <header className="view-header">
        <div><p className="eyebrow">26 AUGUST · MARȚI</p><h1>Bună dimineața, <em>familie.</em></h1><p className="header-subtitle">Aveți o imagine clară asupra banilor din această lună.</p></div>
        <div className="header-actions"><button className="icon-button" aria-label="Caută"><Search size={18} /></button><button className="icon-button has-dot" aria-label="Notificări"><Bell size={18} /></button><QuickAdd onAdd={onAdd} /></div>
      </header>
      <div className="metrics-grid">
        <Metric label="Disponibil acum" value={money.format(balance)} delta="După plățile programate" icon={WalletCards} />
        <Metric label="Venituri august" value={money.format(income || 7360)} delta="2 surse de venit" tone="honey" icon={ArrowDownRight} />
        <Metric label="Cheltuit august" value={money.format(expenses || 2984)} delta="40% din veniturile lunii" tone="coral" icon={ArrowUpRight} />
        <Metric label="Economii alocate" value="1.200 lei" delta="75% din obiectivul lunii" icon={PiggyBank} />
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section className="paper-card spending-card">
            <div className="section-heading"><div><p className="eyebrow">RITMUL SĂPTĂMÂNII</p><h2>Cheltuieli zilnice</h2></div><span className="period-chip">18–24 aug.</span></div>
            <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weeklyTrend} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="spendingArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#143C36" stopOpacity={0.22} /><stop offset="100%" stopColor="#143C36" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#E8E3D8" strokeDasharray="2 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#758078", fontSize: 12, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value}`} tick={{ fill: "#9A9E96", fontSize: 11 }} /><Tooltip formatter={(value: number) => [exactMoney.format(value), "Cheltuit"]} contentStyle={{ borderRadius: 14, border: "1px solid #E8E3D8", boxShadow: "0 10px 25px rgba(34, 46, 38, 0.08)" }} /><Area dataKey="amount" type="monotone" stroke="#143C36" strokeWidth={3} fill="url(#spendingArea)" /></AreaChart></ResponsiveContainer></div>
            <div className="chart-insight"><TrendingDown size={16} /><span>Cu <strong>14% mai puțin</strong> decât în săptămâna precedentă.</span><button>Vezi explicația <ChevronRight size={15} /></button></div>
          </section>
          <section className="paper-card budget-card">
            <div className="section-heading"><div><p className="eyebrow">PLICURILE LUNII</p><h2>Bugete pe categorii</h2></div><button className="text-button">Gestionează</button></div>
            <div className="budget-list">{categoryBudgets.map((item) => <div className="budget-row" key={item.label}><div className="budget-label"><span className="category-dot" style={{ backgroundColor: item.color }} /><strong>{item.label}</strong></div><div className="budget-ribbon"><BudgetRibbon spent={item.spent} budget={item.budget} color={item.color} /><span>{money.format(item.spent)} <i>/ {money.format(item.budget)}</i></span></div></div>)}</div>
          </section>
        </div>
        <aside className="dashboard-side">
          <section className="cashflow-card"><div className="cashflow-grid" /><p className="eyebrow text-[#DDEAE4]">PÂNĂ LA URMĂTORUL SALARIU</p><p className="cashflow-value">1.876 <small>lei</small></p><p>Ai la dispoziție 18 zile. Rămâi în ritmul planului săptămânal.</p><div className="cashflow-footer"><span><span className="live-dot" /> În ritm</span><button>Planul lunii <ChevronRight size={14} /></button></div></section>
          <AssistantCard />
        </aside>
      </div>
      <section className="paper-card transactions-card">
        <div className="section-heading"><div><p className="eyebrow">ULTIMELE MIȘCĂRI</p><h2>Ce s-a întâmplat recent</h2></div><button className="text-button">Toate mișcările <ChevronRight size={15} /></button></div>
        <div className="transaction-list">{transactions.slice(0, 5).map((item) => <div className="transaction-row" key={item.id}><div className={cn("transaction-icon", item.kind === "income" ? "income" : "expense")}>{item.kind === "income" ? <ArrowDownRight size={17} /> : <ReceiptText size={17} />}</div><div className="transaction-name"><strong>{item.title}</strong><span>{item.category} · {item.person} · {item.date}</span>{item.note && <small>{item.note}</small>}</div><div className={cn("transaction-amount", item.kind === "income" && "income")}>{item.kind === "income" ? "+" : "−"}{exactMoney.format(item.amount)}</div><button className="row-more" aria-label={`Mai multe opțiuni pentru ${item.title}`}><MoreHorizontal size={18} /></button></div>)}</div>
      </section>
    </>
  );
}

function DebtView() {
  return <section className="content-page"><div className="view-header"><div><p className="eyebrow">OBLIGAȚII PLANIFICATE</p><h1>Datorii sub <em>control.</em></h1><p className="header-subtitle">O singură privire asupra ratelor, împrumuturilor și a banilor rămași de plătit.</p></div><Button className="quick-add"><Plus size={17} /> Adaugă datorie</Button></div><div className="debt-summary"><section><p>Total rămas</p><strong>180.643 lei</strong><span>3 angajamente active</span></section><section><p>Plăți în septembrie</p><strong>2.099 lei</strong><span>Următoarea: 5 septembrie</span></section><section className="debt-summary-accent"><p>Direcție recomandată</p><strong>Închide rata frigiderului</strong><span>Eliberezi 189 lei/lună după 7 plăți</span></section></div><div className="debt-list">{debts.map((debt) => <article key={debt.name} className="paper-card debt-item"><div className={cn("debt-marker", debt.tone)} /><div className="debt-title"><strong>{debt.name}</strong><span>Scadență: {debt.due}</span></div><div><p>Rată lunară</p><strong>{money.format(debt.monthly)}</strong></div><div><p>Sold rămas</p><strong>{money.format(debt.remaining)}</strong></div><div className="debt-progress"><div><span>Progres de plată</span><strong>{debt.progress}%</strong></div><BudgetRibbon spent={debt.progress} budget={100} color={debt.tone === "forest" ? "#143C36" : debt.tone === "honey" ? "#E6B84A" : "#C9674D"} /></div><button className="row-more" aria-label={`Detalii ${debt.name}`}><ChevronRight size={18} /></button></article>)}</div></section>;
}

function SavingsView() {
  return <section className="content-page"><div className="view-header"><div><p className="eyebrow">OBIECTIVE COMUNE</p><h1>Economiile au <em>un loc.</em></h1><p className="header-subtitle">Alocă bani cu un motiv concret și urmărește progresul împreună.</p></div><Button className="quick-add"><Plus size={17} /> Obiectiv nou</Button></div><div className="savings-layout"><article className="savings-feature"><img src={savingsUrl} alt="Obiect de ceramică în formă de casă, simbolizând economiile familiei" /><div className="savings-copy"><p className="eyebrow">FOND DE SIGURANȚĂ</p><h2>O lună fără grabă.</h2><p>Ai pus deoparte 7.500 lei. Mai lipsesc 2.500 lei pentru a acoperi o lună de cheltuieli esențiale.</p><BudgetRibbon spent={7500} budget={10000} color="#E6B84A" /><div><strong>7.500 lei</strong><span> din 10.000 lei</span></div><button>Vezi planul obiectivului <ChevronRight size={16} /></button></div></article><aside className="savings-side"><section className="paper-card small-goal"><div className="goal-icon"><HomeIcon size={19} /></div><p>Vacanță de iarnă</p><strong>2.100 lei</strong><BudgetRibbon spent={2100} budget={4000} color="#143C36" /><span>53% · țintă decembrie</span></section><section className="paper-card small-goal"><div className="goal-icon coral"><Settings size={19} /></div><p>Reparații casă</p><strong>950 lei</strong><BudgetRibbon spent={950} budget={1500} color="#C9674D" /><span>63% · țintă octombrie</span></section></aside></div></section>;
}

function ReceiptsView() {
  return <section className="content-page"><div className="view-header"><div><p className="eyebrow">BONURI ȘI PRODUSE</p><h1>Vezi ce ai <em>cumpărat.</em></h1><p className="header-subtitle">Fotografia bonului păstrează contextul. Categoriile explică unde s-au dus banii.</p></div><Button className="quick-add"><Camera size={17} /> Scanează bon</Button></div><div className="receipt-layout"><article className="receipt-feature"><img src={receiptUrl} alt="Bon de cumpărături fotografiat pentru înregistrare" /><div><p className="eyebrow">FLUX SIMPLU</p><h2>Fotografie. Verificare. Claritate.</h2><p>În versiunea conectată, bonul intră într-o zonă privată, iar informațiile extrase sunt confirmate înainte să actualizeze bugetul.</p><div className="receipt-steps"><span>1. Fotografie</span><ChevronRight size={14} /><span>2. Verificare</span><ChevronRight size={14} /><span>3. Categorii</span></div></div></article><article className="paper-card product-breakdown"><div className="section-heading"><div><p className="eyebrow">LIDL · ASTĂZI</p><h2>186,42 lei</h2></div><span className="verified-tag">Verificat</span></div><div className="product-row"><span className="product-dot food" />Alimente <strong>128,12 lei</strong></div><div className="product-row"><span className="product-dot water" />Apă <strong>12,90 lei</strong></div><div className="product-row"><span className="product-dot treats" />Dulciuri <strong>21,40 lei</strong></div><div className="product-row"><span className="product-dot drinks" />Băuturi <strong>24,00 lei</strong></div><button className="text-button">Deschide bonul <ChevronRight size={15} /></button></article></div></section>;
}

function MovementsView({ transactions }: { transactions: Transaction[] }) {
  return <section className="content-page"><div className="view-header"><div><p className="eyebrow">REGISTRU DE FAMILIE</p><h1>Fiecare leu, <em>cu context.</em></h1><p className="header-subtitle">Toate veniturile și cheltuielile, ordonate în locul în care le puteți discuta împreună.</p></div><div className="filter-pills"><button className="is-selected">Toate</button><button>Cheltuieli</button><button>Venituri</button></div></div><section className="paper-card ledger-table"><div className="ledger-head"><span>MIȘCARE</span><span>CATEGORIE</span><span>INTRODUS DE</span><span>SUMĂ</span></div>{transactions.map((item) => <div className="ledger-row" key={item.id}><div><span className={cn("ledger-icon", item.kind)}>{item.kind === "income" ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}</span><strong>{item.title}</strong><small>{item.date}</small></div><span className="ledger-category">{item.category}</span><span>{item.person}</span><strong className={item.kind === "income" ? "income-value" : "expense-value"}>{item.kind === "income" ? "+" : "−"}{exactMoney.format(item.amount)}</strong></div>)}</section></section>;
}

function WeeklyPlanView() {
  return <section className="content-page"><div className="view-header"><div><p className="eyebrow">PLANUL SĂPTĂMÂNAL</p><h1>Săptămâna are <em>o limită.</em></h1><p className="header-subtitle">Împarte banii rămași până la salariu în pași ușor de urmărit.</p></div><span className="period-chip large">26 aug. – 1 sept.</span></div><div className="weekly-plan"><section className="week-allowance"><p className="eyebrow text-[#DDEAE4]">SUMĂ DISPONIBILĂ SĂPTĂMÂNA ACEASTA</p><strong>738 lei</strong><p>După facturi, rate și economii, aceasta este suma pe care o puteți distribui pentru cheltuieli flexibile.</p><button>Recalculează planul <ChevronRight size={15} /></button></section><section className="paper-card allocation-board"><div className="section-heading"><div><p className="eyebrow">REPARTIZARE</p><h2>Folosește suma cu intenție</h2></div><span className="hand-note">astăzi</span></div>{[{ name: "Alimente", value: 420, share: "57%" }, { name: "Transport", value: 110, share: "15%" }, { name: "Timp liber", value: 120, share: "16%" }, { name: "Rezervă", value: 88, share: "12%" }].map((item) => <div className="allocation-row" key={item.name}><span>{item.name}</span><BudgetRibbon spent={Number(item.share.replace("%", ""))} budget={100} color="#143C36" /><strong>{money.format(item.value)}</strong><small>{item.share}</small></div>)}</section></div></section>;
}

function AssistantView() {
  return <section className="content-page"><div className="view-header"><div><p className="eyebrow">GHID DE FAMILIE</p><h1>Întrebări bune. <em>Date clare.</em></h1><p className="header-subtitle">Asistentul rezumă ceea ce se întâmplă în buget și arată de unde vine fiecare concluzie.</p></div></div><div className="assistant-page"><AssistantCard /><section className="paper-card suggestion-board"><p className="eyebrow">ÎNTREBĂRI UTILE</p><h2>Pornește de aici</h2>{["Unde am depășit planul săptămâna aceasta?", "Ce plăți mari urmează în septembrie?", "Cât putem aloca vacanței după rate?", "Arată-mi diferența dintre alimente și timp liber."].map((item) => <button key={item}>{item}<ChevronRight size={16} /></button>)}</section></div></section>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("Panou");
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = window.localStorage.getItem("buget-familie:transactions");
      return stored ? JSON.parse(stored) as Transaction[] : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });
  useEffect(() => {
    window.localStorage.setItem("buget-familie:transactions", JSON.stringify(transactions));
  }, [transactions]);
  const addTransaction = (transaction: Transaction) => setTransactions((items) => [transaction, ...items]);
  const current = () => {
    if (activeView === "Mișcări") return <MovementsView transactions={transactions} />;
    if (activeView === "Plan săptămânal") return <WeeklyPlanView />;
    if (activeView === "Datorii") return <DebtView />;
    if (activeView === "Economii") return <SavingsView />;
    if (activeView === "Bonuri") return <ReceiptsView />;
    if (activeView === "Asistent") return <AssistantView />;
    return <Dashboard transactions={transactions} onAdd={addTransaction} />;
  };
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><img src={logoUrl} alt="Monogram geometric B/F pentru Buget Familie" /><span aria-hidden="true">B/F</span></div><div><strong>Buget</strong><span>Familie</span></div></div><div className="family-switcher"><div className="family-avatars"><span>A</span><span>M</span></div><div><strong>Casa Popescu</strong><small>2 membri activi</small></div><ChevronRight size={15} /></div><nav className="sidebar-nav" aria-label="Navigație principală">{navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveView(label)} className={cn(activeView === label && "active")}><Icon size={18} /><span>{label}</span>{label === "Asistent" && <Sparkles className="nav-sparkle" size={14} />}</button>)}</nav><div className="sidebar-footer"><button><UsersRound size={17} /> Membrii familiei</button><button><Settings size={17} /> Setări</button><div className="privacy-note"><span className="privacy-lock">⌁</span><p><strong>Datele rămân private.</strong><br />Spațiul familiei se sincronizează doar după conectare.</p></div></div></aside><main className="main-workspace">{current()}</main><div className="mobile-nav">{navigation.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveView(label)} className={cn(activeView === label && "active")}><Icon size={18} /><span>{label.split(" ")[0]}</span></button>)}</div></div>;
}
