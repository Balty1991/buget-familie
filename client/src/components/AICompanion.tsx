import { useMemo, useState } from "react";
import { ArrowRight, Bot, ChevronDown, Lightbulb, MessageCircle, PieChart, Plus, Send, Sparkles, WalletCards, X } from "lucide-react";
import { expenseCategories, parseNaturalSpendScenario, type AppData, type Transaction } from "@/lib/finance-data";
import type { MainView } from "@/pages/home-kit";
import "../ai-companion.css";

export type NaturalDraft = Pick<Transaction, "amount" | "category" | "title" | "kind"> & { date?: string; note?: string };
type Props = { data: AppData; view: MainView; onAdd: () => void; onGo: (view: MainView) => void; onNaturalEntry: (draft: NaturalDraft) => void };
type Prompt = { label: string; answer: string; action?: "add" | "plan" | "journal" | "insights"; actionLabel?: string };

const pageNames: Record<string, string> = { today: "tablou", journal: "jurnal", plan: "planul de bani", obligations: "obligații", insights: "analiză", utilities: "instrumente" };
const today = () => new Date().toISOString().slice(0, 10);
const naturalTitle = (raw: string, category?: string) => {
  const folded = raw.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/combustibil|benzina|motorina/.test(folded)) return "Combustibil";
  return category || "Cheltuială";
};

export function AICompanion({ data, view, onAdd, onGo, onNaturalEntry }: Props) {
  const [open, setOpen] = useState(false);
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const [message, setMessage] = useState("");
  const [parseNotice, setParseNotice] = useState("");

  const context = useMemo(() => {
    const month = today().slice(0, 7);
    const current = data.transactions.filter((item) => item.date.startsWith(month));
    const income = current.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = current.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    const hasPlan = data.settings.salaryPlan.allocations.length > 0;
    if (!data.transactions.length) return { title: "Începem cu prima mișcare?", detail: "Îți pot arăta pas cu pas cum înregistrezi o cheltuială sau un venit. Durează câteva secunde.", tone: "warm", action: "add" as const, actionLabel: "Adaugă prima mișcare" };
    if (!hasPlan) return { title: "Banii au nevoie de o direcție", detail: "Ai deja activitate în jurnal. Hai să împărțim veniturile în plicuri simple, ca să știi ce îți permiți.", tone: "gold", action: "plan" as const, actionLabel: "Configurează repartizarea" };
    if (income > 0 && expense > income) return { title: "Luna cere puțină atenție", detail: `Cheltuielile lunii sunt cu ${Math.round(expense - income).toLocaleString("ro-RO")} RON peste venituri. Verificăm împreună jurnalul?`, tone: "coral", action: "journal" as const, actionLabel: "Vezi jurnalul" };
    return { title: `Sunt cu tine în ${pageNames[view] || "aplicație"}`, detail: income > 0 ? `Până acum: ${Math.round(income).toLocaleString("ro-RO")} RON venituri și ${Math.round(expense).toLocaleString("ro-RO")} RON cheltuieli în luna aceasta.` : "Adaugă mișcările pe măsură ce apar, iar eu îți păstrez imaginea de ansamblu clară.", tone: "good", action: "add" as const, actionLabel: "Adaugă rapid" };
  }, [data, view]);

  const prompts: Prompt[] = [
    { label: "Adaug o cheltuială", answer: "Scrie-mi suma și pentru ce ai plătit, de exemplu: «am cheltuit 50 de lei pe combustibil».", action: "add", actionLabel: "Deschide înregistrarea" },
    { label: "Cum împart banii?", answer: "Începe cu cheltuielile obligatorii, apoi economii și abia la final banii flexibili. Planul cu plicuri face această ordine vizibilă.", action: "plan", actionLabel: "Deschide planul" },
    { label: "Vreau să înțeleg luna", answer: "Analiza îți arată unde se duc banii, ce obiceiuri se repetă și care este următoarea decizie utilă.", action: "insights", actionLabel: "Vezi analiza" },
  ];

  const submitNaturalMessage = () => {
    const raw = message.trim();
    if (!raw) return;
    const parsed = parseNaturalSpendScenario(raw, [...expenseCategories, ...data.settings.customCategories]);
    if (!parsed.understood) {
      setParseNotice("Nu am găsit suma. Încearcă: «am cheltuit 50 de lei pe combustibil».");
      return;
    }
    onNaturalEntry({ kind: "expense", amount: parsed.amount, category: parsed.category || "Alimente", title: naturalTitle(raw, parsed.category), date: parsed.timing === "mâine" ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : today(), note: raw });
    setMessage("");
    setParseNotice("");
    setOpen(false);
  };

  const runAction = (action?: Prompt["action"]) => {
    if (action === "add") onAdd();
    if (action === "plan" || action === "journal" || action === "insights") onGo(action);
    setActivePrompt(null);
    setOpen(false);
  };

  return <>
    {open && <aside className="ai-companion-panel" aria-label="Ghidul tău AI">
      <div className="ai-companion-head"><div className="ai-avatar"><Sparkles size={17} /></div><div><p className="ai-eyebrow">GHIDUL TĂU AI</p><h2>Hai să facem ordine</h2></div><button type="button" className="ai-close" aria-label="Închide ghidul" onClick={() => setOpen(false)}><X size={17} /></button></div>
      <form className="ai-natural-form" onSubmit={(event) => { event.preventDefault(); submitNaturalMessage(); }}><label htmlFor="ai-natural-message">Spune-mi ce s-a întâmplat</label><div><input id="ai-natural-message" value={message} onChange={(event) => { setMessage(event.target.value); setParseNotice(""); }} placeholder="ex. am cheltuit 50 de lei pe combustibil" /><button type="submit" aria-label="Interpretează mesajul"><Send size={16} /></button></div>{parseNotice && <small role="alert">{parseNotice}</small>}<p>Îți precompletez formularul; tu verifici și confirmi.</p></form>
      <div className={`ai-context ai-${context.tone}`}><div className="ai-context-icon"><Lightbulb size={16} /></div><div><strong>{context.title}</strong><p>{context.detail}</p></div></div>
      <div className="ai-actions"><button type="button" onClick={() => runAction(context.action)}><Plus size={15} /> {context.actionLabel}</button><button type="button" onClick={() => runAction("plan")}><PieChart size={15} /> Repartizează bani</button></div>
      <div className="ai-prompts"><p className="ai-eyebrow">CU CE TE AJUT?</p>{prompts.map((prompt) => <button key={prompt.label} type="button" className={activePrompt?.label === prompt.label ? "selected" : ""} onClick={() => setActivePrompt(prompt)}><MessageCircle size={15} />{prompt.label}<ArrowRight size={14} /></button>)}</div>
      {activePrompt && <div className="ai-answer"><Bot size={16} /><div><p>{activePrompt.answer}</p><button type="button" onClick={() => runAction(activePrompt.action)}>{activePrompt.actionLabel} <ArrowRight size={13} /></button></div></div>}
      <p className="ai-privacy"><WalletCards size={13} /> Sugestiile folosesc datele locale ale bugetului tău.</p>
    </aside>}
    <button type="button" className={`ai-companion-trigger ${open ? "is-open" : ""}`} aria-label={open ? "Închide ghidul AI" : "Deschide ghidul AI"} onClick={() => setOpen((value) => !value)}><span className="ai-trigger-pulse" /><Sparkles size={21} /><span>Ghid AI</span>{open ? <ChevronDown size={14} /> : <span className="ai-live">LIVE</span>}</button>
  </>;
}

export default AICompanion;
