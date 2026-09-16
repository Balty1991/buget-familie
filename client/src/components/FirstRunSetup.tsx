/**
 * Primul flux: 4 intenții + Mai târziu.
 * track / mid-month / organize / family — rezultat în < 3 minute.
 */
import { useLayoutEffect, useState } from "react";
import { CalendarRange, Check, ChevronLeft, ChevronRight, Home, PiggyBank, ReceiptText, Users, WalletCards } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { calendarBudget } from "@/lib/calendar-budget";
import { isoDate, isoToday, newId, parseRomanianAmount, type AppData, type BudgetAllocation, type WeekTransfer } from "@/lib/finance-data";
import { generateFamilyPassword } from "@/lib/family-password";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { getLocale, t } from "@/lib/i18n";
import { markSetupCompletedAt } from "@/lib/first-week-tour";
import { safeSetItem } from "@/lib/safe-storage";
import { hideNativeSplash } from "@/lib/native-splash";

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type Intent = "track" | "mid" | "organize" | "family";

const PRESETS = [
  { category: "Alimente", amount: 1500, weekly: true, weeklyRate: 600 },
  { category: "Transport", amount: 400, weekly: true, weeklyRate: 160 },
  { category: "Casă & facturi", amount: 800, weekly: false, weeklyRate: 0 },
] as const;

/** Luni din săptămâna curentă — prima tranșă e „săptămâna asta”, nu un plan de la 1. */
function isoMonday(from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  const dow = date.getDay();
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));
  return isoDate(date);
}

function daysLeftThisWeek() {
  const now = new Date();
  const dow = now.getDay();
  return dow === 0 ? 1 : 8 - dow;
}

function midHorizon(paydayISO: string) {
  const start = isoMonday();
  const end = paydayISO || "";
  const calendar = end ? calendarBudget(100, start, end) : undefined;
  const slices = calendar?.weeks.length ?? 3;
  return {
    start,
    weeksAfter: Math.max(0, slices - 1),
    daysLeft: daysLeftThisWeek(),
  };
}

/** Mută surplusul din prima tranșă ca săptămâna începută să arate restul, nu cota egală. */
function pinFirstWeek(allocationId: string, leftover: number, total: number, start: string, paydayISO: string, createdAt: string): WeekTransfer[] {
  if (!paydayISO || leftover < 0 || total <= 0) return [];
  const calendar = calendarBudget(total, start, paydayISO);
  if (!calendar || calendar.weeks.length < 2) return [];
  const first = calendar.weeks[0];
  const last = calendar.weeks[calendar.weeks.length - 1];
  const delta = roundMoney(first.amount - leftover);
  if (Math.abs(delta) < 0.5) return [];
  const fromWeekIndex = delta > 0 ? first.index : last.index;
  const toWeekIndex = delta > 0 ? last.index : first.index;
  return [{
    id: newId("week-transfer"),
    allocationId,
    fromWeekIndex,
    toWeekIndex,
    amount: Math.abs(delta),
    note: t("Rămas săptămâna asta"),
    createdAt,
  }];
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
  const [payday, setPayday] = useState(data.settings.salaryPlan.nextPayday || "");
  const [selected, setSelected] = useState<string[]>(["Alimente", "Casă & facturi"]);
  const [weekLeft, setWeekLeft] = useState<Record<string, string>>({ Alimente: "150", Transport: "" });
  const [weeklyRate, setWeeklyRate] = useState<Record<string, string>>({ Alimente: "600", Transport: "" });

  const complete = () => {
    safeSetItem(window.localStorage, "buget-familie:setup-complete", "true");
    markSetupCompletedAt(window.localStorage);
    safeSetItem(window.localStorage, "buget-familie:onboarding-complete", "true");
    onClose();
  };

  const applyBase = (opts: { withPartner?: boolean; withEnvelopes?: boolean; withPayday?: boolean; midMonth?: boolean }) => {
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
    const horizon = midHorizon(payday);
    const weekTransfers: WeekTransfer[] = [...(data.settings.salaryPlan.weekTransfers || [])];
    const funded = [...paymentSources].sort((a, b) => b.openingBalance - a.openingBalance)[0] || paymentSources[0];
    const presets = opts.midMonth ? PRESETS.filter((preset) => preset.weekly) : PRESETS.filter((preset) => selected.includes(preset.category));
    const allocations: BudgetAllocation[] = opts.withEnvelopes
      ? [
          ...data.settings.salaryPlan.allocations,
          ...presets.filter((preset) => !existingLabels.has(preset.category)).flatMap((preset) => {
            const leftoverFilled = (weekLeft[preset.category] || "").trim() !== "";
            if (opts.midMonth && preset.weekly && !leftoverFilled) return [];
            const id = newId("alloc");
            let amount = preset.amount;
            let note: string | undefined;
            if (opts.midMonth && preset.weekly) {
              const leftover = Math.max(0, parseRomanianAmount(weekLeft[preset.category] || "0"));
              const rate = Math.max(0, parseRomanianAmount((weeklyRate[preset.category] || "").trim() || String(preset.weeklyRate)));
              amount = leftover + rate * horizon.weeksAfter;
              note = t("{left} rămas săptămâna asta, {rate} pe săptămână", { left: money(leftover), rate: money(rate) });
              weekTransfers.push(...pinFirstWeek(id, leftover, amount, horizon.start, payday, now));
            }
            return [{
              id,
              label: preset.category,
              amount,
              category: preset.category,
              weeklyPace: preset.weekly ? undefined : false,
              memberId: "member-me",
              sourceId: funded?.id,
              note,
            }];
          }),
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
          periodStart: opts.midMonth ? horizon.start : data.settings.salaryPlan.periodStart || isoToday(),
          nextPayday: opts.withPayday ? (payday || data.settings.salaryPlan.nextPayday) : data.settings.salaryPlan.nextPayday,
          allocations,
          weekTransfers,
          joinedMidCycle: opts.midMonth ? true : data.settings.salaryPlan.joinedMidCycle,
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

  const finishMid = () => {
    applyBase({ withEnvelopes: true, withPayday: true, midMonth: true });
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

  const horizon = midHorizon(payday);
  const weeks = horizon.weeksAfter;
  const daysLeft = horizon.daysLeft;
  const cashNow = data.settings.paymentSources.slice(0, 2).reduce((sum, source) => sum + Math.max(0, parseRomanianAmount(balances[source.id] || "0")), 0);
  const midFilled = PRESETS.filter((preset) => preset.weekly && (weekLeft[preset.category] || "").trim());
  const midWeekReserved = midFilled.reduce((sum, preset) => sum + Math.max(0, parseRomanianAmount(weekLeft[preset.category] || "0")), 0);
  const midCycleTotal = midFilled.reduce((sum, preset) => {
    const leftover = Math.max(0, parseRomanianAmount(weekLeft[preset.category] || "0"));
    const rate = Math.max(0, parseRomanianAmount((weeklyRate[preset.category] || "").trim() || String(preset.weeklyRate)));
    return sum + leftover + rate * weeks;
  }, 0);

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
        <div className="bf-setup-visual" aria-hidden="true"><BrandMark size={72} /></div>

        {!intent && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("PRIMUL REZULTAT")}</p>
            <h2 id="bf-setup-title">{t("Ce vrei să faci")} <em>{t("acum?")}</em></h2>
            <p>{t("Alege o intenție. Poți schimba totul mai târziu — și poți apăsa Mai târziu fără nicio pierdere.")}</p>
            <p className="bf-helper bf-first-run-legal">{t("Datele stau pe telefon. Sync-ul e opțional și criptat — fără cont bancar.")}</p>
            <div className="bf-first-run-intents" role="group" aria-label={t("Intenții de start")}>
              <button type="button" onClick={() => setIntent("track")}>
                <ReceiptText size={20} />
                <b>{t("Vreau doar să văd pe ce se duc banii.")}</b>
                <small>{t("Deschide direct înregistrarea unei cheltuieli.")}</small>
              </button>
              <button type="button" className="bf-intent-mid" onClick={() => setIntent("mid")}>
                <CalendarRange size={20} />
                <b>{t("Nu încep luna întreagă.")}</b>
                <small>{t("Săptămâna e începută. Pui restul de azi, apoi lei pe săptămână până la salariu.")}</small>
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

        {intent === "mid" && (
          <div className="bf-setup-copy">
            <p className="bf-kicker">{t("SĂPTĂMÂNA E ÎNCEPUTĂ")}</p>
            <h2 id="bf-setup-title">{t("Pui restul,")} <em>{t("nu planul de luni.")}</em></h2>
            <p>{t("La Alimente spui cât mai e săptămâna asta — 150 lei, de exemplu — apoi lei pe săptămână pentru cele care mai vin până la salariu.")}</p>
            <label className="bf-field"><span>{t("Numele tău")}</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="ex. Andrei" /></label>
            <label className="bf-field"><span>{t("Următorul venit")}</span><input type="date" value={payday} onChange={(event) => setPayday(event.target.value)} /></label>
            <p className="bf-helper">
              {weeks === 0
                ? t("Doar săptămâna asta până la salariu — {days} zile.", { days: String(daysLeft) })
                : t("{days} zile săptămâna asta, apoi {weeks} săptămâni până la salariu.", { days: String(daysLeft), weeks: String(weeks) })}
            </p>
            {PRESETS.filter((preset) => preset.weekly).map((preset) => {
              const leftoverFilled = (weekLeft[preset.category] || "").trim() !== "";
              const leftover = leftoverFilled ? parseRomanianAmount(weekLeft[preset.category] || "0") : 0;
              const rate = leftoverFilled ? parseRomanianAmount((weeklyRate[preset.category] || "").trim() || String(preset.weeklyRate)) : 0;
              const total = leftover + rate * weeks;
              return (
                <div key={preset.category} className="bf-setup-sources">
                  <p><b>{t(preset.category)}</b></p>
                  <label className="bf-field">
                    <span>{t("Rămas săptămâna asta")}</span>
                    <input inputMode="decimal" value={weekLeft[preset.category] || ""} onChange={(event) => setWeekLeft((current) => ({ ...current, [preset.category]: event.target.value }))} placeholder={preset.category === "Alimente" ? "150" : "0"} />
                  </label>
                  <label className="bf-field">
                    <span>{t("Pe săptămână")}</span>
                    <input inputMode="decimal" value={weeklyRate[preset.category] || ""} onChange={(event) => setWeeklyRate((current) => ({ ...current, [preset.category]: event.target.value }))} placeholder={String(preset.weeklyRate)} />
                  </label>
                  {leftoverFilled ? (
                    <p className="bf-helper">{money(leftover)} · {daysLeft} {t("zile")}. {t("Apoi")} {weeks} × {money(rate)} = {money(total)} {t("până la salariu.")}</p>
                  ) : (
                    <p className="bf-helper">{t("Lasă gol dacă nu pui plicul.")}</p>
                  )}
                </div>
              );
            })}
            <div className="bf-setup-sources">
              {data.settings.paymentSources.slice(0, 2).map((source) => (
                <label className="bf-field" key={source.id}>
                  <span>{source.name}</span>
                  <input inputMode="decimal" value={balances[source.id] || ""} onChange={(event) => setBalances((current) => ({ ...current, [source.id]: event.target.value }))} placeholder="0" />
                </label>
              ))}
            </div>
            {midWeekReserved > 0 && (
              <p className="bf-helper">
                {t("Săptămâna asta rezervăm {week} din {cash}.", { week: money(midWeekReserved), cash: money(cashNow) })}
                {" "}
                {t("Rămân {left} azi. Plicurile până la salariu sunt {cycle}.", { left: money(Math.max(0, cashNow - midWeekReserved)), cycle: money(midCycleTotal) })}
              </p>
            )}
            <div className="bf-onboarding-actions">
              <button className="bf-primary" onClick={finishMid}><Home size={17} /> {t("Așază de azi")}</button>
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
      </section>
    </div>
  );
}
