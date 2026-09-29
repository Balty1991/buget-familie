/**
 * Începutul pentru cine vrea ca aplicația să-i împartă salariul: în trei pași scurți,
 * veniturile, cheltuielile știute și cât poate varia ziua salariului. La capăt, „Ce plătim
 * lunar” e completat, iar la primul salariu notat vine propunerea de repartizare.
 */
import { useState } from "react";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { formatDate, isoToday, newId, parseRomanianAmount, type AppData, type ExpectedIncome, type MonthlyNeed, type Transaction } from "@/lib/finance-data";
import { t } from "@/lib/i18n";
import { lei as money } from "@/lib/money-format";
import { genitiveName } from "@/lib/member-mode";

type IncomeDraft = { id: string; who: "me" | "partner"; label: string; amount: string; day: string; /** Salariu care nu e la fel în fiecare lună: suma e o medie. */ variable?: boolean; /** Primește și tichete de masă: partenerul își are sursa lui, nu le pune pe ale mele. */ meal?: boolean };
type NeedDraft = { label: string; category: string; cadence: "monthly" | "weekly"; priority: "fixed" | "flex" | "buffer"; amount: string; on: boolean };

const START_NEEDS: NeedDraft[] = [
  { label: "Mâncare", category: "Alimente", cadence: "weekly", priority: "flex", amount: "", on: true },
  { label: "Chirie", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Rate bancă", category: "Credite", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Lumină", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: true },
  { label: "Gaz", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Apă", category: "Casă & facturi", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Abonamente", category: "Abonamente", cadence: "monthly", priority: "fixed", amount: "", on: false },
  { label: "Grădiniță", category: "Educație", cadence: "monthly", priority: "fixed", amount: "", on: false },
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

/** Ultima zi (azi sau în urmă) în care a venit un salariu cu ziua dată. */
export const lastDateForDay = (today: string, day: number) => {
  const base = new Date(`${today}T12:00:00`);
  const make = (offset: number) => {
    const date = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const here = make(0);
  return here <= today ? here : make(-1);
};

/** Totalul pe lună al cheltuielilor bifate: cele pe săptămână × 52/12. */
export const monthlyNeedsTotal = (needs: Array<{ on: boolean; amount: string; cadence: "weekly" | "monthly" }>) =>
  Math.round(needs.filter((item) => item.on).reduce((sum, item) => sum + Math.max(0, parseRomanianAmount(item.amount) || 0) * (item.cadence === "weekly" ? 52 / 12 : 1), 0));

export function NeedsQuickStart({ data, yourName, onYourName, partnerName, onPartnerName, onFinish }: { data: AppData; yourName: string; onYourName?: (name: string) => void; partnerName: string; onPartnerName: (name: string) => void; onFinish: (next: AppData) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [incomes, setIncomes] = useState<IncomeDraft[]>([{ id: newId("income"), who: "me", label: t("Salariul meu"), amount: "", day: "" }]);
  const [needs, setNeeds] = useState<NeedDraft[]>(START_NEEDS.map((item) => ({ ...item, label: t(item.label) })));
  const [flex, setFlex] = useState(3);
  const [onHand, setOnHand] = useState("");
  /** Facturile bifate se rezervă din banii de acum: „Poți folosi azi” nu le mai promite. */
  const [dueBefore, setDueBefore] = useState<Record<string, boolean>>({});
  /** Salariile venite de curând: sunt deja în suma de acum? Altfel se adunau de două ori (8.400 în loc de 4.100). */
  const [alreadyIn, setAlreadyIn] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const today = isoToday();
  const hasPartner = incomes.some((item) => item.who === "partner");

  const validIncomes = incomes.filter((item) => parseRomanianAmount(item.amount) > 0 && Number(item.day) >= 1 && Number(item.day) <= 31);
  const firstDay = validIncomes.map((item) => nextDateForDay(today, Math.round(Number(item.day)))).sort()[0] || "";
  const recentIncomes = validIncomes.map((item) => ({ item, date: lastDateForDay(today, Math.round(Number(item.day))) }))
    .filter(({ date }) => (Date.parse(`${today}T12:00:00`) - Date.parse(`${date}T12:00:00`)) / 86_400_000 <= 20);

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
    const expected: ExpectedIncome[] = validIncomes.map((item) => ({ id: item.id, memberId: item.who === "partner" && partnerId ? partnerId : me.id, label: item.who === "partner" && item.label.trim() === t("Salariul partenerului") && partnerName.trim() ? t("Salariul {name}", { name: genitiveName(partnerName.trim()) }) : item.label.trim() || t("Salariu"), amount: parseRomanianAmount(item.amount), day: Math.round(Number(item.day)), ...(item.variable ? { variable: true } : {}), updatedAt: now }));
    const declared: MonthlyNeed[] = needs.filter((item) => item.on && parseRomanianAmount(item.amount) > 0).map((item) => {
      const amount = parseRomanianAmount(item.amount);
      return { id: newId("need"), label: item.label, category: item.category, cadence: item.cadence, min: amount, max: amount, reserve: "max", priority: item.priority, updatedAt: now };
    });
    // Tichetele fiecăruia pe sursa lui: ale partenerului ajungeau la „Eu” (utilizator #9).
    let paymentSources = data.settings.paymentSources;
    if (partnerId && incomes.some((item) => item.who === "partner" && item.meal) && !paymentSources.some((source) => source.kind === "meal" && source.memberId === partnerId)) {
      paymentSources = [...paymentSources, { id: newId("source"), name: t("Bonuri de masă · {name}", { name: partnerName.trim() || t("partener") }), kind: "meal", memberId: partnerId, openingBalance: 0 }];
    }
    // Produs #1: banii de acum dau cifra zilei din prima zi, nu abia la salariu.
    const cash = Math.max(0, parseRomanianAmount(onHand) || 0);
    const main = paymentSources.find((source) => source.kind !== "meal");
    let transactions = data.transactions;
    let cycleStart = today;
    if (cash > 0 && main && !data.transactions.length && !(main.openingBalance > 0)) {
      // Salariul deja intrat și cuprins în suma de acum devine venitul lui, cu data lui: are
      // propunerea de plicuri pe Astăzi, iar soldul rămâne exact suma scrisă.
      const arrived = recentIncomes.filter(({ item }) => alreadyIn[item.id] !== false);
      const rows: Transaction[] = arrived.map(({ item, date }) => {
        const memberId = item.who === "partner" && partnerId ? partnerId : me.id;
        const label = expected.find((entry) => entry.id === item.id)?.label || item.label;
        return { id: newId("tx"), title: label, amount: parseRomanianAmount(item.amount), kind: "income", category: "Venit", sourceId: main.id, source: main.name, memberId, person: members.find((member) => member.id === memberId)?.name || "", date, createdAt: now };
      });
      const arrivedTotal = rows.reduce((sum, row) => sum + row.amount, 0);
      const opening = Math.round(Math.max(0, cash - arrivedTotal) * 100) / 100;
      paymentSources = paymentSources.map((source) => source.id === main.id ? { ...source, openingBalance: opening } : source);
      // Au cheltuit deja din salariu: diferența e o corecție de sold, nu o cheltuială din plicuri.
      if (arrivedTotal > cash + 0.005) rows.push({ id: `balance-check-start-${now}`, title: t("Cheltuit înainte de aplicație"), amount: Math.round((arrivedTotal - cash) * 100) / 100, kind: "expense", category: "Altele", sourceId: main.id, source: main.name, memberId: me.id, person: members.find((member) => member.id === me.id)?.name || "", date: today, allocationId: "outside", adjustment: true, createdAt: now });
      transactions = [...rows, ...transactions];
      // Ciclul pornește din ziua salariului deja intrat, ca venitul să fie al ciclului de acum.
      cycleStart = rows.filter((row) => row.kind === "income").map((row) => row.date).sort()[0] || today;
    }
    // Doar ce a bifat omul, și doar din banii scriși acum. Soldul de pornire rămâne suma lui.
    const dueSum = Math.round(needs.filter((item) => item.on && item.priority === "fixed" && item.cadence === "monthly" && dueBefore[item.label] && parseRomanianAmount(item.amount) > 0).reduce((sum, item) => sum + parseRomanianAmount(item.amount), 0) * 100) / 100;
    const reserved = cash > 0 && main && dueSum > 0 && !data.transactions.length && !(main.openingBalance > 0) ? Math.round(Math.min(dueSum, cash) * 100) / 100 : 0;
    const dueId = reserved > 0 ? newId("allocation") : "";
    const dueEnvelope = reserved > 0 && main ? { id: dueId, label: t("De plătit până la salariu"), amount: reserved, category: "Casă & facturi", sourceId: main.id, weeklyPace: false as const, updatedAt: now } : undefined;
    const plan = data.settings.salaryPlan;
    const earliest = firstDay && flex > 0 ? (() => { const date = new Date(`${firstDay}T12:00:00`); date.setDate(date.getDate() - flex); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; })() : undefined;
    onFinish({
      ...data,
      transactions,
      settings: {
        ...data.settings,
        memberName: yourName.trim() || data.settings.memberName,
        members,
        paymentSources,
        salaryPlan: {
          ...plan,
          incomes: [...(plan.incomes || []), ...expected],
          needs: [...(plan.needs || []), ...declared],
          allocations: dueEnvelope ? [...plan.allocations, dueEnvelope] : plan.allocations,
          paydayFlexDays: flex,
          ...(firstDay && !plan.nextPayday ? { periodStart: cycleStart, nextPayday: firstDay, earliestPayday: earliest && earliest > today ? earliest : today } : {}),
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
          {onYourName && <label className="bf-field"><span>{t("Numele tău")}</span><input value={yourName} onChange={(event) => onYourName(event.target.value)} placeholder="ex. Andrei" autoComplete="given-name" /></label>}
          {incomes.map((item) => (
            <div className="bf-needs-start-row" key={item.id}>
              <label className="bf-field"><span>{item.who === "partner" ? t("Al partenerului") : t("Al tău")}</span><input value={item.label} onChange={(event) => setIncome(item.id, { label: event.target.value })} /></label>
              <label className="bf-field"><span>{item.variable ? t("Suma medie") : t("Suma")}</span><input inputMode="decimal" value={item.amount} onChange={(event) => setIncome(item.id, { amount: event.target.value })} placeholder={t("ex. 4.700")} /></label>
              <label className="bf-field"><span>{t("Ziua din lună")}</span><input inputMode="numeric" value={item.day} onChange={(event) => setIncome(item.id, { day: event.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder={t("ex. 10")} /></label>
              <label className="bf-needs-meal"><input type="checkbox" checked={Boolean(item.variable)} onChange={(event) => setIncome(item.id, { variable: event.target.checked })} /> {t("Suma diferă de la lună la lună")}</label>
              {item.variable && <small className="bf-helper bf-needs-variable-hint">{t("Pune o medie. Când intră salariul, scrii suma exactă, iar împărțirea pe plicuri se face pe ea. Media o schimbi oricând din Plicuri → Ce plătim lunar.")}</small>}
              {item.who === "partner" && <label className="bf-needs-meal"><input type="checkbox" checked={Boolean(item.meal)} onChange={(event) => setIncome(item.id, { meal: event.target.checked })} /> {t("Primește și tichete de masă")}</label>}
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
          <p>{t("Bifează ce aveți și scrie cam cât. Mâncarea e pe săptămână. Intervalele (300–400) le poți pune după, în Plicuri.")}</p>
          {/* Eticheta stă deasupra rândului care derulează: în el era tăiată („rnește de la”). */}
          <p className="bf-needs-templates-label">{t("Pornește de la")}</p>
          <div className="bf-quick-category-picks bf-household-templates" role="group" aria-label={t("Pornește de la un șablon")}>
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
          {(() => {
            // Produs #4: omul vede aici, nu abia la repartizare, dacă cheltuielile încap în venit.
            const income = validIncomes.reduce((sum, item) => sum + parseRomanianAmount(item.amount), 0);
            const spend = monthlyNeedsTotal(needs);
            if (!(spend > 0) || !(income > 0)) return null;
            const gap = Math.round(income - spend);
            return (
              <p className={`bf-needs-balance${gap < 0 ? " is-short" : ""}`} role="status">
                {t("Venituri {income} · cheltuieli ~{spend}", { income: money(income), spend: money(spend) })}
                {" · "}<b>{gap < 0 ? t("lipsesc ~{amount}", { amount: money(-gap) }) : t("rămân ~{amount}", { amount: money(gap) })}</b>
              </p>
            );
          })()}
        </>
      )}
      {step === 3 && (
        <>
          <h2 id="bf-setup-title">{t("Salariul vine")} <em>{t("mereu în aceeași zi?")}</em></h2>
          {validIncomes.length > 1 ? (
            <p>{t("Următoarele: {list}. Dacă pot veni cu câteva zile mai devreme sau mai târziu, plicurile se socotesc să ajungă și atunci.", { list: validIncomes.map((item) => ({ label: item.label, date: nextDateForDay(today, Math.round(Number(item.day))) })).sort((a, b) => a.date.localeCompare(b.date)).map((item) => `${item.label} ~${formatDate(item.date, { day: "numeric", month: "long" })}`).join(", ") })}</p>
          ) : (
            <p>{firstDay ? t("Următorul: ~{date}. Dacă poate veni cu câteva zile mai devreme sau mai târziu, plicurile se socotesc să ajungă și atunci.", { date: formatDate(firstDay, { day: "numeric", month: "long" }) }) : ""}</p>
          )}
          <label className="bf-field"><span>{t("Poate varia cu")}</span>
            <select value={flex} onChange={(event) => setFlex(Number(event.target.value))}>
              <option value={0}>{t("Nu variază")}</option>
              {[1, 2, 3, 4, 5].map((days) => <option key={days} value={days}>{days === 1 ? t("± 1 zi") : t("± {days} zile", { days })}</option>)}
            </select>
          </label>
          <label className="bf-field"><span>{t("Cât aveți acum, pe card și cash? (opțional)")}</span><input inputMode="decimal" value={onHand} onChange={(event) => setOnHand(event.target.value)} placeholder={t("ex. 1.250")} /></label>
          {needs.some((item) => item.on && item.priority === "fixed" && item.cadence === "monthly" && parseRomanianAmount(item.amount) > 0) && (
            <>
              <p className="bf-kicker">{t("Ce mai ai de plătit până la salariu?")}</p>
              <p className="bf-helper">{t("Bifează facturile și ratele care se plătesc din banii de acum. Nu intră în „Poți folosi azi”.")}</p>
              {needs.filter((item) => item.on && item.priority === "fixed" && item.cadence === "monthly" && parseRomanianAmount(item.amount) > 0).map((item) => (
                <label className="bf-needs-meal" key={item.label}><input type="checkbox" checked={Boolean(dueBefore[item.label])} onChange={(event) => setDueBefore((current) => ({ ...current, [item.label]: event.target.checked }))} /> {item.label} · {money(parseRomanianAmount(item.amount))}</label>
              ))}
            </>
          )}
          {parseRomanianAmount(onHand) > 0 && recentIncomes.map(({ item, date }) => (
            <label className="bf-needs-meal" key={item.id}><input type="checkbox" checked={alreadyIn[item.id] !== false} onChange={(event) => setAlreadyIn((current) => ({ ...current, [item.id]: event.target.checked }))} /> {t("{label} din {date} a intrat deja și e în suma de mai sus", { label: item.who === "partner" && partnerName.trim() && item.label.trim() === t("Salariul partenerului") ? t("Salariul {name}", { name: genitiveName(partnerName.trim()) }) : item.label, date: formatDate(date, { day: "numeric", month: "long" }) })}</label>
          ))}
          <p className="bf-helper">{parseRomanianAmount(onHand) > 0 && firstDay ? t("Din banii de acum, pe Astăzi vezi din prima zi cât poți cheltui pe zi până pe {date}.", { date: formatDate(firstDay, { day: "numeric", month: "long" }) }) : ""}</p>
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
