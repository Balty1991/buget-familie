/**
 * Începutul pentru cine vrea ca aplicația să-i împartă salariul: în trei pași scurți,
 * veniturile, cheltuielile știute și cât poate varia ziua salariului. La capăt, „Ce plătim
 * lunar” e completat, iar la primul salariu notat vine propunerea de repartizare.
 */
import { useState } from "react";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { formatDate, isoToday, newId, parseRomanianAmount, type AppData, type ExpectedIncome, type MonthlyNeed } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { genitiveName } from "@/lib/member-mode";

type IncomeDraft = { id: string; who: "me" | "partner"; label: string; amount: string; day: string };
type NeedDraft = { label: string; category: string; cadence: "monthly" | "weekly"; priority: "fixed" | "flex" | "buffer"; amount: string; on: boolean };

const START_NEEDS: NeedDraft[] = [
  { label: "Mâncare", category: "Alimente", cadence: "weekly", priority: "flex", amount: "", on: true },
  { label: "Chirie", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Rate bancă", category: "Rate produse", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Lumină", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: true },
  { label: "Gaz", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Apă", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Abonamente", category: "Abonamente", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Grădiniță", category: "Consumabile copil", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Taxi / transport", category: "Transport", cadence: "monthly", priority: "flex", amount: "", on: false },
  { label: "Neprevăzute", category: "Altele", cadence: "monthly", priority: "buffer", amount: "", on: false },
];

/**
 * Șabloane de gospodărie: o atingere bifează și completează sume orientative (lei, România 2026),
 * pe care omul le corectează. Pornirea de la zero cerea 10 decizii înainte de primul rezultat.
 */
const HOUSEHOLD_TEMPLATES: Array<{ id: string; label: string; amounts: Record<string, string> }> = [
  { id: "single", label: "Singur", amounts: { "Mâncare": "350", "Chirie": "1800", "Lumină": "150", "Abonamente": "80", "Taxi / transport": "200", "Neprevăzute": "200" } },
  { id: "couple", label: "Cuplu", amounts: { "Mâncare": "600", "Chirie": "2200", "Lumină": "250", "Gaz": "150", "Apă": "80", "Abonamente": "120", "Taxi / transport": "300", "Neprevăzute": "300" } },
  { id: "kids", label: "Familie cu copii", amounts: { "Mâncare": "900", "Rate bancă": "1400", "Lumină": "350", "Gaz": "200", "Apă": "120", "Abonamente": "150", "Grădiniță": "800", "Taxi / transport": "400", "Neprevăzute": "400" } },
];

/** Ziua următorului salariu: în luna asta, dacă n-a trecut, altfel luna viitoare. */
export const nextDateForDay = (today: string, day: number) => {
  const base = new Date(`${today}T12:00:00`);
  const make = (offset: number) => {
    const date = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const here = make(0);
  return here > today ? here : make(1);
};

export function NeedsQuickStart({ data, yourName, partnerName, onPartnerName, onFinish }: { data: AppData; yourName: string; partnerName: string; onPartnerName: (name: string) => void; onFinish: (next: AppData) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [incomes, setIncomes] = useState<IncomeDraft[]>([{ id: newId("income"), who: "me", label: t("Salariul meu"), amount: "", day: "" }]);
  const [needs, setNeeds] = useState<NeedDraft[]>(START_NEEDS.map((item) => ({ ...item, label: t(item.label) })));
  const [flex, setFlex] = useState(3);
  const [error, setError] = useState("");
  const today = isoToday();
  const hasPartner = incomes.some((item) => item.who === "partner");

  const validIncomes = incomes.filter((item) => parseRomanianAmount(item.amount) > 0 && Number(item.day) >= 1 && Number(item.day) <= 31);
  const firstDay = validIncomes.map((item) => nextDateForDay(today, Math.round(Number(item.day)))).sort()[0] || "";

  const next = () => {
    setError("");
    if (step === 1) {
      if (!validIncomes.length) return setError(t("Scrie cel puțin un venit, cu suma și ziua în care vine."));
      if (hasPartner && !partnerName.trim()) return setError(t("Scrie numele partenerului."));
      return setStep(2);
    }
    if (step === 2) {
      if (!needs.some((item) => item.on && parseRomanianAmount(item.amount) > 0)) return setError(t("Bifează cel puțin o cheltuială și scrie suma ei."));
      return setStep(3);
    }
    finish();
  };

  const finish = () => {
    const now = new Date().toISOString();
    const me = data.settings.members.find((item) => item.id === "member-me") || data.settings.members[0] || { id: "member-me", name: yourName || "Eu" };
    let members = data.settings.members.length ? data.settings.members.map((item) => item.id === me.id && yourName.trim() ? { ...item, name: yourName.trim() } : item) : [{ ...me, name: yourName.trim() || "Eu" }];
    let partnerId = members.find((item) => item.id !== me.id)?.id;
    if (hasPartner && !partnerId) {
      partnerId = newId("member");
      members = [...members, { id: partnerId, name: partnerName.trim(), color: "#966E4A" }];
    }
    const expected: ExpectedIncome[] = validIncomes.map((item) => ({ id: item.id, memberId: item.who === "partner" && partnerId ? partnerId : me.id, label: item.who === "partner" && item.label.trim() === t("Salariul partenerului") && partnerName.trim() ? t("Salariul {name}", { name: genitiveName(partnerName.trim()) }) : item.label.trim() || t("Salariu"), amount: parseRomanianAmount(item.amount), day: Math.round(Number(item.day)), updatedAt: now }));
    const declared: MonthlyNeed[] = needs.filter((item) => item.on && parseRomanianAmount(item.amount) > 0).map((item) => {
      const amount = parseRomanianAmount(item.amount);
      return { id: newId("need"), label: item.label, category: item.category, cadence: item.cadence, min: amount, max: amount, reserve: "max", priority: item.priority, updatedAt: now };
    });
    const plan = data.settings.salaryPlan;
    const earliest = firstDay && flex > 0 ? (() => { const date = new Date(`${firstDay}T12:00:00`); date.setDate(date.getDate() - flex); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; })() : undefined;
    onFinish({
      ...data,
      settings: {
        ...data.settings,
        memberName: yourName.trim() || data.settings.memberName,
        members,
        salaryPlan: {
          ...plan,
          incomes: [...(plan.incomes || []), ...expected],
          needs: [...(plan.needs || []), ...declared],
          paydayFlexDays: flex,
          ...(firstDay && !plan.nextPayday ? { periodStart: today, nextPayday: firstDay, earliestPayday: earliest && earliest > today ? earliest : today } : {}),
          updatedAt: now,
        },
      },
    });
  };

  const setIncome = (id: string, patch: Partial<IncomeDraft>) => setIncomes((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const setNeed = (index: number, patch: Partial<NeedDraft>) => setNeeds((current) => current.map((item, at) => at === index ? { ...item, ...patch } : item));

  return (
    <div className="bf-setup-copy bf-needs-start">
      <p className="bf-kicker">{t("PASUL {step} DIN 3", { step })}</p>
      {step === 1 && (
        <>
          <h2 id="bf-setup-title">{t("Ce venituri")} <em>{t("intră?")}</em></h2>
          <p>{t("Salariile și ziua în care vin de obicei. Tichetele de masă nu le trece aici: ele rămân pentru cheltuieli de moment.")}</p>
          {incomes.map((item) => (
            <div className="bf-needs-start-row" key={item.id}>
              <label className="bf-field"><span>{item.who === "partner" ? t("Al partenerului") : t("Al tău")}</span><input value={item.label} onChange={(event) => setIncome(item.id, { label: event.target.value })} /></label>
              <label className="bf-field"><span>{t("Suma")}</span><input inputMode="decimal" value={item.amount} onChange={(event) => setIncome(item.id, { amount: event.target.value })} placeholder={t("ex. 4.700")} /></label>
              <label className="bf-field"><span>{t("Ziua din lună")}</span><input inputMode="numeric" value={item.day} onChange={(event) => setIncome(item.id, { day: event.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder={t("ex. 10")} /></label>
              {incomes.length > 1 && <button type="button" className="bf-needs-remove" aria-label={t("Șterge {name}", { name: item.label })} onClick={() => setIncomes((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 size={15} /></button>}
            </div>
          ))}
          {!hasPartner && <button type="button" className="bf-secondary bf-needs-add" onClick={() => setIncomes((current) => [...current, { id: newId("income"), who: "partner", label: t("Salariul partenerului"), amount: "", day: "" }])}><Plus size={15} /> {t("Și partenerul are venit")}</button>}
          {hasPartner && <label className="bf-field"><span>{t("Numele partenerului")}</span><input value={partnerName} onChange={(event) => onPartnerName(event.target.value)} placeholder="ex. Maria" /></label>}
        </>
      )}
      {step === 2 && (
        <>
          <h2 id="bf-setup-title">{t("Ce plătiți")} <em>{t("de obicei?")}</em></h2>
          <p>{t("Bifează ce aveți și scrie cam cât. Mâncarea e pe săptămână. Intervalele (300–400) le poți pune după, în Plan.")}</p>
          <div className="bf-quick-category-picks bf-household-templates" role="group" aria-label={t("Pornește de la un șablon")}>
            <span>{t("Pornește de la")}</span>
            {HOUSEHOLD_TEMPLATES.map((template) => (
              <button type="button" key={template.id} onClick={() => setNeeds((current) => current.map((item) => {
                const amount = template.amounts[START_NEEDS.find((start) => t(start.label) === item.label)?.label || item.label];
                return amount ? { ...item, on: true, amount } : { ...item, on: false, amount: "" };
              }))}>{t(template.label)}</button>
            ))}
          </div>
          <div className="bf-needs-start-list">
            {needs.map((item, index) => (
              <div className={`bf-needs-start-need${item.on ? " is-on" : ""}`} key={item.label}>
                <label><input type="checkbox" checked={item.on} onChange={(event) => setNeed(index, { on: event.target.checked })} /> <b>{item.label}</b></label>
                {item.on && <label className="bf-field"><span>{item.cadence === "weekly" ? t("pe săptămână") : t("pe lună")}</span><input inputMode="decimal" value={item.amount} onChange={(event) => setNeed(index, { amount: event.target.value })} placeholder="0" /></label>}
              </div>
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h2 id="bf-setup-title">{t("Salariul vine")} <em>{t("mereu în aceeași zi?")}</em></h2>
          <p>{firstDay ? t("Următorul: ~{date}. Dacă poate veni cu câteva zile mai devreme sau mai târziu, plicurile se socotesc să ajungă și atunci.", { date: formatDate(firstDay, { day: "numeric", month: "long" }) }) : ""}</p>
          <label className="bf-field"><span>{t("Poate varia cu")}</span>
            <select value={flex} onChange={(event) => setFlex(Number(event.target.value))}>
              <option value={0}>{t("Nu variază")}</option>
              {[1, 2, 3, 4, 5].map((days) => <option key={days} value={days}>{days === 1 ? t("± 1 zi") : t("± {days} zile", { days })}</option>)}
            </select>
          </label>
          <p className="bf-helper">{t("Gata. Când notezi salariul, pe Astăzi apare propunerea: cât merge în fiecare plic. Nimic nu se mută fără să apeși „Aplică”.")}</p>
        </>
      )}
      {error && <p className="bf-form-error" role="alert">{error}</p>}
      <div className="bf-onboarding-actions">
        {step > 1 && <button type="button" className="bf-secondary" onClick={() => { setError(""); setStep((step - 1) as 1 | 2); }}>{t("Înapoi")}</button>}
        <button type="button" className="bf-primary" onClick={next}>{step < 3 ? <>{t("Mai departe")} <ChevronRight size={17} /></> : <><Check size={17} /> {t("Gata")}</>}</button>
      </div>
    </div>
  );
}
