import { useMemo, useState } from "react";
import { ArrowRight, Check, CircleDollarSign, CreditCard, HandCoins, Plus, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import { isoToday, newId, parseRomanianAmount, type AppData, type BudgetAllocation, type Debt } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import "../ai-financial-setup.css";
import { t } from "@/lib/i18n";

type Props = { data: AppData; onChange: (next: AppData) => void; onClose: () => void; onGoPlan: () => void; onAdd: () => void };
type AllocationDraft = { category: string; amount: string; weekly: boolean };
const allocationDefaults: AllocationDraft[] = [
  { category: "Alimente", amount: "", weekly: true },
  { category: "Casă & facturi", amount: "", weekly: false },
  { category: "Transport", amount: "", weekly: true },
  { category: "Economii", amount: "", weekly: false },
];

export function AIFinancialSetup({ data, onChange, onClose, onGoPlan, onAdd }: Props) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(data.settings.memberName === "Eu" ? "" : data.settings.memberName);
  const [family, setFamily] = useState(data.settings.familyName === "Familia mea" ? "" : data.settings.familyName);
  const [income, setIncome] = useState("");
  const [payday, setPayday] = useState(data.settings.salaryPlan.nextPayday || "");
  const [debtName, setDebtName] = useState("");
  const [debtRemaining, setDebtRemaining] = useState("");
  const [debtMonthly, setDebtMonthly] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>(() => Object.fromEntries(data.settings.paymentSources.map((source) => [source.id, source.openingBalance ? String(source.openingBalance) : ""]))) ;
  const [allocations, setAllocations] = useState<AllocationDraft[]>(allocationDefaults);
  const currentMember = data.settings.members[0];
  const money = (value: string) => parseRomanianAmount(value);
  const steps = useMemo(() => [
    { label: "tu", icon: Sparkles, title: t("Începem cu tine."), detail: t("Îți pun câteva întrebări simple ca să construim situația ta financiară fără să cauți prin meniuri.") },
    { label: "venit", icon: CircleDollarSign, title: t("Ce venit intră în fiecare lună?"), detail: t("Poate fi salariu, pensie, freelancing sau orice venit repetitiv. Dacă variază, trecem o medie prudentă.") },
    { label: "datorii", icon: CreditCard, title: t("Ai datorii sau rate?"), detail: t("Le trecem acum ca să nu le uiți când îți planifici banii. Poți lăsa gol dacă nu ai.") },
    { label: "repartizare", icon: Target, title: t("Unde vrei să ajungă banii?"), detail: t("Spune-mi cât vrei să rezervi pentru fiecare zonă. Nu trebuie să fie perfect; ajustăm împreună.") },
    { label: "solduri", icon: HandCoins, title: t("Cu ce sold pornești?"), detail: t("Introdu aproximativ cât ai acum pe card, cash sau bonuri. La final verificăm împreună ce am înțeles.") },
  ], []);
  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const apply = () => {
    const now = new Date().toISOString();
    const memberName = name.trim() || "Eu";
    const memberId = currentMember?.id || "member-me";
    const members = data.settings.members.length ? data.settings.members.map((member, index) => index === 0 ? { ...member, id: memberId, name: memberName } : member) : [{ id: memberId, name: memberName, color: "#256B5B" }];
    const paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: Math.max(0, money(balances[source.id] || "0")), memberId: source.kind === "transfer" ? undefined : memberId }));
    const monthlyIncome = money(income);
    const newIncome = monthlyIncome > 0 && !data.transactions.some((item) => item.kind === "income" && item.title === "Venit lunar") ? [{ id: newId("income"), title: t("Venit lunar"), amount: monthlyIncome, kind: "income" as const, category: "Venit", sourceId: paymentSources[0]?.id, source: paymentSources[0]?.name || "Card debit", memberId, person: memberName, date: isoToday(), note: t("Adăugat în configurarea inițială"), createdAt: now }] : [];
    const newDebt: Debt | undefined = debtName.trim() && money(debtRemaining) > 0 ? { id: newId("debt"), name: debtName.trim(), remaining: money(debtRemaining), monthly: money(debtMonthly), due: "Nespecificat", memberId, tone: "coral", updatedAt: now } : undefined;
    const existingLabels = new Set(data.settings.salaryPlan.allocations.map((item) => item.label));
    const newAllocations: BudgetAllocation[] = allocations.filter((item) => money(item.amount) > 0 && !existingLabels.has(item.category)).map((item) => ({ id: newId("alloc"), label: item.category, category: item.category, amount: money(item.amount), weeklyPace: item.weekly, memberId, sourceId: paymentSources[0]?.id }));
    onChange({ ...data, transactions: [...newIncome, ...data.transactions], debts: newDebt ? [newDebt, ...data.debts] : data.debts, settings: { ...data.settings, familyName: family.trim() || "Familia mea", memberName, members, paymentSources, salaryPlan: { ...data.settings.salaryPlan, periodStart: data.settings.salaryPlan.periodStart || isoToday(), nextPayday: payday || data.settings.salaryPlan.nextPayday, totalLimit: monthlyIncome || data.settings.salaryPlan.totalLimit, allocations: [...data.settings.salaryPlan.allocations, ...newAllocations], updatedAt: now } } });
    window.localStorage.setItem("buget-familie:setup-complete", "true");
    window.localStorage.setItem("buget-familie:onboarding-complete", "true");
  };
  const next = () => { if (step < steps.length - 1) setStep((value) => value + 1); else { apply(); onClose(); } };
  const skip = () => { window.localStorage.setItem("buget-familie:setup-complete", "true"); window.localStorage.setItem("buget-familie:onboarding-complete", "true"); onClose(); };
  return <div className="bf-modal-backdrop bf-onboarding-backdrop" role="presentation"><section ref={dialogRef} tabIndex={-1} className="ai-financial-setup" role="dialog" aria-modal="true" aria-labelledby="ai-setup-title"><button type="button" className="ai-setup-skip" onClick={skip}>{t("Mai târziu")} <X size={14} /></button><header className="ai-setup-header"><div className="ai-setup-avatar"><Sparkles size={20} /></div><div><p className="bf-kicker">{t("GHIDUL TĂU AI · CONFIGURARE")}</p><strong>{t("Îți pun întrebările potrivite.")}</strong></div></header><div className="ai-setup-progress">{steps.map((item, index) => <span key={item.label} className={index <= step ? "active" : ""} />)}</div><div className="ai-setup-chat"><div className="ai-setup-bubble ai-setup-bubble-ai"><Icon size={17} /><div><p className="bf-kicker">PASUL {step + 1} DIN {steps.length}</p><h2 id="ai-setup-title">{currentStep.title}</h2><p>{currentStep.detail}</p></div></div>{step === 0 && <div className="ai-setup-fields"><label className="bf-field"><span>{t("Cum te cheamă?")}</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="ex. Andrei" /></label><label className="bf-field"><span>{t("Numele familiei (opțional)")}</span><input value={family} onChange={(event) => setFamily(event.target.value)} placeholder="ex. Familia Popescu" /></label></div>}{step === 1 && <div className="ai-setup-fields"><label className="bf-field"><span>Venit lunar mediu (lei)</span><input autoFocus inputMode="decimal" value={income} onChange={(event) => setIncome(event.target.value)} placeholder="ex. 6.500" /></label><label className="bf-field"><span>{t("Când intră următorul venit?")}</span><input type="date" value={payday} onChange={(event) => setPayday(event.target.value)} /></label></div>}{step === 2 && <div className="ai-setup-fields"><label className="bf-field"><span>{t("Ce datorie vrei să urmărești?")}</span><input autoFocus value={debtName} onChange={(event) => setDebtName(event.target.value)} placeholder="ex. Credit auto" /></label><div className="ai-setup-two"><label className="bf-field"><span>{t("Sold rămas")}</span><input inputMode="decimal" value={debtRemaining} onChange={(event) => setDebtRemaining(event.target.value)} placeholder="0" /></label><label className="bf-field"><span>{t("Rată lunară")}</span><input inputMode="decimal" value={debtMonthly} onChange={(event) => setDebtMonthly(event.target.value)} placeholder="0" /></label></div><p className="ai-setup-hint"><ShieldCheck size={14} /> {t("Dacă ai mai multe, le poți adăuga ulterior din Obligații.")}</p></div>}{step === 3 && <div className="ai-setup-allocations">{allocations.map((item, index) => <div className="ai-setup-allocation" key={item.category}><label><b>{item.category}</b><small>{item.weekly ? t("săptămânal") : t("perioadă")}</small></label><input inputMode="decimal" value={item.amount} onChange={(event) => setAllocations((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount: event.target.value } : entry))} placeholder={t("0 lei")} /><button type="button" aria-label={`Elimină ${item.category}`} onClick={() => setAllocations((current) => current.filter((_, entryIndex) => entryIndex !== index))}><X size={14} /></button></div>)}<button type="button" className="ai-add-allocation" onClick={() => setAllocations((current) => [...current, { category: "Altceva", amount: "", weekly: false }])}><Plus size={14} /> {t("Adaugă altă destinație")}</button></div>}{step === 4 && <div className="ai-setup-fields"><p className="ai-setup-summary">{t("Introdu soldurile aproximative de acum. Nu este nevoie să fie la virgulă; le putem ajusta oricând.")}</p>{data.settings.paymentSources.map((source) => <label className="bf-field" key={source.id}><span>{source.name}</span><input inputMode="decimal" value={balances[source.id] || ""} onChange={(event) => setBalances((current) => ({ ...current, [source.id]: event.target.value }))} placeholder="0" /></label>)}</div>}</div><footer className="ai-setup-footer"><span>{step === 4 ? t("La final îți deschid tabloul.") : t("Poți reveni și modifica orice răspuns.")}</span><button type="button" className="bf-primary" onClick={next}>{step === steps.length - 1 ? t("Salvează și începe") : t("Continuă")} <ArrowRight size={17} /></button></footer>{step === steps.length - 1 && <div className="ai-setup-quick-actions"><button type="button" onClick={() => { apply(); onClose(); onGoPlan(); }}><Target size={15} /> Vezi planul</button><button type="button" onClick={() => { apply(); onClose(); onAdd(); }}><Plus size={15} /> {t("Adaugă prima mișcare")}</button></div>}</section></div>;
}

export default AIFinancialSetup;
