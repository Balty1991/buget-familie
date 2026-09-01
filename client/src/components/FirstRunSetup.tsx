/**
 * Configurare reală după turul filosofic: nume, solduri, salariu, primul plic.
 * Scrie doar câmpuri AppData deja existente; nu schimbă forma pachetului sincronizat.
 */
import { useState } from "react";
import { Check, ChevronRight, ShieldCheck, WalletCards } from "lucide-react";
import { EnvelopeStack } from "@/components/EnvelopeMark";
import { isoToday, newId, parseRomanianAmount, type AppData, type BudgetAllocation } from "@/lib/finance-data";
import { useFocusTrap } from "@/hooks/use-focus-trap";

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);

const PRESETS = [
  { category: "Alimente", amount: 1500, weekly: true },
  { category: "Transport", amount: 400, weekly: true },
  { category: "Casă & facturi", amount: 800, weekly: false },
  { category: "Abonamente", amount: 150, weekly: false },
] as const;

type SetupStep = 0 | 1 | 2 | 3;

export function FirstRunSetup({ data, onChange, onClose, onGoPlan, onAdd }: { data: AppData; onChange: (next: AppData) => void; onClose: () => void; onGoPlan: () => void; onAdd: () => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const [step, setStep] = useState<SetupStep>(0);
  const [familyName, setFamilyName] = useState(data.settings.familyName === "Familia mea" ? "" : data.settings.familyName);
  const [memberName, setMemberName] = useState(data.settings.memberName === "Eu" ? "" : data.settings.memberName);
  const [partnerName, setPartnerName] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>(() => Object.fromEntries(data.settings.paymentSources.map((source) => [source.id, source.openingBalance ? String(source.openingBalance) : ""])));
  const [payday, setPayday] = useState(data.settings.salaryPlan.nextPayday || "");
  const [selected, setSelected] = useState<string[]>(["Alimente"]);
  const complete = () => {
    window.localStorage.setItem("buget-familie:setup-complete", "true");
    window.localStorage.setItem("buget-familie:onboarding-complete", "true");
    onClose();
  };
  const apply = () => {
    const now = new Date().toISOString();
    const yourName = memberName.trim() || "Eu";
    const members = [{ id: "member-me", name: yourName, color: "#256B5B" }];
    if (partnerName.trim() && partnerName.trim().toLocaleLowerCase("ro-RO") !== yourName.toLocaleLowerCase("ro-RO")) {
      members.push({ id: newId("member"), name: partnerName.trim(), color: "#966E4A" });
    }
    const paymentSources = data.settings.paymentSources.map((source) => ({ ...source, openingBalance: Math.max(0, parseRomanianAmount(balances[source.id] || "0")), memberId: source.kind === "transfer" ? undefined : "member-me" }));
    const existingLabels = new Set(data.settings.salaryPlan.allocations.map((item) => item.category || item.label));
    const allocations: BudgetAllocation[] = [
      ...data.settings.salaryPlan.allocations,
      ...PRESETS.filter((preset) => selected.includes(preset.category) && !existingLabels.has(preset.category)).map((preset) => ({
        id: newId("alloc"),
        label: preset.category,
        amount: preset.amount,
        category: preset.category,
        weeklyPace: preset.weekly,
        memberId: "member-me",
        sourceId: paymentSources[0]?.id,
      })),
    ];
    onChange({
      ...data,
      settings: {
        ...data.settings,
        familyName: familyName.trim() || "Familia mea",
        memberName: yourName,
        members,
        paymentSources,
        salaryPlan: {
          ...data.settings.salaryPlan,
          periodStart: data.settings.salaryPlan.periodStart || isoToday(),
          nextPayday: payday || data.settings.salaryPlan.nextPayday,
          allocations,
          updatedAt: now,
        },
      },
    });
  };
  const next = () => {
    if (step === 3) {
      apply();
      complete();
      return;
    }
    setStep((value) => (value + 1) as SetupStep);
  };
  return (
    <div className="bf-modal-backdrop bf-onboarding-backdrop" role="presentation">
      <section ref={dialogRef} tabIndex={-1} className="bf-onboarding bf-setup" role="dialog" aria-modal="true" aria-labelledby="bf-setup-title">
        <button className="bf-onboarding-skip" onClick={complete}>Mai târziu</button>
        <div className="bf-setup-visual" aria-hidden="true"><EnvelopeStack fill={(step + 1) / 4} size={96} /></div>
        <p className="bf-kicker">PASUL {step + 1} DIN 4</p>
        {step === 0 && (
          <div className="bf-setup-copy">
            <h2 id="bf-setup-title">Cine folosește <em>aplicația?</em></h2>
            <p>Poți ține evidența singur sau împreună cu partenerul. Numele ajută la identificarea persoanei care a adăugat o cheltuială.</p>
            <label className="bf-field"><span>Numele familiei</span><input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="ex. Familia Popescu" /></label>
            <label className="bf-field"><span>Numele tău</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" /></label>
            <label className="bf-field"><span>Partener (opțional)</span><input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} placeholder="ex. Maria" /></label>
          </div>
        )}
        {step === 1 && (
          <div className="bf-setup-copy">
            <h2 id="bf-setup-title">Ce bani ai <em>acum?</em></h2>
            <p>Scrie aproximativ cât ai în cont, pe card sau cash. Este doar punctul de plecare și poate fi schimbat mai târziu.</p>
            <div className="bf-setup-sources">
              {data.settings.paymentSources.map((source) => (
                <label className="bf-field" key={source.id}>
                  <span>{source.name}</span>
                  <input inputMode="decimal" value={balances[source.id] || ""} onChange={(event) => setBalances((current) => ({ ...current, [source.id]: event.target.value }))} placeholder="0" />
                </label>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="bf-setup-copy">
            <h2 id="bf-setup-title">Până când vrei să ajungă <em>banii?</em></h2>
            <p>Alege ziua în care primești următorul venit. Apoi aplicația îți arată cât ai pus deoparte pentru fiecare scop până atunci.</p>
            <label className="bf-field"><span>Următorul venit</span><input type="date" value={payday} onChange={(event) => setPayday(event.target.value)} /></label>
            <div className="bf-setup-presets" role="group" aria-label="Plicuri de start">
              {PRESETS.map((preset) => {
                const active = selected.includes(preset.category);
                return (
                  <button key={preset.category} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => setSelected((current) => current.includes(preset.category) ? current.filter((item) => item !== preset.category) : [...current, preset.category])}>
                    <b>{preset.category}</b>
                    <small>{money(preset.amount)}{preset.weekly ? " · în fiecare săptămână" : " · pentru perioada aleasă"}</small>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="bf-setup-copy">
            <span className="bf-setup-shield"><ShieldCheck size={28} /></span>
            <h2 id="bf-setup-title">Datele rămân <em>la tine.</em></h2>
            <p>Registrul stă pe telefon. Sincronizarea este opțională și criptată. Nu este nevoie de cont Google sau de conectare la bancă. Pozele bonurilor rămân pe dispozitiv.</p>
            <ul className="bf-setup-privacy">
              <li>Fără conectare la bancă, fără reclame în registru, fără vânzare de date.</li>
              <li>Politica de confidențialitate o găsești în Instrumente → Încredere.</li>
              <li>Poți șterge totul local oricând din Resetare.</li>
            </ul>
          </div>
        )}
        <div className="bf-onboarding-progress" aria-hidden="true">{[0, 1, 2, 3].map((index) => <span key={index} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>
        {step < 3 ? (
          <div className="bf-onboarding-actions"><button className="bf-primary" onClick={next}>Continuă <ChevronRight size={17} /></button></div>
        ) : (
          <div className="bf-onboarding-actions bf-onboarding-choices">
            <button className="bf-primary" onClick={() => { apply(); complete(); onGoPlan(); }}><WalletCards size={17} /> Deschide planul</button>
            <button onClick={() => { apply(); complete(); onAdd(); }}>Prima mișcare</button>
          </div>
        )}
      </section>
    </div>
  );
}
