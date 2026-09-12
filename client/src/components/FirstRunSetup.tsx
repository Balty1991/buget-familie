/**
 * Primul flux: 3 intenții (PRODUCT_STRATEGY) + Mai târziu.
 * track spending / organize month / family budget — rezultat în < 3 minute.
 */
import { useState } from "react";
import { Check, ChevronRight, Home, PiggyBank, ReceiptText, Users, WalletCards } from "lucide-react";
import { EnvelopeStack } from "@/components/EnvelopeMark";
import { isoToday, newId, parseRomanianAmount, type AppData, type BudgetAllocation } from "@/lib/finance-data";
import { generateFamilyPassword } from "@/lib/family-password";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { getLocale, t } from "@/lib/i18n";
import { markSetupCompletedAt } from "@/lib/first-week-tour";
import { safeSetItem } from "@/lib/safe-storage";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);

type Intent = "track" | "organize" | "family";

const PRESETS = [
  { category: "Alimente", amount: 1500, weekly: true },
  { category: "Transport", amount: 400, weekly: true },
  { category: "Casă & facturi", amount: 800, weekly: false },
] as const;

export function FirstRunSetup({ data, onChange, onClose, onGoPlan, onAdd, onOpenSync }: { data: AppData; onChange: (next: AppData) => void; onClose: () => void; onGoPlan: () => void; onAdd: () => void; onOpenSync?: (password: string) => void }) {
  const dialogRef = useFocusTrap<HTMLElement>(onClose);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [familyName, setFamilyName] = useState(data.settings.familyName === "Familia mea" ? "" : data.settings.familyName);
  const [memberName, setMemberName] = useState(data.settings.memberName === "Eu" ? "" : data.settings.memberName);
  const [partnerName, setPartnerName] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>(() => Object.fromEntries(data.settings.paymentSources.map((source) => [source.id, source.openingBalance ? String(source.openingBalance) : ""])));
  const [payday, setPayday] = useState(data.settings.salaryPlan.nextPayday || "");
  const [selected, setSelected] = useState<string[]>(["Alimente", "Casă & facturi"]);

  const complete = () => {
    safeSetItem(window.localStorage, "buget-familie:setup-complete", "true");
    markSetupCompletedAt(window.localStorage);
    safeSetItem(window.localStorage, "buget-familie:onboarding-complete", "true");
    onClose();
  };

  const applyBase = (opts: { withPartner?: boolean; withEnvelopes?: boolean; withPayday?: boolean }) => {
    const now = new Date().toISOString();
    const yourName = memberName.trim() || "Eu";
    const members = [{ id: "member-me", name: yourName, color: "#256B5B" }];
    if (opts.withPartner && partnerName.trim() && partnerName.trim().toLocaleLowerCase("ro-RO") !== yourName.toLocaleLowerCase("ro-RO")) {
      members.push({ id: newId("member"), name: partnerName.trim(), color: "#966E4A" });
    }
    const paymentSources = data.settings.paymentSources.map((source) => ({
      ...source,
      openingBalance: Math.max(0, parseRomanianAmount(balances[source.id] || "0")),
      memberId: source.kind === "transfer" ? undefined : "member-me",
    }));
    const existingLabels = new Set(data.settings.salaryPlan.allocations.map((item) => item.category || item.label));
    const allocations: BudgetAllocation[] = opts.withEnvelopes
      ? [
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
        ]
      : data.settings.salaryPlan.allocations;
    onChange({
      ...data,
      settings: {
        ...data.settings,
        familyName: familyName.trim() || (opts.withPartner ? t("Familia mea") : data.settings.familyName),
        memberName: yourName,
        members,
        paymentSources,
        salaryPlan: {
          ...data.settings.salaryPlan,
          periodStart: data.settings.salaryPlan.periodStart || isoToday(),
          nextPayday: opts.withPayday ? (payday || data.settings.salaryPlan.nextPayday) : data.settings.salaryPlan.nextPayday,
          allocations,
          updatedAt: now,
        },
      },
    });
  };

  const finishTrack = () => {
    applyBase({ withEnvelopes: false, withPayday: false });
    complete();
    onAdd();
  };

  const finishOrganize = () => {
    applyBase({ withEnvelopes: true, withPayday: true });
    complete();
    onGoPlan();
  };

  const finishFamily = () => {
    applyBase({ withPartner: true, withEnvelopes: true, withPayday: true });
    const password = generateFamilyPassword();
    complete();
    if (onOpenSync) onOpenSync(password);
    else onGoPlan();
  };

  return (
    <div className="bf-modal-backdrop bf-onboarding-backdrop" role="presentation">
      <section ref={dialogRef} tabIndex={-1} className="bf-onboarding bf-setup bf-first-run" role="dialog" aria-modal="true" aria-labelledby="bf-setup-title">
        <button className="bf-onboarding-skip" onClick={complete}>{t("Mai târziu")}</button>
        <div className="bf-setup-visual" aria-hidden="true"><EnvelopeStack fill={intent ? 0.7 : 0.35} size={96} /></div>

        {!intent && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("PRIMUL REZULTAT")}</p>
            <h2 id="bf-setup-title">{t("Ce vrei să faci")} <em>{t("acum?")}</em></h2>
            <p>{t("Alege o intenție. Poți schimba totul mai târziu — și poți apăsa Mai târziu fără nicio pierdere.")}</p>
            <p className="bf-helper">{t("Datele stau pe telefon. Sync-ul e opțional și criptat — fără cont bancar.")}</p>
            <div className="bf-first-run-intents" role="group" aria-label={t("Intenții de start")}>
              <button type="button" onClick={() => setIntent("track")}>
                <ReceiptText size={20} />
                <b>{t("Vreau doar să văd pe ce se duc banii.")}</b>
                <small>{t("Deschide direct înregistrarea unei cheltuieli.")}</small>
              </button>
              <button type="button" onClick={() => setIntent("organize")}>
                <WalletCards size={20} />
                <b>{t("Vreau să-mi organizez luna.")}</b>
                <small>{t("Primul venit și două plicuri sugerate, pe care le poți modifica.")}</small>
              </button>
              <button type="button" onClick={() => setIntent("family")}>
                <Users size={20} />
                <b>{t("Vreau un buget pentru familie.")}</b>
                <small>{t("Persoane, surse, plan comun — apoi Sync cu o parolă arătată o dată.")}</small>
              </button>
            </div>
          </div>
        )}

        {intent === "track" && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("URMĂREȘTE CHELTUIELILE")}</p>
            <h2 id="bf-setup-title">{t("Cum te cheamă?")}</h2>
            <p>{t("Opțional, dar ajută la jurnal. Apoi trecem direct la prima cheltuială.")}</p>
            <label className="bf-field"><span>{t("Numele tău")}</span><input autoFocus value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" /></label>
            <div className="bf-onboarding-actions">
              <button className="bf-primary" onClick={finishTrack}>{t("Adaugă prima cheltuială")} <ChevronRight size={17} /></button>
            </div>
          </div>
        )}

        {intent === "organize" && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("ORGANIZEAZĂ LUNA")}</p>
            <h2 id="bf-setup-title">{t("Până când vrei să ajungă")} <em>{t("banii?")}</em></h2>
            <label className="bf-field"><span>{t("Numele tău")}</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" /></label>
            <label className="bf-field"><span>{t("Următorul venit")}</span><input type="date" value={payday} onChange={(event) => setPayday(event.target.value)} /></label>
            <div className="bf-setup-presets" role="group" aria-label={t("Plicuri de start")}>
              {PRESETS.map((preset) => {
                const active = selected.includes(preset.category);
                return (
                  <button key={preset.category} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => setSelected((current) => current.includes(preset.category) ? current.filter((item) => item !== preset.category) : [...current, preset.category])}>
                    <b>{t(preset.category)}</b>
                    <small>{money(preset.amount)}{preset.weekly ? t(" · în fiecare săptămână") : t(" · pentru perioada aleasă")}</small>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </div>
            <div className="bf-setup-sources">
              {data.settings.paymentSources.slice(0, 2).map((source) => (
                <label className="bf-field" key={source.id}>
                  <span>{source.name}</span>
                  <input inputMode="decimal" value={balances[source.id] || ""} onChange={(event) => setBalances((current) => ({ ...current, [source.id]: event.target.value }))} placeholder="0" />
                </label>
              ))}
            </div>
            <div className="bf-onboarding-actions">
              <button className="bf-primary" onClick={finishOrganize}><Home size={17} /> {t("Deschide planul")}</button>
            </div>
          </div>
        )}

        {intent === "family" && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("BUGET DE FAMILIE")}</p>
            <h2 id="bf-setup-title">{t("Cine folosește")} <em>{t("aplicația?")}</em></h2>
            <label className="bf-field"><span>{t("Numele familiei")}</span><input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="ex. Familia Popescu" /></label>
            <label className="bf-field"><span>{t("Numele tău")}</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" /></label>
            <label className="bf-field"><span>{t("Partener (opțional)")}</span><input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} placeholder="ex. Maria" /></label>
            <label className="bf-field"><span>{t("Următorul venit")}</span><input type="date" value={payday} onChange={(event) => setPayday(event.target.value)} /></label>
            <div className="bf-setup-presets" role="group" aria-label={t("Plicuri de start")}>
              {PRESETS.map((preset) => {
                const active = selected.includes(preset.category);
                return (
                  <button key={preset.category} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => setSelected((current) => current.includes(preset.category) ? current.filter((item) => item !== preset.category) : [...current, preset.category])}>
                    <b>{t(preset.category)}</b>
                    <small>{money(preset.amount)}</small>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </div>
            <div className="bf-onboarding-actions">
              <button className="bf-primary" onClick={finishFamily}><PiggyBank size={17} /> {t("Creează planul familiei")}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
