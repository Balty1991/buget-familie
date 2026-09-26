/**
 * Raportul de la capătul ciclului, cu câteva zile înainte de salariu: ce a ajuns, ce nu,
 * cât a rămas și unde merge surplusul. Nimic nu se mută fără apăsare.
 */
import "../monthly-needs.css";
import { CalendarCheck } from "lucide-react";
import { formatDate, type AppData } from "@/lib/finance-data";
import { cycleEndReport } from "@/lib/household-insights";
import { daysLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";

const money = lei;

export function CycleEndCard({ data, onChange, onDone }: { data: AppData; onChange: (next: AppData) => void; onDone: (message: string) => void }) {
  const report = cycleEndReport(data);
  if (!report) return null;
  const plan = data.settings.salaryPlan;
  const close = (next: AppData, message: string) => {
    onDone(message);
    onChange({ ...next, settings: { ...next.settings, salaryPlan: { ...next.settings.salaryPlan, cycleReportDone: plan.nextPayday, updatedAt: new Date().toISOString() } } });
  };
  const toGoal = report.goal ? Math.min(report.spare, report.goal.left) : 0;
  const saveToGoal = () => {
    if (!report.goal || toGoal <= 0) return;
    const goalId = report.goal.id;
    const next = { ...data, savings: data.savings.map((item) => item.id === goalId ? { ...item, current: Math.round((item.current + toGoal) * 100) / 100, updatedAt: new Date().toISOString() } : item) };
    close(next, t("Am pus {amount} la {name}.", { amount: money(toGoal), name: report.goal.name }));
  };
  const when = report.incomeArrived ? t("Salariul a intrat; repartizează-l ca să pornească ciclul nou.") : report.daysLeft > 0 ? t("Salariul vine peste {days} (~{date}).", { days: daysLabel(report.daysLeft), date: formatDate(report.payday, { day: "numeric", month: "long" }) }) : t("Salariul e așteptat azi.");
  return (
    <section className="bf-income-split bf-cycle-end" aria-labelledby="cycle-end-title">
      <header>
        <CalendarCheck size={19} aria-hidden="true" />
        <div>
          <p className="bf-kicker">{t("FINAL DE LUNĂ")}</p>
          <h3 id="cycle-end-title">{report.over.length ? t("{made} din {total} plicuri au ajuns", { made: report.made.length, total: report.made.length + report.over.length }) : t("Toate plicurile au ajuns")}</h3>
          <p>{when} {t("În plicuri au rămas {amount}.", { amount: money(report.leftTotal) })}</p>
        </div>
      </header>
      <ul>
        {report.over.slice(0, 4).map((item) => <li key={item.id} className="is-partial"><span><b>{item.label}</b><small>{t("nu a ajuns")}</small></span><strong>−{money(item.over)}</strong></li>)}
        {report.made.filter((item) => item.left > 0).slice(0, 5).map((item) => <li key={item.id}><span><b>{item.label}</b><small>{t("a ajuns, rămân")}</small></span><strong>{money(item.left)}</strong></li>)}
      </ul>
      <footer>
        <p>{report.spare > 0
          ? t("Poți muta fără grijă {amount}: facturile plătite au lăsat rest, iar mâncarea își păstrează partea pentru zilele rămase.", { amount: money(report.spare) })
          : t("Nu prisosește nimic de mutat: ce a rămas mai trebuie în zilele până la salariu.")}</p>
        <div>
          <button type="button" className="bf-secondary" onClick={() => close(data, t("Banii rămași rămân în cont pentru luna viitoare."))}>{t("Rămân pentru luna viitoare")}</button>
          {report.goal && toGoal > 0 && <button type="button" className="bf-primary" onClick={saveToGoal}>{t("Pune {amount} la {name}", { amount: money(toGoal), name: report.goal.name })}</button>}
        </div>
      </footer>
    </section>
  );
}
