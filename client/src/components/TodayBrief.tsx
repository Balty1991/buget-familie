import { useState } from "react";
import { applySalaryAllocationRules, autoPostDueRecurring, confirmRecurringPayment, eligibleSalaryAllocationRules, unappliedSalaryIncomes, type AppData } from "@/lib/finance-data";
import { recurringFromDetection, todayBrief, weeklyCheckIn, type SubscriptionDetection } from "@/lib/household-insights";
import { getLocale, t } from "@/lib/i18n";

type Go = (view: "plan" | "obligations" | "insights") => void;

const money = (value: number) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

const dueLabel = (daysLeft: number) => {
  if (daysLeft < 0) return t("Întârziată");
  if (daysLeft === 0) return "Azi";
  if (daysLeft === 1) return t("Mâine");
  return t("în {days} zile", { days: daysLeft });
};

/**
 * Briefing de dimineață: cât poți cheltui azi, scadențe din 7 zile, abonamente detectate, ritual de salariu.
 * Scrie în registru doar la confirmare explicită — aceeași formă sincronizată.
 */
export function TodayBrief({ data, onGo, onChange, onOpenWeek, hideSpendStamp = false }: { data: AppData; onGo: Go; onChange: (next: AppData) => void; onOpenWeek?: () => void; hideSpendStamp?: boolean }) {
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

  return (
    <section className="bf-today-brief" aria-label={t("Reperul zilnic din plan")}>
      {!hideSpendStamp && (
        <button type="button" className={`bf-spend-stamp ${brief.hasPayday ? "" : "empty"} ${brief.spendable <= 0 && brief.hasPayday ? "tight" : ""}`} onClick={() => onGo("plan")}>
          <span className="bf-spend-stamp-top">
            <p className="bf-kicker">{t("REPER PENTRU AZI")}</p>
            <strong>{brief.hasPayday ? money(brief.spendable) : t("Setează venitul")}</strong>
          </span>
          <p>{brief.hasPayday ? t("{reason} Este un reper din plan, nu un sold separat.", { reason: brief.reason }) : brief.reason}</p>
        </button>
      )}

      {pendingIncome && (
        <button type="button" className="bf-brief-salary" onClick={fillEnvelopes}>
          <b>A venit {pendingIncome.title}</b>
          <small>{money(pendingIncome.amount)} — umple plicurile după regulile tale.</small>
        </button>
      )}

      {needsRitual && !pendingIncome && (
        <button type="button" className="bf-brief-salary setup" onClick={() => onGo("plan")}>
          <b>{t("Setează ritualul de salariu")}</b>
          <small>{t("Când înregistrezi venitul, plicurile se umplu după regulile tale.")}</small>
        </button>
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
                <button type="button" onClick={() => onGo("obligations")}>Vezi</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {brief.hunts.map((hunt) => (
        <button key={hunt.key} type="button" className="bf-brief-hunt" onClick={() => setPendingHunt(hunt)}>
          <b>Pare abonament · {hunt.name}</b>
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

      {week.shouldPrompt && (
        <button type="button" className="bf-brief-week" onClick={() => onOpenWeek?.()}>
          <b>{t("Bilanțul săptămânii")}</b>
          <small>{week.nextStep}</small>
        </button>
      )}

      {brief.closeSoon && (
        <button type="button" className="bf-brief-close" onClick={() => onGo("insights")}>
          Ciclu aproape gata — închide luna din Analiză → Gospodărie
        </button>
      )}
    </section>
  );
}
