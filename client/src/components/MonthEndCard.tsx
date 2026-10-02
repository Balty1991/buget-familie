/**
 * Pe Astăzi, în ultimele 5 zile dinainte de salariu: ce mai e de plătit, cât mai e de cheltuit
 * și o propunere pentru banii care rămân. „Nu acum” îl ascunde până la salariul următor.
 */
import { useMemo, useState } from "react";
import { CalendarClock, PiggyBank, X } from "lucide-react";
import type { AppData } from "@/lib/finance-data";
import { monthEnd } from "@/lib/month-end";
import { countLabel, t } from "@/lib/i18n";
import { lei } from "@/lib/money-format";
import { safeSetItem } from "@/lib/safe-storage";

const HIDDEN = "buget-familie:month-end-hidden";
const read = () => { try { return window.localStorage.getItem(HIDDEN) || ""; } catch { return ""; } };

export function MonthEndCard({ data, today, onChange }: { data: AppData; today: string; onChange: (next: AppData) => void }) {
  const end = useMemo(() => monthEnd(data, today), [data, today]);
  const [hidden, setHidden] = useState(read);
  const [saved, setSaved] = useState(false);
  if (!end || hidden === end.payday) return null;
  const hide = () => { try { safeSetItem(window.localStorage, HIDDEN, end.payday); } catch { /* rămâne ascuns cât e deschisă aplicația */ } setHidden(end.payday); };
  const tip = end.suggestion;
  const put = () => {
    if (!tip) return;
    onChange({ ...data, savings: data.savings.map((goal) => goal.id === tip.goal.id ? { ...goal, current: Math.round((goal.current + tip.amount) * 100) / 100, updatedAt: new Date().toISOString() } : goal) });
    setSaved(true);
  };
  return (
    <section className="bf-challenge bf-month-end" aria-label={t("Sfârșit de lună")}>
      <span className="bf-challenge-icon" aria-hidden="true"><CalendarClock size={18} /></span>
      <div>
        <p className="bf-challenge-kicker">{countLabel(end.days, { one: "SALARIUL VINE MÂINE", few: "{count} ZILE PÂNĂ LA SALARIU", many: "{count} DE ZILE PÂNĂ LA SALARIU" })}</p>
        <b>{t("Mai aveți {left} în plicuri, ~{perDay} pe zi.", { left: lei(end.flexLeft), perDay: lei(end.perDay) })}</b>
        {end.bills.length > 0 && <small>{t("De plătit până atunci: {list}.", { list: end.bills.slice(0, 3).map((bill) => `${bill.label} ${lei(bill.amount)}`).join(", ") })}</small>}
        {end.over.length > 0 && <small>{t("Peste plic: {list}.", { list: end.over.join(", ") })}</small>}
        {tip && (saved
          ? <small className="bf-month-end-done">{t("Pus deoparte în „{goal}”.", { goal: tip.goal.name })}</small>
          : <>
            <small>{t("La ritmul de acum rămân ~{left}. Puneți {amount} deoparte în „{goal}”?", { left: lei(end.projectedLeft), amount: lei(tip.amount), goal: tip.goal.name })}</small>
            <div className="bf-challenge-actions">
              <button type="button" className="bf-primary" onClick={put}><PiggyBank size={16} aria-hidden="true" /> {t("Pune deoparte {amount}", { amount: lei(tip.amount) })}</button>
              <button type="button" className="bf-link-button" onClick={hide}>{t("Nu acum")}</button>
            </div>
          </>)}
      </div>
      <button type="button" className="bf-challenge-close" aria-label={t("Ascunde până la salariu")} onClick={hide}><X size={16} /></button>
    </section>
  );
}
