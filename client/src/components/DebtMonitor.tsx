/**
 * Monitorizare rate: cât s-a plătit, cât rămâne, ritm lunar — grafic pe luni.
 */
import "../debt-monitor.css";
import "../receipts-studio.css";
import { useMemo } from "react";
import { Landmark } from "lucide-react";
import { type AppData } from "@/lib/finance-data";
import { getLocale, t, monthsLabel, countLabel } from "@/lib/i18n";
import { debtMonitor } from "@/lib/debt-monitor";
import { money } from "@/pages/home-kit";

export function DebtMonitor({ data }: { data: AppData }) {
  const monitor = useMemo(() => debtMonitor(data), [data]);
  if (!data.debts.length && !monitor.paidTotal) return null;
  const maxBar = Math.max(1, ...monitor.series.map((item) => item.paid), monitor.monthly);
  const monthName = (key: string) => {
    const date = new Date(`${key}-01T12:00:00`);
    return date.toLocaleDateString(getLocale(), { month: "short" });
  };
  return (
    <section className="bf-debt-monitor">
      <header>
        <div>
          <p className="bf-kicker">{t("MONITORIZARE RATE")}</p>
          <h2>{t("Cât plătești")} <em>{t("și cât mai rămâne.")}</em></h2>
        </div>
        <Landmark size={18} />
      </header>
      <p className="bf-receipts-verdict">
        {monitor.thisMonthPaid > 0
          ? t("Luna asta ai plătit {paid} la rate. Mai rămân {left} pe {debts}.", { paid: money(monitor.thisMonthPaid), left: money(monitor.remaining), debts: countLabel(monitor.activeCount, { one: "{count} datorie", few: "{count} datorii", many: "{count} de datorii" }) })
          : monitor.remaining > 0
            ? t("Nu ai confirmat nicio rată luna asta. Mai rămân {left}, ritm {monthly}/lună.", { left: money(monitor.remaining), monthly: money(monitor.monthly) })
            : t("Nu mai ai datorii active.")}
      </p>
      <div className="bf-receipts-split">
        <article>
          <span>{t("Rămas")}</span>
          <strong>{money(monitor.remaining)}</strong>
          <small>{countLabel(monitor.activeCount, { one: "{count} datorie activă", few: "{count} datorii active", many: "{count} de datorii active" })}</small>
        </article>
        <article>
          <span>{t("Rate / lună")}</span>
          <strong>{money(monitor.monthly)}</strong>
          <small>{t("achitat până acum {amount}", { amount: money(monitor.paidTotal) })}</small>
        </article>
      </div>
      {monitor.series.some((item) => item.paid > 0) ? (
        <div className="bf-spend-chart" role="img" aria-label={t("Grafic plăți rate pe lună")}>
          {monitor.series.map((bucket) => {
            const height = Math.max(bucket.paid > 0 ? 8 : 4, Math.round((bucket.paid / maxBar) * 100));
            return (
              <div key={bucket.key} className="bf-spend-col">
                <small>{bucket.paid ? money(bucket.paid) : "—"}</small>
                <div className="bf-spend-stack is-debt" style={{ height: `${height}%` }}>
                  <i className="is-other" style={{ height: "100%" }} />
                </div>
                <em>{monthName(bucket.key)}</em>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="bf-helper">{t("Confirmă o plată de rată — apar aici, lună de lună.")}</p>
      )}
      {monitor.byDebt.length > 0 ? (
        <ul className="bf-debt-track">
          {monitor.byDebt.map((debt) => {
            const original = debt.paid + Math.max(0, debt.remaining);
            const share = original > 0 ? Math.min(100, Math.round((debt.paid / original) * 100)) : 0;
            return (
              <li key={debt.id}>
                <div>
                  <b>{debt.name}</b>
                  <em>{debt.monthsLeft ? t("~{months} la ritmul actual", { months: monthsLabel(debt.monthsLeft) }) : t("fără rată lunară")} · {t("rată {amount}/lună", { amount: money(debt.monthly) })}</em>
                  <span className="bf-cat-meter" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
                </div>
                <strong>{money(debt.remaining)}</strong>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
