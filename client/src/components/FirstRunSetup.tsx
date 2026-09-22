/**
 * Primul flux: 4 intenții egale + Mai târziu.
 * Banii de azi întâi; plicurile rămân opționale, în Plan.
 */
import { useLayoutEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Home, PiggyBank, ReceiptText, Users, Wallet, WalletCards } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { calendarBudget } from "@/lib/calendar-budget";
import { isoDate, isoToday, newId, parseRomanianAmount, type AppData, type BudgetAllocation, type PaymentKind } from "@/lib/finance-data";
import { generateFamilyPassword } from "@/lib/family-password";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { getLocale, t } from "@/lib/i18n";
import { markSetupCompletedAt } from "@/lib/first-week-tour";
import { safeSetItem } from "@/lib/safe-storage";
import { hideNativeSplash } from "@/lib/native-splash";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);

type Intent = "track" | "money" | "organize" | "family";

const PRESETS = [
  { category: "Alimente", amount: 1500, weekly: true, weeklyRate: 600 },
  { category: "Transport", amount: 400, weekly: true, weeklyRate: 160 },
  { category: "Casă & facturi", amount: 800, weekly: false, weeklyRate: 0 },
] as const;

const PARTNER_KINDS: Array<{ kind: PaymentKind; label: string }> = [
  { kind: "card", label: "Card" },
  { kind: "cash", label: "Cash" },
  { kind: "meal", label: "Bonuri de masă" },
];

/** Luni din săptămâna curentă — dacă spui banii de azi, planul pornește de aici, nu de la 1. */
function isoMonday(from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  const dow = date.getDay();
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));
  return isoDate(date);
}

function midHorizon(paydayISO: string) {
  const start = isoMonday();
  const end = paydayISO || "";
  const calendar = end ? calendarBudget(100, start, end) : undefined;
  return {
    start,
    weeksAfter: Math.max(0, (calendar?.weeks.length ?? 1) - 1),
  };
}

export function FirstRunSetup({ data, onChange, onClose, onGoPlan, onAdd, onOpenSync }: { data: AppData; onChange: (next: AppData) => void; onClose: () => void; onGoPlan: () => void; onAdd: () => void; onOpenSync?: (password: string) => void }) {
  const [intent, setIntent] = useState<Intent | null>(null);
  useLayoutEffect(() => { hideNativeSplash(); }, []);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--bf-keyboard", `${covered}px`);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--bf-keyboard");
    };
  }, []);
  const dialogRef = useFocusTrap<HTMLElement>(() => {
    if (intent) {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      setIntent(null);
    } else onClose();
  });
  const goBack = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    dialogRef.current?.focus({ preventScroll: true });
    setIntent(null);
  };
  const [familyName, setFamilyName] = useState(data.settings.familyName === "Familia mea" ? "" : data.settings.familyName);
  const [memberName, setMemberName] = useState(data.settings.memberName === "Eu" ? "" : data.settings.memberName);
  const [partnerName, setPartnerName] = useState("");
  const [balances, setBalances] = useState<Record<string, string>>(() => Object.fromEntries(data.settings.paymentSources.map((source) => [source.id, source.openingBalance ? String(source.openingBalance) : ""])));
  const [partnerBalances, setPartnerBalances] = useState<Record<string, string>>({ card: "", cash: "", meal: "" });
  const [payday, setPayday] = useState(data.settings.salaryPlan.nextPayday || "");
  const [selected, setSelected] = useState<string[]>(["Alimente", "Casă & facturi"]);

  const moneySources = data.settings.paymentSources.filter((source) => source.kind !== "transfer");

  const complete = () => {
    safeSetItem(window.localStorage, "buget-familie:setup-complete", "true");
    markSetupCompletedAt(window.localStorage);
    safeSetItem(window.localStorage, "buget-familie:onboarding-complete", "true");
    onClose();
  };

  const applyBase = (opts: { withPartner?: boolean; withEnvelopes?: boolean; withPayday?: boolean; moneyFirst?: boolean }) => {
    const now = new Date().toISOString();
    const yourName = memberName.trim() || "Eu";
    const members = [{ id: "member-me", name: yourName, color: "#256B5B" }];
    if (opts.withPartner && partnerName.trim() && partnerName.trim().toLocaleLowerCase("ro-RO") !== yourName.toLocaleLowerCase("ro-RO")) {
      members.push({ id: newId("member"), name: partnerName.trim(), color: "#966E4A" });
    }
    const paymentSources = data.settings.paymentSources.map((source) => {
      const openingBalance = Math.max(0, parseRomanianAmount(balances[source.id] || "0"));
      return {
        ...source,
        openingBalance,
        memberId: source.kind === "transfer" ? undefined : "member-me",
        ...(openingBalance !== source.openingBalance ? { updatedAt: now } : {}),
      };
    });
    const partner = members.find((member) => member.id !== "member-me");
    if (partner) {
      for (const item of PARTNER_KINDS) {
        const amount = Math.max(0, parseRomanianAmount(partnerBalances[item.kind] || "0"));
        if (amount <= 0) continue;
        paymentSources.push({
          id: newId("source"),
          name: `${t(item.label)} · ${partner.name}`,
          kind: item.kind,
          memberId: partner.id,
          openingBalance: amount,
        });
      }
    }
    const existingLabels = new Set(data.settings.salaryPlan.allocations.map((item) => item.category || item.label));
    const horizon = midHorizon(payday);
    const funded = [...paymentSources].sort((a, b) => b.openingBalance - a.openingBalance)[0] || paymentSources[0];
    const presets = PRESETS.filter((preset) => selected.includes(preset.category));
    const allocations: BudgetAllocation[] = opts.withEnvelopes
      ? [
          ...data.settings.salaryPlan.allocations,
          ...presets.filter((preset) => !existingLabels.has(preset.category)).map((preset) => ({
            id: newId("alloc"),
            label: preset.category,
            amount: preset.amount,
            category: preset.category,
            weeklyPace: preset.weekly ? undefined : false,
            memberId: "member-me",
            sourceId: funded?.id,
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
          periodStart: opts.moneyFirst ? horizon.start : data.settings.salaryPlan.periodStart || isoToday(),
          nextPayday: opts.withPayday ? (payday || data.settings.salaryPlan.nextPayday) : data.settings.salaryPlan.nextPayday,
          allocations,
          joinedMidCycle: opts.moneyFirst ? true : data.settings.salaryPlan.joinedMidCycle,
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

  const finishMoney = () => {
    applyBase({ withPartner: Boolean(partnerName.trim()), withEnvelopes: false, withPayday: true, moneyFirst: true });
    complete();
  };

  const finishFamily = () => {
    applyBase({ withPartner: true, withEnvelopes: true, withPayday: true });
    const password = generateFamilyPassword();
    complete();
    if (onOpenSync) onOpenSync(password);
    else onGoPlan();
  };

  const cashNow = moneySources.reduce((sum, source) => sum + Math.max(0, parseRomanianAmount(balances[source.id] || "0")), 0);
  const partnerNow = PARTNER_KINDS.reduce((sum, item) => sum + Math.max(0, parseRomanianAmount(partnerBalances[item.kind] || "0")), 0);
  const totalNow = cashNow + (partnerName.trim() ? partnerNow : 0);

  return (
    <div className="bf-modal-backdrop bf-onboarding-backdrop bf-first-run-backdrop" role="presentation">
      <section ref={dialogRef} tabIndex={-1} className="bf-onboarding bf-setup bf-first-run" role="dialog" aria-modal="true" aria-labelledby="bf-setup-title">
        <div className="bf-first-run-chrome">
          {intent ? (
            <button type="button" className="bf-onboarding-back" onClick={goBack}>
              <ChevronLeft size={18} aria-hidden="true" />
              {t("Înapoi")}
            </button>
          ) : (
            <span className="bf-first-run-chrome-spacer" aria-hidden="true" />
          )}
          <button type="button" className="bf-onboarding-skip" onClick={complete}>{t("Mai târziu")}</button>
        </div>
        {/**
         * Tot ce se derulează stă într-un singur loc, sub antet.
         *
         * Înainte derula chiar dialogul, iar bara cu „Mai târziu” rămânea lipită deasupra
         * conținutului: plicul aluneca pe sub ea, iar bara — pictată cu o culoare plată
         * peste fundalul dialogului — se vedea ca un dreptunghi mai alb. Cu antetul scos
         * din zona care derulează, nu mai are ce trece pe sub el și nu mai trebuie nicio
         * potrivire de culoare.
         */}
        <div className="bf-first-run-body">
        <div className="bf-setup-visual" aria-hidden="true"><BrandMark size={72} /></div>

        {!intent && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("PRIMUL REZULTAT")}</p>
            <h2 id="bf-setup-title">{t("Ce vrei să faci")} <em>{t("acum?")}</em></h2>
            <p>{t("Plicuri pe ciclul de salariu, fără bancă. Alege o intenție — poți schimba totul mai târziu, sau Mai târziu fără nicio pierdere.")}</p>
            <p className="bf-helper bf-first-run-legal">{t("Datele stau pe telefon. Sync-ul e opțional și criptat — fără login bancar.")}</p>
            <div className="bf-first-run-intents" role="group" aria-label={t("Intenții de start")}>
              <button type="button" onClick={() => setIntent("track")}>
                <ReceiptText size={20} />
                <b>{t("Vreau doar să văd pe ce se duc banii.")}</b>
                <small>{t("Deschide direct înregistrarea unei cheltuieli.")}</small>
              </button>
              <button type="button" onClick={() => setIntent("money")}>
                <Wallet size={20} />
                <b>{t("Vreau să pun banii de azi.")}</b>
                <small>{t("Card, cash, bonuri — tu și partenerul. Plicurile, după, dacă e nevoie.")}</small>
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
            <p>{t("Opțional, dar ajută la jurnal. Poți spune și cât ai acum pe card — altfel cifra de pe Astăzi poate părea 0.")}</p>
            <label className="bf-field"><span>{t("Numele tău")}</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" enterKeyHint="done" /></label>
            {data.settings.paymentSources.slice(0, 1).map((source) => (
              <label className="bf-field" key={source.id}>
                <span>{t("Cât ai acum pe {name}? (opțional)", { name: source.name })}</span>
                <input inputMode="decimal" value={balances[source.id] || ""} onChange={(event) => setBalances((current) => ({ ...current, [source.id]: event.target.value }))} placeholder="0" />
              </label>
            ))}
            <div className="bf-onboarding-actions">
              <button className="bf-primary" onClick={finishTrack}>{t("Adaugă prima cheltuială")} <ChevronRight size={17} /></button>
            </div>
          </div>
        )}

        {intent === "money" && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("BANII DE AZI")}</p>
            <h2 id="bf-setup-title">{t("Câți bani")} <em>{t("ai acum?")}</em></h2>
            <p>{t("Card, cash, bonuri — ale tale și ale partenerului, dacă e cazul. Plicurile le pui mai târziu, în Plan, doar dacă ai nevoie.")}</p>
            <label className="bf-field"><span>{t("Numele tău")}</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" /></label>
            <label className="bf-field"><span>{t("Partener (opțional)")}</span><input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} placeholder="ex. Maria" /></label>
            <label className="bf-field"><span>{t("Următorul venit (opțional)")}</span><input type="date" value={payday} onChange={(event) => setPayday(event.target.value)} /></label>
            <div className="bf-setup-sources">
              <p><b>{t("Banii tăi")}</b></p>
              {moneySources.map((source) => (
                <label className="bf-field" key={source.id}>
                  <span>{source.name}</span>
                  <input inputMode="decimal" value={balances[source.id] || ""} onChange={(event) => setBalances((current) => ({ ...current, [source.id]: event.target.value }))} placeholder="0" />
                </label>
              ))}
            </div>
            {partnerName.trim() ? (
              <div className="bf-setup-sources">
                <p><b>{t("Banii — {name}", { name: partnerName.trim() })}</b></p>
                {PARTNER_KINDS.map((item) => (
                  <label className="bf-field" key={item.kind}>
                    <span>{t(item.label)}</span>
                    <input inputMode="decimal" value={partnerBalances[item.kind] || ""} onChange={(event) => setPartnerBalances((current) => ({ ...current, [item.kind]: event.target.value }))} placeholder="0" />
                  </label>
                ))}
              </div>
            ) : null}
            {totalNow > 0 ? (
              <p className="bf-helper">{t("În total {total} de azi. Plicurile rămân goale până le așezi tu.", { total: money(totalNow) })}</p>
            ) : (
              <p className="bf-helper">{t("Lasă gol ce nu ai. Repartizarea pe plicuri nu e obligatorie.")}</p>
            )}
            <div className="bf-onboarding-actions">
              <button className="bf-primary" onClick={finishMoney}><Home size={17} /> {t("Pune banii de azi")}</button>
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
                    <small>{money(preset.amount)}{preset.weekly ? t(" · ritm săptămânal până la venit") : t(" · pentru perioada aleasă")}</small>
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
                    <small>{money(preset.amount)}{preset.weekly ? t(" · ritm săptămânal până la venit") : t(" · pentru perioada aleasă")}</small>
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
        </div>
      </section>
    </div>
  );
}
