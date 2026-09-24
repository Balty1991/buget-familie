import { useState } from "react";
import { applySalaryAllocationRules, autoPostDueRecurring, confirmRecurringPayment, eligibleSalaryAllocationRules, isoToday, parseRomanianAmount, unappliedSalaryIncomes, type AppData } from "@/lib/finance-data";
import { applyDeclaredBalance, balanceCheckDue, markBalanceChecked, readLastBalanceCheck, type BalanceCheckRow } from "@/lib/balance-check";
import { cycleClose } from "@/lib/cycle-close";
import { recurringFromDetection, todayBrief, weeklyCheckIn, type SubscriptionDetection } from "@/lib/household-insights";
import { getLocale, t } from "@/lib/i18n";

type Go = (view: "plan" | "obligations" | "insights") => void;

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

const dueLabel = (daysLeft: number) => {
  if (daysLeft < 0) return t("Întârziată");
  if (daysLeft === 0) return t("Azi");
  if (daysLeft === 1) return t("Mâine");
  return t("în {days} zile", { days: daysLeft });
};

/**
 * Briefing de dimineață: cât poți cheltui azi, scadențe din 7 zile, abonamente detectate, ritual de salariu.
 * Scrie în registru doar la confirmare explicită — aceeași formă sincronizată.
 */
export function TodayBrief({ data, onGo, onChange, onOpenWeek, hideSpendStamp = false, simpleMode = false }: { data: AppData; onGo: Go; onChange: (next: AppData) => void; onOpenWeek?: () => void; hideSpendStamp?: boolean; simpleMode?: boolean }) {
  const brief = todayBrief(data);
  const week = weeklyCheckIn(data);
  const rules = data.settings.salaryPlan.salaryAllocationRules || [];
  const pendingIncome = unappliedSalaryIncomes(data).find((item) => eligibleSalaryAllocationRules(data, item).length > 0);
  const needsRitual = !rules.length && unappliedSalaryIncomes(data).length > 0 && data.settings.salaryPlan.allocations.length > 0;
  const [pendingHunt, setPendingHunt] = useState<SubscriptionDetection | null>(null);
  const pay = (id: string) => {
    const next = confirmRecurringPayment(data, id);
    if (next) onChange(next);
  };
  const confirmHunt = () => {
    if (!pendingHunt) return;
    const draft = recurringFromDetection(data, pendingHunt);
    if (!draft) return;
    onChange(autoPostDueRecurring({ ...data, recurring: [...data.recurring, draft] }));
    setPendingHunt(null);
  };
  const fillEnvelopes = () => {
    if (!pendingIncome) return;
    const result = applySalaryAllocationRules(data, pendingIncome.id);
    if (!result.error) onChange(result.data);
  };

  /**
   * Verificarea soldului. Se întreabă pe rând, o sursă o dată, fiindcă răspunsul cere
   * omului să se uite în bancă sau în portofel — o listă lungă ar fi închisă din prima.
   */
  const [lastCheck, setLastCheck] = useState<string | null>(() => readLastBalanceCheck());
  const [checkedNow, setCheckedNow] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [confirmat, setConfirmat] = useState<{ name: string; amount: number } | null>(null);
  const check = balanceCheckDue(data, lastCheck);
  const deVerificat = check.rows.filter((item) => !checkedNow.includes(item.id));
  const acum = deVerificat[0];
  const inchideVerificarea = () => {
    markBalanceChecked();
    setLastCheck(isoToday());
    setCheckedNow([]);
    setDraft("");
  };
  const raspunde = (row: BalanceCheckRow, spus: string) => {
    const valoare = spus.trim() ? parseRomanianAmount(spus) : row.balance;
    const amount = valoare !== undefined && Number.isFinite(valoare) && valoare >= 0 ? valoare : row.balance;
    if (spus.trim() && Number.isFinite(valoare) && valoare >= 0) onChange(applyDeclaredBalance(data, row.id, valoare));
    setConfirmat({ name: row.name, amount });
    setDraft("");
    if (deVerificat.length <= 1) inchideVerificarea();
    else setCheckedNow((current) => [...current, row.id]);
  };

  const closed = cycleClose(data);
  const showStamp = !hideSpendStamp;
  const showIncome = Boolean(pendingIncome);
  const showRitual = needsRitual && !pendingIncome && !simpleMode;
  const showCheck = Boolean(check.due && acum && !simpleMode);
  const showCheckOk = Boolean(confirmat && !showCheck);
  const showDues = brief.dues.length > 0;
  const showHunts = brief.hunts.length > 0 || Boolean(pendingHunt);
  const showWeek = Boolean(week.shouldPrompt && !simpleMode && onOpenWeek);
  const showClose = Boolean(closed || (brief.closeSoon && !simpleMode && !closed));
  if (!showStamp && !showIncome && !showRitual && !showCheck && !showCheckOk && !showDues && !showHunts && !showWeek && !showClose) return null;

  return (
    <section className="bf-today-brief" aria-label={t("Reperul zilnic din plan")}>
      {!hideSpendStamp && (
        <button type="button" className={`bf-spend-stamp ${brief.hasPayday ? "" : "empty"} ${brief.spendable <= 0 && brief.hasPayday ? "tight" : ""}`} onClick={() => onGo("plan")}>
          <span className="bf-spend-stamp-top">
            <p className="bf-kicker">{t("REPER PENTRU AZI")}</p>
            <strong>{brief.hasPayday ? money(brief.spendable) : t("Setează venitul")}</strong>
          </span>
          <p>{brief.hasPayday && !brief.expired ? t("{reason} Este un reper din plan, nu un sold separat.", { reason: brief.reason }) : brief.reason}</p>
        </button>
      )}

      {pendingIncome && (
        <button type="button" className="bf-brief-salary" onClick={fillEnvelopes}>
          <b>{t("A venit {title}", { title: pendingIncome.title })}</b>
          <small>{money(pendingIncome.amount)} — umple plicurile după regulile tale.</small>
        </button>
      )}

      {needsRitual && !pendingIncome && !simpleMode && (
        <button type="button" className="bf-brief-salary setup" onClick={() => onGo("plan")}>
          <b>{t("Setează ritualul de salariu")}</b>
          <small>{t("Când înregistrezi venitul, plicurile se umplu după regulile tale.")}</small>
        </button>
      )}

      {check.due && acum && !simpleMode && (
        <div className="bf-brief-check">
          {confirmat && (
            <p className="bf-brief-check-ok" role="status">{t("{name} e acum {amount}, ca în portofel.", { name: confirmat.name, amount: money(confirmat.amount) })}</p>
          )}
          <b>{t("Cât ai de fapt pe „{name}”?", { name: acum.name })}</b>
          <small>{t("Eu zic {amount}. {why}", { amount: money(acum.balance), why: check.why })}</small>
          <div className="bf-brief-check-row">
            <input
              inputMode="decimal"
              aria-label={t("Soldul real de pe „{name}”", { name: acum.name })}
              placeholder={String(acum.balance)}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="button" className="bf-primary" onClick={() => raspunde(acum, draft)}>
              {draft.trim() ? t("Salvez diferența") : t("Așa e")}
            </button>
          </div>
          <button type="button" className="bf-brief-check-later" onClick={inchideVerificarea}>{t("Mai târziu")}</button>
        </div>
      )}

      {confirmat && !(check.due && acum && !simpleMode) && (
        <p className="bf-brief-check-ok" role="status">{t("{name} e acum {amount}, ca în portofel.", { name: confirmat.name, amount: money(confirmat.amount) })}</p>
      )}

      {brief.dues.length > 0 && (
        <ul className="bf-brief-dues">
          {brief.dues.map((due) => (
            <li key={`${due.kind}-${due.id}`}>
              <div>
                <b>{due.name}</b>
                <small>{dueLabel(due.daysLeft)} · {money(due.amount)}</small>
              </div>
              {due.confirmable ? (
                <button type="button" onClick={() => pay(due.id)}>{t("Confirmă")}</button>
              ) : (
                <button type="button" onClick={() => onGo("obligations")}>{t("Vezi")}</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {brief.hunts.map((hunt) => (
        <button key={hunt.key} type="button" className="bf-brief-hunt" onClick={() => setPendingHunt(hunt)}>
          <b>{t("Pare abonament · {name}", { name: hunt.name })}</b>
          <small>{money(hunt.amount)} · {hunt.reason} {t("Confirmă înainte de a adăuga la scadențe.")}</small>
        </button>
      ))}

      {pendingHunt && (
        <div className="bf-brief-hunt-confirm" role="dialog" aria-labelledby="bf-hunt-confirm-title">
          <b id="bf-hunt-confirm-title">{t("Adaugi „{name}” la scadențe?", { name: pendingHunt.name })}</b>
          <p>
            {money(pendingHunt.amount)} · {pendingHunt.reason}{" "}
            {t("Se creează o scadență locală pe confirmare manuală — nu se plătește automat.")}
          </p>
          <footer>
            <button type="button" onClick={() => setPendingHunt(null)}>{t("Nu acum")}</button>
            <button type="button" className="bf-primary" onClick={confirmHunt}>{t("Adaugă la scadențe")}</button>
          </footer>
        </div>
      )}

      {week.shouldPrompt && !simpleMode && onOpenWeek && (
        <button type="button" className="bf-brief-week" onClick={() => onOpenWeek?.()}>
          <b>{t("Bilanțul săptămânii")}</b>
          <small>{week.nextStep}</small>
        </button>
      )}

      {closed && (
        <button type="button" className="bf-brief-close" onClick={() => onGo("plan")}>
          {t("Ciclul s-a încheiat — vezi ce a rămas")}
        </button>
      )}

      {brief.closeSoon && !simpleMode && !closed && (
        <button type="button" className="bf-brief-close" onClick={() => onGo("plan")}>
          {t("Ciclul se închide. Uită-te ce a rămas.")}
        </button>
      )}
    </section>
  );
}
