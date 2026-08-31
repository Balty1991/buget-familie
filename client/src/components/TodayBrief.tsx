import { applySalaryAllocationRules, autoPostDueRecurring, confirmRecurringPayment, eligibleSalaryAllocationRules, unappliedSalaryIncomes, type AppData } from "@/lib/finance-data";
import { recurringFromDetection, todayBrief } from "@/lib/household-insights";

type Go = (view: "plan" | "obligations" | "insights") => void;

const money = (value: number) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

const dueLabel = (daysLeft: number) => {
  if (daysLeft < 0) return "Întârziată";
  if (daysLeft === 0) return "Azi";
  if (daysLeft === 1) return "Mâine";
  return `în ${daysLeft} zile`;
};

/**
 * Briefing de dimineață: cât poți cheltui azi, scadențe din 7 zile, abonamente detectate, ritual de salariu.
 * Scrie în registru doar la confirmare explicită — aceeași formă sincronizată.
 */
export function TodayBrief({ data, onGo, onChange }: { data: AppData; onGo: Go; onChange: (next: AppData) => void }) {
  const brief = todayBrief(data);
  const rules = data.settings.salaryPlan.salaryAllocationRules || [];
  const pendingIncome = unappliedSalaryIncomes(data).find((item) => eligibleSalaryAllocationRules(data, item).length > 0);
  const needsRitual = !rules.length && unappliedSalaryIncomes(data).length > 0 && data.settings.salaryPlan.allocations.length > 0;
  const pay = (id: string) => {
    const next = confirmRecurringPayment(data, id);
    if (next) onChange(next);
  };
  const addHunt = (key: string) => {
    const hit = brief.hunts.find((item) => item.key === key);
    if (!hit) return;
    const draft = recurringFromDetection(data, hit);
    if (!draft) return;
    onChange(autoPostDueRecurring({ ...data, recurring: [...data.recurring, draft] }));
  };
  const fillEnvelopes = () => {
    if (!pendingIncome) return;
    const result = applySalaryAllocationRules(data, pendingIncome.id);
    if (!result.error) onChange(result.data);
  };

  return (
    <section className="bf-today-brief" aria-label="Cât poți cheltui azi">
      <button type="button" className={`bf-spend-stamp ${brief.hasPayday ? "" : "empty"} ${brief.spendable <= 0 && brief.hasPayday ? "tight" : ""}`} onClick={() => onGo("plan")}>
        <span className="bf-spend-stamp-top">
          <p className="bf-kicker">ASTĂZI POȚI</p>
          <strong>{brief.hasPayday ? money(brief.spendable) : "Setează venitul"}</strong>
        </span>
        <p>{brief.reason}</p>
      </button>

      {pendingIncome && (
        <button type="button" className="bf-brief-salary" onClick={fillEnvelopes}>
          <b>A venit {pendingIncome.title}</b>
          <small>{money(pendingIncome.amount)} — umple plicurile după regulile tale.</small>
        </button>
      )}

      {needsRitual && !pendingIncome && (
        <button type="button" className="bf-brief-salary setup" onClick={() => onGo("plan")}>
          <b>Setează ritualul de salariu</b>
          <small>Când înregistrezi venitul, plicurile se umplu după regulile tale.</small>
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
                <button type="button" onClick={() => pay(due.id)}>Confirmă</button>
              ) : (
                <button type="button" onClick={() => onGo("obligations")}>Vezi</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {brief.hunts.map((hunt) => (
        <button key={hunt.key} type="button" className="bf-brief-hunt" onClick={() => addHunt(hunt.key)}>
          <b>Pare abonament · {hunt.name}</b>
          <small>{money(hunt.amount)} · {hunt.reason} Adaugă la scadențe.</small>
        </button>
      ))}

      {brief.closeSoon && (
        <button type="button" className="bf-brief-close" onClick={() => onGo("insights")}>
          Ciclu aproape gata — închide luna din Analiză → Gospodărie
        </button>
      )}
    </section>
  );
}
